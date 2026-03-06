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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

interface EarlyCircleConfig {
  isActive: boolean;
  startTimestamp: string | null;
  endTimestamp: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface EarlyCircleStats {
  totalEarlyCircleWallets: number;
  walletsThatClaimed: number;
  walletsWithFirstBuy: number;
  walletsWithValidReferrals: number;
  walletsCompletedFullCycle: number;
  totalEarlyCircleBuyVolume: number;
  isActive: boolean;
}

export default function EarlyCirclePage() {
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EarlyCircleConfig | null>(null);
  const [stats, setStats] = useState<EarlyCircleStats | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(false);

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
            await fetchConfig();
            await fetchStats();
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

  const fetchConfig = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/config", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          setConfig(data.config);
          setIsActive(data.config.isActive);
          setStartDate(data.config.startTimestamp ? new Date(data.config.startTimestamp).toISOString().slice(0, 16) : "");
          setEndDate(data.config.endTimestamp ? new Date(data.config.endTimestamp).toISOString().slice(0, 16) : "");
        }
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/stats", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/config", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive,
          startTimestamp: startDate || null,
          endTimestamp: endDate || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success("Early Circle configuration saved successfully");
          await fetchConfig();
          await fetchStats();
        } else {
          toast.error(data.error || "Failed to save configuration");
        }
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setConfigLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return;

      const response = await fetch("/api/admin/early-circle/export?format=csv", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "early-circle-export.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Export downloaded successfully");
      } else {
        toast.error("Failed to export data");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
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
          <h1 className="text-3xl font-bold">Early Circle Management</h1>
          <p className="text-muted-foreground">
            Configure and manage the Early Circle program
          </p>
        </div>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set Early Circle active status and time window</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Early Circle Active</Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Timestamp</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Timestamp</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <Button onClick={handleSaveConfig} disabled={configLoading}>
              {configLoading ? "Saving..." : "Save Configuration"}
            </Button>

            {config && (
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(config.updatedAt).toLocaleString()}
                {config.updatedBy && ` by ${config.updatedBy}`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics Summary</CardTitle>
            <CardDescription>Early Circle performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSpinner size="sm" text="Loading stats..." />
            ) : stats ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold">{stats.totalEarlyCircleWallets}</div>
                  <div className="text-sm text-muted-foreground">Total Early Circle Wallets</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.walletsThatClaimed}</div>
                  <div className="text-sm text-muted-foreground">Wallets That Claimed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.walletsWithFirstBuy}</div>
                  <div className="text-sm text-muted-foreground">Wallets With First Buy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.walletsWithValidReferrals}</div>
                  <div className="text-sm text-muted-foreground">Wallets With Valid Referrals</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.walletsCompletedFullCycle}</div>
                  <div className="text-sm text-muted-foreground">Completed Full Cycle</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">${stats.totalEarlyCircleBuyVolume.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Total Buy Volume</div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">No stats available</div>
            )}
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage Early Circle data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={handleExport} variant="outline">
                Export Early Circle Data (CSV)
              </Button>
              <Button onClick={fetchStats} variant="outline">
                Refresh Stats
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>• Export includes all Early Circle wallets with complete metrics</p>
              <p>• Use the cohort view for detailed wallet analysis</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

