import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wallet, 
  Copy,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  RotateCw,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WalletData {
  id: string;
  address: string;
  metadata: {
    tier: string;
    total_tx: number;
    avg_age: number;
    total_balance: number;
    chains_used: number;
  };
  status: {
    isWhitelisted: boolean;
    isActivated: boolean;
    hasClaimed: boolean;
    isAirdropped: boolean;
    hasBought: boolean;
    hasStaked: boolean;
  };
  timestamps: {
    firstConnected: string | null;
    activatedAt: string | null;
    claimedAt: string | null;
    firstBuyAt: string | null;
    firstStakeAt: string | null;
  };
}

interface WalletManagementProps {
  wallets: WalletData[];
  stats: {
    total: number;
    whitelistedActivated: number;
    whitelistedNotActivated: number;
    activatedNotWhitelisted: number;
    totalActivated: number;
    totalClaimed: number;
    totalBought: number;
    totalStaked: number;
    byTier: {
      'Tier 1': number;
      'Tier 2': number;
      'Tier 3': number;
    };
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchTerm: string;
  statusFilter: string;
  tierFilter: string;
  isLoading?: boolean;
  onRefresh: () => Promise<void>;
  onSync: (address: string) => Promise<void>;
  onViewDetails: (address: string) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onTierFilterChange: (tier: string) => void;
  onPageChange: (page: number) => void;
  className?: string;
}

export function WalletManagement({ 
  wallets, 
  stats,
  pagination,
  searchTerm,
  statusFilter,
  tierFilter,
  isLoading = false,
  onRefresh, 
  onSync,
  onViewDetails,
  onSearchChange,
  onStatusFilterChange,
  onTierFilterChange,
  onPageChange,
  className 
}: WalletManagementProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingAddress, setSyncingAddress] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Error refreshing wallets:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSync = async (address: string) => {
    setSyncingAddress(address);
    try {
      await onSync(address);
      toast.success("Wallet synced successfully");
      await onRefresh();
    } catch (error) {
      console.error("Error syncing wallet:", error);
      toast.error("Failed to sync wallet");
    } finally {
      setSyncingAddress(null);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const exportToCSV = () => {
    const headers = ['Address', 'Tier', 'Whitelisted', 'Activated', 'Claimed', 'Bought', 'Staked', 'First Connected', 'Activated At'];
    const rows = wallets.map(w => [
      w.address,
      w.metadata.tier,
      w.status.isWhitelisted ? 'Yes' : 'No',
      w.status.isActivated ? 'Yes' : 'No',
      w.status.hasClaimed ? 'Yes' : 'No',
      w.status.hasBought ? 'Yes' : 'No',
      w.status.hasStaked ? 'Yes' : 'No',
      w.timestamps.firstConnected || '',
      w.timestamps.activatedAt || '',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Wallets exported to CSV");
  };

  const getStatusBadges = (wallet: WalletData) => {
    return (
      <div className="flex gap-1 flex-wrap">
        {wallet.status.isWhitelisted && (
          <Badge variant="default" className="bg-blue-100 text-blue-800">Whitelisted</Badge>
        )}
        {wallet.status.isActivated && (
          <Badge variant="default" className="bg-green-100 text-green-800">Activated</Badge>
        )}
        {wallet.status.hasClaimed && (
          <Badge variant="default" className="bg-purple-100 text-purple-800">Claimed</Badge>
        )}
        {wallet.status.hasBought && (
          <Badge variant="default" className="bg-orange-100 text-orange-800">Bought</Badge>
        )}
        {wallet.status.hasStaked && (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">Staked</Badge>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Whitelisted + Activated</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.whitelistedActivated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Whitelisted + Not Activated</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.whitelistedNotActivated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activated + Not Whitelisted</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activatedNotWhitelisted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search wallets..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="whitelisted_activated">Whitelisted + Activated</SelectItem>
            <SelectItem value="whitelisted_not_activated">Whitelisted + Not Activated</SelectItem>
            <SelectItem value="activated_not_whitelisted">Activated + Not Whitelisted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={onTierFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="Tier 1">Tier 1</SelectItem>
            <SelectItem value="Tier 2">Tier 2</SelectItem>
            <SelectItem value="Tier 3">Tier 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Wallets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Wallets</CardTitle>
          <CardDescription>
            Showing {wallets.length} of {pagination.total} wallets (Page {pagination.page} of {pagination.totalPages})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Connected</TableHead>
                  <TableHead>Activated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No wallets found
                    </TableCell>
                  </TableRow>
                ) : (
                  wallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                          {wallet.address}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyAddress(wallet.address)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wallet.metadata.tier}</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadges(wallet)}
                    </TableCell>
                    <TableCell>
                      {wallet.timestamps.firstConnected 
                        ? new Date(wallet.timestamps.firstConnected).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {wallet.timestamps.activatedAt 
                        ? new Date(wallet.timestamps.activatedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(wallet.address)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(wallet.address)}
                          disabled={syncingAddress === wallet.address}
                        >
                          <RotateCw className={cn("h-3 w-3", syncingAddress === wallet.address && "animate-spin")} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => onPageChange(pageNum)}
                        className="min-w-[40px]"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

