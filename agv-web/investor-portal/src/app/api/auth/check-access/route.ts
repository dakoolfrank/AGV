import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', status: 'unauthorized' },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid token', status: 'unauthorized' },
        { status: 401 },
      );
    }

    // Get user record from Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found', status: 'not_found' },
        { status: 404 },
      );
    }

    const userData = userDoc.data();
    if (!userData) {
      return NextResponse.json(
        { error: 'User data not found', status: 'not_found' },
        { status: 404 },
      );
    }

    // Get organization record
    const orgDoc = await adminDb.collection('organizations').doc(userData.organizationId).get();
    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: 'Organization not found', status: 'not_found' },
        { status: 404 },
      );
    }

    const orgData = orgDoc.data();
    if (!orgData) {
      return NextResponse.json(
        { error: 'Organization data not found', status: 'not_found' },
        { status: 404 },
      );
    }

    // Check user status
    if (userData.status !== 'active') {
      return NextResponse.json(
        {
          error: 'Account not active',
          status: userData.status || 'inactive',
        },
        { status: 403 },
      );
    }

    // Check organization status
    if (orgData.status !== 'approved') {
      return NextResponse.json(
        {
          error: 'Organization not approved',
          status: orgData.status || 'pending',
        },
        { status: 403 },
      );
    }

    // Access granted
    return NextResponse.json({
      success: true,
      user: {
        email: userData.email,
        organizationId: userData.organizationId,
        organizationName: userData.organizationName,
        role: userData.role,
      },
      organization: {
        id: orgDoc.id,
        name: orgData.name,
        status: orgData.status,
      },
    });
  } catch (error) {
    console.error('Check access error:', error);
    return NextResponse.json(
      { error: 'Internal server error', status: 'error' },
      { status: 500 },
    );
  }
}

