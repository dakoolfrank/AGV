import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const snapshot = await adminDb.collection('whitelist_applications')
      .orderBy('submittedAt', 'desc')
      .get();
    
    const applications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        telegramUsername: data.telegramUsername,
        country: data.country,
        walletAddress: data.walletAddress,
        isKOL: data.isKOL || false,
        status: data.status || 'pending',
        submittedAt: data.submittedAt?.toDate?.() || data.submittedAt,
        hearAbout: data.hearAbout || [],
        interests: data.interests || [],
        yourInterest: data.yourInterest,
        plannedInvestment: data.plannedInvestment,
        reviewedAt: data.reviewedAt?.toDate?.() || data.reviewedAt,
        reviewedBy: data.reviewedBy
      };
    });
    
    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Error fetching whitelist applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}
