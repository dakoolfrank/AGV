"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { PerformanceCharts } from "@/components/dashboard/performance-charts";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { OverviewChart } from "@/components/dashboard/charts/overview-chart";
import { PerformanceChart } from "@/components/dashboard/charts/performance-chart";
import { DistributionChart } from "@/components/dashboard/charts/distribution-chart";
import { TrendsChart } from "@/components/dashboard/charts/trends-chart";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TrendingUp } from "lucide-react";

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

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

interface MintEventItem {
  address: string;
  nftType: "seed" | "tree" | "solar" | "compute";
  quantity: number;
  chainId: string;
  txHash?: string | null;
  timestamp: any;
  mintType?: "public" | "agent";
}

interface MintDoc {
  kolId: string;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  perChain?: Record<string, { seed?: number; tree?: number; solar?: number; compute?: number }>;
  events?: MintEventItem[];
  updatedAt?: any;
}

export default function PerformancePage() {
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
  });
  
  const [kols, setKols] = useState<KOL[]>([]);
  const [mintDocs, setMintDocs] = useState<MintDoc[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [ks, ms] = await Promise.all([
        getDocs(collection(db, "kols")),
        getDocs(collection(db, "mintEvents")),
      ]);
      
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
      
      setMintDocs(
        ms.docs.map((d) => {
          const v = d.data() as any;
          return {
            kolId: d.id,
            seed: Number(v.seed ?? 0),
            tree: Number(v.tree ?? 0),
            solar: Number(v.solar ?? 0),
            compute: Number(v.compute ?? 0),
            perChain: v.perChain ?? {},
            events: Array.isArray(v.events) ? v.events : [],
            updatedAt: v.updatedAt ?? null,
          } as MintDoc;
        })
      );
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
          <LoadingSpinner size="lg" text="Loading performance data..." />
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
          <h1 className="text-3xl font-bold">Performance</h1>
          <p className="text-muted-foreground">
            Performance metrics and insights for your platform
          </p>
        </div>
        
        {/* Performance Charts */}
        <PerformanceCharts 
          kols={kols} 
          mintEvents={mintDocs.flatMap(doc => doc.events || [])}
        />

        {/* Individual Chart Components */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Detailed Analytics</h2>
            <p className="text-muted-foreground">
              Comprehensive performance insights and visualizations
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewChart kols={kols} />
            <PerformanceChart kols={kols} />
            <DistributionChart kols={kols} />
            <TrendsChart kols={kols} />
          </div>
        </div>

        {/* Traditional Leaderboard */}
        <Leaderboard kols={kols} />
      </div>
    </DashboardLayout>
  );
}
