'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import DocumentCard from '@/components/DocumentCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/useTranslations';
import { ReactNode } from 'react';

// Document data structure
interface Document {
  title: string;
  description: string;
  url: string;
  type?: string;
}

// Document section structure - description can be string or ReactNode for JSX content
interface DocumentSection {
  title: string;
  description: string | ReactNode;
  documents: Document[];
}

export default function FinancialsPage() {
  const { t } = useTranslations();
  // Main document
  const mainDocument = {
    title: t('financials.mainDocument.title'),
    description: t('financials.mainDocument.description'),
    url: "https://drive.google.com/file/d/1zSuRXGfmgzzgb_yt6pM_rWHab6JX1fmB/view"
  };

  // Document sections
  const visibleLimit = 5;

  const splitDocs = (docs: Document[]) => {
    const visible = docs.slice(0, visibleLimit);
    const more = docs.length > visibleLimit ? docs.slice(visibleLimit) : undefined;
    return { documents: visible, moreDocuments: more };
  };

  const onChainDocs: Document[] = [
    { title: "日度发电量快照表_10月31日", description: "Daily power generation snapshot - October 31st", url: "https://drive.google.com/file/d/1dAn1IRKBxrD2vAizoGgWZHVisK3OOZEQ/view" },
    { title: "日度发电量快照表_10月31日 (Word Doc)", description: "Daily power generation snapshot - October 31st (Word Document)", url: "https://docs.google.com/document/d/1RzRNIHQYVjaMcNwVJ2R-fbTvIZVacrlW/edit?usp=drive_link&ouid=103368231820708863962&rtpof=true&sd=true" },
    { title: "日度发电量快照表_10月30日", description: "Daily power generation snapshot - October 30th", url: "https://drive.google.com/file/d/1QDx8Z2h2asK-5NiJnw2GWFfdaWm-xRQO/view" },
    { title: "日度发电量快照表_10月29日", description: "Daily power generation snapshot - October 29th", url: "https://drive.google.com/file/d/1ZHT3LSCQH012-m6TXzKsP9pFXCcNrxZo/view" },
    { title: "日度发电量快照表_10月28日", description: "Daily power generation snapshot - October 28th", url: "https://drive.google.com/file/d/1U6-6ZT8EthKW33E4CPA1LPEQOfQl0Uy2/view" },
    { title: "日度发电量快照表_10月27日", description: "Daily power generation snapshot - October 27th", url: "https://drive.google.com/file/d/1OUdSug7ZoOL9OrFU8VMM1KUXM8GZmCHF/view?usp=drive_link" },
    { title: "日度发电量快照表_10月26日", description: "Daily power generation snapshot - October 26th", url: "https://drive.google.com/file/d/1MLGMma--VBwYiBZrdTDCKSdcOvJTgKPG/view" },
    { title: "日度发电量快照表_10月25日", description: "Daily power generation snapshot - October 25th", url: "https://drive.google.com/file/d/1xhHoiXgljZxWc0-3yhdkLtcIPwMJ8nwP/view" },
    { title: "日度发电量快照表_10月24日", description: "Daily power generation snapshot - October 24th", url: "https://drive.google.com/file/d/1hihkL6bZShU6FTTYRVhYizK5lmLMy9yO/view" },
    { title: "日度发电量快照表_10月23日", description: "Daily power generation snapshot - October 23rd", url: "https://drive.google.com/file/d/156Eq2JfslzqFGXZARTXW67K6PFP8-7vJ/view" },
    { title: "日度发电量快照表_10月22日", description: "Daily power generation snapshot - October 22nd", url: "https://drive.google.com/file/d/11Xud71w9T6z0rnn6s4Ai8Dbo31a9i1Oo/view?usp=drive_link" },
    { title: "日度发电量快照表_10月21日", description: "Daily power generation snapshot - October 21st", url: "https://drive.google.com/file/d/1-HfyyP1W71rk-lvT0lKh0n7merZAx7u9/view" },
    { title: "日度发电量快照表_10月20日", description: "Daily power generation snapshot - October 20th", url: "https://drive.google.com/file/d/1PMqwrCQm7ve3njjgSnw3X0ZcTR6jdXVb/view?usp" },
    { title: "日度发电量快照表_10月19日", description: "Daily power generation snapshot - October 19th", url: "https://drive.google.com/file/d/125AHWlvlbE8OFrO-rc2Pc5Lo_p-4E9RL/view" },
    { title: "日度发电量快照表_10月18日", description: "Daily power generation snapshot - October 18th", url: "https://drive.google.com/file/d/1p768iALX8NW7qQlpO_UpWUB1Apm6H8n8/view" },
    { title: "日度发电量快照表_10月17日", description: "Daily power generation snapshot - October 17th", url: "https://drive.google.com/file/d/12DVuw0z8bPgrbmfl0yOYqXVM32Jaw-C6/view" },
    { title: "日度发电量快照表_10月16日", description: "Daily power generation snapshot - October 16th", url: "https://drive.google.com/file/d/1TCmrvCB9OpHZzwA3Gn-uVaaa7HSBAuh0/view" },
    { title: "日度发电量快照表_10月15日", description: "Daily power generation snapshot - October 15th", url: "https://drive.google.com/file/d/1NaFhzdMfNwRLCBxzsd3BECd-Jvv1t9FV/view" },
    { title: "日度发电量快照表_10月14日", description: "Daily power generation snapshot - October 14th", url: "https://drive.google.com/file/d/1yTcYbA6Ljr-aLf8XtXDcrcbjkd3Q7apV/view" },
    { title: "日度发电量快照表_10月13日", description: "Daily power generation snapshot - October 13th", url: "https://drive.google.com/file/d/14gZ_43lb-C7FpO0KsH-7rqRROntDPcdf/view" },
    { title: "日度发电量快照表_10月12日", description: "Daily power generation snapshot - October 12th", url: "https://drive.google.com/file/d/1ospfRukexHunQNVKBVJveN5T8Qp_Ehlx/view" },
    { title: "日度发电量快照表_10月11日", description: "Daily power generation snapshot - October 11th", url: "https://drive.google.com/file/d/1bK238GoE_vc9BktKnU7UF9MGZblLoB0O/view" },
    { title: "日度发电量快照表_10月10日", description: "Daily power generation snapshot - October 10th", url: "https://drive.google.com/file/d/1WffubVm_LT8PObAYI7ddwbVkTrIr4Ixw/view" },
    { title: "日度发电量快照表_10月09日", description: "Daily power generation snapshot - October 9th", url: "https://drive.google.com/file/d/1oMYEoBaEF_UWNOpV0LXqDZU9KcBaeHf4/view" },
    { title: "日度发电量快照表_10月08日", description: "Daily power generation snapshot - October 8th", url: "https://drive.google.com/file/d/1ssYYjXZvYugxF-BpZNRycJGjwxKRU3CR/view" },
    { title: "日度发电量快照表_10月07日", description: "Daily power generation snapshot - October 7th", url: "https://drive.google.com/file/d/1pKI5NsURP9dC2PmtswCtZi-gdlak64ky/view" },
    { title: "日度发电量快照表_10月06日", description: "Daily power generation snapshot - October 6th", url: "https://drive.google.com/file/d/1OyuA6uvA9GwYo3M6ufqPFELgQibE_sn7/view" },
    { title: "日度发电量快照表_10月05日", description: "Daily power generation snapshot - October 5th", url: "https://drive.google.com/file/d/1Y-PrXE2Ci-KJRbSGg8PzwoG19GV7kW_v/view" },
    { title: "日度发电量快照表_10月04日", description: "Daily power generation snapshot - October 4th", url: "https://drive.google.com/file/d/1VjqqErRQmV1LVORx92iiXb_JLVfd0UmT/view" },
    { title: "日度发电量快照表_10月03日", description: "Daily power generation snapshot - October 3rd", url: "https://drive.google.com/file/d/1GUlf-qhUjF4F9QtJguUh8KV7h2VFTrhH/view" },
    { title: "日度发电量快照表_10月02日", description: "Daily power generation snapshot - October 2nd", url: "https://drive.google.com/file/d/14hrBdDW2J-YVkhokPRWLk--FqvArKhQa/view" }
  ];

  const { documents: onChainVisible, moreDocuments: onChainMore } = splitDocs(onChainDocs);

  // description can be string or ReactNode to allow JSX (details) for expandable UI
  const documentSections: DocumentSection[] = [
    {
      title: "Consolidated Audit Report",
      description: "China Commerce Holdings / Zhongshang Puhui Group audit documentation",
      documents: [
        {
          title: "中商普惠公司增资扩股尽调报告(5)",
          description: "China Commerce Holdings due diligence report for capital increase and share expansion",
          url: "https://drive.google.com/file/d/1bjBb_A6sJdGEw6PNBCxL68gTVZewO5YH/view"
        },
        {
          title: "Balance Sheet Original Copy.pdf",
          description: "AGV Protocol balance sheet as of October 2025",
          url: "https://drive.google.com/file/d/10ioydWY8LNwX8pX22nvFZeagNvR6P81j/view"
        },
        {
          title: "Balance Sheet OCT2025.pdf",
          description: "AGV Protocol balance sheet as of October 2025",
          url: "https://drive.google.com/file/d/1IJmdiazPVJuHNONdtlOEON20Zy9nQqmA/view"
        },
        {
          title: "Income Statement Original Copy.pdf",
          description: "AGV Protocol income statement for the period ending October 2025",
          url: "https://drive.google.com/file/d/1WCPiUKrYpV5nkgERwuO546q9_WrloZJO/view"
        },
        {
          title: "Income Statement OCT2025.pdf",
          description: "AGV Protocol income statement for the period ending October 2025",
          url: "https://drive.google.com/file/d/1k_RdnenfxfBXpvsZ1xEBo1pXPNLZIj-d/view"
        }
      ]
    },
    {
      title: "Asset Valuation Report Summary",
      description: "Yinxin Asset Appraisal Co., Ltd. valuation documentation",
      documents: [
        {
          title: "中商普惠公司增资扩股尽调报告(5)",
          description: "Asset valuation and due diligence report for capital increase and share expansion",
          url: "https://drive.google.com/file/d/1bjBb_A6sJdGEw6PNBCxL68gTVZewO5YH/view"
        }
      ]
    },
    {
      title: "On-chain Power Generation Verification (Power-to-Mint Pilot)",
      // show first N in the grid; the rest are inside a collapsible <details> rendered in the description area
      description: (
        <>
          <span>Daily power generation snapshots and verification documentation (first {visibleLimit} shown; expand to view more)</span>
          {onChainMore && (
            <details className="mt-4">
              <summary className="text-sm text-primary cursor-pointer">Show {onChainMore.length} more snapshots</summary>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {onChainMore.map((doc) => (
                  <DocumentCard
                    key={doc.title}
                    title={doc.title}
                    description={doc.description}
                    url={doc.url}
                    type="PDF"
                  />
                ))}
              </div>
            </details>
          )}
        </>
      ),
      documents: onChainVisible
    },
    {
      title: "Integrated Financial Model & Tokenized Valuation",
      description: "Comprehensive financial models and tokenized valuation documentation",
      documents: [
        {
          title: "Dual_Token_rGGP_+_GVT_(Whitepaper_Excerpts)_v2025.10",
          description: "Dual token system whitepaper excerpts covering rGGP and GVT tokens",
          url: "https://drive.google.com/file/d/1wVAcZu7wwtNsK8sx4TuJYqKpRbDsYKeH/view"
        },
        {
          title: "Cap_Table_BVI_SHAREHOLDER_RESOLUTION_V2025.10",
          description: "BVI cap table and shareholder resolution documentation",
          url: "https://drive.google.com/file/d/1RVcIHLbRXmbj7DWaPufXld-G2k7ElyqE/view"
        },
        {
          title: "AGV_Protocol_–_Integrated_Financial_&_Valuation_Report_v2025.10",
          description: "Integrated financial and valuation report for AGV Protocol",
          url: "https://drive.google.com/file/d/116klZMugB6RTx48Ne0nsM-haU_I9T3Ei/view"
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
              title={t('financials.title')}
              subtitle={t('financials.subtitle')}
              description={t('financials.description')}
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

            {/* Key Financial Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('financials.metrics.title')}</h2>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">$2.5T</div>
                    <div className="text-sm text-muted-foreground">{t('financials.metrics.tam')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">25-40%</div>
                    <div className="text-sm text-muted-foreground">{t('financials.metrics.roi')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">$50M</div>
                    <div className="text-sm text-muted-foreground">{t('financials.metrics.seriesA')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">18-24</div>
                    <div className="text-sm text-muted-foreground">{t('financials.metrics.profitability')}</div>
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
                  {typeof section.description === 'string' ? (
                    <p className="text-muted-foreground">{section.description}</p>
                  ) : (
                    <div className="text-muted-foreground">{section.description}</div>
                  )}
                </div>

                <div className={`grid gap-6 ${
                  section.title === "On-chain Power Generation Verification (Power-to-Mint Pilot)" 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                    : "md:grid-cols-2 lg:grid-cols-3"
                }`}>
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

            {/* Revenue Streams */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-16"
            >
              <Card className="p-8">
                <h2 className="text-2xl font-semibold mb-6">{t('financials.revenue.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('financials.revenue.transactionFees')}</h3>
                    <p className="text-muted-foreground text-sm">{t('financials.revenue.transactionFeesDesc')}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('financials.revenue.subscription')}</h3>
                    <p className="text-muted-foreground text-sm">{t('financials.revenue.subscriptionDesc')}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{t('financials.revenue.dataLicensing')}</h3>
                    <p className="text-muted-foreground text-sm">{t('financials.revenue.dataLicensingDesc')}</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Investment Highlights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-8"
            >
              <Card className="p-8 bg-primary/5 border-primary/20">
                <h2 className="text-2xl font-semibold mb-4 text-primary">{t('financials.highlights.title')}</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('financials.highlights.market.title')}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>{t('financials.highlights.market.tam')}</li>
                      <li>{t('financials.highlights.market.demand')}</li>
                      <li>{t('financials.highlights.market.regulatory')}</li>
                      <li>{t('financials.highlights.market.advantage')}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('financials.highlights.projections.title')}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>{t('financials.highlights.projections.roi')}</li>
                      <li>{t('financials.highlights.projections.seriesA')}</li>
                      <li>{t('financials.highlights.projections.profitability')}</li>
                      <li>{t('financials.highlights.projections.revenue')}</li>
                    </ul>
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
