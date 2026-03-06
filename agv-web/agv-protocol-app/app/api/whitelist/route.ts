import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const snapshot = await adminDb.collection('whitelisted_wallets').get();
    const wallets = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        address: doc.data().walletAddress,
        addedAt: doc.data().addedAt,
        addedBy: doc.data().addedBy,
        status: doc.data().status || 'active',
      }
    }
     );
    
    return NextResponse.json({ wallets });
  } catch (error) {
    console.error('Error fetching whitelisted wallets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whitelisted wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address, addedBy } = await request.json();
    
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Check if wallet already exists
    const existingWallet = await adminDb.collection('whitelisted_wallets')
      .where('address', '==', address.toLowerCase())
      .limit(1)
      .get();

    if (!existingWallet.empty) {
      return NextResponse.json(
        { error: 'Wallet already whitelisted' },
        { status: 409 }
      );
    }

    // Add wallet to whitelist
    const docRef = await adminDb.collection('whitelisted_wallets').add({
      walletAddress: address.toLowerCase(),
      addedAt: new Date(),
      addedBy: addedBy || 'admin',
      status: 'active'
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      address: address.toLowerCase()
    });
  } catch (error) {
    console.error('Error adding wallet to whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to add wallet to whitelist' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find and delete wallet
    const walletQuery = await adminDb.collection('whitelisted_wallets')
      .where('address', '==', address.toLowerCase())
      .limit(1)
      .get();

    if (walletQuery.empty) {
      return NextResponse.json(
        { error: 'Wallet not found in whitelist' },
        { status: 404 }
      );
    }

    await walletQuery.docs[0].ref.delete();

    return NextResponse.json({
      success: true,
      message: 'Wallet removed from whitelist'
    });
  } catch (error) {
    console.error('Error removing wallet from whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to remove wallet from whitelist' },
      { status: 500 }
    );
  }
}
