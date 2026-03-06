import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const MAX_SUBMISSIONS = 1000;

export async function GET(request: NextRequest) {
  try {
    const submissionsSnapshot = await adminDb
      .collection('campaign_submissions')
      .get();

    const currentCount = submissionsSnapshot.size;
    const isLimitReached = currentCount >= MAX_SUBMISSIONS;

    return NextResponse.json({
      success: true,
      data: {
        currentCount,
        maxCount: MAX_SUBMISSIONS,
        isLimitReached,
      },
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

