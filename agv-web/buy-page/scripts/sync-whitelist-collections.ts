import 'dotenv/config';
import { adminDb } from '../src/lib/firebase-admin';
import { ensureWalletExists, syncWalletFromWhitelists, categorizeWallet, getWallet } from '../src/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Sync script to keep buy_whitelisted_wallets and wallets collections in sync
 * 
 * This script:
 * 1. Syncs buy_whitelisted_wallets → wallets (ensures all whitelisted wallets exist in wallets collection)
 * 2. Syncs wallets → buy_whitelisted_wallets (ensures wallets marked as inBuyWhitelist are in buy_whitelisted_wallets)
 * 3. Handles conflicts (buy_whitelisted_wallets is source of truth for whitelist status)
 */
async function syncWhitelistCollections() {
  console.log('Starting whitelist collection sync...\n');

  // Phase 1: Sync buy_whitelisted_wallets → wallets
  console.log('Phase 1: Syncing buy_whitelisted_wallets → wallets collection...');
  const buyWhitelistSnapshot = await adminDb.collection('buy_whitelisted_wallets').get();
  console.log(`Found ${buyWhitelistSnapshot.size} wallets in buy_whitelisted_wallets`);

  let syncedToWallets = 0;
  let updatedInWallets = 0;
  let batchCount = 0;
  let batch = adminDb.batch();

  for (const doc of buyWhitelistSnapshot.docs) {
    const data = doc.data();
    const walletAddress = data.walletAddress?.toLowerCase().trim();
    
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      continue;
    }

    // Ensure wallet exists in wallets collection
    const wallet = await ensureWalletExists(walletAddress);
    
    // Check if whitelist status needs updating
    const needsUpdate = 
      !wallet.whitelistInfo.inBuyWhitelist ||
      !wallet.status.isWhitelisted ||
      (!wallet.whitelistInfo.whitelistedAt && data.addedAt);

    if (needsUpdate) {
      const walletRef = adminDb.collection('wallets').doc(walletAddress);
      const updates: any = {
        'whitelistInfo.inBuyWhitelist': true,
        'status.isWhitelisted': true,
        updatedAt: Timestamp.now(),
        lastSyncedAt: Timestamp.now(),
      };

      // Set whitelistedAt if not set
      if (!wallet.whitelistInfo.whitelistedAt && data.addedAt) {
        updates['whitelistInfo.whitelistedAt'] = Timestamp.fromDate(new Date(data.addedAt));
      }

      batch.update(walletRef, updates);
      batchCount++;
      updatedInWallets++;

      // Firestore batch limit is 500
      if (batchCount === 500) {
        await batch.commit();
        console.log(`  Updated ${updatedInWallets} wallets in wallets collection...`);
        batchCount = 0;
        batch = adminDb.batch(); // Create new batch after commit
      }
    } else {
      syncedToWallets++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ Phase 1 Complete:`);
  console.log(`   - Already synced: ${syncedToWallets}`);
  console.log(`   - Updated in wallets: ${updatedInWallets}`);

  // Phase 2: Sync wallets → buy_whitelisted_wallets
  console.log('\nPhase 2: Syncing wallets → buy_whitelisted_wallets collection...');
  const walletsSnapshot = await adminDb.collection('wallets')
    .where('whitelistInfo.inBuyWhitelist', '==', true)
    .get();
  
  console.log(`Found ${walletsSnapshot.size} wallets marked as inBuyWhitelist`);

  // Get all existing buy_whitelisted_wallets addresses
  const existingBuyWhitelist = new Set<string>();
  buyWhitelistSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.walletAddress) {
      existingBuyWhitelist.add(data.walletAddress.toLowerCase().trim());
    }
  });

  let addedToBuyWhitelist = 0;
  let batchCount2 = 0;
  let batch2 = adminDb.batch();

  for (const doc of walletsSnapshot.docs) {
    const wallet = doc.data();
    const walletAddress = wallet.address?.toLowerCase().trim();

    if (!walletAddress || !walletAddress.startsWith('0x')) {
      continue;
    }

    // If wallet is marked as inBuyWhitelist but not in buy_whitelisted_wallets, add it
    if (!existingBuyWhitelist.has(walletAddress)) {
      const buyWhitelistRef = adminDb.collection('buy_whitelisted_wallets').doc();
      batch2.set(buyWhitelistRef, {
        walletAddress: walletAddress,
        username: wallet.bindings?.discordUsername || null,
        source: 'SYNC_FROM_WALLETS',
        addedAt: wallet.whitelistInfo?.whitelistedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
      batchCount2++;
      addedToBuyWhitelist++;

      // Firestore batch limit is 500
      if (batchCount2 === 500) {
        await batch2.commit();
        console.log(`  Added ${addedToBuyWhitelist} wallets to buy_whitelisted_wallets...`);
        batchCount2 = 0;
        batch2 = adminDb.batch(); // Create new batch after commit
      }
    }
  }

  // Commit remaining
  if (batchCount2 > 0) {
    await batch2.commit();
  }

  console.log(`✅ Phase 2 Complete:`);
  console.log(`   - Added to buy_whitelisted_wallets: ${addedToBuyWhitelist}`);

  // Phase 3: Re-categorize all affected wallets
  console.log('\nPhase 3: Re-categorizing wallets...');
  let categorized = 0;
  const allWallets = await adminDb.collection('wallets')
    .where('whitelistInfo.inBuyWhitelist', '==', true)
    .limit(1000)
    .get();

  for (const doc of allWallets.docs) {
    try {
      const wallet = await getWallet(doc.id);
      if (wallet) {
        await categorizeWallet(doc.id, wallet);
        categorized++;
        
        if (categorized % 100 === 0) {
          console.log(`  Categorized ${categorized} wallets...`);
        }
      }
    } catch (error) {
      console.error(`Error categorizing wallet ${doc.id}:`, error);
    }
  }

  console.log(`✅ Phase 3 Complete:`);
  console.log(`   - Categorized ${categorized} wallets`);

  console.log('\n=== Sync Complete ===');
  console.log(`Total wallets synced: ${syncedToWallets + updatedInWallets}`);
  console.log(`Wallets updated in wallets collection: ${updatedInWallets}`);
  console.log(`Wallets added to buy_whitelisted_wallets: ${addedToBuyWhitelist}`);
  console.log(`Wallets re-categorized: ${categorized}`);
}

syncWhitelistCollections()
  .then(() => {
    console.log('\n✅ Sync completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during sync:', error);
    process.exit(1);
  });

