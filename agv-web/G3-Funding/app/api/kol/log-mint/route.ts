import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { MintEvent, RewardsLedger, KOLProfile } from '@/lib/types';
import { calculateCommissions, calculateSettlement, getCurrentPeriod, DEFAULT_SOCIAL_MINING_CONFIG } from '@/lib/rewards-engine';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface LogMintRequest {
  txHash: string;
  wallet: string;
  network: string;
  refCode: string;
  mintValueUsd?: number;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { txHash, wallet, network, refCode, mintValueUsd = 100, timestamp }: LogMintRequest = await request.json();
    
    // Validate required fields
    if (!txHash || !wallet || !network || !refCode) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Check for duplicate transaction
    const existingMint = await db.collection('mint_events')
      .where('txHash', '==', txHash)
      .limit(1)
      .get();
    
    if (!existingMint.empty) {
      return NextResponse.json({ 
        error: 'Transaction already processed' 
      }, { status: 409 });
    }
    
    // Find the KOL by refCode
    const kolQuery = await db.collection('kol_profiles')
      .where('refCode', '==', refCode)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (kolQuery.empty) {
      return NextResponse.json({ 
        error: 'Invalid or inactive referral code' 
      }, { status: 404 });
    }
    
    const kolDoc = kolQuery.docs[0];
    const kol = kolDoc.data() as KOLProfile;
    const kolId = kolDoc.id;
    
    // Create mint event
    const mintEvent: MintEvent = {
      id: uuidv4(),
      refCode: refCode,
      creditedKolId: kolId,
      wallet,
      txHash,
      network,
      mintValueUsd,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      campaign: 'G3'
    };
    
    // Save mint event
    await db.collection('mint_events').doc(mintEvent.id).set({
      ...mintEvent,
      timestamp: mintEvent.timestamp
    });
    
    // Calculate and distribute commissions
    await distributeCommissions(kol, mintValueUsd);
    
    // Update global mint counter
    await updateGlobalMintCounter(mintValueUsd);
    
    return NextResponse.json({ 
      success: true, 
      mintEventId: mintEvent.id,
      creditedTo: kol.displayName
    });
    
  } catch (error) {
    console.error('Log mint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

async function distributeCommissions(directKol: KOLProfile, mintValueUsd: number) {
  const period = getCurrentPeriod();
  
  // Get sponsor hierarchy
  const l1Kol = directKol.sponsorRef ? await getKolBySponsorRef(directKol.sponsorRef) : null;
  const l2Kol = l1Kol?.sponsorRef ? await getKolBySponsorRef(l1Kol.sponsorRef) : null;
  
  // Calculate commissions
  const commissions = calculateCommissions(
    mintValueUsd,
    directKol.tier,
    l1Kol?.tier,
    l2Kol?.tier
  );
  
  // Update direct KOL rewards
  await updateKolRewards(directKol.id, period, {
    ownMintsCommission: commissions.direct,
    l1OverrideCommission: 0,
    l2OverrideCommission: 0
  });
  
  // Update L1 sponsor rewards
  if (l1Kol && commissions.l1 > 0) {
    await updateKolRewards(l1Kol.id, period, {
      ownMintsCommission: 0,
      l1OverrideCommission: commissions.l1,
      l2OverrideCommission: 0
    });
  }
  
  // Update L2 sponsor rewards
  if (l2Kol && commissions.l2 > 0) {
    await updateKolRewards(l2Kol.id, period, {
      ownMintsCommission: 0,
      l1OverrideCommission: 0,
      l2OverrideCommission: commissions.l2
    });
  }
}

async function getKolBySponsorRef(sponsorRef: string): Promise<KOLProfile | null> {
  const query = await db.collection('kol_profiles')
    .where('refCode_kol', '==', sponsorRef)
    .limit(1)
    .get();
  
  if (query.empty) return null;
  
  const doc = query.docs[0];
  return { id: doc.id, ...doc.data() } as KOLProfile;
}

async function updateKolRewards(
  kolId: string, 
  period: string, 
  additions: {
    ownMintsCommission: number;
    l1OverrideCommission: number;
    l2OverrideCommission: number;
  }
) {
  const ledgerRef = db.collection('rewards_ledger').doc(`${kolId}_${period}`);
  
  await db.runTransaction(async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerRef);
    
    let ledger: RewardsLedger;
    
    if (ledgerDoc.exists) {
      ledger = ledgerDoc.data() as RewardsLedger;
      
      // Add to existing amounts
      ledger.ownMintsCommission += additions.ownMintsCommission;
      ledger.l1OverrideCommission += additions.l1OverrideCommission;
      ledger.l2OverrideCommission += additions.l2OverrideCommission;
    } else {
      // Create new ledger entry
      ledger = {
        id: `${kolId}_${period}`,
        period,
        kolId,
        ownPostReward: 0,
        ownMintsCommission: additions.ownMintsCommission,
        l1OverrideCommission: additions.l1OverrideCommission,
        l2OverrideCommission: additions.l2OverrideCommission,
        totalEarned: 0,
        immediateAmount: 0,
        vestedAmount: 0,
        capApplied: false,
        calculatedAt: new Date(),
        campaign: 'G3'
      };
    }
    
    // Recalculate totals
    ledger.totalEarned = ledger.ownPostReward + ledger.ownMintsCommission + 
                        ledger.l1OverrideCommission + ledger.l2OverrideCommission;
    
    const settlement = calculateSettlement(ledger.totalEarned);
    ledger.immediateAmount = settlement.immediate;
    ledger.vestedAmount = settlement.vested;
    
    transaction.set(ledgerRef, {
      ...ledger,
      calculatedAt: new Date()
    });
  });
}

async function updateGlobalMintCounter(mintValueUsd: number) {
  const counterRef = db.collection('global_counters').doc('G3_mints');
  
  await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const today = new Date().toISOString().split('T')[0];
    
    if (counterDoc.exists) {
      const counter = counterDoc.data();
      const last7Days = counter.last7Days || [];
      
      // Update today's entry or add new one
      const todayIndex = last7Days.findIndex((day: any) => day.date === today);
      if (todayIndex >= 0) {
        last7Days[todayIndex].mints += 1;
        last7Days[todayIndex].value += mintValueUsd;
      } else {
        last7Days.push({ date: today, mints: 1, value: mintValueUsd });
      }
      
      // Keep only last 7 days
      const sortedDays = last7Days
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7);
      
      transaction.update(counterRef, {
        totalMints: (counter.totalMints || 0) + 1,
        totalValue: (counter.totalValue || 0) + mintValueUsd,
        last7Days: sortedDays,
        updatedAt: new Date()
      });
    } else {
      transaction.set(counterRef, {
        campaign: 'G3',
        totalMints: 1,
        totalValue: mintValueUsd,
        last7Days: [{ date: today, mints: 1, value: mintValueUsd }],
        updatedAt: new Date()
      });
    }
  });
}
