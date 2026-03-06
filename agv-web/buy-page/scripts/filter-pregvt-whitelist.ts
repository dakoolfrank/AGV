import 'dotenv/config';
import { adminDb } from '../src/lib/firebase-admin';
import { ensureWalletExists, categorizeWallet, getWallet } from '../src/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

interface PregvtEntry {
  sn: string;
  username: string;
  wallet: string;
}

async function filterPregvtWhitelist() {
  console.log('Fetching existing whitelisted wallets from Firebase...');
  
  // Get all whitelisted wallets from Firebase
  const whitelistRef = adminDb.collection('buy_whitelisted_wallets');
  const snapshot = await whitelistRef.get();
  
  const existingWallets = new Set<string>();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.walletAddress) {
      existingWallets.add(data.walletAddress.toLowerCase().trim());
    }
  });
  
  console.log(`Found ${existingWallets.size} existing whitelisted wallets`);
  
  // Read PREGVT CAMPAIGN.csv
  const csvPath = path.join(process.cwd(), 'PREGVT CAMPAIGN.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  const newToWhitelist: PregvtEntry[] = [];
  const alreadyWhitelisted: PregvtEntry[] = [];
  
  // Skip header, process each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === ',,') continue;
    
    const parts = line.split(',');
    if (parts.length < 3) continue;
    
    const wallet = parts[2].trim();
    if (!wallet) continue;
    
    const entry: PregvtEntry = {
      sn: parts[0].trim(),
      username: parts[1].trim(),
      wallet: wallet
    };
    
    if (existingWallets.has(wallet.toLowerCase())) {
      alreadyWhitelisted.push(entry);
    } else {
      newToWhitelist.push(entry);
    }
  }
  
  // Write new entries to whitelist CSV
  const newCsvHeader = 'S/N,USERNAMES,WALLET ADDRESS\n';
  const newCsvContent = newCsvHeader + newToWhitelist.map((e, i) => 
    `${i + 1},${e.username},${e.wallet}`
  ).join('\n');
  
  fs.writeFileSync(
    path.join(process.cwd(), 'PREGVT_NEW_TO_WHITELIST.csv'),
    newCsvContent
  );
  
  // Write already whitelisted entries CSV
  const existingCsvContent = newCsvHeader + alreadyWhitelisted.map((e, i) => 
    `${i + 1},${e.username},${e.wallet}`
  ).join('\n');
  
  fs.writeFileSync(
    path.join(process.cwd(), 'PREGVT_ALREADY_WHITELISTED.csv'),
    existingCsvContent
  );
  
  console.log('\n=== Results ===');
  console.log(`Total PREGVT entries processed: ${newToWhitelist.length + alreadyWhitelisted.length}`);
  console.log(`Already whitelisted: ${alreadyWhitelisted.length}`);
  console.log(`New to whitelist: ${newToWhitelist.length}`);
  console.log('\nFiles created:');
  console.log('  - PREGVT_NEW_TO_WHITELIST.csv');
  console.log('  - PREGVT_ALREADY_WHITELISTED.csv');
  
  // Add new wallets to Firebase whitelist
  if (newToWhitelist.length > 0) {
    console.log('\nAdding new wallets to Firebase whitelist...');
    
    const batch = adminDb.batch();
    let batchCount = 0;
    let totalAdded = 0;
    let walletsUpdated = 0;
    
    for (const entry of newToWhitelist) {
      const normalizedWallet = entry.wallet.toLowerCase().trim();
      
      // Add to buy_whitelisted_wallets collection
      const docRef = whitelistRef.doc();
      batch.set(docRef, {
        walletAddress: normalizedWallet,
        username: entry.username,
        source: 'PREGVT_CAMPAIGN',
        addedAt: new Date().toISOString()
      });
      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount === 500) {
        await batch.commit();
        totalAdded += batchCount;
        console.log(`  Added ${totalAdded} wallets to buy_whitelisted_wallets...`);
        batchCount = 0;
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      totalAdded += batchCount;
    }
    
    console.log(`\n✅ Successfully added ${totalAdded} new wallets to buy_whitelisted_wallets!`);
    
    // Now sync to wallets collection
    console.log('\nSyncing to wallets collection...');
    const walletsBatch = adminDb.batch();
    let walletsBatchCount = 0;
    
    for (const entry of newToWhitelist) {
      const normalizedWallet = entry.wallet.toLowerCase().trim();
      
      try {
        // Ensure wallet exists in wallets collection
        const wallet = await ensureWalletExists(normalizedWallet);
        
        // Update whitelist status in wallets collection
        const walletRef = adminDb.collection('wallets').doc(normalizedWallet);
        const updates: any = {
          'whitelistInfo.inBuyWhitelist': true,
          'status.isWhitelisted': true,
          updatedAt: Timestamp.now(),
          lastSyncedAt: Timestamp.now(),
        };
        
        // Set whitelistedAt if not already set
        if (!wallet.whitelistInfo.whitelistedAt) {
          updates['whitelistInfo.whitelistedAt'] = Timestamp.now();
        }
        
        walletsBatch.update(walletRef, updates);
        walletsBatchCount++;
        walletsUpdated++;
        
        // Firestore batch limit is 500
        if (walletsBatchCount === 500) {
          await walletsBatch.commit();
          console.log(`  Updated ${walletsUpdated} wallets in wallets collection...`);
          walletsBatchCount = 0;
        }
      } catch (error) {
        console.error(`Error updating wallet ${normalizedWallet}:`, error);
      }
    }
    
    // Commit remaining wallet updates
    if (walletsBatchCount > 0) {
      await walletsBatch.commit();
    }
    
    console.log(`\n✅ Successfully updated ${walletsUpdated} wallets in wallets collection!`);
    
    // Re-categorize all affected wallets
    console.log('\nRe-categorizing wallets...');
    let categorized = 0;
    for (const entry of newToWhitelist) {
      try {
        const normalizedWallet = entry.wallet.toLowerCase().trim();
        const wallet = await getWallet(normalizedWallet);
        if (wallet) {
          await categorizeWallet(normalizedWallet, wallet);
          categorized++;
          
          if (categorized % 100 === 0) {
            console.log(`  Categorized ${categorized} wallets...`);
          }
        }
      } catch (error) {
        console.error(`Error categorizing wallet ${entry.wallet}:`, error);
      }
    }
    
    console.log(`\n✅ Successfully categorized ${categorized} wallets!`);
  }
}

filterPregvtWhitelist()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

