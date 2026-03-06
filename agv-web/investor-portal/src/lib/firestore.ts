export interface Document {
  title: string;
  description: string;
  fileUrl: string;
  driveFileId?: string; // Google Drive file ID for service account access
  category: "tech" | "financials" | "legal" | "esg" | "brandkit" | "depin" | "sales-marketing" | "management-team";
  // Optional i18n keys to localize title/description via messages JSON
  titleKey?: string;
  descriptionKey?: string;
}

export async function getDocumentsByCategory(category: string): Promise<Document[]> {
  // Dummy static data for now - simulates Firestore responses
  const dummyData: Record<string, Document[]> = {
    tech: [
      {
        title: "AGV Protocol Whitepaper",
        description: "Detailed technical overview and system design of the AGV Protocol infrastructure.",
        titleKey: "docs.tech.whitepaper.title",
        descriptionKey: "docs.tech.whitepaper.description",
        fileUrl: "https://drive.google.com/file/d/1ABC123DEF456GHI789JKL/view",
        driveFileId: "1ABC123DEF456GHI789JKL",
        category: "tech",
      },
      {
        title: "System Architecture Diagram",
        description: "Comprehensive illustration of AGV's on-chain and IoT layers integration.",
        titleKey: "docs.tech.architectureDiagram.title",
        descriptionKey: "docs.tech.architectureDiagram.description",
        fileUrl: "https://drive.google.com/file/d/1XYZ789ABC123DEF456GHI/view",
        driveFileId: "1XYZ789ABC123DEF456GHI",
        category: "tech",
      },
      {
        title: "Smart Contract Audit Report",
        description: "Third-party security audit results and recommendations.",
        titleKey: "docs.tech.audit.title",
        descriptionKey: "docs.tech.audit.description",
        fileUrl: "https://drive.google.com/file/d/1MNO456PQR789STU012VWX/view",
        driveFileId: "1MNO456PQR789STU012VWX",
        category: "tech",
      },
      {
        title: "GitHub Repository Access",
        description: "Public repository containing core protocol implementations.",
        titleKey: "docs.tech.github.title",
        descriptionKey: "docs.tech.github.description",
        fileUrl: "https://github.com/agv-protocol",
        category: "tech",
      },
    ],
    financials: [
      {
        title: "Financial Model Q1 2024",
        description: "Detailed projection and revenue breakdown for Q1 2024.",
        titleKey: "docs.financials.modelQ12024.title",
        descriptionKey: "docs.financials.modelQ12024.description",
        fileUrl: "https://drive.google.com/file/d/1FIN123Q1M2024ABC456DEF/view",
        driveFileId: "1FIN123Q1M2024ABC456DEF",
        category: "financials",
      },
      {
        title: "Valuation Analysis",
        description: "Comprehensive valuation methodology and market analysis.",
        titleKey: "docs.financials.valuation.title",
        descriptionKey: "docs.financials.valuation.description",
        fileUrl: "https://drive.google.com/file/d/1VAL789UATION456ANALYSIS/view",
        driveFileId: "1VAL789UATION456ANALYSIS",
        category: "financials",
      },
      {
        title: "Revenue Forecast 2024-2026",
        description: "Three-year revenue projections and growth assumptions.",
        titleKey: "docs.financials.revenueForecast.title",
        descriptionKey: "docs.financials.revenueForecast.description",
        fileUrl: "https://drive.google.com/file/d/1REV123FORECAST4562024/view",
        driveFileId: "1REV123FORECAST4562024",
        category: "financials",
      },
      {
        title: "Token Economics Model",
        description: "Token distribution, utility, and economic incentives design.",
        titleKey: "docs.financials.tokenEconomics.title",
        descriptionKey: "docs.financials.tokenEconomics.description",
        fileUrl: "https://drive.google.com/file/d/1TOK789ENOMICS123MODEL/view",
        driveFileId: "1TOK789ENOMICS123MODEL",
        category: "financials",
      },
    ],
    legal: [
      {
        title: "Certificate of Incorporation",
        description: "Official incorporation documents and business registration.",
        titleKey: "docs.legal.coi.title",
        descriptionKey: "docs.legal.coi.description",
        fileUrl: "https://drive.google.com/file/d/1INC123ORP456CERT789/view",
        driveFileId: "1INC123ORP456CERT789",
        category: "legal",
      },
      {
        title: "IP Transfer Agreement",
        description: "Intellectual property rights transfer and assignment documents.",
        titleKey: "docs.legal.ipTransfer.title",
        descriptionKey: "docs.legal.ipTransfer.description",
        fileUrl: "https://drive.google.com/file/d/1IPT123RANS456FER789/view",
        driveFileId: "1IPT123RANS456FER789",
        category: "legal",
      },
      {
        title: "Token Sale Agreement",
        description: "Terms and conditions for token purchase and distribution.",
        titleKey: "docs.legal.tokenSale.title",
        descriptionKey: "docs.legal.tokenSale.description",
        fileUrl: "https://drive.google.com/file/d/1TOK123SALE456AGREEMENT/view",
        driveFileId: "1TOK123SALE456AGREEMENT",
        category: "legal",
      },
      {
        title: "Regulatory Compliance Report",
        description: "Legal compliance status and regulatory framework analysis.",
        titleKey: "docs.legal.compliance.title",
        descriptionKey: "docs.legal.compliance.description",
        fileUrl: "https://drive.google.com/file/d/1REG123COMP456LIANCE789/view",
        driveFileId: "1REG123COMP456LIANCE789",
        category: "legal",
      },
    ],
    esg: [
      {
        title: "Sustainability Impact Report",
        description: "Environmental impact assessment and sustainability metrics.",
        titleKey: "docs.esg.impact.title",
        descriptionKey: "docs.esg.impact.description",
        fileUrl: "https://drive.google.com/file/d/1SUS123TAIN456IMPACT789/view",
        driveFileId: "1SUS123TAIN456IMPACT789",
        category: "esg",
      },
      {
        title: "IoT Carbon Footprint Data",
        description: "Real-time carbon emission tracking from IoT devices.",
        titleKey: "docs.esg.carbon.title",
        descriptionKey: "docs.esg.carbon.description",
        fileUrl: "https://drive.google.com/file/d/1IOT123CARBON456FOOTPRINT/view",
        driveFileId: "1IOT123CARBON456FOOTPRINT",
        category: "esg",
      },
      {
        title: "ESG Compliance Framework",
        description: "Environmental, Social, and Governance compliance standards.",
        titleKey: "docs.esg.framework.title",
        descriptionKey: "docs.esg.framework.description",
        fileUrl: "https://drive.google.com/file/d/1ESG123COMP456FRAMEWORK/view",
        driveFileId: "1ESG123COMP456FRAMEWORK",
        category: "esg",
      },
      {
        title: "Real-World Asset Verification",
        description: "Proof of real-world asset backing and verification processes.",
        titleKey: "docs.esg.rwa.title",
        descriptionKey: "docs.esg.rwa.description",
        fileUrl: "https://drive.google.com/file/d/1RWA123VERIF456ICATION/view",
        driveFileId: "1RWA123VERIF456ICATION",
        category: "esg",
      },
    ],
    brandkit: [
      {
        title: "AGV Logo Pack",
        description: "Complete logo variations in multiple formats and sizes.",
        titleKey: "docs.brandkit.logoPack.title",
        descriptionKey: "docs.brandkit.logoPack.description",
        fileUrl: "https://drive.google.com/file/d/1LOG123PACK456AGV789/view",
        driveFileId: "1LOG123PACK456AGV789",
        category: "brandkit",
      },
      {
        title: "Brand Guidelines",
        description: "Comprehensive brand identity guidelines and usage rules.",
        titleKey: "docs.brandkit.guidelines.title",
        descriptionKey: "docs.brandkit.guidelines.description",
        fileUrl: "https://drive.google.com/file/d/1BRAND123GUIDE456LINES/view",
        driveFileId: "1BRAND123GUIDE456LINES",
        category: "brandkit",
      },
      {
        title: "Press Kit Materials",
        description: "Media assets, press releases, and promotional materials.",
        titleKey: "docs.brandkit.pressKit.title",
        descriptionKey: "docs.brandkit.pressKit.description",
        fileUrl: "https://drive.google.com/file/d/1PRESS123KIT456MATERIALS/view",
        driveFileId: "1PRESS123KIT456MATERIALS",
        category: "brandkit",
      },
      {
        title: "Marketing Templates",
        description: "Design templates for presentations and marketing materials.",
        titleKey: "docs.brandkit.templates.title",
        descriptionKey: "docs.brandkit.templates.description",
        fileUrl: "https://drive.google.com/file/d/1MARKET123TEMPL456ATES/view",
        driveFileId: "1MARKET123TEMPL456ATES",
        category: "brandkit",
      },
    ],
    depin: [
      {
        title: "DePin Network Architecture",
        description: "Technical documentation of our decentralized physical infrastructure network.",
        titleKey: "docs.depin.architecture.title",
        descriptionKey: "docs.depin.architecture.description",
        fileUrl: "https://drive.google.com/file/d/1DEPIN123ARCH456TECTURE/view",
        driveFileId: "1DEPIN123ARCH456TECTURE",
        category: "depin",
      },
      {
        title: "Node Deployment Guide",
        description: "Step-by-step guide for deploying and maintaining network nodes.",
        titleKey: "docs.depin.deployment.title",
        descriptionKey: "docs.depin.deployment.description",
        fileUrl: "https://drive.google.com/file/d/1NODE123DEPLOY456MENT/view",
        driveFileId: "1NODE123DEPLOY456MENT",
        category: "depin",
      },
      {
        title: "Network Performance Metrics",
        description: "Real-time network performance data and analytics dashboard.",
        titleKey: "docs.depin.metrics.title",
        descriptionKey: "docs.depin.metrics.description",
        fileUrl: "https://drive.google.com/file/d/1METRICS123PERF456ORMANCE/view",
        driveFileId: "1METRICS123PERF456ORMANCE",
        category: "depin",
      },
    ],
    "sales-marketing": [
      {
        title: "Product_Timeline_(Whitepaper_Excerpts)_v2025.10",
        description: "Comprehensive product timeline and whitepaper excerpts showcasing our roadmap and vision.",
        titleKey: "docs.salesMarketing.timeline.title",
        descriptionKey: "docs.salesMarketing.timeline.description",
        fileUrl: "https://drive.google.com/file/d/1pB4Pr29IAIEW1xcu3LDxykQJ7ApY9_hb/view",
        driveFileId: "1pB4Pr29IAIEW1xcu3LDxykQJ7ApY9_hb",
        category: "sales-marketing",
      },
      {
        title: "朴素资本管理有限公司投资意向书",
        description: "Investment letter of intent from Pu Su Capital Management Co., Ltd.",
        titleKey: "docs.salesMarketing.mou1.title",
        descriptionKey: "docs.salesMarketing.mou1.description",
        fileUrl: "https://drive.google.com/file/d/1qEDgK2s8Pi93bdjbptna8nClNj4kBZcm/view",
        driveFileId: "1qEDgK2s8Pi93bdjbptna8nClNj4kBZcm",
        category: "sales-marketing",
      },
      {
        title: "國鵬投資管理有限公司戰略合作意向書",
        description: "Strategic cooperation letter of intent from Guo Peng Investment Management Co., Ltd.",
        titleKey: "docs.salesMarketing.mou2.title",
        descriptionKey: "docs.salesMarketing.mou2.description",
        fileUrl: "https://drive.google.com/file/d/1vvWF2U-fwx7ndQnBLZD83xsl23BEFGJX/view",
        driveFileId: "1vvWF2U-fwx7ndQnBLZD83xsl23BEFGJX",
        category: "sales-marketing",
      },
    ],
    "management-team": [
      {
        title: "AGV_Protocol_Global_Management_and_Governance_Overview_2025_1",
        description: "Comprehensive overview of AGV Protocol's global management structure and governance framework.",
        titleKey: "docs.managementTeam.governance.title",
        descriptionKey: "docs.managementTeam.governance.description",
        fileUrl: "https://drive.google.com/file/d/1Pt78jE1fzzweAubx_7Q_WR4zQ21v3lv8/view",
        driveFileId: "1Pt78jE1fzzweAubx_7Q_WR4zQ21v3lv8",
        category: "management-team",
      },
    ],
  };

  return dummyData[category] || [];
}

export async function getAllDocuments(): Promise<Document[]> {
  const categories = ["tech", "financials", "legal", "esg", "brandkit", "depin", "sales-marketing", "management-team"];
  const allDocuments: Document[] = [];
  
  for (const category of categories) {
    const documents = await getDocumentsByCategory(category);
    allDocuments.push(...documents);
  }
  
  return allDocuments;
}
