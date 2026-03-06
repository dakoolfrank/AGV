'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { useTranslations } from '@/lib/translation-provider';

export function RoadmapSection() {
  const { t } = useTranslations('roadmap');
  
  const roadmapItems = [
    {
      quarter: '2025 Q3',
      title: t('q3Title'),
      description: t('q3Desc')
    },
    {
      quarter: '2025 Q4',
      title: t('q4Title'),
      description: t('q4Desc')
    },
    {
      quarter: '2026 Q1',
      title: t('q1Title'),
      description: t('q1Desc')
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '8%',
          left: '12%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          filter: 'blur(100px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              <span className="text-blue-400 italic">{t('titleHighlight')}</span> {t('title')}
            </h2>
            <p className="text-lg text-white max-w-4xl mx-auto leading-relaxed">
              {t('description')}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation direction="left" delay={200}>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600 rounded-full animate-pulse"></div>

            <div className="space-y-16">
              {roadmapItems.map((item, index) => (
                <ScrollAnimation key={index} direction={index % 2 === 0 ? 'left' : 'right'} delay={index * 300}>
                  <div className={`flex flex-col md:flex-row items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                    <div className={`w-full md:w-1/2 ${index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8 md:text-left'} text-center md:text-left`}>
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 animate-glow">
                        <div className="text-blue-400 font-bold text-lg mb-2 animate-pulse">{item.quarter}</div>
                        <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                        <p className="text-white leading-relaxed">{item.description}</p>
                      </div>
                    </div>

                    {/* Timeline dot */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full border-4 border-white/20 flex items-center justify-center animate-pulse">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>

                    <div className="w-full md:w-1/2"></div>
                  </div>
                </ScrollAnimation>
              ))}
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}