import { NextRequest, NextResponse } from "next/server";
import { tryVerify, isAdminClaim, isAuthorizedAdminEmail } from "../_auth";

export async function GET(req: NextRequest) {
  const decoded = await tryVerify(req);
  const email = decoded?.email ?? null;
  const isAdmin = !!decoded && isAdminClaim(decoded);
  const isAuthorized = !!decoded && await isAuthorizedAdminEmail(email);

  return NextResponse.json({
    authed: !!decoded,
    email,
    isAdmin: isAdmin && isAuthorized,
    isSuperAdmin: isAuthorized, // Keep this for backward compatibility
    claims: {
      role: decoded?.role ?? null,
      roles: Array.isArray(decoded?.roles) ? decoded!.roles : [],
      admin: decoded?.admin === true,
    },
  });
}
