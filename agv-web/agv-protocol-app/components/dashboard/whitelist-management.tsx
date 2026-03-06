import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Copy,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhitelistedWallet {
  id: string;
  address: string;
  addedAt: any;
  addedBy: string;
  status: string;
}

interface WhitelistManagementProps {
  wallets: WhitelistedWallet[];
  onAddWallet: (address: string) => Promise<void>;
  onRemoveWallet: (walletId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  className?: string;
}

export function WhitelistManagement({ 
  wallets, 
  onAddWallet, 
  onRemoveWallet, 
  onRefresh,
  className 
}: WhitelistManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredWallets = wallets.filter(wallet =>
    (wallet.address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (wallet.addedBy?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }

    // Basic address validation
    if (!newWalletAddress.startsWith("0x") || newWalletAddress.length !== 42) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }

    setIsAdding(true);
    try {
      await onAddWallet(newWalletAddress);
      setNewWalletAddress("");
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding wallet:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    if (confirm("Are you sure you want to remove this wallet from the whitelist?")) {
      try {
        await onRemoveWallet(walletId);
      } catch (error) {
        console.error("Error removing wallet:", error);
      }
    }
  };

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

  const copyAddress = (address: string | undefined) => {
    if (!address) {
      toast.error("No address to copy");
      return;
    }
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Headerr */}
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Wallet to Whitelist</DialogTitle>
                <DialogDescription>
                  Enter the wallet address to add to the whitelist.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="wallet-address">Wallet Address</Label>
                  <Input
                    id="wallet-address"
                    placeholder="0x..."
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddWallet}
                    disabled={isAdding || !newWalletAddress.trim()}
                  >
                    {isAdding ? "Adding..." : "Add Wallet"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search wallets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {wallets.filter(w => w.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredWallets.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Wallets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Whitelisted Wallets</CardTitle>
          <CardDescription>
            {filteredWallets.length} of {wallets.length} wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((wallet) => (
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
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(wallet.status)}
                        <Badge variant="secondary" className={getStatusColor(wallet.status)}>
                          {wallet.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWallet(wallet.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
