"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Footer } from "@/components/layout/footer";
import { useTranslations } from "@/hooks/useTranslations";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  ConnectButton,
  useActiveAccount,
  useActiveWalletChain,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from "thirdweb";
import { polygon, arbitrum, bsc } from "thirdweb/chains";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowRightLeft,
  Lock,
  Unlock,
  Coins,
  Gift,
  Zap,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

// Contracts / ABIs
import {
  NFT_CONTRACTS,
  STAKE_CONTRACTS,
  SEED_ABI,
  TREE_ABI,
  SOLAR_ABI,
  COMPUTE_ABI,
  STAKE_ABI,
} from "@/lib/contracts";

// Rewards (off-chain dashboard)
import { useOffChainRewards } from "@/hooks/useOffChainRewards";
import { BASE_DAILY_RRGP, bonusFor } from "@/lib/rewards";

// Indexer-backed hook (new source of truth for owned/staked NFTs)
import { useStakingView } from "@/hooks/useStakingView";

/* ─────────────────────────── Helpers ─────────────────────────── */
function toGateway(u?: string) {
  if (!u) return undefined;
  if (u.startsWith("ipfs://")) return u.replace(/^ipfs:\/\//, "https://ipfscdn.io/ipfs/");
  return u.replace(/^https?:\/\/ipfs\.io\/ipfs\//i, "https://ipfscdn.io/ipfs/");
}
function getImageSrc(nft: { imageUrl?: string }, fallback?: string) {
  return toGateway(nft?.imageUrl) || fallback;
}

// One-shot remaining string (no live interval updates)
function formatRemainingOnce(unlockAtISO: string, t?: (key: string) => string) {
  try {
    const now = Date.now();
    const unlock = new Date(unlockAtISO).getTime();
    const remaining = unlock - now;
    if (remaining <= 0) return t ? t('staking.unlocked') : 'Unlocked';
  const totalSec = Math.floor(remaining / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
  } catch (error) {
    return 'Unlocked';
  }
}

async function postJSON<T>(url: string, body: any, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ─────────────────────────── Config ─────────────────────────── */
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

type ChainKey = "56" | "42161" | "137";
const CHAIN_CONFIG: Record<
  ChainKey,
  { id: number; label: string; chain: any; fallbackImg: string }
> = {
  "56": { id: 56, label: "BSC", chain: bsc, fallbackImg: "/seedpass.jpg" },
  "42161": { id: 42161, label: "Arbitrum", chain: arbitrum, fallbackImg: "/seedpass.jpg" },
  "137": { id: 137, label: "Polygon", chain: polygon, fallbackImg: "/seedpass.jpg" },
};

function useContracts(
  chainKey: ChainKey,
  collectionType: "seed" | "tree" | "solar" | "compute" = "seed"
) {
  const chain = CHAIN_CONFIG[chainKey].chain;
  const nftAddress = NFT_CONTRACTS[chainKey][collectionType];
  const stakeAddress = STAKE_CONTRACTS[chainKey][collectionType];

  const nft = useMemo(
    () =>
      getContract({
        client,
        chain,
        address: nftAddress,
        abi:
          (collectionType === "seed"
            ? SEED_ABI
            : collectionType === "tree"
            ? TREE_ABI
            : collectionType === "solar"
            ? SOLAR_ABI
            : COMPUTE_ABI) as any,
      }),
    [chainKey, collectionType, nftAddress]
  );

  const stake = useMemo(
    () =>
      getContract({
        client,
        chain,
        address: stakeAddress,
        abi: STAKE_ABI as any,
      }),
    [chainKey, collectionType, stakeAddress]
  );

  return { nft, stake, chain };
}

/* ─────────────────────────── Page ─────────────────────────── */
export default function StakingPage() {
  const { t } = useTranslations();
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();

  const [chainKey, setChainKey] = useState<ChainKey>("56");
  const [selectedCollection, setSelectedCollection] =
    useState<"seed" | "tree" | "solar" | "compute">("seed");
  const { nft, stake } = useContracts(chainKey, selectedCollection);

  const [staking, setStaking] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawRefreshTrigger, setWithdrawRefreshTrigger] = useState(0);

  // Staking duration (minimum 7 days)
  const [stakingDuration, setStakingDuration] = useState<number>(7);

  // Selection state (lifted) for legacy rewards preview
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const clearSelection = () => setSelectedIds([]);

  // Off-chain rewards summary
  const { data: rewardsData, refetch: refetchRewards } = useOffChainRewards();

  // Indexer hook → current chain + collection
  const chainId = CHAIN_CONFIG[chainKey].id;
  const { loading: nftLoading, error: nftError, ownedUnstaked, ownedStaked, refetch: refetchStakingView } = useStakingView({
    chainId,
    collection: selectedCollection,
  });

  // Chain mismatch hint
  useEffect(() => {
    if (!activeChain?.id) return;
    if (activeChain.id !== chainId) {
      // display-only hint; actual switch happens on action
    }
  }, [activeChain, chainId]);

  async function ensureChain() {
    if (activeChain?.id !== chainId) {
      try {
        await switchChain(CHAIN_CONFIG[chainKey].chain);
        toast.success(`Switched to ${CHAIN_CONFIG[chainKey].label}`);
      } catch {
        toast.error(`Please switch to ${CHAIN_CONFIG[chainKey].label} to continue`);
        throw new Error("wrong chain");
      }
    }
  }

  const [stakedCount, setStakedCount] = useState<bigint>(BigInt(0));
  async function refreshStats() {
    if (!account?.address) return;
    try {
      const info = (await readContract({
        contract: stake,
        method: "getStakeInfo",
        params: [account.address],
      })) as [bigint, bigint];
      setStakedCount(info[0]);
    } catch {
      // ignore if contract not initialized yet
    }
  }

  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, chainKey, selectedCollection]);

  async function ensureApproval() {
    const owner = account!.address!;
    const operator = STAKE_CONTRACTS[chainKey][selectedCollection];
    const approved: boolean = (await readContract({
      contract: nft,
      method: "function isApprovedForAll(address owner, address operator) view returns (bool)",
      params: [owner, operator],
    })) as boolean;

    if (!approved) {
      const tx = await prepareContractCall({
        contract: nft,
        method: "function setApprovalForAll(address operator, bool approved)",
        params: [operator, true],
      });
      await sendAndConfirmTransaction({ transaction: tx, account: account! });
    }
  }

  async function handleStake(tokenIds: bigint[]) {
    if (!account?.address) return toast.error(t('staking.connectWalletFirst'));
    if (tokenIds.length === 0) return toast.error(t('staking.selectAtLeastOneToken'));
    if (stakingDuration < 7) return toast.error(t('staking.durationMustBeAtLeastSevenDays'));

    try {
      await ensureChain();
      setStaking(true);
      toast.loading(t('staking.approvingIfNeeded'));
      await ensureApproval();

      toast.dismiss();
      toast.loading(t('staking.stakingOnChain'));
      const tx = await prepareContractCall({
        contract: stake,
        method: "stake",
        params: [tokenIds],
      });
      const receipt = await sendAndConfirmTransaction({ transaction: tx, account: account! });
      toast.dismiss();

      // Record stakes via API (no client Firestore writes)
      toast.loading(t('staking.recordingStake'));
      await postJSON<{ ok: boolean }>(
        "/api/stakes",
        {
          wallet: account.address,
          chainId,
          nftType: selectedCollection,
          tokenIds: tokenIds.map(String),
          lockDays: stakingDuration,
          txHash: (receipt as any)?.transactionHash ?? null,
        },
        "POST"
      );
      toast.dismiss();
      toast.success(`Staked for ${stakingDuration} day${stakingDuration > 1 ? "s" : ""}!`);

      clearSelection();
      await Promise.all([refreshStats(), refetchStakingView?.()]);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || t('staking.stakeFailed'));
    } finally {
      setStaking(false);
    }
  }

  async function handleWithdraw(tokenIds: bigint[]) {
    if (!account?.address) return toast.error(t('staking.connectWalletFirst'));
    if (tokenIds.length === 0) return toast.error(t('staking.selectAtLeastOneNftToWithdraw'));

    try {
      await ensureChain();
      setWithdrawing(true);
      toast.loading(t('staking.withdrawingOnChain'));
      const tx = await prepareContractCall({
        contract: stake,
        method: "withdraw",
        params: [tokenIds],
      });
      const receipt = await sendAndConfirmTransaction({ transaction: tx, account: account! });
      toast.dismiss();

      // Mark withdrawn via API (no client Firestore writes)
      toast.loading(t('staking.updatingRecords'));
      await postJSON<{ ok: boolean }>(
        "/api/stakes/withdraw",
        {
          wallet: account.address,
          chainId,
          collectionType: selectedCollection,
          tokenIds: tokenIds.map(String),
          txHash: (receipt as any)?.transactionHash ?? null,
        },
        "POST"
      );
      toast.dismiss();
      toast.success(t('staking.withdrawn'));

      await Promise.all([refreshStats(), refetchStakingView?.()]);
      // Trigger refresh of withdraw section
      setWithdrawRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || t('staking.withdrawFailed'));
    } finally {
      setWithdrawing(false);
    }
  }

  // Reward preview (legacy logic) — recomputes as user selects NFTs & changes duration
  const rewardPreview = useMemo(() => {
    const count = selectedIds.length;
    const base = BASE_DAILY_RRGP[selectedCollection] || 0;
    const mult = bonusFor(stakingDuration) || 1;
    const perNftDaily = base * mult;
    const totalDaily = perNftDaily * count;
    const scheduledTotal = totalDaily * stakingDuration; // simple linear schedule
    return { count, base, mult, perNftDaily, totalDaily, scheduledTotal };
  }, [selectedIds, selectedCollection, stakingDuration]);

  // Overview card helper
  const dailyRewardHint = useMemo(() => {
    const baseRate = BASE_DAILY_RRGP[selectedCollection];
    const b = bonusFor(stakingDuration);
    const totalRate = baseRate * b;
    return `${totalRate.toFixed(1)} rGGP / day (${baseRate} × ${b}x bonus)`;
  }, [selectedCollection, stakingDuration]);

  const presetDurations = [7, 14, 30, 90, 180, 365, 730];
  const handlePresetClick = (days: number) => setStakingDuration(days);

  // Build list of unstaked tokenIds as strings for selection grid
  const unstakedIds: string[] = useMemo(
    () => (ownedUnstaked || []).map((n) => n.tokenId?.toString?.() ?? String(n.tokenId)),
    [ownedUnstaked]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-800/20 backdrop-blur-xl border border-white/10 p-4 sm:p-8 mb-6 sm:mb-8 shadow-2xl shadow-blue-500/10">
          <div className="relative z-10">
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  {t('staking.protocolTitle')}
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-white/80 max-w-2xl">
                  {t('staking.stakeYour')} {" "}
                  <span className="font-semibold text-cyan-300">
                    {selectedCollection.charAt(0).toUpperCase() + selectedCollection.slice(1)}
                  </span>{" "}
                  {t('staking.nftsOn')} {" "}
                  <span className="font-semibold text-blue-300">
                    {CHAIN_CONFIG[chainKey].label}
                  </span>{" "}
                  {t('staking.toEarnRewards')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <LanguageSwitcher className="bg-white/10 border-white/20 text-white hover:bg-white/20" />
                <div className="hidden sm:block">
                  <ConnectButton client={client} />
                </div>
              </div>
            </header>
          </div>
        </div>

        {/* Network & Collection */}
        <div className="space-y-6">
          <SelectorPanel
            chainKey={chainKey}
            setChainKey={setChainKey}
            activeChainName={activeChain?.name}
            selectedCollection={selectedCollection}
            setSelectedCollection={setSelectedCollection}
            t={t}
          />
        </div>

        {/* Staking Duration */}
        <DurationPanel
          stakingDuration={stakingDuration}
          setStakingDuration={setStakingDuration}
          presetDurations={presetDurations}
          handlePresetClick={handlePresetClick}
          t={t}
        />

        {/* Stats */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            {t('staking.overview')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title={t('staking.stakedNFTs')}
              value={stakedCount.toString()}
              subtitle={t('staking.currentlyStaked')}
              icon={<Lock className="w-6 h-6 text-white" />}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              title={t('staking.availableRewards')}
              value={rewardsData?.totals?.accrued?.toFixed(2) || "0.00"}
              subtitle={t('staking.rggpReadyToClaim')}
              icon={<Coins className="w-6 h-6 text-white" />}
              gradient="from-green-500 to-emerald-500"
            />
            <StatCard
              title={t('staking.dailyRewards')}
              value={dailyRewardHint}
              subtitle={t('staking.perNFTStaked')}
              icon={<ArrowRightLeft className="w-6 h-6 text-white" />}
              gradient="from-blue-500 to-cyan-500"
            />
          </div>
        </div>

        {/* Rewards Dashboard (summary — legacy rewards retained) */}
        {account?.address && rewardsData && (
          <>
            
            <RewardsPanel
              rewardsData={rewardsData}
              selectedCollection={selectedCollection}
              stakingDuration={stakingDuration}
              claiming={false}
              t={t}
            />
          </>
        )}

        {/* Stake Flow (select NFTs) + Legacy Rewards Preview (dynamic) */}
        <StakeFlow
          accountAddress={account?.address}
          chainKey={chainKey}
          selectedCollection={selectedCollection}
          nftLoading={nftLoading}
          nftError={nftError}
          ownedUnstaked={ownedUnstaked}
          staking={staking}
          onStake={(ids) => handleStake(ids)}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onClear={clearSelection}
          stakingDuration={stakingDuration}
          rewardPreview={rewardPreview}
          t={t}
        />

        {/* Your Stakes (from /api/rewards) — static remaining text (no live updates) */}
        {account?.address ? (
          <StakesFromRewards
            wallet={account.address}
            filterChainId={CHAIN_CONFIG[chainKey].id}
            filterCollection={selectedCollection}
            t={t}
          />
        ) : null}

        {/* Withdraw (derived from /api/rewards instead of Firestore) */}
        <WithdrawSection
          accountAddress={account?.address}
          chainKey={chainKey}
          selectedCollection={selectedCollection}
          withdrawing={withdrawing}
          onWithdraw={handleWithdraw}
          refreshTrigger={withdrawRefreshTrigger}
          t={t}
        />
      </div>

      {/* Footer */}
      <Footer
        backgroundClass="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
        textColorClass="text-white"
      />
    </div>
  );
}

/* ───────────────────────── Subcomponents ───────────────────────── */

function SelectorPanel({
  chainKey,
  setChainKey,
  activeChainName,
  selectedCollection,
  setSelectedCollection,
  t,
}: {
  chainKey: ChainKey;
  setChainKey: (k: ChainKey) => void;
  activeChainName?: string;
  selectedCollection: "seed" | "tree" | "solar" | "compute";
  setSelectedCollection: (v: "seed" | "tree" | "solar" | "compute") => void;
  t: (key: string) => string;
}) {
  return (
    <>
      {/* Chain */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          {t('staking.selectNetwork')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {(["56", "42161", "137"] as ChainKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setChainKey(k)}
              className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                chainKey === k
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              <div className="flex items-center justify-between text-white">
                <div className="text-left">
                  <div className="font-semibold">{CHAIN_CONFIG[k].label}</div>
                  <div className="text-xs opacity-70">Chain ID: {k}</div>
                </div>
                {chainKey === k && <CheckCircle className="w-5 h-5 text-white" />}
              </div>
              {chainKey === k && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 text-sm tracking-wide text-white/70">
          {t('staking.currentWalletChain')}: <span className="text-blue-300">{activeChainName ?? t('staking.notConnected')}</span>
        </div>
      </div>

      {/* Collection */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          {t('staking.selectNftCollection')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {["seed", "tree", "solar", "compute"].map((collection) => (
            <button
              key={collection}
              onClick={() => setSelectedCollection(collection as any)}
              className={`group relative overflow-hidden rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                selectedCollection === collection
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
              }`}
            >
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg overflow-hidden bg-white/10">
                  <img
                    src={`/${collection}pass.jpg`}
                    alt={`${collection}Pass NFT`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="font-semibold text-sm">
                  {collection.charAt(0).toUpperCase() + collection.slice(1)}
                </div>
              </div>
              {selectedCollection === collection && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DurationPanel({
  stakingDuration,
  setStakingDuration,
  presetDurations,
  handlePresetClick,
  t,
}: {
  stakingDuration: number;
  setStakingDuration: (n: number) => void;
  presetDurations: number[];
  handlePresetClick: (n: number) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        {t('staking.selectStakingDuration')}
      </h3>
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="text-white/80 text-sm font-medium block">{t('staking.quickSelect')}:</label>
          <div className="flex flex-wrap gap-2">
            {presetDurations.map((days) => (
              <button
                key={days}
                onClick={() => handlePresetClick(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  stakingDuration === days
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                }`}
              >
                {days} {days > 1 ? t('staking.days') : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="duration" className="text-white/80 text-sm font-medium">
            {t('staking.durationDays')}
          </label>
          <input
            id="duration"
            type="number"
            min="7"
            max="730"
            value={stakingDuration}
            onChange={(e) => setStakingDuration(Math.max(7, Number.parseInt(e.target.value) || 7))}
            className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-center"
          />
        </div>

        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-purple-300" />
            <span className="text-purple-300 text-sm font-medium">{t('staking.lockPeriod')}</span>
          </div>
          <p className="text-white/70 text-xs">
            {t('staking.yourNftsWillBeLocked')} {" "}
            <span className="font-semibold text-purple-300">
              {stakingDuration} {stakingDuration > 1 ? t('staking.days') : t('staking.day')}
            </span>
            . {t('staking.youCannotWithdraw')}
          </p>
        </div>
      </div>
    </div>
  );
}

function RewardsPanel({
  rewardsData,
  selectedCollection,
  stakingDuration,
  claiming,
  t,
}: {
  rewardsData: any;
  selectedCollection: "seed" | "tree" | "solar" | "compute";
  stakingDuration: number;
  claiming: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl border border-green-500/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-green-400" />
            {t('staking.rewardsDashboard.title')}
          </h3>
          <p className="text-green-300/80 text-sm mt-1">{t('staking.rewardsDashboard.subtitle')}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-400">{rewardsData.totals.accrued.toFixed(2)}</div>
          <div className="text-sm text-green-300/80">{t('staking.rewardsDashboard.available')}</div>
          <div className="text-xs text-green-300/60 mt-1">{rewardsData.totals.remaining.toFixed(2)} {t('staking.rewardsDashboard.remaining')}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.rewardsDashboard.collection')}</span>
              <span className="text-white font-medium capitalize">{selectedCollection}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.rewardsDashboard.baseRate')}</span>
              <span className="text-green-400 font-medium">{BASE_DAILY_RRGP[selectedCollection]} rGGP/day</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.rewardsDashboard.bonusMultiplier')}</span>
              <span className="text-yellow-400 font-medium">{bonusFor(stakingDuration)}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">{t('staking.rewardsDashboard.activeStakes')}</span>
              <span className="text-white font-medium">{rewardsData.stakes.length}</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-2">
                {rewardsData.totals.accrued.toFixed(2)} rGGP
              </div>
              <div className="text-sm text-white/60 mb-4">{t('staking.rewardsDashboard.readyToClaim')}</div>
              <button
                onClick={() => toast.info("rGGP rewards will be claimable when GGP token launches!")}
                className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={rewardsData.totals.accrued <= 0}
              >
                {claiming ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('staking.rewardsDashboard.claiming')}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Gift className="w-4 h-4" />
                    {t('staking.rewardsDashboard.claimAllRewards')}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {rewardsData.stakes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active/Unwithdrawn Stakes */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                {t('staking.rewardsDashboard.activeStakesTitle')}
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {rewardsData.stakes.filter((stake: any) => stake.status === 'active' || stake.status === 'completed').map((stake: any) => (
                  <div key={stake.id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                        {stake.amount}x
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">
                          {stake.nftType.toUpperCase()} • {stake.lockDays} days
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            stake.status === 'active' ? 'bg-green-500/20 text-green-300' :
                            stake.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-gray-500/20 text-gray-300'
                          }`}>
                            {stake.status}
                          </span>
                        </div>
                        <div className="text-white/60 text-xs">
                          {stake.baseDaily} rGGP/day × {stake.bonusMultiplier}x • {stake.daysCounted} days elapsed
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-medium">{stake.accrued.toFixed(2)} rGGP</div>
                      <div className="text-xs text-white/60">
                        {stake.accrued.toFixed(2)}/{stake.scheduledTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
                {rewardsData.stakes.filter((stake: any) => stake.status === 'active' || stake.status === 'completed').length === 0 && (
                  <div className="text-center py-4 text-white/60 text-sm">
                    {t('staking.rewardsDashboard.noActiveStakes')}
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawn Stakes */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                {t('staking.rewardsDashboard.withdrawnStakesTitle')}
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {rewardsData.stakes.filter((stake: any) => stake.status === 'withdrawn').map((stake: any) => (
                  <div key={stake.id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                        {stake.amount}x
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">
                          {stake.nftType.toUpperCase()} • {stake.lockDays} days
                          <span className="ml-2 px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300">
                            withdrawn
                          </span>
                        </div>
                        <div className="text-white/60 text-xs">
                          {stake.baseDaily} rGGP/day × {stake.bonusMultiplier}x • {stake.daysCounted} days elapsed
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 font-medium">{stake.accrued.toFixed(2)} rGGP</div>
                      <div className="text-xs text-white/60">
                        {stake.accrued.toFixed(2)}/{stake.scheduledTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
                {rewardsData.stakes.filter((stake: any) => stake.status === 'withdrawn').length === 0 && (
                  <div className="text-center py-4 text-white/60 text-sm">
                    {t('staking.rewardsDashboard.noWithdrawnStakes')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StakeFlow({
  accountAddress,
  chainKey,
  selectedCollection,
  nftLoading,
  nftError,
  ownedUnstaked,
  staking,
  onStake,
  selectedIds,
  onToggle,
  onClear,
  stakingDuration,
  rewardPreview,
  t,
}: {
  accountAddress?: string;
  chainKey: ChainKey;
  selectedCollection: "seed" | "tree" | "solar" | "compute";
  nftLoading: boolean;
  nftError: string | null;
  ownedUnstaked: any[];
  staking: boolean;
  onStake: (ids: bigint[]) => Promise<void>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  stakingDuration: number;
  rewardPreview: { count: number; base: number; mult: number; perNftDaily: number; totalDaily: number; scheduledTotal: number };
  t: (key: string) => string;
}) {
  const fallback = `/${selectedCollection}pass.jpg`;

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Select NFTs */}
      <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-400" />
              {t('staking.selectNftsToStake')}
            </h3>
            <p className="text-white/60 text-sm mt-1">{t('staking.detectedInWallet')} {CHAIN_CONFIG[chainKey].label}</p>
          </div>
          <div className="text-sm text-white/60">{ownedUnstaked?.length || 0} {t('staking.available')}</div>
        </div>

        {!accountAddress ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white/60" />
            </div>
            <h4 className="text-white font-medium mb-2">{t('staking.connectYourWallet')}</h4>
            <p className="text-white/60 text-sm">{t('staking.connectToView')}</p>
            <div className="mt-4">
              <ConnectButton client={client} />
            </div>
          </div>
        ) : nftLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/60" />
            <p className="text-white/60 mt-2">Loading NFTs...</p>
          </div>
        ) : nftError ? (
          <div className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h4 className="text-yellow-300 font-medium mb-1">Error loading NFTs</h4>
              <p className="text-yellow-400 text-sm">{nftError}</p>
            </div>
          </div>
        ) : !ownedUnstaked || ownedUnstaked.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-white/60" />
            </div>
            <h4 className="text-white font-medium mb-2">{t('staking.nftSelection.noNftsFound')}</h4>
            <p className="text-white/60 text-sm mb-4">
              {t('staking.nftSelection.noNftsDescription').replace('{collection}', selectedCollection).replace('{network}', CHAIN_CONFIG[chainKey].label)}
            </p>
            <Link
              href="/mint"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium transition-all"
            >
              {t('staking.nftSelection.mintFirstNft')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {ownedUnstaked.map((nft) => {
              const id = nft.tokenId?.toString?.() ?? String(nft.tokenId);
              const on = selectedIds.includes(id);
              const img = getImageSrc(nft, fallback);
              return (
                <button
                  key={`${nft.collection.address}-${id}`}
                  onClick={() => onToggle(id)}
                  className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 ${
                    on
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                      : "bg-white/5 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  <div className="text-xs opacity-60 mb-2">
                    {nft.standard} • Chain {nft.chainId}
                  </div>
                  {img ? (
                    <img
                      className="rounded-lg mb-2 w-full aspect-square object-cover"
                      src={img}
                      alt={nft?.name ?? "AGV NFT"}
                      loading="lazy"
                    />
                  ) : (
                    <div className="rounded-lg mb-2 w-full aspect-square bg-white/10" />
                  )}
                  <div className="text-sm font-medium text-white">
                    Token #{id}
                    {"amount" in nft && nft.amount ? ` · x${nft.amount.toString()}` : ""}
                  </div>
                  <div className="text-xs text-white/60 mt-1">{nft.name ?? "AGV NFT"}</div>
                  {on && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Action bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-white/70 text-sm">
            {t('staking.nftSelection.selected')}: <span className="text-white font-medium">{selectedIds.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClear}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 border border-white/20 disabled:opacity-50"
            >
              {t('staking.nftSelection.clear')}
            </button>
            <button
              onClick={() => onStake(selectedIds.map((s) => BigInt(s)))}
              disabled={staking || selectedIds.length === 0}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {staking ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('staking.nftSelection.staking')}
                </span>
              ) : (
                `${t('staking.nftSelection.stake')} ${selectedIds.length || ""}`.trim()
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Legacy Rewards Preview */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-yellow-300" />
          {t('staking.legacyRewards.title')}
        </h3>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.selection')}</span>
              <span className="text-white font-medium">{rewardPreview.count} NFT{rewardPreview.count === 1 ? "" : "s"}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.baseDailyPerNft')}</span>
              <span className="text-green-400 font-medium">{rewardPreview.base} rGGP</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.bonusMultiplier')}</span>
              <span className="text-yellow-400 font-medium">{rewardPreview.mult}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.perNftDaily')}</span>
              <span className="text-white font-medium">{rewardPreview.perNftDaily.toFixed(2)} rGGP</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.totalDailyAllSelected')}</span>
              <span className="text-cyan-300 font-semibold">{rewardPreview.totalDaily.toFixed(2)} rGGP</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.duration')}</span>
              <span className="text-white font-medium">{stakingDuration} {stakingDuration > 1 ? t('staking.days') :  t('staking.day') }</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">{t('staking.legacyRewards.scheduledTotal')}</span>
              <span className="text-emerald-300 font-bold">{rewardPreview.scheduledTotal.toFixed(2)} rGGP</span>
            </div>
          </div>

          <p className="text-xs text-white/50">
            {t('staking.legacyRewards.description')}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Your Stakes section (from /api/rewards) ───────────── */

function StakesFromRewards({
  wallet,
  filterChainId,
  filterCollection,
  t,
}: {
  wallet: string;
  filterChainId: number;
  filterCollection: "seed" | "tree" | "solar" | "compute";
  t: (key: string) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stakes, setStakes] = useState<any[]>([]);

  useEffect(() => {
    if (!wallet) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/rewards?wallet=${wallet}`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();

        const filtered = (json?.stakes || []).filter(
          (s: any) =>
            String(s.nftType) === filterCollection &&
            Number(s.chainId) === filterChainId &&
            (s.status === "active" || s.status === "completed")
        );
        setStakes(filtered);
      } catch (e: any) {
        console.error("StakesFromRewards error", e);
        setError(t('staking.failedToLoadStakes'));
      } finally {
        setLoading(false);
      }
    })();
  }, [wallet, filterChainId, filterCollection, t]);

  return (
    <div className="mt-8 bg-white/5 rounded-2xl border border-white/10 p-6">
      <h2 className="text-xl text-white font-semibold mb-4">{t('staking.yourStakes.title')}</h2>

      {!wallet ? (
        <p className="text-white/60">{t('staking.yourStakes.connectWalletToView')}</p>
      ) : loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/60" />
          <p className="text-white/60 mt-2">{t('staking.yourStakes.loadingStakes')}</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 mx-auto text-yellow-400" />
          <p className="text-yellow-300 mt-2">{error}</p>
        </div>
      ) : stakes.length === 0 ? (
        <p className="text-white/60">{t('staking.yourStakes.noStakesFound')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stakes.map((s) => {
            const progress = s.scheduledTotal > 0 ? Math.min(100, (s.accrued / s.scheduledTotal) * 100) : 0;
            const remaining = formatRemainingOnce(s.unlockAt, t);
            const unlocked = remaining === t('staking.unlocked') || remaining === 'Unlocked';

            return (
              <div
                key={s.id}
                className="rounded-xl bg-white/5 border border-white/10 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-medium capitalize">
                    {s.nftType} • {s.lockDays} {t('staking.days')}
                  </div>
                  <div className="text-xs text-white/60">Token #{s.tokenId ?? "—"}</div>
                </div>

                <div className="text-white/70 text-sm">
                  <div>{t('staking.yourStakes.staked')}: {new Date(s.stakedAt).toLocaleDateString()}</div>
                  <div>{t('staking.yourStakes.unlocks')}: {new Date(s.unlockAt).toLocaleDateString()}</div>
                  <div className={`mt-1 text-xs ${unlocked ? "text-green-300" : "text-yellow-300"}`}>
                    {unlocked ? t('staking.yourStakes.unlocked') : `${remaining} ${t('staking.yourStakes.left')}`}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                    <span>{t('staking.yourStakes.accrued')}</span>
                    <span>
                      {s.accrued.toFixed(2)} / {s.scheduledTotal.toFixed(2)} rGGP
                    </span>
                  </div>
                  <div className="h-2 rounded bg-white/10 overflow-hidden">
                    <div
                      className="h-2 bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-white/60">
                  {t('staking.yourStakes.rate')}: {s.baseDaily} rGGP/day × {s.bonusMultiplier}x • {t('staking.yourStakes.counted')} {s.daysCounted} {t('staking.days')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  gradient?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 group transition-all duration-300">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`p-3 rounded-xl bg-gradient-to-r ${
              gradient || "from-gray-500 to-gray-600"
            } shadow-lg transition-all duration-300`}
          >
            {icon}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{value}</div>
            {subtitle && <div className="text-xs text-white/60">{subtitle}</div>}
          </div>
        </div>
        <div className="text-white/80 font-medium">{title}</div>
      </div>
    </div>
  );
}

/* ───────────── Withdraw Section (derived from /api/rewards) ───────────── */

function WithdrawSection({
  accountAddress,
  chainKey,
  selectedCollection,
  withdrawing,
  onWithdraw,
  refreshTrigger,
  t,
}: {
  accountAddress?: string;
  chainKey: ChainKey;
  selectedCollection: "seed" | "tree" | "solar" | "compute";
  withdrawing: boolean;
  onWithdraw: (ids: bigint[]) => Promise<void>;
  refreshTrigger?: number;
  t: (key: string) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<Array<{
    tokenId: string;
    stakedAt: string;
    unlockAt: string;
    unlocked: boolean;
    remainingLabel: string;
    imageUrl: string;
    status: string;
  }>>([]);
  const [withdrawnItems, setWithdrawnItems] = useState<Array<{
    tokenId: string;
    stakedAt: string;
    withdrawnAt: string;
    imageUrl: string;
    status: string;
  }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const FALLBACK: Record<"seed" | "tree" | "solar" | "compute", string> = {
    seed: "/seedpass.jpg",
    tree: "/treepass.jpg",
    solar: "/solarpass.jpg",
    compute: "/computepass.jpg",
  };

  useEffect(() => {
    (async () => {
      setActiveItems([]);
      setWithdrawnItems([]);
      setError(null);
      setSelected({});
      if (!accountAddress) return;

      setLoading(true);
      try {
        // Fetch both active and withdrawn stakes
        const res = await fetch(`/api/rewards?wallet=${accountAddress}&includeWithdrawn=true`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();

        const chainId = CHAIN_CONFIG[chainKey].id;
        const allStakes = (json?.stakes || []).filter(
          (s: any) => s.nftType === selectedCollection && Number(s.chainId) === chainId
        );

        // Separate active and withdrawn stakes
        const activeStakes = allStakes.filter((s: any) => s.status === "active" || s.status === "completed");
        const withdrawnStakes = allStakes.filter((s: any) => s.status === "withdrawn");
        

        // Process active stakes
        const activeRows = activeStakes.map((s: any) => {
          const remaining = formatRemainingOnce(s.unlockAt, t);
          return {
            tokenId: String(s.tokenId ?? ""),
            stakedAt: s.stakedAt,
            unlockAt: s.unlockAt,
            unlocked: remaining === t('staking.unlocked') || remaining === 'Unlocked',
            remainingLabel: remaining,
            imageUrl: FALLBACK[selectedCollection],
            status: s.status,
          };
        });

        // Process withdrawn stakes
        const withdrawnRows = withdrawnStakes.map((s: any) => ({
          tokenId: String(s.tokenId ?? ""),
          stakedAt: s.stakedAt,
          withdrawnAt: s.withdrawnAt || s.unlockAt, // fallback to unlockAt if withdrawnAt not available
          imageUrl: FALLBACK[selectedCollection],
          status: s.status,
        }));

        // Sort active stakes: unlocked first, then by tokenId asc
        activeRows.sort(
          (a: any, b: any) => Number(b.unlocked) - Number(a.unlocked) || Number(a.tokenId) - Number(b.tokenId)
        );

        // Sort withdrawn stakes by withdrawnAt desc (most recent first)
        withdrawnRows.sort((a: any, b: any) => new Date(b.withdrawnAt).getTime() - new Date(a.withdrawnAt).getTime());

        setActiveItems(activeRows);
        setWithdrawnItems(withdrawnRows);
        setSelected(Object.fromEntries(activeRows.map((r) => [r.tokenId, false])));
      } catch (e) {
        console.error("WithdrawSection load error", e);
        setError(t('staking.failedToLoadStakedNfts'));
      } finally {
        setLoading(false);
      }
    })();
  }, [accountAddress, chainKey, selectedCollection, refreshTrigger, t]);

  const unlockedItems = useMemo(() => activeItems.filter((i) => i.unlocked), [activeItems]);
  const lockedItems = useMemo(() => activeItems.filter((i) => !i.unlocked), [activeItems]);
  const pickedUnlocked = useMemo(
    () => unlockedItems.filter((i) => selected[i.tokenId]).map((i) => BigInt(i.tokenId)),
    [unlockedItems, selected]
  );

  const canWithdraw = pickedUnlocked.length > 0 && !withdrawing;

  return (
    <div className="mt-8 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          {t('staking.withdrawStakedNfts')}
        </h3>
        <p className="text-white/60 text-sm mt-1">{t('staking.selectStakedNftsDescription')}</p>
      </div>

      {!accountAddress ? (
        <div className="text-white/60">{t('staking.connectWalletToSeeStakedNfts')}</div>
      ) : loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/60" />
          <p className="text-white/60 mt-2">{t('staking.loadingStakedNfts')}</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 mx-auto text-yellow-400" />
          <p className="text-yellow-300 mt-2">{error}</p>
        </div>
      ) : activeItems.length === 0 && withdrawnItems.length === 0 ? (
        <div className="text-white/60">{t('staking.noStakesFoundForNetwork')}</div>
      ) : (
        <>
          {/* Active Stakes */}
          {activeItems.length > 0 && (
            <>
              {/* Unlocked */}
              {unlockedItems.length > 0 && (
                <>
                  <h4 className="text-white font-medium mb-3">Available to Withdraw</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    {unlockedItems.map((it) => {
                      const on = !!selected[it.tokenId];
                      return (
                        <button
                          key={it.tokenId}
                          onClick={() => setSelected((s) => ({ ...s, [it.tokenId]: !s[it.tokenId] }))}
                          className={`group relative overflow-hidden rounded-xl p-3 text-left transition-all duration-300 ${
                            on
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                              : "bg-white/5 hover:bg-white/10 border border-white/10"
                          }`}
                        >
                          <div className="relative">
                            <img
                              src={it.imageUrl}
                              alt={`Token #${it.tokenId}`}
                              className="w-full aspect-square rounded-lg object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-white font-semibold">#{it.tokenId}</div>
                            {on && <CheckCircle className="w-5 h-5 text-white" />}
                          </div>
                          <div className="text-xs text-white/70">Staked {new Date(it.stakedAt).toLocaleDateString()}</div>
                          <div className="text-xs text-green-300 mt-1">Unlocked</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Locked */}
              {lockedItems.length > 0 && (
                <>
                  <h4 className="text-white font-medium mb-3">Locked (Not Yet Withdrawable)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    {lockedItems.map((it) => (
                      <div
                        key={it.tokenId}
                        className="relative overflow-hidden rounded-xl p-3 text-left bg-white/5 border border-white/10 opacity-60 cursor-not-allowed"
                        title={`${it.remainingLabel} remaining`}
                      >
                        <div className="relative">
                          <img
                            src={it.imageUrl}
                            alt={`Token #${it.tokenId}`}
                            className="w-full aspect-square rounded-lg object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-white font-semibold">#{it.tokenId}</div>
                          <Lock className="w-5 h-5 text-yellow-300" />
                        </div>
                        <div className="text-xs text-white/70">Staked {new Date(it.stakedAt).toLocaleDateString()}</div>
                        <div className="text-xs text-yellow-300 mt-1">{it.remainingLabel} remaining</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Action bar for active stakes */}
              {unlockedItems.length > 0 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-white/70 text-sm">
                    Selected: {" "}
                    <span className="text-white font-medium">
                      {pickedUnlocked.length} NFT{pickedUnlocked.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button
                    onClick={() => onWithdraw(pickedUnlocked)}
                    disabled={!canWithdraw}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawing ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Withdrawing…
                      </span>
                    ) : (
                      `Withdraw ${pickedUnlocked.length || ""}`.trim()
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Withdrawn NFTs Section */}
          {withdrawnItems.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-gray-400" />
                Previously Withdrawn NFTs
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {withdrawnItems.map((it) => (
                  <div
                    key={it.tokenId}
                    className="relative overflow-hidden rounded-xl p-3 text-left bg-white/5 border border-white/10 opacity-75"
                  >
                    <div className="relative">
                      <img
                        src={it.imageUrl}
                        alt={`Token #${it.tokenId}`}
                        className="w-full aspect-square rounded-lg object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-white font-semibold">#{it.tokenId}</div>
                      <Unlock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-xs text-white/70">Staked {new Date(it.stakedAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Withdrawn {new Date(it.withdrawnAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Disable server-side rendering for this page
export const dynamic = 'force-dynamic';
