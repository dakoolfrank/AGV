import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletExists, updateWalletStatus, syncWalletToUsers, categorizeWallet, getWallet, syncWalletFromUsers } from '@/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, discordVerified } = body;

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
    await ensureWalletExists(normalizedAddress);

    // Sync from users collection first to get latest Discord status
    try {
      await syncWalletFromUsers(normalizedAddress);
    } catch (syncError) {
      console.error('Error syncing from users:', syncError);
    }

    const wallet = await getWallet(normalizedAddress);
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Check if already activated
    if (wallet.status.isActivated) {
      return NextResponse.json({
        success: true,
        message: 'Wallet already activated',
        wallet: {
          ...wallet,
          timestamps: {
            firstConnected: wallet.timestamps.firstConnected?.toDate?.()?.toISOString() || wallet.timestamps.firstConnected,
            activatedAt: wallet.timestamps.activatedAt?.toDate?.()?.toISOString() || wallet.timestamps.activatedAt,
            claimedAt: wallet.timestamps.claimedAt?.toDate?.()?.toISOString() || wallet.timestamps.claimedAt,
            firstBuyAt: wallet.timestamps.firstBuyAt?.toDate?.()?.toISOString() || wallet.timestamps.firstBuyAt,
            firstStakeAt: wallet.timestamps.firstStakeAt?.toDate?.()?.toISOString() || wallet.timestamps.firstStakeAt,
          },
        },
      });
    }

    // Update activation status
    const now = Timestamp.now();
    await updateWalletStatus(normalizedAddress, {
      status: {
        ...wallet.status,
        isActivated: true,
      },
      timestamps: {
        ...wallet.timestamps,
        activatedAt: now,
      },
      bindings: {
        ...wallet.bindings,
        discordVerified: discordVerified !== undefined ? discordVerified : wallet.bindings.discordVerified,
      },
    });

    // Get updated wallet
    const updatedWallet = await getWallet(normalizedAddress);
    if (!updatedWallet) {
      return NextResponse.json(
        { success: false, error: 'Failed to update wallet' },
        { status: 500 }
      );
    }

    // Sync to users collection (bidirectional)
    try {
      await syncWalletToUsers(normalizedAddress, updatedWallet);
    } catch (syncError) {
      console.error('Error syncing to users:', syncError);
      // Continue even if sync fails
    }

    // Categorize wallet
    try {
      await categorizeWallet(normalizedAddress, updatedWallet);
    } catch (categorizeError) {
      console.error('Error categorizing wallet:', categorizeError);
      // Continue even if categorization fails
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet activated successfully',
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
    console.error('Error activating wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}











