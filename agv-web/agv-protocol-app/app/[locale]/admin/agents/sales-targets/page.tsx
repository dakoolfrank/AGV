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
import { Search, Plus, Edit, TrendingUp, Target } from "lucide-react";

interface SalesTarget {
  id: string;
  agentId: string;
  wallet: string;
  salesTarget: number;
  actualSales: number;
  targetAchievementPct: number;
  setBy: string;
  setAt: string;
}

export default function SalesTargetsPage() {
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [filteredTargets, setFilteredTargets] = useState<SalesTarget[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    wallet: "",
    salesTarget: "",
  });

  const fetchTargets = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);

      const res = await fetch("/api/admin/agents/sales-targets", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch sales targets");
      }

      const result = await res.json();
      if (result.success) {
        setTargets(result.targets || []);
        setFilteredTargets(result.targets || []);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching targets:", error);
      toast.error("Failed to load sales targets", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  useEffect(() => {
    let filtered = targets;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (target) =>
          target.wallet.toLowerCase().includes(searchLower) ||
          target.agentId.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTargets(filtered);
  }, [searchTerm, targets]);

  const doSignOut = async () => {
    await auth.signOut();
  };

  const formatCurrency = (amount: number, showDecimals: boolean = false) => {
    // For actual sales, always show decimals for precision
    // For very small amounts (< $0.01), show 4 decimal places
    // For small amounts (< $10), show 2 decimal places
    // For large amounts, show 0 decimal places
    let minDecimals = 0;
    let maxDecimals = 0;
    
    if (showDecimals) {
      if (amount > 0 && amount < 0.01) {
        minDecimals = 4;
        maxDecimals = 4;
      } else if (amount > 0 && amount < 10) {
        minDecimals = 2;
        maxDecimals = 2;
      } else {
        minDecimals = 2;
        maxDecimals = 2;
      }
    } else {
      minDecimals = amount > 0 && amount < 10 ? 2 : 0;
      maxDecimals = amount > 0 && amount < 10 ? 2 : 0;
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(amount);
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getAchievementColor = (pct: number) => {
    if (pct >= 2.0) return "bg-green-500";
    if (pct >= 1.0) return "bg-blue-500";
    if (pct >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleOpenDialog = (target?: SalesTarget) => {
    if (target) {
      setEditingTarget(target);
      setFormData({
        wallet: target.wallet,
        salesTarget: target.salesTarget.toString(),
      });
    } else {
      setEditingTarget(null);
      setFormData({ wallet: "", salesTarget: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.wallet || !formData.salesTarget) {
      toast.error("Please fill in all fields");
      return;
    }

    const salesTargetNum = parseFloat(formData.salesTarget);
    if (isNaN(salesTargetNum) || salesTargetNum < 0) {
      toast.error("Sales target must be a positive number");
      return;
    }

    try {
      setIsSubmitting(true);
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/admin/agents/sales-targets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: formData.wallet,
          salesTarget: salesTargetNum,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(editingTarget ? "Sales target updated" : "Sales target created");
        setIsDialogOpen(false);
        fetchTargets();
      } else {
        throw new Error(result.error || "Failed to save");
      }
    } catch (error: any) {
      console.error("Error saving target:", error);
      toast.error("Failed to save sales target", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTarget = targets.reduce((sum, t) => sum + t.salesTarget, 0);
  const totalActual = targets.reduce((sum, t) => sum + t.actualSales, 0);
  const overallAchievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

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
            <h1 className="text-2xl sm:text-3xl font-bold">Sales Targets</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Set and track sales targets for agents
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Set Target
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTarget ? "Edit Sales Target" : "Set Sales Target"}
                </DialogTitle>
                <DialogDescription>
                  Set or update the sales target for an agent
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="wallet">Wallet Address *</Label>
                  <Input
                    id="wallet"
                    value={formData.wallet}
                    onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                    placeholder="0x..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Agent will be automatically identified by wallet address (KOL ID will be auto-detected)
                  </p>
                </div>
                <div>
                  <Label htmlFor="salesTarget">Sales Target (USD)</Label>
                  <Input
                    id="salesTarget"
                    type="number"
                    value={formData.salesTarget}
                    onChange={(e) => setFormData({ ...formData, salesTarget: e.target.value })}
                    placeholder="100000"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting 
                    ? (editingTarget ? "Updating..." : "Creating...") 
                    : (editingTarget ? "Update" : "Create")
                  }
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalTarget)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Actual Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalActual, true)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overall Achievement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallAchievement.toFixed(1)}%</div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${getAchievementColor(overallAchievement / 100)}`}
                  style={{ width: `${Math.min(overallAchievement, 100)}%` }}
                />
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

        {/* Targets Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sales Targets</CardTitle>
              <CardDescription>
                {filteredTargets.length} target{filteredTargets.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Actual Sales</TableHead>
                      <TableHead>Achievement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No sales targets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTargets.map((target) => (
                        <TableRow key={target.id}>
                          <TableCell>
                            <code className="text-xs">{target.agentId}</code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{formatAddress(target.wallet)}</code>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(target.salesTarget)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(target.actualSales, true)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${getAchievementColor(target.targetAchievementPct)}`}
                                  style={{
                                    width: `${Math.min(target.targetAchievementPct * 100, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium">
                                {(target.targetAchievementPct * 100).toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {target.targetAchievementPct >= 2.0 ? (
                              <Badge variant="default" className="bg-green-500">
                                <Target className="h-3 w-3 mr-1" />
                                200%+
                              </Badge>
                            ) : target.targetAchievementPct >= 1.0 ? (
                              <Badge variant="default" className="bg-blue-500">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                100%+
                              </Badge>
                            ) : target.targetAchievementPct >= 0.5 ? (
                              <Badge variant="secondary">50%+</Badge>
                            ) : (
                              <Badge variant="outline">Below 50%</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(target)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
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

