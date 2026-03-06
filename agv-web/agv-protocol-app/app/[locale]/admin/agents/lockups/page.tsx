"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Lock, Unlock, Calendar, TrendingUp } from "lucide-react";

interface Lockup {
  id: string;
  agentId: string;
  wallet: string;
  totalAllocated: number;
  lockedAmount: number;
  releasedAmount: number;
  lockupStartDate: string | null;
  releaseStartDate: string | null;
  releaseEndDate: string | null;
  salesTarget: number;
  actualSales: number;
  targetAchievementPct: number;
  calculatedReleasePct: number;
}

export default function LockupsPage() {
  const [loading, setLoading] = useState(true);
  const [lockups, setLockups] = useState<Lockup[]>([]);
  const [filteredLockups, setFilteredLockups] = useState<Lockup[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tgeDate, setTgeDate] = useState("");

  const fetchLockups = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);

      const res = await fetch("/api/admin/agents/lockups", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch lockups");
      }

      const result = await res.json();
      if (result.success) {
        setLockups(result.lockups || []);
        setFilteredLockups(result.lockups || []);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching lockups:", error);
      toast.error("Failed to load lockups", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockups();
  }, []);

  useEffect(() => {
    let filtered = lockups;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lockup) =>
          lockup.wallet.toLowerCase().includes(searchLower) ||
          lockup.agentId.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLockups(filtered);
  }, [searchTerm, lockups]);

  const doSignOut = async () => {
    await auth.signOut();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString();
  };

  const handleInitialize = async () => {
    if (!tgeDate) {
      toast.error("Please enter TGE date");
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch("/api/admin/agents/lockups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "initialize",
          tgeDate: new Date(tgeDate).toISOString(),
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`Initialized ${result.results.length} lockups`);
        setIsDialogOpen(false);
        setTgeDate("");
        fetchLockups();
      } else {
        throw new Error(result.error || "Failed to initialize");
      }
    } catch (error: any) {
      console.error("Error initializing lockups:", error);
      toast.error("Failed to initialize lockups", { description: error.message });
    }
  };

  const getReleaseStatus = (lockup: Lockup) => {
    if (!lockup.releaseStartDate) return "Not Initialized";
    const now = new Date();
    const releaseStart = new Date(lockup.releaseStartDate);
    const releaseEnd = lockup.releaseEndDate ? new Date(lockup.releaseEndDate) : null;

    if (now < releaseStart) return "Locked";
    if (releaseEnd && now >= releaseEnd) return "Fully Released";
    return "Releasing";
  };

  const totalAllocated = lockups.reduce((sum, l) => sum + l.totalAllocated, 0);
  const totalLocked = lockups.reduce((sum, l) => sum + l.lockedAmount, 0);
  const totalReleased = lockups.reduce((sum, l) => sum + l.releasedAmount, 0);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">preGVT Lockups</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Monitor lockup periods and performance-based release schedules
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Initialize Lockups
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Initialize Lockups</DialogTitle>
                <DialogDescription>
                  Set TGE date to initialize lockup periods for all agents. Lockup starts 6 months after TGE.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="tgeDate">TGE Date</Label>
                  <Input
                    id="tgeDate"
                    type="datetime-local"
                    value={tgeDate}
                    onChange={(e) => setTgeDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lockup will start 6 months after this date
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInitialize}>
                  Initialize
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalAllocated)}</div>
              <p className="text-xs text-muted-foreground">preGVT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Locked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalLocked)}</div>
              <p className="text-xs text-muted-foreground">preGVT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Released</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totalReleased)}</div>
              <p className="text-xs text-muted-foreground">preGVT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Release Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalAllocated > 0
                  ? ((totalReleased / totalAllocated) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by wallet or agent ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lockups Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Lockup Status</CardTitle>
              <CardDescription>
                {filteredLockups.length} lockup{filteredLockups.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Allocated</TableHead>
                      <TableHead>Locked</TableHead>
                      <TableHead>Released</TableHead>
                      <TableHead>Release %</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLockups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No lockups found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLockups.map((lockup) => {
                        const status = getReleaseStatus(lockup);
                        return (
                          <TableRow key={lockup.id}>
                            <TableCell>
                              <code className="text-xs">{lockup.agentId}</code>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs">{formatAddress(lockup.wallet)}</code>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{formatNumber(lockup.totalAllocated)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-muted-foreground">
                                {formatNumber(lockup.lockedAmount)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-green-600">
                                {formatNumber(lockup.releasedAmount)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{
                                      width: `${(lockup.releasedAmount / lockup.totalAllocated) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm">
                                  {((lockup.releasedAmount / lockup.totalAllocated) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="text-xs">
                                  Sales: {formatCurrency(lockup.actualSales)} / {formatCurrency(lockup.salesTarget)}
                                </div>
                                <Badge
                                  variant={
                                    lockup.targetAchievementPct >= 2.0
                                      ? "default"
                                      : lockup.targetAchievementPct >= 1.0
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="w-fit"
                                >
                                  {(lockup.targetAchievementPct * 100).toFixed(1)}% target
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {status === "Not Initialized" ? (
                                <Badge variant="outline">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Not Set
                                </Badge>
                              ) : status === "Locked" ? (
                                <Badge variant="secondary">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Locked
                                </Badge>
                              ) : status === "Releasing" ? (
                                <Badge variant="default" className="bg-blue-500">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Releasing
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-500">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Released
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

