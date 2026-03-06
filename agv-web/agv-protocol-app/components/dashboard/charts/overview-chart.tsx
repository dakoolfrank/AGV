"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Crown, Medal, Award } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
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

interface OverviewChartProps {
  kols: KOL[];
  className?: string;
}

const NFT_PRICES = { seed: 29, tree: 59, solar: 299, compute: 899 } as const;

const COLORS = {
  primary: "#6366F1",
  success: "#059669",
};

export function OverviewChart({ kols, className }: OverviewChartProps) {
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
      
      return {
        ...kol,
        totalMints,
        totalValue,
        displayName: kol.name.length > 10 ? `${kol.name.substring(0, 10)}...` : kol.name,
        shortKolId: kol.kolId.replace('AGV-KOL', '')
      };
    }).sort((a, b) => b.totalMints - a.totalMints);
  }, [kols]);

  const chartData = React.useMemo(() => {
    return kolPerformance.slice(0, 8).map(kol => ({
      name: kol.displayName,
      kolId: kol.shortKolId,
      mints: kol.totalMints,
      value: kol.totalValue,
    }));
  }, [kolPerformance]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 1:
        return <Medal className="h-3 w-3 text-gray-400" />;
      case 2:
        return <Award className="h-3 w-3 text-amber-600" />;
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

  const topPerformers = kolPerformance.slice(0, 3);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <span>Top Performers</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Top 8 KOLs by performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Performance Metrics</h3>
          <div className="flex space-x-1">
            <Button
              variant={selectedMetric === "mints" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMetric("mints")}
              className="text-xs h-7 px-2"
            >
              Mints
            </Button>
            <Button
              variant={selectedMetric === "value" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMetric("value")}
              className="text-xs h-7 px-2"
            >
              Value
            </Button>
          </div>
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey={selectedMetric} 
                fill={selectedMetric === "mints" ? COLORS.primary : COLORS.success}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 3 Quick View */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Top 3</h4>
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
      </CardContent>
    </Card>
  );
}
