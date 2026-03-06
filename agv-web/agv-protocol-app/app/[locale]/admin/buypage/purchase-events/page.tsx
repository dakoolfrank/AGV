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
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Search, X } from "lucide-react";

interface PurchaseEvent {
  id: string;
  kolId: string;
  kolName?: string;
  kolRefCode?: string;
  wallet: string;
  txHash: string;
  purchaseAmount: number;
  commission: number;
  commissionRate: number;
  tier: string;
  timestamp: any;
  campaign: string;
}

export default function PurchaseEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PurchaseEvent[]>([]);

  // Filters
  const [kolIdFilter, setKolIdFilter] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [txHashFilter, setTxHashFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  // Fetch purchase events
  const fetchEvents = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const params = new URLSearchParams();
      if (kolIdFilter) params.append("kolId", kolIdFilter);
      if (walletFilter) params.append("wallet", walletFilter);
      if (txHashFilter) params.append("txHash", txHashFilter);
      if (tierFilter) params.append("tier", tierFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/buypage/purchase-events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch purchase events");
      }

      const result = await res.json();
      if (result.success) {
        setEvents(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching purchase events:", error);
      toast.error("Failed to load purchase events", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
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

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  const clearFilters = () => {
    setKolIdFilter("");
    setWalletFilter("");
    setTxHashFilter("");
    setTierFilter("");
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
          <h1 className="text-2xl sm:text-3xl font-bold">Purchase Events</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Detailed view of all purchase events with commission tracking
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">KOL ID</label>
                <Input
                  placeholder="Filter by KOL ID"
                  value={kolIdFilter}
                  onChange={(e) => setKolIdFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Wallet</label>
                <Input
                  placeholder="Filter by wallet"
                  value={walletFilter}
                  onChange={(e) => setWalletFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Transaction Hash</label>
                <Input
                  placeholder="Filter by tx hash"
                  value={txHashFilter}
                  onChange={(e) => setTxHashFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tier</label>
                <Input
                  placeholder="Filter by tier"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchEvents}>
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

        {/* Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Events ({events.length})</CardTitle>
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
                      <TableHead>KOL ID</TableHead>
                      <TableHead>KOL Name</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Purchase Amount</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          No purchase events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-mono text-sm">{event.kolId || "N/A"}</TableCell>
                          <TableCell>{event.kolName || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{formatAddress(event.wallet || "")}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(event.wallet || "")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a
                                href={`https://bscscan.com/address/${event.wallet}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(Number(event.purchaseAmount) || 0)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(event.commission) || 0)}
                          </TableCell>
                          <TableCell>{formatPercent(Number(event.commissionRate) || 0)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{event.tier || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            {event.txHash ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{formatAddress(event.txHash)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(event.txHash)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <a
                                  href={`https://bscscan.com/tx/${event.txHash}`}
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
                          <TableCell>{event.campaign || "N/A"}</TableCell>
                          <TableCell className="text-xs">{formatDate(event.timestamp)}</TableCell>
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

