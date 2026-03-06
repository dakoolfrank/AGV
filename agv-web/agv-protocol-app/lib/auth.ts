// lib/auth.ts
import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function requireAdmin(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user has admin role
    if (decodedToken.role !== 'admin') {
      return null;
    }

    return decodedToken;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}
