"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Copy, Search, X } from "lucide-react";

interface Reward {
  id: string;
  period: string;
  kolId: string;
  kolName?: string;
  kolWallet?: string;
  ownPostReward: number;
  ownMintsCommission: number;
  l1OverrideCommission: number;
  l2OverrideCommission: number;
  totalEarned: number;
  immediateAmount: number;
  vestedAmount: number;
  capApplied: boolean;
  calculatedAt: any;
  campaign: string;
}

export default function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<Reward[]>([]);

  // Filters
  const [kolIdFilter, setKolIdFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");

  // Fetch rewards
  const fetchRewards = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const params = new URLSearchParams();
      if (kolIdFilter) params.append("kolId", kolIdFilter);
      if (periodFilter) params.append("period", periodFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/buypage/rewards?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch rewards");
      }

      const result = await res.json();
      if (result.success) {
        setRewards(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching rewards:", error);
      toast.error("Failed to load rewards", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const doSignOut = async () => {
    await auth.signOut();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (date.toDate) {
      return date.toDate().toLocaleString();
    }
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    return new Date(date).toLocaleString();
  };

  const clearFilters = () => {
    setKolIdFilter("");
    setPeriodFilter("");
  };

  return (
    <DashboardLayout
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL,
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6 w-full min-w-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Rewards & Commissions</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            View KOL rewards and commission breakdowns
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">KOL ID</label>
                <Input
                  placeholder="Filter by KOL ID"
                  value={kolIdFilter}
                  onChange={(e) => setKolIdFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Period</label>
                <Input
                  placeholder="Filter by period (e.g., 2024-01)"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchRewards}>
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rewards Table */}
        <Card>
          <CardHeader>
            <CardTitle>Rewards Ledger ({rewards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>KOL ID</TableHead>
                      <TableHead>KOL Name</TableHead>
                      <TableHead>Post Reward</TableHead>
                      <TableHead>Mints Commission</TableHead>
                      <TableHead>L1 Override</TableHead>
                      <TableHead>L2 Override</TableHead>
                      <TableHead>Total Earned</TableHead>
                      <TableHead>Immediate</TableHead>
                      <TableHead>Vested</TableHead>
                      <TableHead>Cap Applied</TableHead>
                      <TableHead>Calculated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground">
                          No rewards found
                        </TableCell>
                      </TableRow>
                    ) : (
                      rewards.map((reward) => (
                        <TableRow key={reward.id}>
                          <TableCell className="font-mono text-sm">{reward.period || "N/A"}</TableCell>
                          <TableCell className="font-mono text-sm">{reward.kolId || "N/A"}</TableCell>
                          <TableCell>{reward.kolName || "N/A"}</TableCell>
                          <TableCell>{formatCurrency(Number(reward.ownPostReward) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(reward.ownMintsCommission) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(reward.l1OverrideCommission) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(reward.l2OverrideCommission) || 0)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(reward.totalEarned) || 0)}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(reward.immediateAmount) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(reward.vestedAmount) || 0)}</TableCell>
                          <TableCell>{reward.capApplied ? "Yes" : "No"}</TableCell>
                          <TableCell className="text-xs">
                            {formatDate(reward.calculatedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

