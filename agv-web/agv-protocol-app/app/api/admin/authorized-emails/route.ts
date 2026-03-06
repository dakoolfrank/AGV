import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, isAuthorizedAdminEmail } from "../_auth";

export async function GET(req: NextRequest) {
  try {
    // Check if the requester is authorized
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Only authorized admins can view authorized emails' }, { status: 403 });
    }

    // Get all authorized admin emails
    const snapshot = await adminDb.collection('authorized_admin_emails').get();
    const authorizedEmails = snapshot.docs.map(doc => ({
      email: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ authorizedEmails });

  } catch (error: unknown) {
    console.error('Error fetching authorized emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch authorized emails' }, 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if the requester is authorized
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Only authorized admins can manage authorized emails' }, { status: 403 });
    }

    const { email, authorized = true } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Add or update the authorized email
    await adminDb.collection('authorized_admin_emails').doc(email.toLowerCase()).set({
      authorized,
      addedBy: decoded.email,
      addedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: `Email ${authorized ? 'authorized' : 'unauthorized'}: ${email}`,
      email: email.toLowerCase(),
      authorized
    });

  } catch (error: unknown) {
    console.error('Error managing authorized email:', error);
    return NextResponse.json(
      { error: 'Failed to manage authorized email' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check if the requester is authorized
    const decoded = await requireAdmin(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAuthorized = await isAuthorizedAdminEmail(decoded.email);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Only authorized admins can remove authorized emails' }, { status: 403 });
    }

    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Remove the authorized email
    await adminDb.collection('authorized_admin_emails').doc(email.toLowerCase()).delete();

    return NextResponse.json({ 
      success: true, 
      message: `Email removed from authorized list: ${email}`,
      email: email.toLowerCase()
    });

  } catch (error: unknown) {
    console.error('Error removing authorized email:', error);
    return NextResponse.json(
      { error: 'Failed to remove authorized email' }, 
      { status: 500 }
    );
  }
}
