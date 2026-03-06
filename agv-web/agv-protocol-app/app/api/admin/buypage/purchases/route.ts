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
    const buyerAddress = searchParams.get("buyerAddress");
    const txHash = searchParams.get("txHash");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("purchases");

    // Apply filters
    if (kolId) {
      query = query.where("kolId", "==", kolId.trim());
    }
    if (buyerAddress) {
      query = query.where("buyerAddress", "==", buyerAddress.toLowerCase().trim());
    }
    if (txHash) {
      query = query.where("txHash", "==", txHash.trim());
    }

    // Order by timestamp descending
    query = query.orderBy("timestamp", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("purchases").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const purchases = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      data: purchases,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}

