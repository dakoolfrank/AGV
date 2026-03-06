import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Agent Update API
 * 
 * PATCH /api/admin/agents/update
 * - Update agent KOL profile fields
 * - Update agent allocation if needed
 * 
 * Body: { 
 *   wallet: string;
 *   updates: {
 *     displayName?: string;
 *     email?: string;
 *     agentLevel?: 1 | 2;
 *     masterWallet?: string; // For Sub-Agents
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
    const { wallet, updates } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    const walletLower = wallet.toLowerCase();

    // Find the KOL profile by wallet
    const kolQuery = await adminDb.collection('kol_profiles')
      .where('wallet', '==', walletLower)
      .limit(1)
      .get();

    if (kolQuery.empty) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const kolDoc = kolQuery.docs[0];
    const kolId = kolDoc.id;
    const kolData = kolDoc.data();

    // Prepare KOL profile updates
    const kolUpdates: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (updates.displayName !== undefined) {
      kolUpdates.displayName = updates.displayName;
    }

    if (updates.email !== undefined) {
      kolUpdates.email = updates.email;
    }

    // Handle agent level change
    if (updates.agentLevel !== undefined) {
      const newLevel = updates.agentLevel;
      kolUpdates.agentLevel = newLevel;
      kolUpdates.agentType = newLevel === 1 ? 'master_agent' : 'sub_agent';

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
        kolUpdates.masterAgentId = masterKolId;
      } else {
        // Changing to Master Agent, remove master relationship
        kolUpdates.masterAgentId = null;
      }
    } else if (updates.masterWallet !== undefined) {
      // Only updating master wallet (agent level should already be 2)
      if (kolData.agentLevel !== 2) {
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
      kolUpdates.masterAgentId = masterKolId;
    }

    // Update KOL profile
    await kolDoc.ref.update(kolUpdates);

    // Update allocation if agent level changed
    if (updates.agentLevel !== undefined) {
      const allocationQuery = await adminDb.collection('agent_allocations')
        .where('wallet', '==', walletLower)
        .limit(1)
        .get();

      if (!allocationQuery.empty) {
        const allocationDoc = allocationQuery.docs[0];
        const allocationUpdates: any = {
          agentLevel: updates.agentLevel,
          updatedAt: new Date().toISOString(),
        };

        // Update preGVT allocation based on level
        if (updates.agentLevel === 1) {
          allocationUpdates.preGVTAllocated = 100000;
          allocationUpdates.masterAgentId = null;
          allocationUpdates.masterWallet = null;
        } else {
          allocationUpdates.preGVTAllocated = 10000;
          if (updates.masterWallet) {
            allocationUpdates.masterWallet = updates.masterWallet.toLowerCase();
            // Get master KOL ID for allocation
            const masterKolQuery = await adminDb.collection('kol_profiles')
              .where('wallet', '==', updates.masterWallet.toLowerCase())
              .where('agentLevel', '==', 1)
              .limit(1)
              .get();
            if (!masterKolQuery.empty) {
              allocationUpdates.masterAgentId = masterKolQuery.docs[0].id;
            }
          }
        }

        await allocationDoc.ref.update(allocationUpdates);
      }
    } else if (updates.masterWallet !== undefined && kolData.agentLevel === 2) {
      // Update allocation master wallet if only master wallet changed
      const allocationQuery = await adminDb.collection('agent_allocations')
        .where('wallet', '==', walletLower)
        .limit(1)
        .get();

      if (!allocationQuery.empty) {
        const allocationDoc = allocationQuery.docs[0];
        const masterWalletLower = updates.masterWallet.toLowerCase();
        
        // Get master KOL ID
        const masterKolQuery = await adminDb.collection('kol_profiles')
          .where('wallet', '==', masterWalletLower)
          .where('agentLevel', '==', 1)
          .limit(1)
          .get();

        if (!masterKolQuery.empty) {
          await allocationDoc.ref.update({
            masterWallet: masterWalletLower,
            masterAgentId: masterKolQuery.docs[0].id,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully',
      kolId,
    });
  } catch (error: any) {
    console.error('Agent update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






