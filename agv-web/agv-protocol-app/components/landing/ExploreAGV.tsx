'use client'
import React, { useState, useEffect } from "react";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image"

export const ExploreAGV: React.FC = () => {
  const { t } = useTranslations();
  
  const carousel = [
    '/landing-car1.png',
    '/landing-car2.png',
    '/landing-car4.png',
  ]

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === carousel.length - 1 ? 0 : prevIndex + 1
      );
    }, 2000); // Change every 2 seconds

    return () => clearInterval(interval);
  }, [carousel.length]);

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center">
        {/* Title */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-6 sm:mb-8">
          {t('exploreagv.title')}
        </h2>
        
        {/* Description */}
        <p
          className="text-base text-[#223256] leading-relaxed max-w-4xl mb-8 sm:mb-12 text-center tracking-wide"
          style={{ wordSpacing: "0.05em" }}
        >
          {t('exploreagv.description')}
        </p>
        
        {/* Carousel Container */}
        <div className="relative w-full h-[30pc] overflow-hidden rounded-lg">
          <div 
            className="flex transition-transform duration-500 ease-in-out h-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {carousel.map((item, index) => (
              <div key={index} className="w-full h-full flex-shrink-0">
                <Image
                  src={item}
                  alt={`AGV Hero ${index + 1}`}
                  width={1000}
                  height={0}
                  className="rounded-lg w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          
          {/* Carousel Indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {carousel.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
        
      </div>
    </section>
  );
};
