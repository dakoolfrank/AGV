"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WhitelistManagement } from "@/components/dashboard/whitelist-management";

// Types
interface WhitelistedWallet {
  id: string;
  address: string;
  addedAt: Date | string;
  addedBy: string;
  status: string;
}

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
};

export default function WhitelistPage() {
  const [wallets, setWallets] = useState<WhitelistedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false });
        setLoading(false);
        return;
      }
      
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/whoami", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        
        if (res.ok) {
          const data = await res.json();
          setWho({
            authed: data.authed,
            email: data.email,
            isAdmin: data.isAdmin,
          });
          
          if (data.isAdmin) {
            await fetchWallets();
          } else {
            setLoading(false);
          }
        } else {
          setWho({ authed: false, email: null, isAdmin: false });
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setWho({ authed: false, email: null, isAdmin: false });
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const fetchWallets = async () => {
    try {
      // Use API endpoint instead of direct Firebase access
      const response = await fetch('/api/whitelist');
      if (!response.ok) {
        throw new Error('Failed to fetch wallets');
      }
      
      const data = await response.json();
      console.log({data})
      const walletsData = data.wallets.map((wallet: {
        id: string;
        address: string;
        addedAt: Date | string;
        addedBy: string;
        status: string;
      }) => ({
        id: wallet.id,
        address: wallet.address || '',
        addedAt: wallet.addedAt,
        addedBy: wallet.addedBy || 'unknown',
        status: wallet.status || 'active'
      })) as WhitelistedWallet[];
      console.log({walletsData})
      setWallets(walletsData);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      toast.error("Failed to fetch whitelisted wallets");
    } finally {
      setLoading(false);
    }
  };

  const addWallet = async (address: string) => {
    try {
      const response = await fetch('/api/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address.toLowerCase(),
          addedBy: who.email || "admin"
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add wallet');
      }
      
      toast.success("Wallet added to whitelist");
      await fetchWallets();
    } catch (error) {
      console.error("Error adding wallet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add wallet to whitelist");
    }
  };

  const removeWallet = async (walletId: string) => {
    try {
      // Find the wallet address from the walletId
      const wallet = wallets.find(w => w.id === walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const response = await fetch(`/api/whitelist?address=${encodeURIComponent(wallet.address)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove wallet');
      }
      
      toast.success("Wallet removed from whitelist");
      await fetchWallets();
    } catch (error) {
      console.error("Error removing wallet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove wallet from whitelist");
    }
  };

  const doSignOut = async () => {
    await auth.signOut();
  };

  if (loading) {
    return (
      <DashboardLayout 
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL
        }}
        onSignOut={doSignOut}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading whitelist..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!who.authed || !who.isAdmin) {
    return (
      <DashboardLayout 
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL
        }}
        onSignOut={doSignOut}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Wallet Whitelist Management</h1>
          <p className="text-muted-foreground">
            Manage whitelisted wallets for minting access
          </p>
        </div>

        <WhitelistManagement
          wallets={wallets}
          onAddWallet={addWallet}
          onRemoveWallet={removeWallet}
          onRefresh={fetchWallets}
        />
      </div>
    </DashboardLayout>
  );
}
