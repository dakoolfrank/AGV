'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Star, 
  Crown, 
  ArrowRight, 
  CheckCircle,
  UserPlus,
  TrendingUp,
  DollarSign,
  Shield
} from 'lucide-react';
import { useTranslations } from '../TranslationProvider';

function JoinPageContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [sponsorRef, setSponsorRef] = useState<string | null>(null);
  const [sponsorInfo, setSponsorInfo] = useState<{
    displayName: string;
    tier: string;
    teamSize: number;
    successRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const ref = searchParams.get('ref');
    setSponsorRef(ref);
    
    if (ref) {
      // In production, fetch sponsor info from API
      // For now, use mock data
      setSponsorInfo({
        displayName: 'Demo Sponsor',
        tier: 'ambassador',
        teamSize: 15,
        successRate: 85
      });
    }
    
    setLoading(false);
  }, [searchParams]);
  
  const tierInfo = {
    pioneer: {
      title: t('join.pioneer.title'),
      description: t('join.pioneer.description'),
      commission: t('join.pioneer.commission'),
      overrides: { l1: t('join.pioneer.l1Override'), l2: t('join.pioneer.l2Override') },
      color: 'bg-green-500',
      icon: <UserPlus className="h-6 w-6 text-white" />
    },
    ambassador: {
      title: t('join.ambassador.title'), 
      description: t('join.ambassador.description'),
      commission: t('join.ambassador.commission'),
      overrides: { l1: t('join.ambassador.l1Override'), l2: t('join.ambassador.l2Override') },
      color: 'bg-blue-500',
      icon: <Star className="h-6 w-6 text-white" />
    },
    partner: {
      title: t('join.partner.title'),
      description: t('join.partner.description'),
      commission: t('join.partner.commission'),
      overrides: { l1: t('join.partner.l1Override'), l2: t('join.partner.l2Override') },
      color: 'bg-purple-500',
      icon: <Crown className="h-6 w-6 text-white" />
    }
  };
  
  const benefits = [
    {
      icon: <DollarSign className="h-6 w-6 text-green-600" />,
      title: t('join.competitiveCommissions.title'),
      description: t('join.competitiveCommissions.description')
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-blue-600" />,
      title: t('join.teamBuildingRewards.title'),
      description: t('join.teamBuildingRewards.description')
    },
    {
      icon: <Shield className="h-6 w-6 text-purple-600" />,
      title: t('join.transparentTracking.title'),
      description: t('join.transparentTracking.description')
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-orange-600" />,
      title: t('join.milestoneRewards.title'),
      description: t('join.milestoneRewards.description')
    }
  ];
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-4">
            {t('join.title')}
          </h1>
          <p className="text-xl text-primary/70 max-w-2xl mx-auto">
            {t('join.subtitle')}
          </p>
        </div>
        
        {/* Sponsor Info */}
        {sponsorRef && sponsorInfo && (
          <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-blue-800">
                    {t('join.invitedBy').replace('{name}', sponsorInfo.displayName)}
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    {t('join.joinTeam')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <Badge className={`${tierInfo[sponsorInfo.tier as keyof typeof tierInfo].color} text-white mb-2`}>
                    {tierInfo[sponsorInfo.tier as keyof typeof tierInfo].title}
                  </Badge>
                  <p className="text-sm text-blue-600">{t('join.sponsorTier')}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-xl font-bold text-blue-800">{sponsorInfo.teamSize}</p>
                  <p className="text-sm text-blue-600">{t('join.teamMembers')}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-xl font-bold text-blue-800">{sponsorInfo.successRate}%</p>
                  <p className="text-sm text-blue-600">{t('join.successRate')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Tier Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6 text-center">
            {t('join.chooseStartingTier')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-center">
            {Object.entries(tierInfo).map(([key, tier]) => (
              <Card 
                key={key} 
                className="relative overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 items-center"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${tier.color}`}></div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={`${tier.color} text-white`}>
                      {tier.title}
                    </Badge>
                    <div className={`w-10 h-10 ${tier.color} rounded-full flex items-center justify-center`}>
                      {tier.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-primary">{tier.title}</CardTitle>
                  <CardDescription className="text-primary/80">{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-primary mb-2">{t('join.commissionRates')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-primary/70">{t('join.directMints')}:</span>
                        <span className="font-medium text-green-600">{tier.commission}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary/70">{t('join.l1Override')}:</span>
                        <span className="font-medium text-blue-600">{tier.overrides.l1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary/70">{t('join.l2Override')}:</span>
                        <span className="font-medium text-purple-600">{tier.overrides.l2}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    // className="w-full" 
                    onClick={() => {
                      // Redirect to application form with tier and sponsor pre-filled
                      const params = new URLSearchParams();
                      params.set('tier', key);
                      if (sponsorRef) params.set('sponsor', sponsorRef);
                      window.location.href = `/contributor-application?${params.toString()}`;
                    }}
                  >
                    {t('join.applyAs').replace('{tier}', tier.title)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Benefits */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6 text-center">
            {t('join.whyJoin')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary mb-2">{benefit.title}</h3>
                      <p className="text-primary/70 text-sm">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Program Highlights */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-center text-primary">{t('join.programHighlights')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">{t('join.settlementSplitValue')}</div>
                <p className="text-sm text-primary/70">{t('join.settlementSplit')}<br/>({t('join.settlementSplitDesc')})</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">{t('join.milestoneWindowValue')}</div>
                <p className="text-sm text-primary/70">{t('join.milestoneWindow')}<br/>({t('join.milestoneWindowDesc')})</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">{t('join.teamDepthValue')}</div>
                <p className="text-sm text-primary/70">{t('join.teamDepth')}<br/>({t('join.teamDepthDesc')})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* CTA */}
        <div className="text-center">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">
                {t('join.readyToStart')}
              </h3>
              <p className="text-primary/70 mb-6 max-w-2xl mx-auto">
                {t('join.readyDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (sponsorRef) params.set('sponsor', sponsorRef);
                    window.location.href = `/contributor-application?${params.toString()}`;
                  }}
                >
                  {t('join.startApplication')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => {
                  window.location.href = '/community';
                }}>
                  {t('join.learnMore')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <Footer />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
