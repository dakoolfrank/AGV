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
    const wallet = searchParams.get("wallet");
    const txHash = searchParams.get("txHash");
    const tier = searchParams.get("tier");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("purchase_events");

    // Apply filters
    if (kolId) {
      query = query.where("kolId", "==", kolId.trim());
    }
    if (wallet) {
      query = query.where("wallet", "==", wallet.toLowerCase().trim());
    }
    if (txHash) {
      query = query.where("txHash", "==", txHash.trim());
    }
    if (tier) {
      query = query.where("tier", "==", tier.trim());
    }

    // Order by timestamp descending
    query = query.orderBy("timestamp", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("purchase_events").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const purchaseEvents = snapshot.docs.map(doc => ({
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

    const eventsWithKolNames = purchaseEvents.map((event: any) => {
      const kolProfile = kolProfilesMap.get(event.kolId);
      return {
        ...event,
        kolName: kolProfile?.name || event.kolId,
        kolWallet: kolProfile?.walletAddress || "",
      };
    });

    return NextResponse.json({
      success: true,
      data: eventsWithKolNames,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching purchase events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch purchase events" },
      { status: 500 }
    );
  }
}

