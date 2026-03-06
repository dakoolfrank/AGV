"use client";
import React from "react";
import { useTranslations } from "@/hooks/useTranslations";
import { ThreeLayer } from "./ThreeLayer";
import { FileText } from "lucide-react";

export const WhatWeBuilding: React.FC = () => {
    const { t } = useTranslations();
    
    const articles = [
        {
            title: t('whatWeBuilding.assetBackedNFT.title') || 'Asset-Backed NFTs',
            description: t('whatWeBuilding.assetBackedNFT.description') || 'Description for asset-backed NFTs',
        },
        {
            title: t('whatWeBuilding.powerToMint.title') || 'Power to Mint',
            description: t('whatWeBuilding.powerToMint.description') || 'Description for power to mint',
        },
        {
            title: t('whatWeBuilding.dualTokenSystem.title') || 'Dual Token System',
            description: t('whatWeBuilding.dualTokenSystem.description') || 'Description for dual token system',
        },
        {
            title: t('whatWeBuilding.daoCompliance.title') || 'DAO Compliance',
            description: t('whatWeBuilding.daoCompliance.description') || 'Description for DAO compliance',
        }
    ];

    return (
        <ThreeLayer
            title={t('whatWeBuilding.title') || 'What We Are Building'}
            articles={articles}
            icon={<FileText className="text-4xl text-gray-600" />}
        />
    );
};
