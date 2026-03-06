import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { FieldValue } from 'firebase-admin/firestore';
import { AgentSalesTarget } from '@/lib/agent-types';

/**
 * Sales Targets API
 * 
 * GET /api/admin/agents/sales-targets
 * - List all sales targets
 * - Optional filter: agentId, wallet
 * 
 * POST /api/admin/agents/sales-targets
 * - Set or update sales target for an agent
 * Body: { wallet: string, salesTarget: number }
 */

// Calculate actual sales from purchase events
async function calculateActualSales(wallet: string): Promise<number> {
  try {
    // First, find the agent's KOL ID by wallet
    const kolQuery = await adminDb.collection('kol_profiles')
      .where('wallet', '==', wallet.toLowerCase())
      .where('agentType', 'in', ['master_agent', 'sub_agent'])
      .limit(1)
      .get();

    if (kolQuery.empty) {
      return 0;
    }

    const kolDoc = kolQuery.docs[0];
    const kolId = kolDoc.id; // This is the KOL ID (e.g., "AGV-KOL879744")

    // Get all purchase events where this agent's KOL ID is the referrer
    const purchaseEvents = await adminDb.collection('purchase_events')
      .where('kolId', '==', kolId)
      .get();

    let totalSales = 0;
    purchaseEvents.docs.forEach((doc) => {
      const data = doc.data();
      const purchaseAmount = data.purchaseAmount || 0;
      totalSales += typeof purchaseAmount === 'number' ? purchaseAmount : parseFloat(purchaseAmount) || 0;
    });

    return totalSales;
  } catch (error) {
    console.error('Error calculating actual sales:', error);
    return 0;
  }
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

    if (agentId) {
      // Get specific agent's sales target
      const targetQuery = await adminDb.collection('agent_sales_targets')
        .where('agentId', '==', agentId)
        .limit(1)
        .get();

      if (targetQuery.empty) {
        return NextResponse.json({
          success: true,
          target: null,
        });
      }

      const targetDoc = targetQuery.docs[0];
      const targetData = targetDoc.data();
      const target = {
        id: targetDoc.id,
        ...targetData,
        setAt: targetData.setAt?.toDate?.()?.toISOString() || targetData.setAt || null,
        updatedAt: targetData.updatedAt?.toDate?.()?.toISOString() || targetData.updatedAt || null,
      } as AgentSalesTarget;

      // Recalculate actual sales
      const actualSales = await calculateActualSales(target.wallet);
      const targetAchievementPct = target.salesTarget > 0 
        ? actualSales / target.salesTarget 
        : 0;

      // Update if changed
      if (Math.abs(actualSales - target.actualSales) > 0.01) {
        await targetDoc.ref.update({
          actualSales,
          targetAchievementPct,
          updatedAt: FieldValue.serverTimestamp(),
        });
        target.actualSales = actualSales;
        target.targetAchievementPct = targetAchievementPct;
      }

      return NextResponse.json({
        success: true,
        target,
      });
    }

    // Get all sales targets
    let query = adminDb.collection('agent_sales_targets') as any;
    
    if (wallet) {
      query = query.where('wallet', '==', wallet.toLowerCase());
    }

    // Fetch without orderBy to avoid composite index requirement
    const targetsSnapshot = await query.get();

    const targets = await Promise.all(
      targetsSnapshot.docs.map(async (doc) => {
        const targetData = doc.data();
        const target = {
          id: doc.id,
          ...targetData,
          setAt: targetData.setAt?.toDate?.()?.toISOString() || targetData.setAt || null,
          updatedAt: targetData.updatedAt?.toDate?.()?.toISOString() || targetData.updatedAt || null,
        } as AgentSalesTarget;

        // Recalculate actual sales
        const actualSales = await calculateActualSales(target.wallet);
        const targetAchievementPct = target.salesTarget > 0 
          ? actualSales / target.salesTarget 
          : 0;

        // Update if changed
        if (Math.abs(actualSales - target.actualSales) > 0.01) {
          await doc.ref.update({
            actualSales,
            targetAchievementPct,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        return {
          ...target,
          actualSales,
          targetAchievementPct,
        };
      })
    );

    // Sort in memory by setAt (descending)
    targets.sort((a, b) => {
      const aDate = a.setAt ? new Date(a.setAt).getTime() : 0;
      const bDate = b.setAt ? new Date(b.setAt).getTime() : 0;
      return bDate - aDate;
    });

    return NextResponse.json({
      success: true,
      targets,
      count: targets.length,
    });
  } catch (error: any) {
    console.error('Error fetching sales targets:', error);
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
    const { wallet, salesTarget } = body;

    if (!wallet || salesTarget === undefined) {
      return NextResponse.json(
        { error: 'wallet and salesTarget are required' },
        { status: 400 }
      );
    }

    const salesTargetNum = parseFloat(salesTarget);
    if (isNaN(salesTargetNum) || salesTargetNum < 0) {
      return NextResponse.json(
        { error: 'salesTarget must be a positive number' },
        { status: 400 }
      );
    }

    const walletLower = wallet.toLowerCase();

    // Find agent by wallet to get KOL ID
    const kolQuery = await adminDb.collection('kol_profiles')
      .where('wallet', '==', walletLower)
      .where('agentType', 'in', ['master_agent', 'sub_agent'])
      .limit(1)
      .get();

    if (kolQuery.empty) {
      return NextResponse.json(
        { error: 'No agent found with this wallet address' },
        { status: 404 }
      );
    }

    const kolDoc = kolQuery.docs[0];
    const agentId = kolDoc.id;

    // Check if target already exists (by wallet or agentId)
    const existingQuery = await adminDb.collection('agent_sales_targets')
      .where('wallet', '==', walletLower)
      .limit(1)
      .get();

    const actualSales = await calculateActualSales(walletLower);
    const targetAchievementPct = salesTargetNum > 0 ? actualSales / salesTargetNum : 0;

    if (!existingQuery.empty) {
      // Update existing target
      const existingDoc = existingQuery.docs[0];
      await existingDoc.ref.update({
        agentId, // Update in case KOL ID changed
        salesTarget: salesTargetNum,
        actualSales,
        targetAchievementPct,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: 'Sales target updated',
        target: {
          id: existingDoc.id,
          agentId,
          wallet: walletLower,
          salesTarget: salesTargetNum,
          actualSales,
          targetAchievementPct,
        },
      });
    }

    // Create new target
    const targetRef = adminDb.collection('agent_sales_targets').doc();
    const target: AgentSalesTarget = {
      id: targetRef.id,
      agentId,
      wallet: walletLower,
      salesTarget: salesTargetNum,
      actualSales,
      targetAchievementPct,
      setBy: decoded.email || 'unknown',
      setAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await targetRef.set(target);

    return NextResponse.json({
      success: true,
      message: 'Sales target created',
      target,
    });
  } catch (error: any) {
    console.error('Error setting sales target:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

