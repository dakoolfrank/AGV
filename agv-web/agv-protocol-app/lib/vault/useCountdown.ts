'use client';

import { useState, useEffect } from 'react';

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
}

export function useCountdown(targetTimestamp: number): CountdownState {
  const [timeLeft, setTimeLeft] = useState<CountdownState>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const difference = targetTimestamp - now;

      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalSeconds: 0,
          isExpired: true
        };
      }

      const days = Math.floor(difference / (24 * 60 * 60));
      const hours = Math.floor((difference % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((difference % (60 * 60)) / 60);
      const seconds = difference % 60;

      return {
        days,
        hours,
        minutes,
        seconds,
        totalSeconds: difference,
        isExpired: false
      };
    };

    // Calculate immediately
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  return timeLeft;
}

export function getLockDurationSeconds(tier: string): number {
  switch (tier) {
    case 'flex':
      return 0; // No lock period
    case '1m':
      return 30 * 24 * 60 * 60; // 30 days
    case '3m':
      return 90 * 24 * 60 * 60; // 90 days
    case '6m':
      return 180 * 24 * 60 * 60; // 180 days
    case '12m':
      return 365 * 24 * 60 * 60; // 365 days
    default:
      return 0;
  }
}

export function getUnlockTimestamp(lockTimestamp: number, tier: string): number {
  const duration = getLockDurationSeconds(tier);
  return lockTimestamp + duration;
}
