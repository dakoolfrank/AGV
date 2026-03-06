'use client';

import { useTranslations } from './TranslationProvider';

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-8 text-center text-primary">
          {t('about.title')}
        </h1>
        
        <div className="space-y-8 text-lg leading-relaxed">
          <section className="bg-card p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold mb-4 text-primary">
              {t('about.whatIsAGV.title')}
            </h2>
            <p className="text-foreground mb-4">
              {t('about.whatIsAGV.description')}
            </p>
          </section>

          <section className="bg-card p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold mb-4 text-primary">
              {t('about.mission.title')}
            </h2>
            <p className="text-foreground mb-4">
              {t('about.mission.description')}
            </p>
          </section>

          <section className="bg-card p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold mb-4 text-primary">
              {t('about.vision.title')}
            </h2>
            <p className="text-foreground mb-4">
              {t('about.vision.description')}
            </p>
          </section>

          <section className="bg-card p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold mb-4 text-primary">
              {t('about.values.title')}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>{t('about.values.transparency')}</li>
              <li>{t('about.values.innovation')}</li>
              <li>{t('about.values.community')}</li>
              <li>{t('about.values.sustainability')}</li>
            </ul>
          </section>

          <section className="bg-card p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold mb-4 text-primary">
              {t('about.technology.title')}
            </h2>
            <p className="text-foreground mb-4">
              {t('about.technology.description')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
