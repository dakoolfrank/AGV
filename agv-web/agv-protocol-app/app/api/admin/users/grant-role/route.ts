// app/api/admin/users/grant-role/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { requireAdmin, isSuperAdminEmail } from "../../_auth";

export async function POST(req: NextRequest) {
  try {
    // Verify requester (must be super admin)
    const requester = await requireAdmin(req);
    if (!requester || !isSuperAdminEmail(requester.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const inputEmail = String(body?.email || "").trim().toLowerCase();
    const action = (body?.action as "grant" | "revoke") || "grant";

    if (!inputEmail) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Ensure user exists (create placeholder if not found)
    let user;
    try {
      user = await adminAuth.getUserByEmail(inputEmail);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        // For passwordless, it's fine to create a user with just an email
        user = await adminAuth.createUser({
          email: inputEmail,
          emailVerified: false,
          disabled: false,
        });
      } else {
        throw err;
      }
    }

    // Merge/adjust claims
    const existing = (user.customClaims || {}) as Record<string, any>;
    const rolesArr = Array.isArray(existing.roles) ? existing.roles.map(String) : [];
    const nextClaims: Record<string, any> = { ...existing };

    if (action === "grant") {
      nextClaims.admin = true;
      nextClaims.role = "admin";
      nextClaims.roles = Array.from(new Set([...rolesArr, "admin"]));
    } else {
      nextClaims.admin = false;
      nextClaims.roles = rolesArr.filter((r) => r.toLowerCase() !== "admin");
      if ((String(nextClaims.role || "")).toLowerCase() === "admin") {
        delete nextClaims.role;
      }
    }

    // Apply & force token refresh
    await adminAuth.setCustomUserClaims(user.uid, nextClaims);
    await adminAuth.revokeRefreshTokens(user.uid);

    return NextResponse.json({ ok: true, email: inputEmail, uid: user.uid, claims: nextClaims });
  } catch (err: any) {
    // Normalize Firebase error codes to HTTP
    console.error("grant-role error:", err);
    const code = err?.code || err?.errorInfo?.code;
    const msg = err?.message || err?.errorInfo?.message || "Internal error";
    const status =
      code === "auth/insufficient-permission" ? 403 :
      code === "auth/invalid-id-token" || code === "auth/id-token-expired" ? 401 :
      code === "auth/invalid-email" ? 400 :
      code === "auth/user-disabled" ? 400 :
      500;

    return NextResponse.json({ error: msg, code }, { status });
  }
}
