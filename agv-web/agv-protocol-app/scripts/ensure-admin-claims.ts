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
function hasAdminClaims(claims: any): boolean {
  if (!claims) return false;
  const roles: string[] = Array.isArray(claims.roles) ? claims.roles : [];
  const role: string | undefined = claims.role;
  return claims.admin === true || role === 'admin' || roles.includes('admin');
}

/**
 * Ensure all authorized admins have Firebase Auth admin claims
 * This will:
 * 1. Find all emails in authorized_admin_emails collection with authorized: true
 * 2. For each email, check if the user exists in Firebase Auth
 * 3. If user exists but doesn't have admin claims, add them
 * 4. If user doesn't exist, create them with admin claims
 */
async function ensureAdminClaims() {
  try {
    console.log('Starting admin claims verification...\n');

    // Get all authorized admin emails from Firestore
    console.log('Fetching authorized admin emails from Firestore...');
    const authorizedEmailsSnapshot = await adminDb
      .collection('authorized_admin_emails')
      .where('authorized', '==', true)
      .get();

    const authorizedEmails = authorizedEmailsSnapshot.docs.map(doc => ({
      email: doc.id.toLowerCase(),
      data: doc.data(),
    }));

    console.log(`✅ Found ${authorizedEmails.length} authorized admin emails\n`);

    if (authorizedEmails.length === 0) {
      console.log('No authorized admin emails found. Nothing to process.');
      return;
    }

    // Process each authorized email
    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const { email, data } of authorizedEmails) {
      try {
        console.log(`Processing: ${email}`);

        let user;
        let userExists = false;

        // Try to get user by email
        try {
          user = await adminAuth.getUserByEmail(email);
          userExists = true;
          console.log(`  ✓ User exists in Firebase Auth`);
        } catch (err: any) {
          if (err?.code === 'auth/user-not-found') {
            // User doesn't exist, we'll create them
            console.log(`  ⚠️  User not found in Firebase Auth`);
          } else {
            throw err;
          }
        }

        // Get existing claims
        const existingClaims = user?.customClaims || {};
        const hasAdmin = hasAdminClaims(existingClaims);

        if (userExists && hasAdmin) {
          console.log(`  ℹ️  User already has admin claims - skipping`);
          skipped++;
          processed++;
          continue;
        }

        // Prepare new claims
        const rolesArr = Array.isArray(existingClaims.roles) 
          ? existingClaims.roles.map(String) 
          : [];
        
        const newClaims: Record<string, any> = {
          ...existingClaims,
          admin: true,
          role: 'admin',
          roles: Array.from(new Set([...rolesArr, 'admin'])),
        };

        if (userExists) {
          // Update existing user with admin claims
          await adminAuth.setCustomUserClaims(user.uid, newClaims);
          console.log(`  ✅ Added admin claims to existing user`);
          updated++;
        } else {
          // Create new user with admin claims
          user = await adminAuth.createUser({
            email: email,
            emailVerified: false,
            disabled: false,
          });
          await adminAuth.setCustomUserClaims(user.uid, newClaims);
          console.log(`  ✅ Created new user with admin claims`);
          created++;
        }

        processed++;
      } catch (error) {
        console.error(`  ❌ Error processing ${email}:`, error);
        errors++;
      }
    }

    console.log(`\n✅ Process completed!`);
    console.log(`   Total authorized emails: ${authorizedEmails.length}`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already had claims): ${skipped}`);
    console.log(`   Errors: ${errors}`);

    // Verification: Check how many users now have admin claims
    console.log(`\n📊 Verification:`);
    let adminUsersCount = 0;
    let nextPageToken: string | undefined;

    do {
      const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
      
      for (const user of listUsersResult.users) {
        if (hasAdminClaims(user.customClaims)) {
          adminUsersCount++;
        }
      }

      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`   Users with admin claims in Firebase Auth: ${adminUsersCount}`);
    console.log(`   Authorized emails in Firestore: ${authorizedEmails.length}`);

    if (errors > 0) {
      console.log(`\n⚠️  Some emails encountered errors during processing.`);
    }

    if (adminUsersCount < authorizedEmails.length) {
      console.log(`\n⚠️  Warning: Some authorized emails may not have corresponding Firebase Auth users.`);
      console.log(`   This could be due to:`);
      console.log(`   - Invalid email addresses`);
      console.log(`   - Users that were deleted from Firebase Auth`);
      console.log(`   - Processing errors`);
    }

  } catch (error) {
    console.error('❌ Process failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  ensureAdminClaims()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { ensureAdminClaims };
