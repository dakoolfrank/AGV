"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// ── Token Registry ─────────────────────────────────────────────
interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  iconUrl: string;
}

const TOKENS: Record<string, TokenMeta> = {
  pGVT: {
    address: "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
    symbol: "pGVT",
    decimals: 18,
    iconUrl: "https://buy.agvnexrur.ai/pGVT_128.png",
  },
  sGVT: {
    address: "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3",
    symbol: "sGVT",
    decimals: 18,
    iconUrl: "https://buy.agvnexrur.ai/sGVT_128.png",
  },
};

// ── wallet_watchAsset helper ───────────────────────────────────
async function addTokenWithIcon(
  ethereum: any,
  token: TokenMeta,
): Promise<boolean> {
  // Step 1: Ensure wallet is connected (required on MM Mobile)
  try {
    await ethereum.request({ method: "eth_requestAccounts" });
  } catch {
    throw new Error("Wallet connection required to add token");
  }

  // Step 2: wallet_watchAsset (standard EIP-747)
  const added = await ethereum.request({
    method: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        image: token.iconUrl,
      },
    },
  });

  if (added === true) return true;
  if (added === false) return false;
  throw new Error("Unexpected wallet_watchAsset response");
}

// ── Exported Components ────────────────────────────────────────

type BtnState = "idle" | "loading" | "added" | "error";

export function AddTokenButton({
  tokenKey,
  className,
}: {
  tokenKey: keyof typeof TOKENS;
  className?: string;
}) {
  const [state, setState] = useState<BtnState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const token = TOKENS[tokenKey];

  const handleClick = async () => {
    const provider = (window as any).ethereum;
    if (!provider) {
      setState("error");
      setErrorMsg("MetaMask not detected. Open this page in MetaMask browser.");
      setTimeout(() => setState("idle"), 5000);
      return;
    }

    setState("loading");
    try {
      const ok = await addTokenWithIcon(provider, token);
      if (ok) {
        setState("added");
      } else {
        setState("idle");
      }
    } catch (err: any) {
      console.error(`[AddToken] ${token.symbol} failed:`, err);
      setState("error");
      setErrorMsg(err?.message || "wallet_watchAsset not supported on this MetaMask version");
    } finally {
      setTimeout(() => { setState("idle"); setErrorMsg(""); }, 5000);
    }
  };

  const label =
    state === "loading" ? "Adding…" :
    state === "added" ? `✅ ${token.symbol} Added` :
    state === "error" ? `❌ Failed` :
    `Add ${token.symbol}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={state === "loading"}
        className={`gap-2 px-4 py-2.5 rounded-xl border-[#4ade80]/40 bg-[#4ade80]/10 text-white hover:bg-[#4ade80]/25 hover:border-[#4ade80]/60 transition-all ${
          state === "added" ? "border-[#4ade80]/70 bg-[#4ade80]/20" :
          state === "error" ? "border-red-400/40 bg-red-400/10" : ""
        } ${className ?? ""}`}
      >
        <span className="text-sm font-medium">{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
      </Button>
      {state === "error" && errorMsg && (
        <span className="text-xs text-red-400 max-w-[200px] text-center">{errorMsg}</span>
      )}
    </div>
  );
}

export function AddTokenGroup({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row items-center gap-3 ${className ?? ""}`}>
      <span className="text-sm text-white/70 font-medium">🦊 Add to MetaMask:</span>
      <div className="flex items-center gap-3">
        <AddTokenButton tokenKey="pGVT" />
        <AddTokenButton tokenKey="sGVT" />
      </div>
    </div>
  );
}
