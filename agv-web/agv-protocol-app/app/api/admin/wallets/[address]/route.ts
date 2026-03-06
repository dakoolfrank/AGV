import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { getWallet, fullSyncWallet, updateWalletStatus } from '@/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address } = await params;
    const normalizedAddress = address.toLowerCase();

    const wallet = await getWallet(normalizedAddress);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Get related data
    const [userSnap, connectionsSnap, purchasesSnap, claimsSnap] = await Promise.all([
      adminDb.collection('users').doc(normalizedAddress).get(),
      adminDb.collection('wallet_connections')
        .where('walletAddress', '==', normalizedAddress)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get(),
      adminDb.collection('purchase_events')
        .where('wallet', '==', normalizedAddress)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get(),
      adminDb.collection('users').doc(normalizedAddress).get(),
    ]);

    return NextResponse.json({
      success: true,
      wallet: {
        ...wallet,
        timestamps: {
          firstConnected: wallet.timestamps.firstConnected?.toDate?.()?.toISOString() || wallet.timestamps.firstConnected,
          activatedAt: wallet.timestamps.activatedAt?.toDate?.()?.toISOString() || wallet.timestamps.activatedAt,
          claimedAt: wallet.timestamps.claimedAt?.toDate?.()?.toISOString() || wallet.timestamps.claimedAt,
          firstBuyAt: wallet.timestamps.firstBuyAt?.toDate?.()?.toISOString() || wallet.timestamps.firstBuyAt,
          firstStakeAt: wallet.timestamps.firstStakeAt?.toDate?.()?.toISOString() || wallet.timestamps.firstStakeAt,
        },
      },
      relatedData: {
        user: userSnap.exists ? userSnap.data() : null,
        connections: connectionsSnap.docs.map(doc => doc.data()),
        purchases: purchasesSnap.docs.map(doc => doc.data()),
        hasClaimed: claimsSnap.exists ? (claimsSnap.data() as any)?.hasClaimed : false,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address } = await params;
    const normalizedAddress = address.toLowerCase();

    // Force full sync
    const wallet = await fullSyncWallet(normalizedAddress);

    return NextResponse.json({
      success: true,
      wallet: {
        ...wallet,
        timestamps: {
          firstConnected: wallet.timestamps.firstConnected?.toDate?.()?.toISOString() || wallet.timestamps.firstConnected,
          activatedAt: wallet.timestamps.activatedAt?.toDate?.()?.toISOString() || wallet.timestamps.activatedAt,
          claimedAt: wallet.timestamps.claimedAt?.toDate?.()?.toISOString() || wallet.timestamps.claimedAt,
          firstBuyAt: wallet.timestamps.firstBuyAt?.toDate?.()?.toISOString() || wallet.timestamps.firstBuyAt,
          firstStakeAt: wallet.timestamps.firstStakeAt?.toDate?.()?.toISOString() || wallet.timestamps.firstStakeAt,
        },
      },
      syncedFrom: {
        users: true,
        whitelists: true,
        connections: true,
        events: true,
      },
    });
  } catch (error) {
    console.error('Error syncing wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address } = await params;
    const body = await request.json();
    const normalizedAddress = address.toLowerCase();

    // Update wallet (admin override)
    await updateWalletStatus(normalizedAddress, {
      ...body,
      lastSyncedAt: Timestamp.now(), // Prevent auto-sync from overwriting
    });

    const wallet = await getWallet(normalizedAddress);

    return NextResponse.json({
      success: true,
      wallet: {
        ...wallet,
        timestamps: {
          firstConnected: wallet?.timestamps.firstConnected?.toDate?.()?.toISOString() || wallet?.timestamps.firstConnected,
          activatedAt: wallet?.timestamps.activatedAt?.toDate?.()?.toISOString() || wallet?.timestamps.activatedAt,
          claimedAt: wallet?.timestamps.claimedAt?.toDate?.()?.toISOString() || wallet?.timestamps.claimedAt,
          firstBuyAt: wallet?.timestamps.firstBuyAt?.toDate?.()?.toISOString() || wallet?.timestamps.firstBuyAt,
          firstStakeAt: wallet?.timestamps.firstStakeAt?.toDate?.()?.toISOString() || wallet?.timestamps.firstStakeAt,
        },
      },
    });
  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

