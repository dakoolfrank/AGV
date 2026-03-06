import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../_auth';
import { WalletDocument } from '@/lib/wallet-management';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'all';
    const tier = searchParams.get('tier') || 'all';
    const search = searchParams.get('search') || '';

    // Get all wallets (for large collections, consider pagination or caching)
    const allWalletsSnapshot = await adminDb.collection('wallets').get();
    let wallets = allWalletsSnapshot.docs.map(doc => {
      const data = doc.data() as WalletDocument;
      return {
        ...data,
        id: doc.id,
        timestamps: {
          firstConnected: data.timestamps.firstConnected?.toDate?.()?.toISOString() || data.timestamps.firstConnected,
          activatedAt: data.timestamps.activatedAt?.toDate?.()?.toISOString() || data.timestamps.activatedAt,
          claimedAt: data.timestamps.claimedAt?.toDate?.()?.toISOString() || data.timestamps.claimedAt,
          firstBuyAt: data.timestamps.firstBuyAt?.toDate?.()?.toISOString() || data.timestamps.firstBuyAt,
          firstStakeAt: data.timestamps.firstStakeAt?.toDate?.()?.toISOString() || data.timestamps.firstStakeAt,
        },
      };
    });

    // Apply filters
    if (status === 'whitelisted_activated') {
      wallets = wallets.filter(w => w.status.isWhitelisted && w.status.isActivated);
    } else if (status === 'whitelisted_not_activated') {
      wallets = wallets.filter(w => w.status.isWhitelisted && !w.status.isActivated);
    } else if (status === 'activated_not_whitelisted') {
      wallets = wallets.filter(w => !w.status.isWhitelisted && w.status.isActivated);
    }

    if (tier !== 'all') {
      wallets = wallets.filter(w => w.metadata.tier === tier);
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      wallets = wallets.filter(w => w.address.toLowerCase().includes(searchLower));
    }

    const total = wallets.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    wallets = wallets.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

