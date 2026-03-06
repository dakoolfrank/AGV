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

export default function LegalPage() {
  const { t } = useTranslations();
  // Main document
  const mainDocument = {
    title: t('legal.mainDoc.title'),
    description: t('legal.mainDoc.description'),
    url: "https://drive.google.com/file/d/1YBs9KNhi0pht2mQkglykG4_8iNQmnhRd/view"
  };

  // Document sections
  const documentSections: DocumentSection[] = [
    {
      title: t('legal.sections.articles.title'),
      description: t('legal.sections.articles.description'),
      documents: [
        {
          title: t('legal.sections.articles.docs.bviArticles.title'),
          description: t('legal.sections.articles.docs.bviArticles.description'),
          url: "https://drive.google.com/file/d/1VO6wmr2tRIu6oe5GyCDxSiJ1LJXUiKjW/view"
        }
      ]
    },
    {
      title: t('legal.sections.china.title'),
      description: t('legal.sections.china.description'),
      documents: [
        {
          title: t('legal.sections.china.docs.authorization.title'),
          description: t('legal.sections.china.docs.authorization.description'),
          url: "https://drive.google.com/file/d/1AR0hlm23iudg9vhu76Tt_RN068N-CQp8/view"
        },
        {
          title: t('legal.sections.china.docs.boardResolution.title'),
          description: t('legal.sections.china.docs.boardResolution.description'),
          url: "https://drive.google.com/file/d/1wJgiNtARV2disKQOblUb2eT6zjNp9_LE/view"
        },
        {
          title: t('legal.sections.china.docs.compliance.title'),
          description: t('legal.sections.china.docs.compliance.description'),
          url: "https://drive.google.com/file/d/1Ac94emrXNET5E_N_kznhbnvcraXfXr9f/view"
        },
        {
          title: t('legal.sections.china.docs.irrevocable.title'),
          description: t('legal.sections.china.docs.irrevocable.description'),
          url: "https://drive.google.com/file/d/1zRKNFVwFdKfEPJlltW1LWnBskmB4sn5I/view"
        },
        {
          title: t('legal.sections.china.docs.noLitigation.title'),
          description: t('legal.sections.china.docs.noLitigation.description'),
          url: "https://drive.google.com/file/d/1tgKsYSQhYpjRL0jyiSrUtYse4mWSauFg/view"
        },
        {
          title: t('legal.sections.china.docs.tax.title'),
          description: t('legal.sections.china.docs.tax.description'),
          url: "https://drive.google.com/file/d/1vcG1nkJhsdtsb1BnBtz3m0PyprtOuxtN/view"
        }
      ]
    },
    {
      title: t('legal.sections.bvi.title'),
      description: t('legal.sections.bvi.description'),
      documents: [
        {
          title: t('legal.sections.bvi.docs.boardReauth.title'),
          description: t('legal.sections.bvi.docs.boardReauth.description'),
          url: "https://drive.google.com/file/d/16s2tb3ZCrfw3-BUDr7fcZeByyegFTMwZ/view"
        },
        {
          title: t('legal.sections.bvi.docs.chain.title'),
          description: t('legal.sections.bvi.docs.chain.description'),
          url: "https://drive.google.com/file/d/1bcVcuPVfooW1OPRm-Q4IVLvD0QyhnM9h/view?usp=drive_link"
        },
        {
          title: t('legal.sections.bvi.docs.compliance.title'),
          description: t('legal.sections.bvi.docs.compliance.description'),
          url: "https://drive.google.com/file/d/1KmTQ5qbF3B22IAqzRnYj_-6ZPv00RgBM/view"
        },
        {
          title: t('legal.sections.bvi.docs.irrevocable.title'),
          description: t('legal.sections.bvi.docs.irrevocable.description'),
          url: "https://drive.google.com/file/d/1h8bFYZc6bA2ExmeTPXwXdflfEFV-VdsA/view"
        },
        {
          title: t('legal.sections.bvi.docs.kyc.title'),
          description: t('legal.sections.bvi.docs.kyc.description'),
          url: "https://drive.google.com/file/d/1ODXb4uxKYtoJUjJrqXFIDGtakfc-5EL_/view"
        },
        {
          title: t('legal.sections.bvi.docs.noLitigation.title'),
          description: t('legal.sections.bvi.docs.noLitigation.description'),
          url: "https://drive.google.com/file/d/1LDHkr2xd-PyS9-yrljylKLufaeOrSrLL/view"
        },
        {
          title: t('legal.sections.bvi.docs.reauth.title'),
          description: t('legal.sections.bvi.docs.reauth.description'),
          url: "https://drive.google.com/file/d/1mqklbyqi7DVmWR5yfsGNnPGluzQcFEbX/view"
        },
        {
          title: t('legal.sections.bvi.docs.revenue.title'),
          description: t('legal.sections.bvi.docs.revenue.description'),
          url: "https://drive.google.com/file/d/1CdrQf3KMX7dWnOiIdcR5BuBWcv5VzJ_N/view"
        }
      ]
    },
    {
      title: t('legal.sections.nz.title'),
      description: t('legal.sections.nz.description'),
      documents: [
        {
          title: t('legal.sections.nz.docs.coi.title'),
          description: t('legal.sections.nz.docs.coi.description'),
          url: "https://drive.google.com/file/d/1YjTLsm13Z-4I4pg9SdxQyBsN0TNQY_iH/view?usp=drive_link"
        },
        {
          title: t('legal.sections.nz.docs.chain.title'),
          description: t('legal.sections.nz.docs.chain.description'),
          url: "https://drive.google.com/file/d/1NzKP2HuxwkyaLm05rfZqP44QTX_qcAHq/view"
        },
        {
          title: t('legal.sections.nz.docs.extract.title'),
          description: t('legal.sections.nz.docs.extract.description'),
          url: "https://drive.google.com/file/d/1QZhelus1-4TrhgnANevsBjEJQYPXFCXs/view"
        },
        {
          title: t('legal.sections.nz.docs.constitution.title'),
          description: t('legal.sections.nz.docs.constitution.description'),
          url: "https://drive.google.com/file/d/1Zz8BOD14rNn5YzGVkFBLibDFMRhW6a_c/view"
        },
        {
          title: t('legal.sections.nz.docs.reauth.title'),
          description: t('legal.sections.nz.docs.reauth.description'),
          url: "https://drive.google.com/file/d/1_QpJFdrRySDYSm1b8DB3LPwY57xbV3gt/view"
        }
      ]
    },
    {
      title: t('legal.sections.structure.title'),
      description: t('legal.sections.structure.description'),
      documents: [
        {
          title: t('legal.sections.structure.docs.summary.title'),
          description: t('legal.sections.structure.docs.summary.description'),
          url: "https://drive.google.com/file/d/1hGtoKW-iZ2cIGSFZAYIFoMbDRLijo7Bb/view"
        },
        {
          title: t('legal.sections.structure.docs.naati.title'),
          description: t('legal.sections.structure.docs.naati.description'),
          url: "https://drive.google.com/file/d/1SU-FsT6WAk2IHNtDIHlbwn9N26BiN8VU/view"
        },
        {
          title: t('legal.sections.structure.docs.nzstii.title'),
          description: t('legal.sections.structure.docs.nzstii.description'),
          url: "https://drive.google.com/file/d/117pK6bwoasfOAC_Lc25H0-kLTn-VrpFx/view"
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
            title={t('legal.header.title')}
            subtitle={t('legal.header.subtitle')}
            description={t('legal.header.description')}
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

          {/* Compliance Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('legal.compliance.title')}</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('legal.compliance.regulatory')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">{t('legal.compliance.items.bvi')}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">{t('legal.compliance.items.nz')}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm">{t('legal.compliance.items.kyc')}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">{t('legal.compliance.items.cn')}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('legal.structure.title')}</h3>
                  <div className="space-y-2 text-muted-foreground text-sm">
                      <div>• {t('legal.structure.items.bvi')}</div>
                      <div>• {t('legal.structure.items.nz')}</div>
                      <div>• {t('legal.structure.items.cn')}</div>
                      <div>• {t('legal.structure.items.multi')}</div>
                  </div>
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

          {/* Legal Framework */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('legal.framework.title')}</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('legal.framework.governance.title')}</h3>
                  <ul className="space-y-2 text-muted-foreground">
                      <li>• {t('legal.framework.governance.multi')}</li>
                      <li>• {t('legal.framework.governance.bvi')}</li>
                      <li>• {t('legal.framework.governance.nz')}</li>
                      <li>• {t('legal.framework.governance.cn')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('legal.framework.risk.title')}</h3>
                  <ul className="space-y-2 text-muted-foreground">
                      <li>• {t('legal.framework.risk.docs')}</li>
                      <li>• {t('legal.framework.risk.translation')}</li>
                      <li>• {t('legal.framework.risk.monitoring')}</li>
                      <li>• {t('legal.framework.risk.opinions')}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>

            {/* Legal Structure Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mt-8"
            >
              <Card className="p-8 bg-primary/5 border-primary/20">
                <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.overview.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('legal.overview.bvi')}</div>
                    <div className="text-sm text-primary/80">{t('legal.overview.bviDesc')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('legal.overview.nz')}</div>
                    <div className="text-sm text-primary/80">{t('legal.overview.nzDesc')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary mb-2">{t('legal.overview.cn')}</div>
                    <div className="text-sm text-primary/80">{t('legal.overview.cnDesc')}</div>
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
