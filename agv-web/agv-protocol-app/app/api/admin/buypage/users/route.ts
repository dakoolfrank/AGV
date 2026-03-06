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
    const address = searchParams.get("address");
    const isActivated = searchParams.get("isActivated");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("users");

    // Apply filters
    if (address) {
      query = query.where("address", "==", address.toLowerCase().trim());
    }
    if (isActivated !== null) {
      query = query.where("isActivated", "==", isActivated === "true");
    }

    // Order by createdAt descending
    query = query.orderBy("createdAt", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("users").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get purchase counts for each user
    const purchasesSnapshot = await adminDb.collection("purchases").get();
    const purchaseCounts = new Map<string, number>();
    purchasesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const buyerAddress = (data.buyerAddress || "").toLowerCase();
      purchaseCounts.set(buyerAddress, (purchaseCounts.get(buyerAddress) || 0) + 1);
    });

    const usersWithPurchaseCounts = users.map((user: any) => ({
      ...user,
      purchaseCount: purchaseCounts.get((user.address || "").toLowerCase()) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: usersWithPurchaseCounts,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

