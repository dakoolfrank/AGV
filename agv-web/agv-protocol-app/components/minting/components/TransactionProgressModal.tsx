import React, { useState, useEffect } from "react";
import { CheckCircle, X, Loader2, ExternalLink, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ChainId } from "../types";

interface TransactionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  txHash?: string;
  chainId: ChainId;
  stage: "approval" | "mint" | "confirming" | "success" | "timeout" | "error";
  onVerifyWallet: () => void;
}

export const TransactionProgressModal: React.FC<TransactionProgressModalProps> = ({
  isOpen,
  onClose,
  status,
  txHash,
  chainId,
  stage,
  onVerifyWallet,
}) => {
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
    "137": "https://polscan.io",
    "42161": "https://arbiscan.io",
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
    toast.success("Transaction hash copied");
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
              {stage === "success" ? "Transaction Successful!" : stage === "error" ? "Transaction Failed" : stage === "timeout" ? "Transaction Timeout" : "Transaction Progress"}
            </h3>
          </div>
          {(stage === "success" || stage === "error" || showTimeoutOption) && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "0.25rem" }}
              aria-label="Close progress modal"
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
                aria-label="Copy tx hash"
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
