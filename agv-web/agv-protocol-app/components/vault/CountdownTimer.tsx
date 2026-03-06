'use client';

import { useCountdown, getUnlockTimestamp } from '@/lib/vault/useCountdown';
import { Badge } from '@/components/ui/badge';
import { Clock, Lock } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

interface CountdownTimerProps {
  lockTimestamp: number;
  tier: string;
  className?: string;
}

export function CountdownTimer({ lockTimestamp, tier, className = '' }: CountdownTimerProps) {
  const { t } = useTranslations();
  
  if (tier === 'flex') {
    return null; // No countdown for flex tier
  }

  const unlockTimestamp = getUnlockTimestamp(lockTimestamp, tier);
  const countdown = useCountdown(unlockTimestamp);

  if (countdown.isExpired) {
    return (
      <Badge 
        variant="outline" 
        className={`bg-green-500/20 text-green-400 border-green-500/20 ${className}`}
      >
        <Lock className="h-3 w-3 mr-1" />
        {t('vault.unlock.lockedUntil')}: Unlocked
      </Badge>
    );
  }

  const formatTime = () => {
    const parts = [];
    if (countdown.days > 0) parts.push(`${countdown.days}d`);
    if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
    if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`);
    if (countdown.seconds > 0) parts.push(`${countdown.seconds}s`);
    
    return parts.join(' ') || '0s';
  };

  return (
    <Badge 
      variant="outline" 
      className={`bg-orange-500/20 text-orange-400 border-orange-500/20 ${className}`}
    >
      <Clock className="h-3 w-3 mr-1" />
      {t('vault.unlock.timeRemaining')}: {formatTime()}
    </Badge>
  );
}

export function UnlockTimestamp({ lockTimestamp, tier }: { lockTimestamp: number; tier: string }) {
  const { t } = useTranslations();
  
  if (tier === 'flex') {
    return null;
  }

  const unlockTimestamp = getUnlockTimestamp(lockTimestamp, tier);
  const unlockDate = new Date(unlockTimestamp * 1000);

  return (
    <div className="text-xs text-white/60">
      {t('vault.unlock.lockedUntil')}: {unlockDate.toLocaleDateString()} {unlockDate.toLocaleTimeString()}
    </div>
  );
}
