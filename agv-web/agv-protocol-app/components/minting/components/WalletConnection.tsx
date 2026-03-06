import React, { useState, useMemo } from "react";
import { Wallet, AlertTriangle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { WalletConnect } from "@/components/wallet/wallet-connect";
import { useTranslations } from "@/hooks/useTranslations";
import { SectionCard } from "./SectionCard";

interface WalletConnectionProps {
  isConnected: boolean;
  hasInsufficientGas: boolean;
  isMinting: boolean;
  currentStep: string;
  mintProgress: number;
  canMint: boolean;
  onMint: () => void;
  account?: { address?: string };
  checkingWl: boolean;
  wlEligible: boolean;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({
  isConnected,
  hasInsufficientGas,
  isMinting,
  currentStep,
  mintProgress,
  canMint,
  onMint,
  account,
  checkingWl,
  wlEligible,
}) => {
  const { t } = useTranslations();
  // KOL Referral
  const [kolDigits, setKolDigits] = useState("");
  const [kolLocked, setKolLocked] = useState(false);
  const fullKolId = useMemo(() => (kolDigits && kolDigits.length === 6 ? `AGV-KOL${kolDigits}` : ""), [kolDigits]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Referral ID */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{t('minting.referralId')}</h3>
            <p className="text-white/70 text-sm">{t('minting.input6DigitId')}</p>
          </div>
        </div>
        <div className="max-w-xs">
          <Input
            type="text"
            placeholder={t('minting.enter6Digits')}
            value={kolDigits}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setKolDigits(val);
              setKolLocked(val.length === 6);
            }}
            className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-purple-500"
            disabled={kolLocked}
          />
          {fullKolId && (
            <p className="text-sm text-purple-300 mt-2">{t('minting.kolId')}: {fullKolId}</p>
          )}
        </div>
      </div>

      {/* Wallet Connection & Minting */}
      <SectionCard
        icon={Wallet}
        iconBg="bg-blue-500"
        title="Wallet Connection & Minting"
        description="Connect your wallet and mint your NFTs"
      >
        {!isConnected ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white/60" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('minting.connectYourWallet')}</h3>
            <p className="text-white/70 text-sm mb-6">
              {t('minting.connectToMint')}
            </p>
            <WalletConnect />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet Info */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Connected Wallet</h4>
                  <p className="text-white/70 text-sm">
                    {account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Unknown"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-300 text-sm">Connected</span>
                </div>
              </div>
            </div>

            {/* Whitelist Status */}
            {checkingWl ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <span className="text-white">Checking whitelist eligibility...</span>
                </div>
              </div>
            ) : wlEligible ? (
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-300">You are whitelisted for exclusive NFTs</span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-yellow-300">Public minting available</span>
                </div>
              </div>
            )}

            {/* Gas Warning */}
            {hasInsufficientGas && (
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <h4 className="text-red-300 font-medium">Insufficient Gas</h4>
                    <p className="text-red-300/70 text-sm">
                      You need more native tokens for gas fees to complete the transaction
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Minting Progress */}
            {isMinting && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Minting Progress</span>
                    <span className="text-white/70 text-sm">{mintProgress}%</span>
                  </div>
                  <Progress value={mintProgress} className="h-2" />
                  {currentStep && (
                    <p className="text-white/70 text-sm">{currentStep}</p>
                  )}
                </div>
              </div>
            )}

            {/* Mint Button */}
            <div className="text-center">
              <Button
                onClick={onMint}
                disabled={!canMint || isMinting}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMinting ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Minting...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Wallet className="w-5 h-5" />
                    <span>Mint NFTs</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};