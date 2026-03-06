import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting KOL status synchronization fix...');

    // Get all approved contributor applications
    const approvedAppsQuery = await adminDb.collection('contributor_applications')
      .where('status', '==', 'approved')
      .get();

    console.log(`📋 Found ${approvedAppsQuery.docs.length} approved contributor applications`);

    let fixedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const appDoc of approvedAppsQuery.docs) {
      const appData = appDoc.data();
      const appId = appDoc.id;
      const kolId = appData.kolId;

      if (!kolId) {
        console.log(`⚠️  Application ${appId} (${appData.identity?.displayName}) has no KOL ID, skipping`);
        continue;
      }

      try {
        // Check the current KOL profile status
        const kolDoc = await adminDb.collection('kol_profiles').doc(kolId).get();
        
        if (!kolDoc.exists) {
          console.log(`⚠️  KOL profile ${kolId} not found for application ${appId}, skipping`);
          continue;
        }

        const kolData = kolDoc.data();
        
        if (kolData?.status === 'pending') {
          // Update the KOL profile status to active
          await adminDb.collection('kol_profiles').doc(kolId).update({
            status: 'active',
            updatedAt: new Date()
          });

          const result = {
            type: 'contributor',
            appId,
            kolId,
            displayName: appData.identity?.displayName || 'Unknown',
            email: appData.identity?.email || 'Unknown',
            status: 'fixed'
          };
          
          console.log(`✅ Fixed: ${result.displayName} (${result.email}) - KOL ${kolId} status updated to active`);
          results.push(result);
          fixedCount++;
        } else {
          console.log(`ℹ️  KOL ${kolId} for ${appData.identity?.displayName} already has status: ${kolData?.status}`);
        }
      } catch (error) {
        console.error(`❌ Error updating KOL ${kolId} for application ${appId}:`, error);
        errorCount++;
        results.push({
          type: 'contributor',
          appId,
          kolId,
          displayName: appData.identity?.displayName || 'Unknown',
          email: appData.identity?.email || 'Unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Also check institutional applications
    const approvedInstitutionalAppsQuery = await adminDb.collection('institutional_applications')
      .where('status', '==', 'approved')
      .get();

    console.log(`📋 Found ${approvedInstitutionalAppsQuery.docs.length} approved institutional applications`);

    for (const appDoc of approvedInstitutionalAppsQuery.docs) {
      const appData = appDoc.data();
      const appId = appDoc.id;
      const kolId = appData.kolId;

      if (!kolId) {
        continue; // Institutional apps might not have KOL IDs
      }

      try {
        // Check the current KOL profile status
        const kolDoc = await adminDb.collection('kol_profiles').doc(kolId).get();
        
        if (!kolDoc.exists) {
          continue;
        }

        const kolData = kolDoc.data();
        
        if (kolData?.status === 'pending') {
          // Update the KOL profile status to active
          await adminDb.collection('kol_profiles').doc(kolId).update({
            status: 'active',
            updatedAt: new Date()
          });

          const result = {
            type: 'institutional',
            appId,
            kolId,
            displayName: appData.organizationName || 'Unknown',
            email: appData.contactEmail || 'Unknown',
            status: 'fixed'
          };
          
          console.log(`✅ Fixed: Institutional application ${appId} - KOL ${kolId} status updated to active`);
          results.push(result);
          fixedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating KOL ${kolId} for institutional application ${appId}:`, error);
        errorCount++;
        results.push({
          type: 'institutional',
          appId,
          kolId,
          displayName: appData.organizationName || 'Unknown',
          email: appData.contactEmail || 'Unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Synchronization fix completed!`);
    console.log(`✅ Fixed: ${fixedCount} KOL profiles`);
    console.log(`❌ Errors: ${errorCount} profiles`);

    return NextResponse.json({
      success: true,
      message: 'KOL status synchronization completed',
      summary: {
        totalProcessed: approvedAppsQuery.docs.length + approvedInstitutionalAppsQuery.docs.length,
        fixed: fixedCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    console.error('💥 Fatal error during synchronization fix:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fix KOL status synchronization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
