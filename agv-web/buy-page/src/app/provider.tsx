"use client";

import type { ComponentType } from "react";
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";
import { arbitrum, bsc, polygon } from "thirdweb/chains";
import { createWallet, walletConnect, inAppWallet } from "thirdweb/wallets";
import { WalletProvider } from "@/lib/wallet-provider";
import { TranslationProvider } from "@/lib/translation-provider";
import { Toaster } from "sonner";

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Configure chains at provider level (not just button level)
const supportedChains = [bsc, arbitrum, polygon] as const;
export const defaultChain = bsc;

// WalletConnect first - best for mobile, supports 400+ wallets
// Note: thirdweb v5 uses clientId for WalletConnect relay, not separate projectId
export const supportedWallets = [
  walletConnect(), // WalletConnect - Universal mobile wallet support
  createWallet("io.metamask"), // MetaMask
  createWallet("com.coinbase.wallet"), // Coinbase Wallet
  createWallet("me.rainbow"), // Rainbow
  createWallet("com.trustwallet.app"), // Trust Wallet
  createWallet("io.zerion.wallet"), // Zerion
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "facebook"],
    },
  }), // Email/Social login wallet
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <TranslationProvider>
      <WalletProvider>
        {children}
        <Toaster position="top-right" />
      </WalletProvider>
      </TranslationProvider>
    </ThirdwebProvider>
  );
}
