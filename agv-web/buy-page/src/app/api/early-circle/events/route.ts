import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { isWalletEarlyCircle, isEarlyCircleActive, type EarlyCircleEvent } from '@/lib/early-circle-server-utils';

/**
 * Track Early Circle events
 * Events: wallet_connected, claim_started, claim_success, claim_failed, 
 *         buy_started, buy_success, buy_failed, referral_attribution, referral_validated
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, walletAddress, source, metadata } = body;

    if (!eventType || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'eventType and walletAddress are required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if Early Circle is active
    const isActive = await isEarlyCircleActive();
    
    // Check if wallet is in Early Circle
    const isEarlyCircle = await isWalletEarlyCircle(normalizedAddress);

    // Only track if Early Circle is active and wallet is in Early Circle
    // OR if it's a wallet_connected event (we want to track all connections)
    if (eventType === 'wallet_connected' || (isActive && isEarlyCircle)) {
      const eventData: EarlyCircleEvent = {
        eventType,
        walletAddress: normalizedAddress,
        timestamp: Timestamp.now(),
        isEarlyCircle,
        source: source || 'web',
        metadata: metadata || {},
      };

      await adminDb.collection('early_circle_events').add(eventData);

      return NextResponse.json({
        success: true,
        message: 'Event tracked successfully',
      });
    }

    // If Early Circle is not active or wallet is not in Early Circle, still return success
    // but don't track the event
    return NextResponse.json({
      success: true,
      message: 'Event not tracked (Early Circle inactive or wallet not in Early Circle)',
      tracked: false,
    });
  } catch (error) {
    console.error('Error tracking Early Circle event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

