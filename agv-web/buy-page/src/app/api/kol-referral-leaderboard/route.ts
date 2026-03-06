import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

interface KOLReferralLeaderboardEntry {
  wallet: string;
  referrals: number;
  kolId: string;
}

/**
 * Get KOL referral leaderboard based on purchase referrals in buypage
 * Counts the number of purchases made with each KOL's referral code
 * Gets KOL wallet addresses directly from kol_profiles collection
 */
export async function GET(request: NextRequest) {
  try {
    // Get all purchases from buypage database
    const purchasesQuery = await adminDb.collection('purchases').get();
    
    // Count purchases per KOL ID
    const referralCounts = new Map<string, number>();
    const kolWalletMap = new Map<string, string>(); // Store KOL ID -> wallet mapping
    
    purchasesQuery.docs.forEach(doc => {
      const purchase = doc.data();
      const kolId = purchase.kolId;
      if (kolId && kolId.trim()) {
        const kolIdTrimmed = kolId.trim();
        referralCounts.set(kolIdTrimmed, (referralCounts.get(kolIdTrimmed) || 0) + 1);
        
        if (purchase.kolWallet) {
          kolWalletMap.set(kolIdTrimmed, purchase.kolWallet);
        }
      }
    });
    
    // Get KOL wallet addresses directly from kol_profiles collection for missing wallets
    const kolIdsToFetch = Array.from(referralCounts.keys()).filter(
      kolId => !kolWalletMap.has(kolId)
    );
    
    // Fetch missing wallets directly from database
    if (kolIdsToFetch.length > 0) {
      for (const kolId of kolIdsToFetch) {
        try {
          const kolIdTrimmed = kolId.trim();
          
          // Strategy 1: Try by document ID
          const kolDoc = await adminDb.collection('kol_profiles').doc(kolIdTrimmed).get();
          if (kolDoc.exists) {
            const kol = kolDoc.data();
            if (kol?.wallet) {
              kolWalletMap.set(kolIdTrimmed, kol.wallet);
              continue;
            }
          }
          
          // Strategy 2: Try by refCode (extract 6-digit code)
          const kolIdMatch = kolIdTrimmed.match(/(\d{6})/);
          if (kolIdMatch) {
            const sixDigitCode = kolIdMatch[1];
            const refCodeQuery = await adminDb.collection('kol_profiles')
              .where('refCode', '==', sixDigitCode)
              .limit(1)
              .get();
            
            if (!refCodeQuery.empty) {
              const kol = refCodeQuery.docs[0].data();
              if (kol?.wallet) {
                kolWalletMap.set(kolIdTrimmed, kol.wallet);
                continue;
              }
            }
          }
          
          // Strategy 3: Try by full refCode match
          const refCodeQuery2 = await adminDb.collection('kol_profiles')
            .where('refCode', '==', kolIdTrimmed)
            .limit(1)
            .get();
          
          if (!refCodeQuery2.empty) {
            const kol = refCodeQuery2.docs[0].data();
            if (kol?.wallet) {
              kolWalletMap.set(kolIdTrimmed, kol.wallet);
              continue;
            }
          }
          
          // Strategy 4: Search all active KOLs
          if (!kolWalletMap.has(kolIdTrimmed)) {
            const allKols = await adminDb.collection('kol_profiles')
              .where('status', '==', 'active')
              .get();
            
            for (const doc of allKols.docs) {
              const kol = doc.data();
              if (kol.refCode === kolIdTrimmed || 
                  doc.id === kolIdTrimmed ||
                  (kolIdMatch && kol.refCode === kolIdMatch[1])) {
                if (kol?.wallet) {
                  kolWalletMap.set(kolIdTrimmed, kol.wallet);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching wallet for KOL ${kolId}:`, error);
        }
      }
    }
    
    // Build leaderboard entries
    const leaderboard: KOLReferralLeaderboardEntry[] = [];
    
    referralCounts.forEach((referrals, kolId) => {
      const wallet = kolWalletMap.get(kolId) || '';
      
      // Only include entries with wallet addresses (valid KOLs)
      if (wallet) {
        leaderboard.push({
          wallet: wallet,
          referrals: referrals,
          kolId: kolId
        });
      }
    });
    
    // Sort by number of referrals (descending)
    leaderboard.sort((a, b) => b.referrals - a.referrals);
    
    return NextResponse.json({
      success: true,
      data: leaderboard
    });
    
  } catch (error) {
    console.error('KOL referral leaderboard error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch leaderboard',
      data: []
    }, { status: 500 });
  }
}

