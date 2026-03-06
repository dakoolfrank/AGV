import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isAddressWhitelisted } from '@/lib/whitelist-utils';

const MAX_SUBMISSIONS = 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, xUsername, discordUsername } = body;

    // Validate required fields
    if (!walletAddress || !xUsername || !discordUsername) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    const normalizedAddress = walletAddress.toLowerCase().trim();
    if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check if wallet is already whitelisted (filter out)
    const isWhitelisted = await isAddressWhitelisted(normalizedAddress);
    if (isWhitelisted) {
      return NextResponse.json(
        { success: false, error: 'This wallet is already whitelisted and cannot submit' },
        { status: 400 }
      );
    }

    // Check for duplicate submission (same wallet address)
    const existingSubmission = await adminDb
      .collection('campaign_submissions')
      .where('walletAddress', '==', normalizedAddress)
      .limit(1)
      .get();

    if (!existingSubmission.empty) {
      return NextResponse.json(
        { success: false, error: 'This wallet has already submitted an entry' },
        { status: 400 }
      );
    }

    // Check submission count (max 1000)
    const allSubmissions = await adminDb
      .collection('campaign_submissions')
      .get();

    if (allSubmissions.size >= MAX_SUBMISSIONS) {
      return NextResponse.json(
        { success: false, error: 'Submission limit reached. No more submissions are being accepted.' },
        { status: 400 }
      );
    }

    // Create submission with timestamp
    const timestamp = new Date().toISOString();
    const submissionData = {
      walletAddress: normalizedAddress,
      xUsername: xUsername.trim(),
      discordUsername: discordUsername.trim(),
      timestamp,
      createdAt: new Date(),
    };

    await adminDb.collection('campaign_submissions').add(submissionData);

    return NextResponse.json({
      success: true,
      message: 'Submission successful',
      data: {
        walletAddress: normalizedAddress,
        submissionCount: allSubmissions.size + 1,
      },
    });
  } catch (error) {
    console.error('Error submitting campaign entry:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

