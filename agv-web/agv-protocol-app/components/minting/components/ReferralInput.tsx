import React from "react";
import { Shield, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";

interface ReferralInputProps {
  kolDigits: string;
  kolLocked: boolean;
  onKolDigitsChange: (value: string) => void;
}

export const ReferralInput: React.FC<ReferralInputProps> = ({
  kolDigits,
  kolLocked,
  onKolDigitsChange,
}) => {
  return (
    <SectionCard
      icon={Shield}
      iconBg="bg-blue-500"
      title="Referral ID"
      description="Input 6 Digit ID (Only input ID provided)"
    >
      <Input
        id="kolDigits"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={kolDigits}
        readOnly={kolLocked}
        onChange={(e) => {
          if (kolLocked) return;
          onKolDigitsChange(e.target.value.replace(/\D/g, "").slice(0, 6));
        }}
        placeholder="E.g 123456"
        className={cn(
          "w-full text-center text-sm sm:text-lg font-mono tracking-wider bg-white/10 border-white/20 text-white placeholder:text-white/50",
          kolLocked && "bg-white/5 cursor-not-allowed"
        )}
      />
      {kolLocked && (
        <p className="text-xs text-white/50 mt-2 flex items-center">
          <Lock className="inline h-3 w-3 mr-1" />
          Locked from referral link
        </p>
      )}
    </SectionCard>
  );
};
