import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../../../_auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Mark Settlement as Paid
 * POST /api/admin/agents/settlements/[id]/mark-paid
 * Body: { txHash: string, notes?: string }
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

    const body = await request.json();
    const { txHash, notes } = body;

    if (!txHash || typeof txHash !== 'string' || txHash.trim().length === 0) {
      return NextResponse.json(
        { error: 'txHash is required' },
        { status: 400 }
      );
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
        { error: 'Settlement is already marked as paid' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status: 'paid',
      txHash: txHash.trim(),
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    await settlementRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Settlement marked as paid',
      settlement: {
        id: settlementDoc.id,
        ...settlement,
        ...updateData,
        paidAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error marking settlement as paid:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

