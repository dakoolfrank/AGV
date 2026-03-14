"use client";
import React from "react";
import { useTranslations } from './TranslationProvider';
import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { Footer } from "@/components/landing/Footer";
import Image from "next/image"; 
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  ArrowRight,
  Shield,
  BookOpen,
  Building2
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const t = useTranslations('home');
  
  const valuePillars = [
    {
      title: t('valuePillars.educate.title'),
      description: t('valuePillars.educate.description'),
      icon: <BookOpen className="h-8 w-8" />,
      color: "bg-blue-500"
    },
    {
      title: t('valuePillars.growth.title'),
      description: t('valuePillars.growth.description'),
      icon: <TrendingUp className="h-8 w-8" />,
      color: "bg-green-500"
    },
    {
      title: t('valuePillars.institutional.title'),
      description: t('valuePillars.institutional.description'),
      icon: <Building2 className="h-8 w-8" />,
      color: "bg-purple-500"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <HeroSection />

      {/* Mission Statement */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-6">
              {t('mission.title')}
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <p className="text-xl text-primary leading-relaxed">
                {t('mission.subtitle')}
              </p>
              <p className="text-lg text-primary/80 leading-relaxed">
                {t('mission.description')}
              </p>
              <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {t('mission.role.title')}
                </h3>
                <p className="text-primary/80">
                  {t('mission.role.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition - 3 Pillars */}
      <section className="pb-16 pt-0 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('valueProposition.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('valueProposition.description')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {valuePillars.map((pillar, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow border-2 hover:border-gray-300">
                <CardHeader>
                  <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-white">
                      {pillar.icon}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-primary">{pillar.title}</CardTitle>
                  <CardDescription className="text-base text-primary/80">{pillar.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* A Call to Responsibility */}
      <section className="py-8 bg-white">
        {/* Horizontal Line */}
        <div className="w-[85%] h-px bg-primary mx-auto mb-16"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-32 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold text-primary">
                  {t('responsibility.title')}
                </h2>
                
                <div className="space-y-4">
                  <p className="text-lg text-primary leading-relaxed">
                    {t('responsibility.subtitle')}
                  </p>
                  <p className="text-lg text-primary leading-relaxed">
                    {t('responsibility.description')}
                  </p>
                </div>
              </div>

              {/* Bulleted List - Two Columns */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-primary mb-1 text-xl">{t('responsibility.points.wallStreet.title')}</h3>
                      <p className="text-primary text-sm">{t('responsibility.points.wallStreet.description')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-primary mb-1 text-xl">{t('responsibility.points.tokenization.title')}</h3>
                      <p className="text-primary text-sm">{t('responsibility.points.tokenization.description')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-xl text-[#223256] mb-1">{t('responsibility.points.regulatory.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('responsibility.points.regulatory.description')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-[#223256] mb-1 text-xl">{t('responsibility.points.demand.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('responsibility.points.demand.description')}</p>
                    </div>
                  </div>
                </div>
              </div>
              </div>
           

            {/* Right Column - Visual Content */}
            <div className="relative">
              <div 
                className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden"
                style={{
                  backgroundImage: 'url(/responsibility.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
              </div>
            </div>
          </div>
        </div>
        {/* Horizontal Line */}
        <div className="w-[80%] h-px bg-primary mx-auto mt-16"></div>
      </section>

      {/* Why institutions can't ignore this */}
      <section className="py-8 bg-white">
       <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-32 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold text-[#223256]">
                  {t('institutions.title')}
                </h2>
                
                <div className="space-y-4">
                  <p className="text-lg text-[#223256] leading-relaxed">
                    {t('institutions.subtitle')}
                  </p>
                </div>
              </div>

              {/* Bulleted List - Two Columns */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-[#223256] mb-1 text-xl">{t('institutions.points.compliance.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('institutions.points.compliance.description')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-[#223256] mb-1 text-xl">{t('institutions.points.voice.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('institutions.points.voice.description')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-xl text-[#223256]">{t('institutions.points.marketing.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('institutions.points.marketing.description')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#223256] rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-bold text-[#223256] mb-1 text-xl">{t('institutions.points.proof.title')}</h3>
                      <p className="text-[#223256] text-sm">{t('institutions.points.proof.description')}</p>
                    </div>
                  </div>
                </div>
              </div>
              </div>
           

            {/* Right Column - Visual Content */}
            <div className="relative">
              <div 
                className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden"
                style={{
                  backgroundImage: 'url(/blockchain-innovation.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
              </div>
            </div>
          </div>
        </div>
        {/* Horizontal Line */}
        <div className="w-[80%] h-px bg-[#223256] mx-auto mt-16"></div>
      </section>

      {/* The Mission of the G3 Fund */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Section Header */}
          <div className="text-center mb-8 lg:mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-4 lg:mb-6">
              {t('g3Mission.title')}
            </h2>
            <p className="text-lg lg:text-xl text-[#223256]/80 max-w-4xl mx-auto leading-relaxed">
              {t('g3Mission.subtitle')}
            </p>
          </div>

          {/* Mission Points - 3 Column Layout - Desktop */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Responsible Influence */}
              <div className="text-right space-y-3">
                <div className="flex items-center justify-end space-x-3">
                  <div>
                    <h3 className="text-xl font-bold text-[#223256]">{t('g3Mission.points.influence.title')}</h3>
                    <p className="text-[#223256]/80 leading-relaxed text-sm">
                      {t('g3Mission.points.influence.description')}
                    </p>
                  </div>
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                </div>
              </div>

              {/* Education Network */}
              <div className="text-right space-y-3">
                <div className="flex items-center justify-end space-x-3">
                  <div>
                    <h3 className="text-xl font-bold text-[#223256]">{t('g3Mission.points.education.title')}</h3>
                    <p className="text-[#223256]/80 leading-relaxed text-sm">
                      {t('g3Mission.points.education.description')}
                    </p>
                  </div>
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                </div>
              </div>
            </div>

            {/* Middle Column - Image + Bottom Element */}
            <div className="space-y-8">
              {/* Central Image */}
              <div className="flex justify-center">
                <Image src="/icons/mission.png" alt="G3 Fund Mission" width={300} height={300}  />
              </div>

              {/* Global RWA Incubation - Below Image */}
              <div className="text-center space-y-3">
                <div className="w-3 h-3 bg-[#223256] rounded-full mx-auto"></div>
                <h3 className="text-xl font-bold text-[#223256]">{t('g3Mission.points.incubation.title')}</h3>
                <p className="text-[#223256]/80 leading-relaxed text-sm">
                  {t('g3Mission.points.incubation.description')}
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Verifiable Growth */}
              <div className="text-left space-y-3">
                <div className="flex items-center justify-start space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <div>
                    <h3 className="text-xl font-bold text-[#223256]">{t('g3Mission.points.growth.title')}</h3>
                    <p className="text-[#223256]/80 leading-relaxed text-sm">
                      {t('g3Mission.points.growth.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Community Transformation */}
              <div className="text-left space-y-3">
                <div className="flex items-center justify-start space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <div>
                    <h3 className="text-xl font-bold text-[#223256]">{t('g3Mission.points.community.title')}</h3>
                    <p className="text-[#223256]/80 leading-relaxed text-sm">
                      {t('g3Mission.points.community.description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden space-y-8">
            {/* Central Image */}
            <div className="flex justify-center mb-8">
              <Image src="/icons/mission.png" alt="G3 Fund Mission" width={250} height={250} />
            </div>

            {/* Mission Points - Stacked */}
            <div className="space-y-6">
              {/* Responsible Influence */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <h3 className="text-lg font-bold text-[#223256]">{t('g3Mission.points.influence.title')}</h3>
                </div>
                <p className="text-[#223256]/80 leading-relaxed text-sm max-w-md mx-auto">
                  {t('g3Mission.points.influence.description')}
                </p>
              </div>

              {/* Education Network */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <h3 className="text-lg font-bold text-[#223256]">{t('g3Mission.points.education.title')}</h3>
                </div>
                <p className="text-[#223256]/80 leading-relaxed text-sm max-w-md mx-auto">
                  {t('g3Mission.points.education.description')}
                </p>
              </div>

              {/* Verifiable Growth */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <h3 className="text-lg font-bold text-[#223256]">{t('g3Mission.points.growth.title')}</h3>
                </div>
                <p className="text-[#223256]/80 leading-relaxed text-sm max-w-md mx-auto">
                  {t('g3Mission.points.growth.description')}
                </p>
              </div>

              {/* Community Transformation */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <h3 className="text-lg font-bold text-[#223256]">{t('g3Mission.points.community.title')}</h3>
                </div>
                <p className="text-[#223256]/80 leading-relaxed text-sm max-w-md mx-auto">
                  {t('g3Mission.points.community.description')}
                </p>
              </div>

              {/* Global RWA Incubation */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-[#223256] rounded-full flex-shrink-0"></div>
                  <h3 className="text-lg font-bold text-[#223256]">{t('g3Mission.points.incubation.title')}</h3>
                </div>
                <p className="text-[#223256]/80 leading-relaxed text-sm max-w-md mx-auto">
                  {t('g3Mission.points.incubation.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operating Principles & Participants */}
      <section className="py-20 bg-[#223256] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Our Operating Principles */}
          <div className="mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-12 text-center">
              {t('operatingPrinciples.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Dual Pathways */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/dual-pathway.png" alt="Dual Pathways" width={50} height={50} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('operatingPrinciples.dualPathways.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('operatingPrinciples.dualPathways.description')}
                </p>
              </div>

              {/* Transparency & Compliance */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/compliance.png" alt="Dual Pathways" width={50} height={50} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('operatingPrinciples.compliance.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('operatingPrinciples.compliance.description')}
                </p>
              </div>

              {/* Incentive & Value-Binding */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/incentive.png" alt="Dual Pathways" width={40} height={40} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('operatingPrinciples.incentive.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('operatingPrinciples.incentive.description')}
                </p>
              </div>

              {/* No One Left Behind */}
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/no-one.png" alt="Dual Pathways" width={40} height={40} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('operatingPrinciples.noOneLeft.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('operatingPrinciples.noOneLeft.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Current Participants */}
          <div className="mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-12 text-center">
              {t('participants.title')}
            </h2>
            <div className="flex flex-wrap justify-center gap-8 max-w-5xl mx-auto">
              {/* Technology Partners */}
              <div className="text-center space-y-4 w-full sm:w-auto sm:min-w-[200px]">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                 <Image src="/icons/technology.png" alt="Dual Pathways" width={40} height={40} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('participants.technology.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('participants.technology.description')}
                </p>
              </div>

              {/* Governance */}
              <div className="text-center space-y-4 w-full sm:w-auto sm:min-w-[200px]">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/governance.png" alt="Dual Pathways" width={40} height={40} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('participants.governance.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('participants.governance.description')}
                </p>
              </div>

              {/* AGV NEXRUR */}
              <div className="text-center space-y-4 w-full sm:w-auto sm:min-w-[200px]">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/agv.png" alt="Dual Pathways" width={30} height={0} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('participants.agv.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('participants.agv.description')}
                </p>
              </div>

              {/* Community Builders */}
              <div className="text-center space-y-4 w-full sm:w-auto sm:min-w-[200px]">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/community.png" alt="Dual Pathways" width={40} height={40} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('participants.community.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('participants.community.description')}
                </p>
              </div>

              {/* Asset Partners */}
              <div className="text-center space-y-4 w-full sm:w-auto sm:min-w-[200px]">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Image src="/icons/assets.png" alt="Dual Pathways" width={50} height={50} />
                </div>
                <h3 className="text-xl font-bold text-white">{t('participants.assets.title')}</h3>
                <p className="text-white/90 leading-relaxed">
                  {t('participants.assets.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Strategic Expansion */}
          <div className="mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-12 text-center">
              {t('expansion.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {/* Global Green Funds */}
              <div className="bg-white rounded-2xl p-6 text-center">
                <h3 className="text-xl font-bold text-[#223256] mb-3">{t('expansion.greenFunds.title')}</h3>
                <p className="text-[#223256]/80 leading-relaxed">
                  {t('expansion.greenFunds.description')}
                </p>
              </div>

              {/* International Exchanges */}
              <div className="bg-white rounded-2xl p-6 text-center">
                <h3 className="text-xl font-bold text-[#223256] mb-3">{t('expansion.exchanges.title')}</h3>
                <p className="text-[#223256]/80 leading-relaxed">
                  {t('expansion.exchanges.description')}
                </p>
              </div>

              {/* More RWA Projects */}
              <div className="bg-white rounded-2xl p-6 text-center">
                <h3 className="text-xl font-bold text-[#223256] mb-3">{t('expansion.projects.title')}</h3>
                <p className="text-[#223256]/80 leading-relaxed">
                  {t('expansion.projects.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="text-center">
            <p className="text-xl text-white/90 leading-relaxed">
              {t('expansion.footer')}
            </p>
          </div>
        </div>
      </section>

      {/* How Institutions Can Join */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-4xl sm:text-5xl font-bold text-[#223256] mb-16 text-center">
            {t('institutionsJoin.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {/* Advocacy Partner */}
            <div className="text-center space-y-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto relative">
                <Image src="/icons/advocacy.png" alt="Dual Pathways" width={40} height={40} />
              </div>
              <h3 className="text-2xl font-bold text-[#223256]">{t('institutionsJoin.advocacy.title')}</h3>
              <p className="text-[#223256]/80 leading-relaxed text-lg">
                {t('institutionsJoin.advocacy.description')}
              </p>
            </div>

            {/* Financial Support */}
            <div className="text-center space-y-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto">
                <Image src="/icons/financial.png" alt="Dual Pathways" width={50} height={50} />
              </div>
              <h3 className="text-2xl font-bold text-[#223256]">{t('institutionsJoin.financial.title')}</h3>
              <p className="text-[#223256]/80 leading-relaxed text-lg">
                {t('institutionsJoin.financial.description')}
              </p>
            </div>

            {/* Token Contribution */}
            <div className="text-center space-y-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto relative">
                <Image src="/icons/token.png" alt="Dual Pathways" width={50} height={50} />
              </div>
              <h3 className="text-2xl font-bold text-[#223256]">{t('institutionsJoin.token.title')}</h3>
              <p className="text-[#223256]/80 leading-relaxed text-lg">
                {t('institutionsJoin.token.description')}
              </p>
            </div>

            {/* Strategic Partner */}
            <div className="text-center space-y-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto">
                <Image src="/icons/strategic.png" alt="Dual Pathways" width={50} height={50} />
              </div>
              <h3 className="text-2xl font-bold text-[#223256]">{t('institutionsJoin.strategic.title')}</h3>
              <p className="text-[#223256]/80 leading-relaxed text-lg">
                {t('institutionsJoin.strategic.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Institutions Gain */}
      <section className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-8 sm:mb-16 text-center">
            {t('institutionsGain.title')}
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
            <div className="lg:order-2 flex justify-center">
              <Image 
                src="/institution-gain.png" 
                alt="Institution Benefits" 
                width={1000} 
                height={1000}
                className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-none"
              />
            </div>

            <div className="lg:order-1 space-y-6 sm:space-y-8 text-center lg:text-end">
              {/* Row 1 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-[#223256]">{t('institutionsGain.left.userGrowth.title')}</h3>
                <p className="text-sm sm:text-base text-[#223256]/80 leading-relaxed">
                  {t('institutionsGain.left.userGrowth.description')}
                </p>
              </div>
              
              {/* Row 2 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-[#223256]">{t('institutionsGain.left.resourceAccess.title')}</h3>
                <p className="text-sm sm:text-base text-[#223256]/80 leading-relaxed">
                  {t('institutionsGain.left.resourceAccess.description')}
                </p>
              </div>
            </div>

            {/* Right Column - 3 rows */}
            <div className="lg:order-3 space-y-6 sm:space-y-8 text-center lg:text-start">
              {/* Row 1 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-[#223256]">{t('institutionsGain.right.education.title')}</h3>
                <p className="text-sm sm:text-base text-[#223256]/80 leading-relaxed">
                  {t('institutionsGain.right.education.description')}
                </p>
              </div>
              
              {/* Row 2 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-[#223256]">{t('institutionsGain.right.brand.title')}</h3>
                <p className="text-sm sm:text-base text-[#223256]/80 leading-relaxed">
                  {t('institutionsGain.right.brand.description')}
                </p>
              </div>
              
              {/* Row 3 */}
              <div className="space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-[#223256]">{t('institutionsGain.right.leverage.title')}</h3>
                <p className="text-sm sm:text-base text-[#223256]/80 leading-relaxed">
                  {t('institutionsGain.right.leverage.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership or Abdication */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-4xl sm:text-5xl font-bold text-primary mb-12 text-center">
            {t('leadership.title')}
          </h2>
          
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <p className="text-xl text-primary leading-relaxed">
              {t('leadership.subtitle')}
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              {/* Transform Contributors */}
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-3 h-3 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-primary mb-2">{t('leadership.points.transform.title')}</h3>
                    <p className="text-primary/80 leading-relaxed">
                      {t('leadership.points.transform.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Align Voices */}
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-3 h-3 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-primary mb-2">{t('leadership.points.align.title')}</h3>
                    <p className="text-primary/80 leading-relaxed">
                      {t('leadership.points.align.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Enable Action */}
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-3 h-3 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-primary mb-2">{t('leadership.points.enable.title')}</h3>
                    <p className="text-primary/80 leading-relaxed">
                      {t('leadership.points.enable.description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-white space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold">
              {t('cta.title')}
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              {t('cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Link href="/community">
                <Button size="lg" variant="outline">
                  {t('cta.contributor')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/institutions">
                <Button size="lg" variant="outline">
                  {t('cta.institution')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="py-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-2">{t('compliance.title')}</h3>
                <p className="text-primary/80 text-sm">
                  {t('compliance.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
