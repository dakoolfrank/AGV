// hooks/useOnChainStakedByEvents.ts
import { useMemo } from "react";
import { createThirdwebClient, getContract, prepareEvent } from "thirdweb";
import { useContractEvents } from "thirdweb/react";
import { polygon, arbitrum, bsc } from "thirdweb/chains";
import { STAKE_ABI, STAKE_CONTRACTS, NFT_CONTRACTS } from "@/lib/contracts";

export type ChainKey = "56" | "42161" | "137";
export type CollectionKey = "seed" | "tree" | "solar" | "compute";

const CHAIN_CONFIG: Record<ChainKey, { id: number; label: string; chain: any }> = {
  "56": { id: 56, label: "BSC", chain: bsc },
  "42161": { id: 42161, label: "Arbitrum", chain: arbitrum },
  "137": { id: 137, label: "Polygon", chain: polygon },
};

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

/**
 * Your provided event signature. We keep it exactly as requested.
 * (Note: dynamic arrays are usually NOT indexed on-chain; we still follow your signature here.)
 */
const TokensStaked = prepareEvent({
  signature: "event TokensStaked(address indexed staker, uint256[] indexed tokenIds)",
});

/* ------------ Types returned by the hook ------------ */
export type StakedEventToken = {
  tokenId: string;             // stringified for UI
  tokenIdBig: bigint;          // bigint if you need it
  collection: CollectionKey;
  chainId: number;
  nftContract: string;
  stakeContract: string;
  // event meta (best-effort)
  txHash?: string;
  blockNumber?: bigint;
};

export type CollectionEventsResult = {
  collection: CollectionKey;
  chainId: number;
  stakeContract: string;
  nftContract: string;
  tokens: StakedEventToken[];
  rawEventsCount: number; // number of staked events seen (for this wallet) on this contract
};

export type UseOnChainStakedByEvents = {
  loading: boolean;
  error: string | null;
  data: {
    byCollection: Record<CollectionKey, CollectionEventsResult>;
    flat: StakedEventToken[];
    totalCount: number;
  } | null;
  refetch: () => void; // refetch events for all collections
};

/**
 * useOnChainStakedByEvents
 *
 * Reads TokensStaked events (via Thirdweb) on the selected chain for all 4 staking
 * contracts (seed/tree/solar/compute), filters to the given wallet, and returns
 * a deduped list of tokenIds per collection plus a flattened view.
 *
 * Notes:
 * - Purely on-chain events. No Firestore/admin I/O here.
 * - Dedupe by tokenId within each collection to avoid double-counting across multiple stakes.
 * - You can call `refetch()` after a stake/withdraw completes.
 * - If your contracts also emit a withdraw event, you can subtract those client-side in your page
 *   (this hook intentionally follows your snippet and only listens to TokensStaked).
 */
export function useOnChainStakedByEvents({
  wallet,
  chainKey,
  fromBlock, // optional historical starting block; omit to use default
  watch = true, // live subscribe to new events
}: {
  wallet?: string;
  chainKey: ChainKey;
  fromBlock?: bigint | number;
  watch?: boolean;
}): UseOnChainStakedByEvents {
  const chain = CHAIN_CONFIG[chainKey].chain;
  const chainId = CHAIN_CONFIG[chainKey].id;
  const walletLc = (wallet ?? "").toLowerCase();

  // Build contracts once per chain selection
  const stakeContracts = useMemo(() => {
    return (["seed", "tree", "solar", "compute"] as CollectionKey[]).reduce(
      (acc, col) => {
        const address = STAKE_CONTRACTS[chainKey][col];
        acc[col] = getContract({
          client,
          chain,
          address,
          abi: STAKE_ABI as any,
        });
        return acc;
      },
      {} as Record<CollectionKey, ReturnType<typeof getContract>>
    );
  }, [chain, chainKey]);

  // One event hook per collection (hooks can't be called in loops, so we enumerate)
  const seedEv = useContractEvents({
    contract: stakeContracts.seed,
    events: [TokensStaked],
    // @ts-expect-error: thirdweb types allow query options; keep minimal
    queryOptions: fromBlock ? { fromBlock } : undefined,
    subscribe: watch,
  });

  const treeEv = useContractEvents({
    contract: stakeContracts.tree,
    events: [TokensStaked],
    // @ts-expect-error
    queryOptions: fromBlock ? { fromBlock } : undefined,
    subscribe: watch,
  });

  const solarEv = useContractEvents({
    contract: stakeContracts.solar,
    events: [TokensStaked],
    // @ts-expect-error
    queryOptions: fromBlock ? { fromBlock } : undefined,
    subscribe: watch,
  });

  const computeEv = useContractEvents({
    contract: stakeContracts.compute,
    events: [TokensStaked],
    // @ts-expect-error
    queryOptions: fromBlock ? { fromBlock } : undefined,
    subscribe: watch,
  });

  // Aggregate loading/error
  const loading =
    seedEv.isLoading || treeEv.isLoading || solarEv.isLoading || computeEv.isLoading;

  const error =
    (seedEv.error?.message ??
      treeEv.error?.message ??
      solarEv.error?.message ??
      computeEv.error?.message) || null;

  // Helper to pull + normalize a single collection's events
  const normalize = (
    col: CollectionKey,
    events: any[] | undefined
  ): CollectionEventsResult => {
    const stakeContract = STAKE_CONTRACTS[chainKey][col];
    const nftContract = NFT_CONTRACTS[chainKey][col];

    const mine = (events ?? []).filter((e) => {
      const staker = (e?.args?.staker ?? e?.args?.account ?? "").toLowerCase();
      return walletLc && staker === walletLc;
    });

    // Flatten token arrays → strings → dedupe
    const tokenStrings: string[] = [];
    for (const e of mine) {
      const arr = (e?.args?.tokenIds || e?.args?.tokenIdList || []) as (bigint | string | number)[];
      for (const t of arr) {
        const asStr =
          typeof t === "bigint" ? t.toString() : typeof t === "number" ? String(t) : t;
        if (asStr) tokenStrings.push(asStr);
      }
    }

    const unique = Array.from(new Set(tokenStrings));

    const tokens: StakedEventToken[] = unique.map((tid) => ({
      tokenId: tid,
      tokenIdBig: BigInt(tid),
      collection: col,
      chainId,
      nftContract,
      stakeContract,
      txHash: undefined, // can be filled if needed from event data (e.transaction?.transactionHash)
      blockNumber: undefined, // can be filled from e.blockNumber
    }));

    return {
      collection: col,
      chainId,
      stakeContract,
      nftContract,
      tokens,
      rawEventsCount: mine.length,
    };
  };

  const byCollection = {
    seed: normalize("seed", seedEv.data),
    tree: normalize("tree", treeEv.data),
    solar: normalize("solar", solarEv.data),
    compute: normalize("compute", computeEv.data),
  };

  const flat = [
    ...byCollection.seed.tokens,
    ...byCollection.tree.tokens,
    ...byCollection.solar.tokens,
    ...byCollection.compute.tokens,
  ];

  const totalCount = flat.length;

  return {
    loading,
    error,
    data: { byCollection, flat, totalCount },
    refetch: () => {
      seedEv.refetch?.();
      treeEv.refetch?.();
      solarEv.refetch?.();
      computeEv.refetch?.();
    },
  };
}
