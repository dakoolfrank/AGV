import { NextRequest, NextResponse } from "next/server";
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase-admin';
import { requireAdmin, isAuthorizedAdminEmail } from '@/lib/auth';

const adminAuth = getAuth(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Check if the requester is a super admin
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Only authorized admins can set claims' }, { status: 403 });
    }

    const { uid, claims } = await req.json();
    
    if (!uid || !claims) {
      return NextResponse.json({ error: 'UID and claims are required' }, { status: 400 });
    }

    // Set custom claims for the user
    await adminAuth.setCustomUserClaims(uid, claims);

    return NextResponse.json({ 
      success: true, 
      message: 'Claims updated successfully' 
    });

  } catch (error) {
    console.error('Error setting claims:', error);
    return NextResponse.json(
      { error: 'Failed to set claims' }, 
      { status: 500 }
    );
  }
}
