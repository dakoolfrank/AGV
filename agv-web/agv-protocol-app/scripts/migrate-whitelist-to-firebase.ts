import { promises as fs } from 'fs';
import path from 'path';
import { adminDb } from '../lib/firebase-admin';

async function migrateWhitelistToFirebase() {
  try {
    console.log('Starting whitelist migration to Firebase...');
    
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'Whitelist.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    
    // Parse CSV (simple format - one address per line)
    const addresses = csvContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('0x'))
      .map(address => address.toLowerCase());
    
    console.log(`Found ${addresses.length} addresses to migrate`);
    
    // Batch write to Firebase
    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit
    
    for (const address of addresses) {
      const docRef = adminDb.collection('whitelisted_wallets').doc();
      batch.set(docRef, {
        address: address.toLowerCase(),
        addedAt: new Date(),
        addedBy: 'migration',
        status: 'active'
      });
      
      batchCount++;
      
      // Commit batch when it reaches the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Migrated ${batchCount} addresses...`);
        batchCount = 0;
      }
    }
    
    // Commit remaining addresses
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Migrated final ${batchCount} addresses...`);
    }
    
    console.log(`✅ Successfully migrated ${addresses.length} addresses to Firebase`);
    
    // Verify migration
    const snapshot = await adminDb.collection('whitelisted_wallets').get();
    console.log(`✅ Verification: ${snapshot.size} addresses in Firebase collection`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateWhitelistToFirebase()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateWhitelistToFirebase };
