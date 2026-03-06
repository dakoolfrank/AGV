// Agent system type definitions

export type AgentLevel = 1 | 2; // 1 = Master, 2 = Sub-Agent
export type AgentType = 'master_agent' | 'sub_agent' | null;

export interface AgentAllocation {
  id: string;
  wallet: string; // Lowercase wallet address
  agentLevel: AgentLevel;
  masterAgentId?: string; // For Level-2 agents, the KOL ID of their Master
  masterWallet?: string; // For Level-2 agents, wallet of Master
  preGVTAllocated: number;
  sGVTAllocated: number;
  allocatedAt: Date | string;
  kolId?: string; // Linked KOL profile ID
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AgentSalesTarget {
  id: string;
  agentId: string; // KOL ID
  wallet: string;
  salesTarget: number; // USD target
  actualSales: number; // USD actual (calculated from purchases)
  targetAchievementPct: number; // actualSales / salesTarget
  period?: string; // Optional: for period-based targets
  setBy: string; // Admin email who set it
  setAt: Date | string;
  updatedAt: Date | string;
}

export interface PregvtLockup {
  id: string;
  agentId: string; // KOL ID
  wallet: string;
  totalAllocated: number; // Total preGVT allocated
  lockedAmount: number; // Amount still locked
  releasedAmount: number; // Amount released so far
  lockupStartDate: Date | string | null; // TGE + 6 months (null if TGE not set)
  releaseStartDate: Date | string | null; // When linear release begins
  releaseEndDate: Date | string | null; // When linear release ends (3 months after start)
  salesTarget: number;
  actualSales: number;
  targetAchievementPct: number;
  releaseSchedule: {
    target50: { releasePct: 0.40 }; // 50% target → 40% release
    target100: { releasePct: 0.70 }; // 100% target → 70% release
    target200: { releasePct: 1.00 }; // 200% target → 100% release
  };
  calculatedReleasePct: number; // Based on performance
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface WeeklySettlement {
  id: string;
  period: string; // "2024-W42"
  agentId: string; // KOL ID
  wallet: string;
  totalCommissionUSD: number; // Total commission earned in USD
  usdtPayoutAmount: number; // Amount to pay in USDT (same as USD for now)
  status: 'pending' | 'verified' | 'paid' | 'rejected';
  verifiedBy?: string; // Admin email
  verifiedAt?: Date | string;
  paidAt?: Date | string;
  txHash?: string; // USDT transaction hash
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Agent data for initialization
export interface AgentInitData {
  name: string;
  wallet: string;
  agentLevel: AgentLevel;
  masterName?: string; // For Sub-Agents
  masterWallet?: string; // For Sub-Agents
  email?: string;
}

