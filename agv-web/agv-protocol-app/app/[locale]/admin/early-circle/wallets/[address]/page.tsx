"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Copy, CheckCircle, XCircle, Clock, AlertTriangle, Shield } from "lucide-react";
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

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
};

interface WalletDetail {
  address: string;
  isEarlyCircle: boolean;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  flaggedAt: string | null;
  flaggedBy: string | null;
  addedAt: string | null;
  addedBy: string | null;
  firstConnectTime: string | null;
}

interface Summary {
  claimStatus: string;
  claimTime: string | null;
  claimFailureReason: string | null;
  firstBuyTime: string | null;
  firstBuyAmount: number | null;
  totalBuyVolume: number;
  buyCount: number;
  validReferralCount: number;
  referrerWallet: string | null;
}

interface ClaimAttempt {
  eventType: string;
  timestamp: string | null;
  txHash: string | null;
  claimedAmount: string | null;
  reasonCode: string | null;
  rawError: string | null;
}

interface BuyTransaction {
  eventType: string;
  timestamp: string | null;
  txHash: string | null;
  assetPair: string | null;
  amountNormalised: number | null;
  intendedAmount: number | null;
  isFirstBuy: boolean;
  reasonCode: string | null;
  rawError: string | null;
}

interface ReferralInfo {
  referrer: string | null;
  referred: Array<{
    referredWallet: string | null;
    validatedAt: string | null;
    hasClaimed: boolean;
    hasFirstBuy: boolean;
    isValid: boolean;
  }>;
}

export default function EarlyCircleWalletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [claimAttempts, setClaimAttempts] = useState<ClaimAttempt[]>([]);
  const [buyTransactions, setBuyTransactions] = useState<BuyTransaction[]>([]);
  const [referrals, setReferrals] = useState<ReferralInfo | null>(null);
  const [suspiciousDialogOpen, setSuspiciousDialogOpen] = useState(false);
  const [suspiciousReason, setSuspiciousReason] = useState("");
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
            await fetchWalletDetail();
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

  const fetchWalletDetail = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(`/api/admin/early-circle/wallets/${address}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWallet(data.wallet);
          setSummary(data.summary);
          setClaimAttempts(data.claimAttempts || []);
          setBuyTransactions(data.buyTransactions || []);
          setReferrals(data.referrals || { referrer: null, referred: [] });
        }
      } else {
        toast.error("Failed to fetch wallet details");
      }
    } catch (error) {
      console.error("Error fetching wallet details:", error);
      toast.error("Failed to fetch wallet details");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied to clipboard");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("success")) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (eventType.includes("failed")) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner size="lg" text="Loading wallet details..." />
      </DashboardLayout>
    );
  }

  if (!who.isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6">Unauthorized. Admin access required.</div>
      </DashboardLayout>
    );
  }

  if (!wallet) {
    return (
      <DashboardLayout>
        <div className="p-6">Wallet not found or not in Early Circle.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Early Circle Wallet Details</h1>
              <p className="text-muted-foreground">Detailed view of wallet activity</p>
            </div>
          </div>
        </div>

        {/* Wallet Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Address</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm">{address.slice(0, 10)}...{address.slice(-8)}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyAddress(address)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div>
                  {wallet.isSuspicious ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Suspicious
                    </Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Added At</div>
                <div className="text-sm">{formatDate(wallet.addedAt)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">First Connected</div>
                <div className="text-sm">{formatDate(wallet.firstConnectTime)}</div>
              </div>
            </div>
            {wallet.isSuspicious && wallet.suspiciousReason && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <div className="text-sm font-semibold text-destructive">Suspicious Reason:</div>
                <div className="text-sm">{wallet.suspiciousReason}</div>
                {wallet.flaggedBy && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Flagged by {wallet.flaggedBy} on {formatDate(wallet.flaggedAt)}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              <Button
                variant={wallet.isSuspicious ? "outline" : "destructive"}
                onClick={() => {
                  setSuspiciousReason(wallet.suspiciousReason || "");
                  setSuspiciousDialogOpen(true);
                }}
              >
                {wallet.isSuspicious ? (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Unmark as Suspicious
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Mark as Suspicious
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Claim Status</div>
                  <div>
                    <Badge variant={summary.claimStatus === "success" ? "default" : summary.claimStatus === "failed" ? "destructive" : "secondary"}>
                      {summary.claimStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">First Buy</div>
                  <div className="text-sm">
                    {summary.firstBuyTime ? formatDate(summary.firstBuyTime) : "None"}
                  </div>
                  {summary.firstBuyAmount && (
                    <div className="text-xs text-muted-foreground">${summary.firstBuyAmount.toFixed(2)}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Volume</div>
                  <div className="text-sm font-semibold">${summary.totalBuyVolume.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{summary.buyCount} transaction(s)</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Valid Referrals</div>
                  <div className="text-sm font-semibold">{summary.validReferralCount}</div>
                </div>
              </div>
              {summary.claimFailureReason && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <div className="text-sm font-semibold text-destructive">Claim Failure Reason:</div>
                  <div className="text-sm">{summary.claimFailureReason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Referral Info */}
        {referrals && (
          <Card>
            <CardHeader>
              <CardTitle>Referral Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {referrals.referrer && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Referred By:</div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm">{referrals.referrer.slice(0, 10)}...{referrals.referrer.slice(-8)}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyAddress(referrals.referrer!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {referrals.referred.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Referred Wallets:</div>
                    <div className="space-y-2">
                      {referrals.referred.map((ref, idx) => (
                        <div key={idx} className="p-2 border rounded-md">
                          <div className="flex items-center justify-between">
                            <code className="text-sm">{ref.referredWallet?.slice(0, 10)}...{ref.referredWallet?.slice(-8)}</code>
                            <Badge variant={ref.isValid ? "default" : "secondary"}>
                              {ref.isValid ? "Valid" : "Invalid"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Validated: {formatDate(ref.validatedAt)} | Claimed: {ref.hasClaimed ? "Yes" : "No"} | Bought: {ref.hasFirstBuy ? "Yes" : "No"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!referrals.referrer && referrals.referred.length === 0 && (
                  <div className="text-sm text-muted-foreground">No referral information</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claim Attempts */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Attempts</CardTitle>
            <CardDescription>All claim attempts and outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            {claimAttempts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claimAttempts.map((attempt, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEventIcon(attempt.eventType)}
                          <span className="text-sm">{attempt.eventType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(attempt.timestamp)}</TableCell>
                      <TableCell>
                        {attempt.txHash ? (
                          <code className="text-xs">{attempt.txHash.slice(0, 10)}...</code>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{attempt.claimedAmount || "N/A"}</TableCell>
                      <TableCell>
                        {attempt.reasonCode && (
                          <div>
                            <Badge variant="destructive" className="text-xs">{attempt.reasonCode}</Badge>
                            {attempt.rawError && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                                {attempt.rawError}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">No claim attempts recorded</div>
            )}
          </CardContent>
        </Card>

        {/* Buy Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Buy Transactions (Early Circle Window)</CardTitle>
            <CardDescription>All buy transactions within Early Circle time window</CardDescription>
          </CardHeader>
          <CardContent>
            {buyTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>TX Hash</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>First Buy</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyTransactions.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEventIcon(tx.eventType)}
                          <span className="text-sm">{tx.eventType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(tx.timestamp)}</TableCell>
                      <TableCell>
                        {tx.txHash ? (
                          <code className="text-xs">{tx.txHash.slice(0, 10)}...</code>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tx.amountNormalised ? `$${tx.amountNormalised.toFixed(2)}` : tx.intendedAmount ? `$${tx.intendedAmount.toFixed(2)} (intended)` : "N/A"}
                      </TableCell>
                      <TableCell>
                        {tx.isFirstBuy && <Badge variant="default">First</Badge>}
                      </TableCell>
                      <TableCell>
                        {tx.reasonCode && (
                          <div>
                            <Badge variant="destructive" className="text-xs">{tx.reasonCode}</Badge>
                            {tx.rawError && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                                {tx.rawError}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">No buy transactions recorded</div>
            )}
          </CardContent>
        </Card>

        {/* Suspicious Wallet Dialog */}
        <Dialog open={suspiciousDialogOpen} onOpenChange={setSuspiciousDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {wallet?.isSuspicious ? "Unmark Wallet as Suspicious" : "Mark Wallet as Suspicious"}
              </DialogTitle>
              <DialogDescription>
                {wallet?.address && (
                  <div className="font-mono text-sm mt-2">{wallet.address}</div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!wallet?.isSuspicious && (
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
                    setSuspiciousReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!wallet) return;
                    setUpdatingSuspicious(true);
                    try {
                      const idToken = await auth.currentUser?.getIdToken(true);
                      if (!idToken) return;

                      const response = await fetch(
                        `/api/admin/early-circle/wallets/${wallet.address}/suspicious`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${idToken}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            isSuspicious: !wallet.isSuspicious,
                            reason: suspiciousReason || null,
                          }),
                        }
                      );

                      if (response.ok) {
                        toast.success(
                          `Wallet ${!wallet.isSuspicious ? "marked as" : "unmarked from"} suspicious`
                        );
                        setSuspiciousDialogOpen(false);
                        setSuspiciousReason("");
                        await fetchWalletDetail(); // Refresh data
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
                  {updatingSuspicious ? "Updating..." : wallet?.isSuspicious ? "Unmark" : "Mark as Suspicious"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
