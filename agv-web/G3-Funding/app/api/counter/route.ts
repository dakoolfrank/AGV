import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { GlobalMintCounter } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaign = searchParams.get('campaign') || 'G3';
    
    // Get global mint counter
    const counterDoc = await db.collection('global_counters').doc(`${campaign}_mints`).get();
    
    if (!counterDoc.exists) {
      // Return empty counter if not found
      return NextResponse.json({
        campaign,
        totalMints: 0,
        totalValue: 0,
        last7Days: [],
        updatedAt: new Date().toISOString()
      });
    }
    
    const counter = counterDoc.data() as GlobalMintCounter;
    
    // Ensure last7Days is properly formatted and sorted
    const last7Days = (counter.last7Days || [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);
    
    return NextResponse.json({
      campaign: counter.campaign,
      totalMints: counter.totalMints || 0,
      totalValue: counter.totalValue || 0,
      last7Days,
      updatedAt: counter.updatedAt
    });
    
  } catch (error) {
    console.error('Counter API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Allow CORS for public access
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
