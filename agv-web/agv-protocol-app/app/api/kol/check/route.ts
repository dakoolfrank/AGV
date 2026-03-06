import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Check in KOL collection
    const kolQuery = await adminDb.collection('kols')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!kolQuery.empty) {
      const kolData = kolQuery.docs[0].data();
      return NextResponse.json({
        isKOL: true,
        profile: {
          email: kolData.email,
          name: kolData.name,
          walletAddress: kolData.walletAddress
        }
      });
    }

    // Check in KOL_profile collection as fallback
    const kolProfileQuery = await adminDb.collection('KOL_profile')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!kolProfileQuery.empty) {
      const profileData = kolProfileQuery.docs[0].data();
      return NextResponse.json({
        isKOL: true,
        profile: {
          email: profileData.email,
          name: profileData.name,
          walletAddress: profileData.walletAddress
        }
      });
    }

    return NextResponse.json({
      isKOL: false,
      profile: null
    });

  } catch (error) {
    console.error('Error checking KOL status:', error);
    return NextResponse.json(
      { error: 'Failed to check KOL status' },
      { status: 500 }
    );
  }
}
