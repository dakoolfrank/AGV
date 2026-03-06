import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

interface BuyerLeaderboardEntry {
  wallet: string;
  totalAmount: number;
  purchaseCount: number;
  rank?: number;
}

/**
 * Get buyer leaderboard (top buyers by total purchase amount)
 * Ranked by total amount spent across all purchases
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[SERVER DEBUG] Fetching buyer leaderboard:', {
      timestamp: new Date().toISOString(),
    });

    // Get all purchases from the purchases collection
    const allPurchasesQuery = await adminDb.collection('purchases').get();

    console.log('[SERVER DEBUG] Found total purchases:', {
      totalCount: allPurchasesQuery.size,
    });

    // Calculate total amount per buyer wallet
    const buyerTotals = new Map<string, { totalAmount: number; count: number }>();

    allPurchasesQuery.docs.forEach(doc => {
      const purchase = doc.data();
      const buyerAddress = purchase.buyerAddress;
      let purchaseAmount = purchase.purchaseAmount || 0;

      // Ensure purchaseAmount is a number
      if (typeof purchaseAmount === 'string') {
        purchaseAmount = parseFloat(purchaseAmount);
      }
      if (isNaN(purchaseAmount) || !isFinite(purchaseAmount)) {
        console.warn('[SERVER DEBUG] Invalid purchaseAmount, using 0:', {
          purchaseId: doc.id,
          purchaseAmount: purchase.purchaseAmount,
          purchaseAmountType: typeof purchase.purchaseAmount,
        });
        purchaseAmount = 0;
      }

      if (buyerAddress) {
        const buyerLower = buyerAddress.toLowerCase();
        const current = buyerTotals.get(buyerLower) || { totalAmount: 0, count: 0 };
        const newTotal = current.totalAmount + purchaseAmount;
        buyerTotals.set(buyerLower, {
          totalAmount: newTotal,
          count: current.count + 1,
        });

        console.log('[SERVER DEBUG] Processing purchase for buyer leaderboard:', {
          purchaseId: doc.id,
          buyerAddress: buyerLower,
          purchaseAmount,
          purchaseAmountType: typeof purchaseAmount,
          purchaseAmountFormatted: `$${purchaseAmount.toFixed(2)}`,
          previousTotal: current.totalAmount,
          newTotal: newTotal,
          runningCount: current.count + 1,
        });
      }
    });

    console.log('[SERVER DEBUG] Buyer totals calculated:', {
      uniqueBuyers: buyerTotals.size,
      totals: Array.from(buyerTotals.entries()).slice(0, 10).map(([wallet, data]) => ({
        wallet,
        totalAmount: data.totalAmount,
        count: data.count,
      })),
    });

    // Convert to array and sort by total amount (descending)
    const allEntries = Array.from(buyerTotals.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalAmount: data.totalAmount,
        purchaseCount: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    console.log('[SERVER DEBUG] All buyer entries (before top 50):', {
      totalEntries: allEntries.length,
      top10: allEntries.slice(0, 10).map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    });

    const leaderboard: BuyerLeaderboardEntry[] = allEntries
      .slice(0, 50) // Top 50
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    console.log('[SERVER DEBUG] Final buyer leaderboard (top 50):', {
      leaderboardCount: leaderboard.length,
      leaderboard: leaderboard.slice(0, 10), // Log first 10
    });

    return NextResponse.json({
      success: true,
      data: leaderboard,
      debug: {
        totalPurchases: allPurchasesQuery.size,
        uniqueBuyers: buyerTotals.size,
        totalEntries: allEntries.length,
        top50Count: leaderboard.length,
      },
    });
  } catch (error) {
    console.error('[SERVER DEBUG] Error fetching buyer leaderboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch buyer leaderboard',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

