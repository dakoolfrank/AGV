"use client";
import React from "react";
import { useTranslations } from "@/hooks/useTranslations";
import { ThreeLayer } from "./ThreeLayer";
import { FileText } from "lucide-react";

export const HowWeDiffer: React.FC = () => {
    const { t } = useTranslations();
    
    const articles = [
        {
            title: t('howWeDiffer.realAssets.title') || 'Real Assets',
            description: t('howWeDiffer.realAssets.description') || 'Description for real assets',
        },
        {
            title: t('howWeDiffer.tokenization.title') || 'Tokenization',
            description: t('howWeDiffer.tokenization.description') || 'Description for tokenization',
        },
        {
            title: t('howWeDiffer.yieldDistribution.title') || 'Yield Distribution',
            description: t('howWeDiffer.yieldDistribution.description') || 'Description for yield distribution',
        },
        {
            title: t('howWeDiffer.scalableSustainability.title') || 'Scalable Sustainability',
            description: t('howWeDiffer.scalableSustainability.description') || 'Description for scalable sustainability',
        }
    ];

    return (
        <ThreeLayer
            title={t('howWeDiffer.title') || 'How We Differ'}
            articles={articles}
            icon={<FileText className="text-4xl text-gray-600" />}
        />
    );
};
