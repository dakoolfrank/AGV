import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all purchases
    const purchasesSnapshot = await adminDb.collection("purchases").get();
    const purchases = purchasesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all users
    const usersSnapshot = await adminDb.collection("users").get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all purchase events
    const purchaseEventsSnapshot = await adminDb.collection("purchase_events").get();
    const purchaseEvents = purchaseEventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate stats
    const totalPurchases = purchases.length;
    const totalPurchaseVolume = purchases.reduce((sum, p) => sum + (Number(p.purchaseAmount) || 0), 0);
    const activeUsers = users.filter(u => u.isActivated === true).length;
    const totalUsers = users.length;

    // KOL Referral Analytics
    const kolReferralMap = new Map<string, {
      kolId: string;
      referralCount: number;
      totalVolume: number;
      totalCommission: number;
    }>();

    purchaseEvents.forEach((event: any) => {
      const kolId = event.kolId || "";
      if (!kolId) return;

      const existing = kolReferralMap.get(kolId) || {
        kolId,
        referralCount: 0,
        totalVolume: 0,
        totalCommission: 0,
      };

      existing.referralCount += 1;
      existing.totalVolume += Number(event.purchaseAmount) || 0;
      existing.totalCommission += Number(event.commission) || 0;

      kolReferralMap.set(kolId, existing);
    });

    // Get KOL names from kol_profiles
    const kolProfilesSnapshot = await adminDb.collection("kol_profiles").get();
    const kolProfiles = kolProfilesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const kolReferralAnalytics = Array.from(kolReferralMap.values())
      .map(kol => {
        const profile = kolProfilesSnapshot.docs.find(doc => {
          const data = doc.data();
          return data.kolId === kol.kolId || doc.id === kol.kolId;
        });
        return {
          ...kol,
          kolName: profile?.data()?.name || kol.kolId,
          kolWallet: profile?.data()?.walletAddress || "",
        };
      })
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 20); // Top 20

    // Recent purchases (last 10)
    const recentPurchases = purchases
      .sort((a: any, b: any) => {
        const aTime = a.timestamp || a.createdAt || 0;
        const bTime = b.timestamp || b.createdAt || 0;
        return bTime - aTime;
      })
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalPurchases,
          totalPurchaseVolume,
          activeUsers,
          totalUsers,
        },
        kolReferralAnalytics,
        recentPurchases,
      },
    });
  } catch (error: any) {
    console.error("Error fetching buypage overview:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch overview data" },
      { status: 500 }
    );
  }
}

