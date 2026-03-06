'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { getAllDocuments, Document } from '@/lib/firestore';
import { motion } from 'framer-motion';
import { FiSettings, FiBarChart, FiShield, FiHeart, FiImage, FiCpu, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { useTranslations } from '@/hooks/useTranslations';

export default function InvestorPage() {
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const { t, locale } = useTranslations();

  useEffect(() => {
    const fetchDocuments = async () => {
      const docs = await getAllDocuments();
      setAllDocuments(docs);
    };
    fetchDocuments();
  }, []);

  const categories = [
    {
      name: t('nav.tech'),
      href: `/${locale}/tech`,
      description: t('investor.categories.tech'),
      icon: <FiSettings size={24} />,
      count: allDocuments.filter(doc => doc.category === 'tech').length,
    },
    {
      name: t('nav.financials'),
      href: `/${locale}/financials`,
      description: t('investor.categories.financials'),
      icon: <FiBarChart size={24} />,
      count: allDocuments.filter(doc => doc.category === 'financials').length,
    },
    {
      name: t('nav.legal'),
      href: `/${locale}/legal`,
      description: t('investor.categories.legal'),
      icon: <FiShield size={24} />,
      count: allDocuments.filter(doc => doc.category === 'legal').length,
    },
    {
      name: t('nav.esg'),
      href: `/${locale}/esg`,
      description: t('investor.categories.esg'),
      icon: <FiHeart size={24} />,
      count: allDocuments.filter(doc => doc.category === 'esg').length,
    },
    {
      name: t('nav.brandkit'),
      href: `/${locale}/brandkit`,
      description: t('investor.categories.brandkit'),
      icon: <FiImage size={24} />,
      count: allDocuments.filter(doc => doc.category === 'brandkit').length,
    },
    {
      name: t('nav.depin'),
      href: `/${locale}/depin`,
      description: t('investor.categories.depin'),
      icon: <FiCpu size={24} />,
      count: allDocuments.filter(doc => doc.category === 'depin').length,
    },
    {
      name: t('nav.salesMarketing'),
      href: `/${locale}/sales-marketing`,
      description: t('investor.categories.salesMarketing'),
      icon: <FiTrendingUp size={24} />,
      count: allDocuments.filter(doc => doc.category === 'sales-marketing').length,
    },
    {
      name: t('nav.managementTeam'),
      href: `/${locale}/management-team`,
      description: t('investor.categories.managementTeam'),
      icon: <FiUsers size={24} />,
      count: allDocuments.filter(doc => doc.category === 'management-team').length,
    },
  ];

  return (
    <Layout>
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t('investor.header.title')}
            subtitle={t('investor.header.subtitle')}
            description={t('investor.header.description')}
            className="mb-16"
          />

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('investor.overview.title')}</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">{allDocuments.length}</div>
                  <div className="text-sm text-muted-foreground">{t('investor.overview.totalDocs')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">8</div>
                  <div className="text-sm text-muted-foreground">{t('investor.overview.categories')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">{t('investor.overview.access')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">100%</div>
                  <div className="text-sm text-muted-foreground">{t('investor.overview.transparency')}</div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Categories Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {categories.map((category, index) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="p-6 h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      {category.icon}
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {category.count} {t('common.docs')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{category.description}</p>
                  
                  <Button href={category.href} variant="outline" size="sm" className="w-full">
                    {t('actions.explore')} {category.name}
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Recent Documents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('investor.recent.title')}</h2>
              <div className="space-y-4">
                {allDocuments.slice(0, 5).map((doc) => (
                  <div key={doc.title} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium">{doc.titleKey ? t(doc.titleKey) : doc.title}</h3>
                        <p className="text-sm text-muted-foreground">{doc.descriptionKey ? t(doc.descriptionKey) : doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {doc.category}
                      </span>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Investment Process */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('investor.process.title')}</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <h3 className="font-semibold mb-2">{t('investor.process.steps.review.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('investor.process.steps.review.desc')}</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <h3 className="font-semibold mb-2">{t('investor.process.steps.schedule.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('investor.process.steps.schedule.desc')}</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <h3 className="font-semibold mb-2">{t('investor.process.steps.dd.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('investor.process.steps.dd.desc')}</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary font-bold">4</span>
                  </div>
                  <h3 className="font-semibold mb-2">{t('investor.process.steps.decision.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('investor.process.steps.decision.desc')}</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center"
          >
            <Card className="p-8 bg-primary">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {t('investor.cta.title')}
              </h2>
              <p className="text-white/90 mb-6">
                {t('investor.cta.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button href={`/${locale}/contact`} variant="secondary" size="lg">
                  {t('investor.cta.contact')}
                </Button>
                <Button href={`/${locale}/financials`} variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  {t('investor.cta.viewFinancials')}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
