import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Generate ticket ID in format: MIG-YYYYMMDD-HHMMSS
 */
function generateTicketId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `MIG-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * POST /api/migration-tickets
 * Create a new migration support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, oldBalance } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (oldBalance === undefined || oldBalance === null) {
      return NextResponse.json(
        { success: false, error: 'Old balance is required' },
        { status: 400 }
      );
    }

    // Validate balance > 0
    const balanceNumber = parseFloat(oldBalance);
    if (isNaN(balanceNumber) || balanceNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'Old balance must be greater than 0' },
        { status: 400 }
      );
    }

    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Generate ticket ID
    const ticketId = generateTicketId();

    // Create ticket document
    const timestamp = new Date().toISOString();
    const ticketData = {
      ticketId,
      walletAddress: normalizedAddress,
      oldBalance: balanceNumber,
      status: 'pending',
      createdAt: new Date(),
      timestamp,
    };

    // Save to Firestore
    await adminDb.collection('migration_tickets').add(ticketData);

    return NextResponse.json({
      success: true,
      ticketId,
      message: 'Migration ticket created successfully',
    });
  } catch (error) {
    console.error('Error creating migration ticket:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migration-tickets?walletAddress=0x...
 * Get migration tickets for a wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // Query tickets for this wallet
    const ticketsQuery = await adminDb
      .collection('migration_tickets')
      .where('walletAddress', '==', normalizedAddress)
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = ticketsQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ticketId: data.ticketId,
        walletAddress: data.walletAddress,
        oldBalance: data.oldBalance,
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.timestamp,
      };
    });

    return NextResponse.json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error('Error fetching migration tickets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

