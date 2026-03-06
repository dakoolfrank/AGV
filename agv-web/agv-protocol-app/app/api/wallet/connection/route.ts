import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletExists, syncWalletFromConnections, categorizeWallet, getWallet, fullSyncWallet } from '@/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase().trim();
    
    // Validate address format
    if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Ensure wallet exists
    const wallet = await ensureWalletExists(normalizedAddress);
    const isFirstTime = !wallet.timestamps.firstConnected;

    // Update first connected if not set
    if (!wallet.timestamps.firstConnected) {
      await ensureWalletExists(normalizedAddress);
      const walletRef = require('@/lib/firebase-admin').adminDb.collection('wallets').doc(normalizedAddress);
      await walletRef.update({
        'timestamps.firstConnected': Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // Sync from existing connections
    try {
      await syncWalletFromConnections(normalizedAddress);
    } catch (syncError) {
      console.error('Error syncing from connections:', syncError);
      // Continue even if sync fails
    }

    // Sync whitelist status
    try {
      const { syncWalletFromWhitelists } = require('@/lib/wallet-management');
      await syncWalletFromWhitelists(normalizedAddress);
    } catch (syncError) {
      console.error('Error syncing from whitelists:', syncError);
    }

    // Get updated wallet and categorize
    const updatedWallet = await fullSyncWallet(normalizedAddress);
    
    // Ensure activation logic is applied: if connected but not whitelisted, activate
    // This handles: "Activated wallets are any wallet that connects to the dApp, that we do not have in our wallet list"
    if (updatedWallet.timestamps.firstConnected && !updatedWallet.status.isWhitelisted && !updatedWallet.status.isActivated) {
      const { Timestamp } = require('firebase-admin/firestore');
      const walletRef = require('@/lib/firebase-admin').adminDb.collection('wallets').doc(normalizedAddress);
      await walletRef.update({
        'status.isActivated': true,
        'timestamps.activatedAt': updatedWallet.timestamps.activatedAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      updatedWallet.status.isActivated = true;
      if (!updatedWallet.timestamps.activatedAt) {
        updatedWallet.timestamps.activatedAt = Timestamp.now();
      }
    }
    
    try {
      await categorizeWallet(normalizedAddress, updatedWallet);
    } catch (categorizeError) {
      console.error('Error categorizing wallet:', categorizeError);
      // Continue even if categorization fails
    }

    return NextResponse.json({
      success: true,
      isFirstTime,
      wallet: {
        ...updatedWallet,
        timestamps: {
          firstConnected: updatedWallet.timestamps.firstConnected?.toDate?.()?.toISOString() || updatedWallet.timestamps.firstConnected,
          activatedAt: updatedWallet.timestamps.activatedAt?.toDate?.()?.toISOString() || updatedWallet.timestamps.activatedAt,
          claimedAt: updatedWallet.timestamps.claimedAt?.toDate?.()?.toISOString() || updatedWallet.timestamps.claimedAt,
          firstBuyAt: updatedWallet.timestamps.firstBuyAt?.toDate?.()?.toISOString() || updatedWallet.timestamps.firstBuyAt,
          firstStakeAt: updatedWallet.timestamps.firstStakeAt?.toDate?.()?.toISOString() || updatedWallet.timestamps.firstStakeAt,
        },
      },
    });
  } catch (error) {
    console.error('Error tracking wallet connection:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}









