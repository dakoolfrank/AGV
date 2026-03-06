import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../../_auth';
import { getEarlyCircleConfig, isWithinEarlyCircleWindow } from '@/lib/early-circle-utils';

/**
 * Get Early Circle-specific wallet detail view
 * Shows all claim attempts, buy transactions, referral info, and error codes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address } = await params;
    const normalizedAddress = address.toLowerCase();

    // Get wallet document
    const walletDoc = await adminDb.collection('wallets').doc(normalizedAddress).get();
    if (!walletDoc.exists) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const walletData = walletDoc.data();
    const isEarlyCircle = walletData?.earlyCircle?.isEarlyCircle === true;

    if (!isEarlyCircle) {
      return NextResponse.json({
        success: true,
        wallet: {
          address: normalizedAddress,
          isEarlyCircle: false,
          message: 'This wallet is not in Early Circle',
        },
      });
    }

    const config = await getEarlyCircleConfig();

    // Get all claim events
    const claimEvents = await adminDb.collection('early_circle_events')
      .where('walletAddress', '==', normalizedAddress)
      .where('eventType', 'in', ['claim_started', 'claim_success', 'claim_failed'])
      .orderBy('timestamp', 'asc')
      .get();

    // Get all buy events
    const buyEvents = await adminDb.collection('early_circle_events')
      .where('walletAddress', '==', normalizedAddress)
      .where('eventType', 'in', ['buy_started', 'buy_success', 'buy_failed'])
      .orderBy('timestamp', 'asc')
      .get();

    // Filter buy events within Early Circle window
    const buyEventsInWindow = buyEvents.docs.filter(e => {
      const eventData = e.data();
      if (eventData.eventType === 'buy_success') {
        return isWithinEarlyCircleWindow(eventData.timestamp, config);
      }
      return true; // Include started/failed events
    });

    // Get referral attribution (where this wallet was referred)
    const referralAttribution = await adminDb.collection('early_circle_events')
      .where('eventType', '==', 'referral_attribution')
      .where('metadata.referredWallet', '==', normalizedAddress)
      .get();

    const referrerWallet = referralAttribution.empty
      ? null
      : referralAttribution.docs[0].data().walletAddress;

    // Get referrals where this wallet is the referrer
    const referralsAsReferrer = await adminDb.collection('early_circle_events')
      .where('eventType', '==', 'referral_validated')
      .where('walletAddress', '==', normalizedAddress)
      .get();

    const referredWallets = referralsAsReferrer.docs.map(doc => {
      const data = doc.data();
      return {
        referredWallet: data.metadata?.referredWallet || null,
        validatedAt: data.timestamp?.toDate?.()?.toISOString() || null,
        hasClaimed: data.metadata?.hasClaimed || false,
        hasFirstBuy: data.metadata?.hasFirstBuy || false,
        isValid: data.metadata?.isValidEarlyCircleReferral || false,
      };
    });

    // Process claim events
    const claimAttempts = claimEvents.docs.map(doc => {
      const data = doc.data();
      return {
        eventType: data.eventType,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
        txHash: data.metadata?.txHash || null,
        claimedAmount: data.metadata?.claimedAmount || null,
        reasonCode: data.metadata?.reasonCode || null,
        rawError: data.metadata?.rawError || null,
      };
    });

    // Process buy events
    const buyTransactions = buyEventsInWindow.map(doc => {
      const data = doc.data();
      return {
        eventType: data.eventType,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
        txHash: data.metadata?.txHash || null,
        assetPair: data.metadata?.assetPair || null,
        amountNormalised: data.metadata?.amountNormalised || null,
        intendedAmount: data.metadata?.intendedAmount || null,
        isFirstBuy: data.metadata?.isFirstBuy || false,
        reasonCode: data.metadata?.reasonCode || null,
        rawError: data.metadata?.rawError || null,
      };
    });

    // Calculate summary metrics
    const claimSuccess = claimAttempts.find(a => a.eventType === 'claim_success');
    const claimFailed = claimAttempts.find(a => a.eventType === 'claim_failed');
    const firstBuy = buyTransactions.find(t => t.eventType === 'buy_success' && t.isFirstBuy);
    const totalBuyVolume = buyTransactions
      .filter(t => t.eventType === 'buy_success')
      .reduce((sum, t) => sum + (t.amountNormalised || 0), 0);
    const buyCount = buyTransactions.filter(t => t.eventType === 'buy_success').length;
    const validReferralCount = referredWallets.filter(r => r.isValid).length;

    return NextResponse.json({
      success: true,
      wallet: {
        address: normalizedAddress,
        isEarlyCircle: true,
        isSuspicious: walletData?.earlyCircle?.isSuspicious || false,
        suspiciousReason: walletData?.earlyCircle?.suspiciousReason || null,
        flaggedAt: walletData?.earlyCircle?.flaggedAt?.toDate?.()?.toISOString() || null,
        flaggedBy: walletData?.earlyCircle?.flaggedBy || null,
        addedAt: walletData?.earlyCircle?.addedAt?.toDate?.()?.toISOString() || null,
        addedBy: walletData?.earlyCircle?.addedBy || null,
        firstConnectTime: walletData?.timestamps?.firstConnected?.toDate?.()?.toISOString() || null,
      },
      summary: {
        claimStatus: claimSuccess ? 'success' : (claimFailed ? 'failed' : 'none'),
        claimTime: claimSuccess?.timestamp || null,
        claimFailureReason: claimFailed?.reasonCode || null,
        firstBuyTime: firstBuy?.timestamp || null,
        firstBuyAmount: firstBuy?.amountNormalised || null,
        totalBuyVolume,
        buyCount,
        validReferralCount,
        referrerWallet,
      },
      claimAttempts,
      buyTransactions,
      referrals: {
        referrer: referrerWallet,
        referred: referredWallets,
      },
    });
  } catch (error) {
    console.error('Error fetching Early Circle wallet details:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
