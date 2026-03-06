import React from "react";
import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { MainContent } from "@/components/landing/MainContent";
import { WhatIsAGV } from "@/components/landing/WhatIsAGV";
import { WhyAGV } from "@/components/landing/WhyAGV";
import { Fixing } from "@/components/landing/Fixing";
import { ExploreAGV } from "@/components/landing/ExploreAGV";
import { BlockchainInfrastructure } from "@/components/landing/BlockchainInfrastructure";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { Footer } from "@/components/landing/Footer";
import { WhatWeBuilding } from "@/components/landing/WhatWeBuilding";
import { HowWeDiffer } from "@/components/landing/HowWeDiffer";
import { ExecutionProofs } from "@/components/landing/ExecutionProofs";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <Header />
      
      {/* Hero Section */}
      <HeroSection />
      
      {/* Main Content */}
      <MainContent />
      
      {/* What Is AGV */}
      <WhatIsAGV />

      {/* Three Layer */}
      <WhatWeBuilding />

      {/* How We Differ */}
      <HowWeDiffer />

      {/* Execution Proofs */}
      <ExecutionProofs />

      {/* Blockchain Infrastructure */}
      <BlockchainInfrastructure />
      
      {/* Fixing Section */}
      <Fixing />
      
      {/* Explore AGV */}
      <ExploreAGV />
      
      
      
      {/* Testimonials */}
      <TestimonialsSection />
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
