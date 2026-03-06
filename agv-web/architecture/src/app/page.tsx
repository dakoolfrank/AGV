'use client';

import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { OneChainSection } from '@/components/OneChainSection';
import { TwoTokenArchitectureSection } from '@/components/TwoTokenArchitectureSection';
import { LiquidityStrategySection } from '@/components/LiquidityStrategySection';
import { VestingSection } from '@/components/VestingSection';
import { SecuritySection } from '@/components/SecuritySection';
import { BuiltForNextSection } from '@/components/BuiltForNextSection';
import { TokenConversionDiagramSection } from '@/components/TokenConversionDiagramSection';
import { Footer } from '@/components/Footer';
import { GradientOverlays } from '@/components/ui/GradientOverlays';

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative">
      <GradientOverlays />
      
      <div className="relative" style={{ zIndex: 1 }}>
        <Header />
        <HeroSection />
        <OneChainSection />
        <TwoTokenArchitectureSection />
        <LiquidityStrategySection />
        <VestingSection />
        <SecuritySection />
        <BuiltForNextSection />
        <TokenConversionDiagramSection />
        <Footer />
      </div>
    </div>
  );
}
