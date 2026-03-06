"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";
import { 
  PieChart as RechartsPieChart,
  Pie,
  Cell,
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

interface DistributionChartProps {
  kols: KOL[];
  className?: string;
}

const COLORS = {
  seed: "#3B82F6",    // Blue
  tree: "#10B981",    // Green
  solar: "#F59E0B",   // Amber
  compute: "#8B5CF6", // Purple
};

export function DistributionChart({ kols, className }: DistributionChartProps) {
  // Calculate NFT type distribution
  const distributionData = React.useMemo(() => {
    if (!kols || !Array.isArray(kols)) return [];
    
    const totals = kols.reduce((acc, kol) => {
      acc.seed += Number(kol.seed ?? 0);
      acc.tree += Number(kol.tree ?? 0);
      acc.solar += Number(kol.solar ?? 0);
      acc.compute += Number(kol.compute ?? 0);
      return acc;
    }, { seed: 0, tree: 0, solar: 0, compute: 0 });

    return [
      { name: "SeedPass", value: totals.seed, color: COLORS.seed },
      { name: "TreePass", value: totals.tree, color: COLORS.tree },
      { name: "SolarPass", value: totals.solar, color: COLORS.solar },
      { name: "ComputePass", value: totals.compute, color: COLORS.compute },
    ].filter(item => item.value > 0);
  }, [kols]);

  const totalMints = distributionData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <PieChart className="h-4 w-4 text-purple-500" />
          <span>NFT Distribution</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Distribution of NFT types across all KOLs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value.toLocaleString(), 'Mints']} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* NFT Type Breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Breakdown</h4>
          <div className="grid grid-cols-2 gap-2">
            {distributionData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/30">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.value} mints</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Summary */}
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-lg font-bold text-primary">{totalMints}</div>
          <div className="text-xs text-muted-foreground">Total Mints</div>
        </div>
      </CardContent>
    </Card>
  );
}
