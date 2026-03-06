// hooks/useStakingView.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { createThirdwebClient, getContract } from "thirdweb";
import { polygon, arbitrum, bsc } from "thirdweb/chains";
import { collection as fsCollection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Contracts / ABIs
import { NFT_CONTRACTS, STAKE_CONTRACTS, STAKE_ABI } from "@/lib/contracts";

type ChainKey = "56" | "42161" | "137";
type Collection = "seed" | "tree" | "solar" | "compute";

export type OwnedNft = {
  chainId: number;
  tokenAddress: string; // lowercased
  tokenId: bigint;
  standard: "ERC721" | "ERC1155";
  collection: { address: string };
  imageUrl?: string;
  name?: string | null;
  amount?: bigint;
};

// ───────────────── helpers ─────────────────
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const CHAIN_BY_KEY: Record<ChainKey, any> = {
  "56": bsc,
  "42161": arbitrum,
  "137": polygon,
};

function chainIdToKey(chainId: number): ChainKey | null {
  if (chainId === 56) return "56";
  if (chainId === 42161) return "42161";
  if (chainId === 137) return "137";
  return null;
}
function toHexChain(chainId: number) {
  return "0x" + chainId.toString(16);
}
function toGateway(u?: string | null) {
  if (!u) return undefined;
  if (u.startsWith("ipfs://")) return u.replace(/^ipfs:\/\//, "https://ipfscdn.io/ipfs/");
  return u.replace(/^https?:\/\/ipfs\.io\/ipfs\//i, "https://ipfscdn.io/ipfs/");
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// ───────────────── hook ─────────────────
/**
 * Merges on-chain and Firestore staking views with on-chain priority.
 * - ownedStaked: union(on-chain, firestore) without duplicates; on-chain wins.
 * - ownedUnstaked: wallet NFTs minus ownedStaked set.
 */
export function useStakingView(params: { chainId: number; collection: Collection }) {
  const { chainId, collection: nftCollection } = params;
  const account = useActiveAccount();

  const [loadingWallet, setLoadingWallet] = useState(false);
  const [errorWallet, setErrorWallet] = useState<string | null>(null);
  const [ownedWallet, setOwnedWallet] = useState<OwnedNft[]>([]);

  const [fsActive, setFsActive] = useState<string[]>([]); // tokenId strings recorded as active in Firestore
  const [errorFs, setErrorFs] = useState<string | null>(null);

  const chainKey = useMemo(() => chainIdToKey(chainId), [chainId]);
  const agvAddress = useMemo(() => {
    if (!chainKey) return null;
    const addr = NFT_CONTRACTS[chainKey]?.[nftCollection];
    return addr ? addr.toLowerCase() : null;
  }, [chainKey, nftCollection]);

  // ─── on-chain: read staked tokens for this wallet & collection on current chain
  const stakeContract = useMemo(() => {
    if (!chainKey) return null;
    const chain = CHAIN_BY_KEY[chainKey];
    const address = STAKE_CONTRACTS[chainKey][nftCollection];
    return getContract({ client, chain, address, abi: STAKE_ABI as any });
  }, [chainKey, nftCollection]);

  const rStake = useReadContract({
    contract: stakeContract || undefined,
    method:
      "function getStakeInfo(address _staker) view returns (uint256[] _tokensStaked, uint256 _rewards)",
    params: [account?.address ?? ZERO_ADDR],
    queryOptions: { enabled: !!stakeContract && !!account?.address },
  });

  const onChainIds: string[] = useMemo(() => {
    const tuple = (rStake.data ?? [[], 0n]) as [bigint[], bigint];
    return (tuple[0] || []).map(String);
  }, [rStake.data]);

  // ─── Firestore: active positions for this wallet/chain/collection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErrorFs(null);
      if (!account?.address || !chainKey || !agvAddress) {
        setFsActive([]);
        return;
      }
      try {
        const qSnap = await getDocs(
          query(
            fsCollection(db, "staking_positions"),
            where("address", "==", account.address.toLowerCase()),
            where("chain", "==", chainKey),
            where("collection", "==", nftCollection),
            where("status", "==", "active")
          )
        );
        const ids: string[] = [];
        qSnap.forEach((d) => {
          const tokenId = String((d.data() as any).tokenId);
          if (tokenId) ids.push(tokenId);
        });
        if (!cancelled) setFsActive(ids);
      } catch (e: any) {
        if (!cancelled) {
          setErrorFs(e?.message || "Failed to load Firestore positions");
          setFsActive([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.address, chainKey, nftCollection, agvAddress]);

  // ─── wallet NFTs: via your /api/wallet-nfts (Moralis-backed)
  const loadWalletNfts = async () => {
    if (!account?.address || !chainId || !agvAddress) return;

    setLoadingWallet(true);
    setErrorWallet(null);
    try {
      const url = new URL("/api/wallet-nfts", window.location.origin);
      url.searchParams.set("address", account.address);
      url.searchParams.set("chain", toHexChain(chainId));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        items: Array<{
          tokenAddress: string;
          tokenIdStr: string;
          contractType?: "ERC721" | "ERC1155";
          imageUrl?: string | null;
          name?: string | null;
        }>;
      };
      const items = (data?.items ?? [])
        .filter((n) => n?.tokenAddress?.toLowerCase() === agvAddress)
        .map<OwnedNft>((n) => ({
          chainId,
          tokenAddress: n.tokenAddress.toLowerCase(),
          tokenId: BigInt(n.tokenIdStr || "0"),
          standard: (n.contractType as any) === "ERC1155" ? "ERC1155" : "ERC721",
          collection: { address: agvAddress },
          imageUrl: toGateway(n.imageUrl || undefined),
          name: n.name ?? null,
        }));
      setOwnedWallet(items);
    } catch (e: any) {
      setErrorWallet(e?.message || "Failed to load wallet NFTs");
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    loadWalletNfts();
  }, [account?.address, chainId, agvAddress]);

  // ─── merge on-chain + firestore (on-chain priority, no dups)
  const unionStakedIds = useMemo(() => {
    const oc = new Set(onChainIds); // on-chain first
    const fs = fsActive;
    for (const id of fs) oc.add(id);
    return oc; // set of strings
  }, [onChainIds, fsActive]);

  // ownedStaked as minimal OwnedNft rows (id + address); metadata is optional
  const ownedStaked: OwnedNft[] = useMemo(() => {
    if (!agvAddress) return [];
    return [...unionStakedIds].map((id) => ({
      chainId,
      tokenAddress: agvAddress,
      tokenId: BigInt(id),
      standard: "ERC721",
      collection: { address: agvAddress },
      imageUrl: undefined,
      name: nftCollection.toUpperCase(),
    }));
  }, [unionStakedIds, agvAddress, chainId, nftCollection]);

  // true unstaked = wallet NFTs minus unionStakedIds
  const ownedUnstaked = useMemo(() => {
    const stakedSet = unionStakedIds;
    return ownedWallet.filter((x) => !stakedSet.has(x.tokenId.toString()));
  }, [ownedWallet, unionStakedIds]);

  const refetch = () => {
    // Refetch on-chain data
    rStake.refetch();
    // Reload wallet NFTs
    loadWalletNfts();
  };

  return {
    loading: loadingWallet || rStake.isPending,
    error: errorWallet || (rStake.error ? String(rStake.error) : null) || errorFs,
    ownedUnstaked,
    ownedStaked,
    onChainIds, // diagnostics
    fsActive,   // diagnostics
    refetch,
  };
}
