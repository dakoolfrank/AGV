'use client';

import { ScrollAnimation } from '@/components/ScrollAnimation';

export function MediaTestimonials() {
  const testimonials = [
    {
      source: 'Bloomberg',
      category: 'Mainstream Media',
      quote: 'This is far from an ordinary issuance. PreGVT Group brings "Chinese credit" to the global market through blockchain technology, providing an unprecedented "Chinese solution" for the global circulation of traditional financial assets. This marks the official transition of digital assets from the edge of speculative activities to the core of mainstream finance.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
    },
    {
      source: 'BINANCE.US',
      category: 'Industry Leader',
      quote: 'This points the way for the entire industry: compliance is the only passport to the future. This project sets an impeccable standard for all projects attempting to issue RWA - strong issuing entity, clear regulatory framework, and top-tier technical implementation.',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
    },
    {
      source: 'Hong Kong Monetary Authority (HKMA)',
      category: 'Local Policy',
      quote: 'We extend our congratulations. The successful implementation of this project is the best proof of the vitality of Hong Kong\'s virtual asset regulatory framework (VASP system), further consolidating Hong Kong\'s position as an international financial innovation center. We look forward to seeing more similar compliant innovations in Hong Kong.',
      image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
    },
    {
      source: 'The Wall Street Journal',
      category: 'International Top Media',
      quote: 'Innovation power from the East. Through its unique "state credit plus blockchain" model, this project provides global investors with a new, efficient and transparent channel to access China\'s core assets. It redefines the form of "tokens".',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
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
          width: '750px',
          height: '750px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          filter: 'blur(110px)',
          opacity: 0.9
        }}>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollAnimation direction="bottom" delay={0}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-pulse-slow">
              Media <span className="text-blue-400 italic">Reviews</span>
            </h2>
            <p className="text-lg text-white max-w-4xl mx-auto leading-relaxed">
              Global Recognition for PreGVT
              Celebrated as a breakthrough in real-world asset (RWA) tokenization, PreGVT has earned praise from leading global media, financial institutions, and industry authorities. Following its successful public issuance in Hong Kong (2025), experts hailed it as a milestone merging traditional finance and blockchain innovation, marking the start of a new financial era.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid md:grid-cols-2 gap-8 auto-rows-fr">
          {testimonials.map((testimonial, index) => (
            <ScrollAnimation key={index} direction="bottom" delay={index * 200}>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 h-full flex flex-col">
                <div className="flex items-start space-x-4 mb-6 shrink-0">
                  <div 
                    className="w-16 h-16 rounded-full bg-cover bg-center shrink-0 animate-pulse"
                    style={{ backgroundImage: `url("${testimonial.image}")` }}
                  ></div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{testimonial.source}</h3>
                    <span className="inline-block  text-white px-3 py-1 rounded-full text-lg font-medium border border-white/30">
                      {testimonial.category}
                    </span>
                  </div>
                </div>
                
                <blockquote className="text-white leading-relaxed italic grow">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
