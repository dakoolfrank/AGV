'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';

export function NewsSection() {
  const newsItems = [
    {
      title: 'PreGVT Token Allocation',
      date: '2025-09-11 04:10 PM',
      excerpt: 'PreGVT Token Allocation Token Name: PreGVT Total Supply: 100,000,000 PreGVT I. Overall Allocation (Overview) Presale: 30% — 150,000,000 PreGVT...',
      readMore: true
    },
    {
      title: 'PreGVT Group RWA Token Debut: PreGVT Investment Control RMB Offshore Token Opens New Public Chain Securitization...',
      date: '2025-09-12 08:26 AM',
      excerpt: 'Original link: https://www.jinse.cn/blockchain/3720605.html On August 29, 2025, PreGVT Investment Control (domestic AAA rating, Fitch A-) issued 500 million yuan offshore bonds in Hong Kong...',
      readMore: true
    },
    {
      title: 'World\'s First RWA Public Digital Token Listing, Scale 500 Million, Innovative Offshore Financing Channels',
      date: '2025-09-18 07:15 PM',
      excerpt: 'Original link: https://www.cls.cn/detail/2133367①This digital token exists in Token form from the beginning, not traditional certificate digitization, which is a fundamental change. ②The token is simultaneously listed on MOX (Australia...',
      readMore: true
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          top: '50%',
          left: '7%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          filter: 'blur(75px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              Latest <span className="text-blue-400 italic">News</span>
            </h2>
            <p className="text-lg text-white">
              Stay updated with our latest blog posts and company news
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid md:grid-cols-3 gap-8 auto-rows-fr">
          {newsItems.map((item, index) => (
            <ScrollAnimation key={index} direction="bottom" delay={index * 200}>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                <div className="mb-4 shrink-0">
                  <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">{item.title}</h3>
                  <p className="text-white text-sm mb-4">{item.date}</p>
                </div>
                
                <p className="text-white text-sm leading-relaxed mb-6 line-clamp-3 grow">
                  {item.excerpt}
                </p>
                
                {item.readMore && (
                  <button className="text-white hover:text-white/80 text-sm font-medium transition-colors animate-bounce-gentle shrink-0">
                    Read More →
                  </button>
                )}
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
