"use client";

import { cn } from "@/lib/utils";

interface OptionSelectorProps {
  options: string[];
  selected: string | null;
  onSelect: (option: string) => void;
  label?: string;
  columns?: number;
  error?: string;
}

export function OptionSelector({ 
  options, 
  selected, 
  onSelect, 
  label,
  columns = 3,
  error
}: OptionSelectorProps) {
  return (
    <div className="space-y-3">
      {label && (
        <label className={cn(
          "text-sm font-medium",
          error ? "text-red-300" : "text-white"
        )}>
          {label}
        </label>
      )}
      <div className={`grid grid-cols-${columns} gap-3 w-full`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
              selected === option
                ? "bg-[#3399FF] text-white"
                : error
                  ? "bg-white/10 text-white border border-red-500 hover:bg-white/20"
                  : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
