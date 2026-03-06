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

interface User {
  id: string;
  address: string;
  totalEarned: number;
  redeemedAmount: number;
  accruedAmount: number;
  isActivated: boolean;
  activationTime: string | null;
  referrerOf?: string;
  purchaseCount: number;
  createdAt: number;
  updatedAt: number;
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  // Filters
  const [addressFilter, setAddressFilter] = useState("");
  const [isActivatedFilter, setIsActivatedFilter] = useState<string>("");

  // Fetch users
  const fetchUsers = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const params = new URLSearchParams();
      if (addressFilter) params.append("address", addressFilter);
      if (isActivatedFilter !== "") params.append("isActivated", isActivatedFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/buypage/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }

      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
    setAddressFilter("");
    setIsActivatedFilter("");
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
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            View and manage all buypage users
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
                <label className="text-sm font-medium mb-2 block">Wallet Address</label>
                <Input
                  placeholder="Filter by wallet address"
                  value={addressFilter}
                  onChange={(e) => setAddressFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Activation Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={isActivatedFilter}
                  onChange={(e) => setIsActivatedFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="true">Activated</option>
                  <option value="false">Not Activated</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchUsers}>
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

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
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
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Earned</TableHead>
                      <TableHead>Redeemed</TableHead>
                      <TableHead>Accrued</TableHead>
                      <TableHead>Purchases</TableHead>
                      <TableHead>Referrer KOL</TableHead>
                      <TableHead>Activated</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{formatAddress(user.address || "")}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(user.address || "")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a
                                href={`https://bscscan.com/address/${user.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.isActivated ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(user.totalEarned) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(user.redeemedAmount) || 0)}</TableCell>
                          <TableCell>{formatCurrency(Number(user.accruedAmount) || 0)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.purchaseCount || 0}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {user.referrerOf || "N/A"}
                          </TableCell>
                          <TableCell>
                            {user.activationTime
                              ? new Date(user.activationTime).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
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

