import React from "react";
import { Shield } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { NftCard } from "./NftCard";
import { NftType, ChainId } from "../types";
import { NFT_INFO } from "../constants";
import { PASS_PRICES } from "@/lib/pricing";
import { useTranslations } from "@/hooks/useTranslations";

interface NftSelectionProps {
  selectedChain: ChainId;
  quantities: Record<NftType, number>;
  getMaxSelectableFor: (type: NftType, chain: ChainId) => number;
  onQuantityChange: (type: NftType, value: number) => void;
}

export const NftSelection: React.FC<NftSelectionProps> = ({
  selectedChain,
  quantities,
  getMaxSelectableFor,
  onQuantityChange,
}) => {
  const { t } = useTranslations();
  // DUMMY DATA - Replace with real data
  const getDummyData = (type: NftType) => {
    const data = {
      seed: { mintedCount: 272, totalSupply: 85, endsIn: "2w 3d 5hrs" },
      tree: { mintedCount: 187, totalSupply: 60, endsIn: "1w 4d 2hrs" },
      solar: { mintedCount: 450, totalSupply: 108, endsIn: "3w 1d 8hrs" },
      compute: { mintedCount: 60, totalSupply: 80, endsIn: "2w 5d 3hrs" },
    };
    return data[type];
  };

  return (
    <SectionCard
      icon={Shield}
      iconBg="bg-green-500"
      title={t('minting.selectNftToMint')}
      description={t('minting.chooseQuantity')}
    >
      {/* NFT Selection */}
      <div className="space-y-3 sm:space-y-4">
        {(["seed", "tree", "solar", "compute"] as NftType[]).map((type) => {
          const info = NFT_INFO[type];
          const maxAllowed = getMaxSelectableFor(type, selectedChain);
          const isAvailable = maxAllowed > 0;
          const dummyData = getDummyData(type);
          const price = Number((PASS_PRICES as any)[type]?.usd ?? 0);

          return (
            <NftCard
              key={type}
              type={type}
              info={info}
              quantity={quantities[type]}
              maxAllowed={maxAllowed}
              isAvailable={isAvailable}
              mintedCount={dummyData.mintedCount}
              totalSupply={dummyData.totalSupply}
              endsIn={dummyData.endsIn}
              price={price}
              onQuantityChange={onQuantityChange}
              statusColor="bg-green-500"
            />
          );
        })}
      </div>
    </SectionCard>
  );
};
