import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Validate wallet format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // For now, return mock data - later this will be replaced with real XP data
    // In production, this would fetch from Zealy/TaskOn APIs or database
    const mockXpData = {
      xp: Math.floor(Math.random() * 5000) + 100, // Random XP between 100-5100
      asOf: Math.floor(Date.now() / 1000) // Current timestamp in seconds
    };

    return NextResponse.json(mockXpData, {
      headers: {
        'Cache-Control': 'no-store' // XP data should not be cached
      }
    });
  } catch (error) {
    console.error('Error fetching XP data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
