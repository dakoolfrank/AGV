'use client';

import { ReactNode } from 'react';
import { ScrollAnimation } from '@/components/ScrollAnimation';
import { GlowEffect } from './GlowEffect';

interface SectionWrapperProps {
  children: ReactNode;
  className?: string;
  id?: string;
  glowEffect?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
    width?: string;
    height?: string;
    blur?: string;
    opacity?: number;
    transform?: string;
  };
  scrollAnimation?: {
    direction?: 'left' | 'right' | 'top' | 'bottom' | 'scale' | 'rotate';
    delay?: number;
  };
}

export function SectionWrapper({
  children,
  className = '',
  id,
  glowEffect,
  scrollAnimation
}: SectionWrapperProps) {
  return (
    <section id={id} className={`py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black ${className}`}>
      {glowEffect && (
        <GlowEffect
          top={glowEffect.top}
          right={glowEffect.right}
          bottom={glowEffect.bottom}
          left={glowEffect.left}
          width={glowEffect.width || '650px'}
          height={glowEffect.height || '650px'}
          blur={glowEffect.blur || '90px'}
          opacity={glowEffect.opacity || 0.9}
          transform={glowEffect.transform}
        />
      )}
      <div className="max-w-7xl mx-auto relative z-10">
        {scrollAnimation ? (
          <ScrollAnimation
            direction={scrollAnimation.direction || 'bottom'}
            delay={scrollAnimation.delay || 0}
          >
            {children}
          </ScrollAnimation>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

