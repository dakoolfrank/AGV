import React, { useEffect } from "react";
import { X } from "lucide-react";

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

export const SpendingCapModal: React.FC<SpendingCapModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  spender,
  requestFrom,
  spendingCap,
  tokenSymbol,
  networkFee,
}) => {
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
            aria-label="Close spending cap modal"
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
            You are giving AGV Protocol the permission to spend this amount from your account.
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
              <span style={{ color: "#fff", fontSize: "0.875rem" }}>{requestFrom}</span>
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
