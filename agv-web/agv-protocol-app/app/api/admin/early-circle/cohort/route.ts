import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { getEarlyCircleConfig, isWithinEarlyCircleWindow, calculateVolumeTier } from '@/lib/early-circle-utils';

/**
 * Get Early Circle cohort view data
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const statusFilter = searchParams.get('status') || 'all'; // 'all', 'completed', 'in_progress', 'not_started'
    const volumeTierFilter = searchParams.get('volumeTier') || 'all'; // 'all', 'NONE', 'TIER_150', 'TIER_300'

    const config = await getEarlyCircleConfig();
    if (!config) {
      return NextResponse.json({
        success: true,
        cohort: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get all Early Circle wallets
    const walletsSnapshot = await adminDb.collection('wallets')
      .where('earlyCircle.isEarlyCircle', '==', true)
      .get();

    const cohortData = await Promise.all(
      walletsSnapshot.docs.map(async (doc) => {
        const walletData = doc.data();
        const address = walletData.address;

        // Get claim status
        const claimEvents = await adminDb.collection('early_circle_events')
          .where('walletAddress', '==', address)
          .where('eventType', 'in', ['claim_success', 'claim_failed'])
          .orderBy('timestamp', 'asc')
          .get();

        const claimSuccess = claimEvents.docs.find(e => e.data().eventType === 'claim_success');
        const claimStatus = claimSuccess ? 'success' : (claimEvents.docs.find(e => e.data().eventType === 'claim_failed') ? 'failed' : 'none');

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

        const firstBuyStatus = buyEventsInWindow.length > 0 ? 'completed' : 'none';
        
        // Calculate total volume
        let totalBuyVolumeEc = 0;
        buyEventsInWindow.forEach((event) => {
          const metadata = event.data().metadata || {};
          const amount = metadata.amountNormalised || 0;
          totalBuyVolumeEc += amount;
        });

        const volumeTier = calculateVolumeTier(totalBuyVolumeEc);

        // Get valid referrals
        const validatedReferrals = await adminDb.collection('early_circle_events')
          .where('walletAddress', '==', address)
          .where('eventType', '==', 'referral_validated')
          .get();

        const validReferralCountEc = validatedReferrals.size;

        // Calculate full cycle completion
        const fullCycleCompleted = 
          claimStatus === 'success' &&
          firstBuyStatus === 'completed' &&
          totalBuyVolumeEc >= 20 && // Minimum volume
          validReferralCountEc >= 1;

        // Determine overall status
        let overallStatus = 'not_started';
        if (fullCycleCompleted) {
          overallStatus = 'completed';
        } else if (claimStatus !== 'none' || firstBuyStatus !== 'none' || validReferralCountEc > 0) {
          overallStatus = 'in_progress';
        }

        return {
          wallet_address: address,
          claim_status: claimStatus,
          first_buy_status: firstBuyStatus,
          total_buy_volume_ec: totalBuyVolumeEc,
          valid_referral_count_ec: validReferralCountEc,
          full_cycle_completed: fullCycleCompleted,
          volume_tier: volumeTier,
          overall_status: overallStatus,
          is_suspicious: walletData.earlyCircle?.isSuspicious || false,
        };
      })
    );

    // Apply filters
    let filteredData = cohortData;

    if (statusFilter !== 'all') {
      filteredData = filteredData.filter(d => d.overall_status === statusFilter);
    }

    if (volumeTierFilter !== 'all') {
      filteredData = filteredData.filter(d => d.volume_tier === volumeTierFilter);
    }

    // Apply pagination
    const total = filteredData.length;
    const offset = (page - 1) * limit;
    const paginatedData = filteredData.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      cohort: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching Early Circle cohort:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

