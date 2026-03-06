import React from "react";
import { Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SectionCard } from "./SectionCard";
import { NftType, ChainId } from "../types";
import { NFT_INFO } from "../constants";
import { PASS_PRICES } from "@/lib/pricing";

interface OrderSummaryProps {
  quantities: Record<NftType, number>;
  totalCost: number;
  totalQuantity: number;
  selectedChain: ChainId;
  chains: Record<ChainId, any>;
  isConnected: boolean;
  usdtData?: any;
  nativeData?: any;
  gasInfo?: any;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  quantities,
  totalCost,
  totalQuantity,
  selectedChain,
  chains,
  isConnected,
  usdtData,
  nativeData,
  gasInfo,
}) => {
  return (
    <SectionCard
      icon={Shield}
      title="Summary"
    >
      <div className="space-y-3 sm:space-y-4">
        {(Object.entries(quantities) as [NftType, number][])
          .filter(([, qty]) => qty > 0)
          .map(([type, qty]) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded overflow-hidden bg-white/10 flex-shrink-0">
                <img
                  src={`/${type}pass.jpg`}
                  alt={`${NFT_INFO[type].name} NFT`}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs sm:text-sm text-white">{NFT_INFO[type].name}</span>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm font-medium text-white">
                {qty} × ${Number((PASS_PRICES as any)[type]?.usd ?? 0)}
              </p>
              <p className="text-xs text-white/70">
                ${(qty * Number((PASS_PRICES as any)[type]?.usd ?? 0)).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        {totalQuantity === 0 && (
          <p className="text-xs sm:text-sm text-white/70 text-center py-6 sm:py-8">
            No items selected yet
          </p>
        )}

        {totalQuantity > 0 && (
          <>
            <Separator className="bg-white/20" />
            <div className="flex items-center justify-between font-semibold text-white">
              <span className="text-sm sm:text-base">Total</span>
              <span className="text-sm sm:text-base">${totalCost.toLocaleString()}</span>
            </div>
          </>
        )}

        {isConnected && (
          <p className="text-xs text-white/70 text-center">
            Payment will be processed in {chains[selectedChain].symbol} (USDT equivalent)
          </p>
        )}
        {usdtData?.displayValue && (
          <p className="text-xs text-white/70">
            Your USDT: {usdtData.displayValue} {usdtData.symbol}
          </p>
        )}
        
        {nativeData && gasInfo && (
          <div className="space-y-1">
            <p className="text-xs text-white/70">
              Your {gasInfo.symbol}: {gasInfo.currentGas.toFixed(6)} {gasInfo.symbol}
            </p>
            {gasInfo.isInsufficient && (
              <p className="text-xs text-amber-400">
                ⚠️ Insufficient gas. Minimum required: {gasInfo.minRequired} {gasInfo.symbol}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
};
