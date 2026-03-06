import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(request: NextRequest) {
  try {
    const { appId, updates } = await request.json();
    
    if (!appId) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    // Add timestamp for update
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    // Update the document using Firebase Admin SDK (bypasses security rules)
    await adminDb.collection('contributor_applications').doc(appId).update(updateData);

    // If the application status is being updated to 'approved', also update the KOL profile status
    if (updates.status === 'approved') {
      try {
        // Get the application to find the associated KOL ID
        const appDoc = await adminDb.collection('contributor_applications').doc(appId).get();
        
        if (appDoc.exists) {
          const appData = appDoc.data();
          const kolId = appData?.kolId;
          
          if (kolId) {
            // Update the KOL profile status to 'active'
            await adminDb.collection('kol_profiles').doc(kolId).update({
              status: 'active',
              updatedAt: new Date()
            });
            
            console.log(`Updated KOL profile ${kolId} status to active`);
          }
        }
      } catch (kolUpdateError) {
        console.error('Error updating KOL profile status:', kolUpdateError);
        // Don't fail the entire request if KOL update fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Application updated successfully' 
    });

  } catch (error) {
    console.error('Error updating contributor application:', error);
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    );
  }
}
