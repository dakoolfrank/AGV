// Load environment variables FIRST using require (synchronous, before ES module imports)
// This ensures env vars are loaded before any modules that use them are evaluated
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { config } = require('dotenv');

// Load .env from project root
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
const result = config({ path: envPath });

if (result.error) {
  console.warn('Warning: Could not load .env file:', result.error.message);
  // Try loading from current working directory as fallback
  config();
} else {
  console.log('Successfully loaded .env file');
  console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Found' : 'Missing');
}

// Also try .env.local if it exists
const envLocalPath = path.resolve(process.cwd(), '.env.local');
config({ path: envLocalPath, override: false });

// Now safe to import modules that use environment variables
import { promises as fs } from 'fs';
import { adminDb } from '../lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ensureWalletExists, syncWalletFromWhitelists, syncWalletFromUsers, syncWalletFromConnections, syncWalletFromEvents, categorizeWallet, getWallet } from '../lib/wallet-management';

interface CsvRow {
  wallet: string;
  total_tx: string;
  avg_age: string;
  total_balance: string;
  chains_used: string;
  tier: string;
}

async function migrateWalletsToFirebase() {
  try {
    console.log('Starting wallet migration to Firebase...');
    
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'wallets_all.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const rows: CsvRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= 6 && values[0].startsWith('0x')) {
        rows.push({
          wallet: values[0].trim(),
          total_tx: values[1].trim(),
          avg_age: values[2].trim(),
          total_balance: values[3].trim(),
          chains_used: values[4].trim(),
          tier: values[5].trim(),
        });
      }
    }
    
    console.log(`Found ${rows.length} wallets to migrate`);
    
    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    let errors = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)} of ${rows.length})...`);
      
      for (const row of batch) {
        try {
          const address = row.wallet.toLowerCase().trim();
          
          // Upsert: Create wallet with metadata if new, or update if exists
          const existingWallet = await ensureWalletExists(address, {
            total_tx: parseFloat(row.total_tx) || 0,
            avg_age: parseFloat(row.avg_age) || 0,
            total_balance: parseFloat(row.total_balance) || 0,
            chains_used: parseInt(row.chains_used) || 0,
            tier: row.tier || 'Tier 3',
          });
          
          // All wallets in wallets_all.csv are whitelisted - upsert whitelist status
          // Update whitelist status regardless of whether wallet was just created or already existed
          const walletRef = adminDb.collection('wallets').doc(address);
          const updates: Record<string, unknown> = {
            'whitelistInfo.inMintingWhitelist': true,
            'status.isWhitelisted': true,
            updatedAt: Timestamp.now(),
            lastSyncedAt: Timestamp.now(),
          };
          
          // Only set whitelistedAt if not already set (preserve existing timestamp)
          if (!existingWallet.whitelistInfo.whitelistedAt) {
            updates['whitelistInfo.whitelistedAt'] = Timestamp.now();
          }
          
          await walletRef.update(updates);
          
          // Upsert: Ensure wallet is in whitelisted_wallets collection
          // Use document ID as address for efficient lookup
          const whitelistDocRef = adminDb.collection('whitelisted_wallets').doc(address);
          const whitelistDoc = await whitelistDocRef.get();
          
          if (!whitelistDoc.exists) {
            await whitelistDocRef.set({
              address: address,
              addedAt: Timestamp.now(),
              source: 'WALLETS_ALL_CSV_MIGRATION',
            });
          }
          
          // Sync from existing collections (handle index errors gracefully)
          // Helper function to check if error is a missing index error
          const isIndexError = (err: unknown): boolean => {
            const error = err as { code?: number; message?: string; details?: string };
            return (error?.code === 9) || 
                   (error?.message?.includes('requires an index') ?? false) || 
                   (error?.details?.includes('requires an index') ?? false);
          };
          
          const syncPromises = [
            syncWalletFromWhitelists(address).catch(err => {
              if (isIndexError(err)) {
                // Index missing - log but continue
                console.warn(`  ⚠️  Index missing for whitelist sync (wallet: ${address.substring(0, 10)}...)`);
              } else {
                throw err;
              }
            }),
            syncWalletFromUsers(address).catch(err => {
              if (isIndexError(err)) {
                console.warn(`  ⚠️  Index missing for user sync (wallet: ${address.substring(0, 10)}...)`);
              } else {
                throw err;
              }
            }),
            syncWalletFromConnections(address).catch(err => {
              if (isIndexError(err)) {
                // Index missing - this is expected if indexes aren't created yet
                // Silently continue, the wallet will be created but connection data won't sync
              } else {
                throw err;
              }
            }),
            syncWalletFromEvents(address).catch(err => {
              if (isIndexError(err)) {
                // Index missing - this is expected if indexes aren't created yet
                // Silently continue, the wallet will be created but event data won't sync
              } else {
                throw err;
              }
            }),
          ];
          
          await Promise.all(syncPromises);
          
          // Get wallet and categorize
          const wallet = await getWallet(address);
          if (wallet) {
            await categorizeWallet(address, wallet);
          }
          
          processed++;
          
          if (processed % 50 === 0) {
            console.log(`  Processed ${processed} wallets...`);
          }
        } catch (error) {
          console.error(`Error processing wallet ${row.wallet}:`, error);
          errors++;
        }
      }
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + BATCH_SIZE < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`   Processed: ${processed} wallets`);
    console.log(`   Errors: ${errors} wallets`);
    
    if (errors > 0) {
      console.log(`\n⚠️  Note: Some wallets encountered errors.`);
      console.log(`   If you saw "requires an index" errors, you need to create Firestore composite indexes:`);
      console.log(`   1. wallet_connections: walletAddress (Ascending) + timestamp (Ascending)`);
      console.log(`   2. purchase_events: wallet (Ascending) + timestamp (Ascending)`);
      console.log(`   3. staking_events: walletAddress (Ascending) + timestamp (Ascending)`);
      console.log(`   After creating indexes, re-run the migration to sync connection and event data.`);
    }
    
    // Verify migration
    const snapshot = await adminDb.collection('wallets').limit(10).get();
    console.log(`\n✅ Verification: Sample of ${snapshot.size} wallets in Firebase collection`);
    
    // Show stats
    const [whitelistedActivated, whitelistedNotActivated, activatedNotWhitelisted] = await Promise.all([
      adminDb.collection('whitelisted_activated').count().get(),
      adminDb.collection('whitelisted_not_activated').count().get(),
      adminDb.collection('activation_not_whitelisted').count().get(),
    ]);
    
    console.log(`\n📊 Helper Collections:`);
    console.log(`   Whitelisted + Activated: ${whitelistedActivated.data().count}`);
    console.log(`   Whitelisted + Not Activated: ${whitelistedNotActivated.data().count}`);
    console.log(`   Activated + Not Whitelisted: ${activatedNotWhitelisted.data().count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateWalletsToFirebase()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateWalletsToFirebase };

