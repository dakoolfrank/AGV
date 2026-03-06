import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const kolId = searchParams.get("kolId");
    const period = searchParams.get("period");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("rewards_ledger");

    // Apply filters
    if (kolId) {
      query = query.where("kolId", "==", kolId.trim());
    }
    if (period) {
      query = query.where("period", "==", period.trim());
    }

    // Order by calculatedAt descending
    query = query.orderBy("calculatedAt", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("rewards_ledger").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const rewards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get KOL names from kol_profiles
    const kolProfilesSnapshot = await adminDb.collection("kol_profiles").get();
    const kolProfilesMap = new Map();
    kolProfilesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      kolProfilesMap.set(data.kolId || doc.id, {
        name: data.name || "",
        walletAddress: data.walletAddress || "",
      });
    });

    const rewardsWithKolNames = rewards.map((reward: any) => {
      const kolProfile = kolProfilesMap.get(reward.kolId);
      return {
        ...reward,
        kolName: kolProfile?.name || reward.kolId,
        kolWallet: kolProfile?.walletAddress || "",
      };
    });

    return NextResponse.json({
      success: true,
      data: rewardsWithKolNames,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching rewards:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}

