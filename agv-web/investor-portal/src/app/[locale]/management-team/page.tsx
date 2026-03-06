'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import DocumentCard from '@/components/DocumentCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { FiAward, FiShield, FiTrendingUp } from 'react-icons/fi';
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

export default function ManagementTeamPage() {
  const { t } = useTranslations();
  
  // Main document
  const mainDocument = {
    title: t('managementTeam.mainDoc.title'),
    description: t('managementTeam.mainDoc.description'),
    url: "https://drive.google.com/file/d/1Pt78jE1fzzweAubx_7Q_WR4zQ21v3lv8/view"
  };

  // Document sections (empty for now, can be expanded later)
  const documentSections: DocumentSection[] = [];

  return (
    <ProtectedRoute>
      <Layout>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader
              title={t('managementTeam.header.title')}
              subtitle={t('managementTeam.header.subtitle')}
              description={t('managementTeam.header.description')}
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

            {/* Team Expertise */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('managementTeam.expertise.title')}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">15+</div>
                    <div className="text-sm text-muted-foreground">{t('managementTeam.expertise.years')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">50+</div>
                    <div className="text-sm text-muted-foreground">{t('managementTeam.expertise.projects')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">$2B+</div>
                    <div className="text-sm text-muted-foreground">{t('managementTeam.expertise.managed')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">25+</div>
                    <div className="text-sm text-muted-foreground">{t('managementTeam.expertise.countries')}</div>
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

            {/* Leadership Structure */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('managementTeam.leadership.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiAward size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('managementTeam.leadership.executive.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('managementTeam.leadership.executive.desc')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiShield size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('managementTeam.leadership.board.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('managementTeam.leadership.board.desc')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiTrendingUp size={24} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{t('managementTeam.leadership.advisory.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('managementTeam.leadership.advisory.desc')}</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Governance Principles */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('managementTeam.principles.title')}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold mb-4">{t('managementTeam.principles.transparency.title')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('managementTeam.principles.transparency.desc')}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-4">{t('managementTeam.principles.accountability.title')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('managementTeam.principles.accountability.desc')}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-4">{t('managementTeam.principles.innovation.title')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('managementTeam.principles.innovation.desc')}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-4">{t('managementTeam.principles.sustainability.title')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">{t('managementTeam.principles.sustainability.desc')}</p>
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
