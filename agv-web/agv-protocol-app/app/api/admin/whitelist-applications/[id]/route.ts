import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action, reviewedBy } = await request.json();

    if (!action || !['approve', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "decline"' },
        { status: 400 }
      );
    }

    // Get the application
    const applicationRef = adminDb.collection('whitelist_applications').doc(id);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    const applicationData = applicationDoc.data()!;

    // Update application status
    await applicationRef.update({
      status: action === 'approve' ? 'approved' : 'declined',
      reviewedAt: new Date(),
      reviewedBy: reviewedBy || 'admin'
    });

    // If approved, add wallet to whitelisted_wallets collection
    if (action === 'approve') {
      // Check if wallet already exists in whitelisted_wallets
      const existingWallet = await adminDb.collection('whitelisted_wallets')
        .where('address', '==', applicationData.walletAddress.toLowerCase())
        .limit(1)
        .get();

      if (existingWallet.empty) {
        // Add to whitelisted_wallets
        await adminDb.collection('whitelisted_wallets').add({
          walletAddress: applicationData.walletAddress.toLowerCase(),
          addedAt: new Date(),
          addedBy: reviewedBy || 'admin',
          status: 'active',
          source: 'whitelist_application',
          applicationId: id
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Application ${action}d successfully`
    });

  } catch (error) {
    console.error('Error processing application:', error);
    return NextResponse.json(
      { error: 'Failed to process application' },
      { status: 500 }
    );
  }
}
