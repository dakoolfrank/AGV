import React from "react";
import { Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "./SectionCard";
import { MintMode } from "../types";

interface MintingModeSelectorProps {
  mintMode: MintMode;
  onModeChange: (mode: MintMode) => void;
}

export const MintingModeSelector: React.FC<MintingModeSelectorProps> = ({
  mintMode,
  onModeChange,
}) => {
  return (
    <SectionCard
      icon={Zap}
      iconBg="bg-[#F5B300]"
      title="Minting Mode"
      description="Mint NFTs directly from the public collection"
    >
      <div className="bg-white/10 rounded-full p-0">
        <Tabs value={mintMode} onValueChange={(value: string) => onModeChange(value as MintMode)}>
          <TabsList className="grid w-full grid-cols-2 bg-transparent h-auto">
            <TabsTrigger 
              value="public" 
              className="data-[state=active]:bg-[#4FACFE] data-[state=active]:text-white text-white rounded-full text-sm py-3 font-bold"
            >
              Public Mint
            </TabsTrigger>
            <TabsTrigger 
              value="agent"
              className="data-[state=active]:bg-[#4FACFE] data-[state=active]:text-white text-white rounded-full text-sm py-3 font-bold"
            >
              Agent Mint
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </SectionCard>
  );
};
