/**
 * Migration script to convert existing KOL system to Social Mining Program
 * 
 * This script handles:
 * 1. Migrating existing contributor applications to KOL profiles
 * 2. Generating referral codes for existing KOLs
 * 3. Setting up initial reward ledgers
 * 4. Backfilling sponsor relationships where possible
 * 5. Creating initial global counters
 */

import { adminDb as db } from '../lib/firebase-admin';
import { ContributorApplication, KOLProfile, KOLRecruitment } from '../lib/types';
import { generateReferralCodes } from '../lib/rewards-engine';
import { v4 as uuidv4 } from 'uuid';

interface MigrationReport {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  summary: {
    pioneersCreated: number;
    ambassadorsCreated: number;
    partnersCreated: number;
    referralCodesGenerated: number;
    sponsorRelationshipsCreated: number;
  };
}

export class SocialMiningMigration {
  
  /**
   * Main migration function
   */
  static async migrate(): Promise<MigrationReport> {
    console.log('🚀 Starting Social Mining Program migration...');
    
    const report: MigrationReport = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      summary: {
        pioneersCreated: 0,
        ambassadorsCreated: 0,
        partnersCreated: 0,
        referralCodesGenerated: 0,
        sponsorRelationshipsCreated: 0
      }
    };
    
    try {
      // Step 1: Get all existing contributor applications
      console.log('📋 Fetching existing contributor applications...');
      const applications = await this.getExistingApplications();
      report.totalProcessed = applications.length;
      
      console.log(`Found ${applications.length} applications to migrate`);
      
      // Step 2: Migrate each application to KOL profile
      console.log('🔄 Converting applications to KOL profiles...');
      for (const app of applications) {
        try {
          const kolProfile = await this.convertApplicationToKOL(app);
          report.successful++;
          
          // Update summary counts
          switch (kolProfile.tier) {
            case 'pioneer':
              report.summary.pioneersCreated++;
              break;
            case 'ambassador':
              report.summary.ambassadorsCreated++;
              break;
            case 'partner':
              report.summary.partnersCreated++;
              break;
          }
          
          report.summary.referralCodesGenerated++;
          
          console.log(`✅ Migrated ${app.identity.displayName} (${kolProfile.tier})`);
          
        } catch (error) {
          report.failed++;
          report.errors.push({
            id: app.id || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          console.log(`❌ Failed to migrate ${app.identity?.displayName || 'unknown'}: ${error}`);
        }
      }
      
      // Step 3: Create sponsor relationships where possible
      console.log('🔗 Creating sponsor relationships...');
      const sponsorRelationships = await this.createSponsorRelationships();
      report.summary.sponsorRelationshipsCreated = sponsorRelationships;
      
      // Step 4: Initialize global counters
      console.log('📊 Initializing global counters...');
      await this.initializeGlobalCounters();
      
      // Step 5: Create initial reward ledgers
      console.log('💰 Creating initial reward ledgers...');
      await this.createInitialRewardLedgers();
      
      console.log('🎉 Migration completed successfully!');
      console.log(`✅ ${report.successful} successful, ❌ ${report.failed} failed`);
      
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    }
    
    return report;
  }
  
  /**
   * Get all existing contributor applications
   */
  private static async getExistingApplications(): Promise<ContributorApplication[]> {
    const snapshot = await db.collection('contributor_applications')
      .where('status', '==', 'approved')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ContributorApplication[];
  }
  
  /**
   * Convert a contributor application to a KOL profile
   */
  private static async convertApplicationToKOL(app: ContributorApplication): Promise<KOLProfile> {
    const kolId = uuidv4();
    const { userRef, kolRef } = generateReferralCodes(kolId);
    
    // Map old tier to new tier
    const tierMapping: Record<string, 'pioneer' | 'ambassador' | 'partner'> = {
      'airdrop_hunter': 'pioneer',
      'contributor': 'pioneer',
      'micro_kol': 'ambassador',
      'fund_partner': 'partner'
    };
    
    const newTier = tierMapping[app.tier] || 'pioneer';
    
    // Extract social media information
    const socials = app.channels.map(channel => ({
      platform: this.normalizePlatform(channel.platform),
      url: channel.url,
      username: this.extractUsername(channel.url, channel.platform),
      followers: channel.followers,
      verified: channel.verificationStatus === 'verified'
    }));
    
    // Determine sponsor relationship from referrals
    let sponsorRef: string | undefined;
    if (app.referrals?.referredByG3Partner && app.referrals?.referrerName) {
      // Try to find sponsor by name (this is best effort)
      sponsorRef = await this.findSponsorRefByName(app.referrals.referrerName);
    }
    
    const kolProfile: KOLProfile = {
      id: kolId,
      tier: newTier,
      status: 'active',
      refCode_user: userRef,
      refCode_kol: kolRef,
      sponsorRef,
      displayName: app.identity.displayName,
      email: app.identity.email,
      wallet: app.wallets[0]?.address || '',
      region: [app.identity.countryRegion],
      languages: app.identity.languages,
      socials,
      createdAt: app.createdAt,
      updatedAt: new Date(),
      lastActiveAt: app.updatedAt,
      campaign: 'G3'
    };
    
    // Save to new collection
    await db.collection('kol_profiles').doc(kolId).set({
      ...kolProfile,
      createdAt: kolProfile.createdAt,
      updatedAt: kolProfile.updatedAt,
      lastActiveAt: kolProfile.lastActiveAt
    });
    
    // Mark original application as migrated
    await db.collection('contributor_applications').doc(app.id!).update({
      migrated: true,
      migratedAt: new Date(),
      migratedToKolId: kolId
    });
    
    return kolProfile;
  }
  
  /**
   * Create sponsor relationships where possible
   */
  private static async createSponsorRelationships(): Promise<number> {
    const kolsWithSponsors = await db.collection('kol_profiles')
      .where('sponsorRef', '!=', null)
      .get();
    
    let relationshipsCreated = 0;
    
    for (const doc of kolsWithSponsors.docs) {
      const kol = doc.data() as KOLProfile;
      
      if (kol.sponsorRef) {
        // Find sponsor by refCode_kol
        const sponsorQuery = await db.collection('kol_profiles')
          .where('refCode_kol', '==', kol.sponsorRef)
          .limit(1)
          .get();
        
        if (!sponsorQuery.empty) {
          const sponsorDoc = sponsorQuery.docs[0];
          const sponsorKolId = sponsorDoc.id;
          
          const recruitment: KOLRecruitment = {
            id: uuidv4(),
            sponsorKolId,
            childKolId: kol.id,
            sponsorRef: kol.sponsorRef,
            childRef: kol.refCode_kol,
            timestamp: kol.createdAt,
            campaign: 'G3'
          };
          
          await db.collection('kol_recruits').doc(recruitment.id).set({
            ...recruitment,
            timestamp: recruitment.timestamp
          });
          
          relationshipsCreated++;
        }
      }
    }
    
    return relationshipsCreated;
  }
  
  /**
   * Initialize global counters
   */
  private static async initializeGlobalCounters(): Promise<void> {
    const counterRef = db.collection('global_counters').doc('G3_mints');
    
    // Check if counter already exists
    const existingCounter = await counterRef.get();
    
    if (!existingCounter.exists) {
      await counterRef.set({
        campaign: 'G3',
        totalMints: 0,
        totalValue: 0,
        last7Days: [],
        updatedAt: new Date()
      });
    }
  }
  
  /**
   * Create initial reward ledgers for all KOLs
   */
  private static async createInitialRewardLedgers(): Promise<void> {
    const kolsSnapshot = await db.collection('kol_profiles').get();
    const currentPeriod = this.getCurrentPeriod();
    
    for (const doc of kolsSnapshot.docs) {
      const kolId = doc.id;
      const ledgerRef = db.collection('rewards_ledger').doc(`${kolId}_${currentPeriod}`);
      
      // Check if ledger already exists
      const existingLedger = await ledgerRef.get();
      
      if (!existingLedger.exists) {
        await ledgerRef.set({
          id: `${kolId}_${currentPeriod}`,
          period: currentPeriod,
          kolId,
          ownPostReward: 0,
          ownMintsCommission: 0,
          l1OverrideCommission: 0,
          l2OverrideCommission: 0,
          totalEarned: 0,
          immediateAmount: 0,
          vestedAmount: 0,
          capApplied: false,
          calculatedAt: new Date(),
          campaign: 'G3'
        });
      }
    }
  }
  
  /**
   * Utility functions
   */
  private static normalizePlatform(platform: string): string {
    const platformMap: Record<string, string> = {
      'twitter.com': 'twitter',
      'x.com': 'twitter',
      't.me': 'telegram',
      'youtube.com': 'youtube',
      'instagram.com': 'instagram',
      'tiktok.com': 'tiktok',
      'linkedin.com': 'linkedin'
    };
    
    const normalized = platform.toLowerCase();
    return platformMap[normalized] || normalized;
  }
  
  private static extractUsername(url: string, platform: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extract username from path
      const match = pathname.match(/^\/([^\/\?]+)/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }
  
  private static async findSponsorRefByName(referrerName: string): Promise<string | undefined> {
    // This is a best-effort search by display name
    const query = await db.collection('kol_profiles')
      .where('displayName', '==', referrerName)
      .limit(1)
      .get();
    
    if (!query.empty) {
      const sponsor = query.docs[0].data() as KOLProfile;
      return sponsor.refCode_kol;
    }
    
    return undefined;
  }
  
  private static getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }
  
  /**
   * Rollback migration (use with caution)
   */
  static async rollback(): Promise<void> {
    console.log('⚠️  Starting migration rollback...');
    
    // Delete KOL profiles
    const kolsSnapshot = await db.collection('kol_profiles').get();
    for (const doc of kolsSnapshot.docs) {
      await doc.ref.delete();
    }
    
    // Delete KOL recruitments
    const recruitsSnapshot = await db.collection('kol_recruits').get();
    for (const doc of recruitsSnapshot.docs) {
      await doc.ref.delete();
    }
    
    // Delete reward ledgers
    const ledgersSnapshot = await db.collection('rewards_ledger').get();
    for (const doc of ledgersSnapshot.docs) {
      await doc.ref.delete();
    }
    
    // Reset migration flags on applications
    const appsSnapshot = await db.collection('contributor_applications')
      .where('migrated', '==', true)
      .get();
    
    for (const doc of appsSnapshot.docs) {
      await doc.ref.update({
        migrated: false,
        migratedAt: null,
        migratedToKolId: null
      });
    }
    
    console.log('✅ Rollback completed');
  }
  
  /**
   * Dry run migration (preview without making changes)
   */
  static async dryRun(): Promise<MigrationReport> {
    console.log('🔍 Running migration dry run...');
    
    const applications = await this.getExistingApplications();
    
    const report: MigrationReport = {
      totalProcessed: applications.length,
      successful: 0,
      failed: 0,
      errors: [],
      summary: {
        pioneersCreated: 0,
        ambassadorsCreated: 0,
        partnersCreated: 0,
        referralCodesGenerated: 0,
        sponsorRelationshipsCreated: 0
      }
    };
    
    // Analyze what would be migrated
    for (const app of applications) {
      const tierMapping: Record<string, 'pioneer' | 'ambassador' | 'partner'> = {
        'airdrop_hunter': 'pioneer',
        'contributor': 'pioneer',
        'micro_kol': 'ambassador',
        'fund_partner': 'partner'
      };
      
      const newTier = tierMapping[app.tier] || 'pioneer';
      
      switch (newTier) {
        case 'pioneer':
          report.summary.pioneersCreated++;
          break;
        case 'ambassador':
          report.summary.ambassadorsCreated++;
          break;
        case 'partner':
          report.summary.partnersCreated++;
          break;
      }
      
      report.summary.referralCodesGenerated++;
      report.successful++;
    }
    
    console.log('📊 Dry run results:');
    console.log(`- Total applications: ${report.totalProcessed}`);
    console.log(`- Pioneers: ${report.summary.pioneersCreated}`);
    console.log(`- Ambassadors: ${report.summary.ambassadorsCreated}`);
    console.log(`- Partners: ${report.summary.partnersCreated}`);
    
    return report;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      SocialMiningMigration.migrate()
        .then(report => {
          console.log('\n📊 Migration Report:');
          console.log(JSON.stringify(report, null, 2));
          process.exit(0);
        })
        .catch(error => {
          console.error('Migration failed:', error);
          process.exit(1);
        });
      break;
      
    case 'dry-run':
      SocialMiningMigration.dryRun()
        .then(report => {
          console.log('\n📊 Dry Run Report:');
          console.log(JSON.stringify(report, null, 2));
          process.exit(0);
        })
        .catch(error => {
          console.error('Dry run failed:', error);
          process.exit(1);
        });
      break;
      
    case 'rollback':
      console.log('⚠️  Are you sure you want to rollback? This will delete all Social Mining data.');
      console.log('Type "yes" to confirm:');
      
      process.stdin.once('data', (data) => {
        if (data.toString().trim() === 'yes') {
          SocialMiningMigration.rollback()
            .then(() => {
              console.log('Rollback completed');
              process.exit(0);
            })
            .catch(error => {
              console.error('Rollback failed:', error);
              process.exit(1);
            });
        } else {
          console.log('Rollback cancelled');
          process.exit(0);
        }
      });
      break;
      
    default:
      console.log('Usage: tsx migrate-to-social-mining.ts [migrate|dry-run|rollback]');
      process.exit(1);
  }
}
