'use client';

import { useState } from 'react';
import { InfoCircledIcon, ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { useTranslations } from '@/lib/translation-provider';

interface DisclaimerBannerProps {
  variant?: 'top' | 'bottom';
}

export function DisclaimerBanner({ variant = 'top' }: DisclaimerBannerProps) {
  const { t } = useTranslations('disclaimerBanner');
  const [isExpanded, setIsExpanded] = useState(false);
  const isTopBanner = variant === 'top';
  
  const content = isTopBanner ? {
    title: t('top.title'),
    description: t('top.description'),
    icon: InfoCircledIcon,
    bgColor: "from-blue-500/15 to-indigo-500/15",
    borderColor: "border-blue-400/40",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    titleColor: "text-blue-200",
    textColor: "text-blue-100"
  } : {
    title: t('bottom.title'),
    description: t('bottom.description'),
    icon: ExclamationTriangleIcon,
    bgColor: "from-amber-500/15 to-orange-500/15",
    borderColor: "border-amber-400/40",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    titleColor: "text-amber-200",
    textColor: "text-amber-100"
  };

  const IconComponent = content.icon;

  return (
    <section className="w-full bg-black py-8 relative overflow-hidden">
      <div className={`w-full flex justify-center ${isTopBanner ? 'mb-6' : 'mt-6'}`}>
        <div className={`bg-gradient-to-r ${content.bgColor} backdrop-blur-sm rounded-xl p-4 border ${content.borderColor} shadow-lg hover:shadow-xl transition-all duration-300 max-w-4xl w-full`}>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <div className={`p-2 ${content.iconBg} rounded-lg border ${content.borderColor}`}>
              <IconComponent className={`w-5 h-5 ${content.iconColor}`} />
            </div>
            <h3 className={`text-base font-semibold ${content.titleColor}`}>
              {content.title}
            </h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-1 rounded-md hover:bg-white/10 transition-colors ${content.iconColor}`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className={`text-sm ${content.textColor} leading-relaxed ${isExpanded ? 'block' : 'hidden md:block'}`}>
            {content.description}
          </p>
          <div className="md:hidden mt-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-xs ${content.iconColor} hover:underline`}
            >
              {isExpanded ? t('showLess') : t('showMore')}
            </button>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
