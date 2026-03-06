import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Generate more realistic and dynamic leaderboard data
    const now = Date.now();
    const baseTime = Math.floor(now / 1000);
    
    // Create consistent wallet addresses for the top players
    const topWallets = [
      '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      '0x8ba1f109551bD432803012645Hac136c',
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0x9876543210987654321098765432109876543210'
    ];

    const mockLeaderboardData = {
      asOf: baseTime,
      rows: Array.from({ length: 100 }, (_, i) => {
        // Use consistent wallets for top 5, random for others
        const wallet = i < 5 ? topWallets[i] : `0x${Math.random().toString(16).substr(2, 40)}`;
        
        // Add some time-based variation to make it feel more real-time
        const timeVariation = Math.sin((now + i * 1000) / 10000) * 0.1;
        const baseRggp = Math.max(1000 - i * 10, 100);
        const baseXp = Math.max(5000 - i * 50, 100);
        
        return {
          rank: i + 1,
          wallet,
          rggp: Math.max(baseRggp + timeVariation * 50 + Math.random() * 20, 10),
          xp: Math.max(baseXp + timeVariation * 100 + Math.random() * 50, 10)
        };
      })
    };

    return NextResponse.json(mockLeaderboardData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Disable caching for real-time updates
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
