import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../../_auth';

/**
 * Update Agent Allocation API
 * 
 * PATCH /api/admin/agents/allocations/update
 * - Update allocation fields (wallet, preGVT, sGVT, agentLevel, masterWallet)
 * 
 * Body: {
 *   allocationId: string;
 *   updates: {
 *     wallet?: string;
 *     preGVTAllocated?: number;
 *     sGVTAllocated?: number;
 *     agentLevel?: 1 | 2;
 *     masterWallet?: string;
 *   }
 * }
 */

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { allocationId, updates } = body;

    if (!allocationId) {
      return NextResponse.json(
        { error: 'Allocation ID is required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    // Get the existing allocation
    const allocationDoc = await adminDb.collection('agent_allocations').doc(allocationId).get();
    
    if (!allocationDoc.exists) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    const existingData = allocationDoc.data();
    const allocationUpdates: any = {
      updatedAt: new Date().toISOString(),
    };

    // Handle wallet address change
    if (updates.wallet !== undefined) {
      const newWallet = updates.wallet.trim();
      if (!newWallet || !newWallet.startsWith('0x') || newWallet.length !== 42) {
        return NextResponse.json(
          { error: 'Invalid wallet address format. Must be a valid Ethereum address (0x...)' },
          { status: 400 }
        );
      }

      const newWalletLower = newWallet.toLowerCase();
      
      // Check if the new wallet is already used by another allocation
      const existingAllocationQuery = await adminDb.collection('agent_allocations')
        .where('wallet', '==', newWalletLower)
        .limit(1)
        .get();

      if (!existingAllocationQuery.empty) {
        const existingAllocId = existingAllocationQuery.docs[0].id;
        if (existingAllocId !== allocationId) {
          return NextResponse.json(
            { error: 'This wallet address is already assigned to another allocation' },
            { status: 400 }
          );
        }
      }

      allocationUpdates.wallet = newWalletLower;
    }

    // Update preGVT allocation
    if (updates.preGVTAllocated !== undefined) {
      const preGVT = parseFloat(updates.preGVTAllocated);
      if (isNaN(preGVT) || preGVT < 0) {
        return NextResponse.json(
          { error: 'preGVTAllocated must be a positive number' },
          { status: 400 }
        );
      }
      allocationUpdates.preGVTAllocated = preGVT;
    }

    // Update sGVT allocation
    if (updates.sGVTAllocated !== undefined) {
      const sGVT = parseFloat(updates.sGVTAllocated);
      if (isNaN(sGVT) || sGVT < 0) {
        return NextResponse.json(
          { error: 'sGVTAllocated must be a positive number' },
          { status: 400 }
        );
      }
      allocationUpdates.sGVTAllocated = sGVT;
    }

    // Handle agent level change
    if (updates.agentLevel !== undefined) {
      const newLevel = updates.agentLevel;
      if (newLevel !== 1 && newLevel !== 2) {
        return NextResponse.json(
          { error: 'agentLevel must be 1 or 2' },
          { status: 400 }
        );
      }
      allocationUpdates.agentLevel = newLevel;

      // If changing to Sub-Agent, need master agent
      if (newLevel === 2) {
        if (!updates.masterWallet) {
          return NextResponse.json(
            { error: 'Master wallet is required when setting agent level to 2 (Sub-Agent)' },
            { status: 400 }
          );
        }

        // Find master agent's KOL ID
        const masterWalletLower = updates.masterWallet.toLowerCase();
        const masterKolQuery = await adminDb.collection('kol_profiles')
          .where('wallet', '==', masterWalletLower)
          .where('agentLevel', '==', 1)
          .limit(1)
          .get();

        if (masterKolQuery.empty) {
          return NextResponse.json(
            { error: 'Master agent not found. Please ensure the master wallet belongs to a Level-1 agent.' },
            { status: 404 }
          );
        }

        const masterKolId = masterKolQuery.docs[0].id;
        allocationUpdates.masterAgentId = masterKolId;
        allocationUpdates.masterWallet = masterWalletLower;
      } else {
        // Changing to Master Agent, remove master relationship
        allocationUpdates.masterAgentId = null;
        allocationUpdates.masterWallet = null;
      }
    } else if (updates.masterWallet !== undefined) {
      // Only updating master wallet (agent level should already be 2)
      if (existingData.agentLevel !== 2) {
        return NextResponse.json(
          { error: 'Can only update master wallet for Sub-Agents (Level-2)' },
          { status: 400 }
        );
      }

      const masterWalletLower = updates.masterWallet.toLowerCase();
      const masterKolQuery = await adminDb.collection('kol_profiles')
        .where('wallet', '==', masterWalletLower)
        .where('agentLevel', '==', 1)
        .limit(1)
        .get();

      if (masterKolQuery.empty) {
        return NextResponse.json(
          { error: 'Master agent not found. Please ensure the master wallet belongs to a Level-1 agent.' },
          { status: 404 }
        );
      }

      const masterKolId = masterKolQuery.docs[0].id;
      allocationUpdates.masterAgentId = masterKolId;
      allocationUpdates.masterWallet = masterWalletLower;
    }

    // Update the allocation
    await allocationDoc.ref.update(allocationUpdates);

    // Update KOL profile if wallet or agent level changed
    if (existingData.kolId) {
      const kolDoc = await adminDb.collection('kol_profiles').doc(existingData.kolId).get();
      if (kolDoc.exists) {
        const kolUpdates: any = {
          updatedAt: new Date().toISOString(),
        };

        // Update wallet in KOL profile if changed
        if (updates.wallet !== undefined) {
          kolUpdates.wallet = updates.wallet.toLowerCase();
        }

        // Update agent level and type if changed
        if (updates.agentLevel !== undefined) {
          kolUpdates.agentLevel = updates.agentLevel;
          kolUpdates.agentType = updates.agentLevel === 1 ? 'master_agent' : 'sub_agent';

          if (updates.agentLevel === 2 && updates.masterWallet) {
            const masterKolQuery = await adminDb.collection('kol_profiles')
              .where('wallet', '==', updates.masterWallet.toLowerCase())
              .where('agentLevel', '==', 1)
              .limit(1)
              .get();
            if (!masterKolQuery.empty) {
              kolUpdates.masterAgentId = masterKolQuery.docs[0].id;
            }
          } else if (updates.agentLevel === 1) {
            kolUpdates.masterAgentId = null;
          }
        } else if (updates.masterWallet !== undefined && existingData.agentLevel === 2) {
          // Only updating master wallet (agent level should already be 2)
          const masterKolQuery = await adminDb.collection('kol_profiles')
            .where('wallet', '==', updates.masterWallet.toLowerCase())
            .where('agentLevel', '==', 1)
            .limit(1)
            .get();
          if (!masterKolQuery.empty) {
            kolUpdates.masterAgentId = masterKolQuery.docs[0].id;
          }
        }

        await kolDoc.ref.update(kolUpdates);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Allocation updated successfully',
    });
  } catch (error: any) {
    console.error('Allocation update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

