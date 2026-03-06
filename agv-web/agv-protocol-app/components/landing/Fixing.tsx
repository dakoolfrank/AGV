"use client";
import React from "react";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image"

export const Fixing: React.FC = () => {
  const { t } = useTranslations();
  
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center">
        {/* Title */}
        <h2 className="text-3xl text-center sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-6 sm:mb-8">
          {t('fixing.title')}
        </h2>
        
        {/* Description */}
        <p
          className="text-base text-[#223256] leading-relaxed max-w-4xl mb-4 sm:mb-8 text-center tracking-wide"
          style={{ wordSpacing: "0.05em" }}
        >
          {t('fixing.description1')}
        </p>
        <p
          className="text-base text-[#223256] leading-relaxed max-w-4xl mb-4 sm:mb-8 text-center tracking-wide"
          style={{ wordSpacing: "0.05em" }}
        >
          {t('fixing.description2')}
        </p>
        <p
          className="text-base text-[#223256] leading-relaxed max-w-4xl mb-4 sm:mb-8 text-center tracking-wide"
          style={{ wordSpacing: "0.05em" }}
        >
          {t('fixing.description3')}
        </p>
      </div>
    </section>
  );
};
