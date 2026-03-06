'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';

interface CountdownDisplayProps {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  showTitle?: boolean;
  title?: string;
  subtitle?: string;
  showPrice?: boolean;
  price?: string;
  actionButton?: React.ReactNode;
  contractAddress?: string;
}

export function CountdownDisplay({
  days,
  hours,
  minutes,
  seconds,
  showTitle = true,
  title = '4TH Stage In Progress',
  subtitle = 'Get your tokens before the price increases',
  showPrice = true,
  price = '$0.005',
  actionButton,
  contractAddress
}: CountdownDisplayProps) {
  return (
    <div className="text-center">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4 border border-white/20 ">
        {showTitle && (
          <>
            <h2 className="text-2xl font-bold text-white mb-4 animate-pulse">{title}</h2>
            {subtitle && <p className="text-blue-200 text-lg mb-4">{subtitle}</p>}
          </>
        )}
        
        {/* Countdown Timer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto mb-6">
          <ScrollAnimation direction="bottom" delay={100}>
            <div className="text-center">
              <div className="bg-white/20 rounded-xl p-2 sm:p-4 mb-2 animate-pulse">
                <div className="text-xl sm:text-3xl font-bold text-white">{days}</div>
              </div>
              <div className="text-blue-200 text-sm">Days</div>
            </div>
          </ScrollAnimation>
          <ScrollAnimation direction="bottom" delay={200}>
            <div className="text-center">
              <div className="bg-white/20 rounded-xl p-2 sm:p-4 mb-2 animate-pulse">
                <div className="text-xl sm:text-3xl font-bold text-white">{hours}</div>
              </div>
              <div className="text-blue-200 text-sm">Hours</div>
            </div>
          </ScrollAnimation>
          <ScrollAnimation direction="bottom" delay={300}>
            <div className="text-center">
              <div className="bg-white/20 rounded-xl p-2 sm:p-4 mb-2 animate-pulse">
                <div className="text-xl sm:text-3xl font-bold text-white">{minutes}</div>
              </div>
              <div className="text-blue-200 text-sm">Minutes</div>
            </div>
          </ScrollAnimation>
          <ScrollAnimation direction="bottom" delay={400}>
            <div className="text-center">
              <div className="bg-white/20 rounded-xl p-2 sm:p-4 mb-2 animate-pulse">
                <div className="text-xl sm:text-3xl font-bold text-white">{seconds}</div>
              </div>
              <div className="text-blue-200 text-sm">Seconds</div>
            </div>
          </ScrollAnimation>
        </div>

        <div className="text-center">
          {showPrice && (
            <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">Current Price: {price}</h3>
          )}
          {actionButton && (
            <div className="mt-2">
              {actionButton}
            </div>
          )}
          {contractAddress && (
            <div className="mt-4">
              <p className="text-white/70 text-sm mb-1">PreGVT (ERC-20) Smart Contract:</p>
              <p className="text-blue-400 font-mono text-xs sm:text-sm break-all">{contractAddress}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

