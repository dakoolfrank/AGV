'use client';

import React from "react";
import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "../TranslationProvider";
import { GlobalMintCounter } from "@/components/kol/GlobalMintCounter";
import { 
  Users, 
  TrendingUp, 
  Target,
  ArrowRight,
  CheckCircle,
  Star,
  Globe,
  BarChart3,
  UserCheck,
  Crown,
  Rocket,
} from "lucide-react";

export default function CommunityPage() {
  const t = useTranslations('community');
  
  const socialMiningTiers = [
    {
      step: 1,
      title: t('socialMiningTiers.pioneer.title'),
      description: t('socialMiningTiers.pioneer.description'),
      requirements: t('socialMiningTiers.pioneer.requirements'),
      rewards: t('socialMiningTiers.pioneer.rewards'),
      milestones: t('socialMiningTiers.pioneer.milestones'),
      icon: <UserCheck className="h-6 w-6 text-white" />,
      color: "bg-green-500"
    },
    {
      step: 2,
      title: t('socialMiningTiers.ambassador.title'),
      description: t('socialMiningTiers.ambassador.description'),
      requirements: t('socialMiningTiers.ambassador.requirements'),
      rewards: t('socialMiningTiers.ambassador.rewards'),
      milestones: t('socialMiningTiers.ambassador.milestones'),
      icon: <Star className="h-6 w-6 text-white" />,
      color: "bg-blue-500"
    },
    {
      step: 3,
      title: t('socialMiningTiers.partner.title'),
      description: t('socialMiningTiers.partner.description'),
      requirements: t('socialMiningTiers.partner.requirements'),
      rewards: t('socialMiningTiers.partner.rewards'),
      milestones: t('socialMiningTiers.partner.milestones'),
      icon: <Crown className="h-6 w-6 text-white" />,
      color: "bg-purple-500"
    }
  ];

  const socialMiningMechanisms = [
    {
      title: t('socialMiningMechanisms.milestoneBased.title'),
      description: t('socialMiningMechanisms.milestoneBased.description'),
      features: t('socialMiningMechanisms.milestoneBased.features'),
      icon: <Target className="h-6 w-6 text-white" />,
      color: "bg-green-500"
    },
    {
      title: t('socialMiningMechanisms.commissionBased.title'),
      description: t('socialMiningMechanisms.commissionBased.description'),
      features: t('socialMiningMechanisms.commissionBased.features'),
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      color: "bg-blue-500"
    },
    {
      title: t('socialMiningMechanisms.teamBuilding.title'),
      description: t('socialMiningMechanisms.teamBuilding.description'),
      features: t('socialMiningMechanisms.teamBuilding.features'),
      icon: <Users className="h-6 w-6 text-white" />,
      color: "bg-purple-500"
    },
    {
      title: t('socialMiningMechanisms.transparentSettlement.title'),
      description: t('socialMiningMechanisms.transparentSettlement.description'),
      features: t('socialMiningMechanisms.transparentSettlement.features'),
      icon: <Star className="h-6 w-6 text-white" />,
      color: "bg-orange-500"
    }
  ];

  const futureOpportunities = [
    {
      phase: t('futureOpportunities.phase2.phase'),
      title: t('futureOpportunities.phase2.title'),
      description: t('futureOpportunities.phase2.description'),
      icon: <Globe className="h-6 w-6" />,
      color: "bg-green-500"
    },
    {
      phase: t('futureOpportunities.phase3.phase'),
      title: t('futureOpportunities.phase3.title'),
      description: t('futureOpportunities.phase3.description'),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "bg-blue-500"
    },
    {
      phase: t('futureOpportunities.phase4.phase'),
      title: t('futureOpportunities.phase4.title'),
      description: t('futureOpportunities.phase4.description'),
      icon: <Rocket className="h-6 w-6" />,
      color: "bg-purple-500"
    }
  ];


  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-12 sm:py-20" style={{
        backgroundImage: 'url(/community-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '50vh',
        height: 'auto'
      }}>
        {/* Global Mint Counter - positioned at top right */}
        <div className="absolute top-8 right-8 z-10 w-80 hidden lg:block">
          <GlobalMintCounter campaign="G3" />
        </div>
        
        {/* Action Button - positioned at bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <Link href="/contributor-application">
            <Button size="lg">
              {t('hero.joinButton')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
      
      {/* Mobile Global Mint Counter */}
      <section className="py-6 lg:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <GlobalMintCounter campaign="G3" />
        </div>
      </section>
      {/* Social Mining Tiers */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('socialMiningTiers.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('socialMiningTiers.subtitle')}
            </p>
            <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-primary font-semibold">
                {t('socialMiningTiers.newProgram')}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {socialMiningTiers.map((tier, index) => (
              <Card key={index} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                <div className={`absolute top-0 left-0 right-0 h-1 ${tier.color}`}></div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={`${tier.color} text-white`}>Tier {tier.step}</Badge>
                    <div className={`w-10 h-10 ${tier.color} rounded-full flex items-center justify-center`}>
                      {tier.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-primary">{tier.title}</CardTitle>
                  <CardDescription className="text-primary/80">{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-primary mb-2">{t('socialMiningTiers.requirements')}</h4>
                    <ul className="space-y-1">
                      {(Array.isArray(tier.requirements) ? tier.requirements : []).map((req: string, idx: number) => (
                        <li key={idx} className="flex items-start text-sm text-primary/80">
                          <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">{t('socialMiningTiers.rewards')}</h4>
                    <ul className="space-y-1">
                      {(Array.isArray(tier.rewards) ? tier.rewards : []).map((reward: string, idx: number) => (
                        <li key={idx} className="flex items-start text-sm text-primary/80">
                          <Star className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                          <span>{reward}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-2">{t('socialMiningTiers.milestones')}</h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
                        <strong>M1:</strong> {tier.milestones.M1}
                      </div>
                      <div className="p-2 bg-blue-50 rounded border-l-2 border-blue-400">
                        <strong>M2:</strong> {tier.milestones.M2}
                      </div>
                      <div className="p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                        <strong>M3:</strong> {tier.milestones.M3}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Mining Mechanisms */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('socialMiningMechanisms.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('socialMiningMechanisms.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {socialMiningMechanisms.map((mechanism, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 ${mechanism.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                    <div className="text-white">
                      {mechanism.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-primary">{mechanism.title}</CardTitle>
                  <CardDescription className="text-sm text-primary/80">{mechanism.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-primary/80">
                    {(Array.isArray(mechanism.features) ? mechanism.features : []).map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-left">{feature}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Future Opportunities */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('futureOpportunities.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('futureOpportunities.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {futureOpportunities.map((opportunity, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-center mb-4">
                    <Badge className={`${opportunity.color} text-white text-sm`}>{opportunity.phase}</Badge>
                  </div>
                  <div className={`w-12 h-12 ${opportunity.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                    <div className="text-white">
                      {opportunity.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-primary">{opportunity.title}</CardTitle>
                  <CardDescription className="text-sm text-primary/80">{opportunity.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
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
              <Link href="/contributor-application">
                <Button 
                  size="lg"
                  variant="outline"
                >
                  {t('cta.startContributor')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/institutional-application">
                <Button 
                  size="lg"
                  variant="outline"
                >
                  {t('cta.applyInstitution')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="py-12 bg-primary/10 border-t border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-primary/20 border border-primary/30 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Target className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-2">{t('complianceNotice.title')}</h3>
                <p className="text-primary/80 text-sm">
                  {t('complianceNotice.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
