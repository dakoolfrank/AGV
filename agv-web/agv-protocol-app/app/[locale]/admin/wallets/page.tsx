"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WalletManagement } from "@/components/dashboard/wallet-management";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Types
interface WalletData {
  id: string;
  address: string;
  metadata: {
    tier: string;
    total_tx: number;
    avg_age: number;
    total_balance: number;
    chains_used: number;
  };
  status: {
    isWhitelisted: boolean;
    isActivated: boolean;
    hasClaimed: boolean;
    isAirdropped: boolean;
    hasBought: boolean;
    hasStaked: boolean;
  };
  timestamps: {
    firstConnected: string | null;
    activatedAt: string | null;
    claimedAt: string | null;
    firstBuyAt: string | null;
    firstStakeAt: string | null;
  };
}

interface WalletStats {
  total: number;
  whitelistedActivated: number;
  whitelistedNotActivated: number;
  activatedNotWhitelisted: number;
  totalActivated: number;
  totalClaimed: number;
  totalBought: number;
  totalStaked: number;
  byTier: {
    'Tier 1': number;
    'Tier 2': number;
    'Tier 3': number;
  };
}

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
};

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [stats, setStats] = useState<WalletStats>({
    total: 0,
    whitelistedActivated: 0,
    whitelistedNotActivated: 0,
    activatedNotWhitelisted: 0,
    totalActivated: 0,
    totalClaimed: 0,
    totalBought: 0,
    totalStaked: 0,
    byTier: {
      'Tier 1': 0,
      'Tier 2': 0,
      'Tier 3': 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
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
            await fetchWallets(true); // Initial load
            await fetchStats();
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

  const fetchWallets = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }
      
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        status: statusFilter,
        tier: tierFilter,
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/admin/wallets?${params}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch wallets');
      }
      
      const data = await response.json();
      if (data.success) {
        setWallets(data.wallets || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
      toast.error("Failed to fetch wallets");
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setTableLoading(false);
      }
    }
  };

  const fetchStats = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch('/api/admin/wallets/stats', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchWallets(false), fetchStats()]);
  };

  const handleSync = async (address: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(`/api/admin/wallets/${address}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to sync wallet');
      }

      toast.success("Wallet synced successfully");
      await fetchWallets();
    } catch (error) {
      console.error("Error syncing wallet:", error);
      toast.error("Failed to sync wallet");
    }
  };

  const handleViewDetails = async (address: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(`/api/admin/wallets/${address}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet details');
      }

      const data = await response.json();
      if (data.success) {
        setSelectedWallet(data.wallet);
        setDetailsDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching wallet details:", error);
      toast.error("Failed to fetch wallet details");
    }
  };

  const doSignOut = async () => {
    await auth.signOut();
  };

  // Debounce search and handle filter changes
  useEffect(() => {
    if (who.isAdmin && !loading) {
      const timer = setTimeout(() => {
        if (searchTerm || statusFilter !== "all" || tierFilter !== "all") {
          setPage(1); // Reset to first page on search/filter change
        }
        fetchWallets(false); // Not initial load, use table loading
      }, searchTerm ? 500 : 0); // 500ms debounce for search

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, tierFilter, searchTerm, who.isAdmin]);

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
          <LoadingSpinner size="lg" text="Loading wallets..." />
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
          <h1 className="text-3xl font-bold">Wallet Management</h1>
          <p className="text-muted-foreground">
            Centralized wallet management and status tracking
          </p>
        </div>

        <WalletManagement
          wallets={wallets}
          stats={stats}
          pagination={pagination}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          tierFilter={tierFilter}
          isLoading={tableLoading}
          onRefresh={handleRefresh}
          onSync={handleSync}
          onViewDetails={handleViewDetails}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onTierFilterChange={setTierFilter}
          onPageChange={setPage}
        />
      </div>

      {/* Wallet Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wallet Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedWallet?.address}
            </DialogDescription>
          </DialogHeader>
          {selectedWallet && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Address</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded">{selectedWallet.address}</code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Metadata</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Tier: <Badge>{selectedWallet.metadata.tier}</Badge></div>
                  <div>Total TX: {selectedWallet.metadata.total_tx}</div>
                  <div>Avg Age: {selectedWallet.metadata.avg_age}</div>
                  <div>Balance: {selectedWallet.metadata.total_balance}</div>
                  <div>Chains: {selectedWallet.metadata.chains_used}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Status</h3>
                <div className="space-y-1 text-sm">
                  <div>Whitelisted: {selectedWallet.status.isWhitelisted ? 'Yes' : 'No'}</div>
                  <div>Activated: {selectedWallet.status.isActivated ? 'Yes' : 'No'}</div>
                  <div>Claimed: {selectedWallet.status.hasClaimed ? 'Yes' : 'No'}</div>
                  <div>Bought: {selectedWallet.status.hasBought ? 'Yes' : 'No'}</div>
                  <div>Staked: {selectedWallet.status.hasStaked ? 'Yes' : 'No'}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Timestamps</h3>
                <div className="space-y-1 text-sm">
                  <div>First Connected: {selectedWallet.timestamps.firstConnected ? new Date(selectedWallet.timestamps.firstConnected).toLocaleString() : 'N/A'}</div>
                  <div>Activated At: {selectedWallet.timestamps.activatedAt ? new Date(selectedWallet.timestamps.activatedAt).toLocaleString() : 'N/A'}</div>
                  <div>Claimed At: {selectedWallet.timestamps.claimedAt ? new Date(selectedWallet.timestamps.claimedAt).toLocaleString() : 'N/A'}</div>
                  <div>First Buy: {selectedWallet.timestamps.firstBuyAt ? new Date(selectedWallet.timestamps.firstBuyAt).toLocaleString() : 'N/A'}</div>
                  <div>First Stake: {selectedWallet.timestamps.firstStakeAt ? new Date(selectedWallet.timestamps.firstStakeAt).toLocaleString() : 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

