// Load environment variables FIRST using require (synchronous, before ES module imports)
// This ensures env vars are loaded before any modules that use them are evaluated
const path = require('path');
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
import { adminAuth, adminDb } from '../lib/firebaseAdmin';

/**
 * Check if a user has admin claims
 */
function isAdminClaim(user: any): boolean {
  const claims = user.customClaims || {};
  const roles: string[] = Array.isArray(claims.roles) ? claims.roles : [];
  const role: string | undefined = claims.role;
  return claims.admin === true || role === 'admin' || roles.includes('admin');
}

/**
 * Convert all admins to super admins
 * This will:
 * 1. Find all users with admin claims in Firebase Auth
 * 2. Add their emails to the authorized_admin_emails collection
 * 3. Add their emails to the superadmins collection
 */
async function convertAdminsToSuperAdmins() {
  try {
    console.log('Starting conversion of admins to super admins...\n');

    // Get all users from Firebase Auth
    console.log('Fetching all users from Firebase Auth...');
    const allAdmins: Array<{ uid: string; email: string | undefined; claims: any }> = [];
    let nextPageToken: string | undefined;

    do {
      const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
      
      for (const user of listUsersResult.users) {
        if (isAdminClaim(user)) {
          const email = user.email;
          if (email) {
            allAdmins.push({
              uid: user.uid,
              email: email.toLowerCase(),
              claims: user.customClaims || {},
            });
          } else {
            console.warn(`  ⚠️  User ${user.uid} has admin claims but no email address`);
          }
        }
      }

      nextPageToken = listUsersResult.pageToken;
      console.log(`  Processed ${listUsersResult.users.length} users, found ${allAdmins.length} admins so far...`);
    } while (nextPageToken);

    console.log(`\n✅ Found ${allAdmins.length} admin users\n`);

    if (allAdmins.length === 0) {
      console.log('No admin users found. Nothing to convert.');
      return;
    }

    // Process each admin
    let processed = 0;
    let errors = 0;
    const now = new Date().toISOString();

    for (const admin of allAdmins) {
      try {
        const email = admin.email.toLowerCase();
        console.log(`Processing: ${email}`);

        // Add to authorized_admin_emails collection
        const authorizedEmailRef = adminDb.collection('authorized_admin_emails').doc(email);
        const authorizedEmailDoc = await authorizedEmailRef.get();
        
        if (!authorizedEmailDoc.exists) {
          await authorizedEmailRef.set({
            authorized: true,
            addedAt: now,
            addedBy: 'system-script',
            note: 'Converted from admin to super admin',
          });
          console.log(`  ✅ Added to authorized_admin_emails`);
        } else {
          const existing = authorizedEmailDoc.data();
          if (existing?.authorized !== true) {
            await authorizedEmailRef.update({
              authorized: true,
              updatedAt: now,
              updatedBy: 'system-script',
            });
            console.log(`  ✅ Updated authorized_admin_emails (was not authorized)`);
          } else {
            console.log(`  ℹ️  Already in authorized_admin_emails`);
          }
        }

        // Add to superadmins collection
        const superAdminRef = adminDb.collection('superadmins').doc(email);
        const superAdminDoc = await superAdminRef.get();
        
        if (!superAdminDoc.exists) {
          await superAdminRef.set({
            email: email,
            wallet: null,
            note: 'Converted from admin to super admin',
            addedAt: now,
          });
          console.log(`  ✅ Added to superadmins`);
        } else {
          console.log(`  ℹ️  Already in superadmins`);
        }

        processed++;
      } catch (error) {
        console.error(`  ❌ Error processing ${admin.email}:`, error);
        errors++;
      }
    }

    console.log(`\n✅ Conversion completed!`);
    console.log(`   Processed: ${processed} admins`);
    console.log(`   Errors: ${errors} admins`);

    // Verify conversion
    console.log(`\n📊 Verification:`);
    const [authorizedCount, superAdminCount] = await Promise.all([
      adminDb.collection('authorized_admin_emails').where('authorized', '==', true).count().get(),
      adminDb.collection('superadmins').count().get(),
    ]);

    console.log(`   Authorized admin emails: ${authorizedCount.data().count}`);
    console.log(`   Super admins: ${superAdminCount.data().count}`);

    if (errors > 0) {
      console.log(`\n⚠️  Some admins encountered errors during conversion.`);
    }

  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

// Run conversion if this script is executed directly
if (require.main === module) {
  convertAdminsToSuperAdmins()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { convertAdminsToSuperAdmins };
