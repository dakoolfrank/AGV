"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  Github, 
  Twitter, 
  Linkedin, 
  Mail, 
  MapPin, 
  Phone,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Heart,
  MessageCircle,
  Send,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/hooks/useTranslations"
import { createLocalizedHref } from "@/lib/locale-utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface FooterProps {
  backgroundClass?: string;
  textColorClass?: string;
}

export function Footer({ backgroundClass = "bg-background", textColorClass = "text-foreground" }: FooterProps) {
  const { t, locale } = useTranslations();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: t('footer.nftMinting'), href: createLocalizedHref("/mint", locale) },
      { name: t('footer.kolProgram'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('dashboard.analytics'), href: createLocalizedHref("/coming-soon", locale) },
    ],
    company: [
      { name: t('footer.aboutUs'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.careers'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('landing.footer.navigation.company.press'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.blogs'), href: createLocalizedHref("/coming-soon", locale) },
    ],
    support: [
      { name: t('footer.helpCenter'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.documentation'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('landing.footer.navigation.support.apiReference'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.contactSupport'), href: createLocalizedHref("/coming-soon", locale) },
    ],
    legal: [
      { name: t('footer.privacy'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.terms'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.cookiePolicy'), href: createLocalizedHref("/coming-soon", locale) },
      { name: t('footer.gdpr'), href: createLocalizedHref("/coming-soon", locale) },
    ],
  };

  const socialLinks = [
    { name: "GitHub", href: "https://github.com/AGV-Protocol/", icon: Github },
    { name: "Twitter", href: "https://x.com/AgvProtocol", icon: Twitter},
    { name: "Discord", href: "https://discord.gg/JP9RtzM2SC", icon: MessageCircle },
    { name: "Telegram", href: "https://t.me/agvprotocol", icon: Send },
  ];

  const features = [
    { icon: Shield, text: t('footer.secure') },
    { icon: Zap, text: t('footer.fast') },
    { icon: Globe, text: t('footer.multichain') },
  ];

  return (
    <footer className={`${backgroundClass} border-t`}>
      {/* Newsletter Section */}
      {/* <div className="border-b bg-muted/30">
        <div className="container py-8 md:py-12">
          <div className="max-w-4xl mx-auto text-center space-y-4 md:space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-bold">Stay Updated</h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Get the latest news, updates, and exclusive offers from AGV Protocol
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 max-w-md mx-auto px-4 sm:px-0">
              <Input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 text-sm"
              />
              <Button className="shrink-0 text-sm">
                Subscribe
                <ArrowRight className="ml-2 h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground px-4">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div> */}

      {/* Main Footer Content */}
      <div className="container py-8 md:py-16">
        <div className="grid gap-8 md:gap-12 lg:grid-cols-5">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.svg"
                alt="AGV Protocol"
                width={40}
                height={40}
                className="h-8 w-8 md:h-10 md:w-10"
              />
              <div>
                <h2 className={`text-lg md:text-xl font-bold ${textColorClass}`}>AGV Protocol</h2>
                <p className={`text-xs md:text-sm ${textColorClass === 'text-white' ? 'text-white/70' : 'text-muted-foreground'}`}>{t('footer.nftMinting')}</p>
              </div>
            </div>
            
            <p className={`text-sm md:text-base max-w-md ${textColorClass === 'text-white' ? 'text-white/80' : 'text-muted-foreground'}`}>
              {t('footer.description')}
            </p>
            
            {/* Feature Badges */}
            <div className="flex flex-wrap gap-1 md:gap-2">
              {features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="gap-1 text-xs">
                  <feature.icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{feature.text}</span>
                  <span className="sm:hidden">{feature.text.split(' ')[0]}</span>
                </Badge>
              ))}
            </div>
            
            {/* Social Links and Language Switcher */}
            <div className="flex flex-col space-y-4">
              <div className="flex space-x-2 md:space-x-4">
                {socialLinks.map((social) => (
                  <Button
                    key={social.name}
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 w-8 md:h-10 md:w-10 p-0"
                  >
                    <a 
                      href={social.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      aria-label={social.name}
                    >
                      <social.icon className="h-3 w-3 md:h-4 md:w-4" />
                    </a>
                  </Button>
                ))}
              </div>
              
              {/* Language Switcher */}
              <div className="flex items-center space-x-2">
                <LanguageSwitcher 
                  currentLocale={locale} 
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-3 grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Product Links */}
            <div className="space-y-3 md:space-y-4">
              <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('header.nav.products')}</h4>
              <ul className="space-y-2 md:space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div className="space-y-3 md:space-y-4">
              <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('footer.company')}</h4>
              <ul className="space-y-2 md:space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links */}
            <div className="space-y-3 md:space-y-4">
              <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('footer.support')}</h4>
              <ul className="space-y-2 md:space-y-3">
                {footerLinks.support.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div className="space-y-3 md:space-y-4">
              <h4 className={`font-semibold text-sm md:text-base ${textColorClass}`}>{t('footer.legal')}</h4>
              <ul className="space-y-2 md:space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link 
                      href={link.href}
                      className={`text-xs md:text-sm transition-colors ${textColorClass === 'text-white' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Bottom Section */}
      <div className="container py-4 md:py-8">
        <div className="flex flex-col space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-center md:text-left">
              <p className={`text-xs md:text-sm ${textColorClass === 'text-white' ? 'text-white/70' : 'text-muted-foreground'}`}>
                © {currentYear} {t('footer.copyright')}
              </p>
              <div className={`flex items-center space-x-1 text-xs md:text-sm ${textColorClass === 'text-white' ? 'text-white/70' : 'text-muted-foreground'}`}>
                <span>Made with</span>
                <Heart className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                <span>for the decentralized future</span>
              </div>
            </div>
            
            <div className={`flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 md:space-x-6 text-xs md:text-sm ${textColorClass === 'text-white' ? 'text-white/70' : 'text-muted-foreground'}`}>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>All systems operational</span>
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                <span>Global</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
