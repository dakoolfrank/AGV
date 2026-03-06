'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import DocumentCard from '@/components/DocumentCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { FiUsers, FiTrendingUp, FiTarget } from 'react-icons/fi';
import { useTranslations } from '@/hooks/useTranslations';

// Document data structure
interface Document {
  title: string;
  description: string;
  url: string;
  type?: string;
}

interface DocumentSection {
  title: string;
  description: string;
  documents: Document[];
}

export default function SalesMarketingPage() {
  const { t } = useTranslations();
  
  // Main document
  const mainDocument = {
    title: t('salesMarketing.mainDoc.title'),
    description: t('salesMarketing.mainDoc.description'),
    url: "https://drive.google.com/file/d/1pB4Pr29IAIEW1xcu3LDxykQJ7ApY9_hb/view"
  };

  // Document sections
  const documentSections: DocumentSection[] = [
    {
      title: t('salesMarketing.sections.mous.title'),
      description: t('salesMarketing.sections.mous.description'),
      documents: [
        {
          title: t('salesMarketing.sections.mous.docs.pusu.title'),
          description: t('salesMarketing.sections.mous.docs.pusu.description'),
          url: "https://drive.google.com/file/d/1qEDgK2s8Pi93bdjbptna8nClNj4kBZcm/view"
        },
        {
          title: t('salesMarketing.sections.mous.docs.guopeng.title'),
          description: t('salesMarketing.sections.mous.docs.guopeng.description'),
          url: "https://drive.google.com/file/d/1vvWF2U-fwx7ndQnBLZD83xsl23BEFGJX/view"
        },
        {
          title: "国光互补绿电直连合作谅解备忘录（MOU)",
          description: "Memorandum of understanding for green power direct connection, between agrivoltaic generation and AI data center.",
          url: "https://drive.google.com/file/d/1oxcwubBDRW1r-KRPJ89blQ9FUMeP6yBL/view"
        }
      ]
    }
  ];

  return (
    <ProtectedRoute>
      <Layout>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader
              title={t('salesMarketing.header.title')}
              subtitle={t('salesMarketing.header.subtitle')}
              description={t('salesMarketing.header.description')}
              className="mb-16"
            />

            {/* Main Document */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-4">{mainDocument.title}</h2>
                <p className="text-muted-foreground mb-6">
                  {mainDocument.description}
                </p>
                <div>
                  <PDFViewer 
                    className='!h-[70vh]'
                    fileUrl={mainDocument.url} 
                    title={mainDocument.title}
                  />
                </div>
              </Card>
            </motion.div>

            {/* Sales Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('salesMarketing.metrics.title')}</h2>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">$50M+</div>
                    <div className="text-sm text-muted-foreground">{t('salesMarketing.metrics.pipeline')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">15+</div>
                    <div className="text-sm text-muted-foreground">{t('salesMarketing.metrics.partners')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">95%</div>
                    <div className="text-sm text-muted-foreground">{t('salesMarketing.metrics.satisfaction')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                    <div className="text-sm text-muted-foreground">{t('salesMarketing.metrics.support')}</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Document Sections */}
            {documentSections.map((section, sectionIndex) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + sectionIndex * 0.1 }}
                className="mb-16"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold mb-2">{section.title}</h2>
                  <p className="text-muted-foreground">{section.description}</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {section.documents.map((doc, docIndex) => (
                    <motion.div
                      key={doc.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 + sectionIndex * 0.1 + docIndex * 0.05 }}
                    >
                      <DocumentCard
                        title={doc.title}
                        description={doc.description}
                        url={doc.url}
                        type="PDF"
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Sales Strategy Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('salesMarketing.strategy.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiTarget size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('salesMarketing.strategy.market.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('salesMarketing.strategy.market.desc')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiTrendingUp size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('salesMarketing.strategy.growth.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('salesMarketing.strategy.growth.desc')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiUsers size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('salesMarketing.strategy.partnerships.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('salesMarketing.strategy.partnerships.desc')}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>
      </Layout>
    </ProtectedRoute>
  );
}
