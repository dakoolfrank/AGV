import 'dotenv/config';
import { adminDb } from '../src/lib/firebase-admin';
import { User } from '../src/lib/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Escape CSV field value
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Convert object to CSV row
 */
function objectToCsvRow(obj: Record<string, any>, headers: string[]): string {
  return headers.map(header => escapeCsvField(obj[header] ?? '')).join(',');
}

/**
 * Export all users that have claimed to CSV
 */
async function exportClaimedUsers() {
  console.log('🔍 Fetching all users that have claimed...');
  
  try {
    // Query all users where hasClaimed === true
    const usersSnapshot = await adminDb.collection('users')
      .where('hasClaimed', '==', true)
      .get();
    
    console.log(`✅ Found ${usersSnapshot.size} users that have claimed`);
    
    if (usersSnapshot.size === 0) {
      console.log('⚠️  No claimed users found. Exiting.');
      return;
    }
    
    // Convert to array of User objects
    const claimedUsers: User[] = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data() as User;
      claimedUsers.push(data);
    });
    
    // Sort by claimTime (most recent first), then by createdAt
    claimedUsers.sort((a, b) => {
      const aTime = a.claimTime ? new Date(a.claimTime).getTime() : 0;
      const bTime = b.claimTime ? new Date(b.claimTime).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime; // Descending
      }
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return bCreated - aCreated; // Descending
    });
    
    // Define CSV headers
    const headers = [
      'Address',
      'Claim Time',
      'Total Earned',
      'Redeemed Amount',
      'Accrued Amount',
      'Staked Amount',
      'Is Activated',
      'Activation Time',
      'Referrer Of',
      'Has Required NFTs',
      'Required NFT Types',
      'Created At',
      'Updated At',
      'Last Updated'
    ];
    
    // Generate CSV rows
    const csvRows: string[] = [headers.join(',')];
    
    for (const user of claimedUsers) {
      const row: Record<string, any> = {
        'Address': user.address,
        'Claim Time': user.claimTime || '',
        'Total Earned': user.totalEarned || 0,
        'Redeemed Amount': user.redeemedAmount || 0,
        'Accrued Amount': user.accruedAmount || 0,
        'Staked Amount': user.stakedAmount || 0,
        'Is Activated': user.isActivated ? 'Yes' : 'No',
        'Activation Time': user.activationTime || '',
        'Referrer Of': user.referrerOf || '',
        'Has Required NFTs': user.eligibility?.hasRequiredNfts ? 'Yes' : 'No',
        'Required NFT Types': user.eligibility?.requiredNftTypes?.join('; ') || '',
        'Created At': user.createdAt || '',
        'Updated At': user.updatedAt || '',
        'Last Updated': user.lastUpdated || ''
      };
      
      csvRows.push(objectToCsvRow(row, headers));
    }
    
    // Write to CSV file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `claimed-users-${timestamp}.csv`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, csvRows.join('\n'), 'utf-8');
    
    console.log('\n=== Export Summary ===');
    console.log(`✅ Successfully exported ${claimedUsers.length} claimed users`);
    console.log(`📄 File saved to: ${filename}`);
    console.log(`📊 Location: ${filepath}`);
    console.log('\n📋 CSV Columns:');
    headers.forEach((header, index) => {
      console.log(`   ${index + 1}. ${header}`);
    });
    
    // Additional statistics
    const activatedCount = claimedUsers.filter(u => u.isActivated).length;
    const withReferrerCount = claimedUsers.filter(u => u.referrerOf).length;
    const withStakedAmount = claimedUsers.filter(u => u.stakedAmount && u.stakedAmount > 0).length;
    
    console.log('\n📈 Statistics:');
    console.log(`   - Activated users: ${activatedCount} (${Math.round(activatedCount / claimedUsers.length * 100)}%)`);
    console.log(`   - Users with referrer: ${withReferrerCount} (${Math.round(withReferrerCount / claimedUsers.length * 100)}%)`);
    console.log(`   - Users with staked amount: ${withStakedAmount} (${Math.round(withStakedAmount / claimedUsers.length * 100)}%)`);
    
    const totalEarned = claimedUsers.reduce((sum, u) => sum + (u.totalEarned || 0), 0);
    const totalRedeemed = claimedUsers.reduce((sum, u) => sum + (u.redeemedAmount || 0), 0);
    const totalAccrued = claimedUsers.reduce((sum, u) => sum + (u.accruedAmount || 0), 0);
    
    console.log('\n💰 Totals:');
    console.log(`   - Total Earned: ${totalEarned.toLocaleString()}`);
    console.log(`   - Total Redeemed: ${totalRedeemed.toLocaleString()}`);
    console.log(`   - Total Accrued: ${totalAccrued.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error exporting claimed users:', error);
    throw error;
  }
}

// Run the script
exportClaimedUsers()
  .then(() => {
    console.log('\n✅ Export completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });



