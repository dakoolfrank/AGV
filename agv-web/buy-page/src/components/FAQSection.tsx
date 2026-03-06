'use client';

import { useState } from 'react';
import { ScrollAnimation } from '@/components/ScrollAnimation';
import { useTranslations } from '@/lib/translation-provider';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useTranslations('faq');

  // Get FAQs from translations
  const faqs = Array.from({ length: 6 }, (_, i) => ({
    question: t(`questions.${i}.question`),
    answer: t(`questions.${i}.answer`)
  }));

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '12%',
          right: '8%',
          width: '480px',
          height: '480px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(50%, -50%)',
          zIndex: 0,
          filter: 'blur(70px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-4xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              {t('title')} (<span className="text-blue-400 italic">{t('titleHighlight')}</span>)
            </h2>
            <p className="text-lg text-white">
              {t('subtitle')}
            </p>
          </div>
        </ScrollAnimation>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <ScrollAnimation key={index} direction="bottom" delay={index * 100}>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-4 sm:px-6 py-4 text-left flex justify-between items-center hover:bg-white/5 transition-colors animate-glow gap-4"
                >
                  <h3 className="text-base sm:text-lg font-bold text-white flex-1 min-w-0 pr-2">{faq.question}</h3>
                  <svg 
                    className={`w-6 h-6 text-blue-400 transition-transform duration-200 shrink-0 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ minWidth: '24px', minHeight: '24px' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {openIndex === index && (
                  <div className="px-6 pb-4 animate-fade-in-up">
                    <p className="text-white leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
