import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { validateWorkEmail } from '@/lib/email-validation';
import { validatePasswordStrength } from '@/lib/password-validation';

interface RegistrationPayload {
  organizationName?: string;
  workEmail?: string;
  password?: string;
  contactName?: string;
  message?: string;
}

const MAX_MESSAGE_LENGTH = 1000;
const MIN_ORG_NAME_LENGTH = 2;

async function isDomainAlreadyRegistered(domain: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection('organizations')
    .where('domain', '==', domain.toLowerCase())
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function userExists(email: string): Promise<boolean> {
  try {
    await adminAuth.getUserByEmail(email);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegistrationPayload;
    const organizationName = body.organizationName?.trim();
    const workEmail = body.workEmail?.trim().toLowerCase();
    const password = body.password;
    const contactName = body.contactName?.trim();
    const message = body.message?.trim();

    if (!organizationName || organizationName.length < MIN_ORG_NAME_LENGTH) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 },
      );
    }

    if (!workEmail) {
      return NextResponse.json(
        { error: 'Work email is required' },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 },
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      );
    }

    // Validate email
    const emailValidation = validateWorkEmail(workEmail);
    if (!emailValidation.valid || !emailValidation.domain) {
      return NextResponse.json(
        { error: emailValidation.reason ?? 'Invalid work email' },
        { status: 400 },
      );
    }

    // Check if user already exists (one account per email)
    const userAlreadyExists = await userExists(workEmail);
    if (userAlreadyExists) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in instead.' },
        { status: 409 },
      );
    }

    // Check if domain already registered (one account per organization)
    const domainAlreadyRegistered = await isDomainAlreadyRegistered(emailValidation.domain);
    if (domainAlreadyRegistered) {
      return NextResponse.json(
        { error: 'An organization with this email domain already exists. Please contact your organization administrator for access.' },
        { status: 409 },
      );
    }

    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be fewer than ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Create Firebase Auth user
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email: workEmail,
        password: password,
        emailVerified: false, // Will be verified later
      });
    } catch (error: unknown) {
      console.error('Firebase Auth user creation error:', error);
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'auth/email-already-exists') {
          return NextResponse.json(
            { error: 'An account with this email already exists' },
            { status: 409 },
          );
        }
      }
      throw error;
    }

    const now = FieldValue.serverTimestamp();
    
    // Create organization record
    const organizationRecord = {
      name: organizationName,
      domain: emailValidation.domain,
      primaryEmail: workEmail,
      contactName: contactName ?? null,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
      metadata: {
        message: message ?? null,
      },
    };

    const orgDocRef = await adminDb.collection('organizations').add(organizationRecord);

    // Create user record
    const userRecord = {
      email: workEmail,
      organizationId: orgDocRef.id,
      organizationName: organizationName,
      role: 'org_admin' as const,
      status: 'pending_verification' as const,
      createdAt: now,
      metadata: {
        name: contactName ?? null,
      },
    };

    await adminDb.collection('users').doc(firebaseUser.uid).set(userRecord);

    return NextResponse.json(
      {
        message: 'Account created successfully. Your organization registration is pending approval.',
        organizationId: orgDocRef.id,
        userId: firebaseUser.uid,
        status: 'pending',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Organization registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 },
    );
  }
}

