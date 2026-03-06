import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all wallets
    const walletsSnapshot = await adminDb.collection('wallets').get();
    const wallets = walletsSnapshot.docs.map(doc => doc.data());

    // Calculate stats
    const stats = {
      total: wallets.length,
      whitelistedActivated: wallets.filter(w => w.status?.isWhitelisted && w.status?.isActivated).length,
      whitelistedNotActivated: wallets.filter(w => w.status?.isWhitelisted && !w.status?.isActivated).length,
      activatedNotWhitelisted: wallets.filter(w => !w.status?.isWhitelisted && w.status?.isActivated).length,
      totalActivated: wallets.filter(w => w.status?.isActivated).length,
      totalClaimed: wallets.filter(w => w.status?.hasClaimed).length,
      totalBought: wallets.filter(w => w.status?.hasBought).length,
      totalStaked: wallets.filter(w => w.status?.hasStaked).length,
      byTier: {
        'Tier 1': wallets.filter(w => w.metadata?.tier === 'Tier 1').length,
        'Tier 2': wallets.filter(w => w.metadata?.tier === 'Tier 2').length,
        'Tier 3': wallets.filter(w => w.metadata?.tier === 'Tier 3').length,
      },
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

