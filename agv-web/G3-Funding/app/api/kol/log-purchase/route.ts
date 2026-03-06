import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { KOLProfile, RewardsLedger } from '@/lib/types';
import { calculateSettlement, getCurrentPeriod } from '@/lib/rewards-engine';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface LogPurchaseRequest {
  txHash: string;
  wallet: string;
  kolId: string; // KOL ID (e.g., "AGV-KOL123456")
  purchaseAmount: number; // Amount in USD
  timestamp?: string;
}

/**
 * Map KOL tier to commission percentage for purchase referrals
 * Tier 1 (partner) = 2%, Tier 2 (ambassador) = 1%, Tier 3 (pioneer) = 0%
 */
function getPurchaseCommissionRate(tier: string): number {
  switch (tier) {
    case 'partner':
      return 0.02; // 2% for Tier 1
    case 'ambassador':
      return 0.01; // 1% for Tier 2
    case 'pioneer':
    default:
      return 0; // 0% for Tier 3 or unknown
  }
}

export async function POST(request: NextRequest) {
  try {
    const { txHash, wallet, kolId, purchaseAmount, timestamp }: LogPurchaseRequest = await request.json();
    
    // Validate required fields
    if (!txHash || !wallet || !kolId || purchaseAmount === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Check for duplicate transaction
    const existingPurchase = await db.collection('purchase_events')
      .where('txHash', '==', txHash)
      .limit(1)
      .get();
    
    if (!existingPurchase.empty) {
      return NextResponse.json({ 
        error: 'Transaction already processed' 
      }, { status: 409 });
    }
    
    // Find the KOL by KOL ID (format: "AGV-KOL123456" or just the ID)
    // Extract 6-digit number from KOL ID format
    const kolIdTrimmed = kolId.trim();
    const kolIdMatch = kolIdTrimmed.match(/(\d{6})/);
    const sixDigitCode = kolIdMatch ? kolIdMatch[1] : null;
    
    let kolQuery;
    
    // Strategy 1: Try to find by refCode (most common case)
    // refCode might be the 6-digit number or the full KOL ID
    if (sixDigitCode) {
      kolQuery = await db.collection('kol_profiles')
        .where('refCode', '==', sixDigitCode)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }
    
    // Strategy 2: Try by full refCode match
    if (kolQuery?.empty !== false) {
      kolQuery = await db.collection('kol_profiles')
        .where('refCode', '==', kolIdTrimmed)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }
    
    // Strategy 3: Try by document ID
    if (kolQuery?.empty !== false) {
      try {
        const kolDoc = await db.collection('kol_profiles').doc(kolIdTrimmed).get();
        if (kolDoc.exists) {
          const kol = kolDoc.data() as KOLProfile;
          if (kol.status === 'active') {
            kolQuery = { docs: [kolDoc], empty: false } as any;
          }
        }
      } catch (error) {
        console.error('Error checking KOL by ID:', error);
      }
    }
    
    // Strategy 4: Search all active KOLs and match by refCode pattern
    if (kolQuery?.empty !== false) {
      const allKols = await db.collection('kol_profiles')
        .where('status', '==', 'active')
        .get();
      
      for (const doc of allKols.docs) {
        const kol = doc.data() as KOLProfile;
        // Check multiple matching strategies
        if (kol.refCode === kolIdTrimmed || 
            (sixDigitCode && kol.refCode === sixDigitCode) ||
            doc.id === kolIdTrimmed ||
            (sixDigitCode && kol.refCode.includes(sixDigitCode))) {
          kolQuery = { docs: [doc], empty: false } as any;
          break;
        }
      }
    }
    
    if (kolQuery.empty) {
      return NextResponse.json({ 
        error: 'Invalid or inactive KOL ID' 
      }, { status: 404 });
    }
    
    const kolDoc = kolQuery.docs[0];
    const kol = kolDoc.data() as KOLProfile;
    const kolIdFinal = kolDoc.id;
    
    // Anti-self-ref detection: Check if buyer's wallet matches KOL's wallet
    if (kol.wallet && kol.wallet.toLowerCase() === wallet.toLowerCase()) {
      return NextResponse.json({ 
        error: 'Cannot refer yourself' 
      }, { status: 400 });
    }
    
    // Loop detection: Check if buyer is already a KOL and if there's a referral loop
    // Get buyer's user record from buypage to check their referrerOf
    // For now, we'll rely on buypage to handle this, but we can add additional checks here
    
    // Check if KOL is eligible for purchase referrals (Tier 1 or Tier 2)
    const commissionRate = getPurchaseCommissionRate(kol.tier);
    if (commissionRate === 0) {
      return NextResponse.json({ 
        error: 'KOL tier not eligible for purchase referrals' 
      }, { status: 400 });
    }
    
    // Calculate commission
    const commission = purchaseAmount * commissionRate;
    
    // Create purchase event
    const purchaseEvent = {
      id: uuidv4(),
      kolId: kolIdFinal,
      kolRefCode: kol.refCode,
      wallet: wallet.toLowerCase(),
      txHash: txHash.trim(),
      purchaseAmount,
      commission,
      commissionRate,
      tier: kol.tier,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      campaign: 'G3'
    };
    
    // Save purchase event
    await db.collection('purchase_events').doc(purchaseEvent.id).set({
      ...purchaseEvent,
      timestamp: purchaseEvent.timestamp
    });
    
    // Update KOL rewards (similar to mint events)
    await updateKolRewards(kolIdFinal, commission);
    
    return NextResponse.json({ 
      success: true, 
      purchaseEventId: purchaseEvent.id,
      creditedTo: kol.displayName,
      kolWallet: kol.wallet, // Return KOL wallet for buypage to store
      commission,
      commissionRate: commissionRate * 100 // Return as percentage
    });
    
  } catch (error) {
    console.error('Log purchase error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

async function updateKolRewards(kolId: string, commission: number) {
  const period = getCurrentPeriod();
  const ledgerRef = db.collection('rewards_ledger').doc(`${kolId}_${period}`);
  
  await db.runTransaction(async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerRef);
    
    let ledger: RewardsLedger;
    
    if (ledgerDoc.exists) {
      ledger = ledgerDoc.data() as RewardsLedger;
      
      // Add purchase commission to ownMintsCommission (or create a separate field)
      // For now, we'll add it to ownMintsCommission as purchase referrals are similar to mints
      ledger.ownMintsCommission += commission;
    } else {
      // Create new ledger entry
      ledger = {
        id: `${kolId}_${period}`,
        period,
        kolId,
        ownPostReward: 0,
        ownMintsCommission: commission,
        l1OverrideCommission: 0,
        l2OverrideCommission: 0,
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

