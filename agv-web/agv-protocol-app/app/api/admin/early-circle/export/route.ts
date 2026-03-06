import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { Timestamp } from 'firebase-admin/firestore';
import { getEarlyCircleConfig, isWithinEarlyCircleWindow, calculateVolumeTier } from '@/lib/early-circle-utils';

/**
 * Export Early Circle data with all required metrics
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const includeSuspicious = searchParams.get('includeSuspicious') === 'true';

    const config = await getEarlyCircleConfig();
    if (!config || !config.isActive) {
      return NextResponse.json(
        { success: false, error: 'Early Circle is not active' },
        { status: 400 }
      );
    }

    // Get all Early Circle wallets
    const walletsSnapshot = await adminDb.collection('wallets')
      .where('earlyCircle.isEarlyCircle', '==', true)
      .get();

    const exportData = await Promise.all(
      walletsSnapshot.docs.map(async (doc) => {
        const walletData = doc.data();
        const address = walletData.address;

        // Skip suspicious wallets if not including them
        if (!includeSuspicious && walletData.earlyCircle?.isSuspicious) {
          return null;
        }

        // Get claim events
        const claimEvents = await adminDb.collection('early_circle_events')
          .where('walletAddress', '==', address)
          .where('eventType', 'in', ['claim_success', 'claim_failed'])
          .orderBy('timestamp', 'asc')
          .get();

        const claimSuccess = claimEvents.docs.find(e => e.data().eventType === 'claim_success');
        const claimFailed = claimEvents.docs.find(e => e.data().eventType === 'claim_failed');

        // Get buy events within Early Circle window
        const buyEvents = await adminDb.collection('early_circle_events')
          .where('walletAddress', '==', address)
          .where('eventType', 'in', ['buy_success', 'buy_failed'])
          .orderBy('timestamp', 'asc')
          .get();

        const buySuccessEvents = buyEvents.docs
          .filter(e => {
            const eventData = e.data();
            return eventData.eventType === 'buy_success' && 
                   isWithinEarlyCircleWindow(eventData.timestamp, config);
          });

        // Calculate buy metrics
        let totalBuyVolumeEc = 0;
        let buyCountEc = 0;
        let firstBuyTime: string | null = null;
        let firstBuyAmountNormalised: number | null = null;

        if (buySuccessEvents.length > 0) {
          buyCountEc = buySuccessEvents.length;
          buySuccessEvents.forEach((event) => {
            const metadata = event.data().metadata || {};
            const amount = metadata.amountNormalised || 0;
            totalBuyVolumeEc += amount;
            
            if (metadata.isFirstBuy && !firstBuyTime) {
              firstBuyTime = event.data().timestamp?.toDate?.()?.toISOString() || null;
              firstBuyAmountNormalised = amount;
            }
          });

          // If no firstBuy flag, use first event
          if (!firstBuyTime && buySuccessEvents[0]) {
            firstBuyTime = buySuccessEvents[0].data().timestamp?.toDate?.()?.toISOString() || null;
            firstBuyAmountNormalised = buySuccessEvents[0].data().metadata?.amountNormalised || null;
          }
        }

        const volumeTier = calculateVolumeTier(totalBuyVolumeEc);

        // Get referral info
        const referralAttribution = await adminDb.collection('early_circle_events')
          .where('eventType', '==', 'referral_attribution')
          .where('metadata.referredWallet', '==', address)
          .limit(1)
          .get();

        const referrerWallet = referralAttribution.empty 
          ? null 
          : referralAttribution.docs[0].data().walletAddress;

        // Get validated referrals (where this wallet is the referrer)
        const validatedReferrals = await adminDb.collection('early_circle_events')
          .where('eventType', '==', 'referral_validated')
          .where('walletAddress', '==', address)
          .get();

        const validReferralCountEc = validatedReferrals.size;
        const firstValidReferralTime = validatedReferrals.docs[0]?.data().timestamp?.toDate?.()?.toISOString() || null;

        // Determine claim status
        let claimStatus: 'none' | 'success' | 'failed' = 'none';
        let claimTime: string | null = null;
        let claimFailureReasonCode: string | null = null;

        if (claimSuccess) {
          claimStatus = 'success';
          claimTime = claimSuccess.data().timestamp?.toDate?.()?.toISOString() || null;
        } else if (claimFailed) {
          claimStatus = 'failed';
          claimFailureReasonCode = claimFailed.data().metadata?.reasonCode || null;
        }

        // Get first connect time
        const firstConnectTime = walletData.timestamps?.firstConnected?.toDate?.()?.toISOString() || null;

        // Calculate full cycle completion
        const fullCycleCompleted = 
          claimStatus === 'success' &&
          firstBuyTime !== null &&
          firstBuyAmountNormalised !== null &&
          firstBuyAmountNormalised >= 20 && // Minimum volume requirement
          validReferralCountEc >= 1;

        return {
          wallet_address: address,
          is_early_circle: true,
          referrer_wallet: referrerWallet,
          first_connect_time: firstConnectTime,
          claim_status: claimStatus,
          claim_time: claimTime,
          claim_failure_reason_code: claimFailureReasonCode,
          first_buy_time: firstBuyTime,
          first_buy_amount_normalised: firstBuyAmountNormalised,
          total_buy_volume_ec: totalBuyVolumeEc,
          buy_count_ec: buyCountEc,
          volume_tier: volumeTier,
          valid_referral_count_ec: validReferralCountEc,
          first_valid_referral_time: firstValidReferralTime,
          full_cycle_completed: fullCycleCompleted,
          is_suspicious: walletData.earlyCircle?.isSuspicious || false,
        };
      })
    );

    // Filter out null entries (suspicious wallets)
    const filteredData = exportData.filter(d => d !== null);

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'wallet_address',
        'is_early_circle',
        'referrer_wallet',
        'first_connect_time',
        'claim_status',
        'claim_time',
        'claim_failure_reason_code',
        'first_buy_time',
        'first_buy_amount_normalised',
        'total_buy_volume_ec',
        'buy_count_ec',
        'volume_tier',
        'valid_referral_count_ec',
        'first_valid_referral_time',
        'full_cycle_completed',
        'is_suspicious',
      ];

      const csvRows = [
        headers.join(','),
        ...filteredData.map(row => [
          row.wallet_address,
          row.is_early_circle,
          row.referrer_wallet || '',
          row.first_connect_time || '',
          row.claim_status,
          row.claim_time || '',
          row.claim_failure_reason_code || '',
          row.first_buy_time || '',
          row.first_buy_amount_normalised || '',
          row.total_buy_volume_ec,
          row.buy_count_ec,
          row.volume_tier,
          row.valid_referral_count_ec,
          row.first_valid_referral_time || '',
          row.full_cycle_completed,
          row.is_suspicious,
        ].join(','))
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="early-circle-export.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      total: filteredData.length,
    });
  } catch (error) {
    console.error('Error exporting Early Circle data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

