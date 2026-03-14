"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { CheckCircle, X, Loader2, ExternalLink, Copy, Wallet, Zap, Shield, Globe, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { thirdwebClient, WalletConnect, WalletStatus } from "@/components/wallet/wallet-connect";
import { useActiveAccount, useWalletBalance, useReadContract, useActiveWalletChain, useSwitchActiveWalletChain } from "thirdweb/react";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NFT_CONTRACTS, USDT_ADDRESSES, USDT_ABI, SEED_ABI, TREE_ABI, SOLAR_ABI, COMPUTE_ABI } from "@/lib/contracts";
import { PASS_PRICES } from "@/lib/pricing";
import { defineChain, getContract, prepareContractCall, sendTransaction, waitForReceipt, sendAndConfirmTransaction } from "thirdweb";
import { parseUnits } from "viem";
import { recordSuccessfulMintStrict } from "@/lib/recordMint";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useTranslations } from "@/hooks/useTranslations";

/** ---------------- Types ---------------- **/
type MintMode = "public" | "agent";
type ChainId = "56" | "137" | "42161";
type NftType = keyof typeof PASS_PRICES;

/** ---------------- Sale Caps & Limits ---------------- **/
const MODE_CAPS_BY_CHAIN: Record<
  NftType,
  Record<ChainId, { whitelist: number; public: number }>
> = {
  seed: {
    "56": { whitelist: 100, public: 250 },
    "137": { whitelist: 50, public: 100 },
    "42161": { whitelist: 50, public: 50 },
  },
  tree: {
    "56": { whitelist: 50, public: 150 },
    "137": { whitelist: 25, public: 50 },
    "42161": { whitelist: 25, public: 50 },
  },
  solar: {
    "56": { whitelist: 100, public: 50 },
    "137": { whitelist: 50, public: 25 },
    "42161": { whitelist: 50, public: 25 },
  },
  compute: {
    "56": { whitelist: 40, public: 10 },
    "137": { whitelist: 29, public: 5 },
    "42161": { whitelist: 29, public: 5 },
  },
} as const;

const MAX_PER_WALLET: Record<NftType, Record<ChainId, number>> = {
  seed: { "56": 3, "137": 3, "42161": 3 },
  tree: { "56": 2, "137": 2, "42161": 2 },
  solar: { "56": 2, "137": 2, "42161": 2 },
  compute: { "56": 1, "137": 1, "42161": 1 },
} as const;

/** ---------------- UI: Spending Cap Modal (kept for parity; not shown) ---------------- **/
interface SpendingCapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  spender: string;
  requestFrom: string;
  spendingCap: string;
  tokenSymbol: string;
  networkFee: string;
}

const SpendingCapModal = ({
  isOpen,
  onClose,
  onConfirm,
  spender,
  requestFrom,
  spendingCap,
  tokenSymbol,
  networkFee,
}: SpendingCapModalProps) => {
  const { t } = useTranslations();
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 50, overflow: "hidden",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "#1f2937", color: "#fff", borderRadius: "1rem", padding: "1.5rem",
          maxWidth: "28rem", width: "90%", margin: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "2rem", height: "2rem", borderRadius: "50%",
                background: "linear-gradient(45deg, #f59e0b, #ef4444)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>!</span>
            </div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", margin: 0 }}>Spending cap request</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "0.25rem" }}
            aria-label={t('minting.closeSpendingCapModal')}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: "#d1d5db", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
          This site wants permission to withdraw your tokens
        </p>

        <div style={{ backgroundColor: "#374151", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
          <h4 style={{ color: "#f3f4f6", fontSize: "0.875rem", fontWeight: "semibold", marginBottom: "0.5rem" }}>
            Estimated changes
          </h4>
          <p style={{ color: "#d1d5db", fontSize: "0.875rem", marginBottom: "1rem" }}>
            You are giving AGV NEXRUR the permission to spend this amount from your account.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "#d1d5db", fontSize: "0.875rem" }}>Spending cap</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#fff", fontWeight: "semibold" }}>{spendingCap}</span>
              <span style={{ color: "#10b981", fontSize: "0.875rem" }}>{tokenSymbol}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Spender</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: "1rem", height: "1rem", borderRadius: "50%", backgroundColor: "#ef4444" }} />
              <span style={{ color: "#fff", fontSize: "0.875rem", fontFamily: "monospace" }}>{spender}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Request from</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: "1rem", height: "1rem", borderRadius: "50%", backgroundColor: "#8b5cf6" }} />
              <span style={{ color: "#fff", fontSize: "0.875rem" }}>agvnexrur.ai/en/mint</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Network fee</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#fff", fontSize: "0.875rem" }}>{networkFee}</span>
              <span style={{ color: "#10b981", fontSize: "0.875rem" }}>USDT</span>
            </div>
          </div>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem" }}>Includes {networkFee} fee</p>
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "0.75rem", backgroundColor: "transparent", color: "#d1d5db",
              border: "1px solid #4b5563", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "0.75rem", backgroundColor: "#2563eb", color: "#fff",
              border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

/** ---------------- UI: Staking Modal ---------------- **/
interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToStaking: () => void;
  mintedNfts: { type: NftType; quantity: number }[];
}

const StakingModal = ({
  isOpen,
  onClose,
  onGoToStaking,
  mintedNfts,
}: StakingModalProps) => {
  const { t } = useTranslations();
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 50, overflow: "hidden",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "#1f2937", color: "#fff", borderRadius: "1rem", padding: "1.5rem",
          maxWidth: "28rem", width: "90%", margin: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "2rem", height: "2rem", borderRadius: "50%",
                background: "linear-gradient(45deg, #10b981, #059669)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <CheckCircle style={{ height: "1rem", width: "1rem", color: "#fff" }} />
            </div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", margin: 0 }}>Minting Successful!</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "0.25rem" }}
            aria-label={t('minting.closeStakingModal')}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "#d1d5db", marginBottom: "1rem", fontSize: "0.875rem" }}>
            Congratulations! You have successfully minted your NFT{`${mintedNfts.length > 1 ? 's' : ''}`}.
          </p>
          
          <div style={{ backgroundColor: "#374151", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
            <h4 style={{ color: "#f3f4f6", fontSize: "0.875rem", fontWeight: "semibold", marginBottom: "0.5rem" }}>
              Minted NFTs
            </h4>
            {mintedNfts.map((nft, index) => (
              <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ color: "#d1d5db", fontSize: "0.875rem" }}>{globalNFT_INFO?.[nft.type]?.name || nft.type}</span>
                <span style={{ color: "#fff", fontSize: "0.875rem", fontWeight: "semibold" }}>×{nft.quantity}</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "#1e40af", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Zap style={{ height: "1rem", width: "1rem", color: "#60a5fa" }} />
              <h4 style={{ color: "#f3f4f6", fontSize: "0.875rem", fontWeight: "semibold" }}>
                Ready to Stake?
              </h4>
            </div>
            <p style={{ color: "#d1d5db", fontSize: "0.75rem" }}>
              Stake your NFTs to earn rewards and unlock additional benefits in the AGV ecosystem.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "0.75rem", backgroundColor: "transparent", color: "#d1d5db",
              border: "1px solid #4b5563", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium",
            }}
          >
            Maybe Later
          </button>
          <button
            onClick={onGoToStaking}
            style={{
              flex: 1, padding: "0.75rem", backgroundColor: "#10b981", color: "#fff",
              border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium",
            }}
          >
            Go to Staking
          </button>
        </div>
      </div>
    </div>
  );
};

/** ---------------- UI: Transaction Progress Modal (kept; disabled) ---------------- **/
interface TransactionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  txHash?: string;
  chainId: ChainId;
  stage: "approval" | "mint" | "confirming" | "success" | "timeout" | "error";
  onVerifyWallet: () => void;
}

const TransactionProgressModal = ({
  isOpen,
  onClose,
  status,
  txHash,
  chainId,
  stage,
  onVerifyWallet,
}: TransactionProgressModalProps) => {
  const { t } = useTranslations();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showTimeoutOption, setShowTimeoutOption] = useState(false);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && (stage === "success" || stage === "error" || showTimeoutOption)) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, stage, showTimeoutOption]);

  const EXPLORERS: Record<ChainId, string> = {
    "56": "https://bscscan.io",
    "137": "https://polygonscan.io",
    "42161": "https://arbiscan.com",
  };
  const explorerBase = EXPLORERS[chainId] ?? "";
  const explorerUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;

  useEffect(() => {
    if (!isOpen || stage === "success") return;
    const timer = setInterval(() => setTimeElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, stage]);

  useEffect(() => {
    if (stage === "confirming" && timeElapsed >= 120) setShowTimeoutOption(true);
  }, [stage, timeElapsed]);

  useEffect(() => {
    if (isOpen) { setTimeElapsed(0); setShowTimeoutOption(false); }
  }, [isOpen]);

  const copyTxHash = async () => {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    toast.success(t('minting.transactionHashCopied'));
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 60, overflow: "hidden",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && (stage === "success" || stage === "error" || showTimeoutOption)) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "#1f2937", color: "#fff", borderRadius: "1rem", padding: "1.5rem",
          maxWidth: "28rem", width: "90%", margin: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {stage === "success" ? (
              <CheckCircle style={{ height: "1.5rem", width: "1.5rem", color: "#10b981" }} />
            ) : stage === "error" ? (
              <AlertTriangle style={{ height: "1.5rem", width: "1.5rem", color: "#ef4444" }} />
            ) : (
              <Loader2 style={{ height: "1.5rem", width: "1.5rem", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            )}
            <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", margin: 0 }}>
              {stage === "success" ? t('minting.transactionSuccessful') : stage === "error" ? t('minting.transactionFailed') : stage === "timeout" ? t('minting.transactionTimeout') : t('minting.transactionProgress')}
            </h3>
          </div>
          {(stage === "success" || stage === "error" || showTimeoutOption) && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "0.25rem" }}
              aria-label={t('minting.closeProgressModal')}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <p style={{ color: "#d1d5db", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{status}</p>
          {timeElapsed > 0 && stage !== "success" && <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Time elapsed: {formatTime(timeElapsed)}</p>}
        </div>

        {txHash && (
          <div style={{ backgroundColor: "#374151", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
            <h4 style={{ color: "#f3f4f6", fontSize: "0.875rem", fontWeight: "semibold", marginBottom: "0.5rem" }}>Transaction Hash</h4>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#10b981", fontSize: "0.75rem", fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>{txHash}</span>
              <button
                onClick={copyTxHash}
                style={{ background: "none", border: "1px solid #4b5563", borderRadius: "0.25rem", padding: "0.25rem", color: "#9ca3af", cursor: "pointer" }}
                aria-label={t('minting.copyTxHash')}
              >
                <Copy size={14} />
              </button>
            </div>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#3b82f6", fontSize: "0.75rem", textDecoration: "none" }}
              >
                View on Explorer
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <div
              style={{
                width: "1rem", height: "1rem", borderRadius: "50%",
                backgroundColor: stage === "approval" ? "#3b82f6" : "#10b981", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {stage === "approval" ? <Loader2 size={8} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={8} />}
            </div>
            <span style={{ fontSize: "0.75rem", color: stage === "approval" ? "#3b82f6" : "#10b981" }}>USDT Approval</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "1rem", height: "1rem", borderRadius: "50%",
                backgroundColor: stage === "mint" || stage === "confirming" ? "#3b82f6" : stage === "success" ? "#10b981" : "#4b5563",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {stage === "mint" || stage === "confirming" ? (
                <Loader2 size={8} style={{ animation: "spin 1s linear infinite" }} />
              ) : stage === "success" ? (
                <CheckCircle size={8} />
              ) : null}
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: stage === "mint" || stage === "confirming" ? "#3b82f6" : stage === "success" ? "#10b981" : "#9ca3af",
              }}
            >
              NFT Mint
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
          {showTimeoutOption && stage === "confirming" && (
            <>
              <p style={{ color: "#fbbf24", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                Transaction is taking longer than expected. This may be due to network congestion.
              </p>
              <button
                onClick={onVerifyWallet}
                style={{
                  width: "100%", padding: "0.75rem", backgroundColor: "#2563eb", color: "#fff",
                  border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium", fontSize: "0.875rem",
                }}
              >
                Check Wallet for NFTs
              </button>
              <p style={{ color: "#9ca3af", fontSize: "0.75rem", textAlign: "center" }}>
                Please check your connected wallet to verify if the NFT was minted successfully
              </p>
            </>
          )}

          {stage === "error" && (
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "0.75rem", backgroundColor: "#ef4444", color: "#fff",
                border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "medium",
              }}
            >
              Close
            </button>
          )}
        </div>

        {stage === "confirming" && !showTimeoutOption && (
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", textAlign: "center" }}>
            Please do not refresh or leave the page. This may take a few minutes.
          </p>
        )}
      </div>
    </div>
  );
};

/** ---------------- NFT metadata (UI only) ---------------- **/
const createNftInfo = (t: (key: string) => string) => ({
  seed: { name: t('minting.nft.seed.name'), description: t('minting.nft.seed.description'), color: "bg-blue-500" },
  tree: { name: t('minting.nft.tree.name'), description: t('minting.nft.tree.description'), color: "bg-green-500" },
  solar: { name: t('minting.nft.solar.name'), description: t('minting.nft.solar.description'), color: "bg-yellow-500" },
  compute: { name: t('minting.nft.compute.name'), description: t('minting.nft.compute.description'), color: "bg-purple-500" },
});

// Global NFT_INFO for use in components
let globalNFT_INFO: ReturnType<typeof createNftInfo> | null = null;

/** Correct USDT decimals per chain (fallback) */
const USDT_DECIMALS_FALLBACK: Record<ChainId, number> = {
  "56": 18,
  "137": 6,
  "42161": 6,
} as const;

/** helper for short addr */
const short = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

export default function ModernMintingInterface() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Create NFT info with translations
  const NFT_INFO = createNftInfo(t);
  
  // Set global NFT_INFO for use in other components
  globalNFT_INFO = NFT_INFO;
  
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();          // current wallet network
  const switchChain = useSwitchActiveWalletChain();
  const isConnected = !!account;
  const chainId = (account as any)?.chain?.id?.toString() || "56";

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<Record<string, { days: number; hours: number; minutes: number; seconds: number }>>({});
  const [endTimes, setEndTimes] = useState<Record<string, Date>>({});

  // Countdown helper functions
  const calculateTimeLeft = (endTime: Date) => {
    const now = new Date().getTime();
    const end = endTime.getTime();
    const difference = end - now;

    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000)
      };
    }
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  };

  const formatTimeLeft = (time: { days: number; hours: number; minutes: number; seconds: number }) => {
    if (time.days > 0) {
      return `${time.days}d ${time.hours}h ${time.minutes}m ${time.seconds}s`;
    } else if (time.hours > 0) {
      return `${time.hours}h ${time.minutes}m ${time.seconds}s`;
    } else if (time.minutes > 0) {
      return `${time.minutes}m ${time.seconds}s`;
    } else {
      return `${time.seconds}s`;
    }
  };

  const isTimeRunningLow = (time: { days: number; hours: number; minutes: number; seconds: number }) => {
    return time.days === 0 && time.hours < 24; // Less than 24 hours remaining
  };

  // Initialize fixed end times once when component mounts
  useEffect(() => {
    const now = new Date();
    const initialEndTimes: Record<string, Date> = {
      seed: new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000) + (30 * 60 * 1000) + (45 * 1000)), // 14 days 5 hours 30 minutes 45 seconds
      tree: new Date(now.getTime() + (21 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (15 * 60 * 1000) + (20 * 1000)), // 21 days 4 hours 15 minutes 20 seconds
      solar: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000) + (1 * 60 * 60 * 1000) + (45 * 60 * 1000) + (10 * 1000)), // 7 days 1 hour 45 minutes 10 seconds
      compute: new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000) + (30 * 60 * 1000) + (5 * 1000)), // 14 days 12 hours 30 minutes 5 seconds
    };
    setEndTimes(initialEndTimes);
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (Object.keys(endTimes).length === 0) return; // Wait for end times to be set

    // Initial calculation
    const initialTimeLeft: Record<string, { days: number; hours: number; minutes: number; seconds: number }> = {};
    (["seed", "tree", "solar", "compute"] as NftType[]).forEach(type => {
      if (endTimes[type]) {
        initialTimeLeft[type] = calculateTimeLeft(endTimes[type]);
      }
    });
    setTimeLeft(initialTimeLeft);

    // Set up interval for updates
    const timer = setInterval(() => {
      const newTimeLeft: Record<string, { days: number; hours: number; minutes: number; seconds: number }> = {};
      
      (["seed", "tree", "solar", "compute"] as NftType[]).forEach(type => {
        if (endTimes[type]) {
          newTimeLeft[type] = calculateTimeLeft(endTimes[type]);
        }
      });
      
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [endTimes]);

  const CHAINS = useMemo(() => ({
    "56": { chainId: "56", name: "Binance Smart Chain", symbol: "BNB", chain: defineChain(56) },
    "137": { chainId: "137", name: "Polygon", symbol: "MATIC", chain: defineChain(137) },
    "42161": { chainId: "42161", name: "Arbitrum One", symbol: "ETH", chain: defineChain(42161) },
  }), []);

  // KOL Referral
  const [kolDigits, setKolDigits] = useState("");
  const [kolLocked, setKolLocked] = useState(false);
  const fullKolId = useMemo(() => (kolDigits && kolDigits.length === 6 ? `AGV-KOL${kolDigits}` : ""), [kolDigits]);

  // State
  const [selectedChain, setSelectedChain] = useState<ChainId>("56");
  const [mintMode, setMintMode] = useState<MintMode>("public"); // UI only; caps are based on wlEligible
  const [quantities, setQuantities] = useState<Record<NftType, number>>({ seed: 0, tree: 0, solar: 0, compute: 0 });
  const [isMinting, setIsMinting] = useState(false);
  const [mintProgress, setMintProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [mintResults, setMintResults] = useState<any[]>([]);
  const [hasInsufficientGas, setHasInsufficientGas] = useState(false);

  const [wlEligible, setWlEligible] = useState(false);
  const [checkingWl, setCheckingWl] = useState(false);
  const wlCheckedAddressRef = useRef<string | null>(null);
  
  const [showSpendingModal, setShowSpendingModal] = useState(false); // not used
  const [showProgressModal, setShowProgressModal] = useState(false); // not used
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [progressStage, setProgressStage] = useState<"approval" | "mint" | "confirming" | "success" | "timeout" | "error">("approval");
  const [pendingApprovalTx, setPendingApprovalTx] = useState<ReturnType<typeof prepareContractCall> | null>(null);
  const [pendingMintTx, setPendingMintTx] = useState<ReturnType<typeof prepareContractCall> | null>(null);

  /** -------- Helpers: sale-mode-aware caps -------- **/
  const saleMode: "whitelist" | "public" = wlEligible ? "whitelist" : "public";

  const getModeCap = (type: NftType, chain: ChainId) =>
    MODE_CAPS_BY_CHAIN[type][chain][saleMode];

  const getPerWalletMax = (type: NftType, chain: ChainId) =>
    MAX_PER_WALLET[type][chain];

  const getMaxSelectableFor = (type: NftType, chain: ChainId) =>
    Math.min(getPerWalletMax(type, chain), getModeCap(type, chain));

  const canSelectNftType = (type: NftType) => {
    // Public NFTs (seed, tree) can always be selected
    if (type === "seed" || type === "tree") return true;
    
    // Whitelist NFTs (solar, compute) can be selected but minting is restricted
    if (type === "solar" || type === "compute") return true;
    
    return false;
  };

  // Calculated totals (using imported PASS_PRICES.usd)
  const totalCost = useMemo(() => {
    return (Object.entries(quantities) as [NftType, number][])
      .reduce((total, [type, qty]) => total + qty * Number((PASS_PRICES as any)[type]?.usd ?? 0), 0);
  }, [quantities]);

  const totalQuantity = useMemo(() => Object.values(quantities).reduce((s, q) => s + q, 0), [quantities]);

  const canMint = useMemo(() => {
    if (!isConnected || hasInsufficientGas) return false;
    if (totalQuantity === 0 || totalCost <= 0) return false;
    // Ensure selected type adheres to current mode cap (defensive)
    const picked = Object.entries(quantities).filter(([, q]) => q > 0);
    if (picked.length !== 1) return false;
    const [pickedType, pickedQty] = picked[0] as [NftType, number];
    const allowed = getMaxSelectableFor(pickedType, selectedChain);
    
    // Check if user is trying to mint whitelist-only NFTs without being whitelisted
    const isWhitelistOnly = pickedType === "solar" || pickedType === "compute";
    if (isWhitelistOnly && !wlEligible) return false;
    
    return allowed > 0 && pickedQty <= allowed;
  }, [isConnected, hasInsufficientGas, totalQuantity, totalCost, quantities, selectedChain, saleMode, wlEligible]);

  const handleQuantityChange = (type: NftType, value: number) => {
    if (!canSelectNftType(type)) return;
    
    const maxAllowed = getMaxSelectableFor(type, selectedChain);
    const newValue = Math.max(0, Math.min(value, maxAllowed));
    setQuantities(prev =>
      newValue > 0
        ? ({ seed: 0, tree: 0, solar: 0, compute: 0, [type]: newValue } as Record<NftType, number>)
        : { ...prev, [type]: newValue }
    );
  };

  const resolveUsdtAddress = (chain: ChainId) => {
    const byString = (USDT_ADDRESSES as Record<string, string>)?.[chain];
    const byNumber = (USDT_ADDRESSES as Record<number, string>)?.[Number(chain)];
    return byString || byNumber || "";
  };

  const resolveNftAddress = (nftType: NftType, chain: ChainId) => {
    const byTypeThenChain =
      (NFT_CONTRACTS as Record<string, Record<string | number, string>>)?.[nftType]?.[chain] ||
      (NFT_CONTRACTS as Record<string, Record<string | number, string>>)?.[nftType]?.[Number(chain)];
    const byChainThenType =
      (NFT_CONTRACTS as Record<string | number, Record<string, string>>)?.[chain]?.[nftType] ||
      (NFT_CONTRACTS as Record<string | number, Record<string, string>>)?.[Number(chain)]?.[nftType];
    return byTypeThenChain || byChainThenType || "";
  };

  /** Reflect wallet network -> UI selection without TS error */
  useEffect(() => {
    const activeId = activeChain?.id;
    if (!activeId) return;
    const asStr = String(activeId) as ChainId;
    if (asStr === "56" || asStr === "137" || asStr === "42161") {
      setSelectedChain(asStr);
    }
  }, [activeChain?.id]);

  const chainInfo = CHAINS[selectedChain];

  const getSelectedNftType = (): NftType => {
    for (const [type, qty] of Object.entries(quantities)) if (qty > 0) return type as NftType;
    return "seed";
  };
  const selectedNftType = getSelectedNftType();

  const contractAddr = resolveNftAddress(selectedNftType, selectedChain);
  const usdtAddr = resolveUsdtAddress(selectedChain);

  const getNftAbi = (nftType: NftType) => {
    switch (nftType) {
      case "seed": return SEED_ABI;
      case "tree": return TREE_ABI;
      case "solar": return SOLAR_ABI;
      case "compute": return COMPUTE_ABI;
      default: return SEED_ABI;
    }
  };

  const nftContract = useMemo(() => contractAddr ? getContract({ client: thirdwebClient, address: contractAddr, chain: chainInfo.chain, abi: getNftAbi(selectedNftType) as any }) : null, [contractAddr, chainInfo.chain, selectedNftType]);
  const usdtContract = useMemo(() => usdtAddr ? getContract({ client: thirdwebClient, address: usdtAddr, chain: chainInfo.chain, abi: USDT_ABI }) : null, [usdtAddr, chainInfo.chain]);

  const { data: usdtDecimalsData } = useReadContract({
    contract: usdtContract!,
    method: "decimals",
    params: [],
    queryOptions: { enabled: !!usdtContract },
  });

  function safeStringifyError(err: unknown) {
    try {
      if (err instanceof Error) {
        const plain: Record<string, unknown> = {};
        Object.getOwnPropertyNames(err).forEach((k) => (plain[k] = (err as any)[k]));
        if ((err as any).cause) plain.cause = safeStringifyError((err as any).cause);
        return JSON.stringify(plain);
      }
      return JSON.stringify(err);
    } catch {
      try { return String(err); } catch { return "Unstringifiable error"; }
    }
  }
  function extractErrorMessage(e: unknown): string {
    const any = e as Record<string, any> | undefined;
    const msg =
      any?.shortMessage || any?.message || any?.reason ||
      any?.error?.data?.message || any?.error?.message ||
      any?.data?.message || any?.details ||
      any?.cause?.shortMessage || any?.cause?.message || any?.cause?.reason;
    if (typeof msg === "string" && msg) return msg;
    return safeStringifyError(e);
  }
  const normalizeError = (e: unknown) => extractErrorMessage(e);

  const usdtBalanceResult = useWalletBalance({ client: thirdwebClient, chain: chainInfo.chain, address: account?.address, tokenAddress: usdtAddr });
  const usdtData = usdtBalanceResult?.data || undefined;

  const nativeBalanceResult = useWalletBalance({ client: thirdwebClient, chain: chainInfo.chain, address: account?.address });
  const nativeData = nativeBalanceResult?.data || undefined;

  const gasInfo = useMemo(() => {
    const GAS_THRESHOLDS: Record<ChainId, number> = { "56": 0.0005, "137": 0.001, "42161": 0.0001 } as const;
    const currentGas = parseFloat(nativeData?.displayValue ?? "0");
    const minRequired = GAS_THRESHOLDS[selectedChain];
    const symbol = CHAINS[selectedChain].symbol;
    console.log({currentGas, minRequired, symbol});
    return { currentGas, minRequired, isInsufficient: currentGas < minRequired, symbol };
  }, [nativeData?.displayValue, selectedChain, CHAINS]);

  useEffect(() => { setHasInsufficientGas(gasInfo.isInsufficient); }, [gasInfo.isInsufficient]);

  useEffect(() => {
    if (!showProgressModal || progressStage === "success" || progressStage === "error") return;
    const timeout = setTimeout(() => {
      if (progressStage === "confirming") {
        setProgressStage("timeout");
        setCurrentStep("Transaction is taking longer than expected. Please check your wallet or try again.");
      }
    }, 300000);
    return () => clearTimeout(timeout);
  }, [showProgressModal, progressStage]);

  useEffect(() => {
    const run = async () => {
      if (!account?.address) { setWlEligible(false); wlCheckedAddressRef.current = null; return; }
      if (wlCheckedAddressRef.current === account.address) return;
      try {
        setCheckingWl(true);
        const res = await fetch(`/api/merkle-proof?address=${account.address}`, { cache: "no-store" });
        let whitelisted = false;
        if (res.ok) {
          const data = await res.json();
          whitelisted = !!data?.whitelisted;
        }
        setWlEligible(whitelisted);
      } catch { setWlEligible(false); }
      finally { setCheckingWl(false); wlCheckedAddressRef.current = account.address; }
    };
    run();
  }, [account?.address]);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  /** ---- Confirmation toast (dark) that resolves/rejects ---- */
  const requestApproveConfirmation = (amount: number, spender?: string, chainName?: string) =>
    new Promise<void>((resolve, reject) => {
      toast.custom((t) => (
        <div className="w-[360px] rounded-xl bg-neutral-900 text-white border border-white/10 shadow-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Confirm USDT approval</p>
              <p className="text-xs text-white/70 mt-1">
                Request from <span className="font-medium">agvnexrur.ai/en/mint</span>{chainName ? ` • ${chainName}` : ""}
              </p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-white/70">Spending cap</span>
                <span className="font-semibold">{amount.toFixed(2)} USDT</span>
              </div>
              {spender && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">Spender</span>
                  <span className="font-mono">{short(spender)}</span>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => { toast.dismiss(t); reject(new Error("User cancelled")); }}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { toast.dismiss(t); resolve(); }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      ), { duration: Infinity });
    });

  const prepareTransactions = async () => {
    if (!account?.address) { toast.error("Please connect your wallet to proceed with minting."); throw new Error("Wallet not connected"); }
    if (!canMint) { toast.error("Please check your minting eligibility."); throw new Error("Not eligible for minting"); }

    const selectedTypes = Object.entries(quantities).filter(([_, qty]) => qty > 0);
    if (selectedTypes.length === 0) throw new Error("Please select at least one NFT to mint");
    if (selectedTypes.length > 1) throw new Error("Please select only one NFT type at a time");
    const [selectedType, selectedQty] = selectedTypes[0] as [NftType, number];
    const nftType = selectedType;
    const quantity = selectedQty;
    if (quantity < 1) throw new Error("Quantity must be at least 1");

    // Defensive re-check against mode caps
    const allowed = getMaxSelectableFor(nftType, selectedChain);
    if (allowed === 0 || quantity > allowed) {
      throw new Error("Selected quantity exceeds current minting cap.");
    }

    if (!isValidAddress(contractAddr)) { const msg = `Missing/invalid NFT contract address for ${nftType} on chain ${selectedChain}`; toast.error(msg); throw new Error(msg); }
    if (!isValidAddress(usdtAddr)) { const msg = `Missing/invalid USDT address on chain ${selectedChain}`; toast.error(msg); throw new Error(msg); }

    const localNft = getContract({ client: thirdwebClient, address: contractAddr, chain: CHAINS[selectedChain].chain, abi: getNftAbi(nftType) as any });
    const localUsdt = getContract({ client: thirdwebClient, address: usdtAddr, chain: CHAINS[selectedChain].chain, abi: USDT_ABI });

    if (fullKolId) { const q = query(collection(db, "kols"), where("kolId", "==", fullKolId)); await getDocs(q).catch(() => void 0); }

    // Ensure wallet is on the app-selected chain
    try {
      const target = CHAINS[selectedChain].chain;
      const currentId = activeChain?.id;
      const targetId = (target as any)?.id ?? parseInt(selectedChain, 10);
      if (!currentId || currentId !== targetId) await switchChain?.(target);
    } catch {
      // ignore; wallet can still prompt during tx
    }

    // Pricing: use USD for UI / approvals via token decimals
    const unitPriceUsd = Number((PASS_PRICES as any)[nftType]?.usd ?? 0);
    const totalCostUsd = quantity * unitPriceUsd;
    const decimals = (typeof usdtDecimalsData === "number" ? usdtDecimalsData : undefined) ?? USDT_DECIMALS_FALLBACK[selectedChain];
    const amountToApprove = parseUnits(String(totalCostUsd), decimals);

    console.debug("USDT approval params", { totalCostUsd, quantity, decimals, amountToApprove: amountToApprove.toString(), usdtAddr, spender: contractAddr, chain: selectedChain });

    const approveTx = prepareContractCall({ contract: localUsdt, method: "approve", params: [contractAddr, amountToApprove] });
    const mintTx = prepareContractCall({ contract: localNft, method: "mint", params: [BigInt(quantity), []] });

    setPendingApprovalTx(approveTx);
    setPendingMintTx(mintTx);

    return { approveTx, mintTx, totalCostUsd, quantity, nftType };
  };

  const handleSpendingCapConfirm = async (txs?: {
    approveTx: ReturnType<typeof prepareContractCall>;
    mintTx: ReturnType<typeof prepareContractCall>;
  }) => {
    try {
      setProgressStage("approval");
      setCurrentStep("Approving USDT spending…");
      setMintProgress(30);
      toast.info("Please approve USDT spending in your wallet.");

      // use txs passed in (fresh), else fall back to state
      const approveToUse = txs?.approveTx ?? pendingApprovalTx;
      const mintToUse    = txs?.mintTx ?? pendingMintTx;

      if (!approveToUse) throw new Error("Approval transaction not prepared");
      const approveRes = await sendTransaction({ transaction: approveToUse, account: account! });
      if (approveRes?.transactionHash) setTxHash(approveRes.transactionHash);

      const approveReceipt = await waitForReceipt({
        client: thirdwebClient,
        chain: chainInfo.chain,
        transactionHash: approveRes.transactionHash,
      });
      if (approveReceipt.status !== "success") throw new Error("Approval failed on-chain");

      toast.success("USDT spending approved. Proceeding with mint…");
      setProgressStage("mint");
      setCurrentStep("Executing mint transaction…");
      setMintProgress(60);

      if (!mintToUse) throw new Error("Mint transaction not prepared");
      const receipt = await sendAndConfirmTransaction({ transaction: mintToUse, account: account! });

      setProgressStage("confirming");
      setMintProgress(85);
      if (receipt?.transactionHash) setTxHash(receipt.transactionHash);

      await handleTransactionSuccess(receipt);
    } catch (error) {
      handleTransactionError(error);
      throw error;
    }
  };

  const handleSpendingCapClose = () => { setShowSpendingModal(false); setIsMinting(false); setCurrentStep(""); setPendingApprovalTx(null); setPendingMintTx(null); };
  const handleProgressClose = () => { setShowProgressModal(false); setProgressStage("approval"); setTxHash(""); setIsMinting(false); setCurrentStep(""); };
  const handleVerifyWallet = () => { toast.success("Please check your connected wallet's NFT collection to verify if the mint was successful"); setTimeout(() => window.location.reload(), 2000); };
  
  const handleStakingModalClose = () => { setShowStakingModal(false); };
  const handleGoToStaking = () => { 
    setShowStakingModal(false); 
    window.location.href = '/staking'; 
  };

  const handleTransactionSuccess = async (receipt: { transactionHash?: string } | null) => {
    setProgressStage("success"); setCurrentStep("Minted successfully!"); setMintProgress(100); setIsMinting(false);
    const currentSelectedType = getSelectedNftType();
    const currentQuantity = quantities[currentSelectedType];
    toast.success(`Successfully minted ${currentQuantity} ${currentSelectedType}Pass NFT${currentQuantity > 1 ? "s" : ""}`);
    try {
      const results = (Object.entries(quantities) as [NftType, number][])
        .filter(([, qty]) => qty > 0)
        .map(([type, qty]) => ({
          type,
          quantity: qty,
          txHash: receipt?.transactionHash || txHash,
          cost: qty * Number((PASS_PRICES as any)[type]?.usd ?? 0),
          kolId: fullKolId || null
        }));
      setMintResults(results); setShowSuccess(true);
      
      // Record mint - only if there's a KOL ID, otherwise skip recording
      if (fullKolId && fullKolId.trim()) {
        await recordSuccessfulMintStrict(db, fullKolId, { address: account?.address!, nftType: currentSelectedType, quantity: currentQuantity, chainId: selectedChain as any, txHash: receipt?.transactionHash || txHash, timestamp: new Date(), mintType: "public" });
        toast.success("Mint recorded successfully");
      } else {
        console.log("No KOL ID provided, skipping mint recording");
      }
    } catch (error) {
      console.error("Error recording mint:", error);
      toast.error("NFT minted successfully");
    }
    
    // Show staking modal after successful mint
    const mintedNfts = (Object.entries(quantities) as [NftType, number][])
      .filter(([, qty]) => qty > 0)
      .map(([type, qty]) => ({ type, quantity: qty }));
    
    setQuantities({ seed: 0, tree: 0, solar: 0, compute: 0});
    setTimeout(() => { 
      setShowProgressModal(false); 
      setProgressStage("approval"); 
      setTxHash(""); 
      setCurrentStep(""); 
      setMintProgress(0);
      setShowStakingModal(true); // Show staking modal
    }, 1200);
  };

  const handleTransactionError = (err: unknown) => {
    const errorMessage = normalizeError(err);
    console.error("Transaction error:", err);
    setCurrentStep(`Error: ${errorMessage}`);
    setIsMinting(false);
    setMintProgress(0);
    setProgressStage("error");
    toast.error(`Transaction failed: ${errorMessage}`);
  };

  const handleMint = async () => {
    try {
      setIsMinting(true);
      setMintProgress(10);
      setCurrentStep("Preparing transaction…");

      const prep = await prepareTransactions();   // { approveTx, mintTx, totalCostUsd, ... }
      setMintProgress(25);
      setCurrentStep("Awaiting your confirmation…");

      // show the dark confirm toast; only continue on Confirm
      await requestApproveConfirmation(prep.totalCostUsd, contractAddr, CHAINS[selectedChain].name);

      // pass the fresh txs to avoid the first-click race
      await handleSpendingCapConfirm({ approveTx: prep.approveTx, mintTx: prep.mintTx });
    } catch (e) {
      if ((e as Error)?.message === "User cancelled") {
        toast.message("Approval cancelled");
      } else {
        toast.error(`Unable to proceed: ${normalizeError(e)}`);
      }
      setIsMinting(false);
      setMintProgress(0);
      setCurrentStep("");
    }
  };

  useEffect(() => {
    const qp = (searchParams?.get("kolId") ?? searchParams?.get("ref") ?? "").trim();
    let digits = "";
    if (qp) digits = (qp.match(/\d{6}/) || [])[0] || "";
    if (!digits && pathname) {
      const m = pathname.match(/\/(\d{6})(?:$|[/?#])/);
      if (m) digits = m[1];
    }
    if (digits) { setKolDigits(digits); setKolLocked(true); }
  }, [searchParams, pathname]);

  const handleCopyReferralLink = () => {
    const link = `${window.location.origin}/mint/${kolDigits}`;
    navigator.clipboard.writeText(link);
    toast.success(t('minting.referralLinkCopied'));
  };

  const getMintButtonText = () => {
    if (isMinting) return t('minting.minting');
    if (hasInsufficientGas) return t('minting.insufficientGas');
    if (!isConnected) return t('minting.connectWallet');
    
    // Check if user is trying to mint whitelist-only NFTs without being whitelisted
    const picked = Object.entries(quantities).filter(([, q]) => q > 0);
    if (picked.length === 1) {
      const [pickedType] = picked[0] as [NftType, number];
      const isWhitelistOnly = pickedType === "solar" || pickedType === "compute";
      if (isWhitelistOnly && !wlEligible) {
        return t('staking.whitelistRequired');
      }
    }
    
    return t('minting.mintNfts');
  };

  const getMintButtonDisabled = () => {
    if (isMinting) return true;
    if (hasInsufficientGas) return true;
    if (!isConnected) return true;
    
    // Check if user is trying to mint whitelist-only NFTs without being whitelisted
    const picked = Object.entries(quantities).filter(([, q]) => q > 0);
    if (picked.length === 1) {
      const [pickedType] = picked[0] as [NftType, number];
      const isWhitelistOnly = pickedType === "solar" || pickedType === "compute";
      if (isWhitelistOnly && !wlEligible) return true;
    }
    
    return !canMint;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Main Content */}
        <div className="grid gap-4 sm:gap-8">
          {/* Minting Interface */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Chain Selection */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg">
                <Globe className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white">{t('minting.selectNetwork')}</h3>
            </div>
            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
              {Object.entries(CHAINS).map(([chainId, chain]) => (
                <button
                  key={chainId}
                  onClick={() => setSelectedChain(chainId as ChainId)}
                  className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                    selectedChain === chainId 
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25" 
                      : "bg-white/5 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-semibold text-white">{chain.name}</div>
                      <div className="text-xs opacity-70 text-white">{chain.symbol}</div>
                    </div>
                    {selectedChain === chainId && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  {selectedChain === chainId && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 animate-pulse"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Minting Mode (UI label only) */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-lg bg-[#F5B300] shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{t('minting.mintingMode')}</h3>
                <p className="text-sm text-white/70">
                  {t('minting.mintingModeDescription')}
                </p>
              </div>
            </div>
            <div className="bg-white/10 rounded-full p-0">
              <Tabs value={mintMode} onValueChange={(value: string) => setMintMode(value as MintMode)}>
                <TabsList className="grid w-full grid-cols-2 bg-transparent h-auto">
                  <TabsTrigger 
                    value="public" 
                    className="data-[state=active]:bg-[#4FACFE] data-[state=active]:text-white text-white rounded-full text-sm py-3 font-bold"
                  >
                    {t('minting.publicMint')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="agent"
                    className="data-[state=active]:bg-[#4FACFE] data-[state=active]:text-white text-white rounded-full text-sm py-3 font-bold"
                  >
                    {t('minting.agentMint')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* NFT Selection */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 rounded-lg bg-green-500 shadow-lg">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-white">{t('minting.selectNftToMint')}</h3>
                <p className="text-xs sm:text-sm text-white/70">{t('minting.chooseQuantity')}</p>
              </div>
            </div>

            {/* Agent Mint - Coming Soon */}
            {mintMode === "agent" && (
              <div className="text-center py-12 sm:py-16">
                <div className="mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('minting.agentMintComingSoon')}</h3>
                  <p className="text-sm sm:text-base text-white/70 max-w-md mx-auto">
                    {t('minting.agentMintDescription')}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => setMintMode("public")}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-2"
                  >
                    {t('minting.switchToPublicMint')}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Public Mint Section */}
            {mintMode === "public" && (
              <div className="mb-4 sm:mb-6">
              <h4 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{t('minting.publicMint')}</h4>
              <div className="space-y-3 sm:space-y-4">
                {(["seed", "tree"] as NftType[]).map((type) => {
                  const info = NFT_INFO[type];
                  const modeCap = getModeCap(type, selectedChain);
                  const maxPerWallet = getPerWalletMax(type, selectedChain);
                  const maxAllowed = Math.min(maxPerWallet, modeCap);
                  const isAvailable = maxAllowed > 0;
                  
                  // DUMMY DATA - Replace with real data
                  const mintedCount = type === "seed" ? 254 : 120;
                  const totalSupply = type === "seed" ? 85 : 61;
                  const endsIn = timeLeft[type] ? formatTimeLeft(timeLeft[type]) : "Loading...";

                  return (
                    <div key={type} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                      {/* Mobile Layout: Stack vertically */}
                      <div className="block sm:hidden space-y-3">
                        {/* Name and Description */}
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-300 flex-shrink-0"></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm sm:text-base font-semibold text-white">{info.name}</h3>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            </div>
                            <p className="text-xs sm:text-sm text-white/70">{info.description}</p>
                          </div>
                        </div>
                        
                        {/* Quantity Selector */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center bg-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] - 1)}
                                disabled={quantities[type] <= 0 || !isAvailable}
                                className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={quantities[type] || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  handleQuantityChange(type, value);
                                }}
                                disabled={!isAvailable}
                                className="w-10 sm:w-12 text-center bg-transparent text-black font-bold text-xs sm:text-sm mx-3 sm:mx-4 border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] + 1)}
                                disabled={quantities[type] >= maxAllowed || !isAvailable}
                                className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-white font-bold text-xs">Max {maxAllowed}</span>
                          </div>
                        </div>
                        
                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div>
                            <p className="text-xs sm:text-sm text-white font-semibold">Price</p>
                            <p className="text-xs sm:text-sm text-white">${Number((PASS_PRICES as any)[type]?.usd ?? 0)}</p>
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
                            <p className={`text-xs sm:text-sm font-mono transition-colors duration-300 ${
                              timeLeft[type] && isTimeRunningLow(timeLeft[type]) 
                                ? "text-red-400 animate-pulse" 
                                : "text-white"
                            }`}>
                              {endsIn}
                            </p>
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
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            </div>
                            <p className="text-sm text-white/70">{info.description}</p>
                          </div>
                        </div>
                        
                        {/* Middle Column: Quantity Selector */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center bg-gray-200 rounded-full px-4 py-2">
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] - 1)}
                                disabled={quantities[type] <= 0 || !isAvailable}
                                className="text-blue-600 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={quantities[type] || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  handleQuantityChange(type, value);
                                }}
                                disabled={!isAvailable}
                                className="w-12 text-center bg-transparent text-black font-bold text-sm mx-4 border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] + 1)}
                                disabled={quantities[type] >= maxAllowed || !isAvailable}
                                className="text-blue-600 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-white font-bold text-xs">Max {maxAllowed}</span>
                          </div>
                        </div>
                        
                        {/* Last Column: Price, Minted, Supply, Ends In */}
                        <div className="flex items-center justify-between space-x-6">
                          <div className="text-right">
                            <p className="text-white font-semibold">Price</p>
                            <p className="text-white">${Number((PASS_PRICES as any)[type]?.usd ?? 0)}</p>
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
                            <p className={`font-mono transition-colors duration-300 ${
                              timeLeft[type] && isTimeRunningLow(timeLeft[type]) 
                                ? "text-red-400 animate-pulse" 
                                : "text-white"
                            }`}>
                              {endsIn}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}
            
            {/* Whitelist Mint Section */}
            {mintMode === "public" && (
              <div>
              <h4 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Whitelist Mint</h4>
              <div className="space-y-3 sm:space-y-4">
                {(["solar", "compute"] as NftType[]).map((type) => {
                  const info = NFT_INFO[type];
                  const modeCap = getModeCap(type, selectedChain);
                  const maxPerWallet = getPerWalletMax(type, selectedChain);
                  const maxAllowed = Math.min(maxPerWallet, modeCap);
                  const isAvailable = maxAllowed > 0;
                  
                  // DUMMY DATA - Replace with real data
                  const mintedCount = type === "solar" ? 82 : 33;
                  const totalSupply = type === "solar" ? 25 : 15;
                  const endsIn = timeLeft[type] ? formatTimeLeft(timeLeft[type]) : "Loading...";

                  return (
                    <div key={type} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                      {/* Mobile Layout: Stack vertically */}
                      <div className="block sm:hidden space-y-3">
                        {/* Name and Description */}
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-300 flex-shrink-0"></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm sm:text-base font-semibold text-white">{info.name}</h3>
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                            <p className="text-xs sm:text-sm text-white/70">{info.description}</p>
                          </div>
                        </div>
                        
                        {/* Quantity Selector */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center bg-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] - 1)}
                                disabled={quantities[type] <= 0 || !isAvailable}
                                className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={quantities[type] || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  handleQuantityChange(type, value);
                                }}
                                disabled={!isAvailable}
                                className="w-10 sm:w-12 text-center bg-transparent text-black font-bold text-xs sm:text-sm mx-3 sm:mx-4 border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] + 1)}
                                disabled={quantities[type] >= maxAllowed || !isAvailable}
                                className="text-blue-600 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-white font-bold text-xs">Max {maxAllowed}</span>
                          </div>
                        </div>
                        
                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div>
                            <p className="text-xs sm:text-sm text-white font-semibold">Price</p>
                            <p className="text-xs sm:text-sm text-white">${Number((PASS_PRICES as any)[type]?.usd ?? 0)}</p>
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
                            <p className={`text-xs sm:text-sm font-mono transition-colors duration-300 ${
                              timeLeft[type] && isTimeRunningLow(timeLeft[type]) 
                                ? "text-red-400 animate-pulse" 
                                : "text-white"
                            }`}>
                              {endsIn}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop Layout: 3 columns */}
                      <div className="hidden sm:grid grid-cols-3 gap-6 items-center">
                        {/* First Column: Name and Description */}
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-300 flex-shrink-0"></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-white">{info.name}</h3>
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                            <p className="text-sm text-white/70">{info.description}</p>
                          </div>
                        </div>
                        
                        {/* Middle Column: Quantity Selector */}
                        <div className="flex justify-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center bg-gray-200 rounded-full px-4 py-2">
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] - 1)}
                                disabled={quantities[type] <= 0 || !isAvailable}
                                className="text-blue-600 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={quantities[type] || ""}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  handleQuantityChange(type, value);
                                }}
                                disabled={!isAvailable}
                                className="w-12 text-center bg-transparent text-black font-bold text-sm mx-4 border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <button
                                onClick={() => handleQuantityChange(type, quantities[type] + 1)}
                                disabled={quantities[type] >= maxAllowed || !isAvailable}
                                className="text-blue-600 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-white font-bold text-xs">Max {maxAllowed}</span>
                          </div>
                        </div>
                        
                        {/* Last Column: Price, Minted, Supply, Ends In */}
                        <div className="flex items-center justify-between space-x-6">
                          <div className="text-right">
                            <p className="text-white font-semibold">Price</p>
                            <p className="text-white">${Number((PASS_PRICES as any)[type]?.usd ?? 0)}</p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-white font-semibold">Minted</p>
                            <p className="text-white">{mintedCount}</p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-white font-semibold"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg></p>
                            <div className="flex items-center justify-between space-x-1">
                              <p className="text-white">{totalSupply}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-white font-semibold">Ends In</p>
                            <p className={`font-mono transition-colors duration-300 ${
                              timeLeft[type] && isTimeRunningLow(timeLeft[type]) 
                                ? "text-red-400 animate-pulse" 
                                : "text-white"
                            }`}>
                              {endsIn}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>

          {/* KOL ID Input */}
          {mintMode === "public" && (
            <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500 shadow-lg">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white">{t('minting.referralId')}</h3>
            </div>
            <p className="text-xs sm:text-sm text-white/70 mb-3 sm:mb-4">
              {t('minting.input6DigitId')}
            </p>
            <Input
              id="kolDigits"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={kolDigits}
              readOnly={kolLocked}
              onChange={(e) => {
                if (kolLocked) return;
                setKolDigits(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              placeholder={t('minting.referralIdPlaceholder')}
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
            </div>
          )}

          {/* Order Summary */}
          {mintMode === "public" && (
            <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 rounded-lg shadow-lg">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white">{t('minting.summary')}</h3>
            </div>
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
                  {t('minting.noItemsSelected')}
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
                  Payment will be processed in {CHAINS[selectedChain].symbol} (USDT equivalent)
                </p>
              )}
              {account && usdtData?.displayValue && (
                <p className="text-xs text-white/70">
                  Your USDT: {usdtData.displayValue} {usdtData.symbol}
                </p>
              )}
              
              {account && nativeData && (
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
            </div>
          )}

          {/* Wallet Connection & Minting */}
          {mintMode === "public" && (
            <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-2 rounded-lg shadow-lg">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t('minting.connectAndMint')}</h3>
            </div>
            <div className="space-y-4 text-center">
              {/* Wallet Connect Button */}
              <div className="flex justify-center">
                <WalletConnect />
              </div>

              {/* Status Messages */}
              <div className="space-y-1 flex flex-col items-center">
                {!isConnected && (
                  <div className="flex items-center space-x-2 text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-xs">{t('minting.walletNotConnected')}</span>
                  </div>
                )}
                {hasInsufficientGas && (
                  <div className="flex items-center space-x-2 text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-xs">{t('minting.insufficientGasBalance')}</span>
                  </div>
                )}
              </div>

              {/* Whitelist Status (informational only; affects caps) */}
              {account && (
                <div className="p-2 rounded-lg border border-white/20 bg-white/5 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <span className="text-xs font-medium text-white">Whitelist Status:</span>
                    {checkingWl ? (
                      <div className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin text-white" />
                        <span className="text-xs text-white/70">Checking...</span>
                      </div>
                    ) : wlEligible ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Whitelisted</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <X className="h-3 w-3 text-red-400" />
                        <span className="text-xs text-red-400 font-medium">Not Whitelisted</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white/70">
                    Being whitelisted unlocks higher per-wallet limits during the whitelist sale window.
                  </p>
                </div>
              )}

              {/* Inline progress bar (above the button) */}
              {isMinting && (
                <div className="space-y-2 text-center">
                  <div className="flex items-center justify-center space-x-4 text-xs text-white">
                    <span>{currentStep}</span>
                    <span>{mintProgress}%</span>
                  </div>
                  <Progress value={mintProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={handleMint}
                disabled={getMintButtonDisabled()}
                className="w-full bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                size="default"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('minting.minting')}
                  </>
                ) : hasInsufficientGas ? (
                  <>
                    <AlertTriangle className="mr-2 h-3 w-3" />
                    {t('minting.insufficientGas')}
                  </>
                ) : !isConnected ? (
                  t('minting.connectWallet')
                ) : (() => {
                  const picked = Object.entries(quantities).filter(([, q]) => q > 0);
                  if (picked.length === 1) {
                    const [pickedType] = picked[0] as [NftType, number];
                    const isWhitelistOnly = pickedType === "solar" || pickedType === "compute";
                    if (isWhitelistOnly && !wlEligible) {
                      return (
                        <>
                          <Lock className="mr-2 h-3 w-3" />
                          Whitelist Required
                        </>
                      );
                    }
                  }
                  return (
                    <>
                      <Zap className="mr-2 h-3 w-3" />
                      Mint NFTs
                    </>
                  );
                })()}
              </Button>
            </div>
            </div>
          )}
        </div>
      </div>

      <SpendingCapModal
        isOpen={false}
        onClose={handleSpendingCapClose}
        onConfirm={handleSpendingCapConfirm as any}
        spender={contractAddr ? `${contractAddr.slice(0, 6)}...${contractAddr.slice(-4)}` : ""}
        requestFrom="agvnexrur.ai/en/mint"
        spendingCap={totalCost.toFixed(2)}
        tokenSymbol="USDT"
        networkFee="~"
      />

      {/* Transaction Progress Modal — disabled */}
      <TransactionProgressModal
        isOpen={false}
        onClose={handleProgressClose}
        status={currentStep}
        txHash={txHash}
        chainId={selectedChain}
        stage={progressStage}
        onVerifyWallet={handleVerifyWallet}
      />

      {/* Staking Modal */}
      <StakingModal
        isOpen={showStakingModal}
        onClose={handleStakingModalClose}
        onGoToStaking={handleGoToStaking}
        mintedNfts={mintResults.map(result => ({ type: result.type, quantity: result.quantity }))}
      />
    </div>
  );
}