import { NextRequest, NextResponse } from "next/server";
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

const adminAuth = getAuth(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Check if the requester is authorized
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uid, claims } = await req.json();
    
    if (!uid || !claims) {
      return NextResponse.json({ error: 'UID and claims are required' }, { status: 400 });
    }

    // Set custom claims
    await adminAuth.setCustomUserClaims(uid, claims);

    return NextResponse.json({ 
      success: true, 
      message: 'Claims updated successfully',
      uid: uid,
      claims: claims
    });

  } catch (error: unknown) {
    console.error('Error setting claims:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to set claims' }, 
      { status: 500 }
    );
  }
}
