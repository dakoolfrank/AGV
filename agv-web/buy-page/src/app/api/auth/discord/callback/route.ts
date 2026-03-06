import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Discord OAuth callback endpoint
 * Handles the OAuth callback, verifies user, and links to wallet
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Get origin for absolute URLs
    const origin = request.headers.get('origin') || 
                   request.headers.get('host') || 
                   'http://localhost:3000';
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const host = origin.replace(/^https?:\/\//, '');
    const baseUrl = `${protocol}://${host}`;

    // Handle OAuth errors
    if (error) {
      const errorMsg = errorDescription || error;
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent(errorMsg)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Verify state (CSRF protection)
    const cookieStore = await cookies();
    const storedState = cookieStore.get('discord_oauth_state')?.value;
    
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent('Discord OAuth not configured')}`
      );
    }

    // Get redirect URI
    const redirectUri = `${baseUrl}/api/auth/discord/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Discord token exchange error:', errorData);
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent('Failed to exchange authorization code')}`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/claim?discord_error=${encodeURIComponent('Failed to fetch Discord user info')}`
      );
    }

    const discordUser = await userResponse.json();

    // Verify user is member of required Discord server (if guild ID is set)
    if (guildId) {
      const guildResponse = await fetch(
        `https://discord.com/api/users/@me/guilds`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (guildResponse.ok) {
        const guilds = await guildResponse.json();
        const isMember = guilds.some((guild: { id: string }) => guild.id === guildId);

        if (!isMember) {
          // Redirect with error and Discord invite link
          const discordInviteLink = 'https://discord.com/invite/JP9RtzM2SC';
          return NextResponse.redirect(
            `${baseUrl}/claim?discord_error=${encodeURIComponent('You must join our Discord server first. Click here to join, then try again.')}&discord_invite=${encodeURIComponent(discordInviteLink)}`
          );
        }
      }
    }

    // Store wallet address in cookie temporarily (will be linked in the frontend)
    // The frontend will send the wallet address to link the Discord account
    const response = NextResponse.redirect(`${baseUrl}/claim?discord_success=1&discord_id=${discordUser.id}`);
    
    // Clear state cookie
    response.cookies.delete('discord_oauth_state');
    
    // Store Discord info in cookie temporarily (will be used by frontend to link to wallet)
    response.cookies.set('discord_temp_user', JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
    });

    return response;
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    // Get origin for absolute URL in error handler
    const origin = request.headers.get('origin') || 
                   request.headers.get('host') || 
                   'http://localhost:3000';
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const host = origin.replace(/^https?:\/\//, '');
    const baseUrl = `${protocol}://${host}`;
    
    return NextResponse.redirect(
      `${baseUrl}/claim?discord_error=${encodeURIComponent('An unexpected error occurred during Discord verification')}`
    );
  }
}

