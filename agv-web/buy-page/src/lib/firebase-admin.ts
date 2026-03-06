// lib/firebase-admin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function must(name: string, v?: string | null) {
  if (!v) throw new Error(`Missing server env: ${name}`);
  return v;
}

function normalizePrivateKey(raw: string) {
  // Remove accidental wrapping quotes and restore newlines
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId: must("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
      clientEmail: must("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL),
      privateKey: normalizePrivateKey(must("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY)),
    }),
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  });
} else {
  app = getApps()[0]!;
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);
