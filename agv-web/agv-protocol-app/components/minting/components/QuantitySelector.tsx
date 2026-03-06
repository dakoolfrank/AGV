import React from "react";
import { NftType } from "../types";

interface QuantitySelectorProps {
  type: NftType;
  quantity: number;
  maxAllowed: number;
  isAvailable: boolean;
  onQuantityChange: (type: NftType, value: number) => void;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  type,
  quantity,
  maxAllowed,
  isAvailable,
  onQuantityChange,
}) => {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center space-y-1">
        <div className="flex items-center bg-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
          <button
            onClick={() => onQuantityChange(type, quantity - 1)}
            disabled={quantity <= 0 || !isAvailable}
            className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            -
          </button>
          <input
            type="number"
            min="0"
            max={maxAllowed}
            value={quantity || ""}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onQuantityChange(type, value);
            }}
            disabled={!isAvailable}
            className="w-10 sm:w-12 text-center bg-transparent text-black font-bold text-xs sm:text-sm mx-3 sm:mx-4 border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="0"
          />
          <button
            onClick={() => onQuantityChange(type, quantity + 1)}
            disabled={quantity >= maxAllowed || !isAvailable}
            className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
        <span className="text-white font-bold text-xs">Max {maxAllowed}</span>
      </div>
    </div>
  );
};
