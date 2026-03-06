"use client";

import React from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "../TranslationProvider";
import { 
  TrendingUp, 
  Users, 
  DollarSign,
  ArrowRight,
  CheckCircle,
  Shield,
  Zap,
  Globe,
  BarChart3,
  AlertTriangle,
  Network,
  Award,
  Handshake
} from "lucide-react";
import Link from "next/link";

export default function InstitutionsPage() {
  const t = useTranslations('institutions');
  
  const institutionalChallenges = [
    {
      title: t('challenges.userEducation.title'),
      description: t('challenges.userEducation.description'),
      icon: <AlertTriangle className="h-6 w-6" />,
      color: "bg-red-500"
    },
    {
      title: t('challenges.insufficientVoice.title'),
      description: t('challenges.insufficientVoice.description'),
      icon: <Users className="h-6 w-6" />,
      color: "bg-orange-500"
    },
    {
      title: t('challenges.inefficientMarketing.title'),
      description: t('challenges.inefficientMarketing.description'),
      icon: <TrendingUp className="h-6 w-6" />,
      color: "bg-yellow-500"
    },
    {
      title: t('challenges.lackOfData.title'),
      description: t('challenges.lackOfData.description'),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "bg-blue-500"
    },
    {
      title: t('challenges.complianceRisks.title'),
      description: t('challenges.complianceRisks.description'),
      icon: <Shield className="h-6 w-6" />,
      color: "bg-purple-500"
    }
  ];

  const g3FundSolution = [
    {
      title: t('solution.educationNetwork.title'),
      description: t('solution.educationNetwork.description'),
      features: t('solution.educationNetwork.features'),
      icon: <Network className="h-6 w-6" />,
      color: "bg-blue-500"
    },
    {
      title: t('solution.longTermAmbassadors.title'),
      description: t('solution.longTermAmbassadors.description'),
      features: t('solution.longTermAmbassadors.features'),
      icon: <Users className="h-6 w-6" />,
      color: "bg-green-500"
    },
    {
      title: t('solution.verifiableData.title'),
      description: t('solution.verifiableData.description'),
      features: t('solution.verifiableData.features'),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "bg-purple-500"
    },
    {
      title: t('solution.governance.title'),
      description: t('solution.governance.description'),
      features: t('solution.governance.features'),
      icon: <Shield className="h-6 w-6" />,
      color: "bg-orange-500"
    }
  ];

  const corePartners = [
    {
      category: t('corePartners.technologyTeams.title'),
      description: t('corePartners.technologyTeams.description'),
      icon: <Zap className="h-6 w-6" />,
      color: "bg-blue-500"
    },
    {
      category: t('corePartners.communityBuilders.title'),
      description: t('corePartners.communityBuilders.description'),
      icon: <Users className="h-6 w-6" />,
      color: "bg-green-500"
    },
    {
      category: t('corePartners.governance.title'),
      description: t('corePartners.governance.description'),
      icon: <Shield className="h-6 w-6" />,
      color: "bg-purple-500"
    },
    {
      category: t('corePartners.assetPartners.title'),
      description: t('corePartners.assetPartners.description'),
      icon: <Globe className="h-6 w-6" />,
      color: "bg-orange-500"
    },
    {
      category: t('corePartners.coreSponsor.title'),
      description: t('corePartners.coreSponsor.description'),
      icon: <Award className="h-6 w-6" />,
      color: "bg-yellow-500"
    }
  ];

  const waysToParticipate = [
    {
      level: t('participation.lightSupport.title'),
      description: t('participation.lightSupport.description'),
      benefits: t('participation.lightSupport.benefits'),
      icon: <Handshake className="h-6 w-6" />,
      color: "bg-blue-500"
    },
    {
      level: t('participation.mediumSupport.title'),
      description: t('participation.mediumSupport.description'),
      benefits: t('participation.mediumSupport.benefits'),
      icon: <DollarSign className="h-6 w-6" />,
      color: "bg-green-500"
    },
    {
      level: t('participation.strategicPartner.title'),
      description: t('participation.strategicPartner.description'),
      benefits: t('participation.strategicPartner.benefits'),
      icon: <Award className="h-6 w-6" />,
      color: "bg-purple-500"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-20" style={{
        backgroundImage: 'url(/herobg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Background overlay for better text readability */}
        <div className="absolute inset-0 bg-white/20"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center text-white space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              {t('title')}
            </h1>
            <h2 className="text-2xl sm:text-3xl text-white/90 font-semibold">
              {t('subtitle')}
            </h2>
            <p className="text-xl sm:text-2xl text-white/90 max-w-4xl mx-auto">
              {t('description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Link href="/institutional-application">
                <Button size="lg">
                  {t('heroButton')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Challenges */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-4">
              {t('challenges.title')}
            </h2>
            <p className="text-base sm:text-lg text-primary/80 max-w-3xl mx-auto">
              {t('challenges.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {institutionalChallenges.map((challenge, index) => (
              <Card
                key={index}
                className="hover:shadow-lg transition-shadow border-l-4 border-red-200 w-full"
              >
                <CardHeader>
                  <div className="flex items-center space-x-3 mb-4">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 ${challenge.color} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <div className="text-white text-sm sm:text-base">{challenge.icon}</div>
                    </div>
                    <CardTitle className="text-base sm:text-lg font-bold text-primary">
                      {challenge.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-primary/80">
                    {challenge.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

        </div>
      </section>

      {/* G3 Fund Solution */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('solution.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('solution.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {g3FundSolution.map((solution, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow border-l-4 border-green-200">
                <CardHeader>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-12 h-12 ${solution.color} rounded-lg flex items-center justify-center`}>
                      <div className="text-white">
                        {solution.icon}
                      </div>
                    </div>
                    <CardTitle className="text-lg font-bold text-primary">{solution.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-primary/80 mb-4">{solution.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {solution.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-primary/80">
                        <CheckCircle className="h-4 w-4 text-primary mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Current Core Partners */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-4">
              {t('corePartners.title')}
            </h2>
            <p className="text-base sm:text-lg text-primary/80 max-w-3xl mx-auto">
              {t('corePartners.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {corePartners.map((partner, index) => (
              <Card
                key={index}
                className="text-center hover:shadow-lg transition-shadow w-full"
              >
                <CardHeader>
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 ${partner.color} rounded-lg flex items-center justify-center mx-auto mb-4`}
                  >
                    <div className="text-white text-sm sm:text-base">{partner.icon}</div>
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold text-primary">
                    {partner.category}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-primary/80">
                    {partner.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

        </div>
      </section>

      {/* Ways to Participate */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('participation.title')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('participation.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {waysToParticipate.map((way, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 ${way.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                    <div className="text-white">
                      {way.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-primary">{way.level}</CardTitle>
                  <CardDescription className="text-sm text-primary/80">{way.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-primary/80">
                    {way.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-primary mr-2" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
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
              <Button size="lg" variant="outline">
                {t('cta.button')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="py-12 bg-primary/10 border-t border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-primary/20 border border-primary/30 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-primary mt-0.5" />
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
