import React from "react";
import { Users, TrendingUp, ArrowRight, Star, BookOpen, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useTranslations } from "@/app/[locale]/TranslationProvider";

export const HeroSection: React.FC = () => {
  const t = useTranslations('hero');
  
  return (
    <section className="relative min-h-screen overflow-hidden" style={{
      backgroundImage: 'url(/herobg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-white/20"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 lg:pt-32 lg:pb-32">
        <div className="text-center space-y-8 lg:space-y-12">
          {/* Badge */}
          <div className="flex justify-center">
            <Badge className="bg-white/20 text-white border-white/30 px-6 py-2 text-sm font-medium backdrop-blur-sm">
              <Star className="w-4 h-4 mr-2" />
{t('badge')}
            </Badge>
          </div>

          {/* Main Heading */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl xl:text-8xl font-bold text-white leading-tight">
{t('title')}
            </h1>

            {/* Sub-headline */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-white font-semibold">
{t('subtitle')}
            </h2>

            {/* Description */}
            <p className="text-lg sm:text-xl lg:text-2xl text-white leading-relaxed max-w-4xl mx-auto">
{t('description')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
            <Link href="/community">
              <Button
                size="lg"
                className="px-8 py-4 text-lg font-semibold rounded-xl shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Users className="h-5 w-5 mr-2" />
{t('buttons.contributor')}
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>

            <Link href="/institutions">
              <Button
                size="lg"
                className="px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                <TrendingUp className="h-5 w-5 mr-2" />
{t('buttons.institutions')}
              </Button>
            </Link>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto pt-8">
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-6 hover:bg-white/90 transition-all duration-300">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#223256] mb-2">
                {t('features.educate.title')}
              </h3>
              <p className="text-[#223256]/80 text-sm">
                {t('features.educate.description')}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-6 hover:bg-white/90 transition-all duration-300">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#223256] mb-2">
                {t('features.growth.title')}
              </h3>
              <p className="text-[#223256]/80 text-sm">
                {t('features.growth.description')}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl p-6 hover:bg-white/90 transition-all duration-300">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#223256] mb-2">
                {t('features.institutional.title')}
              </h3>
              <p className="text-[#223256]/80 text-sm">
                {t('features.institutional.description')}
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-12 max-w-4xl mx-auto pt-12">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">8-10</div>
              <div className="text-white/90 font-medium">
                {t('stats.partnerKols')}
              </div>
              <div className="text-sm text-white/70 mt-1">
                {t('stats.partnerKolsDesc')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">300-500</div>
              <div className="text-white/90 font-medium">
                {t('stats.smallKols')}
              </div>
              <div className="text-sm text-white/70 mt-1">
                {t('stats.smallKolsDesc')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">10K-30K</div>
              <div className="text-white/90 font-medium">
                {t('stats.activeUsers')}
              </div>
              <div className="text-sm text-white/70 mt-1">
                {t('stats.activeUsersDesc')}
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
};
