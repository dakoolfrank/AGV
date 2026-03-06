import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase-admin';
import { PostSubmission } from '@/lib/types';
import { checkMilestones, validatePostSubmission, DEFAULT_SOCIAL_MINING_CONFIG } from '@/lib/rewards-engine';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface SubmitPostRequest {
  kolId: string;
  postUrl: string;
  platform: string;
  content: string;
  publishedAt: string;
  screenshots: string[];
  utmParams?: string;
  metrics: {
    likes: number;
    reposts: number;
    comments: number;
    views?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      kolId,
      postUrl,
      platform,
      content,
      publishedAt,
      screenshots,
      utmParams,
      metrics
    }: SubmitPostRequest = await request.json();
    
    // Validate required fields
    if (!kolId || !postUrl || !platform || !publishedAt || !metrics) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Get KOL profile
    const kolDoc = await db.collection('kol_profiles').doc(kolId).get();
    if (!kolDoc.exists) {
      return NextResponse.json({ error: 'KOL not found' }, { status: 404 });
    }
    
    const kol = kolDoc.data();
    if (kol.status !== 'active') {
      return NextResponse.json({ error: 'KOL account not active' }, { status: 403 });
    }
    
    // Check for duplicate post URL
    const existingPost = await db.collection('post_submissions')
      .where('postUrl', '==', postUrl)
      .limit(1)
      .get();
    
    if (!existingPost.empty) {
      return NextResponse.json({ 
        error: 'Post already submitted' 
      }, { status: 409 });
    }
    
    // Get recent posts for fraud validation
    const recentPostsQuery = await db.collection('post_submissions')
      .where('kolId', '==', kolId)
      .orderBy('submittedAt', 'desc')
      .limit(10)
      .get();
    
    const recentPosts = recentPostsQuery.docs.map(doc => ({
      submittedAt: doc.data().submittedAt.toDate(),
      platform: doc.data().platform
    }));
    
    // Validate submission for fraud
    const fraudCheck = validatePostSubmission(kolId, recentPosts, metrics);
    if (!fraudCheck.isValid) {
      return NextResponse.json({ 
        error: 'Submission failed validation',
        violations: fraudCheck.violations,
        riskScore: fraudCheck.riskScore
      }, { status: 400 });
    }
    
    // Calculate milestones
    const milestoneResults = checkMilestones(kol.tier, metrics, 0, 100); // 0 mints initially, $100 base reward
    
    // Create submission window (7 days from publish)
    const publishDate = new Date(publishedAt);
    const windowStart = publishDate;
    const windowEnd = new Date(publishDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Create post submission
    const postSubmission: PostSubmission = {
      id: uuidv4(),
      kolId,
      postUrl,
      platform,
      content,
      publishedAt: publishDate,
      submittedAt: new Date(),
      screenshots: screenshots || [],
      utmParams,
      likes: metrics.likes,
      reposts: metrics.reposts,
      comments: metrics.comments,
      views: metrics.views,
      milestones: {
        M1: {
          achieved: milestoneResults.M1.achieved,
          timestamp: milestoneResults.M1.achieved ? new Date() : undefined,
          payout: milestoneResults.M1.payout
        },
        M2: {
          achieved: milestoneResults.M2.achieved,
          timestamp: milestoneResults.M2.achieved ? new Date() : undefined,
          payout: milestoneResults.M2.payout
        },
        M3: {
          achieved: milestoneResults.M3.achieved,
          timestamp: milestoneResults.M3.achieved ? new Date() : undefined,
          payout: milestoneResults.M3.payout,
          mintsLinked: 0
        }
      },
      status: 'pending',
      windowStartAt: windowStart,
      windowEndAt: windowEnd,
      campaign: 'G3'
    };
    
    // Save to Firestore
    await db.collection('post_submissions').doc(postSubmission.id).set({
      ...postSubmission,
      publishedAt: publishDate,
      submittedAt: new Date(),
      windowStartAt: windowStart,
      windowEndAt: windowEnd
    });
    
    // If any milestones are achieved, update rewards immediately
    if (milestoneResults.M1.achieved || milestoneResults.M2.achieved || milestoneResults.M3.achieved) {
      await updatePostRewards(kolId, postSubmission);
    }
    
    return NextResponse.json({ 
      success: true, 
      postId: postSubmission.id,
      milestones: {
        M1: milestoneResults.M1,
        M2: milestoneResults.M2,
        M3: milestoneResults.M3
      },
      windowEnd: windowEnd.toISOString(),
      status: postSubmission.status
    });
    
  } catch (error) {
    console.error('Submit post error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

async function updatePostRewards(kolId: string, post: PostSubmission) {
  const period = getCurrentPeriod();
  const ledgerRef = db.collection('rewards_ledger').doc(`${kolId}_${period}`);
  
  let totalPostReward = 0;
  if (post.milestones.M1.achieved) totalPostReward += post.milestones.M1.payout;
  if (post.milestones.M2.achieved) totalPostReward += post.milestones.M2.payout;
  if (post.milestones.M3.achieved) totalPostReward += post.milestones.M3.payout;
  
  await db.runTransaction(async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerRef);
    
    if (ledgerDoc.exists) {
      const ledger = ledgerDoc.data();
      transaction.update(ledgerRef, {
        ownPostReward: (ledger.ownPostReward || 0) + totalPostReward,
        totalEarned: (ledger.totalEarned || 0) + totalPostReward,
        calculatedAt: new Date()
      });
    } else {
      transaction.set(ledgerRef, {
        id: `${kolId}_${period}`,
        period,
        kolId,
        ownPostReward: totalPostReward,
        ownMintsCommission: 0,
        l1OverrideCommission: 0,
        l2OverrideCommission: 0,
        totalEarned: totalPostReward,
        immediateAmount: totalPostReward * 0.4,
        vestedAmount: totalPostReward * 0.6,
        capApplied: false,
        calculatedAt: new Date(),
        campaign: 'G3'
      });
    }
  });
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}
