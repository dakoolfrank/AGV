// app/api/admin/superadmins/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function isWallet(x?: string) {
  return /^0x[a-f0-9]{40}$/i.test(String(x || ""));
}

function ok(req: Request) {
  const key = req.headers.get("x-admin-key");
  return key && key === (process.env.ADMIN_MIGRATE_KEY || process.env.ADMIN_KEY);
}

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snap = await adminDb.collection("superadmins").get();
  return NextResponse.json({ ok: true, superadmins: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

export async function POST(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { wallet, email, note } = await req.json().catch(() => ({} as any));
  const id =
    (isWallet(wallet) && String(wallet).toLowerCase()) ||
    (email && String(email).toLowerCase());
  if (!id) return NextResponse.json({ error: "wallet or email required" }, { status: 400 });

  await adminDb.collection("superadmins").doc(id).set(
    {
      wallet: isWallet(wallet) ? String(wallet).toLowerCase() : null,
      email: email ? String(email).toLowerCase() : null,
      note: note || null,
      addedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await adminDb.collection("superadmins").doc(String(id).toLowerCase()).delete();
  return NextResponse.json({ ok: true });
}
