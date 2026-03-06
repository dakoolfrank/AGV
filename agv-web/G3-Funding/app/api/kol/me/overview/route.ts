import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { KOLDashboardData, KOLProfile, RewardsLedger, PostSubmission, PayoutRequest } from '@/lib/types';
import { getCurrentPeriod } from '@/lib/rewards-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the KOL ID from the authenticated user
    // For now, we'll get it from the user's email in the request
    const userEmail = request.headers.get('x-user-email');
    if (!userEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Find KOL profile by email
    const kolQuery = await db.collection('kol_profiles')
      .where('email', '==', userEmail)
      .limit(1)
      .get();
    
    if (kolQuery.empty) {
      return NextResponse.json({ error: 'KOL profile not found' }, { status: 404 });
    }
    
    const kolId = kolQuery.docs[0].id;
    
    // Get KOL profile
    const kolDoc = await db.collection('kol_profiles').doc(kolId).get();
    if (!kolDoc.exists) {
      return NextResponse.json({ error: 'KOL not found' }, { status: 404 });
    }
    
    const profileData = kolDoc.data();
    const profile = { id: kolDoc.id, ...profileData } as KOLProfile & {
      role?: string;
      type?: string;
      agentType?: string;
      agentLevel?: number;
      sGVTBalance?: number;
    };
    
    // Check if user is an agent by checking agent_allocations collection (source of truth)
    // This is the same collection used by agv-protocol-app agent table
    const walletRaw = profile.wallet?.trim();
    const walletLower = walletRaw?.toLowerCase();
    let isAgentFromAllocation = false;
    let agentAllocationData: {
      agentLevel?: number;
      sGVTAllocated?: number;
      kolId?: string;
      wallet?: string;
    } | null = null;
    
    // Try querying by wallet first
    if (walletLower) {
      try {
        const normalizedWallet = walletLower.trim().toLowerCase();
        const allocationQuery = await db.collection('agent_allocations')
          .where('wallet', '==', normalizedWallet)
          .limit(1)
          .get();
        
        if (!allocationQuery.empty) {
          isAgentFromAllocation = true;
          agentAllocationData = allocationQuery.docs[0].data();
        }
      } catch {
        // Silently fail and continue with profile-based detection
      }
    }
    
    // If not found by wallet, try by KOL ID (fallback)
    if (!isAgentFromAllocation && kolId) {
      try {
        const allocationQueryByKolId = await db.collection('agent_allocations')
          .where('kolId', '==', kolId)
          .limit(1)
          .get();
        
        if (!allocationQueryByKolId.empty) {
          isAgentFromAllocation = true;
          agentAllocationData = allocationQueryByKolId.docs[0].data() as typeof agentAllocationData;
        }
      } catch {
        // Silently fail and continue with profile-based detection
      }
    }
    
    // Last resort: Get all allocations and filter in memory
    if (!isAgentFromAllocation && walletLower) {
      try {
        const allAllocations = await db.collection('agent_allocations').get();
        const matchingAllocation = allAllocations.docs.find(doc => {
          const data = doc.data();
          const docWallet = data.wallet?.toLowerCase()?.trim();
          return docWallet === walletLower || docWallet === walletRaw?.toLowerCase()?.trim();
        });
        
        if (matchingAllocation) {
          isAgentFromAllocation = true;
          agentAllocationData = matchingAllocation.data() as typeof agentAllocationData;
        }
      } catch {
        // Silently fail and continue with profile-based detection
      }
    }
    
    if (profileData?.sGVTBalance !== undefined) {
      profile.sGVTBalance = profileData.sGVTBalance;
    }
    // Include role/type/agentType field to identify agents
    if (profileData?.role !== undefined) {
      profile.role = profileData.role;
    }
    if (profileData?.type !== undefined) {
      profile.type = profileData.type;
    }
    // Check for agentType (set by agv-protocol-app agent setup)
    if (profileData?.agentType !== undefined) {
      profile.agentType = profileData.agentType;
      // Also set role/type for backward compatibility
      if (!profile.role && !profile.type) {
        profile.role = 'agent';
        profile.type = 'agent';
      }
    }
    // Check for agentLevel (set by agv-protocol-app agent setup)
    if (profileData?.agentLevel !== undefined) {
      profile.agentLevel = profileData.agentLevel;
    }
    
    // If found in agent_allocations, ensure agent fields are set
    if (isAgentFromAllocation && agentAllocationData) {
      profile.role = 'agent';
      profile.type = 'agent';
      profile.agentType = agentAllocationData.agentLevel === 1 ? 'master_agent' : 'sub_agent';
      profile.agentLevel = agentAllocationData.agentLevel;
      // Use sGVT from allocation if available, otherwise from profile
      if (agentAllocationData.sGVTAllocated !== undefined) {
        profile.sGVTBalance = agentAllocationData.sGVTAllocated;
      } else if (profileData?.sGVTBalance === undefined) {
        profile.sGVTBalance = 1000; // Default for agents
      }
    } else {
      // If profile has agent fields but allocation wasn't found, still mark as agent
      // This handles the case where projects use different Firebase instances
      if (profile.agentType || profile.agentLevel !== undefined || profile.sGVTBalance !== undefined) {
        if (!profile.role) profile.role = 'agent';
        if (!profile.type) profile.type = 'agent';
      }
    }
    const currentPeriod = getCurrentPeriod();
    
    // Get current period rewards
    const rewardsDoc = await db.collection('rewards_ledger')
      .doc(`${kolId}_${currentPeriod}`)
      .get();
    
    const rewards = rewardsDoc.exists ? rewardsDoc.data() as RewardsLedger : null;
    
    // Get current period posts (simplified query to avoid index requirement)
    const postsQuery = await db.collection('post_submissions')
      .where('kolId', '==', kolId)
      .get();
    
    // Filter by date in memory to avoid index requirement
    const periodStart = getPeriodStart(currentPeriod);
    const posts = postsQuery.docs
      .map(doc => doc.data() as PostSubmission)
      .filter(post => post.submittedAt && new Date(post.submittedAt) >= periodStart);
    
    // Get current period mints (simplified query to avoid index requirement)
    const mintsQuery = await db.collection('mint_events')
      .where('creditedKolId', '==', kolId)
      .get();
    
    // Filter by date in memory to avoid index requirement
    const mints = mintsQuery.docs
      .map(doc => doc.data())
      .filter(mint => mint.timestamp && new Date(mint.timestamp) >= periodStart);
    
    // Get current period purchase referrals
    const purchasesQuery = await db.collection('purchase_events')
      .where('kolId', '==', kolId)
      .get();
    
    // Filter by date in memory to avoid index requirement
    const purchases = purchasesQuery.docs
      .map(doc => {
        const data = doc.data();
        // Handle both Firestore Timestamp and Date objects
        let timestamp = data.timestamp;
        if (timestamp && timestamp.toDate) {
          timestamp = timestamp.toDate();
        } else if (timestamp && typeof timestamp === 'string') {
          timestamp = new Date(timestamp);
        } else if (!(timestamp instanceof Date)) {
          timestamp = null;
        }
        return { ...data, timestamp };
      })
      .filter(purchase => {
        if (!purchase.timestamp) {
          return false;
        }
        return purchase.timestamp >= periodStart;
      });
    
    // Calculate total purchase commission for current period
    const purchaseCommission = purchases.reduce((sum, purchase) => {
      const purchaseData = purchase as { commission?: number };
      return sum + (purchaseData.commission || 0);
    }, 0);
    
    // Round to avoid floating point precision issues
    const roundedCommission = Math.round(purchaseCommission * 1000000) / 1000000;
    
    // Get team members (L1 and L2) with error handling
    let teamData;
    try {
      teamData = await getTeamData(kolId);
    } catch {
      teamData = { l1KOLs: [], l2KOLs: [] };
    }
    
    // Get payout information with error handling
    let payoutData;
    try {
      payoutData = await getPayoutData(kolId);
    } catch {
      payoutData = { accrued: 0, claimable: 0, vested: 0, pendingRequests: [] };
    }
    
    // Calculate dashboard data with safe fallbacks
    const dashboardData: KOLDashboardData = {
      profile,
      currentPeriod: {
        ownPosts: {
          submitted: posts.length,
          approved: posts.filter(p => p.status === 'approved').length,
          m1Achieved: posts.filter(p => p.milestones?.M1?.achieved).length,
          m2Achieved: posts.filter(p => p.milestones?.M2?.achieved).length,
          m3Achieved: posts.filter(p => p.milestones?.M3?.achieved).length,
          totalReward: rewards?.ownPostReward || 0
        },
        ownConversions: {
          clicks: 0, // TODO: Implement click tracking
          mints: mints.length,
          conversionRate: 0, // TODO: Calculate from clicks
          commission: rewards?.ownMintsCommission || 0, // Only mint commission from other app
          purchaseReferrals: purchases.length,
          purchaseCommission: roundedCommission // Purchase commission from buypage
        },
        overrides: {
          l1Commission: rewards?.l1OverrideCommission || 0,
          l2Commission: rewards?.l2OverrideCommission || 0
        },
        earnings: {
          total: rewards?.totalEarned || 0,
          immediate: rewards?.immediateAmount || 0,
          vested: rewards?.vestedAmount || 0
        }
      },
      team: teamData || { l1KOLs: [], l2KOLs: [] },
      payouts: payoutData || { accrued: 0, claimable: 0, vested: 0, pendingRequests: [] },
      compliance: {
        pendingPosts: posts.filter(p => p.status === 'pending').length,
        approvedPosts: posts.filter(p => p.status === 'approved').length,
        rejectedPosts: posts.filter(p => p.status === 'rejected').length,
        strikes: 0 // TODO: Implement strike tracking
      }
    };
    
    return NextResponse.json(dashboardData);
    
  } catch {
    // Log error for monitoring but don't expose details to client
    
    // If we have a profile but other data failed, return basic profile data
    const userEmail = request.headers.get('x-user-email');
    if (userEmail) {
      try {
        const kolQuery = await db.collection('kol_profiles')
          .where('email', '==', userEmail)
          .limit(1)
          .get();
        
        if (!kolQuery.empty) {
          const profile = { id: kolQuery.docs[0].id, ...kolQuery.docs[0].data() } as KOLProfile;
          
          // Return basic dashboard with just profile data
          const basicDashboard = {
            profile,
            currentPeriod: {
              ownPosts: { submitted: 0, approved: 0, m1Achieved: 0, m2Achieved: 0, m3Achieved: 0, totalReward: 0 },
              ownConversions: { clicks: 0, mints: 0, conversionRate: 0, commission: 0 },
              overrides: { l1Commission: 0, l2Commission: 0 },
              earnings: { total: 0, immediate: 0, vested: 0 }
            },
            team: { l1KOLs: [], l2KOLs: [] },
            payouts: { accrued: 0, claimable: 0, vested: 0, pendingRequests: [] },
            compliance: { pendingPosts: 0, approvedPosts: 0, rejectedPosts: 0, strikes: 0 }
          };
          
          return NextResponse.json(basicDashboard);
        }
      } catch {
        // Fallback error - return generic error
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

async function getTeamData(kolId: string) {
  // Get L1 KOLs (direct recruits)
  const l1Query = await db.collection('kol_recruits')
    .where('sponsorKolId', '==', kolId)
    .get();
  
  const l1KolIds = l1Query.docs.map(doc => doc.data().childKolId);
  
  const l1KOLs = [];
  for (const childId of l1KolIds) {
    const kolDoc = await db.collection('kol_profiles').doc(childId).get();
    if (kolDoc.exists) {
      const kol = kolDoc.data() as KOLProfile;
      
      // Get recent performance data (simplified query)
      const currentPeriod = getCurrentPeriod();
      const mintsQuery = await db.collection('mint_events')
        .where('creditedKolId', '==', childId)
        .get();
      
      const periodStart = getPeriodStart(currentPeriod);
      const recentMints = mintsQuery.docs
        .map(doc => doc.data())
        .filter(mint => mint.timestamp && new Date(mint.timestamp) >= periodStart);
      
      const rewardsDoc = await db.collection('rewards_ledger')
        .doc(`${childId}_${currentPeriod}`)
        .get();
      
      const rewards = rewardsDoc.exists ? rewardsDoc.data() as RewardsLedger : null;
      
      l1KOLs.push({
        id: childId,
        displayName: kol.displayName,
        tier: kol.tier,
        status: kol.status,
        mints: recentMints.length,
        commissionGenerated: rewards?.ownMintsCommission || 0,
        lastActive: kol.lastActiveAt || kol.createdAt
      });
    }
  }
  
  // Get L2 KOLs (recruits of recruits)
  const l2KOLs = [];
  for (const l1KolId of l1KolIds) {
    const l2Query = await db.collection('kol_recruits')
      .where('sponsorKolId', '==', l1KolId)
      .get();
    
    for (const l2Doc of l2Query.docs) {
      const l2KolId = l2Doc.data().childKolId;
      const kolDoc = await db.collection('kol_profiles').doc(l2KolId).get();
      
      if (kolDoc.exists) {
        const kol = kolDoc.data() as KOLProfile;
        
        const currentPeriod = getCurrentPeriod();
        const mintsQuery = await db.collection('mint_events')
          .where('creditedKolId', '==', l2KolId)
          .get();
        
        const periodStart = getPeriodStart(currentPeriod);
        const recentMints = mintsQuery.docs
          .map(doc => doc.data())
          .filter(mint => mint.timestamp && new Date(mint.timestamp) >= periodStart);
        
        const rewardsDoc = await db.collection('rewards_ledger')
          .doc(`${l2KolId}_${currentPeriod}`)
          .get();
        
        const rewards = rewardsDoc.exists ? rewardsDoc.data() as RewardsLedger : null;
        
        l2KOLs.push({
          id: l2KolId,
          displayName: kol.displayName,
          tier: kol.tier,
          status: kol.status,
          mints: recentMints.length,
          commissionGenerated: rewards?.ownMintsCommission || 0,
          lastActive: kol.lastActiveAt || kol.createdAt,
          parentId: l1KolId
        });
      }
    }
  }
  
  return { l1KOLs, l2KOLs };
}

async function getPayoutData(kolId: string) {
  // Get all rewards ledgers for this KOL
  const rewardsQuery = await db.collection('rewards_ledger')
    .where('kolId', '==', kolId)
    .get();
  
  let accrued = 0;
  let claimable = 0;
  let vested = 0;
  
  for (const doc of rewardsQuery.docs) {
    const rewards = doc.data() as RewardsLedger;
    accrued += rewards.totalEarned;
    claimable += rewards.immediateAmount;
    vested += rewards.vestedAmount;
  }
  
  // Get pending payout requests
  const payoutQuery = await db.collection('payout_requests')
    .where('kolId', '==', kolId)
    .where('status', 'in', ['pending', 'processing'])
    .get();
  
  const pendingRequests = payoutQuery.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PayoutRequest[];
  
  return {
    accrued,
    claimable,
    vested,
    pendingRequests
  };
}

function getPeriodStart(period: string): Date {
  // Parse period like "2024-W42" to get start of that week
  const [year, weekStr] = period.split('-W');
  const week = parseInt(weekStr);
  
  const jan1 = new Date(parseInt(year), 0, 1);
  const daysToAdd = (week - 1) * 7 - jan1.getDay();
  
  return new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}
