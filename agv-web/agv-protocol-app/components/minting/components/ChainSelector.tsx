import React from "react";
import { Globe } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { ChainId, ChainInfo } from "../types";

interface ChainSelectorProps {
  chains: Record<ChainId, ChainInfo>;
  selectedChain: ChainId;
  onChainSelect: (chainId: ChainId) => void;
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  chains,
  selectedChain,
  onChainSelect,
}) => {
  return (
    <SectionCard
      icon={Globe}
      iconBg="bg-gradient-to-r from-blue-500 to-cyan-500"
      title="Select Network"
    >
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
        {Object.entries(chains).map(([chainId, chain]) => (
          <button
            key={chainId}
            onClick={() => onChainSelect(chainId as ChainId)}
            className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 ${
              selectedChain === chainId 
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25" 
                : "bg-white/5 hover:bg-white/10 border border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="font-semibold text-white">{chain.name}</div>
                <div className="text-xs opacity-70 text-white">{chain.symbol}</div>
              </div>
              {selectedChain === chainId && (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              )}
            </div>
            {selectedChain === chainId && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 animate-pulse"></div>
            )}
          </button>
        ))}
      </div>
    </SectionCard>
  );
};
