"use client";

import React from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "../TranslationProvider";
import { 
  Clock,
  ArrowRight,
  Users,
  TrendingUp,
  DollarSign,
  PieChart
} from "lucide-react";
import Link from "next/link";

export default function FundPage() {
  const t = useTranslations('fund');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Coming Soon Hero Section */}
      <section className="relative py-20" style={{
        backgroundImage: 'url(/herobg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Background overlay for better text readability */}
        <div className="absolute inset-0 bg-white/20"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center text-white space-y-8">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Clock className="h-12 w-12 text-white" />
              </div>
            </div>
            
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
              <Link href="/institutions">
                <Button size="lg">
                  {t('viewInstitutions')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/community">
                <Button size="lg" variant="outline">
                  {t('joinCommunity')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              {t('whatsComingTitle')}
            </h2>
            <p className="text-lg text-primary/80 max-w-3xl mx-auto">
              {t('whatsComingSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow opacity-75">
              <CardHeader>
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                  <PieChart className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg font-bold text-primary">{t('preview.tokenAllocation.title')}</CardTitle>
                <CardDescription className="text-sm text-primary/80">{t('preview.tokenAllocation.description')}</CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow opacity-75">
              <CardHeader>
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg font-bold text-primary">{t('preview.fundBudget.title')}</CardTitle>
                <CardDescription className="text-sm text-primary/80">{t('preview.fundBudget.description')}</CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow opacity-75">
              <CardHeader>
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg font-bold text-primary">{t('preview.kolTargets.title')}</CardTitle>
                <CardDescription className="text-sm text-primary/80">{t('preview.kolTargets.description')}</CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow opacity-75">
              <CardHeader>
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg font-bold text-primary">{t('preview.growthMetrics.title')}</CardTitle>
                <CardDescription className="text-sm text-primary/80">{t('preview.growthMetrics.description')}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Stay Updated */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-white space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold">
              {t('stayUpdated.title')}
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              {t('stayUpdated.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Link href="/community">
                <Button size="lg" variant="outline">
                  {t('joinCommunity')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/institutions">
                <Button size="lg">
                  {t('viewInstitutions')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
