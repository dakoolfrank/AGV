'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import Image from 'next/image';
import { 
  Github, 
  Twitter, 
  MapPin, 
  Shield,
  Zap,
  Globe,
  MessageCircle,
  Send
} from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

interface FooterProps {
  backgroundClass?: string;
  textColorClass?: string;
}

export function Footer({ textColorClass = "text-white" }: FooterProps) {
  const { t } = useTranslations('footer');

  const footerLinks = {
    product: [
      { name: t('links.nftMinting'), href: '/mint', key: 'nftMinting' },
      { name: t('links.kolProgram'), href: '/coming-soon', key: 'kolProgram' },
      { name: t('links.analytics'), href: '/coming-soon', key: 'analytics' },
    ],
    company: [
      { name: t('links.aboutUs'), href: '/coming-soon', key: 'aboutUs' },
      { name: t('links.careers'), href: '/coming-soon', key: 'careers' },
      { name: t('links.press'), href: '/coming-soon', key: 'press' },
      { name: t('links.blogs'), href: '/coming-soon', key: 'blogs' },
    ],
    support: [
      { name: t('links.helpCenter'), href: '/coming-soon', key: 'helpCenter' },
      { name: t('links.documentation'), href: '/coming-soon', key: 'documentation' },
      { name: t('links.apiReference'), href: '/coming-soon', key: 'apiReference' },
      { name: t('links.contactSupport'), href: '/coming-soon', key: 'contactSupport' },
    ],
    legal: [
      { name: t('links.privacyPolicy'), href: '/coming-soon', key: 'privacyPolicy' },
      { name: t('links.termsOfService'), href: '/coming-soon', key: 'termsOfService' },
      { name: t('links.cookiePolicy'), href: '/coming-soon', key: 'cookiePolicy' },
      { name: t('links.gdpr'), href: '/coming-soon', key: 'gdpr' },
    ],
  };

  const socialLinks = [
    { name: "GitHub", href: "https://github.com/AGV-Protocol/", icon: Github },
    { name: "Twitter", href: "https://x.com/AgvProtocol", icon: Twitter},
    { name: "Discord", href: "https://discord.gg/JP9RtzM2SC", icon: MessageCircle },
    { name: "Telegram", href: "https://t.me/agvprotocol", icon: Send },
  ];

  const features = [
    { icon: Shield, text: t('features.secure') },
    { icon: Zap, text: t('features.fast') },
    { icon: Globe, text: t('features.multichain') },
  ];

  return (
    <footer className="border-t border-white/20 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          bottom: '20%',
          right: '12%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, 50%)',
          zIndex: 0,
          filter: 'blur(80px)',
          opacity: 0.9
        }}>
      </div>
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 relative z-10">
        <div className="grid gap-6 sm:gap-8 md:gap-12 lg:grid-cols-5">
          {/* Brand Section */}
          <ScrollAnimation direction="left" delay={0}>
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <div className="flex items-center space-x-3">
                <Image
                  src="/agv-logo.png"
                  alt="AGV Protocol"
                  width={40}
                  height={40}
                  className="h-8 w-8 md:h-10 md:w-10"
                />
                <div>
                  <h2 className={`text-lg md:text-xl font-bold ${textColorClass}`}>{t('brand.name')}</h2>
                  <p className={`text-xs md:text-sm ${textColorClass === 'text-white' ? 'text-white/70' : 'text-muted-foreground'}`}>{t('brand.tagline')}</p>
                </div>
              </div>
              
              <p className={`text-sm md:text-base max-w-md ${textColorClass === 'text-white' ? 'text-white/80' : 'text-muted-foreground'}`}>
                {t('brand.description')}
              </p>
              
              {/* Feature Badges */}
              <div className="flex flex-wrap gap-1 md:gap-2">
                {features.map((feature, index) => (
                  <div key={index} className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 border border-white/20 flex items-center gap-1 text-xs">
                    <feature.icon className="h-3 w-3 text-blue-400" />
                    <span className="text-white/80">{feature.text}</span>
                  </div>
                ))}
              </div>
              
              {/* Social Links */}
              <div className="flex flex-col space-y-4">
                <div className="flex space-x-2 md:space-x-4">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href={social.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className="h-8 w-8 md:h-10 md:w-10 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors animate-bounce-gentle"
                    >
                      <social.icon className="h-3 w-3 md:h-4 md:w-4 text-white" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </ScrollAnimation>

          {/* Links Sections */}
          <div className="lg:col-span-3 grid gap-4 sm:gap-6 md:gap-8 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Product Links */}
            <ScrollAnimation direction="bottom" delay={200}>
              <div className="space-y-3 md:space-y-4">
                <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('links.products')}</h4>
                <ul className="space-y-2 md:space-y-3">
                  {footerLinks.product.map((link) => (
                    <li key={link.name}>
                      <a 
                        href={link.href}
                        className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>

            {/* Company Links */}
            <ScrollAnimation direction="bottom" delay={400}>
              <div className="space-y-3 md:space-y-4">
                <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('links.company')}</h4>
                <ul className="space-y-2 md:space-y-3">
                  {footerLinks.company.map((link) => (
                    <li key={link.name}>
                      <a 
                        href={link.href}
                        className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>

            {/* Support Links */}
            <ScrollAnimation direction="bottom" delay={600}>
              <div className="space-y-3 md:space-y-4">
                <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('links.support')}</h4>
                <ul className="space-y-2 md:space-y-3">
                  {footerLinks.support.map((link) => (
                    <li key={link.name}>
                      <a 
                        href={link.href}
                        className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>

            {/* Legal Links */}
            <ScrollAnimation direction="bottom" delay={800}>
              <div className="space-y-3 md:space-y-4">
                <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('links.legal')}</h4>
                <ul className="space-y-2 md:space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.name}>
                      <a 
                        href={link.href}
                        className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </div>
    </footer>
  );
}
