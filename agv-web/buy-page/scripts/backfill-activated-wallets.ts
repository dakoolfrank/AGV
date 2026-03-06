import 'dotenv/config';
import { adminDb } from '../src/lib/firebase-admin';
import { ensureWalletExists, syncWalletFromWhitelists, categorizeWallet, getWallet, syncWalletFromConnections } from '../src/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Backfill script to fix activation status for existing wallets
 * 
 * This script:
 * 1. Finds all wallets in wallet_connections that are NOT in whitelist
 * 2. Sets isActivated = true for those wallets (per definition: "Activated wallets are any wallet that connects to the dApp, that we do not have in our wallet list")
 * 3. Re-categorizes all affected wallets
 */
async function backfillActivatedWallets() {
  console.log('Starting backfill of activated wallets...\n');

  // Get all wallet connections
  console.log('Fetching wallet connections...');
  const connectionsSnapshot = await adminDb.collection('wallet_connections').get();
  console.log(`Found ${connectionsSnapshot.size} wallet connections`);

  // Get all whitelisted wallets (from both collections)
  console.log('\nFetching whitelisted wallets...');
  const [buyWhitelistSnapshot, mintingWhitelistSnapshot] = await Promise.all([
    adminDb.collection('buy_whitelisted_wallets').get(),
    adminDb.collection('whitelisted_wallets').get(),
  ]);

  const whitelistedWallets = new Set<string>();
  buyWhitelistSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.walletAddress) {
      whitelistedWallets.add(data.walletAddress.toLowerCase().trim());
    }
  });
  mintingWhitelistSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.address) {
      whitelistedWallets.add(data.address.toLowerCase().trim());
    }
  });

  console.log(`Found ${whitelistedWallets.size} whitelisted wallets`);

  // Get unique wallet addresses from connections
  const connectedWallets = new Set<string>();
  connectionsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.walletAddress) {
      connectedWallets.add(data.walletAddress.toLowerCase().trim());
    }
  });

  console.log(`Found ${connectedWallets.size} unique connected wallets`);

  // Find wallets that are connected but NOT whitelisted
  const nonWhitelistedConnected = Array.from(connectedWallets).filter(
    (wallet) => !whitelistedWallets.has(wallet)
  );

  console.log(`\nFound ${nonWhitelistedConnected.length} connected wallets that are NOT whitelisted`);
  console.log('These wallets should be marked as activated...\n');

  // Process wallets in batches
  let processed = 0;
  let activated = 0;
  let alreadyActivated = 0;
  let needsUpdate = 0;
  let categorized = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const walletAddress of nonWhitelistedConnected) {
    try {
      // Ensure wallet exists
      const wallet = await ensureWalletExists(walletAddress);
      
      // Sync whitelist status to ensure it's up to date
      await syncWalletFromWhitelists(walletAddress);
      
      // Sync connections to ensure firstConnected is set
      await syncWalletFromConnections(walletAddress);
      
      // Get updated wallet
      const updatedWallet = await getWallet(walletAddress);
      if (!updatedWallet) {
        console.error(`Could not get wallet ${walletAddress}`);
        continue;
      }

      // Check if wallet should be activated (has connected but not whitelisted)
      const hasConnected = !!updatedWallet.timestamps.firstConnected;
      const isNotWhitelisted = !updatedWallet.status.isWhitelisted;
      const shouldBeActivated = hasConnected && isNotWhitelisted;

      if (shouldBeActivated) {
        if (updatedWallet.status.isActivated) {
          alreadyActivated++;
        } else {
          // Update activation status
          const walletRef = adminDb.collection('wallets').doc(walletAddress);
          const updates: any = {
            'status.isActivated': true,
            updatedAt: Timestamp.now(),
            lastSyncedAt: Timestamp.now(),
          };

          // Set activatedAt if not set
          if (!updatedWallet.timestamps.activatedAt) {
            updates['timestamps.activatedAt'] = updatedWallet.timestamps.firstConnected || Timestamp.now();
          }

          batch.update(walletRef, updates);
          batchCount++;
          needsUpdate++;
          activated++;

          // Firestore batch limit is 500
          if (batchCount === 500) {
            await batch.commit();
            console.log(`  Processed ${processed + 1}/${nonWhitelistedConnected.length} wallets, activated ${activated}...`);
            batchCount = 0;
            batch = adminDb.batch(); // Create new batch after commit
          }
        }
      }

      processed++;

      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${nonWhitelistedConnected.length} wallets...`);
      }
    } catch (error) {
      console.error(`Error processing wallet ${walletAddress}:`, error);
      processed++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Activation updates complete:`);
  console.log(`   - Processed: ${processed}`);
  console.log(`   - Newly activated: ${activated}`);
  console.log(`   - Already activated: ${alreadyActivated}`);

  // Re-categorize all affected wallets
  console.log('\nRe-categorizing wallets...');
  for (const walletAddress of nonWhitelistedConnected) {
    try {
      const wallet = await getWallet(walletAddress);
      if (wallet) {
        await categorizeWallet(walletAddress, wallet);
        categorized++;

        if (categorized % 100 === 0) {
          console.log(`  Categorized ${categorized} wallets...`);
        }
      }
    } catch (error) {
      console.error(`Error categorizing wallet ${walletAddress}:`, error);
    }
  }

  console.log(`\n✅ Categorization complete:`);
  console.log(`   - Categorized ${categorized} wallets`);

  console.log('\n=== Backfill Complete ===');
  console.log(`Total connected non-whitelisted wallets: ${nonWhitelistedConnected.length}`);
  console.log(`Wallets activated: ${activated}`);
  console.log(`Wallets already activated: ${alreadyActivated}`);
  console.log(`Wallets re-categorized: ${categorized}`);
}

backfillActivatedWallets()
  .then(() => {
    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  });

