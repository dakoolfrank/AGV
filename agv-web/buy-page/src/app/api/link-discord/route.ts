import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Link Discord account to wallet address
 * Called from frontend after Discord OAuth success
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet address is required' 
      }, { status: 400 });
    }

    // Get temporary Discord data from cookie
    const cookieStore = await cookies();
    const tempDiscord = cookieStore.get('discord_temp_user');

    if (!tempDiscord) {
      return NextResponse.json({ 
        success: false, 
        error: 'No pending Discord verification found' 
      }, { status: 400 });
    }

    let discordData;
    try {
      discordData = JSON.parse(tempDiscord.value);
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid Discord verification data' 
      }, { status: 400 });
    }

    const addressKey = address.toLowerCase();
    const userRef = adminDb.collection('users').doc(addressKey);
    const userSnap = await userRef.get();

    const now = new Date().toISOString();

    // Format Discord username (handle both old format with discriminator and new format without)
    let discordUsername = discordData.username || 'Unknown';
    if (discordData.discriminator && discordData.discriminator !== '0' && discordData.discriminator !== 0) {
      discordUsername = `${discordData.username}#${discordData.discriminator}`;
    }

    if (userSnap.exists) {
      // Update existing user
      await userRef.update({
        discordVerified: true,
        discordVerificationTime: now,
        discordUserId: discordData.id,
        discordUsername: discordUsername,
        updatedAt: now,
      });
    } else {
      // Create new user with Discord verification
      await userRef.set({
        id: addressKey,
        address: addressKey,
        discordVerified: true,
        discordVerificationTime: now,
        discordUserId: discordData.id,
        discordUsername: discordUsername,
        totalEarned: 0,
        redeemedAmount: 0,
        accruedAmount: 0,
        activationTime: null,
        lastUpdated: now,
        isActivated: false,
        hasClaimed: false,
        nftOwnership: {},
        eligibility: {
          hasRequiredNfts: false,
          requiredNftTypes: [],
          lastChecked: now,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sync to wallets collection (non-blocking)
    try {
      const { ensureWalletExists, updateWalletStatus, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
      const { Timestamp } = await import('firebase-admin/firestore');
      
      await ensureWalletExists(addressKey);
      const wallet = await getWallet(addressKey);
      
      if (wallet) {
        await updateWalletStatus(addressKey, {
          bindings: {
            ...wallet.bindings,
            discordVerified: true,
            discordVerifiedAt: Timestamp.now(),
            discordUserId: discordData.id,
            discordUsername: discordUsername,
          },
        });
        
        const updatedWallet = await getWallet(addressKey);
        if (updatedWallet) {
          await categorizeWallet(addressKey, updatedWallet);
        }
      }
    } catch (syncError) {
      console.error('Error syncing wallet Discord link:', syncError);
      // Don't fail the request if sync fails
    }

    const response = NextResponse.json({ 
      success: true, 
      message: 'Discord account linked successfully',
      data: {
        verified: true,
        discordUserId: discordData.id,
        discordUsername: discordData.username,
      }
    });

    // Clear temporary cookie
    response.cookies.delete('discord_temp_user');

    return response;
  } catch (error) {
    console.error('Error linking Discord account:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to link Discord account' 
    }, { status: 500 });
  }
}

