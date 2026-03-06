"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Users, 
  DollarSign, 
  TrendingUp,
  ExternalLink,
  Copy
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface OverviewData {
  stats: {
    totalPurchases: number;
    totalPurchaseVolume: number;
    activeUsers: number;
    totalUsers: number;
  };
  kolReferralAnalytics: Array<{
    kolId: string;
    kolName: string;
    kolWallet: string;
    referralCount: number;
    totalVolume: number;
    totalCommission: number;
  }>;
  recentPurchases: Array<any>;
}

export default function BuypageOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);

  // Fetch overview data
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;

      try {
        setLoading(true);
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/buypage/overview", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch overview data");
        }

        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch data");
        }
      } catch (error: any) {
        console.error("Error fetching overview:", error);
        toast.error("Failed to load overview data", { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
          <h1 className="text-2xl sm:text-3xl font-bold">Buypage Overview</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Monitor and manage all buypage activities
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : data ? (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.stats.totalPurchases.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(data.stats.totalPurchaseVolume)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.stats.activeUsers.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {data.stats.totalUsers.toLocaleString()} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.stats.totalUsers.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>

            {/* KOL Referral Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>KOL Referral Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>KOL ID</TableHead>
                        <TableHead>KOL Name</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Total Volume</TableHead>
                        <TableHead>Total Commission</TableHead>
                        <TableHead>Wallet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.kolReferralAnalytics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No referral data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.kolReferralAnalytics.map((kol, index) => (
                          <TableRow key={kol.kolId}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{kol.kolId}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(kol.kolId)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{kol.kolName || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{kol.referralCount}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(kol.totalVolume)}</TableCell>
                            <TableCell>{formatCurrency(kol.totalCommission)}</TableCell>
                            <TableCell>
                              {kol.kolWallet ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{formatAddress(kol.kolWallet)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(kol.kolWallet)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <a
                                    href={`https://bscscan.com/address/${kol.kolWallet}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Purchases */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Buyer</TableHead>
                        <TableHead>KOL ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Transaction</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentPurchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No recent purchases
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.recentPurchases.map((purchase: any) => (
                          <TableRow key={purchase.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{formatAddress(purchase.buyerAddress || "")}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(purchase.buyerAddress || "")}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{purchase.kolId || "N/A"}</TableCell>
                            <TableCell>{formatCurrency(Number(purchase.purchaseAmount) || 0)}</TableCell>
                            <TableCell>{(Number(purchase.tokenAmount) || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              {purchase.txHash ? (
                                <a
                                  href={`https://bscscan.com/tx/${purchase.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <span className="font-mono text-xs">{formatAddress(purchase.txHash)}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            <TableCell>
                              {purchase.timestamp
                                ? new Date(purchase.timestamp).toLocaleString()
                                : purchase.createdAt
                                ? new Date(purchase.createdAt).toLocaleString()
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

