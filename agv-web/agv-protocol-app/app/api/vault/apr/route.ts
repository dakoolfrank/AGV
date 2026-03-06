import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') || 'flex';
    
    // Validate tier
    const validTiers = ['flex', '1m', '3m', '6m', '12m'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // For now, return static data - later this will be replaced with on-chain data
    const tiersData = {
      flex: { apr: 100, split: { real: 0.25, boost: 0.60, social: 0.15 } },
      '1m': { apr: 350, split: { real: 0.25, boost: 0.60, social: 0.15 } },
      '3m': { apr: 400, split: { real: 0.25, boost: 0.60, social: 0.15 } },
      '6m': { apr: 480, split: { real: 0.25, boost: 0.60, social: 0.15 } },
      '12m': { apr: 490, split: { real: 0.30, boost: 0.60, social: 0.10 } }
    };

    const tierData = tiersData[tier as keyof typeof tiersData];
    
    return NextResponse.json(tierData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error fetching APR data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
