'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import NDAModal from '@/components/NDAModal';
import { motion } from 'framer-motion';
import { FiSettings, FiBarChart, FiShield, FiHeart, FiFile } from 'react-icons/fi';
import Image from 'next/image';
import { useTranslations } from '@/hooks/useTranslations';

export default function Home() {
  const { t, locale } = useTranslations();
  const [isNDAModalOpen, setIsNDAModalOpen] = useState(false);
  const features = [
    {
      title: t('nav.tech'),
      description: t('documents.categories.tech'),
      href: `/${locale}/tech`,
      icon: <FiSettings size={24} />,
    },
    {
      title: t('nav.financials'),
      description: t('documents.categories.financials'),
      href: `/${locale}/financials`,
      icon: <FiBarChart size={24} />,
    },
    {
      title: t('nav.legal'),
      description: t('documents.categories.legal'),
      href: `/${locale}/legal`,
      icon: <FiShield size={24} />,
    },
    {
      title: t('nav.esg'),
      description: t('documents.categories.esg'),
      href: `/${locale}/esg`,
      icon: <FiHeart size={24} />,
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-12 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/landing-hero.png"
            alt="AGV NEXRUR - Sustainable Energy Infrastructure"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <SectionHeader
            title={t('header.title')}
            subtitle={t('hero.subtitle')}
            description={t('header.description')}
            className="mb-8 sm:mb-16"
            variant="white"
          />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mb-12"
          >
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button href={`/${locale}/investor`} variant="primary" size="lg" className="w-full sm:w-auto">
                {t('hero.loginButton')}
              </Button>
              <Button href={`/${locale}/contact`} variant="outline" size="lg" className="text-white hover:text-primary w-full sm:w-auto">
                {t('hero.learnMore')}
              </Button>
            </div>
            
            <Button href="https://drive.google.com/file/d/1C6Awj0-rDYUE3xzbEW_umCRWod-HUhwB/view" target="_blank" variant="secondary" size="lg" className="w-full sm:w-auto">
            <div className='flex items-center gap-2'>
                <FiFile className="mr-2 text-primary" size={24} />
                <span className='text-primary'>{t('hero.whitepaperButton')}</span>
            </div>
            
            </Button>
          </motion.div>

        </div>
      </section>

      {/* Pitch Deck and Executive Summary Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t('home.investmentMaterials.title')}
            subtitle={t('home.investmentMaterials.subtitle')}
            description={t('home.investmentMaterials.description')}
            className="mb-8 sm:mb-12"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Executive Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="p-4 sm:p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <FiFile size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{t('home.execSummary.title')}</h3>
                    <p className="text-muted-foreground text-sm">{t('home.execSummary.subtitle')}</p>
                  </div>
                </div>
                
                <div className="h-[400px] sm:h-[500px] rounded-lg overflow-hidden border border-border mb-6">
                  <PDFViewer
                    fileUrl="https://drive.google.com/file/d/1iGTCO2jI9302wU6QIGsDmfsY5FI3Q_t7/view"
                    title="AGV NEXRUR Pitch Deck"
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('home.execSummary.description')}
                  </p>
                  <Button href={`/${locale}/contact`} variant="outline" size="sm" className='border-1 border-primary text-primary'>
                    {t('actions.requestInfo')}
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Pitch Deck */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="p-4 sm:p-8 h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <FiFile size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{t('home.pitchDeck.title')}</h3>
                      <p className="text-muted-foreground text-sm">{t('home.pitchDeck.subtitle')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{t('common.lastUpdated')}</div>
                    <div className="text-sm font-medium">September 20245</div>
                  </div>
                </div>

                <div className="h-[400px] sm:h-[500px] rounded-lg overflow-hidden border border-border mb-6">
                  <PDFViewer
                    fileUrl="https://drive.google.com/file/d/11N8RXY9NnAQd9bi-nyvCBco2l6c0vZVo/view"
                    title="AGV NEXRUR Pitch Deck"
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('home.pitchDeck.disclaimer')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button variant="outline" size="sm" className='border-1 border-primary text-primary'>
                      {t('actions.downloadPitchDeck')}
                    </Button>
                    <Button href={`/${locale}/contact`} variant="outline" size="sm" className='border-1 border-primary text-primary'>
                      {t('actions.requestInfo')}
                    </Button>
                    <Button href={`/${locale}/contact`} variant="outline" size="sm" className='border-1 border-primary text-primary'>
                      {t('actions.contactBD')}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t('home.resources.title')}
            subtitle={t('home.resources.subtitle')}
            description={t('home.resources.description')}
            className="mb-8 sm:mb-16"
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="p-4 sm:p-6 h-full">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground mb-4 text-sm">{feature.description}</p>
                  <Button href={feature.href} variant="outline" size="sm" className="w-full">
                    {t('actions.explore')}
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              {t('home.cta.title')}
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-8">
              {t('home.cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button href={`/${locale}/contact`} variant="secondary" size="lg" className="w-full sm:w-auto">
                {t('actions.scheduleCall')}
              </Button>
              <Button 
                onClick={() => setIsNDAModalOpen(true)}
                variant="outline" 
                size="lg" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full sm:w-auto"
              >
                {t('contact.nda.request')}
              </Button>
              <Button href={`/${locale}/investor`} variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full sm:w-auto">
                {t('home.cta.accessDataRoom')}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* NDA Modal */}
      <NDAModal 
        isOpen={isNDAModalOpen} 
        onClose={() => setIsNDAModalOpen(false)} 
      />
    </Layout>
  );
}
