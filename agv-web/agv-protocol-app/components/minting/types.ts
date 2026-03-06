/** ---------------- Types ---------------- **/
export type MintMode = "public" | "agent";
export type ChainId = "56" | "137" | "42161";
export type NftType = "seed" | "tree" | "solar" | "compute";

export interface ChainInfo {
  chainId: ChainId;
  name: string;
  symbol: string;
  chain: any;
}

export interface NftInfo {
  name: string;
  description: string;
  color: string;
}

export interface MintingCap {
  whitelist: number;
  public: number;
}

export interface GasInfo {
  currentGas: number;
  minRequired: number;
  isInsufficient: boolean;
  symbol: string;
}

export interface MintingState {
  selectedChain: ChainId;
  mintMode: MintMode;
  quantities: Record<NftType, number>;
  isMinting: boolean;
  mintProgress: number;
  currentStep: string;
  hasInsufficientGas: boolean;
  wlEligible: boolean;
  checkingWl: boolean;
  kolDigits: string;
  kolLocked: boolean;
}

export interface TransactionState {
  showSpendingModal: boolean;
  showProgressModal: boolean;
  txHash: string;
  progressStage: "approval" | "mint" | "confirming" | "success" | "timeout" | "error";
  pendingApprovalTx: any;
  pendingMintTx: any;
}
