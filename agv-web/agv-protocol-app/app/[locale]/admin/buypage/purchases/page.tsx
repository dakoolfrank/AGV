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

interface Purchase {
  id: string;
  buyerAddress: string;
  kolId: string;
  purchaseAmount: number;
  tokenAmount: number;
  txHash: string;
  timestamp: number;
  createdAt?: number;
}

export default function PurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  // Filters
  const [kolIdFilter, setKolIdFilter] = useState("");
  const [buyerAddressFilter, setBuyerAddressFilter] = useState("");
  const [txHashFilter, setTxHashFilter] = useState("");

  // Fetch purchases
  const fetchPurchases = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const params = new URLSearchParams();
      if (kolIdFilter) params.append("kolId", kolIdFilter);
      if (buyerAddressFilter) params.append("buyerAddress", buyerAddressFilter);
      if (txHashFilter) params.append("txHash", txHashFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/buypage/purchases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch purchases");
      }

      const result = await res.json();
      if (result.success) {
        setPurchases(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching purchases:", error);
      toast.error("Failed to load purchases", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
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

  const clearFilters = () => {
    setKolIdFilter("");
    setBuyerAddressFilter("");
    setTxHashFilter("");
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
          <h1 className="text-2xl sm:text-3xl font-bold">Purchase Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            View and filter all purchases from the buypage
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">KOL ID</label>
                <Input
                  placeholder="Filter by KOL ID"
                  value={kolIdFilter}
                  onChange={(e) => setKolIdFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Buyer Address</label>
                <Input
                  placeholder="Filter by buyer address"
                  value={buyerAddressFilter}
                  onChange={(e) => setBuyerAddressFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Transaction Hash</label>
                <Input
                  placeholder="Filter by transaction hash"
                  value={txHashFilter}
                  onChange={(e) => setTxHashFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchPurchases}>
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

        {/* Purchases Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchases ({purchases.length})</CardTitle>
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
                      <TableHead>Buyer Address</TableHead>
                      <TableHead>KOL ID</TableHead>
                      <TableHead>Purchase Amount</TableHead>
                      <TableHead>Token Amount</TableHead>
                      <TableHead>Transaction Hash</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No purchases found
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchases.map((purchase) => (
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
                              <a
                                href={`https://bscscan.com/address/${purchase.buyerAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{purchase.kolId || "N/A"}</TableCell>
                          <TableCell>{formatCurrency(Number(purchase.purchaseAmount) || 0)}</TableCell>
                          <TableCell>{(Number(purchase.tokenAmount) || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {purchase.txHash ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{formatAddress(purchase.txHash)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(purchase.txHash)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <a
                                  href={`https://bscscan.com/tx/${purchase.txHash}`}
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

