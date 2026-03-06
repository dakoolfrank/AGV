#!/usr/bin/env tsx

/**
 * Script to set up authorized admin emails in Firestore for g3_funding
 * Usage: npx tsx scripts/setup-authorized-admins.ts <email1> <email2> ...
 * 
 * Example:
 * npx tsx scripts/setup-authorized-admins.ts admin@example.com superadmin@example.com
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function must(name: string, v?: string | null) {
  if (!v) throw new Error(`Missing server env: ${name}`);
  return v;
}

function normalizePrivateKey(raw: string) {
  // Remove accidental wrapping quotes and restore newlines
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

async function setupAuthorizedAdmins() {
  // Initialize Firebase Admin
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: must("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
        clientEmail: must("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL),
        privateKey: normalizePrivateKey(must("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY)),
      }),
    });
  }

  const db = getFirestore();
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log("Usage: npx tsx scripts/setup-authorized-admins.ts <email1> <email2> ...");
    console.log("Example: npx tsx scripts/setup-authorized-admins.ts admin@example.com superadmin@example.com");
    process.exit(1);
  }

  console.log(`Setting up authorized admin emails: ${emails.join(", ")}`);

  try {
    const batch = db.batch();
    
    for (const email of emails) {
      const emailLower = email.toLowerCase();
      const docRef = db.collection('authorized_admin_emails').doc(emailLower);
      
      batch.set(docRef, {
        authorized: true,
        addedBy: 'setup-script',
        addedAt: new Date().toISOString()
      });
      
      console.log(`✓ Added ${emailLower} to authorized admin emails`);
    }

    await batch.commit();
    console.log("✅ Successfully set up authorized admin emails!");
    
  } catch (error) {
    console.error("❌ Error setting up authorized admin emails:", error);
    process.exit(1);
  }
}

setupAuthorizedAdmins();

