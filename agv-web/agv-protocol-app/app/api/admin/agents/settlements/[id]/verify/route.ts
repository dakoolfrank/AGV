import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../../../_auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Verify Settlement
 * POST /api/admin/agents/settlements/[id]/verify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settlementRef = adminDb.collection('weekly_settlements').doc(params.id);
    const settlementDoc = await settlementRef.get();

    if (!settlementDoc.exists) {
      return NextResponse.json(
        { error: 'Settlement not found' },
        { status: 404 }
      );
    }

    const settlement = settlementDoc.data();
    
    if (settlement?.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot verify a settlement that is already paid' },
        { status: 400 }
      );
    }

    await settlementRef.update({
      status: 'verified',
      verifiedBy: decoded.email || 'unknown',
      verifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Settlement verified',
      settlement: {
        id: settlementDoc.id,
        ...settlement,
        status: 'verified',
        verifiedBy: decoded.email || 'unknown',
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error verifying settlement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

