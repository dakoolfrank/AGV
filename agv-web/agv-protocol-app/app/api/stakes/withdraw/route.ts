// app/api/stakes/withdraw/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const wallet = String(body.wallet || "").toLowerCase();
    const chainId = Number(body.chainId);
    const nftType = String(body.collectionType || "").toLowerCase() as
      | "seed" | "tree" | "solar" | "compute";
    const tokenIds = (body.tokenIds || []).map((t: any) => String(t));

    if (!wallet || !chainId || !nftType || !tokenIds.length) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const walletCol = adminDb.collection("stakes").doc(wallet).collection("items");
    const chunks: string[][] = [];
    for (let i = 0; i < tokenIds.length; i += 10) chunks.push(tokenIds.slice(i, i + 10));

    let updated = 0;

    for (const chunk of chunks) {
      const snap = await walletCol
        .where("chainId", "==", chainId)
        .where("nftType", "==", nftType)
        .where("status", "==", "completed")
        .where("tokenId", "in", chunk)
        .get();

      if (snap.empty) continue;

      const batch = adminDb.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "withdrawn",
          withdrawnAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });
      await batch.commit();
      updated += snap.size;
    }

    // Also update wallet doc timestamp
    await adminDb.collection("stakes").doc(wallet).set(
      { updatedAt: Timestamp.now() },
      { merge: true }
    );

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    console.error("stakes/withdraw error", e);
    return NextResponse.json({ error: e?.message || "Failed to mark withdrawn" }, { status: 500 });
  }
}
