"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  Users, 
  Wallet,
  CheckCircle,
  TrendingUp,
  ShoppingCart,
  Link2,
  Coins,
  Eye,
  XCircle,
  Globe,
  Monitor,
  Clock,
  AlertTriangle
} from "lucide-react";

interface FunnelMetric {
  today: number;
  total: number;
}

interface FunnelData {
  todayStartsAt: string;
  claimFunnel: {
    claimPageVisits: FunnelMetric;
    walletsConnected: FunnelMetric;
    walletsActivated: FunnelMetric;
    claimsSuccess: FunnelMetric;
    claimsFailed?: FunnelMetric;
    dropoffs?: FunnelMetric;
    dropoffRate?: number;
    conversionRate?: number;
    walletConnectionRate?: number;
    activationRate?: number;
  };
  buyFunnel: {
    buyPageVisits: FunnelMetric;
    purchasesSuccess: FunnelMetric;
    dropoffs?: FunnelMetric;
    dropoffRate?: number;
  };
  referrals: {
    referralPurchases: FunnelMetric;
  };
  stakingFunnel: {
    stakingPageVisits: FunnelMetric;
    stakesSuccess: FunnelMetric;
    dropoffs?: FunnelMetric;
    dropoffRate?: number;
  };
  byCountry?: Record<string, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>;
  byDevice?: Record<string, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>;
  byHour?: Record<number, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>;
  errorCodes?: Record<string, number>;
}

function MetricRow({ 
  label, 
  icon: Icon, 
  today, 
  total 
}: { 
  label: string; 
  icon: React.ElementType; 
  today: number; 
  total: number; 
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right min-w-[80px]">
          <p className="text-2xl font-bold">{today.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
        <div className="text-right min-w-[80px]">
          <p className="text-2xl font-bold">{total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
  );
}

export default function FunnelPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FunnelData | null>(null);

  useEffect(() => {
    fetchFunnelData();
  }, []);

  const fetchFunnelData = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch("/api/admin/buypage/funnel", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch funnel data");
      }

      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch data");
      }
    } catch (error: any) {
      console.error("Error fetching funnel data:", error);
      toast.error("Failed to load funnel data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const doSignOut = async () => {
    await auth.signOut();
  };

  const formatTodayStart = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return isoString;
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold">Activity Funnel</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Track user activity from page visits to conversions
          </p>
          {data?.todayStartsAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Today started at: {formatTodayStart(data.todayStartsAt)} (11am UTC)
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Claim Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Claim Funnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="ClaimPage Visits"
                  icon={Eye}
                  today={data.claimFunnel.claimPageVisits.today}
                  total={data.claimFunnel.claimPageVisits.total}
                />
                <MetricRow
                  label="Wallets Connected"
                  icon={Wallet}
                  today={data.claimFunnel.walletsConnected.today}
                  total={data.claimFunnel.walletsConnected.total}
                />
                <MetricRow
                  label="Wallets Activated"
                  icon={Users}
                  today={data.claimFunnel.walletsActivated.today}
                  total={data.claimFunnel.walletsActivated.total}
                />
                <MetricRow
                  label="Claims Success"
                  icon={CheckCircle}
                  today={data.claimFunnel.claimsSuccess.today}
                  total={data.claimFunnel.claimsSuccess.total}
                />
                {data.claimFunnel.claimsFailed && (
                  <MetricRow
                    label="Claims Failed"
                    icon={XCircle}
                    today={data.claimFunnel.claimsFailed.today}
                    total={data.claimFunnel.claimsFailed.total}
                  />
                )}
                {data.claimFunnel.dropoffs && (
                  <MetricRow
                    label="Drop-offs"
                    icon={AlertTriangle}
                    today={data.claimFunnel.dropoffs.today}
                    total={data.claimFunnel.dropoffs.total}
                  />
                )}
                {data.claimFunnel.conversionRate !== undefined && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="text-sm font-semibold">{data.claimFunnel.conversionRate.toFixed(2)}%</span>
                    </div>
                    {data.claimFunnel.walletConnectionRate !== undefined && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Wallet Connection Rate</span>
                        <span className="text-sm font-semibold">{data.claimFunnel.walletConnectionRate.toFixed(2)}%</span>
                      </div>
                    )}
                    {data.claimFunnel.activationRate !== undefined && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Activation Rate</span>
                        <span className="text-sm font-semibold">{data.claimFunnel.activationRate.toFixed(2)}%</span>
                      </div>
                    )}
                    {data.claimFunnel.dropoffRate !== undefined && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Drop-off Rate</span>
                        <span className="text-sm font-semibold text-red-500">{data.claimFunnel.dropoffRate.toFixed(2)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Buy Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  Buy Funnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="BuyPage Visits"
                  icon={Eye}
                  today={data.buyFunnel.buyPageVisits.today}
                  total={data.buyFunnel.buyPageVisits.total}
                />
                <MetricRow
                  label="Purchases Success"
                  icon={TrendingUp}
                  today={data.buyFunnel.purchasesSuccess.today}
                  total={data.buyFunnel.purchasesSuccess.total}
                />
                {data.buyFunnel.dropoffs && (
                  <MetricRow
                    label="Drop-offs"
                    icon={AlertTriangle}
                    today={data.buyFunnel.dropoffs.today}
                    total={data.buyFunnel.dropoffs.total}
                  />
                )}
                {data.buyFunnel.dropoffRate !== undefined && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Drop-off Rate</span>
                      <span className="text-sm font-semibold text-red-500">{data.buyFunnel.dropoffRate.toFixed(2)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referrals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-purple-500" />
                  Referrals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="Referral Purchases"
                  icon={Link2}
                  today={data.referrals.referralPurchases.today}
                  total={data.referrals.referralPurchases.total}
                />
              </CardContent>
            </Card>

            {/* Staking Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-500" />
                  Staking Funnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="StakingPage Visits"
                  icon={Eye}
                  today={data.stakingFunnel.stakingPageVisits.today}
                  total={data.stakingFunnel.stakingPageVisits.total}
                />
                <MetricRow
                  label="Stakes Success"
                  icon={Coins}
                  today={data.stakingFunnel.stakesSuccess.today}
                  total={data.stakingFunnel.stakesSuccess.total}
                />
                {data.stakingFunnel.dropoffs && (
                  <MetricRow
                    label="Drop-offs"
                    icon={AlertTriangle}
                    today={data.stakingFunnel.dropoffs.today}
                    total={data.stakingFunnel.dropoffs.total}
                  />
                )}
                {data.stakingFunnel.dropoffRate !== undefined && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Drop-off Rate</span>
                      <span className="text-sm font-semibold text-red-500">{data.stakingFunnel.dropoffRate.toFixed(2)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

            {/* Additional Analytics Sections */}
            {(data.byCountry || data.byDevice || data.byHour || data.errorCodes) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Country Breakdown */}
              {data.byCountry && Object.keys(data.byCountry).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-500" />
                      By Country
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {Object.entries(data.byCountry)
                        .sort((a, b) => (b[1].pageVisits + b[1].walletConnections) - (a[1].pageVisits + a[1].walletConnections))
                        .slice(0, 10)
                        .map(([country, stats]) => (
                          <div key={country} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                            <div>
                              <p className="font-medium">{country}</p>
                              <p className="text-xs text-muted-foreground">
                                Visits: {stats.pageVisits} • Connections: {stats.walletConnections} • Claims: {stats.claimsSuccess}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Device Breakdown */}
              {data.byDevice && Object.keys(data.byDevice).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-purple-500" />
                      By Device Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(data.byDevice)
                        .sort((a, b) => (b[1].pageVisits + b[1].walletConnections) - (a[1].pageVisits + a[1].walletConnections))
                        .map(([device, stats]) => (
                          <div key={device} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                            <div>
                              <p className="font-medium capitalize">{device}</p>
                              <p className="text-xs text-muted-foreground">
                                Visits: {stats.pageVisits} • Connections: {stats.walletConnections} • Claims: {stats.claimsSuccess}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Time of Day Distribution */}
              {data.byHour && Object.keys(data.byHour).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      By Hour (UTC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {Array.from({ length: 24 }, (_, i) => i)
                        .filter(hour => data.byHour![hour])
                        .map(hour => {
                          const stats = data.byHour![hour];
                          return (
                            <div key={hour} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                              <div>
                                <p className="font-medium">{hour}:00 UTC</p>
                                <p className="text-xs text-muted-foreground">
                                  Visits: {stats.pageVisits} • Connections: {stats.walletConnections} • Claims: {stats.claimsSuccess}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error Codes */}
              {data.errorCodes && Object.keys(data.errorCodes).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Error Codes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(data.errorCodes)
                        .sort((a, b) => b[1] - a[1])
                        .map(([errorCode, count]) => (
                          <div key={errorCode} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                            <div>
                              <p className="font-medium">{errorCode}</p>
                              <p className="text-xs text-muted-foreground">{count} occurrence{count !== 1 ? 's' : ''}</p>
                            </div>
                            <span className="text-sm font-semibold text-red-500">{count}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            )}
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
