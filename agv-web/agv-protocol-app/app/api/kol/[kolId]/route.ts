// app/api/kol/[kolId]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

type Params = { kolId: string };
type MaybePromise<T> = T | Promise<T>;

export async function GET(req: NextRequest, ctx: { params: MaybePromise<Params> }) {
  try {
    const { kolId: kolIdRaw } = await Promise.resolve(ctx.params);
    const kolId = decodeURIComponent(kolIdRaw || "").trim();
    if (!kolId) {
      return NextResponse.json({ error: "kolId required" }, { status: 400 });
    }

    // --- Auth (strict) ---
    const authH = req.headers.get("authorization") || "";
    const token = authH.startsWith("Bearer ") ? authH.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // --- Get KOL (by docId -> by 'kolId' field -> by legacy 'kolID') ---
    let kol: any = null;

    const byId = await adminDb.collection("kols").doc(kolId).get();
    if (byId.exists) {
      kol = { id: byId.id, ...byId.data() };
    } else {
      const q1 = await adminDb.collection("kols").where("kolId", "==", kolId).limit(1).get();
      if (!q1.empty) {
        kol = { id: q1.docs[0].id, ...q1.docs[0].data() };
      } else {
        const q2 = await adminDb.collection("kols").where("kolID", "==", kolId).limit(1).get();
        if (!q2.empty) {
          kol = { id: q2.docs[0].id, ...q2.docs[0].data() };
          if (!kol.kolId) kol.kolId = kolId; // normalize for client
        }
      }
    }
    if (kol && !kol.kolId) kol.kolId = kolId;

    // --- Get mint events (doc id === kolId) ---
    const md = await adminDb.collection("mintEvents").doc(kolId).get();
    const mintDoc = md.exists ? ({ kolId, ...md.data() } as any) : null;

    return NextResponse.json({ kol, mintDoc });
  } catch (err: any) {
    console.error("kol get error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
