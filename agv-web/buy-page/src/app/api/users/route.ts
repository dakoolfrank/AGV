import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { User, LeaderboardEntry } from '@/lib/types';
import { isAddressWhitelisted } from '@/lib/whitelist-utils';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';
import { isWalletEarlyCircle, isEarlyCircleActive, getEarlyCircleConfig } from '@/lib/early-circle-server-utils';
import { extractErrorReason } from '@/lib/early-circle-utils';
import { getAnalyticsMetadata } from '@/lib/analytics-utils';

// Helper function to calculate accrued earnings
function calculateAccruedEarnings(user: User): number {
  if (!user.isActivated || !user.activationTime) return 0;
  
  const now = new Date();
  const lastUpdate = new Date(user.lastUpdated);
  const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  const earningRate = 0.1; // preGVT per minute
  
  return minutesSinceUpdate * earningRate;
}

/**
 * Map KOL tier to commission percentage for purchase referrals
 * Priority: Agent Level > Custom Rate > Tier
 * Agent Level-1 (Master) = 12%, Level-2 (Sub-Agent) = 5%
 * Tier 1 (partner) = 2%, Tier 2 (ambassador) = 1%, Tier 3 (pioneer) = 0%
 */
async function getPurchaseCommissionRate(
  kolId: string,
  tier: string,
  customCommissionRate?: number
): Promise<number> {
  // Check if this KOL is an agent
  try {
    const kolDoc = await adminDb.collection('kol_profiles').doc(kolId).get();
    if (kolDoc.exists) {
      const kolData = kolDoc.data();
      
      // Priority 1: Agent Level (for purchase referrals only)
      if (kolData?.agentLevel === 1) {
        return 0.12; // 12% for Master Agents
      }
      if (kolData?.agentLevel === 2) {
        return 0.05; // 5% for Sub-Agents
      }
      
      // Priority 2: Custom commission rate
      if (customCommissionRate !== undefined && customCommissionRate > 0) {
        return customCommissionRate;
      }
    }
  } catch (error) {
    console.error('Error checking agent level:', error);
    // Fall through to tier-based rates
  }
  
  // Priority 3: Tier-based rates (existing logic)
  switch (tier) {
    case 'partner':
      return 0.02; // 2% for Tier 1
    case 'ambassador':
      return 0.01; // 1% for Tier 2
    case 'pioneer':
    default:
      return 0; // 0% for Tier 3 or unknown
  }
}

/**
 * Get current period identifier (e.g., "2024-W42")
 */
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Calculate settlement amounts (immediate vs vested)
 */
function calculateSettlement(totalAmount: number): { immediate: number; vested: number } {
  const immediatePct = 0.40; // 40% immediate
  const immediate = totalAmount * immediatePct;
  const vested = totalAmount - immediate;
  
  return { immediate, vested };
}

/**
 * Update KOL rewards ledger for purchase commission
 * Uses Firestore transactions to ensure atomic updates
 */
async function updateKolRewards(kolId: string, commission: number): Promise<void> {
  const period = getCurrentPeriod();
  const ledgerRef = adminDb.collection('rewards_ledger').doc(`${kolId}_${period}`);
  
  await adminDb.runTransaction(async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerRef);
    
    let ledger: {
      id: string;
      period: string;
      kolId: string;
      ownPostReward: number;
      ownMintsCommission: number;
      l1OverrideCommission: number;
      l2OverrideCommission: number;
      totalEarned: number;
      immediateAmount: number;
      vestedAmount: number;
      capApplied: boolean;
      calculatedAt: Date;
      campaign: string;
    };
    
    if (ledgerDoc.exists) {
      const existing = ledgerDoc.data() || {};
      ledger = {
        id: existing.id || `${kolId}_${period}`,
        period: existing.period || period,
        kolId: existing.kolId || kolId,
        ownPostReward: existing.ownPostReward || 0,
        ownMintsCommission: (existing.ownMintsCommission || 0) + commission,
        l1OverrideCommission: existing.l1OverrideCommission || 0,
        l2OverrideCommission: existing.l2OverrideCommission || 0,
        totalEarned: 0, // Will be recalculated
        immediateAmount: 0, // Will be recalculated
        vestedAmount: 0, // Will be recalculated
        capApplied: existing.capApplied || false,
        calculatedAt: new Date(),
        campaign: existing.campaign || 'G3'
      };
    } else {
      ledger = {
        id: `${kolId}_${period}`,
        period,
        kolId,
        ownPostReward: 0,
        ownMintsCommission: commission,
        l1OverrideCommission: 0,
        l2OverrideCommission: 0,
        totalEarned: 0,
        immediateAmount: 0,
        vestedAmount: 0,
        capApplied: false,
        calculatedAt: new Date(),
        campaign: 'G3'
      };
    }
    
    // Recalculate totals
    ledger.totalEarned = ledger.ownPostReward + ledger.ownMintsCommission + 
                        ledger.l1OverrideCommission + ledger.l2OverrideCommission;
    
    const settlement = calculateSettlement(ledger.totalEarned);
    ledger.immediateAmount = settlement.immediate;
    ledger.vestedAmount = settlement.vested;
    
    transaction.set(ledgerRef, {
      ...ledger,
      calculatedAt: ledger.calculatedAt
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    if (action === 'activation-count') {
      // Get total activation count from database
      const usersSnapshot = await adminDb.collection('users')
        .where('isActivated', '==', true)
        .get();

      const activationCount = usersSnapshot.size;

      return NextResponse.json({ 
        success: true, 
        data: { activationCount } 
      });
    }

    if (action === 'claim-count') {
      // Get total claim count from database
      const usersSnapshot = await adminDb.collection('users')
        .where('hasClaimed', '==', true)
        .get();

      const claimCount = usersSnapshot.size;

      return NextResponse.json({ 
        success: true, 
        data: { claimCount } 
      });
    }

    if (address) {
      const addressKey = address.toLowerCase();

      // Get specific user from database
      const userRef = adminDb.collection('users').doc(addressKey);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }

      const userData = userSnap.data() as User;
      
      // Calculate and update accrued earnings
      const newAccrued = calculateAccruedEarnings(userData);
      if (newAccrued > 0) {
        const updatedUser = {
          ...userData,
          accruedAmount: userData.accruedAmount + newAccrued,
          totalEarned: userData.redeemedAmount + userData.accruedAmount + newAccrued,
          lastUpdated: new Date().toISOString(),
        };
        
        await userRef.update({
          accruedAmount: updatedUser.accruedAmount,
          totalEarned: updatedUser.totalEarned,
          lastUpdated: updatedUser.lastUpdated,
        });
        
        return NextResponse.json({ 
          success: true, 
          data: updatedUser 
        });
      }

      return NextResponse.json({ 
        success: true, 
        data: userData 
      });
    }

    // Return leaderboard (top 50 users)
    const leaderboardType = searchParams.get('type') || 'activation'; // 'buyer', 'referral', or 'activation'

    const usersRef = adminDb.collection('users');
    let querySnapshot;
    let leaderboard: LeaderboardEntry[] = [];

    if (leaderboardType === 'buyer') {
      // Buyer leaderboard: Users sorted by redeemedAmount (purchases/redemptions)
      querySnapshot = await usersRef
        .where('redeemedAmount', '>', 0)
        .get();
      
      const buyers = querySnapshot.docs.map((doc) => {
        const userData = doc.data() as User;
        return {
          ...userData,
          id: doc.id,
        };
      });
      
      leaderboard = buyers
        .sort((a, b) => b.redeemedAmount - a.redeemedAmount)
        .slice(0, 50)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));
    } else if (leaderboardType === 'referral') {
      // Referral leaderboard: Users sorted by claimTime (earliest referrals first)
      querySnapshot = await usersRef
        .where('hasClaimed', '==', true)
        .get();
      
      const referrers = querySnapshot.docs.map((doc) => {
        const userData = doc.data() as User;
        return {
          ...userData,
          id: doc.id,
        };
      });
      
      leaderboard = referrers
        .filter(user => user.claimTime)
        .sort((a, b) => {
          const timeA = new Date(a.claimTime!).getTime();
          const timeB = new Date(b.claimTime!).getTime();
          return timeA - timeB; // Earliest first
        })
        .slice(0, 50)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));
    } else {
      // Activation leaderboard: Users sorted by totalEarned (default)
      querySnapshot = await usersRef
        .where('isActivated', '==', true)
        .get();
      
      // Recalculate totalEarned for each user before sorting
      const usersWithRecalculatedEarnings = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const userData = doc.data() as User;
          const newAccrued = calculateAccruedEarnings(userData);
          
          let finalAccrued = userData.accruedAmount;
          let finalTotalEarned = userData.totalEarned;
          
          // If there are new accrued earnings, update the document
          if (newAccrued > 0) {
            finalAccrued = userData.accruedAmount + newAccrued;
            finalTotalEarned = userData.redeemedAmount + finalAccrued;
            
            // Update the document in Firestore
            await doc.ref.update({
              accruedAmount: finalAccrued,
              totalEarned: finalTotalEarned,
              lastUpdated: new Date().toISOString(),
            });
          }
          
          return {
            ...userData,
            id: doc.id,
            accruedAmount: finalAccrued,
            totalEarned: finalTotalEarned,
          };
        })
      );
      
      // Sort by totalEarned in descending order and take top 50
      leaderboard = usersWithRecalculatedEarnings
        .sort((a, b) => b.totalEarned - a.totalEarned)
        .slice(0, 50)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));
    }

    return NextResponse.json({ 
      success: true, 
      data: leaderboard 
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, action, redeemedAmount, nftOwnership, eligibility } = body;

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Address is required' 
      }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(address.toLowerCase());
    const userSnap = await userRef.get();
    const now = new Date().toISOString();

    if (action === 'activate') {
      if (userSnap.exists) {
        const userData = userSnap.data() as User;
        if (userData.isActivated) {
          return NextResponse.json({ 
            success: false, 
            error: 'User already activated',
            data: userData 
          }, { status: 400 });
        }

        // Update existing user - give 1000 preGVT on activation
        const updatedUser = {
          ...userData,
          isActivated: true,
          activationTime: now,
          lastUpdated: now,
          totalEarned: (userData.totalEarned || 0) + 1000,
          accruedAmount: (userData.accruedAmount || 0) + 1000,
        };

        await userRef.update({
          isActivated: true,
          activationTime: now,
          lastUpdated: now,
          totalEarned: (userData.totalEarned || 0) + 1000,
          accruedAmount: (userData.accruedAmount || 0) + 1000,
        });

        // Sync to wallets collection (non-blocking)
        try {
          const { ensureWalletExists, updateWalletStatus, syncWalletToUsers, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
          const { Timestamp } = await import('firebase-admin/firestore');
          
          await ensureWalletExists(address.toLowerCase());
          const wallet = await getWallet(address.toLowerCase());
          
          if (wallet) {
            await updateWalletStatus(address.toLowerCase(), {
              status: {
                ...wallet.status,
                isActivated: true,
              },
              timestamps: {
                ...wallet.timestamps,
                activatedAt: Timestamp.now(),
              },
              bindings: {
                ...wallet.bindings,
                discordVerified: userData.discordVerified || false,
              },
            });
            
            const updatedWallet = await getWallet(address.toLowerCase());
            if (updatedWallet) {
              await syncWalletToUsers(address.toLowerCase(), updatedWallet);
              await categorizeWallet(address.toLowerCase(), updatedWallet);
            }
          }
        } catch (syncError) {
          console.error('Error syncing wallet activation:', syncError);
          // Don't fail the request if sync fails
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Wallet activated successfully',
          data: updatedUser 
        });
      } else {
        // Create new user - give 1000 preGVT on activation
        const newUser: User = {
          id: address.toLowerCase(),
          address: address.toLowerCase(),
          totalEarned: 1000,
          redeemedAmount: 0,
          accruedAmount: 1000,
          activationTime: now,
          lastUpdated: now,
          isActivated: true,
          nftOwnership: {},
          eligibility: {
            hasRequiredNfts: false,
            requiredNftTypes: [],
            lastChecked: now,
          },
          createdAt: now,
          updatedAt: now,
        };

        // Use .set() with the address as document ID instead of .add() to ensure correct document ID
        await userRef.set(newUser);

        // Sync to wallets collection (non-blocking)
        try {
          const { ensureWalletExists, updateWalletStatus, syncWalletToUsers, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
          const { Timestamp } = await import('firebase-admin/firestore');
          
          await ensureWalletExists(address.toLowerCase());
          const wallet = await getWallet(address.toLowerCase());
          
          if (wallet) {
            await updateWalletStatus(address.toLowerCase(), {
              status: {
                ...wallet.status,
                isActivated: true,
              },
              timestamps: {
                ...wallet.timestamps,
                activatedAt: Timestamp.now(),
              },
            });
            
            const updatedWallet = await getWallet(address.toLowerCase());
            if (updatedWallet) {
              await syncWalletToUsers(address.toLowerCase(), updatedWallet);
              await categorizeWallet(address.toLowerCase(), updatedWallet);
            }
          }
        } catch (syncError) {
          console.error('Error syncing wallet activation:', syncError);
          // Don't fail the request if sync fails
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Wallet activated successfully',
          data: newUser 
        });
      }
    }

    if (action === 'claim') {
      // Check whitelist status first using admin SDK
      try {
        const isWhitelisted = await isAddressWhitelisted(address);
        
        if (!isWhitelisted) {
          console.error('[API USERS] Claim attempt by non-whitelisted address:', address);
          return NextResponse.json({ 
            success: false, 
            error: 'Your wallet is not whitelisted for the airdrop. Only whitelisted wallets can claim airdrop badges.',
          }, { status: 403 });
        }
      } catch (error) {
        console.error('[API USERS] Error checking whitelist:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Unable to verify whitelist status. Please try again.',
        }, { status: 500 });
      }

      // Check if user has already claimed
      if (userSnap.exists) {
        const userData = userSnap.data() as User;
        if (userData.hasClaimed) {
          console.log('[API USERS] User already claimed:', address);
          return NextResponse.json({ 
            success: false, 
            error: 'You have already claimed your airdrop badge. Only one claim per wallet is allowed.',
            data: userData 
          }, { status: 400 });
        }
      }

      // Get analytics metadata for tracking
      const analyticsMetadata = await getAnalyticsMetadata(request);

      // Create or update user with claim status
      try {
        if (userSnap.exists) {
          const userData = userSnap.data() as User;
          console.log('[API USERS] Updating existing user with claim status:', address);
          
          await userRef.update({
            hasClaimed: true,
            claimTime: now,
            lastUpdated: now,
          });

          const updatedUser = {
            ...userData,
            hasClaimed: true,
            claimTime: now,
            lastUpdated: now,
          };

          // Sync to wallets collection (non-blocking)
          try {
            const { ensureWalletExists, updateWalletStatus, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
            const { Timestamp } = await import('firebase-admin/firestore');
            
            await ensureWalletExists(address.toLowerCase());
            const wallet = await getWallet(address.toLowerCase());
            
            if (wallet && !wallet.status.hasClaimed) {
              await updateWalletStatus(address.toLowerCase(), {
                status: {
                  ...wallet.status,
                  hasClaimed: true,
                },
                timestamps: {
                  ...wallet.timestamps,
                  claimedAt: Timestamp.now(),
                },
              });
              
              const updatedWallet = await getWallet(address.toLowerCase());
              if (updatedWallet) {
                await categorizeWallet(address.toLowerCase(), updatedWallet);
              }
            }
          } catch (syncError) {
            console.error('Error syncing wallet claim:', syncError);
            // Don't fail the request if sync fails
          }

          // Track claim success in analytics_events (non-blocking)
          try {
            await adminDb.collection('analytics_events').add({
              eventType: 'claim_success',
              walletAddress: address.toLowerCase(),
              timestamp: new Date().toISOString(),
              createdAt: new Date(),
              country: analyticsMetadata.country,
              region: analyticsMetadata.region,
              city: analyticsMetadata.city,
              deviceType: analyticsMetadata.deviceType,
              browser: analyticsMetadata.browser,
              os: analyticsMetadata.os,
              hourOfDay: analyticsMetadata.hourOfDay,
              timeOfDay: analyticsMetadata.timeOfDay,
              metadata: {
                claimTime: now,
              },
            });
          } catch (analyticsError) {
            console.error('Error tracking claim success in analytics:', analyticsError);
          }

          // Track Early Circle claim_success event (non-blocking)
          try {
            const isEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
            const isActive = await isEarlyCircleActive();
            if (isActive && isEarlyCircle) {
              await adminDb.collection('early_circle_events').add({
                eventType: 'claim_success',
                walletAddress: address.toLowerCase(),
                timestamp: Timestamp.now(),
                isEarlyCircle: true,
                source: 'web',
                metadata: {
                  claimTime: now,
                },
              });
            }
          } catch (eventError) {
            console.error('Error tracking Early Circle claim_success event:', eventError);
          }

          console.log('[API USERS] User updated successfully:', address);
          return NextResponse.json({ 
            success: true, 
            message: 'Airdrop badge claimed successfully',
            data: updatedUser 
          });
        } else {
          console.log('[API USERS] Creating new user with claim status:', address);
          // Create new user with claim status
          const newUser: User = {
            id: address.toLowerCase(),
            address: address.toLowerCase(),
            totalEarned: 0,
            redeemedAmount: 0,
            accruedAmount: 0,
            activationTime: null,
            hasClaimed: true,
            claimTime: now,
            lastUpdated: now,
            isActivated: false,
            nftOwnership: {},
            eligibility: {
              hasRequiredNfts: false,
              requiredNftTypes: [],
              lastChecked: now,
            },
            createdAt: now,
            updatedAt: now,
          };

          await userRef.set(newUser);

          // Sync to wallets collection (non-blocking)
          try {
            const { ensureWalletExists, updateWalletStatus, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
            const { Timestamp } = await import('firebase-admin/firestore');
            
            await ensureWalletExists(address.toLowerCase());
            const wallet = await getWallet(address.toLowerCase());
            
            if (wallet && !wallet.status.hasClaimed) {
              await updateWalletStatus(address.toLowerCase(), {
                status: {
                  ...wallet.status,
                  hasClaimed: true,
                },
                timestamps: {
                  ...wallet.timestamps,
                  claimedAt: Timestamp.now(),
                },
              });
              
              const updatedWallet = await getWallet(address.toLowerCase());
              if (updatedWallet) {
                await categorizeWallet(address.toLowerCase(), updatedWallet);
              }
            }
          } catch (syncError) {
            console.error('Error syncing wallet claim:', syncError);
            // Don't fail the request if sync fails
          }

          // Track claim success in analytics_events (non-blocking)
          try {
            await adminDb.collection('analytics_events').add({
              eventType: 'claim_success',
              walletAddress: address.toLowerCase(),
              timestamp: new Date().toISOString(),
              createdAt: new Date(),
              country: analyticsMetadata.country,
              region: analyticsMetadata.region,
              city: analyticsMetadata.city,
              deviceType: analyticsMetadata.deviceType,
              browser: analyticsMetadata.browser,
              os: analyticsMetadata.os,
              hourOfDay: analyticsMetadata.hourOfDay,
              timeOfDay: analyticsMetadata.timeOfDay,
              metadata: {
                claimTime: now,
              },
            });
          } catch (analyticsError) {
            console.error('Error tracking claim success in analytics:', analyticsError);
          }

          // Track Early Circle claim_success event (non-blocking)
          try {
            const isEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
            const isActive = await isEarlyCircleActive();
            if (isActive && isEarlyCircle) {
              await adminDb.collection('early_circle_events').add({
                eventType: 'claim_success',
                walletAddress: address.toLowerCase(),
                timestamp: Timestamp.now(),
                isEarlyCircle: true,
                source: 'web',
                metadata: {
                  claimTime: now,
                },
              });
            }
          } catch (eventError) {
            console.error('Error tracking Early Circle claim_success event:', eventError);
          }

          console.log('[API USERS] User created successfully:', address);
          return NextResponse.json({ 
            success: true, 
            message: 'Airdrop badge claimed successfully',
            data: newUser 
          });
        }
      } catch (dbError) {
        console.error('[API USERS] Database error during claim update:', dbError);
        
        const errorString = dbError instanceof Error ? dbError.message : String(dbError);
        const reasonCode = extractErrorReason(errorString);

        // Track claim failure in analytics_events (non-blocking)
        try {
          await adminDb.collection('analytics_events').add({
            eventType: 'claim_failed',
            walletAddress: address.toLowerCase(),
            timestamp: new Date().toISOString(),
            createdAt: new Date(),
            country: analyticsMetadata.country,
            region: analyticsMetadata.region,
            city: analyticsMetadata.city,
            deviceType: analyticsMetadata.deviceType,
            browser: analyticsMetadata.browser,
            os: analyticsMetadata.os,
            hourOfDay: analyticsMetadata.hourOfDay,
            timeOfDay: analyticsMetadata.timeOfDay,
            metadata: {
              errorCode: reasonCode,
              errorMessage: errorString,
            },
          });
        } catch (analyticsError) {
          console.error('Error tracking claim failure in analytics:', analyticsError);
        }
        
        // Track Early Circle claim_failed event (non-blocking)
        try {
          const isEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
          const isActive = await isEarlyCircleActive();
          if (isActive && isEarlyCircle) {
            await adminDb.collection('early_circle_events').add({
              eventType: 'claim_failed',
              walletAddress: address.toLowerCase(),
              timestamp: Timestamp.now(),
              isEarlyCircle: true,
              source: 'web',
              metadata: {
                reasonCode,
                rawError: errorString,
              },
            });
          }
        } catch (eventError) {
          console.error('Error tracking Early Circle claim_failed event:', eventError);
        }
        
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to update database. Please try again.',
        }, { status: 500 });
      }
    }

    if (action === 'sync-claim-status') {
      // Sync claim status from on-chain verification
      // This is called when on-chain indicates user has claimed but DB says otherwise
      const { onChainClaimed } = body;
      
      console.log('[API USERS] Syncing claim status from on-chain:', { address, onChainClaimed });
      
      if (!onChainClaimed) {
        return NextResponse.json({ 
          success: false, 
          error: 'onChainClaimed must be true to sync claim status',
        }, { status: 400 });
      }

      try {
        if (userSnap.exists) {
          const userData = userSnap.data() as User;
          
          // Only update if DB says not claimed
          if (!userData.hasClaimed) {
            console.log('[API USERS] Syncing: Updating existing user claim status from false to true:', address);
            
            await userRef.update({
              hasClaimed: true,
              claimTime: now,
              lastUpdated: now,
            });

            const updatedUser = {
              ...userData,
              hasClaimed: true,
              claimTime: now,
              lastUpdated: now,
            };

            console.log('[API USERS] Sync completed successfully:', address);
            return NextResponse.json({ 
              success: true, 
              message: 'Claim status synced from on-chain',
              data: updatedUser 
            });
          } else {
            console.log('[API USERS] Sync: User already marked as claimed in DB:', address);
            return NextResponse.json({ 
              success: true, 
              message: 'Claim status already synced',
              data: userData 
            });
          }
        } else {
          console.log('[API USERS] Syncing: Creating new user with claim status:', address);
          // Create new user with claim status
          const newUser: User = {
            id: address.toLowerCase(),
            address: address.toLowerCase(),
            totalEarned: 0,
            redeemedAmount: 0,
            accruedAmount: 0,
            activationTime: null,
            hasClaimed: true,
            claimTime: now,
            lastUpdated: now,
            isActivated: false,
            nftOwnership: {},
            eligibility: {
              hasRequiredNfts: false,
              requiredNftTypes: [],
              lastChecked: now,
            },
            createdAt: now,
            updatedAt: now,
          };

          await userRef.set(newUser);

          console.log('[API USERS] Sync: User created successfully:', address);
          return NextResponse.json({ 
            success: true, 
            message: 'Claim status synced from on-chain',
            data: newUser 
          });
        }
      } catch (dbError) {
        console.error('[API USERS] Database error during sync:', dbError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to sync claim status. Please try again.',
        }, { status: 500 });
      }
    }

    if (action === 'redeem') {
      if (!userSnap.exists) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found. Please activate first.' 
        }, { status: 404 });
      }

      const userData = userSnap.data() as User;
      if (!userData.isActivated) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not activated' 
        }, { status: 400 });
      }

      const redeemAmount = redeemedAmount || 1000; // Default 1000 preGVT per badge
      const updatedUser = {
        ...userData,
        redeemedAmount: userData.redeemedAmount + redeemAmount,
        totalEarned: userData.redeemedAmount + userData.accruedAmount + redeemAmount,
        lastUpdated: now,
      };

      await userRef.update({
        redeemedAmount: updatedUser.redeemedAmount,
        totalEarned: updatedUser.totalEarned,
        lastUpdated: now,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Claim successful',
        data: updatedUser 
      });
    }

    if (action === 'update-nft-ownership') {
      if (!userSnap.exists) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found. Please activate first.' 
        }, { status: 404 });
      }

      const userData = userSnap.data() as User;
      const updatedUser = {
        ...userData,
        nftOwnership: nftOwnership || userData.nftOwnership,
        lastUpdated: now,
      };

      await userRef.update({
        nftOwnership: updatedUser.nftOwnership,
        lastUpdated: now,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'NFT ownership updated',
        data: updatedUser 
      });
    }

    if (action === 'record-purchase') {
      const { purchaseAmount, tokenAmount, kolId, referrerWallet, txHash } = body;

      console.log('[SERVER DEBUG] record-purchase called:', {
        buyerAddress: address,
        purchaseAmount,
        tokenAmount,
        kolId: kolId || null,
        referrerWallet: referrerWallet || null,
        txHash,
        timestamp: new Date().toISOString(),
      });

      if (!txHash) {
        console.error('[SERVER DEBUG] Missing transaction hash');
        return NextResponse.json({ 
          success: false, 
          error: 'Transaction hash is required' 
        }, { status: 400 });
      }

      // Must have either KOL ID or wallet referral (not both, priority to KOL)
      if (!kolId && !referrerWallet) {
        console.error('[SERVER DEBUG] No referral ID provided:', { kolId, referrerWallet });
        return NextResponse.json({ 
          success: false, 
          error: 'Either KOL ID or referrer wallet address is required' 
        }, { status: 400 });
      }

      // Priority: If both are present, use KOL (as per requirements)
      const useKolReferral = !!kolId;
      const useWalletReferral = !useKolReferral && !!referrerWallet;

      console.log('[SERVER DEBUG] Referral type determination:', {
        useKolReferral,
        useWalletReferral,
        kolId: kolId || null,
        referrerWallet: referrerWallet || null,
      });

      try {
        const userRef = adminDb.collection('users').doc(address.toLowerCase());
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? (userSnap.data() as User) : null;
        
        // Handle wallet referral (simpler - just validate and record)
        if (useWalletReferral && referrerWallet) {
          const referrerWalletLower = referrerWallet.toLowerCase().trim();
          
          console.log('[SERVER DEBUG] Processing wallet referral:', {
            buyerAddress: address.toLowerCase(),
            referrerWallet: referrerWalletLower,
            originalReferrerWallet: referrerWallet,
          });
          
          // Check self-referral
          if (referrerWalletLower === address.toLowerCase()) {
            console.error('[SERVER DEBUG] Self-referral detected:', {
              buyerAddress: address.toLowerCase(),
              referrerWallet: referrerWalletLower,
            });
            return NextResponse.json({ 
              success: false, 
              error: 'Cannot refer yourself' 
            }, { status: 400 });
          }

          // Validate wallet address format
          if (!referrerWalletLower.startsWith('0x') || referrerWalletLower.length !== 42) {
            console.error('[SERVER DEBUG] Invalid wallet address format:', {
              referrerWallet: referrerWalletLower,
              startsWith0x: referrerWalletLower.startsWith('0x'),
              length: referrerWalletLower.length,
            });
            return NextResponse.json({ 
              success: false, 
              error: 'Invalid wallet address format' 
            }, { status: 400 });
          }

          const purchaseAmountUsd = parseFloat(purchaseAmount || '0');

          console.log('[SERVER DEBUG] Purchase amount conversion:', {
            originalPurchaseAmount: purchaseAmount,
            purchaseAmountType: typeof purchaseAmount,
            parsedAmount: purchaseAmountUsd,
            isNaN: isNaN(purchaseAmountUsd),
            isFinite: isFinite(purchaseAmountUsd),
          });

          if (isNaN(purchaseAmountUsd) || !isFinite(purchaseAmountUsd) || purchaseAmountUsd <= 0) {
            console.error('[SERVER DEBUG] Invalid purchase amount:', {
              purchaseAmount,
              purchaseAmountUsd,
            });
            return NextResponse.json({ 
              success: false, 
              error: 'Invalid purchase amount' 
            }, { status: 400 });
          }

          const purchaseData = {
            buyerAddress: address.toLowerCase(),
            referrerWallet: referrerWalletLower,
            purchaseAmount: purchaseAmountUsd,
            tokenAmount: parseFloat(tokenAmount || '0'),
            txHash: txHash.trim(),
            timestamp: now,
            createdAt: now,
            isKolReferral: false,
          };

          console.log('[SERVER DEBUG] Recording wallet referral purchase:', {
            ...purchaseData,
            purchaseAmountFormatted: `$${purchaseAmountUsd.toFixed(2)}`,
          });

          // Record purchase with wallet referral
          const purchaseRef = adminDb.collection('purchases').doc();
          await purchaseRef.set(purchaseData);

          console.log('[SERVER DEBUG] Wallet referral purchase recorded:', {
            purchaseId: purchaseRef.id,
            buyerAddress: purchaseData.buyerAddress,
            referrerWallet: purchaseData.referrerWallet,
            purchaseAmount: purchaseData.purchaseAmount,
            isKolReferral: purchaseData.isKolReferral,
          });

          // Track Early Circle referral_attribution (non-blocking)
          try {
            const isReferrerEarlyCircle = await isWalletEarlyCircle(referrerWalletLower);
            const isReferredEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
            const isActive = await isEarlyCircleActive();
            
            if (isActive && isReferrerEarlyCircle) {
              await adminDb.collection('early_circle_events').add({
                eventType: 'referral_attribution',
                walletAddress: referrerWalletLower,
                timestamp: Timestamp.now(),
                isEarlyCircle: true,
                source: 'web',
                metadata: {
                  referrerWallet: referrerWalletLower,
                  referredWallet: address.toLowerCase(),
                  source: 'wallet',
                },
              });

              // Check if referral should be validated (referred wallet has claimed and bought)
              const referredWalletDoc = await adminDb.collection('wallets').doc(address.toLowerCase()).get();
              const referredWalletData = referredWalletDoc.data();
              const hasClaimed = referredWalletData?.status?.hasClaimed === true;
              const hasBought = referredWalletData?.status?.hasBought === true;

              if (hasClaimed && hasBought && isReferredEarlyCircle) {
                // Validate the referral
                await adminDb.collection('early_circle_events').add({
                  eventType: 'referral_validated',
                  walletAddress: referrerWalletLower,
                  timestamp: Timestamp.now(),
                  isEarlyCircle: true,
                  source: 'web',
                  metadata: {
                    referrerWallet: referrerWalletLower,
                    referredWallet: address.toLowerCase(),
                    hasClaimed: true,
                    hasFirstBuy: true,
                    isValidEarlyCircleReferral: true,
                  },
                });
              }
            }
          } catch (eventError) {
            console.error('Error tracking Early Circle referral:', eventError);
          }

          // Update or create user (don't set referrerOf for wallet referrals)
          if (userSnap.exists) {
            await userRef.update({
              updatedAt: now,
            });
          } else {
            const newUser: User = {
              id: address.toLowerCase(),
              address: address.toLowerCase(),
              totalEarned: 0,
              redeemedAmount: 0,
              accruedAmount: 0,
              activationTime: null,
              lastUpdated: now,
              isActivated: false,
              hasClaimed: false,
              nftOwnership: {},
              eligibility: {
                hasRequiredNfts: false,
                requiredNftTypes: [],
                lastChecked: now,
              },
              createdAt: now,
              updatedAt: now,
            };
            await userRef.set(newUser);
          }

          return NextResponse.json({ 
            success: true, 
            message: 'Purchase recorded with wallet referral',
            data: { referralType: 'wallet', referrerWallet: referrerWalletLower }
          });
        }

        // Handle KOL referral (existing logic)
        // Immutable referrerOf: Only set if not already set
        let referrerKolId: string | undefined = undefined;
        let kolWallet: string | undefined = undefined;
        let kolTier: string | undefined = undefined;
        let kolRefCode: string | undefined = undefined;
        
        if (!userData?.referrerOf) {
          // Validate KOL ID and get KOL info directly from database
          const kolIdTrimmed = kolId.trim();
          
          // Extract 6-digit code from formats like "AGV-KOL775002" or "775002"
          const kolIdMatch = kolIdTrimmed.match(/(\d{6})/);
          const sixDigitCode = kolIdMatch ? kolIdMatch[1] : null;
          
          let kolQuery;
          
          // Strategy 1: Try to find by refCode (6-digit code) - most common case
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
              const matches = 
                kol.refCode === kolIdTrimmed || 
                (sixDigitCode && kol.refCode === sixDigitCode) ||
                doc.id === kolIdTrimmed ||
                (sixDigitCode && kol.refCode?.includes(sixDigitCode));
              
              if (matches) {
                kolQuery = { docs: [doc], empty: false } as any;
                break;
              }
            }
          }
          
          if (kolQuery && !kolQuery.empty) {
            const kolDoc = kolQuery.docs[0];
            const kol = kolDoc.data();
            const kolIdFinal = kolDoc.id;
            
            // Anti-self-ref detection: Check if buyer's wallet matches KOL's wallet
            if (kol.wallet && kol.wallet.toLowerCase() === address.toLowerCase()) {
              return NextResponse.json({ 
                success: false, 
                error: 'Cannot refer yourself' 
              }, { status: 400 });
            }
            
            // Check if KOL is eligible for purchase referrals
            // For agents: Level-1 = 12%, Level-2 = 5%
            // For regular KOLs: Tier-based rates (Partner 2%, Ambassador 1%, Pioneer 0%)
            const commissionRate = await getPurchaseCommissionRate(
              kolIdFinal,
              kol.tier,
              kol.customCommissionRate
            );
            
            // Only reject if commission is 0 (not eligible)
            // Agents always get commission, so this check is mainly for regular KOLs
            if (commissionRate === 0 && !kol.agentLevel) {
              return NextResponse.json({ 
                success: false, 
                error: 'KOL tier not eligible for purchase referrals' 
              }, { status: 400 });
            }
            
            referrerKolId = kolIdFinal;
            kolWallet = kol.wallet;
            kolTier = kol.tier;
            kolRefCode = kol.refCode;
          } else {
            return NextResponse.json({ 
              success: false, 
              error: `Invalid or inactive KOL ID: ${kolIdTrimmed}. Please check the KOL reference code.` 
            }, { status: 404 });
          }
        } else {
          // User already has a referrer, use it
          referrerKolId = userData.referrerOf;
          
          // Get KOL info for existing referrer - validate it still exists and is active
          try {
            // Try by document ID first
            let kolDoc = await adminDb.collection('kol_profiles').doc(referrerKolId).get();
            
            // If not found by document ID, try by refCode
            if (!kolDoc.exists) {
              const kolIdMatch = referrerKolId.match(/(\d{6})/);
              if (kolIdMatch) {
                const sixDigitCode = kolIdMatch[1];
                const refCodeQuery = await adminDb.collection('kol_profiles')
                  .where('refCode', '==', sixDigitCode)
                  .where('status', '==', 'active')
                  .limit(1)
                  .get();
                
                if (!refCodeQuery.empty) {
                  kolDoc = refCodeQuery.docs[0];
                }
              }
            }
            
            if (kolDoc.exists) {
              const kol = kolDoc.data();
              if (kol?.status === 'active') {
                kolWallet = kol?.wallet;
                kolTier = kol?.tier;
                kolRefCode = kol?.refCode;
                // Update referrerKolId to actual document ID
                referrerKolId = kolDoc.id;
              } else {
                // KOL is no longer active, don't use it
                referrerKolId = undefined;
              }
            } else {
              // KOL not found, don't use it
              referrerKolId = undefined;
            }
          } catch (error) {
            console.error('Error fetching existing KOL info:', error);
            referrerKolId = undefined;
          }
        }

        // Calculate commission if we have a valid KOL
        const purchaseAmountUsd = parseFloat(purchaseAmount || '0');
        let commission = 0;
        if (referrerKolId && kolTier) {
          // Get KOL data for custom commission rate if needed
          let customRate: number | undefined = undefined;
          try {
            const kolDoc = await adminDb.collection('kol_profiles').doc(referrerKolId).get();
            if (kolDoc.exists) {
              customRate = kolDoc.data()?.customCommissionRate;
            }
          } catch (error) {
            console.error('Error fetching KOL for custom rate:', error);
          }
          
          const commissionRate = await getPurchaseCommissionRate(
            referrerKolId,
            kolTier,
            customRate
          );
          commission = purchaseAmountUsd * commissionRate;
        }

        // Record the purchase in a separate collection for tracking referrals
        // Only record if we have a validated KOL ID
        if (!referrerKolId) {
          return NextResponse.json({ 
            success: false, 
            error: 'Invalid KOL ID - purchase not recorded' 
          }, { status: 400 });
        }
        
        const purchaseRef = adminDb.collection('purchases').doc();
        await purchaseRef.set({
          buyerAddress: address.toLowerCase(),
          kolId: referrerKolId,
          kolWallet: kolWallet || '',
          purchaseAmount: purchaseAmountUsd,
          tokenAmount: parseFloat(tokenAmount || '0'),
          txHash: txHash.trim(),
          timestamp: now,
          createdAt: now,
          isKolReferral: true,
        });

        // Update user's referrerOf if not set (immutable - set once)
        if (!userData?.referrerOf && referrerKolId) {
          if (userSnap.exists) {
            await userRef.update({
              referrerOf: referrerKolId,
              updatedAt: now,
            });
          } else {
            // Create user if doesn't exist
            const newUser: User = {
              id: address.toLowerCase(),
              address: address.toLowerCase(),
              totalEarned: 0,
              redeemedAmount: 0,
              accruedAmount: 0,
              referrerOf: referrerKolId,
              activationTime: null,
              lastUpdated: now,
              isActivated: false,
              nftOwnership: {},
              eligibility: {
                hasRequiredNfts: false,
                requiredNftTypes: [],
                lastChecked: now,
              },
              createdAt: now,
              updatedAt: now,
            };
            await userRef.set(newUser);
          }
        }

        // Record purchase event and update rewards
        // Always create purchase event if we have a valid KOL to track referrals
        if (referrerKolId) {
          try {
            // Check for duplicate transaction
            const existingPurchase = await adminDb.collection('purchase_events')
              .where('txHash', '==', txHash.trim())
              .limit(1)
              .get();
            
            if (existingPurchase.empty) {
              const purchaseEvent = {
                id: uuidv4(),
                kolId: referrerKolId,
                kolRefCode: kolRefCode || '',
                wallet: address.toLowerCase(),
                txHash: txHash.trim(),
                purchaseAmount: purchaseAmountUsd,
                commission: commission || 0,
                commissionRate: await getPurchaseCommissionRate(
                  referrerKolId || '',
                  kolTier || '',
                  undefined
                ),
                tier: kolTier || '',
                timestamp: new Date(now),
                campaign: 'G3'
              };
              
              await adminDb.collection('purchase_events').doc(purchaseEvent.id).set(purchaseEvent);
              
              // Update KOL rewards ledger only if commission > 0
              if (commission > 0) {
                await updateKolRewards(referrerKolId, commission);
              }
            }
          } catch (error) {
            console.error('Error recording purchase event:', error);
            // Don't fail the purchase if reward recording fails
          }
        }

        // Sync to wallets collection (non-blocking)
        try {
          const { ensureWalletExists, updateWalletStatus, categorizeWallet, getWallet } = await import('@/lib/wallet-management');
          const { Timestamp } = await import('firebase-admin/firestore');
          
          await ensureWalletExists(address.toLowerCase());
          const wallet = await getWallet(address.toLowerCase());
          
          if (wallet && !wallet.status.hasBought) {
            await updateWalletStatus(address.toLowerCase(), {
              status: {
                ...wallet.status,
                hasBought: true,
              },
              timestamps: {
                ...wallet.timestamps,
                firstBuyAt: Timestamp.now(),
              },
            });
            
            const updatedWallet = await getWallet(address.toLowerCase());
            if (updatedWallet) {
              await categorizeWallet(address.toLowerCase(), updatedWallet);
            }
          }
        } catch (syncError) {
          console.error('Error syncing wallet purchase:', syncError);
          // Don't fail the request if sync fails
        }

        // Track Early Circle buy_success event (non-blocking)
        try {
          const isEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
          const isActive = await isEarlyCircleActive();
          if (isActive && isEarlyCircle) {
            // Check if this is first buy in Early Circle window
            const config = await getEarlyCircleConfig();
            const purchaseEvents = await adminDb.collection('purchase_events')
              .where('wallet', '==', address.toLowerCase())
              .orderBy('timestamp', 'asc')
              .get();
            
            const isFirstBuy = purchaseEvents.empty || purchaseEvents.docs.length === 1;
            
            await adminDb.collection('early_circle_events').add({
              eventType: 'buy_success',
              walletAddress: address.toLowerCase(),
              timestamp: Timestamp.now(),
              isEarlyCircle: true,
              source: 'web',
              metadata: {
                txHash: txHash.trim(),
                assetPair: 'USDT/preGVT',
                amountNormalised: purchaseAmountUsd,
                isFirstBuy,
              },
            });

            // Check if this wallet was referred and validate referral if conditions are met
            const referralAttribution = await adminDb.collection('early_circle_events')
              .where('eventType', '==', 'referral_attribution')
              .where('metadata.referredWallet', '==', address.toLowerCase())
              .limit(1)
              .get();

            if (!referralAttribution.empty) {
              const attribution = referralAttribution.docs[0].data();
              const referrerWallet = attribution.walletAddress;
              const referrerIsEarlyCircle = await isWalletEarlyCircle(referrerWallet);
              
              // Check if referred wallet has claimed
              const walletDoc = await adminDb.collection('wallets').doc(address.toLowerCase()).get();
              const walletData = walletDoc.data();
              const hasClaimed = walletData?.status?.hasClaimed === true;

              // If claimed and this is first buy, validate the referral
              if (hasClaimed && isFirstBuy && referrerIsEarlyCircle) {
                // Check if already validated
                const existingValidation = await adminDb.collection('early_circle_events')
                  .where('eventType', '==', 'referral_validated')
                  .where('walletAddress', '==', referrerWallet)
                  .where('metadata.referredWallet', '==', address.toLowerCase())
                  .limit(1)
                  .get();

                if (existingValidation.empty) {
                  await adminDb.collection('early_circle_events').add({
                    eventType: 'referral_validated',
                    walletAddress: referrerWallet,
                    timestamp: Timestamp.now(),
                    isEarlyCircle: true,
                    source: 'web',
                    metadata: {
                      referrerWallet,
                      referredWallet: address.toLowerCase(),
                      hasClaimed: true,
                      hasFirstBuy: true,
                      isValidEarlyCircleReferral: true,
                    },
                  });
                }
              }
            }
          }
        } catch (eventError) {
          console.error('Error tracking Early Circle buy_success event:', eventError);
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Purchase recorded successfully',
          data: { 
            purchaseId: purchaseRef.id,
            referrerSet: !!referrerKolId && !userData?.referrerOf,
            commission: commission
          }
        });
      } catch (error) {
        console.error('Error recording purchase:', error);
        
        // Track Early Circle buy_failed event (non-blocking)
        try {
          const isEarlyCircle = await isWalletEarlyCircle(address.toLowerCase());
          const isActive = await isEarlyCircleActive();
          if (isActive && isEarlyCircle) {
            const errorString = error instanceof Error ? error.message : String(error);
            const reasonCode = extractErrorReason(errorString);
            await adminDb.collection('early_circle_events').add({
              eventType: 'buy_failed',
              walletAddress: address.toLowerCase(),
              timestamp: Timestamp.now(),
              isEarlyCircle: true,
              source: 'web',
              metadata: {
                reasonCode,
                rawError: errorString,
              },
            });
          }
        } catch (eventError) {
          console.error('Error tracking Early Circle buy_failed event:', eventError);
        }
        
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to record purchase' 
        }, { status: 500 });
      }
    }

    if (action === 'update-eligibility') {
      if (!userSnap.exists) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found. Please activate first.' 
        }, { status: 404 });
      }

      const userData = userSnap.data() as User;
      const updatedUser = {
        ...userData,
        eligibility: eligibility || userData.eligibility,
        lastUpdated: now,
      };

      await userRef.update({
        eligibility: updatedUser.eligibility,
        lastUpdated: now,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Eligibility updated',
        data: updatedUser 
      });
    }

    if (action === 'sync-stake') {
      const { stakedAmount } = body;
      
      if (!userSnap.exists) {
        // Create user if doesn't exist
        const newUser: User = {
          id: address.toLowerCase(),
          address: address.toLowerCase(),
          totalEarned: 0,
          redeemedAmount: 0,
          accruedAmount: 0,
          stakedAmount: stakedAmount || 0,
          activationTime: null,
          lastUpdated: now,
          isActivated: false,
          nftOwnership: {},
          eligibility: {
            hasRequiredNfts: false,
            requiredNftTypes: [],
            lastChecked: now,
          },
          createdAt: now,
          updatedAt: now,
        };

        await userRef.set(newUser);


        return NextResponse.json({ 
          success: true, 
          message: 'Staked amount synced',
          data: newUser 
        });
      }

      const userData = userSnap.data() as User;
      const updatedUser = {
        ...userData,
        stakedAmount: stakedAmount !== undefined ? stakedAmount : (userData.stakedAmount || 0),
        lastUpdated: now,
      };

      await userRef.update({
        stakedAmount: updatedUser.stakedAmount,
        lastUpdated: now,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Staked amount synced',
        data: updatedUser 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
