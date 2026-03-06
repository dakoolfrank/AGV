"use client";

import { cn } from "@/lib/utils";

interface YesNoToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

export function YesNoToggle({ value, onChange, label }: YesNoToggleProps) {
  return (
    <div className="space-y-3">
      {label && (
        <label className="text-sm font-medium text-white">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "px-6 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer min-w-[80px]",
            value === true
              ? "bg-[#3399FF] text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "px-6 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer min-w-[80px]",
            value === false
              ? "bg-[#3399FF] text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          No
        </button>
      </div>
    </div>
  );
}
