import React from "react";
import { NftType, NftInfo } from "../types";
import { QuantitySelector } from "./QuantitySelector";

interface NftCardProps {
  type: NftType;
  info: NftInfo;
  quantity: number;
  maxAllowed: number;
  isAvailable: boolean;
  mintedCount: number;
  totalSupply: number;
  endsIn: string;
  price: number;
  onQuantityChange: (type: NftType, value: number) => void;
  statusColor: string;
}

export const NftCard: React.FC<NftCardProps> = ({
  type,
  info,
  quantity,
  maxAllowed,
  isAvailable,
  mintedCount,
  totalSupply,
  endsIn,
  price,
  onQuantityChange,
  statusColor,
}) => {
  return (
    <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
      {/* Mobile Layout: Stack vertically */}
      <div className="block sm:hidden space-y-3">
        {/* Name and Description */}
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-300 flex-shrink-0"></div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">{info.name}</h3>
              <div className={`w-2 h-2 ${statusColor} rounded-full`}></div>
            </div>
            <p className="text-xs sm:text-sm text-white/70">{info.description}</p>
          </div>
        </div>
        
        {/* Quantity Selector */}
        <QuantitySelector
          type={type}
          quantity={quantity}
          maxAllowed={maxAllowed}
          isAvailable={isAvailable}
          onQuantityChange={onQuantityChange}
        />
        
        {/* Data Grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs sm:text-sm text-white font-semibold">Price</p>
            <p className="text-xs sm:text-sm text-white">${price}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-white font-semibold">Minted</p>
            <p className="text-xs sm:text-sm text-white">{mintedCount}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-white font-semibold">Supply</p>
            <p className="text-xs sm:text-sm text-white">{totalSupply}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-white font-semibold">Ends In</p>
            <p className="text-xs sm:text-sm text-white">{endsIn}</p>
          </div>
        </div>
      </div>
      
      {/* Desktop Layout: 3 columns */}
      <div className="hidden sm:grid grid-cols-3 items-center">
        {/* First Column: Name and Description */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gray-300 flex-shrink-0"></div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-white">{info.name}</h3>
              <div className={`w-2 h-2 ${statusColor} rounded-full`}></div>
            </div>
            <p className="text-sm text-white/70">{info.description}</p>
          </div>
        </div>
        
        {/* Middle Column: Quantity Selector */}
        <QuantitySelector
          type={type}
          quantity={quantity}
          maxAllowed={maxAllowed}
          isAvailable={isAvailable}
          onQuantityChange={onQuantityChange}
        />
        
        {/* Last Column: Price, Minted, Supply, Ends In */}
        <div className="flex items-center justify-between space-x-6">
          <div className="text-right">
            <p className="text-white font-semibold">Price</p>
            <p className="text-white">${price}</p>
          </div>
          
          <div className="text-right">
            <p className="text-white font-semibold">Minted</p>
            <p className="text-white">{mintedCount}</p>
          </div>
          
          <div className="text-right">
            <p className="text-white font-semibold">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </p>
            <div className="flex items-center justify-between space-x-1">
              <p className="text-white">{totalSupply}</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-white font-semibold">Ends In</p>
            <p className="text-white">{endsIn}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
