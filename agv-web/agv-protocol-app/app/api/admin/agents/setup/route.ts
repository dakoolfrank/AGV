import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { FieldValue } from 'firebase-admin/firestore';
import { AgentInitData, AgentAllocation } from '@/lib/agent-types';

/**
 * Agent Setup API
 * 
 * POST /api/admin/agents/setup
 * - Initialize agent allocations
 * - Upsert KOL profiles for agents
 * - Link Sub-Agents to Masters
 * 
 * Body: { agents: AgentInitData[] }
 */

// Generate 6-digit refCode
function generateRefCode(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
}

// Generate KOL ID
function generateKolId(): string {
  return `AGV-KOL${generateRefCode()}`;
}

// Extract refCode from KOL ID (e.g., "AGV-KOL879744" -> "879744")
function extractRefCodeFromKolId(kolId: string): string {
  const match = kolId.match(/AGV-KOL(\d{6})/);
  if (match && match[1]) {
    return match[1];
  }
  // Fallback: generate new refCode if format doesn't match
  return generateRefCode();
}

// Find or create KOL profile by wallet
async function upsertKolProfile(
  wallet: string,
  name: string,
  email: string | undefined,
  agentLevel: 1 | 2,
  masterKolId?: string
): Promise<{ kolId: string; refCode: string; created: boolean }> {
  const walletLower = wallet.toLowerCase();
  
  // Check if KOL profile exists by wallet
  const existingQuery = await adminDb.collection('kol_profiles')
    .where('wallet', '==', walletLower)
    .limit(1)
    .get();
  
  if (!existingQuery.empty) {
    // Update existing KOL profile
    const existingDoc = existingQuery.docs[0];
    const existingData = existingDoc.data();
    const kolId = existingDoc.id;
    // Extract refCode from KOL ID (should match the numeric part)
    const refCode = extractRefCodeFromKolId(kolId);
    
    await existingDoc.ref.update({
      displayName: name,
      email: email || existingData.email || '',
      agentType: agentLevel === 1 ? 'master_agent' : 'sub_agent',
      agentLevel,
      masterAgentId: masterKolId || existingData.masterAgentId || null,
      sGVTBalance: 1000, // All agents get 1000 sGVT
      status: existingData.status || 'active',
      refCode, // Update refCode to match KOL ID
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { kolId, refCode, created: false };
  }
  
  // Create new KOL profile
  let kolId = generateKolId();
  
  // Ensure unique KOL ID
  for (let i = 0; i < 5; i++) {
    const checkDoc = await adminDb.collection('kol_profiles').doc(kolId).get();
    if (!checkDoc.exists) break;
    kolId = generateKolId();
  }
  
  // Extract refCode from the generated KOL ID
  const refCode = extractRefCodeFromKolId(kolId);
  
  const kolProfile = {
    id: kolId,
    tier: 'partner' as const, // Default tier for agents
    status: 'active' as const,
    refCode,
    displayName: name,
    email: email || '',
    wallet: walletLower,
    region: [],
    languages: [],
    socials: [],
    agentType: agentLevel === 1 ? 'master_agent' : 'sub_agent',
    agentLevel,
    masterAgentId: masterKolId || null,
    sGVTBalance: 1000,
    campaign: 'G3',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastActiveAt: null,
  };
  
  await adminDb.collection('kol_profiles').doc(kolId).set(kolProfile);
  
  return { kolId, refCode, created: true };
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Support both single agent and array of agents
    let agents: AgentInitData[];
    if (body.agent) {
      // Single agent
      agents = [body.agent];
    } else if (body.agents) {
      // Array of agents
      agents = body.agents;
    } else {
      return NextResponse.json(
        { error: 'agent or agents array is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(agents) || agents.length === 0) {
      return NextResponse.json(
        { error: 'agents array is required' },
        { status: 400 }
      );
    }

    // Validate agents data
    for (const agent of agents) {
      if (!agent.name || !agent.wallet || !agent.agentLevel) {
        return NextResponse.json(
          { error: 'Each agent must have name, wallet, and agentLevel' },
          { status: 400 }
        );
      }
      
      if (agent.agentLevel === 2 && !agent.masterWallet) {
        return NextResponse.json(
          { error: 'Sub-Agents (Level-2) must have masterWallet' },
          { status: 400 }
        );
      }
    }

    const results: Array<{
      agent: AgentInitData;
      kolId: string;
      refCode: string;
      allocationId: string;
      created: boolean;
      error?: string;
    }> = [];

    // First pass: Create/update Master Agents
    const masterWalletMap = new Map<string, string>(); // wallet -> kolId
    
    for (const agent of agents) {
      if (agent.agentLevel === 1) {
        try {
          const { kolId, refCode, created } = await upsertKolProfile(
            agent.wallet,
            agent.name,
            agent.email,
            1
          );
          
          masterWalletMap.set(agent.wallet.toLowerCase(), kolId);
          
          // Create allocation
          const allocationRef = adminDb.collection('agent_allocations').doc();
          const allocation: AgentAllocation = {
            id: allocationRef.id,
            wallet: agent.wallet.toLowerCase(),
            agentLevel: 1,
            preGVTAllocated: 100000, // 100,000 for Masters
            sGVTAllocated: 1000,
            allocatedAt: new Date().toISOString(),
            kolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          await allocationRef.set(allocation);
          
          results.push({
            agent,
            kolId,
            refCode,
            allocationId: allocationRef.id,
            created,
          });
        } catch (error: any) {
          results.push({
            agent,
            kolId: '',
            refCode: '',
            allocationId: '',
            created: false,
            error: error.message,
          });
        }
      }
    }

    // Second pass: Create/update Sub-Agents (they need master KOL ID)
    for (const agent of agents) {
      if (agent.agentLevel === 2) {
        try {
          const masterWallet = agent.masterWallet?.toLowerCase();
          if (!masterWallet) {
            results.push({
              agent,
              kolId: '',
              refCode: '',
              allocationId: '',
              created: false,
              error: 'Master wallet not found',
            });
            continue;
          }

          const masterKolId = masterWalletMap.get(masterWallet);
          if (!masterKolId) {
            results.push({
              agent,
              kolId: '',
              refCode: '',
              allocationId: '',
              created: false,
              error: 'Master agent not found. Create Master agents first.',
            });
            continue;
          }

          const { kolId, refCode, created } = await upsertKolProfile(
            agent.wallet,
            agent.name,
            agent.email,
            2,
            masterKolId
          );

          // Create allocation
          const allocationRef = adminDb.collection('agent_allocations').doc();
          const allocation: AgentAllocation = {
            id: allocationRef.id,
            wallet: agent.wallet.toLowerCase(),
            agentLevel: 2,
            masterAgentId: masterKolId,
            masterWallet: masterWallet,
            preGVTAllocated: 10000, // 10,000 for Sub-Agents
            sGVTAllocated: 1000,
            allocatedAt: new Date().toISOString(),
            kolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await allocationRef.set(allocation);

          results.push({
            agent,
            kolId,
            refCode,
            allocationId: allocationRef.id,
            created,
          });
        } catch (error: any) {
          results.push({
            agent,
            kolId: '',
            refCode: '',
            allocationId: '',
            created: false,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} agents`,
      results,
    });
  } catch (error: any) {
    console.error('Agent setup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

