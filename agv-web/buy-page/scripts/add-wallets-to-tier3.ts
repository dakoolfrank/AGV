import 'dotenv/config';
import { adminDb } from '../src/lib/firebase-admin';
import { ensureWalletExists } from '../src/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

interface WalletEntry {
  sn: string;
  username: string;
  wallet: string;
}

function parseCSV(filePath: string): WalletEntry[] {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const lines = csvContent.split('\n');
  const entries: WalletEntry[] = [];

  // Skip header, process each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip empty lines or lines with only commas
    if (!line || line === ',' || line === ',,' || line === ',,,') continue;
    
    // Split by comma and clean up
    const parts = line.split(',').map(p => p.trim()).filter(p => p !== '');
    if (parts.length < 3) continue;
    
    const wallet = parts[2].trim();
    // Skip empty wallet addresses
    if (!wallet || wallet === '') continue;
    
    // Validate wallet address format
    // Ethereum addresses start with 0x and are 42 chars, or other valid crypto addresses
    const isValidEth = wallet.startsWith('0x') && wallet.length === 42;
    const isValidOther = wallet.match(/^[A-Za-z0-9]{26,44}$/); // Solana, etc.
    
    if (!isValidEth && !isValidOther) {
      console.warn(`  ⚠️  Skipping invalid wallet address: ${wallet}`);
      continue;
    }
    
    entries.push({
      sn: parts[0].trim(),
      username: parts[1].trim(),
      wallet: wallet
    });
  }

  return entries;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

async function addWalletsToTier3() {
  console.log('🚀 Starting wallet import to Tier 3...\n');

  // Read both CSV files
  const csv1Path = path.join(process.cwd(), 'allwalletsPREGVTCAMPAIGN-1.csv');
  const csv2Path = path.join(process.cwd(), 'PREGVT CAMPAIGN.csv');

  if (!fs.existsSync(csv1Path)) {
    throw new Error(`File not found: ${csv1Path}`);
  }
  if (!fs.existsSync(csv2Path)) {
    throw new Error(`File not found: ${csv2Path}`);
  }

  console.log('📖 Reading CSV files...');
  const entries1 = parseCSV(csv1Path);
  const entries2 = parseCSV(csv2Path);
  
  console.log(`  - allwalletsPREGVTCAMPAIGN-1.csv: ${entries1.length} entries`);
  console.log(`  - PREGVT CAMPAIGN.csv: ${entries2.length} entries`);

  // Combine and deduplicate by wallet address
  const walletMap = new Map<string, WalletEntry>();
  
  for (const entry of [...entries1, ...entries2]) {
    const normalized = normalizeAddress(entry.wallet);
    if (!walletMap.has(normalized)) {
      walletMap.set(normalized, entry);
    }
  }

  const uniqueWallets = Array.from(walletMap.values());
  console.log(`\n📊 Total unique wallets: ${uniqueWallets.length}\n`);

  // Add wallets to Firestore
  console.log('💾 Adding wallets to Firestore...');
  let added = 0;
  let updated = 0;
  let errors = 0;
  const errorList: { wallet: string; error: string }[] = [];

  // Process in batches of 500 (Firestore batch limit)
  const batchSize = 500;

  for (let i = 0; i < uniqueWallets.length; i += batchSize) {
    const batch = uniqueWallets.slice(i, i + batchSize);
    const batchPromises = batch.map(async (entry) => {
      try {
        const normalizedAddress = normalizeAddress(entry.wallet);
        
        // Check if wallet already exists
        const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
        const walletSnap = await walletRef.get();
        const exists = walletSnap.exists;

        // Ensure wallet exists with Tier 3 metadata
        await ensureWalletExists(normalizedAddress, {
          tier: 'Tier 3'
        });

        // Explicitly update tier to Tier 3 (in case wallet already existed with different tier)
        await walletRef.update({
          'metadata.tier': 'Tier 3',
          updatedAt: Timestamp.now()
        });

        if (exists) {
          updated++;
        } else {
          added++;
        }
      } catch (error: unknown) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errorList.push({
          wallet: entry.wallet,
          error: errorMessage
        });
        console.error(`  ❌ Error processing ${entry.wallet}:`, errorMessage);
      }
    });

    await Promise.all(batchPromises);
    
    const processed = Math.min(i + batchSize, uniqueWallets.length);
    console.log(`  Progress: ${processed}/${uniqueWallets.length} wallets processed...`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Import Complete!');
  console.log('='.repeat(50));
  console.log(`📈 Statistics:`);
  console.log(`  - New wallets added: ${added}`);
  console.log(`  - Existing wallets updated: ${updated}`);
  console.log(`  - Errors: ${errors}`);
  console.log(`  - Total processed: ${added + updated + errors}`);
  
  if (errorList.length > 0) {
    console.log('\n❌ Errors encountered:');
    errorList.slice(0, 10).forEach(({ wallet, error }) => {
      console.log(`  - ${wallet}: ${error}`);
    });
    if (errorList.length > 10) {
      console.log(`  ... and ${errorList.length - 10} more errors`);
    }
    
    // Write errors to file
    const errorPath = path.join(process.cwd(), 'tier3-import-errors.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorList, null, 2));
    console.log(`\n📝 Full error list saved to: tier3-import-errors.json`);
  }

  console.log('\n✨ All wallets have been added to Tier 3!');
}

addWalletsToTier3()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

