import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export function isAdminClaim(decoded: any) {
  const roles: string[] = Array.isArray(decoded?.roles) ? decoded.roles : [];
  const role: string | undefined = decoded?.role;
  return decoded?.admin === true || role === "admin" || roles.includes("admin");
}

export async function isAuthorizedAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  
  try {
    const doc = await adminDb.collection('authorized_admin_emails').doc(email.toLowerCase()).get();
    return doc.exists && doc.data()?.authorized === true;
  } catch (error) {
    console.error('Error checking authorized admin email:', error);
    return false;
  }
}

export function isSuperAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_SUPER_ADMINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(m[1], true);
    
    // Check if user has admin claims AND is in the authorized emails list
    if (isAdminClaim(decoded)) {
      const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
      return isAuthorized ? decoded : null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/** For endpoints that just need to know who the user is (not necessarily admin) */
export async function tryVerify(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return await adminAuth.verifyIdToken(m[1], true);
  } catch {
    return null;
  }
}
