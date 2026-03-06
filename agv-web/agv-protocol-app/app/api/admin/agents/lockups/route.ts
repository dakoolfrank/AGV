import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { FieldValue } from 'firebase-admin/firestore';
import { PregvtLockup } from '@/lib/agent-types';

/**
 * preGVT Lockup API
 * 
 * GET /api/admin/agents/lockups
 * - List all lockups
 * - Optional filter: agentId, wallet
 * 
 * POST /api/admin/agents/lockups/initialize
 * - Initialize lockups for all agents (requires TGE date)
 * Body: { tgeDate: string (ISO date) }
 * 
 * GET /api/admin/agents/lockups/[agentId]
 * - Get lockup status for specific agent
 */

// Calculate release percentage based on performance
function calculateReleasePercentage(targetAchievementPct: number): number {
  if (targetAchievementPct >= 2.0) {
    return 1.00; // 200%+ target → 100% release
  } else if (targetAchievementPct >= 1.0) {
    return 0.70; // 100% target → 70% release
  } else if (targetAchievementPct >= 0.5) {
    return 0.40; // 50% target → 40% release
  }
  return 0; // Below 50% → 0% release
}

// Calculate linear release amount
function calculateLinearRelease(
  totalAllocated: number,
  releasePct: number,
  releaseStartDate: Date,
  releaseEndDate: Date,
  now: Date = new Date()
): number {
  if (now < releaseStartDate) {
    return 0; // Release hasn't started
  }
  
  if (now >= releaseEndDate) {
    return totalAllocated * releasePct; // Fully released
  }

  // Linear release over 3 months
  const totalReleaseAmount = totalAllocated * releasePct;
  const releaseDuration = releaseEndDate.getTime() - releaseStartDate.getTime();
  const elapsed = now.getTime() - releaseStartDate.getTime();
  
  return (totalReleaseAmount * elapsed) / releaseDuration;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const wallet = searchParams.get('wallet');

    let query = adminDb.collection('pregvt_lockups') as any;
    
    if (agentId) {
      query = query.where('agentId', '==', agentId);
    } else if (wallet) {
      query = query.where('wallet', '==', wallet.toLowerCase());
    }

    const lockupsSnapshot = await query.get();

    const lockups = await Promise.all(
      lockupsSnapshot.docs.map(async (doc) => {
        const lockup = {
          id: doc.id,
          ...doc.data(),
        } as PregvtLockup;

        // Get sales target
        const targetQuery = await adminDb.collection('agent_sales_targets')
          .where('agentId', '==', lockup.agentId)
          .limit(1)
          .get();

        let salesTarget = lockup.salesTarget;
        let actualSales = lockup.actualSales;
        let targetAchievementPct = lockup.targetAchievementPct;

        if (!targetQuery.empty) {
          const targetData = targetQuery.docs[0].data();
          salesTarget = targetData.salesTarget || 0;
          actualSales = targetData.actualSales || 0;
          targetAchievementPct = salesTarget > 0 ? actualSales / salesTarget : 0;
        }

        // Calculate release percentage based on performance
        const calculatedReleasePct = calculateReleasePercentage(targetAchievementPct);

        // Calculate current release amount
        let releasedAmount = 0;
        if (lockup.releaseStartDate && lockup.releaseEndDate) {
          const releaseStart = new Date(lockup.releaseStartDate);
          const releaseEnd = new Date(lockup.releaseEndDate);
          releasedAmount = calculateLinearRelease(
            lockup.totalAllocated,
            calculatedReleasePct,
            releaseStart,
            releaseEnd
          );
        }

        const lockedAmount = lockup.totalAllocated - releasedAmount;

        // Update if values changed
        const needsUpdate = 
          Math.abs(actualSales - lockup.actualSales) > 0.01 ||
          Math.abs(calculatedReleasePct - lockup.calculatedReleasePct) > 0.01 ||
          Math.abs(releasedAmount - lockup.releasedAmount) > 0.01;

        if (needsUpdate) {
          await doc.ref.update({
            actualSales,
            targetAchievementPct,
            calculatedReleasePct,
            releasedAmount,
            lockedAmount,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          ...lockup,
          actualSales,
          targetAchievementPct,
          calculatedReleasePct,
          releasedAmount,
          lockedAmount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      lockups,
      count: lockups.length,
    });
  } catch (error: any) {
    console.error('Error fetching lockups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, tgeDate } = body;

    if (action === 'initialize') {
      if (!tgeDate) {
        return NextResponse.json(
          { error: 'tgeDate is required for initialization' },
          { status: 400 }
        );
      }

      const tge = new Date(tgeDate);
      if (isNaN(tge.getTime())) {
        return NextResponse.json(
          { error: 'Invalid tgeDate format. Use ISO date string.' },
          { status: 400 }
        );
      }

      // Calculate lockup dates
      const lockupStartDate = new Date(tge);
      lockupStartDate.setMonth(lockupStartDate.getMonth() + 6); // TGE + 6 months

      const releaseStartDate = new Date(lockupStartDate);
      const releaseEndDate = new Date(releaseStartDate);
      releaseEndDate.setMonth(releaseEndDate.getMonth() + 3); // 3 months linear release

      // Get all agent allocations
      const allocationsSnapshot = await adminDb.collection('agent_allocations').get();

      const results = [];

      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        
        // Check if lockup already exists
        const existingLockup = await adminDb.collection('pregvt_lockups')
          .where('agentId', '==', allocation.kolId)
          .limit(1)
          .get();

        if (!existingLockup.empty) {
          results.push({
            agentId: allocation.kolId,
            wallet: allocation.wallet,
            status: 'skipped',
            message: 'Lockup already exists',
          });
          continue;
        }

        // Get sales target
        let salesTarget = 0;
        const targetQuery = await adminDb.collection('agent_sales_targets')
          .where('agentId', '==', allocation.kolId)
          .limit(1)
          .get();

        if (!targetQuery.empty) {
          salesTarget = targetQuery.docs[0].data().salesTarget || 0;
        }

        // Create lockup
        const lockupRef = adminDb.collection('pregvt_lockups').doc();
        const lockup: PregvtLockup = {
          id: lockupRef.id,
          agentId: allocation.kolId || '',
          wallet: allocation.wallet,
          totalAllocated: allocation.preGVTAllocated || 0,
          lockedAmount: allocation.preGVTAllocated || 0,
          releasedAmount: 0,
          lockupStartDate: lockupStartDate.toISOString(),
          releaseStartDate: releaseStartDate.toISOString(),
          releaseEndDate: releaseEndDate.toISOString(),
          salesTarget,
          actualSales: 0,
          targetAchievementPct: 0,
          releaseSchedule: {
            target50: { releasePct: 0.40 },
            target100: { releasePct: 0.70 },
            target200: { releasePct: 1.00 },
          },
          calculatedReleasePct: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await lockupRef.set(lockup);

        results.push({
          agentId: allocation.kolId,
          wallet: allocation.wallet,
          status: 'created',
          lockupId: lockupRef.id,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Initialized ${results.length} lockups`,
        results,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error initializing lockups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

