import { NextRequest, NextResponse } from 'next/server';
import { isAddressWhitelisted, areAddressesWhitelisted } from '@/lib/whitelist-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Address is required' 
      }, { status: 400 });
    }

    // Check if address is whitelisted
    const isWhitelisted = await isAddressWhitelisted(address);

    return NextResponse.json({ 
      success: true, 
      data: { 
        address: address.toLowerCase(),
        isWhitelisted 
      } 
    });

  } catch (error) {
    console.error('Error checking whitelist:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Batch check endpoint for multiple addresses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addresses } = body;

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Addresses array is required' 
      }, { status: 400 });
    }

    // Check multiple addresses
    const results = await areAddressesWhitelisted(addresses);

    return NextResponse.json({ 
      success: true, 
      data: results 
    });

  } catch (error) {
    console.error('Error batch checking whitelist:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
