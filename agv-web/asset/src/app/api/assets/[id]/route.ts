import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if the requester is authorized for admin access
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const doc = await adminDb.collection('asset_submissions').doc(id).get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Asset submission not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: doc.id,
      ...doc.data()
    });
  } catch (error) {
    console.error('Error fetching asset submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset submission' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if the requester is authorized for admin access
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const updateData = await request.json();
    
    await adminDb.collection('asset_submissions').doc(id).update({
      ...updateData,
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Asset submission updated successfully'
    });
  } catch (error) {
    console.error('Error updating asset submission:', error);
    return NextResponse.json(
      { error: 'Failed to update asset submission' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if the requester is authorized for admin access
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    await adminDb.collection('asset_submissions').doc(id).delete();
    
    return NextResponse.json({
      success: true,
      message: 'Asset submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset submission:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset submission' },
      { status: 500 }
    );
  }
}
