'use client';

import { useVaultStore } from '@/lib/vault/store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, Clock, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

export function VaultWarning() {
  const { t } = useTranslations();
  const { lockedNfts, lastValidationTime, performPeriodicValidation } = useVaultStore();

  if (lockedNfts.length === 0) return null;

  return (
    <Alert className="mb-6 border-yellow-500/20 bg-yellow-500/10 backdrop-blur-xl">
      <AlertDescription className="text-yellow-300">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span className="font-medium">
            {lockedNfts.length} NFT{lockedNfts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-sm text-yellow-300/80 mt-1">
          ⚠️ <strong>{t('vault.warning.important')}</strong> {t('vault.warning.description')}
        </p>
        <div className="flex items-center justify-between mt-2">
          {lastValidationTime > 0 && (
            <div className="flex items-center gap-1 text-xs text-yellow-300/60">
              <Clock className="h-3 w-3" />
              <span>
                {t('vault.warning.lastValidation')} {new Date(lastValidationTime).toLocaleTimeString()}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="bg-yellow-500/10 border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20"
            onClick={() => performPeriodicValidation()}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('vault.warning.validateNow')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
