"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
};

interface WalletEntry {
  address: string;
  isEarlyCircle: boolean;
  isSuspicious: boolean;
  addedAt: string | null;
  addedBy: string | null;
}

export default function EarlyCircleWhitelistPage() {
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addressesText, setAddressesText] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
            await fetchWallets();
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

  const fetchWallets = async () => {
    setTableLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/wallets", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWallets(data.wallets || []);
        }
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
      toast.error("Failed to fetch wallets");
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      
      // Skip header if present
      const addresses = lines.filter(line => 
        line.startsWith('0x') && line.length === 42
      );

      if (addresses.length === 0) {
        toast.error("No valid wallet addresses found in file");
        setUploading(false);
        return;
      }

      await uploadAddresses(addresses);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
      setUploading(false);
    }
  };

  const handleTextUpload = async () => {
    if (!addressesText.trim()) {
      toast.error("Please enter wallet addresses");
      return;
    }

    const addresses = addressesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('0x') && line.length === 42);

    if (addresses.length === 0) {
      toast.error("No valid wallet addresses found");
      return;
    }

    await uploadAddresses(addresses);
  };

  const uploadAddresses = async (addresses: string[]) => {
    setUploading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/wallets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addresses }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(
            `Successfully processed ${data.results.added} wallets. ` +
            `${data.results.skipped} skipped.`
          );
          setAddressesText("");
          setFile(null);
          await fetchWallets();
        } else {
          toast.error(data.error || "Failed to upload wallets");
        }
      } else {
        toast.error("Failed to upload wallets");
      }
    } catch (error) {
      console.error("Error uploading wallets:", error);
      toast.error("Failed to upload wallets");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveWallet = async (address: string) => {
    if (!confirm(`Remove ${address} from Early Circle?`)) {
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch(
        `/api/admin/early-circle/wallets?address=${encodeURIComponent(address)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success("Wallet removed from Early Circle");
          await fetchWallets();
        } else {
          toast.error(data.error || "Failed to remove wallet");
        }
      } else {
        toast.error("Failed to remove wallet");
      }
    } catch (error) {
      console.error("Error removing wallet:", error);
      toast.error("Failed to remove wallet");
    }
  };

  const handleExport = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/wallets?format=csv", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "early-circle-wallets.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Export downloaded successfully");
      } else {
        toast.error("Failed to export wallets");
      }
    } catch (error) {
      console.error("Error exporting wallets:", error);
      toast.error("Failed to export wallets");
    }
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
          <h1 className="text-3xl font-bold">Early Circle Whitelist Management</h1>
          <p className="text-muted-foreground">
            Add or remove wallets from the Early Circle program
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Add Wallets</CardTitle>
            <CardDescription>
              Upload a CSV file or paste wallet addresses (one per line)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload CSV File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button onClick={handleFileUpload} disabled={!file || uploading}>
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addresses">Or Paste Addresses</Label>
              <Textarea
                id="addresses"
                placeholder="0x1234...5678&#10;0xabcd...efgh"
                value={addressesText}
                onChange={(e) => setAddressesText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <Button onClick={handleTextUpload} disabled={!addressesText.trim() || uploading}>
                {uploading ? "Uploading..." : "Upload Addresses"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wallets Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Early Circle Wallets</CardTitle>
                <CardDescription>
                  {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} in Early Circle
                </CardDescription>
              </div>
              <Button onClick={handleExport} variant="outline">
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tableLoading ? (
              <LoadingSpinner size="sm" text="Loading wallets..." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Added At</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Suspicious</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No wallets in Early Circle
                        </TableCell>
                      </TableRow>
                    ) : (
                      wallets.map((wallet) => (
                        <TableRow key={wallet.address}>
                          <TableCell className="font-mono text-sm">
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                          </TableCell>
                          <TableCell>
                            {wallet.addedAt
                              ? new Date(wallet.addedAt).toLocaleString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>{wallet.addedBy || "N/A"}</TableCell>
                          <TableCell>
                            {wallet.isSuspicious ? (
                              <span className="text-red-500">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveWallet(wallet.address)}
                            >
                              Remove
                            </Button>
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

