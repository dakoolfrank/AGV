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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, CheckCircle, DollarSign, XCircle, Clock } from "lucide-react";

interface Settlement {
  id: string;
  period: string;
  agentId: string;
  wallet: string;
  totalCommissionUSD: number;
  usdtPayoutAmount: number;
  status: "pending" | "verified" | "paid" | "rejected";
  verifiedBy?: string;
  verifiedAt?: string;
  paidAt?: string;
  txHash?: string;
  notes?: string;
  createdAt: string;
}

export default function SettlementsPage() {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [filteredSettlements, setFilteredSettlements] = useState<Settlement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState("");
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [generatePeriod, setGeneratePeriod] = useState("");
  const [payData, setPayData] = useState({ txHash: "", notes: "" });

  const fetchSettlements = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (periodFilter) params.append("period", periodFilter);

      const res = await fetch(`/api/admin/agents/settlements?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch settlements");
      }

      const result = await res.json();
      if (result.success) {
        setSettlements(result.settlements || []);
        setFilteredSettlements(result.settlements || []);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching settlements:", error);
      toast.error("Failed to load settlements", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    let filtered = settlements;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (settlement) =>
          settlement.wallet.toLowerCase().includes(searchLower) ||
          settlement.agentId.toLowerCase().includes(searchLower) ||
          settlement.period.toLowerCase().includes(searchLower) ||
          settlement.txHash?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSettlements(filtered);
  }, [searchTerm, settlements]);

  const doSignOut = async () => {
    await auth.signOut();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  const handleGenerate = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch("/api/admin/agents/settlements/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "generate",
          period: generatePeriod || undefined,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`Generated ${result.settlements.length} settlements for ${result.period}`);
        setIsGenerateDialogOpen(false);
        setGeneratePeriod("");
        fetchSettlements();
      } else {
        throw new Error(result.error || "Failed to generate");
      }
    } catch (error: any) {
      console.error("Error generating settlements:", error);
      toast.error("Failed to generate settlements", { description: error.message });
    }
  };

  const handleVerify = async (settlementId: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`/api/admin/agents/settlements/${settlementId}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Settlement verified");
        fetchSettlements();
      } else {
        throw new Error(result.error || "Failed to verify");
      }
    } catch (error: any) {
      console.error("Error verifying settlement:", error);
      toast.error("Failed to verify settlement", { description: error.message });
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedSettlement || !payData.txHash) {
      toast.error("Please enter transaction hash");
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`/api/admin/agents/settlements/${selectedSettlement.id}/mark-paid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          txHash: payData.txHash,
          notes: payData.notes || undefined,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Settlement marked as paid");
        setIsPayDialogOpen(false);
        setSelectedSettlement(null);
        setPayData({ txHash: "", notes: "" });
        fetchSettlements();
      } else {
        throw new Error(result.error || "Failed to mark as paid");
      }
    } catch (error: any) {
      console.error("Error marking as paid:", error);
      toast.error("Failed to mark as paid", { description: error.message });
    }
  };

  const totals = settlements.reduce(
    (acc, s) => {
      acc.totalUSD += s.totalCommissionUSD;
      acc.totalUSDT += s.usdtPayoutAmount;
      acc.pending += s.status === "pending" ? s.usdtPayoutAmount : 0;
      acc.verified += s.status === "verified" ? s.usdtPayoutAmount : 0;
      acc.paid += s.status === "paid" ? s.usdtPayoutAmount : 0;
      return acc;
    },
    { totalUSD: 0, totalUSDT: 0, pending: 0, verified: 0, paid: 0 }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "verified":
        return (
          <Badge variant="secondary">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            <DollarSign className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Weekly Settlements</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Manage weekly USDT payouts for agents
            </p>
          </div>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Settlements
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Weekly Settlements</DialogTitle>
                <DialogDescription>
                  Generate settlement batch for a specific period. Leave empty for current week.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="period">Period (Optional)</Label>
                  <Input
                    id="period"
                    value={generatePeriod}
                    onChange={(e) => setGeneratePeriod(e.target.value)}
                    placeholder="2024-W42 (leave empty for current week)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: YYYY-W## (e.g., 2024-W42)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate}>Generate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalUSD)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalUSDT)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.pending)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.verified)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.paid)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by wallet, agent ID, period, or txHash..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Period (e.g., 2024-W42)"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Settlements Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Settlements</CardTitle>
              <CardDescription>
                {filteredSettlements.length} settlement{filteredSettlements.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Payout (USDT)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified By</TableHead>
                      <TableHead>TxHash</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSettlements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No settlements found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSettlements.map((settlement) => (
                        <TableRow key={settlement.id}>
                          <TableCell>
                            <code className="text-xs">{settlement.period}</code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{settlement.agentId}</code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{formatAddress(settlement.wallet)}</code>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(settlement.totalCommissionUSD)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{formatCurrency(settlement.usdtPayoutAmount)}</div>
                          </TableCell>
                          <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                          <TableCell>
                            {settlement.verifiedBy ? (
                              <div className="text-sm">
                                <div>{settlement.verifiedBy}</div>
                                {settlement.verifiedAt && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(settlement.verifiedAt)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {settlement.txHash ? (
                              <code className="text-xs">{formatAddress(settlement.txHash)}</code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {settlement.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleVerify(settlement.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Verify
                                </Button>
                              )}
                              {settlement.status === "verified" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSettlement(settlement);
                                    setIsPayDialogOpen(true);
                                  }}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Mark Paid
                                </Button>
                              )}
                            </div>
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

        {/* Mark Paid Dialog */}
        <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Settlement as Paid</DialogTitle>
              <DialogDescription>
                Enter the USDT transaction hash to mark this settlement as paid.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedSettlement && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium">Period: {selectedSettlement.period}</div>
                    <div className="text-muted-foreground">
                      Amount: {formatCurrency(selectedSettlement.usdtPayoutAmount)}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="txHash">Transaction Hash *</Label>
                <Input
                  id="txHash"
                  value={payData.txHash}
                  onChange={(e) => setPayData({ ...payData, txHash: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={payData.notes}
                  onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMarkPaid}>Mark as Paid</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

