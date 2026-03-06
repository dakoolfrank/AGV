import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Mark/unmark wallet as suspicious
 */
export async function POST(request: NextRequest, { params }: { params: { address: string } }) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isSuspicious, reason } = body;

    if (typeof isSuspicious !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isSuspicious must be a boolean' },
        { status: 400 }
      );
    }

    const normalizedAddress = params.address.toLowerCase();
    const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
    const walletSnap = await walletRef.get();

    if (!walletSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const now = Timestamp.now();
    const updatedBy = decoded.email || 'unknown';

    await walletRef.update({
      'earlyCircle.isSuspicious': isSuspicious,
      'earlyCircle.suspiciousReason': reason || null,
      'earlyCircle.flaggedAt': isSuspicious ? now : null,
      'earlyCircle.flaggedBy': isSuspicious ? updatedBy : null,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Wallet ${isSuspicious ? 'marked as' : 'unmarked from'} suspicious`,
    });
  } catch (error) {
    console.error('Error updating suspicious wallet flag:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

