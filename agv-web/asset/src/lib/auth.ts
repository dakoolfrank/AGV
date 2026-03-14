// lib/auth.ts
import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import adminApp, { adminDb } from './firebase-admin';

const adminAuth = getAuth(adminApp);

export function isAdminClaim(decoded: { roles?: string[]; role?: string; admin?: boolean }) {
  const roles: string[] = Array.isArray(decoded?.roles) ? decoded.roles : [];
  const role: string | undefined = decoded?.role;
  return decoded?.admin === true || role === "admin" || roles.includes("admin");
}

export async function isAuthorizedAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  
  try {
    // Check if email exists in the authorized_admin_emails collection
    const docRef = adminDb.collection('authorized_admin_emails').doc(email.toLowerCase());
    const doc = await docRef.get();
    
    return doc.exists && doc.data()?.authorized === true;
  } catch (error) {
    console.error('Error checking authorized admin email:', error);
    return false;
  }
}

// Keep the old function for backward compatibility but mark as deprecated
export function isSuperAdminEmail(email?: string | null) {
  if (!email) return false;
  
  const superAdminEmails = [
    "superfrank@agvnexrur.ai",
    "frank@agvnexrur.ai"
  ];
  
  return superAdminEmails.includes(email.toLowerCase());
}

export async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(m[1], true);
    
    // Check if user is in the authorized emails list
    const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
    return isAuthorized ? decoded : null;
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
