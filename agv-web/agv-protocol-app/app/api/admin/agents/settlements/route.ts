import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { FieldValue } from 'firebase-admin/firestore';
import { WeeklySettlement } from '@/lib/agent-types';

/**
 * Weekly Settlements API
 * 
 * POST /api/admin/agents/settlements/generate
 * - Generate weekly settlement batch for a period
 * Body: { period: string (optional, defaults to current week) }
 * 
 * GET /api/admin/agents/settlements
 * - List all settlements
 * - Optional filters: period, status, agentId
 * 
 * GET /api/admin/agents/settlements/[id]
 * - Get specific settlement
 * 
 * POST /api/admin/agents/settlements/[id]/verify
 * - Mark settlement as verified by BD/OPS
 * 
 * POST /api/admin/agents/settlements/[id]/mark-paid
 * - Mark settlement as paid with txHash
 * Body: { txHash: string }
 */

// Get current period (week)
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Calculate commission for an agent in a period
async function calculateAgentCommission(agentId: string, period: string): Promise<number> {
  try {
    // Get all purchase events for this agent in this period
    const purchaseEvents = await adminDb.collection('purchase_events')
      .where('kolId', '==', agentId)
      .get();

    let totalCommission = 0;

    purchaseEvents.docs.forEach((doc) => {
      const data = doc.data();
      // Check if event is in the period
      const eventDate = data.timestamp?.toDate?.() || new Date(data.timestamp);
      const eventPeriod = getPeriodFromDate(eventDate);
      
      if (eventPeriod === period) {
        const commission = data.commission || 0;
        totalCommission += typeof commission === 'number' ? commission : parseFloat(commission) || 0;
      }
    });

    return totalCommission;
  } catch (error) {
    console.error('Error calculating agent commission:', error);
    return 0;
  }
}

function getPeriodFromDate(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { period, action } = body;

    if (action === 'generate') {
      const targetPeriod = period || getCurrentPeriod();

      // Check if settlement already exists for this period
      const existingSettlements = await adminDb.collection('weekly_settlements')
        .where('period', '==', targetPeriod)
        .get();

      if (!existingSettlements.empty) {
        return NextResponse.json({
          success: false,
          error: `Settlements already exist for period ${targetPeriod}`,
          existingCount: existingSettlements.size,
        }, { status: 400 });
      }

      // Get all agent allocations
      const allocationsSnapshot = await adminDb.collection('agent_allocations').get();

      const settlements = [];

      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        
        if (!allocation.kolId) {
          continue; // Skip if no KOL ID linked
        }

        const totalCommissionUSD = await calculateAgentCommission(
          allocation.kolId,
          targetPeriod
        );

        // USDT amount is same as USD (1:1)
        const usdtPayoutAmount = totalCommissionUSD;

        if (totalCommissionUSD > 0) {
          const settlementRef = adminDb.collection('weekly_settlements').doc();
          const settlement: WeeklySettlement = {
            id: settlementRef.id,
            period: targetPeriod,
            agentId: allocation.kolId,
            wallet: allocation.wallet,
            totalCommissionUSD,
            usdtPayoutAmount,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await settlementRef.set(settlement);
          settlements.push(settlement);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Generated ${settlements.length} settlements for period ${targetPeriod}`,
        period: targetPeriod,
        settlements,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use action: "generate"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error generating settlements:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const status = searchParams.get('status');
    const agentId = searchParams.get('agentId');

    let query = adminDb.collection('weekly_settlements') as any;

    if (period) {
      query = query.where('period', '==', period);
    }
    if (status) {
      query = query.where('status', '==', status);
    }
    if (agentId) {
      query = query.where('agentId', '==', agentId);
    }

    // Fetch all settlements (avoid composite index requirement)
    const settlementsSnapshot = await query.get();

    // Sort in memory: by period (desc), then by createdAt (desc)
    const settlements = (settlementsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
          paidAt: data.paidAt?.toDate?.()?.toISOString() || data.paidAt || null,
        };
      }) as WeeklySettlement[])
      .sort((a, b) => {
        // First sort by period (descending)
        if (a.period !== b.period) {
          return b.period.localeCompare(a.period);
        }
        // Then sort by createdAt (descending)
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

    // Calculate totals
    const totals = settlements.reduce(
      (acc, s) => {
        acc.totalUSD += s.totalCommissionUSD;
        acc.totalUSDT += s.usdtPayoutAmount;
        acc.pending += s.status === 'pending' ? s.usdtPayoutAmount : 0;
        acc.verified += s.status === 'verified' ? s.usdtPayoutAmount : 0;
        acc.paid += s.status === 'paid' ? s.usdtPayoutAmount : 0;
        return acc;
      },
      {
        totalUSD: 0,
        totalUSDT: 0,
        pending: 0,
        verified: 0,
        paid: 0,
      }
    );

    return NextResponse.json({
      success: true,
      settlements,
      totals,
      count: settlements.length,
    });
  } catch (error: any) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

