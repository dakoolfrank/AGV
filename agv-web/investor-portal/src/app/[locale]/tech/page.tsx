'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import DocumentCard from '@/components/DocumentCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
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

export default function TechPage() {
  const { t } = useTranslations();
  // Main document
  const mainDocument = {
    title: t('tech.mainDoc.title'),
    description: t('tech.mainDoc.description'),
    url: "https://drive.google.com/file/d/1mGqwUxxpJkHuaCjzlhQgnf8nUlLWXC0L/view?usp=drive_link"
  };

  // Document sections
  const documentSections: DocumentSection[] = [
    {
      title: t('tech.sections.ip.title'),
      description: t('tech.sections.ip.description'),
      documents: [
        {
          title: t('tech.sections.ip.docs.powerToMint.title'),
          description: t('tech.sections.ip.docs.powerToMint.description'),
          url: "https://drive.google.com/file/d/1T-SuRerI2noUMrSeaIy7bL6wUCpYKZpU/view"
        },
        {
          title: t('tech.sections.ip.docs.rwaMapping.title'),
          description: t('tech.sections.ip.docs.rwaMapping.description'),
          url: "https://drive.google.com/file/d/1NlumvYZAisfl9sZDZ9c0qeV5FDXcXTZD/view?usp=drive_link"
        }
      ]
    },
    {
      title: t('tech.sections.github.title'),
      description: t('tech.sections.github.description'),
      documents: [
        {
          title: t('tech.sections.github.docs.profile.title'),
          description: t('tech.sections.github.docs.profile.description'),
          url: "https://docs.google.com/document/d/1YjG5OKFfkTjOht3GTaUTMRUiKazyYaMTfjj3NTKhnfM/edit"
        }
      ]
    },
    {
      title: t('tech.sections.pitchDecks.title'),
      description: t('tech.sections.pitchDecks.description'),
      documents: [
        {
          title: t('tech.sections.pitchDecks.docs.bd.title'),
          description: t('tech.sections.pitchDecks.docs.bd.description'),
          url: "https://drive.google.com/file/d/1kVwwThMXEOsAsfsH66yGA_7UFEbmvkAf/view"
        },
        {
          title: t('tech.sections.pitchDecks.docs.institutional.title'),
          description: t('tech.sections.pitchDecks.docs.institutional.description'),
          url: "https://drive.google.com/file/d/11rC_K2nBziNDhDtFdIu-LtdhlGJtgsLB/view"
        },
        {
          title: t('tech.sections.pitchDecks.docs.oilToAi.title'),
          description: t('tech.sections.pitchDecks.docs.oilToAi.description'),
          url: "https://drive.google.com/file/d/1NlWfJ2tjYq8mWH-oXnZAXv4AXXBSUNDN/view"
        },
        {
          title: t('tech.sections.pitchDecks.docs.general.title'),
          description: t('tech.sections.pitchDecks.docs.general.description'),
          url: "https://drive.google.com/file/d/11N8RXY9NnAQd9bi-nyvCBco2l6c0vZVo/view?usp=drive_link"
        }
      ]
    },
    {
      title: t('tech.sections.architecture.title'),
      description: t('tech.sections.architecture.description'),
      documents: [
        {
          title: t('tech.sections.architecture.docs.ecosystem.title'),
          description: t('tech.sections.architecture.docs.ecosystem.description'),
          url: "https://drive.google.com/file/d/1u1yQ5ZVKRHoVKupUULg2mcscZVgV7v9E/view"
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
              title={t('tech.header.title')}
              subtitle={t('tech.header.subtitle')}
              description={t('tech.header.description')}
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

            {/* Technical Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('tech.metrics.title')}</h2>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                    <div className="text-sm text-muted-foreground">{t('tech.metrics.uptime')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">&lt;2s</div>
                    <div className="text-sm text-muted-foreground">{t('tech.metrics.speed')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">256-bit</div>
                    <div className="text-sm text-muted-foreground">{t('tech.metrics.encryption')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                    <div className="text-sm text-muted-foreground">{t('tech.metrics.monitoring')}</div>
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
                        type={doc.url.includes('github') || doc.url.includes('docs.google') ? "LINK" : "PDF"}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Technical Highlights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('tech.highlights.title')}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('tech.highlights.blockchain.title')}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• {t('tech.highlights.blockchain.l2')}</li>
                      <li>• {t('tech.highlights.blockchain.automation')}</li>
                      <li>• {t('tech.highlights.blockchain.interop')}</li>
                      <li>• {t('tech.highlights.blockchain.governance')}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('tech.highlights.iot.title')}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• {t('tech.highlights.iot.realtime')}</li>
                      <li>• {t('tech.highlights.iot.auth')}</li>
                      <li>• {t('tech.highlights.iot.carbon')}</li>
                      <li>• {t('tech.highlights.iot.compliance')}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Technology Stack */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mt-8"
            >
              <Card className="p-8 bg-primary/5 border-primary/20">
                <h2 className="text-2xl font-semibold mb-4 text-primary">{t('tech.stack.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('tech.stack.blockchain')}</div>
                    <div className="text-sm text-primary/80">{t('tech.stack.blockchainDesc')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('tech.stack.iot')}</div>
                    <div className="text-sm text-primary/80">{t('tech.stack.iotDesc')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('tech.stack.aiml')}</div>
                    <div className="text-sm text-primary/80">{t('tech.stack.aimlDesc')}</div>
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
