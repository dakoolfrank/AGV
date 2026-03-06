import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Check if a KOL ID belongs to a specific wallet address
 * Used to detect self-referral attempts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kolId = searchParams.get('kolId');
    const wallet = searchParams.get('wallet');
    
    if (!kolId || !wallet) {
      return NextResponse.json({ 
        success: false,
        error: 'KOL ID and wallet address are required' 
      }, { status: 400 });
    }
    
    // Extract 6-digit number from KOL ID format
    const kolIdTrimmed = kolId.trim();
    const kolIdMatch = kolIdTrimmed.match(/(\d{6})/);
    const sixDigitCode = kolIdMatch ? kolIdMatch[1] : null;
    
    let kolQuery;
    
    // Strategy 1: Try to find by refCode (6-digit code)
    if (sixDigitCode) {
      kolQuery = await adminDb.collection('kol_profiles')
        .where('refCode', '==', sixDigitCode)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }
    
    // Strategy 2: Try by full refCode match
    if (kolQuery?.empty !== false) {
      kolQuery = await adminDb.collection('kol_profiles')
        .where('refCode', '==', kolIdTrimmed)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }
    
    // Strategy 3: Try by document ID
    if (kolQuery?.empty !== false) {
      try {
        const kolDoc = await adminDb.collection('kol_profiles').doc(kolIdTrimmed).get();
        if (kolDoc.exists) {
          const kol = kolDoc.data();
          if (kol?.status === 'active') {
            kolQuery = { docs: [kolDoc], empty: false } as any;
          }
        }
      } catch (error) {
        console.error('Error checking KOL by ID:', error);
      }
    }
    
    // Strategy 4: Search all active KOLs and match by pattern
    if (kolQuery?.empty !== false) {
      const allKols = await adminDb.collection('kol_profiles')
        .where('status', '==', 'active')
        .get();
      
      for (const doc of allKols.docs) {
        const kol = doc.data();
        if (kol.refCode === kolIdTrimmed || 
            (sixDigitCode && kol.refCode === sixDigitCode) ||
            doc.id === kolIdTrimmed ||
            (sixDigitCode && kol.refCode?.includes(sixDigitCode))) {
          kolQuery = { docs: [doc], empty: false } as any;
          break;
        }
      }
    }
    
    if (kolQuery && !kolQuery.empty) {
      const kol = kolQuery.docs[0].data();
      const kolWallet = kol?.wallet?.toLowerCase() || '';
      const userWallet = wallet.toLowerCase();
      
      return NextResponse.json({
        success: true,
        isSelfReferral: kolWallet === userWallet,
        kolWallet: kolWallet,
        kolExists: true
      });
    }
    
    return NextResponse.json({
      success: true,
      isSelfReferral: false,
      kolExists: false
    });
    
  } catch (error) {
    console.error('Check KOL wallet error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

