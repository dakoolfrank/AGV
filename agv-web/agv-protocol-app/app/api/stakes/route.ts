// app/api/stakes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { DAY_MS, BASE_DAILY_RRGP, bonusFor, NftType } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const wallet = String(body.wallet || "").toLowerCase();
    const chainId = Number(body.chainId);
    const nftType = String(body.nftType || "").toLowerCase() as NftType;
    const tokenIds: string[] = (body.tokenIds || []).map((t: any) => String(t));
    const lockDays = Number(body.lockDays || 0);
    const txHash = body.txHash ?? null;

    if (!wallet || !chainId || !["seed", "tree", "solar", "compute"].includes(nftType) || tokenIds.length === 0 || lockDays < 1) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Ensure wallet doc exists
    const walletRef = adminDb.collection("stakes").doc(wallet);
    const now = Timestamp.now();
    await walletRef.set(
      { wallet, createdAt: now, updatedAt: now },
      { merge: true }
    );

    const itemsCol = walletRef.collection("items");

    // Precompute legacy rewards fields
    const baseDaily = BASE_DAILY_RRGP[nftType] ?? 0;
    const bonusMultiplier = bonusFor(lockDays);
    const amount = 1; // staking NFTs – adjust if you support ERC1155 amounts

    const stakedAt = new Date();
    const unlockAt = new Date(stakedAt.getTime() + lockDays * DAY_MS);
    const scheduledTotal = baseDaily * bonusMultiplier * lockDays * amount;

    // Use deterministic doc IDs to avoid duplicates per (chainId, nftType, tokenId)
    // Example: "56:seed:123"
    const batch = adminDb.batch();
    for (const tokenId of tokenIds) {
      const docId = `${chainId}:${nftType}:${tokenId}`;

      batch.set(
        itemsCol.doc(docId),
        {
          chainId,
          nftType,
          tokenId,
          amount,

          stakedAt: Timestamp.fromDate(stakedAt),
          unlockAt: Timestamp.fromDate(unlockAt),
          lockDays,

          baseDaily,
          bonusMultiplier,
          scheduledTotal,

          status: "active",
          accruedSoFar: 0,
          lastAccruedAt: Timestamp.fromDate(stakedAt),

          txHash,
          kolId: null,

          createdAt: now,
          updatedAt: now,
        },
        { merge: true } // idempotent if user retries
      );
    }

    batch.update(walletRef, { updatedAt: Timestamp.now() });
    await batch.commit();

    return NextResponse.json({ ok: true, count: tokenIds.length }, { status: 200 });
  } catch (e: any) {
    console.error("stakes POST error", e);
    return NextResponse.json({ error: e?.message ?? "Failed to record stakes" }, { status: 500 });
  }
}
