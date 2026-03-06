import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { status, note } = await req.json().catch(() => ({}));
  const { id } = await params;

  if (!id || !status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'Invalid organization status payload' },
      { status: 400 },
    );
  }

  try {
    const docRef = adminDb.collection('organizations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === 'approved') {
      updateData.approvedAt = FieldValue.serverTimestamp();
      updateData.approvedBy = null;
    } else if (status !== 'approved') {
      updateData.approvedAt = null;
      updateData.approvedBy = null;
    }

    if (note && typeof note === 'string') {
      updateData['metadata.note'] = note.slice(0, 1000);
    }

    await docRef.update(updateData);

    // If organization is approved, activate all users in that organization
    if (status === 'approved') {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('organizationId', '==', id)
        .get();

      const batch = adminDb.batch();
      usersSnapshot.docs.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          status: 'active',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      if (!usersSnapshot.empty) {
        await batch.commit();
      }
    } else if (status === 'rejected' || status === 'suspended') {
      // If organization is rejected or suspended, set users to suspended
      const usersSnapshot = await adminDb
        .collection('users')
        .where('organizationId', '==', id)
        .get();

      const batch = adminDb.batch();
      usersSnapshot.docs.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          status: 'suspended',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      if (!usersSnapshot.empty) {
        await batch.commit();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating organization status:', error);
    return NextResponse.json(
      { error: 'Failed to update organization status' },
      { status: 500 },
    );
  }
}

