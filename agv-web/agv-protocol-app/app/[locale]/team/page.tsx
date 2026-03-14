"use client";
import React, { useState } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { ValueCard } from "@/components/landing/ValueCard";
import { useTranslations } from "@/hooks/useTranslations";
import { Button } from "@/components/ui/button";
import { Mail, Copy, Check } from "lucide-react";
import Image from "next/image";

export default function CareerPage() {
  const { t } = useTranslations();
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Sample data for teams
  const teams = [
    {
      icon: "/icons/teams/gd.svg",
      title: t('team.members.susan.name'),
      description: t('team.members.susan.role')
    },
    
    {
      icon: "/icons/teams/cto.svg",
      title: t('team.members.tyler.name'),
      description: t('team.members.tyler.role')
    },
    
    {
      icon: "/icons/teams/techLead.svg",
      title: t('team.members.yasir.name'),
      description: t('team.members.yasir.role')
    },
    
    {
      icon: "/icons/teams/dao.svg",
      title: t('team.members.winnie.name'),
      description: t('team.members.winnie.role')
    },
    
    {
      icon: "/icons/teams/bdl.svg",
      title: t('team.members.yatogami.name'),
      description: t('team.members.yatogami.role')
    },
    
    {
      icon: "/icons/teams/marketting.svg",
      title: t('team.members.frank.name'),
      description: t('team.members.frank.role')
    },
    
  ];

  // Contact data
  const contactDetails = [
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.general.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.general.description')
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.investor.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.investor.description')
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.business.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.business.description')
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.technology.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.technology.description')
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.onchain.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.onchain.description')
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: t('contact.external.title'),
      email: "frank@agvnexrur.ai",
      description: t('contact.external.description')
    }
  ];

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Left semicircle */}
        <div className="absolute top-[70pc] left-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full -translate-x-[600px] -translate-y-[600px]"></div>
        {/* Right semicircle */}
        <div className="absolute top-[100pc] right-0 w-[1000px] h-[1000px] bg-[#4FACFE]/10 rounded-full translate-x-[500px] -translate-y-[500px]"></div>
      </div>
      
      {/* Header */}
      <Header />
      
      {/* Hero Section */}
      <section className="relative min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/team/hero.png"
            alt="Team Hero Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>        
      </section>
      {/* Our Teams Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12 text-[#223256]">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-center uppercase">
              {t('team.section.title')}
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl px-4 sm:px-8 md:px-16 lg:px-24 xl:px-48 text-center leading-relaxed">
              {t('team.section.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-12 lg:gap-16 xl:gap-24">
            {teams.map((value, index) => (
              <ValueCard
                key={index}
                icon={value.icon}
                title={value.title}
                description={value.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#223256] mb-4 uppercase">
              {t('contact.section.title')}
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-[#223256] max-w-3xl mx-auto leading-relaxed">
              {t('contact.section.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {contactDetails.map((contact, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#4FACFE]/10 rounded-full flex items-center justify-center">
                    <div className="text-[#4FACFE]">
                      {contact.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-[#223256] mb-2">
                      {contact.title}
                    </h3>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-[#4FACFE] font-semibold text-sm sm:text-base break-all">
                        {contact.email}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyEmail(contact.email)}
                        className="p-1 h-auto text-gray-500 hover:text-[#4FACFE] transition-colors duration-300"
                      >
                        {copiedEmail === contact.email ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[#223256] text-sm sm:text-base leading-relaxed">
                      {contact.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Information Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-transparent relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 sm:p-12 shadow-lg border border-gray-100 text-center">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#223256] mb-4">
              {t('contact.additional.title')}
            </h3>
            <p className="text-[#223256] text-sm sm:text-base md:text-lg leading-relaxed mb-6">
              {t('contact.additional.description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-[#4FACFE]" />
                <span className="text-[#4FACFE] font-semibold text-sm sm:text-base">
                  frank@agvnexrur.ai
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyEmail("frank@agvnexrur.ai")}
                  className="p-1 h-auto text-gray-500 hover:text-[#4FACFE] transition-colors duration-300"
                >
                  {copiedEmail === "frank@agvnexrur.ai" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
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
