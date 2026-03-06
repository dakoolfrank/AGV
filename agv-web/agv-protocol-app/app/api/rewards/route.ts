// app/api/rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import {
  accruedToDate,
  DAY_MS,
  NftType,
  BASE_DAILY_RRGP,
  bonusFor,
} from "@/lib/rewards";

const NFT_TYPES = ["seed", "tree", "solar", "compute"] as const;

// helpers
function asDate(v: any): Date | undefined {
  if (!v) return undefined;
  if (typeof v?.toDate === "function") return v.toDate() as Date;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const wallet = (searchParams.get("wallet") || "").toLowerCase();
    if (!wallet) {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }


    const chainIdFilter = searchParams.get("chainId")
      ? Number(searchParams.get("chainId"))
      : undefined;

    const nftTypeParam = (searchParams.get("nftType") || "").toLowerCase();
    const nftTypeFilter = (NFT_TYPES as readonly string[]).includes(nftTypeParam)
      ? (nftTypeParam as NftType)
      : undefined;

    const includeWithdrawn =
      (searchParams.get("includeWithdrawn") || "false") === "true";

    // Read wallet-scoped items: /stakes/{wallet}/items
    const itemsRef = adminDb.collection("stakes").doc(wallet).collection("items");
    const snap = await itemsRef.get();

    const now = new Date();

    // ✅ If wallet has no records, return 200 with empty totals
    if (snap.empty) {
      return NextResponse.json(
        {
          wallet,
          asOf: now.toISOString(),
          totals: { accrued: 0, scheduled: 0, remaining: 0 },
          stakes: [],
        },
        { status: 200 }
      );
    }

    // filter in memory (avoids index requirements)
    const effectiveItems = snap.docs
      .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() as any }))
      .filter(({ data }) => {
        if (!includeWithdrawn && data.status === "withdrawn") return false;
        if (typeof chainIdFilter === "number" && Number(data.chainId) !== chainIdFilter)
          return false;
        if (nftTypeFilter && String(data.nftType).toLowerCase() !== nftTypeFilter) return false;
        return true;
      });

    let totalAccrued = 0;
    let totalCap = 0;

    // We'll chunk lazy updates to avoid hitting Firestore's 500-op batch limit
    type PendingUpdate = { ref: FirebaseFirestore.DocumentReference; data: Record<string, any> };
    const pending: PendingUpdate[] = [];

    const items = effectiveItems.flatMap(({ id, ref, data }) => {
      try {
        const nftTypeRaw = String(data.nftType || "").toLowerCase();
        const isKnownType = (NFT_TYPES as readonly string[]).includes(nftTypeRaw);
        const nftType = (isKnownType ? nftTypeRaw : "seed") as NftType;

        // Robust dates: prefer stakedAt, else createdAt, else "now"
        const stakedAt: Date =
          asDate(data.stakedAt) ??
          asDate(data.createdAt) ??
          new Date();

        const lockDays = Number(data.lockDays ?? 0);
        const amount = Number(data.amount ?? 1);

        // prefer stored unlockAt; else derive from stakedAt + lockDays
        const unlockAtObj: Date =
          asDate(data.unlockAt) ??
          new Date(stakedAt.getTime() + lockDays * DAY_MS);

        // safe lookups with fallbacks
        const baseDaily = Number(
          data.baseDaily ?? (BASE_DAILY_RRGP as Record<string, number>)[nftType] ?? 0
        );
        const bonusMultiplier = Number(
          data.bonusMultiplier ?? bonusFor(lockDays) ?? 1
        );

        // cap accrual at unlock
        const effectiveNow = new Date(Math.min(now.getTime(), unlockAtObj.getTime()));
        const result = accruedToDate({
          nftType,
          amount,
          stakedAt,
          lockDays,
          now: effectiveNow,
        });

        const scheduledTotal = Number(
          data.scheduledTotal ?? baseDaily * bonusMultiplier * lockDays * amount
        );

        totalAccrued += result.accrued;
        totalCap += scheduledTotal;

        // decide whether to lazily write back derived fields / accrual snapshot
        const last: Date | undefined = asDate(data.lastAccruedAt);
        const lastMs = last?.getTime?.() ?? stakedAt.getTime();
        const shouldUpdate =
          effectiveNow.getTime() - lastMs >= DAY_MS ||
          Math.abs(Number(data.accruedSoFar ?? 0) - result.accrued) > 0.000001 ||
          data.scheduledTotal === undefined ||
          data.baseDaily === undefined ||
          data.bonusMultiplier === undefined;

        if (shouldUpdate) {
          const update: Record<string, any> = {
            accruedSoFar: result.accrued,
            lastAccruedAt: Timestamp.fromDate(effectiveNow),
            updatedAt: Timestamp.now(),
            baseDaily,
            bonusMultiplier,
            scheduledTotal,
          };

          // flip to completed when past unlock (but still not withdrawn)
          if (effectiveNow.getTime() >= unlockAtObj.getTime() && data.status === "active") {
            update.status = "completed";
          }

          pending.push({ ref, data: update });
        }

        return [
          {
            id,
            chainId: Number(data.chainId ?? 0),
            nftType,
            tokenId: String(data.tokenId ?? ""),
            amount,
            stakedAt: stakedAt.toISOString(),
            unlockAt: unlockAtObj.toISOString(),
            lockDays,
            baseDaily,
            bonusMultiplier,
            scheduledTotal,
            accrued: result.accrued,
            daysCounted: result.daysCounted,
            status: data.status ?? "active",
            txHash: data.txHash ?? null,
            kolId: data.kolId ?? null,
            withdrawnAt: data.withdrawnAt ? data.withdrawnAt.toDate().toISOString() : null,
          },
        ];
      } catch (e) {
        // Skip bad docs instead of failing the whole response
        console.error("rewards: bad doc", id, e);
        return [];
      }
    });

    // Commit lazy updates in chunks to respect Firestore batch limits
    if (pending.length) {
      const CHUNK = 400; // keep headroom below 500
      for (let i = 0; i < pending.length; i += CHUNK) {
        const batch = adminDb.batch();
        for (const { ref, data } of pending.slice(i, i + CHUNK)) {
          batch.update(ref, data);
        }
        await batch.commit();
      }
    }

    // newest first
    items.sort((a, b) => (a.stakedAt < b.stakedAt ? 1 : -1));

    return NextResponse.json(
      {
        wallet,
        asOf: now.toISOString(),
        totals: {
          accrued: totalAccrued,
          scheduled: totalCap,
          remaining: Math.max(0, totalCap - totalAccrued),
        },
        stakes: items,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("rewards error", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to compute rewards" },
      { status: 500 }
    );
  }
}
