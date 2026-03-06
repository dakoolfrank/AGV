'use client';

import { useState, useEffect } from 'react';
import { CrossCircledIcon, InfoCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useTranslations } from '@/lib/translation-provider';

interface StickyDisclaimerProps {
  variant?: 'top' | 'bottom';
  dismissible?: boolean;
}

export function StickyDisclaimer({ variant = 'top', dismissible = true }: StickyDisclaimerProps) {
  const { t } = useTranslations('stickyDisclaimer');
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Show after a short delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (isDismissed) return null;

  const isTopBanner = variant === 'top';
  
  const content = isTopBanner
    ? {
        title: t('top.title'),
        description: t('top.description'),
        icon: InfoCircledIcon,
        bgClass: "bg-black/90",
        borderClass: "border-blue-500/40",
        textColor: "text-white",
        iconColor: "text-blue-300",
      }
    : {
        title: t('bottom.title'),
        description: t('bottom.description'),
        icon: ExclamationTriangleIcon,
        bgClass: "bg-black/90",
        borderClass: "border-amber-400/40",
        textColor: "text-white",
        iconColor: "text-amber-300",
      };

  const IconComponent = content.icon;

  return (
    <div className={`fixed ${isTopBanner ? 'top-0' : 'bottom-0'} left-0 right-0 z-50 transform transition-all duration-500 ease-out ${
      isVisible ? 'translate-y-0 opacity-100' : isTopBanner ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'
    }`}>
      <div className={`${content.bgClass} backdrop-blur-md border-b ${content.borderClass} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IconComponent className={`w-5 h-5 ${content.iconColor} flex-shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${content.textColor} truncate`}>
                  <span className="font-semibold">{content.title}:</span> {content.description}
                </p>
              </div>
            </div>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className={`ml-4 p-1 rounded-md hover:bg-white/10 transition-colors ${content.iconColor}`}
                aria-label="Dismiss notification"
              >
                <CrossCircledIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
