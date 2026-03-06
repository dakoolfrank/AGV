'use client';

import { X } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

interface DiscordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onJoinCommunity: () => void;
}

export function DiscordVerificationModal({
  isOpen,
  onClose,
  onProceed,
  onJoinCommunity,
}: DiscordVerificationModalProps) {
  const { t } = useTranslations('discordVerificationModal');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl border-2 border-slate-600 shadow-2xl max-w-md w-full mx-4 p-6 z-50">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="space-y-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <svg
                className="w-12 h-12 text-indigo-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.007-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              {t('title')}
            </h3>
            <p className="text-slate-300 text-sm">
              {t('description')}
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={onProceed}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
            >
              {t('proceed')}
            </button>
            <button
              onClick={onJoinCommunity}
              className="w-full bg-indigo-500/20 border-2 border-indigo-400/50 text-indigo-300 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-500/30 hover:border-indigo-400 transition-all duration-300"
            >
              {t('joinCommunity')}
            </button>
            <button
              onClick={onClose}
              className="w-full text-slate-400 hover:text-slate-200 px-6 py-2 rounded-xl font-medium transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

