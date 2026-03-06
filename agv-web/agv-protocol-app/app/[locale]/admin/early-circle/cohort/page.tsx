"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield } from "lucide-react";
import Link from "next/link";

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
};

interface CohortEntry {
  wallet_address: string;
  claim_status: string;
  first_buy_status: string;
  total_buy_volume_ec: number;
  valid_referral_count_ec: number;
  full_cycle_completed: boolean;
  volume_tier: string;
  overall_status: string;
  is_suspicious: boolean;
}

export default function EarlyCircleCohortPage() {
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<CohortEntry[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [volumeTierFilter, setVolumeTierFilter] = useState("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [suspiciousDialogOpen, setSuspiciousDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [suspiciousReason, setSuspiciousReason] = useState("");
  const [isSuspicious, setIsSuspicious] = useState(false);
  const [updatingSuspicious, setUpdatingSuspicious] = useState(false);

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
            await fetchCohort();
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

  useEffect(() => {
    if (who.isAdmin && !loading) {
      fetchCohort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, volumeTierFilter]);

  const fetchCohort = async () => {
    setTableLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        status: statusFilter,
        volumeTier: volumeTierFilter,
      });

      const response = await fetch(`/api/admin/early-circle/cohort?${params}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCohort(data.cohort || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching cohort:", error);
      toast.error("Failed to fetch cohort data");
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>;
      case "none":
      case "not_started":
        return <Badge variant="outline">Not Started</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <DashboardLayout
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL,
        }}
        onSignOut={async () => await auth.signOut()}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading..." />
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
          avatar: auth.currentUser?.photoURL,
        }}
        onSignOut={async () => await auth.signOut()}
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
        avatar: auth.currentUser?.photoURL,
      }}
      onSignOut={async () => await auth.signOut()}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Early Circle Cohort View</h1>
          <p className="text-muted-foreground">
            Detailed view of Early Circle wallets and their progress
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Volume Tier</label>
                <Select value={volumeTierFilter} onValueChange={(value) => {
                  setVolumeTierFilter(value);
                  setPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="NONE">NONE</SelectItem>
                    <SelectItem value="TIER_150">TIER_150</SelectItem>
                    <SelectItem value="TIER_300">TIER_300</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={fetchCohort} variant="outline">
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cohort Table */}
        <Card>
          <CardHeader>
            <CardTitle>Cohort Data</CardTitle>
            <CardDescription>
              Showing {cohort.length} of {pagination.total} wallets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tableLoading ? (
              <LoadingSpinner size="sm" text="Loading cohort..." />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet Address</TableHead>
                        <TableHead>Claim Status</TableHead>
                        <TableHead>First Buy Status</TableHead>
                        <TableHead>Total Buy Volume</TableHead>
                        <TableHead>Valid Referrals</TableHead>
                        <TableHead>Volume Tier</TableHead>
                        <TableHead>Full Cycle</TableHead>
                        <TableHead>Overall Status</TableHead>
                        <TableHead>Suspicious</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cohort.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            No wallets found
                          </TableCell>
                        </TableRow>
                      ) : (
                        cohort.map((entry) => (
                          <TableRow key={entry.wallet_address}>
                            <TableCell className="font-mono text-sm">
                              <Link 
                                href={`/admin/early-circle/wallets/${entry.wallet_address}`}
                                className="hover:underline"
                              >
                                {formatAddress(entry.wallet_address)}
                              </Link>
                            </TableCell>
                            <TableCell>{getStatusBadge(entry.claim_status)}</TableCell>
                            <TableCell>{getStatusBadge(entry.first_buy_status)}</TableCell>
                            <TableCell>${entry.total_buy_volume_ec.toFixed(2)}</TableCell>
                            <TableCell>{entry.valid_referral_count_ec}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.volume_tier}</Badge>
                            </TableCell>
                            <TableCell>
                              {entry.full_cycle_completed ? (
                                <Badge className="bg-green-500">Yes</Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(entry.overall_status)}</TableCell>
                            <TableCell>
                              {entry.is_suspicious ? (
                                <Badge className="bg-red-500">Yes</Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWallet(entry.wallet_address);
                                  setIsSuspicious(!entry.is_suspicious);
                                  setSuspiciousReason("");
                                  setSuspiciousDialogOpen(true);
                                }}
                              >
                                {entry.is_suspicious ? (
                                  <>
                                    <Shield className="h-3 w-3 mr-1" />
                                    Unmark
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Mark
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Suspicious Wallet Dialog */}
        <Dialog open={suspiciousDialogOpen} onOpenChange={setSuspiciousDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isSuspicious ? "Mark Wallet as Suspicious" : "Unmark Wallet as Suspicious"}
              </DialogTitle>
              <DialogDescription>
                {selectedWallet && (
                  <div className="font-mono text-sm mt-2">{formatAddress(selectedWallet)}</div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {isSuspicious && (
                <div>
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    value={suspiciousReason}
                    onChange={(e) => setSuspiciousReason(e.target.value)}
                    placeholder="Enter reason for marking as suspicious"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuspiciousDialogOpen(false);
                    setSelectedWallet(null);
                    setSuspiciousReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedWallet) return;
                    setUpdatingSuspicious(true);
                    try {
                      const idToken = await auth.currentUser?.getIdToken(true);
                      if (!idToken) return;

                      const response = await fetch(
                        `/api/admin/early-circle/wallets/${selectedWallet}/suspicious`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${idToken}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            isSuspicious,
                            reason: suspiciousReason || null,
                          }),
                        }
                      );

                      if (response.ok) {
                        toast.success(
                          `Wallet ${isSuspicious ? "marked as" : "unmarked from"} suspicious`
                        );
                        setSuspiciousDialogOpen(false);
                        setSelectedWallet(null);
                        setSuspiciousReason("");
                        await fetchCohort(); // Refresh data
                      } else {
                        toast.error("Failed to update wallet status");
                      }
                    } catch (error) {
                      console.error("Error updating suspicious status:", error);
                      toast.error("Failed to update wallet status");
                    } finally {
                      setUpdatingSuspicious(false);
                    }
                  }}
                  disabled={updatingSuspicious}
                >
                  {updatingSuspicious ? "Updating..." : isSuspicious ? "Mark as Suspicious" : "Unmark"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

