import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../../_auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Individual Settlement Actions
 * 
 * GET /api/admin/agents/settlements/[id]
 * - Get specific settlement
 * 
 * POST /api/admin/agents/settlements/[id]/verify
 * - Mark settlement as verified
 * 
 * POST /api/admin/agents/settlements/[id]/mark-paid
 * - Mark settlement as paid with txHash
 * Body: { txHash: string, notes?: string }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settlementDoc = await adminDb.collection('weekly_settlements').doc(params.id).get();

    if (!settlementDoc.exists) {
      return NextResponse.json(
        { error: 'Settlement not found' },
        { status: 404 }
      );
    }

    const settlement = {
      id: settlementDoc.id,
      ...settlementDoc.data(),
    };

    return NextResponse.json({
      success: true,
      settlement,
    });
  } catch (error: any) {
    console.error('Error fetching settlement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

