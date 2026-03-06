import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, Github, Send } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

// Custom X (Twitter) Icon Component
const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function Footer() {
  const { t } = useTranslations();
  
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image 
                  src="/logo.png" 
                  alt="AGV Protocol Logo" 
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-semibold text-foreground">{t('footer.company')}</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              {t('footer.description')}
            </p>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <a href="https://discord.gg/JP9RtzM2SC" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted-foreground/10 transition-colors">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </a>
              <a href="https://x.com/AgvProtocol" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted-foreground/10 transition-colors">
                <XIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </a>
              <a href="https://github.com/AGV-Protocol/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted-foreground/10 transition-colors">
                <Github className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </a>
              <a href="https://t.me/agvprotocol" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-10 sm:h-10 border border-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted-foreground/10 transition-colors">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/tech" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.tech')}
                </Link>
              </li>
              <li>
                <Link href="/financials" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.financials')}
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.legal')}
                </Link>
              </li>
              <li>
                <Link href="/esg" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.esg')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
              {t('footer.resources')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/brandkit" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.brandkit')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.contact')}
                </Link>
              </li>
              <li>
                <Link href="/investor" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.dataRoom')}
                </Link>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.privacyPolicy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
