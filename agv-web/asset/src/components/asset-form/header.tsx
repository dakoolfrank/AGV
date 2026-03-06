"use client";

import Image from "next/image";
import { useTranslations } from "../../hooks/useTranslations";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AssetFormHeader() {
  const { t, locale } = useTranslations();

  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <Image
          src="/logo.png"
          alt={t("header.alt")}
          width={40}
          height={40}
          className="rounded-lg"
        />
        <h1 className="!text-lg font-bold text-white">{t("header.title")}</h1>
      </div>
      <LanguageSwitcher currentLocale={locale} />
    </header>
  );
}
