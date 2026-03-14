"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  DollarSign, 
  Target, 
  Lock, 
  TrendingUp,
  UserCheck,
  UserCog
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentStats {
  totalAgents: number;
  masterAgents: number;
  subAgents: number;
  totalPreGVTAllocated: number;
  totalSGVTAllocated: number;
  totalSalesTarget: number;
  totalActualSales: number;
  pendingSettlements: number;
  totalSettlements: number;
}

interface AgentInfo {
  allocation: {
    id: string;
    wallet: string;
    agentLevel: 1 | 2;
    preGVTAllocated: number;
    sGVTAllocated: number;
    kolId?: string;
    masterWallet?: string;
  };
  kolProfile: {
    id: string;
    displayName?: string;
    refCode?: string;
    email?: string;
  } | null;
}

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStats>({
    totalAgents: 0,
    masterAgents: 0,
    subAgents: 0,
    totalPreGVTAllocated: 0,
    totalSGVTAllocated: 0,
    totalSalesTarget: 0,
    totalActualSales: 0,
    pendingSettlements: 0,
    totalSettlements: 0,
  });
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    wallet: "",
    email: "",
    agentLevel: "1" as "1" | "2",
    masterWallet: "",
  });
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    agentLevel: "1" as "1" | "2",
    masterWallet: "",
  });

  const fetchStats = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);

      // Fetch allocations
      const allocationsRes = await fetch("/api/admin/agents/allocations", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!allocationsRes.ok) {
        const errorText = await allocationsRes.text();
        throw new Error(`Allocations API error: ${allocationsRes.status} - ${errorText}`);
      }
      
      const allocationsData = await allocationsRes.json();

      // Fetch sales targets
      const targetsRes = await fetch("/api/admin/agents/sales-targets", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!targetsRes.ok) {
        const errorText = await targetsRes.text();
        throw new Error(`Sales targets API error: ${targetsRes.status} - ${errorText}`);
      }
      
      const targetsData = await targetsRes.json();

      // Fetch settlements
      const settlementsRes = await fetch("/api/admin/agents/settlements?status=pending", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!settlementsRes.ok) {
        const errorText = await settlementsRes.text();
        throw new Error(`Settlements API error: ${settlementsRes.status} - ${errorText}`);
      }
      
      const settlementsData = await settlementsRes.json();

      if (allocationsData.success) {
        const totals = allocationsData.totals || {};
        setStats({
          totalAgents: allocationsData.count || 0,
          masterAgents: totals.masterCount || 0,
          subAgents: totals.subAgentCount || 0,
          totalPreGVTAllocated: totals.totalPreGVT || 0,
          totalSGVTAllocated: totals.totalSGVT || 0,
          totalSalesTarget: targetsData.targets?.reduce((sum: number, t: any) => sum + (t.salesTarget || 0), 0) || 0,
          totalActualSales: targetsData.targets?.reduce((sum: number, t: any) => sum + (t.actualSales || 0), 0) || 0,
          pendingSettlements: settlementsData.count || 0,
          totalSettlements: 0, // Can be calculated if needed
        });
        setAgents(allocationsData.allocations || []);
      }
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load agent statistics", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

  const getReferralLink = (kolId: string) => {
    if (!kolId) return null;
    // Extract 6-digit refCode from KOL ID (e.g., "AGV-KOL149154" -> "149154")
    const match = kolId.match(/AGV-KOL(\d{6})/);
    if (match && match[1]) {
      return `https://buy.agvnexrur.ai/buy/${match[1]}`;
    }
    // Fallback: try to extract any 6-digit number
    const fallbackMatch = kolId.match(/(\d{6})/);
    if (fallbackMatch && fallbackMatch[1]) {
      return `https://buy.agvnexrur.ai/buy/${fallbackMatch[1]}`;
    }
    return null;
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const achievementRate = stats.totalSalesTarget > 0 
    ? (stats.totalActualSales / stats.totalSalesTarget) * 100 
    : 0;

  const handleAddAgent = async () => {
    if (!formData.name || !formData.wallet) {
      toast.error("Name and wallet are required");
      return;
    }

    if (formData.agentLevel === "2" && !formData.masterWallet) {
      toast.error("Master wallet is required for Sub-Agents");
      return;
    }

    try {
      setIsSubmitting(true);
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const agentData: any = {
        name: formData.name,
        wallet: formData.wallet,
        agentLevel: parseInt(formData.agentLevel),
      };

      if (formData.email) {
        agentData.email = formData.email;
      }

      if (formData.agentLevel === "2") {
        agentData.masterWallet = formData.masterWallet;
      }

      const res = await fetch("/api/admin/agents/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent: agentData }),
      });

      const result = await res.json();

      if (result.success && result.results && result.results.length > 0) {
        const agentResult = result.results[0];
        if (agentResult.error) {
          throw new Error(agentResult.error);
        }
        toast.success(
          agentResult.created 
            ? `Agent added successfully! KOL ID: ${agentResult.kolId}` 
            : `Agent updated successfully! KOL ID: ${agentResult.kolId}`
        );
        setIsAddDialogOpen(false);
        setFormData({
          name: "",
          wallet: "",
          email: "",
          agentLevel: "1",
          masterWallet: "",
        });
        // Refresh stats and agents list
        fetchStats();
      } else {
        throw new Error(result.error || "Failed to add agent");
      }
    } catch (error: any) {
      console.error("Error adding agent:", error);
      toast.error("Failed to add agent", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (agent: AgentInfo) => {
    setEditingAgent(agent);
    setEditFormData({
      name: agent.kolProfile?.displayName || "",
      email: agent.kolProfile?.email || "",
      agentLevel: agent.allocation.agentLevel.toString() as "1" | "2",
      masterWallet: agent.allocation.masterWallet || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent) return;

    if (!editFormData.name) {
      toast.error("Name is required");
      return;
    }

    if (editFormData.agentLevel === "2" && !editFormData.masterWallet) {
      toast.error("Master wallet is required for Sub-Agents");
      return;
    }

    try {
      setIsUpdating(true);
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        toast.error("Not authenticated");
        return;
      }

      const updates: any = {
        displayName: editFormData.name,
        email: editFormData.email || "",
      };

      // Only include agentLevel if it changed
      if (parseInt(editFormData.agentLevel) !== editingAgent.allocation.agentLevel) {
        updates.agentLevel = parseInt(editFormData.agentLevel);
      }

      // Only include masterWallet if it changed or if level is 2
      if (editFormData.agentLevel === "2") {
        if (editFormData.masterWallet !== editingAgent.allocation.masterWallet) {
          updates.masterWallet = editFormData.masterWallet;
        }
      }

      const res = await fetch("/api/admin/agents/update", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: editingAgent.allocation.wallet,
          updates,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Agent updated successfully");
        setIsEditDialogOpen(false);
        setEditingAgent(null);
        // Refresh stats and agents list
        fetchStats();
      } else {
        throw new Error(result.error || "Failed to update agent");
      }
    } catch (error: any) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent", { description: error.message });
    } finally {
      setIsUpdating(false);
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
            <h1 className="text-2xl sm:text-3xl font-bold">Agent Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Overview of Master & Sub-Agent system
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Agent</DialogTitle>
                <DialogDescription>
                  Add a new Master Agent or Sub-Agent. If the wallet already exists as a KOL, it will be converted to an agent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Agent Name"
                  />
                </div>
                <div>
                  <Label htmlFor="wallet">Wallet Address *</Label>
                  <Input
                    id="wallet"
                    value={formData.wallet}
                    onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                    placeholder="0x..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If this wallet exists as a KOL, it will be converted to an agent
                  </p>
                </div>
                <div>
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="agent@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="agentLevel">Agent Level *</Label>
                  <Select
                    value={formData.agentLevel}
                    onValueChange={(value: "1" | "2") => setFormData({ ...formData, agentLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level-1 (Master Agent)</SelectItem>
                      <SelectItem value="2">Level-2 (Sub-Agent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.agentLevel === "2" && (
                  <div>
                    <Label htmlFor="masterWallet">Master Agent Wallet *</Label>
                    <Input
                      id="masterWallet"
                      value={formData.masterWallet}
                      onChange={(e) => setFormData({ ...formData, masterWallet: e.target.value })}
                      placeholder="0x... (Master Agent wallet)"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wallet address of the Master Agent (Level-1)
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAgent} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Agent"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Agent Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Agent</DialogTitle>
                <DialogDescription>
                  Update agent information. Changes will be reflected in the KOL profile and allocation.
                </DialogDescription>
              </DialogHeader>
              {editingAgent && (
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="edit-wallet">Wallet Address</Label>
                    <Input
                      id="edit-wallet"
                      value={editingAgent.allocation.wallet}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wallet address cannot be changed
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-name">Name *</Label>
                    <Input
                      id="edit-name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="Agent Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="agent@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-agentLevel">Agent Level *</Label>
                    <Select
                      value={editFormData.agentLevel}
                      onValueChange={(value: "1" | "2") => setEditFormData({ ...editFormData, agentLevel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level-1 (Master Agent)</SelectItem>
                        <SelectItem value="2">Level-2 (Sub-Agent)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editFormData.agentLevel === "2" && (
                    <div>
                      <Label htmlFor="edit-masterWallet">Master Agent Wallet *</Label>
                      <Input
                        id="edit-masterWallet"
                        value={editFormData.masterWallet}
                        onChange={(e) => setEditFormData({ ...editFormData, masterWallet: e.target.value })}
                        placeholder="0x... (Master Agent wallet)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Wallet address of the Master Agent (Level-1)
                      </p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateAgent} disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update Agent"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAgents}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.masterAgents} Masters, {stats.subAgents} Sub-Agents
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">preGVT Allocated</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(stats.totalPreGVTAllocated)}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(stats.totalSGVTAllocated)} sGVT allocated
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sales Performance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalActualSales)}</div>
                  <p className="text-xs text-muted-foreground">
                    {achievementRate.toFixed(1)}% of {formatCurrency(stats.totalSalesTarget)} target
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingSettlements}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting verification
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin/agents/allocations">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCheck className="h-5 w-5" />
                      Allocations
                    </CardTitle>
                    <CardDescription>
                      View and manage agent token allocations
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/agents/sales-targets">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Sales Targets
                    </CardTitle>
                    <CardDescription>
                      Set and track sales targets for agents
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/agents/lockups">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Lockups
                    </CardTitle>
                    <CardDescription>
                      Monitor preGVT lockup and release status
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/agents/settlements">
                <Card className="hover:bg-accent cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Settlements
                    </CardTitle>
                    <CardDescription>
                      Manage weekly USDT payouts
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>

            {/* Agents List */}
            <Card>
              <CardHeader>
                <CardTitle>All Agents</CardTitle>
                <CardDescription>
                  Complete list of all Master Agents and Sub-Agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>KOL ID</TableHead>
                        <TableHead>Referral Links</TableHead>
                        <TableHead>preGVT</TableHead>
                        <TableHead>sGVT</TableHead>
                        <TableHead>Master</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No agents found
                          </TableCell>
                        </TableRow>
                      ) : (
                        agents.map((item) => (
                          <TableRow key={item.allocation.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {item.kolProfile?.displayName || "N/A"}
                                </div>
                                {item.kolProfile?.email && (
                                  <div className="text-sm text-muted-foreground">
                                    {item.kolProfile.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.allocation.agentLevel === 1 ? "default" : "secondary"}>
                                {item.allocation.agentLevel === 1 ? (
                                  <>
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Level-1
                                  </>
                                ) : (
                                  <>
                                    <UserCog className="h-3 w-3 mr-1" />
                                    Level-2
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="text-xs">
                                  {item.allocation.wallet.slice(0, 6)}...{item.allocation.wallet.slice(-4)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.allocation.wallet);
                                    toast.success("Copied to clipboard");
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.kolProfile?.id ? (
                                <code className="text-xs">{item.kolProfile.id}</code>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const kolId = item.kolProfile?.id || item.allocation.kolId;
                                if (!kolId) return <span className="text-muted-foreground">—</span>;
                                
                                const referralLink = getReferralLink(kolId);
                                if (!referralLink) return <span className="text-muted-foreground">—</span>;
                                
                                return (
                                  <div className="flex items-center gap-1 min-w-[200px]">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-1 truncate">
                                      {referralLink}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyToClipboard(referralLink, "Referral link")}
                                      title="Copy referral link"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{formatNumber(item.allocation.preGVTAllocated)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{formatNumber(item.allocation.sGVTAllocated)}</div>
                            </TableCell>
                            <TableCell>
                              {item.allocation.agentLevel === 2 && item.allocation.masterWallet ? (
                                <code className="text-xs">
                                  {item.allocation.masterWallet.slice(0, 6)}...{item.allocation.masterWallet.slice(-4)}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(item)}
                                title="Edit agent"
                              >
                                <Pencil className="h-4 w-4" />
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

            {/* Commission Rates Info */}
            <Card>
              <CardHeader>
                <CardTitle>Commission Structure</CardTitle>
                <CardDescription>Current commission rates for purchase referrals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Master Agents (Level-1)</p>
                      <p className="text-sm text-muted-foreground">Direct purchase referrals</p>
                    </div>
                    <Badge variant="default" className="text-lg px-3 py-1">12%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Sub-Agents (Level-2)</p>
                      <p className="text-sm text-muted-foreground">Direct purchase referrals</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">5%</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Note: Agent commission rates apply to purchase referrals only. Mint referrals use tier-based rates.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

