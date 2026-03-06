'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';
import { LockClosedIcon, FileTextIcon, CheckCircledIcon } from '@radix-ui/react-icons';
import { Search } from 'lucide-react';
import { useTranslations } from '@/lib/translation-provider';

export function InstitutionalProofSection() {
  const { t } = useTranslations('institutionalProof');
  
  const financialData = [
    {
      metric: t('fixedAssets'),
      rmb: '¥ 14,500,000',
      usd: '≈ $1,980,000',
      notes: 'PV Infrastructure'
    },
    {
      metric: t('netAssets'),
      rmb: '¥ 24,490,000',
      usd: '≈ $3,340,000',
      notes: 'Verified by Balance Sheet (Oct 2025)'
    },
    {
      metric: t('netProfitYTD'),
      rmb: '¥ 6,818,313',
      usd: '≈ $930,000',
      notes: 'Verified Income Statement (Oct 2025)'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '50%',
          left: '50%',
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          filter: 'blur(90px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-12">
            {t('title')} <span className="text-blue-400 italic">{t('titleHighlight')}</span>
          </h2>
        </ScrollAnimation>

        <ScrollAnimation direction="bottom" delay={200}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-bold">{t('metric')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('rmb')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('usd')}</th>
                    <th className="text-left py-4 px-4 text-white font-bold">{t('notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {financialData.map((row, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-semibold" style={{ color: '#4FACFE' }}>{row.metric}</td>
                      <td className="py-4 px-4 text-white font-mono">{row.rmb}</td>
                      <td className="py-4 px-4 font-bold" style={{ color: '#4FACFE' }}>{row.usd}</td>
                      <td className="py-4 px-4 text-white/70 text-sm">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollAnimation>

        {/* Below Table Info */}
        <ScrollAnimation direction="bottom" delay={400}>
          <div className="mt-8 space-y-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-white text-xs sm:text-sm md:text-base">
                <span className="flex items-center gap-2 flex-wrap justify-center text-center">
                  <Search className="w-4 h-4 shrink-0" /> 
                  <span>
                    Currently under due diligence by <span className="font-semibold" style={{ color: '#4FACFE' }}>Guopeng Capital</span> and <span className="font-semibold" style={{ color: '#4FACFE' }}>Pusu Capital</span>.
                  </span>
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20 text-center">
                <p className="font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 text-white text-sm sm:text-base">
                  <LockClosedIcon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> 
                  <span className="break-words">3 of 5 multisig treasury secured</span>
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20 text-center">
                <p className="font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 text-white text-sm sm:text-base">
                  <FileTextIcon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> 
                  <span className="break-words">Beosin Audit in progress</span>
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20 text-center sm:col-span-2 md:col-span-1">
                <p className="font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 text-white text-sm sm:text-base">
                  <CheckCircledIcon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> 
                  <span className="break-words">EU-registered asset structure</span>
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

