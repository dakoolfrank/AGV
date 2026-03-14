import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function must(name: string, v?: string | null) {
  if (!v) throw new Error(`Missing server env: ${name}`);
  return v;
}

function normalizePrivateKey(raw: string) {
  // Remove accidental wrapping quotes and restore newlines
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

async function setupAuthorizedAdmins() {
  try {
    // Initialize Firebase Admin
    const app = initializeApp({
      credential: cert({
        projectId: must("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
        clientEmail: must("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: normalizePrivateKey(must("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY)),
      }),
    });

    const db = getFirestore(app);

    // List of authorized admin emails
    const authorizedEmails = [
      "frank@agvnexrur.ai",
      "superfrank@agvnexrur.ai",
      // Add more admin emails as needed
    ];

    console.log('Setting up authorized admin emails...');

    for (const email of authorizedEmails) {
      const docRef = db.collection('authorized_admin_emails').doc(email.toLowerCase());
      await docRef.set({
        email: email.toLowerCase(),
        authorized: true,
        createdAt: new Date(),
        createdBy: 'setup-script'
      });
      console.log(`✓ Authorized admin: ${email}`);
    }

    console.log(`\n✅ Successfully set up ${authorizedEmails.length} authorized admin emails`);
    console.log('You can now sign in with any of these emails to access the admin dashboard.');

  } catch (error) {
    console.error('❌ Error setting up authorized admins:', error);
    process.exit(1);
  }
}

// Run the setup
setupAuthorizedAdmins();
