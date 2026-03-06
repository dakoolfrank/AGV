"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { 
  AreaChart,
  Area,
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

interface TrendsChartProps {
  kols: KOL[];
  className?: string;
}

const COLORS = {
  primary: "#6366F1",
};

export function TrendsChart({ kols, className }: TrendsChartProps) {
  // Calculate KOL performance metrics
  const kolPerformance = React.useMemo(() => {
    if (!kols || !Array.isArray(kols)) return [];
    
    return kols.map(kol => {
      const seed = Number(kol.seed ?? 0);
      const tree = Number(kol.tree ?? 0);
      const solar = Number(kol.solar ?? 0);
      const compute = Number(kol.compute ?? 0);
      
      const totalMints = seed + tree + solar + compute;
      
      return {
        ...kol,
        totalMints,
        displayName: kol.name.length > 10 ? `${kol.name.substring(0, 10)}...` : kol.name,
        shortKolId: kol.kolId.replace('AGV-KOL', '')
      };
    }).sort((a, b) => b.totalMints - a.totalMints);
  }, [kols]);

  const chartData = React.useMemo(() => {
    const top8 = kolPerformance.slice(0, 8);
    return top8.map((kol, index) => ({
      name: kol.displayName,
      kolId: kol.shortKolId,
      cumulative: top8.slice(0, index + 1).reduce((sum, k) => sum + k.totalMints, 0),
      individual: kol.totalMints
    }));
  }, [kolPerformance]);

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

  const totalKOLs = kolPerformance.length;
  const totalMints = kolPerformance.reduce((sum, kol) => sum + kol.totalMints, 0);
  const totalValue = kolPerformance.reduce((sum, kol) => {
    const seed = Number(kol.seed ?? 0);
    const tree = Number(kol.tree ?? 0);
    const solar = Number(kol.solar ?? 0);
    const compute = Number(kol.compute ?? 0);
    return sum + (seed * 29 + tree * 59 + solar * 299 + compute * 899);
  }, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <span>Cumulative Trends</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Cumulative performance and key metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
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

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-sm font-bold text-blue-600">{totalKOLs}</div>
            <div className="text-xs text-blue-700">Total KOLs</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50 border border-green-200">
            <div className="text-sm font-bold text-green-600">{totalMints}</div>
            <div className="text-xs text-green-700">Total Mints</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-purple-50 border border-purple-200">
            <div className="text-sm font-bold text-purple-600">${totalValue.toLocaleString()}</div>
            <div className="text-xs text-purple-700">Total Value</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
