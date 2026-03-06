import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface DataroomUser {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
}

export interface DataroomOrganization {
  id: string;
  name: string;
  domain: string;
  status: string;
}

export interface DataroomAccessResult {
  user: DataroomUser;
  organization: DataroomOrganization;
}

/**
 * Middleware to require dataroom access
 * Verifies Firebase token, checks user and organization status
 */
export async function requireDataroomAccess(
  req: NextRequest,
): Promise<DataroomAccessResult | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return null;
    }

    // Get user record
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    if (!userData) {
      return null;
    }

    // Check user status
    if (userData.status !== 'active') {
      return null;
    }

    // Get organization record
    const orgDoc = await adminDb.collection('organizations').doc(userData.organizationId).get();
    if (!orgDoc.exists) {
      return null;
    }

    const orgData = orgDoc.data();
    if (!orgData) {
      return null;
    }

    // Check organization status
    if (orgData.status !== 'approved') {
      return null;
    }

    return {
      user: {
        id: decodedToken.uid,
        email: userData.email as string,
        organizationId: userData.organizationId as string,
        organizationName: userData.organizationName as string,
        role: userData.role as string,
        status: userData.status as string,
      },
      organization: {
        id: orgDoc.id,
        name: orgData.name as string,
        domain: orgData.domain as string,
        status: orgData.status as string,
      },
    };
  } catch (error) {
    console.error('requireDataroomAccess error:', error);
    return null;
  }
}

