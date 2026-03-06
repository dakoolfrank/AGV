"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  Users, 
  Download,
  Copy,
  ExternalLink,
  Search
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CampaignSubmission {
  id: string;
  walletAddress: string;
  xUsername: string;
  discordUsername: string;
  timestamp: string;
  createdAt: string;
}

export default function CampaignSubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Fetch submissions
  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/admin/buypage/campaign", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch submissions");
      }

      const result = await res.json();
      if (result.success) {
        setSubmissions(result.data);
        setTotalCount(result.totalCount || 0);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      toast.error("Failed to load submissions", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!auth.currentUser) return;

    try {
      setIsExporting(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/admin/buypage/campaign/export", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        throw new Error("Failed to export");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-submissions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export successful");
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast.error("Failed to export", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Filter submissions based on search query
  const filteredSubmissions = submissions.filter(sub => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      sub.walletAddress.toLowerCase().includes(query) ||
      sub.xUsername.toLowerCase().includes(query) ||
      sub.discordUsername.toLowerCase().includes(query)
    );
  });

  const doSignOut = async () => {
    await auth.signOut();
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Campaign Submissions</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              View and manage campaign submissions
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={isExporting || loading}
            className="flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
        </div>

        {/* Stats Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                <span className="font-medium">{totalCount} / 1000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by wallet address, X username, or Discord username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                Submissions ({filteredSubmissions.length} {searchQuery ? 'filtered' : 'total'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet Address</TableHead>
                      <TableHead>X Username</TableHead>
                      <TableHead>Discord Username</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {searchQuery ? "No submissions match your search" : "No submissions found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubmissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{formatAddress(submission.walletAddress)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(submission.walletAddress)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <a
                                href={`https://bscscan.com/address/${submission.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{submission.xUsername}</TableCell>
                          <TableCell className="font-mono text-sm">{submission.discordUsername}</TableCell>
                          <TableCell className="text-sm">{formatDate(submission.timestamp || submission.createdAt)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(submission.walletAddress)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

