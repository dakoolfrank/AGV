"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Lazy load KOL management component
const KOLManagement = lazy(() => import("@/components/dashboard/kol-management").then(m => ({ default: m.KOLManagement })));

// Types
interface KOL {
  kolId: string;
  name: string;
  walletAddress: string;
  email?: string | null;
  target?: number;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  updatedAt?: any;
}

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export default function KOLsPage() {
  const [kols, setKols] = useState<KOL[]>([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
  });

  // Fetch server-verified role
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false });
        return;
      }
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/whoami", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (data) setWho(data);
      } catch {
        setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
      }
    })();
  }, []);

  // Data loading
  const refreshData = async () => {
    try {
      setLoading(true);
      const ks = await getDocs(collection(db, "kols"));
      
      setKols(
        ks.docs.map((d) => {
          const v = d.data() as any;
          return {
            kolId: v.kolId,
            name: v.name ?? "",
            walletAddress: v.walletAddress ?? "",
            email: v.email ?? null,
            target: Number(v.target ?? 0),
            seed: Number(v.seed ?? 0),
            tree: Number(v.tree ?? 0),
            solar: Number(v.solar ?? 0),
            compute: Number(v.compute ?? 0),
            updatedAt: v.updatedAt ?? null,
          } as KOL;
        })
      );
    } catch (error) {
      console.error("Error loading KOLs:", error);
      toast.error("Failed to load KOLs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // KOL actions
  const createKOL = async (data: { name: string; walletAddress: string; email?: string; target?: number }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast.error("Sign-in required");
      return false;
    }
    if (!who.isAdmin) {
      toast.error("Insufficient permissions");
      return false;
    }

    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/admin/create-kol", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });

      const text = await res.text();
      const responseData = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(responseData?.error || `Create failed (${res.status})`);

      await refreshData();
      return true;
    } catch (e: any) {
      console.error("Create KOL error:", e);
      toast.error("Failed to create KOL", { description: e?.message || String(e) });
      return false;
    }
  };

  const deleteKOL = async (kolId: string) => {
    if (!who.isAdmin) return toast.error("Only Admin can delete KOLs");
    try {
      if (!auth.currentUser) return toast.error("Sign-in required");
      const idToken = await auth.currentUser.getIdToken(true);

      const res = await fetch(`/api/admin/kol/${encodeURIComponent(kolId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || "Delete failed");

      await refreshData();
      toast.success("KOL deleted");
    } catch (e: any) {
      toast.error("Delete failed", { description: e?.message || String(e) });
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
          <LoadingSpinner size="lg" text="Loading KOLs..." />
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
          <h1 className="text-3xl font-bold">KOL Management</h1>
          <p className="text-muted-foreground">
            Manage Key Opinion Leaders and their NFT allocations
          </p>
        </div>

        <Suspense fallback={<LoadingSpinner size="lg" text="Loading KOL management..." />}>
          <KOLManagement
            kols={kols}
            onDeleteKOL={deleteKOL}
            onCreateKOL={createKOL}
            canCreateKOL={who.isAdmin}
            canDeleteKOL={who.isAdmin}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
