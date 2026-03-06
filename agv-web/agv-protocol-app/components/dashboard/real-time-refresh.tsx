"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RealTimeRefreshProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
  className?: string;
}

export function RealTimeRefresh({ 
  onRefresh, 
  isRefreshing = false, 
  lastUpdated,
  autoRefresh = false,
  onToggleAutoRefresh,
  className 
}: RealTimeRefreshProps) {
  const [timeSinceUpdate, setTimeSinceUpdate] = React.useState<string>("");

  // Update time since last refresh
  React.useEffect(() => {
    if (!lastUpdated) return;

    const updateTimeSince = () => {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        setTimeSinceUpdate("Just now");
      } else if (diffInSeconds < 3600) {
        setTimeSinceUpdate(`${Math.floor(diffInSeconds / 60)}m ago`);
      } else if (diffInSeconds < 86400) {
        setTimeSinceUpdate(`${Math.floor(diffInSeconds / 3600)}h ago`);
      } else {
        setTimeSinceUpdate(`${Math.floor(diffInSeconds / 86400)}d ago`);
      }
    };

    updateTimeSince();
    const interval = setInterval(updateTimeSince, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Auto-refresh functionality
  React.useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        {autoRefresh ? (
          <Badge variant="secondary" className="gap-1">
            <Wifi className="h-3 w-3" />
            Live
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Manual
          </Badge>
        )}
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeSinceUpdate}</span>
        </div>
      )}

      {/* Auto-refresh Toggle */}
      {onToggleAutoRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleAutoRefresh(!autoRefresh)}
          className="h-8 px-2"
        >
          {autoRefresh ? "Disable Auto" : "Enable Auto"}
        </Button>
      )}

      {/* Manual Refresh */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-8 px-3"
      >
        <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </div>
  );
}
