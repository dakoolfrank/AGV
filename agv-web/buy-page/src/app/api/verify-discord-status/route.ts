import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Check Discord verification status for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet address is required' 
      }, { status: 400 });
    }

    // Get user from database
    const userRef = adminDb.collection('users').doc(address.toLowerCase());
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ 
        success: true, 
        data: { 
          verified: false,
          discordUserId: null,
          discordUsername: null,
        } 
      });
    }

    const userData = userSnap.data();
    const verified = userData?.discordVerified || false;
    const discordUserId = userData?.discordUserId || null;
    const discordUsername = userData?.discordUsername || null;

    // Check for temporary Discord verification from cookie
    const cookieStore = await cookies();
    const tempDiscord = cookieStore.get('discord_temp_user');
    
    if (tempDiscord && !verified) {
      try {
        const tempData = JSON.parse(tempDiscord.value);
        return NextResponse.json({ 
          success: true, 
          data: { 
            verified: false,
            pendingVerification: true,
            discordUserId: tempData.id,
            discordUsername: tempData.username,
          } 
        });
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        verified,
        discordUserId,
        discordUsername,
      } 
    });
  } catch (error) {
    console.error('Error checking Discord status:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check Discord verification status' 
    }, { status: 500 });
  }
}

