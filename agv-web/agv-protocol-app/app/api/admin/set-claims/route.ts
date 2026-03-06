// app/api/admin/set-claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { requireAdmin } from "../_auth";
import { z } from "zod";

export const runtime = "nodejs";

const Payload = z.object({
  uid: z.string().optional(),
  email: z.string().email().optional(),
  admin: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
  role: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = Payload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    );
  }

  let uid = parsed.data.uid;
  if (!uid && parsed.data.email) {
    const user = await adminAuth.getUserByEmail(parsed.data.email);
    uid = user.uid;
  }
  if (!uid) {
    return NextResponse.json({ error: "uid or email required" }, { status: 400 });
  }

  const claims: Record<string, any> = {};
  if (typeof parsed.data.admin === "boolean") claims.admin = parsed.data.admin;
  if (parsed.data.role) claims.role = parsed.data.role;
  if (parsed.data.roles) claims.roles = parsed.data.roles;

  await adminAuth.setCustomUserClaims(uid, claims);

  return NextResponse.json({ ok: true, uid, claims });
}
