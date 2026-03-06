"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { toast } from "sonner";
import { Suspense } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { bsc, polygon, arbitrum } from "thirdweb/chains";
import type { CollectionKey, ChainId } from "@/lib/contracts";
import { COMPUTE_ABI, NFT_CONTRACTS, SEED_ABI, SOLAR_ABI, TREE_ABI } from "@/lib/contracts";
import { thirdwebClient } from "@/app/provider";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PerformanceCharts } from "@/components/dashboard/performance-charts";
import { OverviewChart } from "@/components/dashboard/charts/overview-chart";
import { PerformanceChart } from "@/components/dashboard/charts/performance-chart";
import { DistributionChart } from "@/components/dashboard/charts/distribution-chart";
import { TrendsChart } from "@/components/dashboard/charts/trends-chart";
import { RealTimeRefresh } from "@/components/dashboard/real-time-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Shield,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Settings
} from "lucide-react";

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
  updatedAt?: unknown;
}

interface MintEventItem {
  address: string;
  nftType: "seed" | "tree" | "solar" | "compute";
  quantity: number;
  chainId: string;
  txHash?: string | null;
  timestamp: unknown;
}

interface MintDoc {
  kolId: string;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  perChain?: Record<string, { seed?: number; tree?: number; solar?: number; compute?: number }>;
  events?: MintEventItem[];
  updatedAt?: unknown;
}

// type RangeMode = "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "YTD" | "MONTHS_IN_YEAR";

interface WhoAmI {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  claims: {
    role: string | null;
    roles: string[];
    admin: boolean;
  };
}

// Constants
const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;
export const NFT_ABI = {
  seed: SEED_ABI,
  tree: TREE_ABI,
  solar: SOLAR_ABI,
  compute: COMPUTE_ABI,
} as const;
// Helper function to convert BigInt to number
const n = (value: unknown) => Number(value || 0);

// Map chain IDs to thirdweb chain objects
const THIRDWEB_CHAINS = {
  "56": bsc,
  "137": polygon,
  "42161": arbitrum,
} as const;

// Hook to get NFT contract instance
function useNftContract(nft: keyof typeof NFT_ABI, chainId: ChainId) {
  return useMemo(() => {
    const addr = NFT_CONTRACTS[chainId]?.[nft];
    if (!addr) return null;
    return getContract({
      client: thirdwebClient,
      address: addr,
      chain: THIRDWEB_CHAINS[chainId],
      abi: NFT_ABI[nft as CollectionKey],
    });
  }, [nft, chainId]);
}

export default function DashboardPage() {
  // Data state
  const [kols, setKols] = useState<KOL[]>([]);
  const [mintDocs, setMintDocs] = useState<MintDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Chart state (unused but kept for future use)
  // const [rangeMode, setRangeMode] = useState<RangeMode>("THIS_WEEK");
  // const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Admin management state
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
    claims: {
      role: null,
      roles: [],
      admin: false,
    },
  });
  const [adminEmail, setAdminEmail] = useState("");
  const [roleBusy, setRoleBusy] = useState<"grant" | "revoke" | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // ---- Thirdweb contracts & reads (hooks)
  const seed56 = useNftContract("seed", "56");
  const seed137 = useNftContract("seed", "137");
  const seed42161 = useNftContract("seed", "42161");
  const tree56 = useNftContract("tree", "56");
  const tree137 = useNftContract("tree", "137");
  const tree42161 = useNftContract("tree", "42161");
  const solar56 = useNftContract("solar", "56");
  const solar137 = useNftContract("solar", "137");
  const solar42161 = useNftContract("solar", "42161");
  const compute56 = useNftContract("compute", "56");
  const compute137 = useNftContract("compute", "137");
  const compute42161 = useNftContract("compute", "42161");

  const { data: seed56S } = useReadContract({
    contract: seed56!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!seed56 },
  });
  const { data: seed137S } = useReadContract({
    contract: seed137!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!seed137 },
  });
  const { data: seed42161S } = useReadContract({
    contract: seed42161!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!seed42161 },
  });

  const { data: tree56S } = useReadContract({
    contract: tree56!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!tree56 },
  });
  const { data: tree137S } = useReadContract({
    contract: tree137!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!tree137 },
  });
  const { data: tree42161S } = useReadContract({
    contract: tree42161!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!tree42161 },
  });

  const { data: solar56S } = useReadContract({
    contract: solar56!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!solar56 },
  });
  const { data: solar137S } = useReadContract({
    contract: solar137!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!solar137 },
  });
  const { data: solar42161S } = useReadContract({
    contract: solar42161!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!solar42161 },
  });

  const { data: compute56S } = useReadContract({
    contract: compute56!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!compute56 },
  });
  const { data: compute137S } = useReadContract({
    contract: compute137!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!compute137 },
  });
  const { data: compute42161S } = useReadContract({
    contract: compute42161!,
    method: "totalSupply",
    params: [],
    queryOptions: { enabled: !!compute42161 },
  });

  // ---- Derived on-chain totals
  const onchainTotals = useMemo(
    () => ({
      seed: n(seed56S) + n(seed137S) + n(seed42161S),
      tree: n(tree56S) + n(tree137S) + n(tree42161S),
      solar: n(solar56S) + n(solar137S) + n(solar42161S),
      compute: n(compute56S) + n(compute137S) + n(compute42161S),
      perChain: {
        "56": {
          seed: n(seed56S),
          tree: n(tree56S),
          solar: n(solar56S),
          compute: n(compute56S),
        },
        "137": {
          seed: n(seed137S),
          tree: n(tree137S),
          solar: n(solar137S),
          compute: n(compute137S),
        },
        "42161": {
          seed: n(seed42161S),
          tree: n(tree42161S),
          solar: n(solar42161S),
          compute: n(compute42161S),
        },
      } as Record<ChainId, Record<"seed" | "tree" | "solar" | "compute", number>>,
    }),
    [
      seed56S,
      seed137S,
      seed42161S,
      tree56S,
      tree137S,
      tree42161S,
      solar56S,
      solar137S,
      solar42161S,
      compute56S,
      compute137S,
      compute42161S,
    ]
  );

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
          const v = d.data() as Record<string, unknown>;
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
          const v = d.data() as Record<string, unknown>;
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
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Fetch server-verified admin role
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) {
        setWho({ 
          authed: false, 
          email: null, 
          isAdmin: false, 
          isSuperAdmin: false,
          claims: { role: null, roles: [], admin: false }
        });
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

  // Computed stats
  const stats = useMemo(() => {
    const kolTotals = kols.reduce(
      (acc, k) => {
        acc.seed += Number(k.seed ?? 0);
        acc.tree += Number(k.tree ?? 0);
        acc.solar += Number(k.solar ?? 0);
        acc.compute += Number(k.compute ?? 0);
        return acc;
      },
      { seed: 0, tree: 0, solar: 0, compute: 0 }
    );

    const totalMints = kolTotals.seed + kolTotals.tree + kolTotals.solar + kolTotals.compute;
    const totalValue = 
      kolTotals.seed * NFT_PRICES.seed +
      kolTotals.tree * NFT_PRICES.tree +
      kolTotals.solar * NFT_PRICES.solar +
      kolTotals.compute * NFT_PRICES.compute;

    const totalEventsApprox = mintDocs.reduce(
      (s, d) => s + (Array.isArray(d.events) ? Math.min(d.events.length, 500) : 0),
      0
    );

    return {
      totalKols: kols.length,
      totalMints,
      totalValue,
      activeKols: kols.filter(k => (k.seed ?? 0) + (k.tree ?? 0) + (k.solar ?? 0) + (k.compute ?? 0) > 0).length,
      totalEvents: totalEventsApprox,
      onchainTotals,
    };
  }, [kols, mintDocs, onchainTotals]);

  const doSignOut = async () => {
    await auth.signOut();
  };

  const changeAdminRole = async (action: "grant" | "revoke") => {
    const email = adminEmail.trim();
    if (!email) return toast.error("Enter an email");
    if (!auth.currentUser) return toast.error("Sign-in required");
    setRoleBusy(action);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/admin/users/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);
      toast.success(`${action === "grant" ? "Granted" : "Revoked"} admin for ${email}`);
      setAdminEmail("");
      setShowAdminModal(false);
    } catch (e: unknown) {
      toast.error(`${action === "grant" ? "Grant" : "Revoke"} failed`, {
        description: (e as Error)?.message || String(e),
      });
    } finally {
      setRoleBusy(null);
    }
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
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

  // Main dashboard
  return (
    <DashboardLayout 
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">Dashboard Overview</h1>
              {who.isSuperAdmin && (
                <Badge variant="default" className="bg-purple-600 text-white">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Super Admin
                </Badge>
              )}
              {who.isAdmin && !who.isSuperAdmin && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              Welcome to the AGV Protocol admin dashboard
            </p>
            {who.authed && (
              <p className="text-xs text-muted-foreground mt-1">
                Signed in as: <span className="font-medium">{who.email}</span>
              </p>
            )}
          </div>
          
          <div className="flex-shrink-0 flex items-center gap-3">
            {who.isSuperAdmin && (
              <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Manage Admins
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Admin Management
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">User Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="user@company.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Changes take effect after the user refreshes their token (sign out/in).
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeAdminRole("revoke")}
                        disabled={!adminEmail || roleBusy !== null}
                        className="gap-2"
                      >
                        <UserMinus className="w-4 h-4" />
                        {roleBusy === "revoke" ? "Revoking..." : "Revoke Admin"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => changeAdminRole("grant")}
                        disabled={!adminEmail || roleBusy !== null}
                        className="gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        {roleBusy === "grant" ? "Granting..." : "Grant Admin"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <RealTimeRefresh
              onRefresh={refreshData}
              isRefreshing={loading}
              lastUpdated={lastUpdated || undefined}
              autoRefresh={autoRefresh}
              onToggleAutoRefresh={setAutoRefresh}
            />
          </div>
        </div>

        <Suspense fallback={<LoadingSpinner size="lg" text="Loading stats..." />}>
          <StatsOverview stats={stats} />
        </Suspense>

        {/* On-chain totals */}
        <Card>
          <CardHeader>
            <CardTitle>All Chains — On-chain Mint Totals (All mints)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(["seed", "tree", "solar", "compute"] as const).map((pass) => {
                const label =
                  pass === "seed"
                    ? "SeedPass"
                    : pass === "tree"
                    ? "TreePass"
                    : pass === "solar"
                    ? "SolarPass"
                    : "ComputePass";
                const total = (onchainTotals as Record<string, unknown>)[pass] as number;
                return (
                  <div
                    key={`onchain-${pass}`}
                    className="border border-gray-200 rounded-xl p-3 bg-gray-50"
                  >
                    <div className="flex justify-between items-baseline">
                      <strong className="text-sm font-medium">{label}</strong>
                      <span className="font-bold text-lg">{total}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(["56", "137", "42161"] as ChainId[]).map((cid) => (
                        <div
                          key={`${pass}-${cid}`}
                          className="flex justify-between text-xs text-gray-600"
                        >
                          <span>
                            {cid === "56"
                              ? "BNB"
                              : cid === "137"
                              ? "Polygon"
                              : "Arbitrum"}
                          </span>
                          <span>{onchainTotals.perChain[cid][pass]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2 w-full">
          {/* Left Column - Traditional Leaderboard */}
          <div className="order-2 lg:order-1 w-full min-w-0">
            <Suspense fallback={<LoadingSpinner size="lg" text="Loading leaderboard..." />}>
              <Leaderboard kols={kols} />
            </Suspense>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="order-1 lg:order-2 w-full min-w-0">
            <Suspense fallback={<LoadingSpinner size="lg" text="Loading activity..." />}>
              <RecentActivity
                mintEvents={mintDocs.flatMap(doc => doc.events || [])}
                kols={kols}
              />
            </Suspense>
          </div>
        </div>

        {/* Analytics Charts Row */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Performance Analytics</h2>
            <p className="text-muted-foreground">
              Detailed insights and visualizations of KOL performance
            </p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {/* Overview Chart */}
            <div className="order-1">
              <Suspense fallback={<LoadingSpinner size="sm" text="Loading overview..." />}>
                <OverviewChart kols={kols} />
              </Suspense>
            </div>

            {/* Distribution Chart */}
            <div className="order-2">
              <Suspense fallback={<LoadingSpinner size="sm" text="Loading distribution..." />}>
                <DistributionChart kols={kols} />
              </Suspense>
            </div>
            {/* Performance Chart */}
            <div className="order-3">
              <Suspense fallback={<LoadingSpinner size="sm" text="Loading performance..." />}>
                <PerformanceChart kols={kols} />
              </Suspense>
            </div>
            {/* Trends Chart */}
            <div className="order-4">
              <Suspense fallback={<LoadingSpinner size="sm" text="Loading trends..." />}>
                <TrendsChart kols={kols} />
              </Suspense>
            </div>
          </div>
        </div>


        {/* Performance Charts */}
        <Suspense fallback={<LoadingSpinner size="lg" text="Loading performance charts..." />}>
          <PerformanceCharts 
            kols={kols} 
            mintEvents={mintDocs.flatMap(doc => doc.events || [])}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}


















