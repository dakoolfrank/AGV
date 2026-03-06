import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      email,
      telegramUsername,
      country,
      hearAbout,
      interests,
      yourInterest,
      plannedInvestment,
      walletAddress,
      isKOL
    } = await request.json();

    // Validate required fields
    if (!name || !email || !telegramUsername || !country || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email already exists in whitelist applications
    const existingApplication = await adminDb.collection('whitelist_applications')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingApplication.empty) {
      return NextResponse.json(
        { error: 'Application already exists for this email' },
        { status: 409 }
      );
    }

    // Check if wallet address already exists
    const existingWallet = await adminDb.collection('whitelist_applications')
      .where('walletAddress', '==', walletAddress.toLowerCase())
      .limit(1)
      .get();

    if (!existingWallet.empty) {
      return NextResponse.json(
        { error: 'Application already exists for this wallet address' },
        { status: 409 }
      );
    }

    // Create whitelist application
    const applicationData = {
      name,
      email: email.toLowerCase(),
      telegramUsername,
      country,
      walletAddress: walletAddress.toLowerCase(),
      isKOL,
      status: 'pending',
      submittedAt: new Date(),
      ...(isKOL ? {} : {
        hearAbout,
        interests,
        yourInterest,
        plannedInvestment
      })
    };

    const docRef = await adminDb.collection('whitelist_applications').add(applicationData);

    return NextResponse.json({
      success: true,
      applicationId: docRef.id,
      message: 'Application submitted successfully'
    });

  } catch (error) {
    console.error('Error creating whitelist application:', error);
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}
