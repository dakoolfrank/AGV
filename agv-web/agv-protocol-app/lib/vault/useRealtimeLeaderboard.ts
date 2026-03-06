// lib/vault/useRealtimeLeaderboard.ts
import { useEffect, useRef, useState } from 'react';
import { useVaultStore } from './store';
import type { LeaderboardData } from './api';

export function useRealtimeLeaderboard() {
  const { leaderboard, setLeaderboard } = useVaultStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const fetchLeaderboard = async () => {
    try {
      setIsUpdating(true);
      const response = await fetch('/api/vault/leaderboard', {
        cache: 'no-store' // Always fetch fresh data
      });
      
      if (response.ok) {
        const data: LeaderboardData = await response.json();
        setLeaderboard(data);
        lastUpdateRef.current = Date.now();
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const startRealtimeUpdates = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately
    fetchLeaderboard();

    // Set up interval for regular updates (every 30 seconds)
    intervalRef.current = setInterval(() => {
      fetchLeaderboard();
    }, 30000);
  };

  const stopRealtimeUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const refreshNow = () => {
    fetchLeaderboard();
  };

  // Auto-start realtime updates when component mounts
  useEffect(() => {
    startRealtimeUpdates();

    // Cleanup on unmount
    return () => {
      stopRealtimeUpdates();
    };
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce update frequency
        stopRealtimeUpdates();
        intervalRef.current = setInterval(() => {
          fetchLeaderboard();
        }, 60000); // Update every minute when hidden
      } else {
        // Page is visible, resume normal updates
        stopRealtimeUpdates();
        startRealtimeUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    leaderboard,
    isUpdating,
    refreshNow,
    lastUpdate: lastUpdateRef.current
  };
}
