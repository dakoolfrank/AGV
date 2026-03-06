import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

interface ClaimReferralEntry {
  wallet: string;
  totalAmount: number;
  referralCount: number;
  rank?: number;
}

/**
 * Get claim referral leaderboard (top 20 referrers from claim page)
 * Ranked by total amount spent by their referrals
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period'); // Optional: YYYY-MM-DD format for weekly period

    console.log('[SERVER DEBUG] Fetching claim referral leaderboard:', {
      period: period || 'all',
      timestamp: new Date().toISOString(),
    });

    // Get all purchases with wallet referrals (not KOL referrals)
    // Note: Firestore doesn't support != null directly, so we'll get all and filter
    const allPurchasesQuery = await adminDb.collection('purchases')
      .where('isKolReferral', '==', false)
      .get();

    console.log('[SERVER DEBUG] Found purchases with isKolReferral=false:', {
      totalCount: allPurchasesQuery.size,
    });

    // Filter for purchases with referrerWallet (since Firestore != null doesn't work)
    const walletReferralPurchases = allPurchasesQuery.docs.filter(doc => {
      const data = doc.data();
      const hasReferrerWallet = data.referrerWallet && 
                                typeof data.referrerWallet === 'string' && 
                                data.referrerWallet.trim() !== '';
      
      if (!hasReferrerWallet) {
        console.log('[SERVER DEBUG] Purchase missing referrerWallet:', {
          purchaseId: doc.id,
          buyerAddress: data.buyerAddress,
          isKolReferral: data.isKolReferral,
          hasReferrerWallet: !!data.referrerWallet,
          referrerWallet: data.referrerWallet,
        });
      }
      
      return hasReferrerWallet;
    });

    console.log('[SERVER DEBUG] Filtered purchases with referrerWallet:', {
      totalPurchases: allPurchasesQuery.size,
      walletReferralPurchases: walletReferralPurchases.length,
      filteredOut: allPurchasesQuery.size - walletReferralPurchases.length,
    });

    // Calculate total token amount per referrer wallet (in preGVT)
    const referralTotals = new Map<string, { totalAmount: number; count: number }>();

    walletReferralPurchases.forEach(doc => {
      const purchase = doc.data();
      const referrerWallet = purchase.referrerWallet;
      let tokenAmount = purchase.tokenAmount || 0;

      // Ensure tokenAmount is a number
      if (typeof tokenAmount === 'string') {
        tokenAmount = parseFloat(tokenAmount);
      }
      if (isNaN(tokenAmount) || !isFinite(tokenAmount)) {
        console.warn('[SERVER DEBUG] Invalid tokenAmount, using 0:', {
          purchaseId: doc.id,
          tokenAmount: purchase.tokenAmount,
          tokenAmountType: typeof purchase.tokenAmount,
        });
        tokenAmount = 0;
      }

      if (referrerWallet) {
        const walletLower = referrerWallet.toLowerCase();
        const current = referralTotals.get(walletLower) || { totalAmount: 0, count: 0 };
        const newTotal = current.totalAmount + tokenAmount;
        referralTotals.set(walletLower, {
          totalAmount: newTotal,
          count: current.count + 1,
        });

        console.log('[SERVER DEBUG] Processing purchase for leaderboard:', {
          purchaseId: doc.id,
          referrerWallet: walletLower,
          tokenAmount,
          tokenAmountType: typeof tokenAmount,
          tokenAmountFormatted: `${tokenAmount.toLocaleString()} preGVT`,
          buyerAddress: purchase.buyerAddress,
          previousTotal: current.totalAmount,
          newTotal: newTotal,
          runningCount: current.count + 1,
        });
      }
    });

    console.log('[SERVER DEBUG] Referral totals calculated:', {
      uniqueReferrers: referralTotals.size,
      totals: Array.from(referralTotals.entries()).map(([wallet, data]) => ({
        wallet,
        totalAmount: data.totalAmount,
        count: data.count,
      })),
    });

    // Convert to array and sort by total amount (descending)
    const allEntries = Array.from(referralTotals.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalAmount: data.totalAmount,
        referralCount: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    console.log('[SERVER DEBUG] All leaderboard entries (before top 20):', {
      totalEntries: allEntries.length,
      entries: allEntries.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    });

    const leaderboard: ClaimReferralEntry[] = allEntries
      .slice(0, 20) // Top 20
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    console.log('[SERVER DEBUG] Final leaderboard (top 20):', {
      leaderboardCount: leaderboard.length,
      leaderboard: leaderboard,
    });

    return NextResponse.json({
      success: true,
      data: leaderboard,
      debug: {
        totalPurchases: allPurchasesQuery.size,
        walletReferralPurchases: walletReferralPurchases.length,
        uniqueReferrers: referralTotals.size,
        totalEntries: allEntries.length,
        top20Count: leaderboard.length,
      },
    });
  } catch (error) {
    console.error('Error fetching claim referral leaderboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch claim referral leaderboard',
    }, { status: 500 });
  }
}

