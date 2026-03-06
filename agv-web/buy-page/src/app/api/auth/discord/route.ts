import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Discord OAuth initiation endpoint
 * Redirects user to Discord OAuth authorization
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Discord OAuth not configured' 
      }, { status: 500 });
    }

    // Get the origin (works for all environments)
    const origin = request.headers.get('origin') || 
                   request.headers.get('host') || 
                   'http://localhost:3000';
    
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const host = origin.replace(/^https?:\/\//, '');
    const redirectUri = `${protocol}://${host}/api/auth/discord/callback`;

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);

    // Store state in cookie (expires in 10 minutes)
    const response = NextResponse.redirect(
      `https://discord.com/api/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=identify%20guilds&` +
      `state=${state}`
    );

    // Set state in httpOnly cookie for security
    response.cookies.set('discord_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Discord OAuth initiation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initiate Discord OAuth' 
    }, { status: 500 });
  }
}

