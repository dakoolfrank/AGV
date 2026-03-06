'use client';

import { useState } from 'react';
import { ScrollAnimation } from '@/components/ScrollAnimation';
import { useTranslations } from '@/lib/translation-provider';

export function NewsletterSection() {
  const { t } = useTranslations('newsletterSection');
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 3000);
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-black">
      {/* Glow Effect */}
      <div 
        className="absolute pointer-events-none" 
        style={{ 
          bottom: '10%',
          left: '50%',
          width: '720px',
          height: '720px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, 50%)',
          zIndex: 0,
          filter: 'blur(105px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 sm:p-12 border border-white/20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Column 1: Newsletter Info */}
              <div className="flex flex-col justify-center">
                <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                  {t('title')}
                </h2>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                  {t('subtitle')}
                </h3>
                <p className="text-lg text-white leading-relaxed">
                  {t('description')}
                </p>
              </div>

              {/* Column 2: Signup Form */}
              <div className="flex flex-col justify-center">
                <h3 className="text-2xl md:text-3xl font-bold text-primary mb-6">
                  {t('signupTitle')}
                </h3>
                <form onSubmit={handleSubscribe} className="w-full">
                  <div className="flex flex-col gap-4">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/80 transition-all duration-300 transform hover:scale-105"
                    >
                      {t('subscribeButton')}
                    </button>
                  </div>
                </form>
                
                {isSubscribed && (
                  <div className="mt-4 p-4 bg-green-500/20 border border-green-400/30 rounded-lg animate-bounce-in">
                    <p className="text-green-400 font-medium">
                      {t('subscriptionSuccess')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
