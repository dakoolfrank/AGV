import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { AgentAllocation } from '@/lib/agent-types';

/**
 * Agent Allocations API
 * 
 * GET /api/admin/agents/allocations
 * - List all agent allocations
 * - Optional filters: agentLevel, wallet
 * 
 * GET /api/admin/agents/allocations/[wallet]
 * - Get specific agent allocation by wallet
 */

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const agentLevel = searchParams.get('agentLevel'); // '1' or '2'

    // Get specific wallet allocation
    if (wallet) {
      const walletLower = wallet.toLowerCase();
      const allocationQuery = await adminDb.collection('agent_allocations')
        .where('wallet', '==', walletLower)
        .limit(1)
        .get();

      if (allocationQuery.empty) {
        return NextResponse.json({
          success: true,
          allocation: null,
        });
      }

      const allocationDoc = allocationQuery.docs[0];
      const allocationData = allocationDoc.data();
      const allocation = {
        id: allocationDoc.id,
        ...allocationData,
        allocatedAt: allocationData.allocatedAt?.toDate?.()?.toISOString() || allocationData.allocatedAt || null,
        createdAt: allocationData.createdAt?.toDate?.()?.toISOString() || allocationData.createdAt || null,
        updatedAt: allocationData.updatedAt?.toDate?.()?.toISOString() || allocationData.updatedAt || null,
      } as AgentAllocation;

      // Get KOL profile info
      let kolProfile = null;
      if (allocation.kolId) {
        const kolDoc = await adminDb.collection('kol_profiles').doc(allocation.kolId).get();
        if (kolDoc.exists) {
          const kolData = kolDoc.data();
          kolProfile = {
            id: kolDoc.id,
            displayName: kolData?.displayName,
            refCode: kolData?.refCode,
            email: kolData?.email,
          };
        }
      }

      return NextResponse.json({
        success: true,
        allocation,
        kolProfile,
      });
    }

    // Get all allocations with optional filter
    let query = adminDb.collection('agent_allocations') as any;
    
    if (agentLevel) {
      query = query.where('agentLevel', '==', parseInt(agentLevel));
    }

    // Fetch without orderBy to avoid composite index requirement
    const allocationsSnapshot = await query.get();

    const allocations = await Promise.all(
      allocationsSnapshot.docs.map(async (doc) => {
        const allocationData = doc.data();
        const allocation = {
          id: doc.id,
          ...allocationData,
          allocatedAt: allocationData.allocatedAt?.toDate?.()?.toISOString() || allocationData.allocatedAt || null,
          createdAt: allocationData.createdAt?.toDate?.()?.toISOString() || allocationData.createdAt || null,
          updatedAt: allocationData.updatedAt?.toDate?.()?.toISOString() || allocationData.updatedAt || null,
        } as AgentAllocation;

        // Get KOL profile info
        let kolProfile = null;
        if (allocation.kolId) {
          const kolDoc = await adminDb.collection('kol_profiles').doc(allocation.kolId).get();
          if (kolDoc.exists) {
            const kolData = kolDoc.data();
            kolProfile = {
              id: kolDoc.id,
              displayName: kolData?.displayName,
              refCode: kolData?.refCode,
              email: kolData?.email,
            };
          }
        }

        return {
          allocation,
          kolProfile,
        };
      })
    );

    // Sort in memory by allocatedAt (descending)
    allocations.sort((a, b) => {
      const aDate = a.allocation.allocatedAt ? new Date(a.allocation.allocatedAt).getTime() : 0;
      const bDate = b.allocation.allocatedAt ? new Date(b.allocation.allocatedAt).getTime() : 0;
      return bDate - aDate;
    });

    // Calculate totals
    const totals = allocations.reduce(
      (acc, item) => {
        acc.totalPreGVT += item.allocation.preGVTAllocated;
        acc.totalSGVT += item.allocation.sGVTAllocated;
        acc.masterCount += item.allocation.agentLevel === 1 ? 1 : 0;
        acc.subAgentCount += item.allocation.agentLevel === 2 ? 1 : 0;
        return acc;
      },
      {
        totalPreGVT: 0,
        totalSGVT: 0,
        masterCount: 0,
        subAgentCount: 0,
      }
    );

    return NextResponse.json({
      success: true,
      allocations,
      totals,
      count: allocations.length,
    });
  } catch (error: any) {
    console.error('Error fetching agent allocations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

