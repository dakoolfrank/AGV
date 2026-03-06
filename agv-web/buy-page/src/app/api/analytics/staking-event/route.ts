import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, positionId, txHash } = body;

    if (!walletAddress || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'walletAddress and amount are required' },
        { status: 400 }
      );
    }

    // Create staking event
    const timestamp = new Date().toISOString();
    const eventData = {
      walletAddress: walletAddress.toLowerCase(),
      amount: parseFloat(amount) || 0,
      positionId: positionId || null,
      txHash: txHash || null,
      timestamp,
      createdAt: new Date(),
    };

    await adminDb.collection('staking_events').add(eventData);

    return NextResponse.json({
      success: true,
      message: 'Staking event recorded successfully',
    });
  } catch (error) {
    console.error('Error recording staking event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

