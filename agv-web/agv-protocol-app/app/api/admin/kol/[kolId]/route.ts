import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { kolId: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await requireAdmin(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { kolId } = params;

    if (!kolId) {
      return NextResponse.json({ error: 'KOL ID is required' }, { status: 400 });
    }

    // Fetch KOL data from Firestore
    const kolQuery = await adminDb.collection('kols').where('kolId', '==', kolId).limit(1).get();
    
    if (kolQuery.empty) {
      return NextResponse.json({ error: 'KOL not found' }, { status: 404 });
    }

    const kolDoc = kolQuery.docs[0];
    const kolData = kolDoc.data();

    // Return KOL data
    return NextResponse.json({
      kolId: kolData.kolId,
      name: kolData.name ?? "",
      walletAddress: kolData.walletAddress ?? "",
      email: kolData.email ?? null,
      target: Number(kolData.target ?? 0),
      seed: Number(kolData.seed ?? 0),
      tree: Number(kolData.tree ?? 0),
      solar: Number(kolData.solar ?? 0),
      compute: Number(kolData.compute ?? 0),
      updatedAt: kolData.updatedAt ?? null,
    });

  } catch (error) {
    console.error('Error fetching KOL data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
