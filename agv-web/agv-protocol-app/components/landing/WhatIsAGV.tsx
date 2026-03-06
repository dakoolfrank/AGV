"use client";
import React from "react";
import { useTranslations } from "@/hooks/useTranslations";
import Image from "next/image"

export const WhatIsAGV: React.FC = () => {
  const { t } = useTranslations();
  
  return (
    <section className="bg-gradient-to-t from-[#4FACFE] to-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-20">
        <div className="flex-1">
          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#223256] mb-6 sm:mb-8">
            {t('whatisagv.title')}
          </h2>

          {/* Description */}
          <p
            className="text-base text-[#223256] leading-relaxed max-w-4xl mb-8 sm:mb-12 tracking-wide"
            style={{ wordSpacing: "0.05em" }}
          >
            {t('whatisagv.description')}
          </p>
        </div>
        
        <div className="flex-1">
          <Image
            src="/solarPanel.png"
            alt="AGV Hero"
            width={1000}
            height={0}
            className="rounded-lg w-full h-[20pc]"
          />
        </div>
        
      </div>
    </section>
  );
};
