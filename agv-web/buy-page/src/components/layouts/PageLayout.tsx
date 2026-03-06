'use client';

import { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StickyDisclaimer } from '@/components/StickyDisclaimer';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

interface PageLayoutProps {
  children: ReactNode;
  showStickyDisclaimer?: boolean;
  showDisclaimerBanner?: boolean;
  disclaimerVariant?: 'top' | 'bottom';
  className?: string;
}

export function PageLayout({
  children,
  showStickyDisclaimer = false,
  showDisclaimerBanner = false,
  disclaimerVariant = 'bottom',
  className = '',
}: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-black relative ${className}`}>
      {/* Global Gradient Overlays - Spanning across sections */}
      {/* Top Center Gradient */}
      <div 
        className="fixed pointer-events-none" 
        style={{ 
          top: '0px',
          left: '50%',
          width: '3000px',
          height: '3000px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(59,130,246,0.6) 12%, rgba(59,130,246,0.4) 25%, rgba(59,130,246,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 85%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          opacity: 0.01
        }}>
      </div>
      
      {/* Middle Right Gradient */}
      <div 
        className="fixed pointer-events-none" 
        style={{ 
          top: '50%',
          right: '0px',
          width: '3000px',
          height: '3000px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(59,130,246,0.6) 12%, rgba(59,130,246,0.4) 25%, rgba(59,130,246,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 85%)',
          transform: 'translate(50%, -50%)',
          zIndex: 0,
          opacity: 0.02
        }}>
      </div>
      
      {/* Middle Left Gradient */}
      <div 
        className="fixed pointer-events-none" 
        style={{ 
          top: '50%',
          left: '0px',
          width: '3000px',
          height: '3000px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(59,130,246,0.6) 12%, rgba(59,130,246,0.4) 25%, rgba(59,130,246,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 85%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          opacity: 0.05
        }}>
      </div>
      
      {/* Bottom Center Gradient */}
      <div 
        className="fixed pointer-events-none" 
        style={{ 
          bottom: '0px',
          left: '50%',
          width: '3000px',
          height: '3000px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(59,130,246,0.6) 12%, rgba(59,130,246,0.4) 25%, rgba(59,130,246,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 85%)',
          transform: 'translate(-50%, 50%)',
          zIndex: 0,
          opacity: 0.09
        }}>
      </div>
      
      <div className="relative" style={{ zIndex: 1 }}>
        {showStickyDisclaimer && <StickyDisclaimer variant="top" />}
        <Header />
        {children}
        {showDisclaimerBanner && <DisclaimerBanner variant={disclaimerVariant} />}
        <Footer />
      </div>
    </div>
  );
}

