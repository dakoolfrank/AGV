"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  Users, 
  Crown,
  Star,
  Zap,
  BarChart3,
  LineChart,
  PieChart,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
  Area,
  AreaChart,
  Pie
} from "recharts";

interface KOL {
  kolId: string;
  name: string;
  walletAddress: string;
  email?: string | null;
  target?: number;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  updatedAt?: any;
}

interface LeaderboardGraphProps {
  kols: KOL[];
  className?: string;
}

const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;

// Color palette for charts
const COLORS = {
  seed: "#3B82F6",    // Blue
  tree: "#10B981",    // Green
  solar: "#F59E0B",   // Amber
  compute: "#8B5CF6", // Purple
  primary: "#6366F1", // Indigo
  secondary: "#EC4899", // Pink
  success: "#059669", // Emerald
  warning: "#D97706", // Orange
};

const PIE_COLORS = [COLORS.seed, COLORS.tree, COLORS.solar, COLORS.compute];

export function LeaderboardGraph({ kols, className }: LeaderboardGraphProps) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [selectedMetric, setSelectedMetric] = React.useState<"mints" | "value">("mints");

  // Calculate KOL performance metrics
  const kolPerformance = React.useMemo(() => {
    if (!kols || !Array.isArray(kols)) return [];
    
    return kols.map(kol => {
      const seed = Number(kol.seed ?? 0);
      const tree = Number(kol.tree ?? 0);
      const solar = Number(kol.solar ?? 0);
      const compute = Number(kol.compute ?? 0);
      
      const totalMints = seed + tree + solar + compute;
      const totalValue = 
        seed * NFT_PRICES.seed +
        tree * NFT_PRICES.tree +
        solar * NFT_PRICES.solar +
        compute * NFT_PRICES.compute;
      
      const target = Number(kol.target ?? 0);
      const completionRate = target > 0 ? (totalMints / target) * 100 : 0;
      
      return {
        ...kol,
        totalMints,
        totalValue,
        completionRate,
        performanceScore: totalMints * 10 + totalValue / 100,
        // Individual NFT type data for charts
        seed,
        tree,
        solar,
        compute,
        // Formatted data for display
        displayName: kol.name.length > 12 ? `${kol.name.substring(0, 12)}...` : kol.name,
        shortKolId: kol.kolId.replace('AGV-KOL', '')
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);
  }, [kols]);

  // Prepare data for different chart types
  const chartData = React.useMemo(() => {
    const top10 = kolPerformance.slice(0, 10);
    
    return {
      // Bar chart data (top 10 KOLs)
      barChart: top10.map(kol => ({
        name: kol.displayName,
        kolId: kol.shortKolId,
        mints: kol.totalMints,
        value: kol.totalValue,
        seed: kol.seed,
        tree: kol.tree,
        solar: kol.solar,
        compute: kol.compute,
        completionRate: Math.min(kol.completionRate, 100)
      })),
      
      // Line chart data (performance over time - simulated)
      lineChart: top10.map((kol, index) => ({
        name: kol.displayName,
        kolId: kol.shortKolId,
        current: kol.totalMints,
        target: kol.target || 0,
        trend: Math.max(0, kol.totalMints - (index * 2)) // Simulated trend
      })),
      
      // Pie chart data (NFT type distribution)
      pieChart: [
        { name: "SeedPass", value: kolPerformance.reduce((sum, kol) => sum + kol.seed, 0), color: COLORS.seed },
        { name: "TreePass", value: kolPerformance.reduce((sum, kol) => sum + kol.tree, 0), color: COLORS.tree },
        { name: "SolarPass", value: kolPerformance.reduce((sum, kol) => sum + kol.solar, 0), color: COLORS.solar },
        { name: "ComputePass", value: kolPerformance.reduce((sum, kol) => sum + kol.compute, 0), color: COLORS.compute },
      ].filter(item => item.value > 0),
      
      // Area chart data (cumulative performance)
      areaChart: top10.map((kol, index) => ({
        name: kol.displayName,
        kolId: kol.shortKolId,
        cumulative: top10.slice(0, index + 1).reduce((sum, k) => sum + k.totalMints, 0),
        individual: kol.totalMints
      }))
    };
  }, [kolPerformance]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const topPerformers = kolPerformance.slice(0, 5);

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>KOL Performance Analytics</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Interactive leaderboard with performance charts and insights
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">
              <LineChart className="h-3 w-3 mr-1" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="distribution" className="text-xs">
              <PieChart className="h-3 w-3 mr-1" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trends
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Bar Chart */}
          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Top 10 KOLs by Performance</h3>
              <div className="flex space-x-2">
                <Button
                  variant={selectedMetric === "mints" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("mints")}
                  className="text-xs"
                >
                  Mints
                </Button>
                <Button
                  variant={selectedMetric === "value" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("value")}
                  className="text-xs"
                >
                  Value
                </Button>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.barChart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey={selectedMetric} 
                    fill={selectedMetric === "mints" ? COLORS.primary : COLORS.success}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 5 Quick View */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Top 5 Performers</h4>
              <div className="space-y-1">
                {topPerformers.map((kol, index) => (
                  <div key={kol.kolId} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      {getRankIcon(index)}
                      <span className="text-sm font-medium">{kol.displayName}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{kol.totalMints} mints</div>
                      <div className="text-xs text-muted-foreground">${kol.totalValue.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab - Line Chart */}
          <TabsContent value="performance" className="space-y-4">
            <h3 className="font-semibold">Performance Trends</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={chartData.lineChart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="current" 
                    stroke={COLORS.primary} 
                    strokeWidth={3}
                    name="Current Mints"
                    dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke={COLORS.warning} 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Target"
                    dot={{ fill: COLORS.warning, strokeWidth: 2, r: 3 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Distribution Tab - Pie Chart */}
          <TabsContent value="distribution" className="space-y-4">
            <h3 className="font-semibold">NFT Type Distribution</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData.pieChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.pieChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value.toLocaleString(), 'Mints']} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* NFT Type Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {chartData.pieChart.map((item, index) => (
                <div key={item.name} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/30">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.value} mints</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Trends Tab - Area Chart */}
          <TabsContent value="trends" className="space-y-4">
            <h3 className="font-semibold">Cumulative Performance</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.areaChart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="cumulative" 
                    stackId="1" 
                    stroke={COLORS.primary} 
                    fill={COLORS.primary}
                    fillOpacity={0.6}
                    name="Cumulative Mints"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Insights */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-lg font-bold text-blue-600">
                  {kolPerformance.length}
                </div>
                <div className="text-xs text-blue-700">Total KOLs</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-lg font-bold text-green-600">
                  {kolPerformance.reduce((sum, kol) => sum + kol.totalMints, 0)}
                </div>
                <div className="text-xs text-green-700">Total Mints</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="text-lg font-bold text-purple-600">
                  ${kolPerformance.reduce((sum, kol) => sum + kol.totalValue, 0).toLocaleString()}
                </div>
                <div className="text-xs text-purple-700">Total Value</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
