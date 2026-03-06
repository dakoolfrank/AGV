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

export default function ESGPage() {
  const { t } = useTranslations();
  // Main document
  const mainDocument = {
    title: t('esg.main.title'),
    description: t('esg.main.description'),
    url: "https://drive.google.com/file/d/1ZXuMQ_J1qk2kO0ikhb7v7A9G5JCyJ-SR/view"
  };

  // Document sections
  const documentSections: DocumentSection[] = [
    {
      title: t('esg.sections.admin.title'),
      description: t('esg.sections.admin.description'),
      documents: [
        {
          title: t('esg.sections.admin.docs.registration.title'),
          description: t('esg.sections.admin.docs.registration.description'),
          url: "https://drive.google.com/file/d/1UpKQf0Is2pK4mMpFRe7n4E5R2Gosuzvs/view?usp=drive_link"
        },
        {
          title: t('esg.sections.admin.docs.lease.title'),
          description: t('esg.sections.admin.docs.lease.description'),
          url: "https://drive.google.com/file/d/1UXijBBnkcNvfgutvGLFW5enBojdg_Uc1/view"
        },
        {
          title: t('esg.sections.admin.docs.jv.title'),
          description: t('esg.sections.admin.docs.jv.description'),
          url: "https://drive.google.com/file/d/1wU09tigbNCNZqlFrvVIWYFhaMly8GXDh/view"
        },
        {
          title: t('esg.sections.admin.docs.dd.title'),
          description: t('esg.sections.admin.docs.dd.description'),
          url: "https://drive.google.com/file/d/1HxNe-6IuSeOTEafhwygbuuJtcLS-fR8X/view"
        }
      ]
    },
    {
      title: t('esg.sections.yichuan.title'),
      description: t('esg.sections.yichuan.description'),
      documents: [
        {
          title: t('esg.sections.yichuan.docs.landTransfer.title'),
          description: t('esg.sections.yichuan.docs.landTransfer.description'),
          url: "https://drive.google.com/file/d/1ntEUKVU2DyQJvf7S6EiQVwBs3Zik8cqq/view"
        },
        {
          title: t('esg.sections.yichuan.docs.edb.title'),
          description: t('esg.sections.yichuan.docs.edb.description'),
          url: "https://drive.google.com/file/d/1u8h-9m52UNpLTr05EIS1ueNeLwZ5zpzn/view"
        },
        {
          title: t('esg.sections.yichuan.docs.nrb.title'),
          description: t('esg.sections.yichuan.docs.nrb.description'),
          url: "https://drive.google.com/file/d/1j5DIpobUMu9830h_oa7YgUi4QN0-dida/view"
        },
        {
          title: t('esg.sections.yichuan.docs.coal.title'),
          description: t('esg.sections.yichuan.docs.coal.description'),
          url: "https://drive.google.com/file/d/1V1UUn5Qm8YFC8HDkEGN-5IyP439luGts/view"
        },
        {
          title: t('esg.sections.yichuan.docs.edbOpinion.title'),
          description: t('esg.sections.yichuan.docs.edbOpinion.description'),
          url: "https://drive.google.com/file/d/1Jat6StbcuNZg9U2My2ShF0w8VQcaoxOV/view"
        },
        {
          title: t('esg.sections.yichuan.docs.drb.title'),
          description: t('esg.sections.yichuan.docs.drb.description'),
          url: "https://drive.google.com/file/d/19pGP79fUdrdLvoMhbDU5kb4VO2Mpa80J/view"
        },
        {
          title: t('esg.sections.yichuan.docs.forestry.title'),
          description: t('esg.sections.yichuan.docs.forestry.description'),
          url: "https://drive.google.com/file/d/1T9KIotVbS-IK3XGTa_PD4qMtraQyd5P4/view"
        },
        {
          title: t('esg.sections.yichuan.docs.epb.title'),
          description: t('esg.sections.yichuan.docs.epb.description'),
          url: "https://drive.google.com/file/d/1jwk-fY_bNvxdIn_jW7AjIolnCWqTuVfb/view"
        }
      ]
    },
    {
      title: t('esg.sections.zhongnan.title'),
      description: t('esg.sections.zhongnan.description'),
      documents: [
        {
          title: t('esg.sections.zhongnan.docs.energy.title'),
          description: t('esg.sections.zhongnan.docs.energy.description'),
          url: "https://drive.google.com/file/d/14oATLDNL95wintBSZAlwvelOe0i4C4lf/view"
        },
        {
          title: t('esg.sections.zhongnan.docs.yichuan.title'),
          description: t('esg.sections.zhongnan.docs.yichuan.description'),
          url: "https://drive.google.com/file/d/1lDZ159lXVQuZSPIyfzXF2sYTGdDZhRXB/view"
        },
        {
          title: t('esg.sections.zhongnan.docs.supplement.title'),
          description: t('esg.sections.zhongnan.docs.supplement.description'),
          url: "https://drive.google.com/file/d/1MNuv_XXGVu17eyCYVRMSmhkhZBP7LEyY/view"
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
            title={t('esg.header.title')}
            subtitle={t('esg.header.subtitle')}
            description={t('esg.header.description')}
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

          {/* ESG Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('esg.metrics.title')}</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">-45%</div>
                  <div className="text-sm text-muted-foreground">{t('esg.metrics.carbon')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">100%</div>
                  <div className="text-sm text-muted-foreground">{t('esg.metrics.renewable')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">95%</div>
                  <div className="text-sm text-muted-foreground">{t('esg.metrics.waste')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">50+</div>
                  <div className="text-sm text-muted-foreground">{t('esg.metrics.verifiedRwa')}</div>
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

          {/* Real-World Asset Verification */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('esg.verification.title')}</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('esg.verification.iot.title')}</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• {t('esg.verification.iot.items.0')}</li>
                    <li>• {t('esg.verification.iot.items.1')}</li>
                    <li>• {t('esg.verification.iot.items.2')}</li>
                    <li>• {t('esg.verification.iot.items.3')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('esg.verification.process.title')}</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• {t('esg.verification.process.items.0')}</li>
                    <li>• {t('esg.verification.process.items.1')}</li>
                    <li>• {t('esg.verification.process.items.2')}</li>
                    <li>• {t('esg.verification.process.items.3')}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Carbon Impact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            className="mt-8"
          >
            <Card className="p-8 bg-primary/5 border-primary/20">
              <h2 className="text-2xl font-semibold mb-4 text-primary">{t('esg.dashboard.title')}</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">2.3M</div>
                  <div className="text-sm text-primary/80">{t('esg.dashboard.co2')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">1,250</div>
                  <div className="text-sm text-primary/80">{t('esg.dashboard.devices')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-primary/80">{t('esg.dashboard.monitoring')}</div>
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
