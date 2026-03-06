'use client';

import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { CountdownSection } from '@/components/CountdownSection';
import { RealAssetSection } from '@/components/RealAssetSection';
import { InstitutionalProofSection } from '@/components/InstitutionalProofSection';
import { AIYieldSection } from '@/components/AIYieldSection';
import { CommunitySection } from '@/components/CommunitySection';
import { RoadmapSection } from '@/components/RoadmapSection';
import { InfoSection } from '@/components/InfoSection';
import { AboutSection } from '@/components/AboutSection';
import { NewsSection } from '@/components/NewsSection';
import { MediaTestimonials } from '@/components/MediaTestimonials';
import { FAQSection } from '@/components/FAQSection';
import { NewsletterSection } from '@/components/NewsletterSection';
import { Footer } from '@/components/Footer';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative">
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
          opacity: 0.7
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
          opacity: 0.7
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
          opacity: 0.7
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
          opacity: 0.7
        }}>
      </div>
      
      <div className="relative" style={{ zIndex: 1 }}>
        <Header />
      {/* Section 1: Hero Section */}
      <HeroSection />
      
      {/* Section 2: Countdown Section */}
      <CountdownSection />
      
      {/* Section 3: Real Asset Foundation (DePIN Proof) */}
      <RealAssetSection />
      
      {/* Section 3: Institutional Proof + Financial Transparency */}
      <InstitutionalProofSection />
      
      {/* Section 4: AI Power Yield Loop */}
      <AIYieldSection />
      
      {/* Section 5: Community & Social Proof */}
      <CommunitySection />
      
      
      {/* Existing Sections */}
      <InfoSection />
      <AboutSection />
        {/* Section 6: Roadmap + Listing Timeline */}
        <RoadmapSection />

      <NewsSection />
      <MediaTestimonials />
      <FAQSection />
      <NewsletterSection />
      <DisclaimerBanner variant="bottom" />
      <Footer />
      </div>
    </div>
  );
}
