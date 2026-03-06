import { NextRequest, NextResponse } from "next/server";
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

const adminAuth = getAuth(adminApp);

export async function POST(req: NextRequest) {
  try {
    // Check if the requester is authorized (requireAdmin now checks email authorization)
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role = 'admin' } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user by email
    const user = await adminAuth.getUserByEmail(email);
    
    // Set admin claims
    await adminAuth.setCustomUserClaims(user.uid, {
      admin: true,
      role: role,
      roles: [role]
    });

    return NextResponse.json({ 
      success: true, 
      message: `Admin role granted to ${email}`,
      user: {
        uid: user.uid,
        email: user.email,
        role: role
      }
    });

  } catch (error: unknown) {
    console.error('Error granting admin role:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to grant admin role' }, 
      { status: 500 }
    );
  }
}
