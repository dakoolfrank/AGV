import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useActiveAccount, useActiveWalletChain } from "thirdweb/react";
import { defineChain } from "thirdweb";
import { ChainId, NftType, MintingState, ChainInfo } from "../types";
import { MODE_CAPS_BY_CHAIN, MAX_PER_WALLET, GAS_THRESHOLDS } from "../constants";

export const useMintingState = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  
  // State
  const [selectedChain, setSelectedChain] = useState<ChainId>("56");
  const [mintMode, setMintMode] = useState<"public" | "agent">("public");
  const [quantities, setQuantities] = useState<Record<NftType, number>>({ 
    seed: 0, tree: 0, solar: 0, compute: 0 
  });
  const [isMinting, setIsMinting] = useState(false);
  const [mintProgress, setMintProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [hasInsufficientGas, setHasInsufficientGas] = useState(false);
  const [wlEligible, setWlEligible] = useState(false);
  const [checkingWl, setCheckingWl] = useState(false);
  const [kolDigits, setKolDigits] = useState("");
  const [kolLocked, setKolLocked] = useState(false);
  
  const wlCheckedAddressRef = useRef<string | null>(null);

  // Chains configuration
  const CHAINS = useMemo((): Record<ChainId, ChainInfo> => ({
    "56": { chainId: "56", name: "Binance Smart Chain", symbol: "BNB", chain: defineChain(56) },
    "137": { chainId: "137", name: "Polygon", symbol: "MATIC", chain: defineChain(137) },
    "42161": { chainId: "42161", name: "Arbitrum One", symbol: "ETH", chain: defineChain(42161) },
  }), []);

  // KOL Referral
  const fullKolId = useMemo(() => 
    (kolDigits && kolDigits.length === 6 ? `AGV-KOL${kolDigits}` : ""), 
    [kolDigits]
  );

  // Sale mode logic
  const saleMode: "whitelist" | "public" = wlEligible ? "whitelist" : "public";

  // Helper functions
  const getModeCap = (type: NftType, chain: ChainId) =>
    MODE_CAPS_BY_CHAIN[type][chain][saleMode];

  const getPerWalletMax = (type: NftType, chain: ChainId) =>
    MAX_PER_WALLET[type][chain];

  const getMaxSelectableFor = (type: NftType, chain: ChainId) =>
    Math.min(getPerWalletMax(type, chain), getModeCap(type, chain));

  // Reflect wallet network -> UI selection
  useEffect(() => {
    const activeId = activeChain?.id;
    if (!activeId) return;
    const asStr = String(activeId) as ChainId;
    if (asStr === "56" || asStr === "137" || asStr === "42161") {
      setSelectedChain(asStr);
    }
  }, [activeChain?.id]);

  // KOL ID from URL params
  useEffect(() => {
    const qp = (searchParams?.get("kolId") ?? searchParams?.get("ref") ?? "").trim();
    let digits = "";
    if (qp) digits = (qp.match(/\d{6}/) || [])[0] || "";
    if (!digits && pathname) {
      const m = pathname.match(/\/(\d{6})(?:$|[/?#])/);
      if (m) digits = m[1];
    }
    if (digits) { 
      setKolDigits(digits); 
      setKolLocked(true); 
    }
  }, [searchParams, pathname]);

  return {
    // State
    selectedChain,
    setSelectedChain,
    mintMode,
    setMintMode,
    quantities,
    setQuantities,
    isMinting,
    setIsMinting,
    mintProgress,
    setMintProgress,
    currentStep,
    setCurrentStep,
    hasInsufficientGas,
    setHasInsufficientGas,
    wlEligible,
    setWlEligible,
    checkingWl,
    setCheckingWl,
    kolDigits,
    setKolDigits,
    kolLocked,
    setKolLocked,
    
    // Computed values
    CHAINS,
    fullKolId,
    saleMode,
    account,
    activeChain,
    
    // Helper functions
    getModeCap,
    getPerWalletMax,
    getMaxSelectableFor,
    
    // Refs
    wlCheckedAddressRef,
  };
};
