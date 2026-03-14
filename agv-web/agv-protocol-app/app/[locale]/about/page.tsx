"use client";
import React from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ValueCard } from "@/components/landing/ValueCard";
import { useTranslations } from "@/hooks/useTranslations";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Zap, TreePine, Cpu, Shield } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
  const { t } = useTranslations();

  // What We Build data
  const whatWeBuild = [
    {
      icon: <Zap className="w-6 h-6 text-[#223256]" />,
      title: t('about.whatWeBuild.cleanEnergy.title') || "Clean Energy Assets",
      description: t('about.whatWeBuild.cleanEnergy.description') || "6 MWp CdTe PV plant (first batch) with projected annual output of 7.3 GWh. Additional solar units are under development."
    },
    {
      icon: <TreePine className="w-6 h-6 text-[#223256]" />,
      title: t('about.whatWeBuild.orchards.title') || "Productive Orchards",
      description: t('about.whatWeBuild.orchards.description') || "~100 000 kg apples per 100 mu per year, integrated into NFT revenue streams and monitored via IoT sensors."
    },
    {
      icon: <Cpu className="w-6 h-6 text-[#223256]" />,
      title: t('about.whatWeBuild.compute.title') || "Edge Compute Mini-Grids",
      description: t('about.whatWeBuild.compute.description') || "Initial 1.5 MW cluster (~1 PFLOPS) delivering ~1.31 GWh/year of compute load to AI workloads; additional nodes are scheduled for deployment."
    },
    {
      icon: <Shield className="w-6 h-6 text-[#223256]" />,
      title: t('about.whatWeBuild.verification.title') || "IoT Verification & On-Chain Attestation",
      description: t('about.whatWeBuild.verification.description') || "Every watt of electricity and cycle of compute is verified and anchored on-chain before tokens are minted (Power-to-Mint). This ensures accountability and transparency."
    }
  ];

  // How It Works data
  const howItWorks = [
    {
      icon: <FileText className="w-6 h-6 text-[#223256]" />,
      title: t('about.howItWorks.acquire.title') || "Acquire & Integrate",
      description: t('about.howItWorks.acquire.description') || "AGV acquires or partners with orchards, solar farms and compute clusters, installing IoT sensors and secure telemetry."
    },
    {
      icon: <Shield className="w-6 h-6 text-[#223256]" />,
      title: t('about.howItWorks.verify.title') || "Verify",
      description: t('about.howItWorks.verify.description') || "Energy and compute output data is collected in real-time, validated by auditors and anchored on-chain."
    },
    {
      icon: <Zap className="w-6 h-6 text-[#223256]" />,
      title: t('about.howItWorks.mint.title') || "Mint",
      description: t('about.howItWorks.mint.description') || "Tokens are minted only after output is verified. GVT is minted from verified yield; rGGP is distributed as a merit-based incentive and can be converted to GVT. Investors see exactly how much real-world output backs each token."
    }
  ];

  // Core Team data
  const coreTeam = [
    {
      icon: "/icons/teams/gd.svg",
      title: t('about.team.susan.name') || "Susan",
      description: t('about.team.susan.role') || "General Director"
    },
    {
      icon: "/icons/teams/cto.svg",
      title: t('about.team.tyler.name') || "Tyler",
      description: t('about.team.tyler.role') || "Chief Technology Officer (CTO)"
    },
    {
      icon: "/icons/teams/techLead.svg",
      title: t('about.team.yasir.name') || "Yasir",
      description: t('about.team.yasir.role') || "Tech Lead"
    },
    {
      icon: "/icons/teams/dao.svg",
      title: t('about.team.winnie.name') || "Winnie",
      description: t('about.team.winnie.role') || "Capital/DAO Lead"
    },
    {
      icon: "/icons/teams/bdl.svg",
      title: t('about.team.yatogami.name') || "Yatogami",
      description: t('about.team.yatogami.role') || "Business Development Lead"
    },
    {
      icon: "/icons/teams/marketting.svg",
      title: t('about.team.frank.name') || "Frank",
      description: t('about.team.frank.role') || "Marketing & PR"
    }
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Left semicircle */}
        <div className="absolute top-[70pc] left-0 w-[1000px] h-[1000px] bg-[#223256]/10 rounded-full -translate-x-[600px] -translate-y-[600px]"></div>
        {/* Right semicircle */}
        <div className="absolute top-[100pc] right-0 w-[1000px] h-[1000px] bg-[#223256]/10 rounded-full translate-x-[500px] -translate-y-[500px]"></div>
      </div>
      
      {/* Header */}
      <Header />
      
      {/* Hero Section */}
      <section className="relative min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/solarPanel.png"
            alt="About Us Hero Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 h-full min-h-[400px] sm:min-h-[500px] lg:min-h-[600px] flex items-end justify-start pb-8 sm:pb-12">
            <div className="text-white space-y-3 sm:space-y-4 text-left">
                <h1 className="text-5xl font-bold leading-tight">
                    {t('about.hero.title') || 'REAL ENERGY. REAL YIELD.'}
                </h1>
                      <h1 className="text-5xl text-[#4FACFE] font-bold leading-tight">
                    {t('about.hero.subtitle') || 'REAL ASSETS — ON-CHAIN.'}
                </h1>
            </div>
        </div>        
      </section>

      {/* Mission Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-16">
            {/* Mission Card */}
            <div className="w-full lg:w-1/2">
              <div className=" backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 relative">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#223256] mb-4 uppercase">
                  {t('about.mission.title') || 'MISSION'}
                </h2>
                <p className="text-[#223256] text-sm sm:text-base leading-relaxed">
                  {t('about.mission.description') || 'Our mission is to make electricity and compute investable for everyone by turning verified real-world output into transparent, on-chain assets.'}
                </p>
              </div>
            </div>

            {/* Dotted Line */}
            <div className="hidden lg:block w-16 h-px bg-gray-300 mt-8">
              <div className="w-full h-full border-t-2 border-dotted border-gray-400"></div>
            </div>

            {/* Our Story Card */}
            <div className="w-full lg:w-1/2">
              <div className=" backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 relative">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#223256] mb-4 uppercase">
                  {t('about.story.title') || 'OUR STORY'}
                </h2>
                <p className="text-[#223256] text-sm sm:text-base leading-relaxed">
                  {t('about.story.description') || 'In an AI-powered era, electricity and compute demand is growing exponentially. AGV NEXRUR addresses this by pairing orchards, solar farms, and edge compute mini-grids with IoT telemetry and on-chain verification to create sustainable, yield-backed tokens. Our initial assets are in Shaanxi, China, with expansion plans across Asia and beyond.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Build Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#223256] mb-4 uppercase">
              {t('about.whatWeBuild.title') || 'WHAT WE BUILD'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-4 gap-6 sm:gap-8">
            {whatWeBuild.map((item, index) => (
              <div key={index} className=" backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between space-x-4 flex-col gap-10">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#223256]/10 rounded-full flex items-center justify-center">
                    <div className="text-[#223256]">
                      {item.icon}
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <h3 className="text-lg sm:text-xl font-bold text-[#223256] mb-2">
                      {item.title}
                    </h3>
                    <p className="text-[#223256] text-sm sm:text-base leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#223256] mb-4 uppercase">
              {t('about.howItWorks.title') || 'HOW IT WORKS - POWER-TO-MINT'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className=" backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-[#223256]/10 rounded-lg flex items-center justify-center">
                    <div className="text-[#223256]">
                      {step.icon}
                    </div>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#223256] mb-3">
                  {step.title}
                </h3>
                <p className="text-[#223256] text-sm sm:text-base leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Team Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#223256] mb-4 uppercase">
              {t('about.team.title') || 'CORE TEAM MEMBERS'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {coreTeam.map((member, index) => (
              <ValueCard
                key={index}
                icon={member.icon}
                title={member.title}
                description={member.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="px-4 sm:px-6 text-center">
          <div className=" backdrop-blur-sm rounded-2xl p-8 sm:p-12 border border-gray-100">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#223256] mb-6">
              {t('about.cta.title') || 'Join us in building a sustainable, tokenized future.'}
            </h2>
            <Button
              size="lg"
              className="bg-[#4FACFE] hover:bg-[#223256]/90 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center space-x-2 mx-auto transition-all duration-300"
              onClick={() => window.open('https://drive.google.com/file/d/1C6Awj0-rDYUE3xzbEW_umCRWod-HUhwB/view', '_blank')}
            >
              <span>{t('about.cta.button') || 'Read Whitepaper'}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
