#!/usr/bin/env tsx

/**
 * Script to fix KOL profile status synchronization issue
 * 
 * This script finds all approved applications where the KOL profile status
 * is still 'pending' and updates them to 'active'.
 */

import { adminDb } from '../lib/firebase-admin';

interface ContributorApplication {
  id: string;
  status: string;
  kolId?: string;
  identity: {
    displayName: string;
    email: string;
  };
}

interface KOLProfile {
  id: string;
  status: string;
  displayName: string;
  email: string;
}

async function fixKOLStatusSync() {
  console.log('🔍 Starting KOL status synchronization fix...\n');

  try {
    // Get all approved contributor applications
    const approvedAppsQuery = await adminDb.collection('contributor_applications')
      .where('status', '==', 'approved')
      .get();

    console.log(`📋 Found ${approvedAppsQuery.docs.length} approved contributor applications`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const appDoc of approvedAppsQuery.docs) {
      const appData = appDoc.data() as ContributorApplication;
      const appId = appDoc.id;
      const kolId = appData.kolId;

      if (!kolId) {
        console.log(`⚠️  Application ${appId} (${appData.identity.displayName}) has no KOL ID, skipping`);
        continue;
      }

      try {
        // Check the current KOL profile status
        const kolDoc = await adminDb.collection('kol_profiles').doc(kolId).get();
        
        if (!kolDoc.exists) {
          console.log(`⚠️  KOL profile ${kolId} not found for application ${appId}, skipping`);
          continue;
        }

        const kolData = kolDoc.data() as KOLProfile;
        
        if (kolData.status === 'pending') {
          // Update the KOL profile status to active
          await adminDb.collection('kol_profiles').doc(kolId).update({
            status: 'active',
            updatedAt: new Date()
          });

          console.log(`✅ Fixed: ${appData.identity.displayName} (${appData.identity.email}) - KOL ${kolId} status updated to active`);
          fixedCount++;
        } else {
          console.log(`ℹ️  KOL ${kolId} for ${appData.identity.displayName} already has status: ${kolData.status}`);
        }
      } catch (error) {
        console.error(`❌ Error updating KOL ${kolId} for application ${appId}:`, error);
        errorCount++;
      }
    }

    // Also check institutional applications
    const approvedInstitutionalAppsQuery = await adminDb.collection('institutional_applications')
      .where('status', '==', 'approved')
      .get();

    console.log(`\n📋 Found ${approvedInstitutionalAppsQuery.docs.length} approved institutional applications`);

    for (const appDoc of approvedInstitutionalAppsQuery.docs) {
      const appData = appDoc.data() as any;
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

        const kolData = kolDoc.data() as KOLProfile;
        
        if (kolData.status === 'pending') {
          // Update the KOL profile status to active
          await adminDb.collection('kol_profiles').doc(kolId).update({
            status: 'active',
            updatedAt: new Date()
          });

          console.log(`✅ Fixed: Institutional application ${appId} - KOL ${kolId} status updated to active`);
          fixedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating KOL ${kolId} for institutional application ${appId}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Synchronization fix completed!`);
    console.log(`✅ Fixed: ${fixedCount} KOL profiles`);
    console.log(`❌ Errors: ${errorCount} profiles`);
    
    if (fixedCount > 0) {
      console.log(`\n💡 The KOL profiles have been updated. Users should now see the correct status on their dashboards.`);
    }

  } catch (error) {
    console.error('💥 Fatal error during synchronization fix:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixKOLStatusSync()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { fixKOLStatusSync };
