import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET - Export Early Circle wallets or list them
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // 'json' or 'csv'
    const includeSuspicious = searchParams.get('includeSuspicious') === 'true';

    // Get all Early Circle wallets
    const walletsSnapshot = await adminDb.collection('wallets')
      .where('earlyCircle.isEarlyCircle', '==', true)
      .get();

    const wallets = walletsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        address: data.address,
        isEarlyCircle: data.earlyCircle?.isEarlyCircle || false,
        isSuspicious: data.earlyCircle?.isSuspicious || false,
        addedAt: data.earlyCircle?.addedAt?.toDate?.()?.toISOString() || null,
        addedBy: data.earlyCircle?.addedBy || null,
      };
    });

    // Filter out suspicious wallets if requested
    const filteredWallets = includeSuspicious 
      ? wallets 
      : wallets.filter(w => !w.isSuspicious);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['address', 'isEarlyCircle', 'isSuspicious', 'addedAt', 'addedBy'];
      const csvRows = [
        headers.join(','),
        ...filteredWallets.map(w => [
          w.address,
          w.isEarlyCircle,
          w.isSuspicious,
          w.addedAt || '',
          w.addedBy || '',
        ].join(','))
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="early-circle-wallets.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      wallets: filteredWallets,
      total: filteredWallets.length,
    });
  } catch (error) {
    console.error('Error fetching Early Circle wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Bulk add wallets to Early Circle (from CSV upload)
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { addresses } = body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'addresses must be a non-empty array' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();
    const addedBy = decoded.email || 'unknown';
    const results = {
      added: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchAddresses = addresses.slice(i, i + batchSize);

      for (const address of batchAddresses) {
        try {
          const normalizedAddress = address.toLowerCase().trim();
          
          // Validate address format
          if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
            results.errors.push(`Invalid address format: ${address}`);
            results.skipped++;
            continue;
          }

          const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
          const walletSnap = await walletRef.get();

          if (walletSnap.exists) {
            const walletData = walletSnap.data();
            // Only update if not already in Early Circle
            if (!walletData?.earlyCircle?.isEarlyCircle) {
              batch.update(walletRef, {
                'earlyCircle.isEarlyCircle': true,
                'earlyCircle.addedAt': now,
                'earlyCircle.addedBy': addedBy,
                updatedAt: now,
              });
              results.added++;
            } else {
              results.skipped++;
            }
          } else {
            // Create new wallet with Early Circle flag
            batch.set(walletRef, {
              address: normalizedAddress,
              metadata: {
                total_tx: 0,
                avg_age: 0,
                total_balance: 0,
                chains_used: 0,
                tier: 'Tier 3',
              },
              status: {
                isWhitelisted: false,
                isActivated: false,
                hasClaimed: false,
                isAirdropped: false,
                hasBought: false,
                hasStaked: false,
              },
              whitelistInfo: {
                inMintingWhitelist: false,
                inBuyWhitelist: false,
                whitelistedAt: null,
              },
              timestamps: {
                firstConnected: null,
                activatedAt: null,
                claimedAt: null,
                firstBuyAt: null,
                firstStakeAt: null,
              },
              bindings: {
                discordVerified: false,
                discordVerifiedAt: null,
                discordUserId: null,
                discordUsername: null,
                tasksCompleted: false,
              },
              earlyCircle: {
                isEarlyCircle: true,
                addedAt: now,
                addedBy: addedBy,
                isSuspicious: false,
                suspiciousReason: null,
                flaggedAt: null,
                flaggedBy: null,
              },
              createdAt: now,
              updatedAt: now,
              lastSyncedAt: now,
            });
            results.added++;
          }
        } catch (error) {
          results.errors.push(`Error processing ${address}: ${error instanceof Error ? error.message : String(error)}`);
          results.skipped++;
        }
      }

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: 'Wallets processed successfully',
      results,
    });
  } catch (error) {
    console.error('Error adding Early Circle wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove wallet(s) from Early Circle
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const addresses = searchParams.get('addresses'); // Comma-separated

    if (!address && !addresses) {
      return NextResponse.json(
        { success: false, error: 'address or addresses parameter required' },
        { status: 400 }
      );
    }

    const addressesToRemove = address 
      ? [address] 
      : addresses?.split(',').map(a => a.trim()).filter(Boolean) || [];

    if (addressesToRemove.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid addresses provided' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();
    const results = {
      removed: 0,
      notFound: 0,
      errors: [] as string[],
    };

    // Process in batches
    const batchSize = 500;
    for (let i = 0; i < addressesToRemove.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchAddresses = addressesToRemove.slice(i, i + batchSize);

      for (const addr of batchAddresses) {
        try {
          const normalizedAddress = addr.toLowerCase().trim();
          const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
          const walletSnap = await walletRef.get();

          if (walletSnap.exists) {
            batch.update(walletRef, {
              'earlyCircle.isEarlyCircle': false,
              updatedAt: now,
            });
            results.removed++;
          } else {
            results.notFound++;
          }
        } catch (error) {
          results.errors.push(`Error processing ${addr}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: 'Wallets removed from Early Circle',
      results,
    });
  } catch (error) {
    console.error('Error removing Early Circle wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

