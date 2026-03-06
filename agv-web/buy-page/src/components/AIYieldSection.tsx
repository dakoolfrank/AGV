'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { useState, useEffect } from 'react';
import { DollarSign, Lock, Zap, Palette, RefreshCw, RotateCcw, Repeat } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function AIYieldSection() {
  const { t } = useTranslations('aiYield');
  const [currentStep, setCurrentStep] = useState(0);
  
  const yieldSteps = [
    { label: t('step1') || 'Buy preGVT', Icon: DollarSign, color: 'from-blue-500 to-blue-600' },
    { label: t('step2') || 'Stake', Icon: Lock, color: 'from-green-500 to-green-600' },
    { label: t('step3') || 'Earn rGGP', Icon: Zap, color: 'from-yellow-500 to-yellow-600' },
    { label: t('step4') || 'NFT Boost', Icon: Palette, color: 'from-purple-500 to-purple-600' },
    { label: t('step5') || 'Redeem 1:1 for GVT', Icon: RefreshCw, color: 'from-teal-500 to-teal-600' },
    { label: t('step6') || 'Re-stake', Icon: RotateCcw, color: 'from-violet-500 to-violet-600' },
    { label: t('step7') || 'Repeat', Icon: Repeat, color: 'from-pink-500 to-pink-600' }
  ];

  // Auto-rotate through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % yieldSteps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [yieldSteps.length]);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '50%',
          right: '3%',
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, -50%)',
          zIndex: 0,
          filter: 'blur(85px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {t('title') || "You're Now Closer Than Ever to"} <span className="text-blue-400 italic">{t('titleHighlight') || 'AI Power Income'}</span>
            </h2>
            <p className="text-xl md:text-2xl text-white/80 mb-2">
              {t('subtitle') || 'Let AI-Generated Electricity Turn into Your Real Yield'}
            </p>
            <p className="text-lg text-white/70 mt-4">
              {t('description') || "In 2025, U.S. AI Power ETFs delivered > 48% annualized returns. Now, for the first time, you can own the source — real AI power nodes tokenized on-chain."}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation direction="bottom" delay={200}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/20">
            <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-6 sm:mb-8">{t('yieldLoop') || 'The Yield Loop'}</h3>
            
            {/* Animated Loop Diagram */}
            <div className="relative">
              {/* Desktop: Circular/Flow Layout */}
              <div className="hidden lg:flex flex-wrap justify-center items-center gap-3 xl:gap-6">
                {yieldSteps.map((step, index) => {
                  const isActive = index === currentStep;
                  const isNext = index === (currentStep + 1) % yieldSteps.length;
                  
                  return (
                    <div key={index} className="flex items-center">
                      <div
                        className={`
                          relative w-20 h-20 xl:w-24 xl:h-24 rounded-full p-3 xl:p-4
                          bg-gradient-to-br from-blue-500 to-blue-600
                          flex flex-col items-center justify-center
                          border-2 ${isActive ? 'border-white shadow-lg shadow-white/50 scale-110' : 'border-white/30'}
                          transition-all duration-500
                          ${isNext ? 'opacity-80' : isActive ? 'opacity-100' : 'opacity-60'}
                        `}
                      >
                        <step.Icon className="w-5 h-5 xl:w-6 xl:h-6 mb-1 text-white shrink-0" />
                        <span className="text-[10px] xl:text-xs font-bold text-white text-center px-0.5 leading-tight break-words">
                          {step.label}
                        </span>
                        {isActive && (
                          <div className="absolute -top-2 -right-2 w-3 h-3 xl:w-4 xl:h-4 bg-white rounded-full animate-ping"></div>
                        )}
                      </div>
                      {index < yieldSteps.length - 1 && (
                        <div className={`
                          w-4 xl:w-6 h-1 mx-1 xl:mx-2
                          ${isActive || isNext ? 'bg-white' : 'bg-white/20'}
                          transition-all duration-500
                        `}></div>
                      )}
                      {index === yieldSteps.length - 1 && (
                        <div className="w-4 xl:w-6 h-1 mx-1 xl:mx-2 bg-white animate-pulse"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tablet: Compact Horizontal Flow */}
              <div className="hidden md:flex lg:hidden flex-wrap justify-center items-center gap-2">
                {yieldSteps.map((step, index) => {
                  const isActive = index === currentStep;
                  const isNext = index === (currentStep + 1) % yieldSteps.length;
                  
                  return (
                    <div key={index} className="flex items-center">
                      <div
                        className={`
                          relative w-16 h-16 rounded-full p-2
                          bg-gradient-to-br from-blue-500 to-blue-600
                          flex flex-col items-center justify-center
                          border-2 ${isActive ? 'border-white shadow-lg shadow-white/50 scale-110' : 'border-white/30'}
                          transition-all duration-500
                          ${isNext ? 'opacity-80' : isActive ? 'opacity-100' : 'opacity-60'}
                        `}
                      >
                        <step.Icon className="w-4 h-4 mb-0.5 text-white shrink-0" />
                        <span className="text-[9px] font-bold text-white text-center px-0.5 leading-tight break-words">
                          {step.label}
                        </span>
                        {isActive && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>
                        )}
                      </div>
                      {index < yieldSteps.length - 1 && (
                        <div className={`
                          w-3 h-1 mx-1
                          ${isActive || isNext ? 'bg-white' : 'bg-white/20'}
                          transition-all duration-500
                        `}></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: Card-based Layout */}
              <div className="md:hidden">
                <div className="space-y-3">
                  {yieldSteps.map((step, index) => {
                    const isActive = index === currentStep;
                    const isNext = index === (currentStep + 1) % yieldSteps.length;
                    return (
                      <div key={index} className="relative">
                        <div
                          className={`
                            bg-white/10 backdrop-blur-sm rounded-xl p-4 border-2
                            ${isActive ? 'border-white shadow-lg shadow-white/50 bg-white/20' : 'border-white/20'}
                            transition-all duration-500
                            ${isNext ? 'opacity-90' : isActive ? 'opacity-100' : 'opacity-70'}
                            flex items-center gap-4
                          `}
                        >
                          <div
                            className={`
                              w-16 h-16 rounded-full shrink-0
                              bg-gradient-to-br from-blue-500 to-blue-600
                              flex items-center justify-center
                              border-2 ${isActive ? 'border-white shadow-md' : 'border-white/30'}
                              transition-all duration-500
                            `}
                          >
                            <step.Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-base font-bold text-white ${isActive ? 'text-lg' : ''} transition-all duration-500`}>
                              {step.label}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`
                                h-1 flex-1 rounded-full
                                ${isActive ? 'bg-white' : 'bg-white/30'}
                                transition-all duration-500
                              `}></div>
                              <span className="text-xs text-white/60">
                                {index + 1} / {yieldSteps.length}
                              </span>
                            </div>
                          </div>
                          {isActive && (
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full animate-ping"></div>
                          )}
                        </div>
                        {index < yieldSteps.length - 1 && (
                          <div className="flex justify-center my-1">
                            <div className={`
                              h-4 w-0.5
                              ${isActive || isNext ? 'bg-white/60' : 'bg-white/20'}
                              transition-all duration-500
                            `}></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

