/**
 * Script to initialize Master & Sub-Agents
 * 
 * Usage:
 *   npx tsx scripts/initialize-agents.ts
 * 
 * This will create/update KOL profiles and allocations for all agents
 */

import { adminDb } from '../lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { AgentInitData, AgentAllocation } from '../lib/agent-types';

// Agent data from requirements
const AGENTS: AgentInitData[] = [
  // Master Agents (Level-1)
  {
    name: 'Ling Feng',
    wallet: '0xf6236d51d602fbebaf9b7da8b6d23e4e72b010ffc',
    agentLevel: 1,
  },
  {
    name: 'Ji Qingshan',
    wallet: '0x91f72a1c738e67dc7f23cf10c1b621d24250a7f5',
    agentLevel: 1,
  },
  {
    name: 'Zhou Dasen',
    wallet: '0xa2b48c8b8dda001246c9f98815c3a851fde6a05e',
    agentLevel: 1,
  },
  {
    name: 'Wu Lili',
    wallet: '0x1587932a6c2d90b7beb4536b63d3f17b7c1b1e46',
    agentLevel: 1,
  },
  {
    name: 'Zhao Xiaoyu',
    wallet: '0x1cc443605c98d951bcf4122a9168d8002ce92980',
    agentLevel: 1,
  },
  {
    name: 'Gao Kai',
    wallet: '0x77165b07a6a5392b28f2d2905b44453aaebf8026',
    agentLevel: 1,
  },
  {
    name: "Ke Zong's",
    wallet: '0x34898b1eb225e43518e81f527e25e2d97cd6ad6d',
    agentLevel: 1,
  },
  
  // Sub-Agents (Level-2)
  {
    name: 'Li Danling',
    wallet: '0x524fcd94927c29fe5e2ff3c4363b2be3c0fe3414',
    agentLevel: 2,
    masterName: 'Ling Feng',
    masterWallet: '0xf6236d51d602fbebaf9b7da8b6d23e4e72b010ffc',
  },
  {
    name: 'Pei Yuhua',
    wallet: '0x2039f74e93528c1e434d7890ab57ea0ce94e042b',
    agentLevel: 2,
    masterName: 'Ji Qingshan',
    masterWallet: '0x91f72a1c738e67dc7f23cf10c1b621d24250a7f5',
  },
  {
    name: 'Lian Xiaoyan',
    wallet: '0x01a00247dd0425c2f5b494e3fd7af9218cf2c7a8',
    agentLevel: 2,
    masterName: 'Ji Qingshan',
    masterWallet: '0x91f72a1c738e67dc7f23cf10c1b621d24250a7f5',
  },
  {
    name: 'Fan Zhijuan',
    wallet: '0x4d491e033fcb832624ced94bca4567cedf82202b',
    agentLevel: 2,
    masterName: 'Ji Qingshan',
    masterWallet: '0x91f72a1c738e67dc7f23cf10c1b621d24250a7f5',
  },
];

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

async function initializeAgents() {
  console.log('🚀 Initializing agents...\n');

  const results: Array<{
    agent: AgentInitData;
    kolId: string;
    refCode: string;
    allocationId: string;
    created: boolean;
    error?: string;
  }> = [];

  try {
    // First pass: Create/update Master Agents
    const masterWalletMap = new Map<string, string>(); // wallet -> kolId
    
    console.log('📋 Processing Master Agents (Level-1)...\n');
    
    for (const agent of AGENTS) {
      if (agent.agentLevel === 1) {
        try {
          console.log(`  Processing: ${agent.name} (${agent.wallet})`);
          
          const { kolId, refCode, created } = await upsertKolProfile(
            agent.wallet,
            agent.name,
            agent.email,
            1
          );
          
          masterWalletMap.set(agent.wallet.toLowerCase(), kolId);
          
          // Check if allocation already exists
          const existingAllocation = await adminDb.collection('agent_allocations')
            .where('wallet', '==', agent.wallet.toLowerCase())
            .limit(1)
            .get();
          
          let allocationId: string;
          if (!existingAllocation.empty) {
            // Update existing allocation
            allocationId = existingAllocation.docs[0].id;
            await existingAllocation.docs[0].ref.update({
              kolId,
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`    ✅ Updated existing allocation`);
          } else {
            // Create new allocation
            const allocationRef = adminDb.collection('agent_allocations').doc();
            allocationId = allocationRef.id;
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
            console.log(`    ✅ Created new allocation`);
          }
          
          results.push({
            agent,
            kolId,
            refCode,
            allocationId,
            created,
          });
          
          console.log(`    KOL ID: ${kolId}`);
          console.log(`    Ref Code: ${refCode}`);
          console.log(`    Status: ${created ? 'Created' : 'Updated'}\n`);
        } catch (error: any) {
          console.error(`    ❌ Error: ${error.message}\n`);
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
    console.log('📋 Processing Sub-Agents (Level-2)...\n');
    
    for (const agent of AGENTS) {
      if (agent.agentLevel === 2) {
        try {
          console.log(`  Processing: ${agent.name} (${agent.wallet})`);
          
          const masterWallet = agent.masterWallet?.toLowerCase();
          if (!masterWallet) {
            console.error(`    ❌ Error: Master wallet not found\n`);
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
            console.error(`    ❌ Error: Master agent not found. Create Master agents first.\n`);
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

          // Check if allocation already exists
          const existingAllocation = await adminDb.collection('agent_allocations')
            .where('wallet', '==', agent.wallet.toLowerCase())
            .limit(1)
            .get();
          
          let allocationId: string;
          if (!existingAllocation.empty) {
            // Update existing allocation
            allocationId = existingAllocation.docs[0].id;
            await existingAllocation.docs[0].ref.update({
              kolId,
              masterAgentId: masterKolId,
              masterWallet: masterWallet,
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`    ✅ Updated existing allocation`);
          } else {
            // Create new allocation
            const allocationRef = adminDb.collection('agent_allocations').doc();
            allocationId = allocationRef.id;
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
            console.log(`    ✅ Created new allocation`);
          }

          results.push({
            agent,
            kolId,
            refCode,
            allocationId,
            created,
          });
          
          console.log(`    KOL ID: ${kolId}`);
          console.log(`    Ref Code: ${refCode}`);
          console.log(`    Master: ${agent.masterName} (${masterKolId})`);
          console.log(`    Status: ${created ? 'Created' : 'Updated'}\n`);
        } catch (error: any) {
          console.error(`    ❌ Error: ${error.message}\n`);
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

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Agents: ${results.length}`);
    console.log(`Successful: ${results.filter(r => !r.error).length}`);
    console.log(`Errors: ${results.filter(r => r.error).length}`);
    console.log(`Created: ${results.filter(r => r.created).length}`);
    console.log(`Updated: ${results.filter(r => !r.created && !r.error).length}`);
    
    console.log('\n📋 Results:');
    results.forEach((r, idx) => {
      if (r.error) {
        console.log(`  ${idx + 1}. ❌ ${r.agent.name}: ${r.error}`);
      } else {
        console.log(`  ${idx + 1}. ✅ ${r.agent.name} (Level-${r.agent.agentLevel})`);
        console.log(`     KOL ID: ${r.kolId}`);
        console.log(`     Ref Code: ${r.refCode}`);
        console.log(`     Allocation ID: ${r.allocationId}`);
      }
    });
    
    console.log('\n✨ Done!');
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  initializeAgents()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { initializeAgents, AGENTS };
