'use client';

import Layout from '@/components/Layout';
import SectionHeader from '@/components/SectionHeader';
import Card from '@/components/Card';
import PDFViewer from '@/components/PDFViewer';
import MediaCard from '@/components/MediaCard';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/useTranslations';

// Media data structure
interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface MediaSection {
  title: string;
  description: string;
  media: MediaItem[];
}

export default function DePINPage() {
  const { t } = useTranslations();
  // Main document
  const mainDocument = {
    title: t('depin.main.title'),
    description: t('depin.main.description'),
    url: "https://drive.google.com/file/d/1z4aExNVhK8mMISuO6MPkd-J-ndricRph/view"
  };

  // Media sections
  const mediaSections: MediaSection[] = [
    {
      title: t('depin.sections.landOverview.title'),
      description: t('depin.sections.landOverview.description'),
      media: [
        { url: "https://drive.google.com/file/d/1CXU6V0Rv2FhDvAGdI3aL7XpQl8yyibVC/view", type: "image" },
        { url: "https://drive.google.com/file/d/1lzGjA90Lk342Tz0I5X6kqnj4Buaz_AXs/view", type: "image" },
        { url: "https://drive.google.com/file/d/1L_BlFXHM6K_yBsrVi8IzGiVgEB7phjji/view", type: "image" },
        { url: "https://drive.google.com/file/d/1DcqvwU-CNaJ386IIlcFYpe07gooF93yK/view", type: "image" },
        { url: "https://drive.google.com/file/d/1OUkUS1IuVR3kWVWyhvWfbK32L9-0KmJl/view", type: "image" },
        { url: "https://drive.google.com/file/d/1Ju-aOyRCjjkse4rY9EWAxKhtbttWM-d4/view", type: "image" }
      ]
    },
    {
      title: t('depin.sections.leveling.title'),
      description: t('depin.sections.leveling.description'),
      media: [
        { url: "https://drive.google.com/file/d/1hOv1vDDADP3FSAg7IKQ7pHzixqgRWRUm/view", type: "video" },
        { url: "https://drive.google.com/file/d/1MjtPFbwmWXnjxC_5Yrv6rovezyKn2EDE/view", type: "video" },
        { url: "https://drive.google.com/file/d/133uuJuHvx5U_3Qha-HOyWEC9Q70IOEf1/view", type: "video" },
        { url: "https://drive.google.com/file/d/1FvvwYmjkT5GIRBkRZrabS2oxjEV_Fbhs/view", type: "video" }
      ]
    },
    {
      title: t('depin.sections.trellis.title'),
      description: t('depin.sections.trellis.description'),
      media: [
        { url: "https://drive.google.com/file/d/1E9rEqBGGUo72AKj3IArHQ3S6maizb0QR/view", type: "video" },
        { url: "https://drive.google.com/file/d/1aWTncguE9uHku0IfDERDzNnKoto0J1OO/view?usp=drive_link", type: "video" },
        { url: "https://drive.google.com/file/d/1tZlEMuQjUwI67KqCHqKnIsULR0zUyKX8/view", type: "video" },
        { url: "https://drive.google.com/file/d/1F7OKhqPSrXR6LbnjhiBWASxuqYQXHR4m/view", type: "video" },
        { url: "https://drive.google.com/file/d/1mXVKg5OgGjEnus21xO8NRfAM1S0O09AL/view", type: "video" },
        { url: "https://drive.google.com/file/d/1aJSDe2yzfrtVbjuuoPUKkqoz9KHb9gCM/view", type: "video" }
      ]
    },
    {
      title: t('depin.sections.irrigation.title'),
      description: t('depin.sections.irrigation.description'),
      media: [
        { url: "https://drive.google.com/file/d/1SZD4y4ahUmOD2UaucMaxnmi1gpT96FcN/view", type: "video" },
        { url: "https://drive.google.com/file/d/1NpXGCxx3e5mbEEraDX1a_DQUzkMoPDOf/view", type: "image" },
        { url: "https://drive.google.com/file/d/1cgEef8gYqSI3GogP5ZtXKlP5HKIFU3UX/view", type: "image" },
        { url: "https://drive.google.com/file/d/1loDMOMzvEnWMVTHKiPRjEk2oFoQIl3iH/view", type: "video" },
        { url: "https://drive.google.com/file/d/1lTHgSklcWsiBQ-TZZ3_fyxjmXggrKTsH/view", type: "image" },
        { url: "https://drive.google.com/file/d/1y4TQCk4P-Y6kJlYD4tE7LEcUhcVRaTmJ/view", type: "image" },
        { url: "https://drive.google.com/file/d/1ra9Jp69GxYNLbKQ61U9QkSJV3s7VZigw/view", type: "image" },
        { url: "https://drive.google.com/file/d/1k4ZU136c9sSg3BJALOkAvfylMv9jNMHj/view", type: "image" }
      ]
    },
    {
      title: t('depin.sections.plantation.title'),
      description: t('depin.sections.plantation.description'),
      media: [
        { url: "https://drive.google.com/file/d/1wzGNQGRUO4dAixhsUIiHy8jzYiEpvfTB/view", type: "video" },
        { url: "https://drive.google.com/file/d/14CrE38t6mWDBMj2pGKM3dkxbD97RgCro/view", type: "video" },
        { url: "https://drive.google.com/file/d/1QqCAIGzH4EgXK2NloRJTZlCYe0ZORjGs/view", type: "image" },
        { url: "https://drive.google.com/file/d/1qAg99se5t-ZJXJCiNXtyDumdjCSzz0SY/view", type: "image" }
      ]
    },
    {
      title: t('depin.sections.maintenance.title'),
      description: t('depin.sections.maintenance.description'),
      media: [
        { url: "https://drive.google.com/file/d/1njMxHt4EoPRaWs4pFY-iv4IQdUD0o2CS/view", type: "image" },
        { url: "https://drive.google.com/file/d/1Pv6D10i3ybu3cJPlc8AOvx8kMJT9FqnT/view", type: "image" },
        { url: "https://drive.google.com/file/d/1fxq3-ok4tFpW8_vDil5ZPa-iCcfIhh2f/view", type: "image" },
        { url: "https://drive.google.com/file/d/1Yx2atQOztPQdsP2sodxdpbctw19AP5_G/view", type: "image" },
        { url: "https://drive.google.com/file/d/1FZIDUmpOiYjdz9u40qYHqrLOXkWWvpWT/view", type: "video" },
        { url: "https://drive.google.com/file/d/1QypIb1R1NCjBtnOEK2L9QUL-ipLo7lc6/view", type: "image" },
        { url: "https://drive.google.com/file/d/1g76Ix2znFqf3OUh_H-JojbOwrKx2TewV.view", type: "image" }
      ]
    },
    {
      title: t('depin.sections.agriPv.title'),
      description: t('depin.sections.agriPv.description'),
      media: [
        { url: "https://drive.google.com/file/d/1l1d3_rqG9_JNtDl2FeOVrVhhHKnVbXJN/view", type: "video" },
        { url: "https://drive.google.com/file/d/10m17W1rsSWeYH86xbs3vw-_skjp5vcLS/view", type: "image" },
        { url: "https://drive.google.com/file/d/1oqD1nQ9Dy_9oH5ZbVA9-TzQV4MWW68Q4/view", type: "image" },
        { url: "https://drive.google.com/file/d/1dOfHWfZ_4VXXWAdggTtcqMeAvVkGzxS3/view", type: "image" },
        { url: "https://drive.google.com/file/d/1LmtO_YzOxs3CM4Bq-PvsfJjQJLxZ6Amp/view", type: "image" },
        { url: "https://drive.google.com/file/d/153hppqt0t3YljSYIE4z_vAngzz2ENcVr/view", type: "image" },
        { url: "https://drive.google.com/file/d/1pxUUdLjEJTQvlpPkdQVxzZh88eTVfEYV/view?usp=drive_link", type: "image" },
        { url: "https://drive.google.com/file/d/1G-yfWfLDOMHPCf7zMp93uiVYWk-6DJkK.view", type: "image" },
        { url: "https://drive.google.com/file/d/1y6ZITYDsiJrJnNKEX1fB71jt2V_CxEIi.view", type: "image" },
        { url: "https://drive.google.com/file/d/16hUwnsXRltfovxk7mlfnpbcTXPAozhL4.view", type: "video" },
        { url: "https://drive.google.com/file/d/1GaU4Lr4xNhwsPTVTTK04LJAp9CFDPzD4.view", type: "image" },
        { url: "https://drive.google.com/file/d/1Wjn29dmclu2_ZYSIPIjucIG4azPMeRAG.view", type: "image" },
        { url: "https://drive.google.com/file/d/1qPHlZcNXKeMY8I19qmOztAoS-uq7-R8M.view", type: "video" },
        { url: "https://drive.google.com/file/d/1vIF0KX9N2TwVQYuhYltogPgoEBhxiUlW.view", type: "image" },
        { url: "https://drive.google.com/file/d/1iTHd3iTkCtO3Z5fOJrnQs-GYRfyofrWR.view", type: "video" }
      ]
    },
    {
      title: t('depin.sections.onSite.title'),
      description: t('depin.sections.onSite.description'),
      media: [
        { url: "https://drive.google.com/file/d/1-5C_cx24y54xOwkl5HUes7aJqOHUSo78/view", type: "video" },
        { url: "https://drive.google.com/file/d/1aeXreFwoW6ikUvm5YJiwgExUj56TV0XG/view", type: "image" },
        { url: "https://drive.google.com/file/d/1PiOqr5xbeTCGrH6-H5bZ99Ec7kk-zdeH/view", type: "image" },
        { url: "https://drive.google.com/file/d/1i7RiDM8bJQAclg-Oc51Nz_PEwdhWYD9n/view", type: "image" }
      ]
    },
    {
      title: t('depin.sections.device.title'),
      description: t('depin.sections.device.description'),
      media: [
        { url: "https://drive.google.com/file/d/16-l5y84wkiN5_fHm4_nvGXXospLfXYhq/view", type: "video" },
        { url: "https://drive.google.com/file/d/1F6k1tCMzYYkFBNj_wvJ_hoxrj9ccg0RK/view", type: "video" }
      ]
    },
    {
      title: t('depin.sections.data.title'),
      description: t('depin.sections.data.description'),
      media: [
        { url: "https://drive.google.com/file/d/1d9jM2nmxF_QIAVI4LN6df-VXJ4_Lrubg/view", type: "video" },
        { url: "https://drive.google.com/file/d/1XzCGTj1587YUo3lFN0YRffyLQN_0_QhD/view", type: "video" }
      ]
    }
  ];

  return (
    <Layout>
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title={t('depin.header.title')}
            subtitle={t('depin.header.subtitle')}
            description={t('depin.header.description')}
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

          {/* DePIN Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">{t('depin.metrics.title')}</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">6.42 MW</div>
                  <div className="text-sm text-muted-foreground">{t('depin.metrics.solar')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">100+</div>
                  <div className="text-sm text-muted-foreground">{t('depin.metrics.iot')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">{t('depin.metrics.monitoring')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">100%</div>
                  <div className="text-sm text-muted-foreground">{t('depin.metrics.coverage')}</div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Media Sections */}
          {mediaSections.map((section, sectionIndex) => (
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
                {section.media.map((media, mediaIndex) => (
                  <motion.div
                    key={media.url}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + sectionIndex * 0.1 + mediaIndex * 0.05 }}
                  >
                    <MediaCard
                      url={media.url}
                      type={media.type}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* DePIN Infrastructure Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="mt-16"
          >
            <Card className="p-8 bg-primary/5 border-primary/20">
              <h2 className="text-2xl font-semibold mb-4 text-primary">{t('depin.overview.title')}</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">{t('depin.overview.agricultural.title')}</div>
                  <div className="text-sm text-primary/80">{t('depin.overview.agricultural.desc')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">{t('depin.overview.pv.title')}</div>
                  <div className="text-sm text-primary/80">{t('depin.overview.pv.desc')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">{t('depin.overview.iot.title')}</div>
                  <div className="text-sm text-primary/80">{t('depin.overview.iot.desc')}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}