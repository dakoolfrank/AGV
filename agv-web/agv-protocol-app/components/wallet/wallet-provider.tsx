"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  chainId: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchChain: (chainId: string) => Promise<void>;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    // Return a fallback context to prevent crashes
    return {
      isConnected: false,
      address: null,
      chainId: null,
      connectWallet: async () => {
        console.warn("WalletProvider not found - wallet connection unavailable");
      },
      disconnectWallet: () => {
        console.warn("WalletProvider not found - wallet disconnection unavailable");
      },
      switchChain: async () => {
        console.warn("WalletProvider not found - chain switching unavailable");
      },
      isLoading: false,
    };
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            setIsConnected(true);
            
            const chainId = await window.ethereum.request({ method: "eth_chainId" });
            setChainId(chainId);
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
    };

    checkConnection();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
        } else {
          setAddress(null);
          setIsConnected(false);
          setChainId(null);
        }
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", (newChainId: string) => {
        setChainId(newChainId);
        window.location.reload(); // Reload to update the app
      });
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined") {
      toast.error("Wallet connection not available", {
        description: "Please try again in a moment"
      });
      return;
    }

    if (!window.ethereum) {
      toast.error("MetaMask not detected", {
        description: "Please install MetaMask to connect your wallet"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        setChainId(chainId);
        
        // Track wallet connection (non-blocking)
        try {
          await fetch('/api/wallet/connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: accounts[0] }),
          });
        } catch (error) {
          console.error('Error tracking wallet connection:', error);
          // Don't show error to user, connection still succeeded
        }
        
        toast.success("Wallet connected successfully", {
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`
        });
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        toast.error("Connection rejected", {
          description: "Please approve the connection request in MetaMask"
        });
      } else {
        toast.error("Failed to connect wallet", {
          description: error.message || "An unknown error occurred"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
    setChainId(null);
    toast.success("Wallet disconnected");
  };

  const switchChain = async (targetChainId: string) => {
    if (!window.ethereum) {
      toast.error("MetaMask not detected");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainId }],
      });
      setChainId(targetChainId);
      toast.success("Network switched successfully");
    } catch (error: any) {
      console.error("Error switching chain:", error);
      
      // If the chain is not added, try to add it
      if (error.code === 4902) {
        try {
          const chainConfig = getChainConfig(targetChainId);
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [chainConfig],
          });
          setChainId(targetChainId);
          toast.success("Network added and switched successfully");
        } catch (addError) {
          toast.error("Failed to add network", {
            description: "Please add the network manually in MetaMask"
          });
        }
      } else {
        toast.error("Failed to switch network", {
          description: error.message || "An unknown error occurred"
        });
      }
    }
  };

  const getChainConfig = (chainId: string) => {
    const configs = {
      "0x38": { // BSC
        chainId: "0x38",
        chainName: "Binance Smart Chain",
        nativeCurrency: {
          name: "BNB",
          symbol: "BNB",
          decimals: 18,
        },
        rpcUrls: ["https://bsc-dataseed.binance.org/"],
        blockExplorerUrls: ["https://bscscan.com/"],
      },
      "0x89": { // Polygon
        chainId: "0x89",
        chainName: "Polygon",
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
        rpcUrls: ["https://polygon-rpc.com/"],
        blockExplorerUrls: ["https://polygonscan.com/"],
      },
      "0xa4b1": { // Arbitrum
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        nativeCurrency: {
          name: "Ethereum",
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: ["https://arb1.arbitrum.io/rpc"],
        blockExplorerUrls: ["https://arbiscan.io/"],
      },
    };
    
    return configs[chainId as keyof typeof configs];
  };

  const value: WalletContextType = {
    isConnected,
    address,
    chainId,
    connectWallet,
    disconnectWallet,
    switchChain,
    isLoading,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}
