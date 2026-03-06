import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const decoded = await requireAdmin(req);
    if (!decoded) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get all KOLs
    const kolsSnapshot = await adminDb.collection('kols').get();
    const kols = kolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get all activities from different collections
    const activities = [];
    const stats: Record<string, any> = {};

    // Get mint events
    const mintEventsSnapshot = await adminDb.collection('mintEvents').get();
    for (const mintDoc of mintEventsSnapshot.docs) {
      const mintData = mintDoc.data();
      const kol = kols.find(k => k.kolId === mintData.kolId);
      
      if (kol) {
        // Add mint activities
        if (mintData.events && Array.isArray(mintData.events)) {
          for (const event of mintData.events) {
            activities.push({
              id: `${mintDoc.id}_${event.timestamp}`,
              kolId: kol.id,
              kolName: kol.name,
              activityType: 'mint',
              description: `Minted ${event.amount || 0} tokens`,
              amount: event.amount || 0,
              timestamp: event.timestamp?.toDate() || new Date(),
              status: 'completed'
            });
          }
        }

        // Initialize stats for this KOL
        if (!stats[kol.id]) {
          stats[kol.id] = {
            totalMints: 0,
            totalReferrals: 0,
            totalRewards: 0,
            activeDays: 0,
            lastActivity: new Date(0)
          };
        }

        stats[kol.id].totalMints += mintData.events?.length || 0;
        if (mintData.events?.length > 0) {
          const lastEvent = mintData.events[mintData.events.length - 1];
          const eventDate = lastEvent.timestamp?.toDate() || new Date();
          if (eventDate > stats[kol.id].lastActivity) {
            stats[kol.id].lastActivity = eventDate;
          }
        }
      }
    }

    // Get KOL recruitment activities
    const recruitsSnapshot = await adminDb.collection('kol_recruits').get();
    for (const recruitDoc of recruitsSnapshot.docs) {
      const recruitData = recruitDoc.data();
      const sponsorKol = kols.find(k => k.id === recruitData.sponsorKolId);
      
      if (sponsorKol) {
        activities.push({
          id: recruitDoc.id,
          kolId: sponsorKol.id,
          kolName: sponsorKol.name,
          activityType: 'referral',
          description: `Referred new KOL: ${recruitData.childRef}`,
          timestamp: recruitData.timestamp?.toDate() || new Date(),
          status: 'completed'
        });

        if (!stats[sponsorKol.id]) {
          stats[sponsorKol.id] = {
            totalMints: 0,
            totalReferrals: 0,
            totalRewards: 0,
            activeDays: 0,
            lastActivity: new Date(0)
          };
        }

        stats[sponsorKol.id].totalReferrals += 1;
        const recruitDate = recruitData.timestamp?.toDate() || new Date();
        if (recruitDate > stats[sponsorKol.id].lastActivity) {
          stats[sponsorKol.id].lastActivity = recruitDate;
        }
      }
    }

    // Get post submissions (if available)
    const postsSnapshot = await adminDb.collection('post_submissions').get();
    for (const postDoc of postsSnapshot.docs) {
      const postData = postDoc.data();
      const kol = kols.find(k => k.id === postData.kolId);
      
      if (kol) {
        activities.push({
          id: postDoc.id,
          kolId: kol.id,
          kolName: kol.name,
          activityType: 'post',
          description: `Submitted post: ${postData.title || 'Untitled'}`,
          timestamp: postData.submittedAt?.toDate() || new Date(),
          status: postData.status || 'pending'
        });

        if (!stats[kol.id]) {
          stats[kol.id] = {
            totalMints: 0,
            totalReferrals: 0,
            totalRewards: 0,
            activeDays: 0,
            lastActivity: new Date(0)
          };
        }

        const postDate = postData.submittedAt?.toDate() || new Date();
        if (postDate > stats[kol.id].lastActivity) {
          stats[kol.id].lastActivity = postDate;
        }
      }
    }

    // Get reward activities (if available)
    const rewardsSnapshot = await adminDb.collection('rewards_ledger').get();
    for (const rewardDoc of rewardsSnapshot.docs) {
      const rewardData = rewardDoc.data();
      const kolId = rewardDoc.id.split('_')[0]; // Assuming format: kolId_period
      const kol = kols.find(k => k.id === kolId);
      
      if (kol && rewardData.totalEarnings > 0) {
        activities.push({
          id: rewardDoc.id,
          kolId: kol.id,
          kolName: kol.name,
          activityType: 'reward',
          description: `Earned rewards: $${rewardData.totalEarnings}`,
          amount: rewardData.totalEarnings,
          timestamp: rewardData.updatedAt?.toDate() || new Date(),
          status: 'completed'
        });

        if (!stats[kol.id]) {
          stats[kol.id] = {
            totalMints: 0,
            totalReferrals: 0,
            totalRewards: 0,
            activeDays: 0,
            lastActivity: new Date(0)
          };
        }

        stats[kol.id].totalRewards += rewardData.totalEarnings || 0;
        const rewardDate = rewardData.updatedAt?.toDate() || new Date();
        if (rewardDate > stats[kol.id].lastActivity) {
          stats[kol.id].lastActivity = rewardDate;
        }
      }
    }

    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return NextResponse.json({
      activities,
      stats,
      total: activities.length
    });

  } catch (err: any) {
    console.error("kol-activities error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
