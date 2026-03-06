import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { getEarlyCircleConfig, isWithinEarlyCircleWindow } from '@/lib/early-circle-utils';

/**
 * Get Early Circle metrics summary
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getEarlyCircleConfig();
    if (!config) {
      return NextResponse.json({
        success: true,
        stats: {
          totalEarlyCircleWallets: 0,
          walletsThatClaimed: 0,
          walletsWithFirstBuy: 0,
          walletsWithValidReferrals: 0,
          walletsCompletedFullCycle: 0,
          totalEarlyCircleBuyVolume: 0,
          isActive: false,
        },
      });
    }

    // Get all Early Circle wallets
    const walletsSnapshot = await adminDb.collection('wallets')
      .where('earlyCircle.isEarlyCircle', '==', true)
      .get();

    const totalEarlyCircleWallets = walletsSnapshot.size;
    let walletsThatClaimed = 0;
    let walletsWithFirstBuy = 0;
    let walletsWithValidReferrals = 0;
    let walletsCompletedFullCycle = 0;
    let totalEarlyCircleBuyVolume = 0;

    // Process each wallet to calculate metrics
    for (const doc of walletsSnapshot.docs) {
      const walletData = doc.data();
      const address = walletData.address;

      // Check if claimed
      if (walletData.status?.hasClaimed) {
        walletsThatClaimed++;
      }

      // Get buy events within Early Circle window
      const buySuccessEvents = await adminDb.collection('early_circle_events')
        .where('walletAddress', '==', address)
        .where('eventType', '==', 'buy_success')
        .orderBy('timestamp', 'asc')
        .get();

      const buyEventsInWindow = buySuccessEvents.docs.filter(e => {
        const eventData = e.data();
        return isWithinEarlyCircleWindow(eventData.timestamp, config);
      });

      if (buyEventsInWindow.length > 0) {
        walletsWithFirstBuy++;
        
        // Calculate total volume
        buyEventsInWindow.forEach((event) => {
          const metadata = event.data().metadata || {};
          const amount = metadata.amountNormalised || 0;
          totalEarlyCircleBuyVolume += amount;
        });
      }

      // Check valid referrals
      const validatedReferrals = await adminDb.collection('early_circle_events')
        .where('walletAddress', '==', address)
        .where('eventType', '==', 'referral_validated')
        .get();

      if (validatedReferrals.size > 0) {
        walletsWithValidReferrals++;
      }

      // Check full cycle completion
      const hasClaimed = walletData.status?.hasClaimed === true;
      const hasFirstBuy = buyEventsInWindow.length > 0;
      const hasValidReferral = validatedReferrals.size > 0;
      
      // Check if first buy meets minimum volume
      let firstBuyMeetsMinimum = false;
      if (buyEventsInWindow.length > 0) {
        const firstBuy = buyEventsInWindow[0].data();
        const firstBuyAmount = firstBuy.metadata?.amountNormalised || 0;
        firstBuyMeetsMinimum = firstBuyAmount >= 20; // Minimum volume requirement
      }

      if (hasClaimed && hasFirstBuy && firstBuyMeetsMinimum && hasValidReferral) {
        walletsCompletedFullCycle++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalEarlyCircleWallets,
        walletsThatClaimed,
        walletsWithFirstBuy,
        walletsWithValidReferrals,
        walletsCompletedFullCycle,
        totalEarlyCircleBuyVolume,
        isActive: config.isActive,
        startTimestamp: config.startTimestamp?.toDate?.()?.toISOString() || null,
        endTimestamp: config.endTimestamp?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching Early Circle stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

