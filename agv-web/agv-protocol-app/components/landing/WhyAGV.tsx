"use client";
import React from "react";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image"

export const WhyAGV: React.FC = () => {
  const { t } = useTranslations();
  
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center">
        {/* Title */}
        <h2 className="text-3xl text-center sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-6 sm:mb-8">
          {t('whyagv.title')}
        </h2>
        
        {/* Description */}
        <p
          className="text-base text-[#223256] leading-relaxed max-w-4xl mb-8 sm:mb-12 text-center tracking-wide"
          style={{ wordSpacing: "0.05em" }}
        >
          {t('whyagv.description')}
        </p>

        <div className="w-full h-full">
          <Image
            src="/whyAgv.png"
            alt="AGV Hero"
            width={1000}
            height={0}
            className="rounded-lg w-full h-[35pc]"
          />
        </div>
        
      </div>
    </section>
  );
};
