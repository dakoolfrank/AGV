import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ensureWalletExists, syncWalletFromConnections, categorizeWallet, fullSyncWallet } from '@/lib/wallet-management';
import { Timestamp } from 'firebase-admin/firestore';
import { isWalletEarlyCircle } from '@/lib/early-circle-server-utils';
import { getAnalyticsMetadata } from '@/lib/analytics-utils';

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

    const normalizedAddress = walletAddress.toLowerCase();

    // Get analytics metadata (country, device, time-of-day)
    const analyticsMetadata = await getAnalyticsMetadata(request);

    // Check if this wallet has already been tracked (first-time only)
    const existingConnection = await adminDb
      .collection('wallet_connections')
      .where('walletAddress', '==', normalizedAddress)
      .limit(1)
      .get();

    const isFirstTime = existingConnection.empty;

    if (!existingConnection.empty) {
      // Already tracked, but still sync to wallets collection
      try {
        await ensureWalletExists(normalizedAddress);
        const wallet = await fullSyncWallet(normalizedAddress);
        await categorizeWallet(normalizedAddress, wallet);
      } catch (syncError) {
        console.error('Error syncing wallet (existing connection):', syncError);
        // Don't fail the request if sync fails
      }

      return NextResponse.json({
        success: true,
        message: 'Wallet connection already tracked',
        isFirstTime: false,
      });
    }

    // Create wallet connection record (first-time connection)
    const timestamp = new Date().toISOString();
    const connectionData = {
      walletAddress: normalizedAddress,
      timestamp,
      createdAt: new Date(),
      // Analytics metadata
      country: analyticsMetadata.country,
      region: analyticsMetadata.region,
      city: analyticsMetadata.city,
      deviceType: analyticsMetadata.deviceType,
      browser: analyticsMetadata.browser,
      os: analyticsMetadata.os,
      hourOfDay: analyticsMetadata.hourOfDay,
      timeOfDay: analyticsMetadata.timeOfDay,
    };

    await adminDb.collection('wallet_connections').add(connectionData);

    // Sync to wallets collection (non-blocking)
    try {
      await ensureWalletExists(normalizedAddress);
      
      // Update first connected timestamp
      const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
      await walletRef.update({
        'timestamps.firstConnected': Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Full sync and categorize
      const wallet = await fullSyncWallet(normalizedAddress);
      
      // Ensure activation logic is applied: if connected but not whitelisted, activate
      // This handles: "Activated wallets are any wallet that connects to the dApp, that we do not have in our wallet list"
      if (wallet.timestamps.firstConnected && !wallet.status.isWhitelisted && !wallet.status.isActivated) {
        const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
        await walletRef.update({
          'status.isActivated': true,
          'timestamps.activatedAt': wallet.timestamps.activatedAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        wallet.status.isActivated = true;
        if (!wallet.timestamps.activatedAt) {
          wallet.timestamps.activatedAt = Timestamp.now();
        }
      }
      
      await categorizeWallet(normalizedAddress, wallet);
    } catch (syncError) {
      console.error('Error syncing wallet to wallets collection:', syncError);
      // Don't fail the request if sync fails
    }

    // Track Early Circle wallet_connected event (non-blocking)
    try {
      const isEarlyCircle = await isWalletEarlyCircle(normalizedAddress);
      if (isEarlyCircle) {
        await adminDb.collection('early_circle_events').add({
          eventType: 'wallet_connected',
          walletAddress: normalizedAddress,
          timestamp: Timestamp.now(),
          isEarlyCircle: true,
          source: 'web',
          metadata: {},
        });
      }
    } catch (eventError) {
      console.error('Error tracking Early Circle wallet_connected event:', eventError);
      // Don't fail the request if event tracking fails
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet connection tracked successfully',
      isFirstTime: true,
    });
  } catch (error) {
    console.error('Error tracking wallet connection:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

