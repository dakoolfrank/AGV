'use client'
import React from "react";
import { 
  Database, 
  Zap, 
  Shield, 
  ArrowRight,
  Github,
  X,
  MessageCircle,
  Send,
  FileText,
  Coins,
  BookOpen,
  ExternalLink,
  Globe,
  Twitter,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/useTranslations";
import Link from "next/link";

export const MainContent: React.FC = () => {
  const { t } = useTranslations();

  const features = [
    {
      title: t('maincontent.features.multichain.title'),
      description: t('maincontent.features.multichain.description'),
      icon: <Globe className="h-8 w-8 text-white" />,
      color: "bg-blue-500"
    },
    {
      title: t('maincontent.features.secure.title'),
      description: t('maincontent.features.secure.description'),
      icon: <Shield className="h-8 w-8 text-white" />,
      color: "bg-green-500"
    },
    {
      title: t('maincontent.features.rewards.title'),
      description: t('maincontent.features.rewards.description'),
      icon: <Zap className="h-8 w-8 text-white" />,
      color: "bg-yellow-500"
    }
  ];

  const socialLinks: { name: string; icon: React.ReactNode; url: string; stars?: string; followers?: string; members?: string }[] = [];

  const articles: { title: string; description: string; url: string; date: string }[] = [];
  return (
    <section className="relative">
      {/* Gradient section from hero end to Platform Overview title */}
      <div className="bg-gradient-to-b from-[#66CCFF] to-white pt-16 sm:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pl-[8px]">
          {/* Platform Overview Title */}
            <div className="flex items-center mb-8 sm:mb-12 px-4 sm:px-8 lg:px-24">
              <div className="w-2 h-2 bg-[#3399FF] rounded-full mr-3"></div>
              <h3 className="text-xl uppercase sm:text-xl font-bold text-[#223256]">{t('maincontent.platformOverview')}</h3>
            </div>
        </div>
      </div>

       {/* White background section for the rest of the content */}
       <div className="bg-white pb-16 px-4 sm:px-8 lg:px-48 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Platform Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
            <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 group hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">{t('maincontent.stats.nftCount')}</div>
                  <div className="text-xs text-gray-500">{t('landing.platformOverview.nftsMinted')}</div>
                </div>
              </div>
              <div className="text-gray-600 font-medium">{t('maincontent.stats.totalSupply')}</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 group hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">{t('maincontent.stats.upto50rggp')}</div>
                  <div className="text-xs text-gray-500">{t('maincontent.stats.dailyRewards')}</div>
                </div>
              </div>
              <div className="text-gray-600 font-medium">{t('maincontent.stats.rewardRate')}</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 group hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">98%</div>
                  <div className="text-xs text-gray-500">{t('maincontent.stats.securityScore')}</div>
                </div>
              </div>
              <div className="text-gray-600 font-medium">{t('maincontent.stats.auditRating')}</div>
            </div>
          </div>

          {/* Main Features */}
          <div className="mb-8">
            <div className="flex items-center mb-8 sm:mb-12">
              <div className="w-2 h-2 bg-[#3399FF] rounded-full mr-3"></div>
              <h3 className="text-xl uppercase sm:text-xl font-bold text-[#223256]">{t('maincontent.coreFeatures')}</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-3 rounded-xl ${feature.color} shadow-lg`}>
                      {feature.icon}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">{feature.title}</h4>
                  </div>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Actions */}
          <div className="mb-8">
            <div className="flex items-center mb-8 sm:mb-12">
              <div className="w-2 h-2 bg-[#3399FF] rounded-full mr-3"></div>
              <h3 className="text-xl uppercase sm:text-xl font-bold text-[#223256]">{t('maincontent.getStarted')}</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-950 shadow-lg">
                    <Coins className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">{t('landing.getStarted.mintNFTs.title')}</h4>
                </div>
                <p className="text-gray-600 text-sm mb-4">{t('landing.getStarted.mintNFTs.description')}</p>
                <Link href="/mint">
                  <Button className="w-full border border-[#223256] hover:bg-[#223256] hover:text-white text-[#223256] px-8 py-3 text-sm bg-white rounded-md">
                    {t('landing.getStarted.mintNFTs.button')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">{t('landing.getStarted.stakeEarn.title')}</h4>
                </div>
                <p className="text-gray-600 text-sm mb-4">{t('landing.getStarted.stakeEarn.description')}</p>
                <Link href="/staking">
                  <Button className="w-full border border-[#223256] hover:bg-[#223256] hover:text-white text-[#223256] px-8 py-3 text-sm bg-white rounded-md">
                    {t('landing.getStarted.stakeEarn.button')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                    <Info className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">{t('landing.getStarted.learnMore.title')}</h4>
                </div>
                <p className="text-gray-600 text-sm mb-4">{t('landing.getStarted.learnMore.description')}</p>
                <Link href="https://buy.agvnexrur.ai">
                  <Button className="w-full border border-[#223256] hover:bg-[#223256] hover:text-white text-[#223256] px-8 py-3 text-sm bg-white rounded-md">
                    {t('landing.getStarted.learnMore.button')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="mb-8">
            <div className="flex items-center mb-8 sm:mb-12">
              <div className="w-2 h-2 bg-[#3399FF] rounded-full mr-3"></div>
              <h3 className="text-xl uppercase sm:text-xl font-bold text-[#223256]">Community</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {socialLinks.map((social, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      {social.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{social.name}</h4>
                      <p className="text-gray-500 text-sm">
                        {social.followers && `${social.followers} ${t('maincontent.social.followers')}`}
                        {social.members && `${social.members} ${t('maincontent.social.members')}`}
                        {social.stars && `${social.stars} ${t('maincontent.social.stars')}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => window.open(social.url, '_blank')}
                  >
                    Follow
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Articles */}
          <div className="mb-8">
            <div className="flex items-center mb-8 sm:mb-12">
              <div className="w-2 h-2 bg-[#3399FF] rounded-full mr-3"></div>
              <h3 className="text-xl uppercase sm:text-xl font-bold text-[#223256]">Latest Updates</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {articles.map((article, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 group hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="text-gray-500 text-sm">{article.date}</div>
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2">{article.title}</h4>
                  <p className="text-gray-600 text-sm mb-4">{article.description}</p>
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => window.open(article.url, '_blank')}
                  >
                    {t('maincontent.articles.readMore')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
