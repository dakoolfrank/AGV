import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Get the start of "today" based on 11am UTC
 * If current time is before 11am UTC, "today" starts at 11am UTC yesterday
 * If current time is after 11am UTC, "today" starts at 11am UTC today
 */
function getTodayStart(): Date {
  const now = new Date();
  const todayAt11am = new Date(now);
  todayAt11am.setUTCHours(11, 0, 0, 0);
  
  if (now < todayAt11am) {
    // Before 11am UTC today, so "today" started at 11am UTC yesterday
    todayAt11am.setUTCDate(todayAt11am.getUTCDate() - 1);
  }
  
  return todayAt11am;
}

export async function GET(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStart = getTodayStart();
    const todayStartISO = todayStart.toISOString();

    // Fetch all data in parallel
    const [
      analyticsEventsSnapshot,
      usersSnapshot,
      purchasesSnapshot,
      stakingEventsSnapshot,
      walletConnectionsSnapshot,
    ] = await Promise.all([
      adminDb.collection("analytics_events").get(),
      adminDb.collection("users").get(),
      adminDb.collection("purchases").get(),
      adminDb.collection("staking_events").get(),
      adminDb.collection("wallet_connections").get(),
    ]);

    // Process analytics events (page visits, drop-offs, errors)
    const analyticsEvents = analyticsEventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        eventType: data.eventType,
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
        country: data.country || null,
        region: data.region || null,
        deviceType: data.deviceType || null,
        hourOfDay: data.hourOfDay !== undefined ? data.hourOfDay : null,
        timeOfDay: data.timeOfDay || null,
        metadata: data.metadata || {},
      };
    });

    // Count page visits
    const claimPageVisitsTotal = analyticsEvents.filter(e => e.eventType === 'claim_page_visit').length;
    const claimPageVisitsToday = analyticsEvents.filter(e => 
      e.eventType === 'claim_page_visit' && e.timestamp >= todayStartISO
    ).length;

    const buyPageVisitsTotal = analyticsEvents.filter(e => e.eventType === 'buy_page_visit').length;
    const buyPageVisitsToday = analyticsEvents.filter(e => 
      e.eventType === 'buy_page_visit' && e.timestamp >= todayStartISO
    ).length;

    const stakingPageVisitsTotal = analyticsEvents.filter(e => e.eventType === 'staking_page_visit').length;
    const stakingPageVisitsToday = analyticsEvents.filter(e => 
      e.eventType === 'staking_page_visit' && e.timestamp >= todayStartISO
    ).length;

    // Process users
    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        createdAt: data.createdAt || '',
        isActivated: data.isActivated || false,
        activationTime: data.activationTime || '',
        hasClaimed: data.hasClaimed || false,
        claimTime: data.claimTime || '',
      };
    });

    // Process wallet connections (first-time connections)
    const walletConnections = walletConnectionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
        country: data.country || null,
        region: data.region || null,
        deviceType: data.deviceType || null,
        hourOfDay: data.hourOfDay !== undefined ? data.hourOfDay : null,
        timeOfDay: data.timeOfDay || null,
      };
    });

    // Wallets connected (first-time connections from wallet_connections collection)
    const walletsConnectedTotal = walletConnections.length;
    const walletsConnectedToday = walletConnections.filter(w => w.timestamp >= todayStartISO).length;

    // Wallets activated
    const walletsActivatedTotal = users.filter(u => u.isActivated).length;
    const walletsActivatedToday = users.filter(u => 
      u.isActivated && u.activationTime >= todayStartISO
    ).length;

    // Claims success
    const claimsSuccessTotal = users.filter(u => u.hasClaimed).length;
    const claimsSuccessToday = users.filter(u => 
      u.hasClaimed && u.claimTime >= todayStartISO
    ).length;

    // Process purchases
    const purchases = purchasesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
        isKolReferral: data.isKolReferral || false,
      };
    });

    // Purchases success
    const purchasesSuccessTotal = purchases.length;
    const purchasesSuccessToday = purchases.filter(p => p.timestamp >= todayStartISO).length;

    // Referral purchases
    const referralPurchasesTotal = purchases.filter(p => p.isKolReferral).length;
    const referralPurchasesToday = purchases.filter(p => 
      p.isKolReferral && p.timestamp >= todayStartISO
    ).length;

    // Process staking events
    const stakingEvents = stakingEventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
      };
    });

    // Stakes success
    const stakesSuccessTotal = stakingEvents.length;
    const stakesSuccessToday = stakingEvents.filter(s => s.timestamp >= todayStartISO).length;

    // Process claim events (success and failures)
    const claimSuccessEvents = analyticsEvents.filter(e => e.eventType === 'claim_success');
    const claimFailedEvents = analyticsEvents.filter(e => e.eventType === 'claim_failed');
    
    // Drop-off events
    const claimDropoffs = analyticsEvents.filter(e => e.eventType === 'claim_dropoff');
    const buyDropoffs = analyticsEvents.filter(e => e.eventType === 'buy_dropoff');
    const stakingDropoffs = analyticsEvents.filter(e => e.eventType === 'staking_dropoff');

    // Aggregate by country
    const countryStats = new Map<string, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>();
    analyticsEvents.forEach(e => {
      if (e.country) {
        const stats = countryStats.get(e.country) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        if (e.eventType === 'claim_page_visit' || e.eventType === 'buy_page_visit' || e.eventType === 'staking_page_visit') {
          stats.pageVisits++;
        }
        if (e.eventType === 'claim_success') stats.claimsSuccess++;
        if (e.eventType === 'claim_failed') stats.claimsFailed++;
        countryStats.set(e.country, stats);
      }
    });
    walletConnections.forEach(w => {
      if (w.country) {
        const stats = countryStats.get(w.country) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        stats.walletConnections++;
        countryStats.set(w.country, stats);
      }
    });

    // Aggregate by device type
    const deviceStats = new Map<string, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>();
    analyticsEvents.forEach(e => {
      if (e.deviceType) {
        const stats = deviceStats.get(e.deviceType) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        if (e.eventType === 'claim_page_visit' || e.eventType === 'buy_page_visit' || e.eventType === 'staking_page_visit') {
          stats.pageVisits++;
        }
        if (e.eventType === 'claim_success') stats.claimsSuccess++;
        if (e.eventType === 'claim_failed') stats.claimsFailed++;
        deviceStats.set(e.deviceType, stats);
      }
    });
    walletConnections.forEach(w => {
      if (w.deviceType) {
        const stats = deviceStats.get(w.deviceType) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        stats.walletConnections++;
        deviceStats.set(w.deviceType, stats);
      }
    });

    // Aggregate by time of day (hour)
    const hourStats = new Map<number, { pageVisits: number; walletConnections: number; claimsSuccess: number; claimsFailed: number }>();
    analyticsEvents.forEach(e => {
      if (e.hourOfDay !== null) {
        const stats = hourStats.get(e.hourOfDay) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        if (e.eventType === 'claim_page_visit' || e.eventType === 'buy_page_visit' || e.eventType === 'staking_page_visit') {
          stats.pageVisits++;
        }
        if (e.eventType === 'claim_success') stats.claimsSuccess++;
        if (e.eventType === 'claim_failed') stats.claimsFailed++;
        hourStats.set(e.hourOfDay, stats);
      }
    });
    walletConnections.forEach(w => {
      if (w.hourOfDay !== null) {
        const stats = hourStats.get(w.hourOfDay) || { pageVisits: 0, walletConnections: 0, claimsSuccess: 0, claimsFailed: 0 };
        stats.walletConnections++;
        hourStats.set(w.hourOfDay, stats);
      }
    });

    // Aggregate error codes
    const errorCodeStats = new Map<string, number>();
    claimFailedEvents.forEach(e => {
      const errorCode = e.metadata?.errorCode || 'UNKNOWN';
      errorCodeStats.set(errorCode, (errorCodeStats.get(errorCode) || 0) + 1);
    });

    // Calculate drop-off rates
    const claimDropoffRate = claimPageVisitsTotal > 0 
      ? (claimDropoffs.length / claimPageVisitsTotal) * 100 
      : 0;
    const buyDropoffRate = buyPageVisitsTotal > 0 
      ? (buyDropoffs.length / buyPageVisitsTotal) * 100 
      : 0;
    const stakingDropoffRate = stakingPageVisitsTotal > 0 
      ? (stakingDropoffs.length / stakingPageVisitsTotal) * 100 
      : 0;

    // Calculate conversion rates
    const claimConversionRate = claimPageVisitsTotal > 0 
      ? (claimsSuccessTotal / claimPageVisitsTotal) * 100 
      : 0;
    const walletConnectionRate = claimPageVisitsTotal > 0 
      ? (walletsConnectedTotal / claimPageVisitsTotal) * 100 
      : 0;
    const activationRate = walletsConnectedTotal > 0 
      ? (walletsActivatedTotal / walletsConnectedTotal) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        todayStartsAt: todayStartISO,
        claimFunnel: {
          claimPageVisits: { today: claimPageVisitsToday, total: claimPageVisitsTotal },
          walletsConnected: { today: walletsConnectedToday, total: walletsConnectedTotal },
          walletsActivated: { today: walletsActivatedToday, total: walletsActivatedTotal },
          claimsSuccess: { today: claimsSuccessToday, total: claimsSuccessTotal },
          claimsFailed: { today: claimFailedEvents.filter(e => e.timestamp >= todayStartISO).length, total: claimFailedEvents.length },
          dropoffs: { today: claimDropoffs.filter(e => e.timestamp >= todayStartISO).length, total: claimDropoffs.length },
          dropoffRate: claimDropoffRate,
          conversionRate: claimConversionRate,
          walletConnectionRate: walletConnectionRate,
          activationRate: activationRate,
        },
        buyFunnel: {
          buyPageVisits: { today: buyPageVisitsToday, total: buyPageVisitsTotal },
          purchasesSuccess: { today: purchasesSuccessToday, total: purchasesSuccessTotal },
          dropoffs: { today: buyDropoffs.filter(e => e.timestamp >= todayStartISO).length, total: buyDropoffs.length },
          dropoffRate: buyDropoffRate,
        },
        referrals: {
          referralPurchases: { today: referralPurchasesToday, total: referralPurchasesTotal },
        },
        stakingFunnel: {
          stakingPageVisits: { today: stakingPageVisitsToday, total: stakingPageVisitsTotal },
          stakesSuccess: { today: stakesSuccessToday, total: stakesSuccessTotal },
          dropoffs: { today: stakingDropoffs.filter(e => e.timestamp >= todayStartISO).length, total: stakingDropoffs.length },
          dropoffRate: stakingDropoffRate,
        },
        // New metrics
        byCountry: Object.fromEntries(countryStats),
        byDevice: Object.fromEntries(deviceStats),
        byHour: Object.fromEntries(hourStats),
        errorCodes: Object.fromEntries(errorCodeStats),
      },
    });
  } catch (error: any) {
    console.error("Error fetching funnel data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch funnel data" },
      { status: 500 }
    );
  }
}

