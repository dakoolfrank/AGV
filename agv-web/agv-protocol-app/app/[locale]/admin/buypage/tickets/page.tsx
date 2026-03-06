"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Copy, Search, X, CheckCircle2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Ticket {
  id: string;
  ticketId: string;
  walletAddress: string;
  oldBalance: number;
  status: string;
  createdAt: string;
  timestamp: string;
}

interface TicketsData {
  data: Ticket[];
  totalCount: number;
  statusCounts: Record<string, number>;
}

export default function TicketsPage() {
  const [loading, setLoading] = useState(true);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);
  const [ticketsData, setTicketsData] = useState<TicketsData | null>(null);

  // Filters
  const [walletAddressFilter, setWalletAddressFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch tickets
  const fetchTickets = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const params = new URLSearchParams();
      if (walletAddressFilter) params.append("walletAddress", walletAddressFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "100");

      const res = await fetch(`/api/admin/buypage/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch tickets");
      }

      const result = await res.json();
      if (result.success) {
        setTicketsData(result);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to load tickets", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
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

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(balance);
  };

  const closeTicket = async (ticketId: string) => {
    if (!auth.currentUser) return;

    try {
      setClosingTicketId(ticketId);
      const idToken = await auth.currentUser.getIdToken(true);

      const res = await fetch("/api/admin/buypage/tickets", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticketId }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to close ticket");
      }

      toast.success("Ticket closed successfully");
      // Refresh the tickets list
      await fetchTickets();
    } catch (error: any) {
      console.error("Error closing ticket:", error);
      toast.error("Failed to close ticket", { description: error.message });
    } finally {
      setClosingTicketId(null);
    }
  };

  const clearFilters = () => {
    setWalletAddressFilter("");
    setStatusFilter("all");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "closed":
        return "secondary";
      default:
        return "outline";
    }
  };

  const tickets = ticketsData?.data || [];
  const statusCounts = ticketsData?.statusCounts || {};

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
          <h1 className="text-2xl sm:text-3xl font-bold">Migration Tickets</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            View and manage all migration support tickets
          </p>
        </div>

        {/* Stats Overview */}
        {ticketsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ticketsData.totalCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusCounts.pending || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Closed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statusCounts.closed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Showing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tickets.length}</div>
              </CardContent>
            </Card>
          </div>
        )}

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
                  value={walletAddressFilter}
                  onChange={(e) => setWalletAddressFilter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchTickets}>
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

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets ({tickets.length})</CardTitle>
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
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Wallet Address</TableHead>
                      <TableHead>Old Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No tickets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{ticket.ticketId}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(ticket.ticketId)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{formatAddress(ticket.walletAddress)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(ticket.walletAddress)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a
                                href={`https://bscscan.com/address/${ticket.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatBalance(ticket.oldBalance)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(ticket.status)}>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {ticket.createdAt
                              ? new Date(ticket.createdAt).toLocaleString()
                              : ticket.timestamp
                              ? new Date(ticket.timestamp).toLocaleString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {ticket.status !== "closed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => closeTicket(ticket.id)}
                                disabled={closingTicketId === ticket.id}
                              >
                                {closingTicketId === ticket.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Closing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Close Ticket
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">Closed</span>
                            )}
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

