"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, TrendingUp } from "lucide-react";
import { 
  LineChart as RechartsLineChart,
  Line,
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

interface PerformanceChartProps {
  kols: KOL[];
  className?: string;
}

const COLORS = {
  primary: "#6366F1",
  warning: "#D97706",
};

export function PerformanceChart({ kols, className }: PerformanceChartProps) {
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
    return kolPerformance.slice(0, 8).map((kol, index) => ({
      name: kol.displayName,
      kolId: kol.shortKolId,
      current: kol.totalMints,
      target: kol.target || 0,
      trend: Math.max(0, kol.totalMints - (index * 1.5)) // Simulated trend
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

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <LineChart className="h-4 w-4 text-green-500" />
          <span>Performance Trends</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Current performance vs targets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
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
              <Line 
                type="monotone" 
                dataKey="current" 
                stroke={COLORS.primary} 
                strokeWidth={2}
                name="Current Mints"
                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 3 }}
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
      </CardContent>
    </Card>
  );
}
