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

    // For now, return mock data - later this will be replaced with real NFT data
    // In production, this would fetch from contract or Moralis API
    const mockNftData = {
      wallet,
      positions: [
        {
          type: "Seed" as const,
          start_ts: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
          lock_tier: "flex"
        },
        {
          type: "Tree" as const,
          start_ts: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago
          lock_tier: "1m"
        }
      ]
    };

    return NextResponse.json(mockNftData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error fetching NFT data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
