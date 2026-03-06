"use client";
import React from "react";
import { Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image";
import Link from "next/link";

export const HeroSection: React.FC = () => {
  const { t, locale } = useTranslations();
  
  return (
    <section>
      <div className="relative bg-[#3399FF] min-h-[400px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#3399FF] via-[#3399FF]/80 to-transparent">
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="text-white space-y-6 sm:space-y-8">
              {/* Main Heading */}
              <div className="space-y-3 sm:space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight">
                  {t('hero.title1')}
                  <br />
                  {t('hero.title2')}
                </h1>

                {/* Description */}
                <p className="text-base sm:text-lg lg:text-xl text-white/90 leading-relaxed max-w-2xl">
                  {t('hero.description')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link href={`/${locale}/mint`}>
                  <Button
                    size="lg"
                    className="bg-[#223256] text-white hover:bg-[#223256]/90 hover:shadow-lg px-6 sm:px-8 py-3 sm:py-4 rounded-md font-semibold text-base sm:text-lg flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300"
                  >
                    <Database className="h-6 w-6 text-white" />
                    <span>{t('hero.startMinting')}</span>
                  </Button>
                </Link>

                <Link href={`/${locale}/staking`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-white text-[#3399FF] hover:bg-white/90 hover:shadow-lg border-black px-6 sm:px-8 py-3 sm:py-4 rounded-md font-semibold text-base sm:text-lg flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300"
                  >
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>{t('hero.viewStaking')}</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Content - Statistics */}
            <div className="flex justify-end lg:justify-end mt-8 lg:mt-0">
              <div className="text-white text-center lg:text-right space-y-6 sm:space-y-8">
                {/* Statistics */}
                <div className="flex gap-6 justify-center items-center lg:justify-end">
                  <div className="space-y-1 sm:space-y-2">
                    <div className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold">3</div>
                    <div className="text-sm sm:text-base lg:text-lg font-medium">{t('hero.blockchains')}</div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <div className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold">4</div>
                    <div className="text-sm sm:text-base lg:text-lg font-medium">{t('hero.nftCollections')}</div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <div className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold">50</div>
                    <div className="text-sm sm:text-base lg:text-lg font-medium">rGGP {t('hero.dailyRewards')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-full">
        <Image
          src="/herobg.png"
          alt="AGV Hero"
          width={1000}
          height={0}
          className="w-full h-[35pc]"
        />
      </div>

    </section>
  );
};
