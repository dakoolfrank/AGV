// lib/recordMint.ts
import {
  Firestore,
  runTransaction,
  doc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export type ChainId = "56" | "137" | "42161";
export type NftType = "seed" | "tree" | "solar" | "compute";

export interface MintRecordPayload {
  address: string;          // buyer wallet
  nftType: NftType;         // "seed" | "tree" | "solar" | "compute"
  quantity: number;         // integer >= 1
  chainId: ChainId;         // "56" | "137" | "42161"
  txHash: string;           // on-chain tx hash
  timestamp?: Date;         // optional; server timestamp will be used if omitted
  mintType?: "public" | "agent";
}

/**
 * Strict recorder for successful mints.
 * - Requires an existing KOL in `kols` (random doc ID, has field `kolId`).
 * - Requires an existing aggregate doc in `mintEvents/{kolId}`.
 * - Idempotent on txHash: no double-increments if the same txHash is seen again.
 * - Keeps *events* on the aggregate doc (capped at the last 500).
 * - Updates counters on BOTH `mintEvents/{kolId}` and the matching `kols/{randomId}` doc.
 */
export async function recordSuccessfulMintStrict(
  db: Firestore,
  kolId: string,
  payload: MintRecordPayload
): Promise<"ok" | "deduped"> {
  const cleanKolId = (kolId || "").trim();
  if (!cleanKolId) throw new Error("kol-id-empty");

  // Resolve the KOL doc (random doc id) by kolId field.
  const kq = query(collection(db, "kols"), where("kolId", "==", cleanKolId));
  const ks = await getDocs(kq);
  if (ks.empty) throw new Error("kol-not-found");

  const kolDocRef = ks.docs[0].ref;
  const mintDocRef = doc(db, "mintEvents", cleanKolId);

  const nftKey = payload.nftType; // dynamic field to bump
  const qty = Number(payload.quantity || 0);
  if (!qty || qty < 1) throw new Error("invalid-quantity");

  const txHashLower = (payload.txHash || "").toLowerCase();

  return runTransaction(db, async (tx) => {
    // Must exist (admin created). Do NOT create here.
    const mintSnap = await tx.get(mintDocRef);
    if (!mintSnap.exists()) {
      throw new Error("mint-doc-missing"); // admin must have initialized this
    }

    const kolSnap = await tx.get(kolDocRef);
    if (!kolSnap.exists()) throw new Error("kol-not-found"); // race protection

    const mintData = (mintSnap.data() || {}) as any;
    const events: any[] = Array.isArray(mintData.events) ? mintData.events : [];

    // Idempotency: skip if txHash already present (case-insensitive).
    if (
      txHashLower &&
      events.some((e) => String(e?.txHash || "").toLowerCase() === txHashLower)
    ) {
      return "deduped";
    }

    // Current counters
    const curSeed = Number(mintData.seed || 0);
    const curTree = Number(mintData.tree || 0);
    const curSolar = Number(mintData.solar || 0);
    const curCompute = Number(mintData.compute || 0);

    // Per-chain bucket
    const chainId = payload.chainId;
    const perChain = (mintData.perChain || {}) as Record<
      string,
      Partial<Record<NftType, number>>
    >;
    const chainBucket = perChain[chainId] || {};

    // Prepare updates (add qty to appropriate nft type)
    const newTotals = {
      seed: nftKey === "seed" ? curSeed + qty : curSeed,
      tree: nftKey === "tree" ? curTree + qty : curTree,
      solar: nftKey === "solar" ? curSolar + qty : curSolar,
      compute: nftKey === "compute" ? curCompute + qty : curCompute,
    };

    const newPerChainQty = Number(chainBucket[nftKey] || 0) + qty;

    // Append event (cap to last 500)
    const newEvent = {
      kolId: cleanKolId,
      address: payload.address,
      nftType: nftKey,
      quantity: qty,
      chainId,
      txHash: payload.txHash,
      timestamp: payload.timestamp ?? serverTimestamp(),
      mintType: payload.mintType ?? "public",
    };
    const updatedEvents = [...events.slice(-499), newEvent];

    // Update aggregate doc
    tx.update(mintDocRef, {
      ...newTotals,
      [`perChain.${chainId}.${nftKey}`]: newPerChainQty,
      events: updatedEvents,
      updatedAt: serverTimestamp(),
    });

    // Update the KOL doc’s fast counters too
    const k = (kolSnap.data() || {}) as any;
    const kSeed = Number(k.seed || 0);
    const kTree = Number(k.tree || 0);
    const kSolar = Number(k.solar || 0);
    const kCompute = Number(k.compute || 0);

    const kolNewTotals = {
      seed: nftKey === "seed" ? kSeed + qty : kSeed,
      tree: nftKey === "tree" ? kTree + qty : kTree,
      solar: nftKey === "solar" ? kSolar + qty : kSolar,
      compute: nftKey === "compute" ? kCompute + qty : kCompute,
    };

    tx.update(kolDocRef, { ...kolNewTotals, updatedAt: serverTimestamp() });

    return "ok";
  });
}
