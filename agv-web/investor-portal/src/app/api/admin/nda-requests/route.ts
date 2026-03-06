import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const q = adminDb.collection('ndaRequests').orderBy('submittedAt', 'desc');
    const querySnapshot = await q.get();
    
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching NDA requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NDA requests' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    
    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await adminDb.collection('ndaRequests').doc(id).update({
      status,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating NDA request:', error);
    return NextResponse.json(
      { error: 'Failed to update NDA request' },
      { status: 500 }
    );
  }
}
