"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// ── Token Registry ─────────────────────────────────────────────
interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  /** Absolute or origin-relative URL served from public/ */
  imagePath: string;
}

const TOKENS: Record<string, TokenMeta> = {
  pGVT: {
    address: "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
    symbol: "pGVT",
    decimals: 18,
    imagePath: "/pGVT_32.svg",
  },
  sGVT: {
    address: "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3",
    symbol: "sGVT",
    decimals: 18,
    imagePath: "/sGVT_32.svg",
  },
};

// ── EIP-747 wallet_watchAsset ──────────────────────────────────
async function addTokenToWallet(token: TokenMeta): Promise<boolean> {
  const provider = (window as any).ethereum;
  if (!provider) {
    alert("Please install MetaMask or a compatible wallet extension.");
    return false;
  }

  // Ensure BSC Mainnet (chainId 56 = 0x38)
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x38" }],
    });
  } catch (switchErr: any) {
    if (switchErr.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x38",
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: ["https://bsc-dataseed1.binance.org"],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ],
      });
    }
  }

  const imageUrl = `${window.location.origin}${token.imagePath}`;

  const added = await provider.request({
    method: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        image: imageUrl,
      },
    },
  });

  return !!added;
}

// ── Exported Components ────────────────────────────────────────

export function AddTokenButton({
  tokenKey,
  className,
}: {
  tokenKey: keyof typeof TOKENS;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const token = TOKENS[tokenKey];

  const handleClick = async () => {
    setLoading(true);
    try {
      await addTokenToWallet(token);
    } catch {
      // user rejected or provider error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={`gap-1.5 border-white/20 text-white hover:bg-white/10 ${className ?? ""}`}
    >
      <span className="text-xs">
        {loading ? "Confirming…" : `+ ${token.symbol}`}
      </span>
    </Button>
  );
}

export function AddTokenGroup({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-white/50 mr-1">Add to wallet:</span>
      <AddTokenButton tokenKey="pGVT" />
      <AddTokenButton tokenKey="sGVT" />
    </div>
  );
}
