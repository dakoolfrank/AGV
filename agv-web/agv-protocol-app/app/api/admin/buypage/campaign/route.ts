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
    const walletAddress = searchParams.get("walletAddress");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("campaign_submissions");

    // Apply filters
    if (walletAddress) {
      query = query.where("walletAddress", "==", walletAddress.toLowerCase().trim());
    }

    // Order by timestamp descending
    query = query.orderBy("timestamp", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("campaign_submissions").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const submissions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        walletAddress: data.walletAddress || '',
        xUsername: data.xUsername || '',
        discordUsername: data.discordUsername || '',
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.timestamp || '',
      };
    });

    // Get total count
    const totalSnapshot = await adminDb.collection("campaign_submissions").get();
    const totalCount = totalSnapshot.size;

    return NextResponse.json({
      success: true,
      data: submissions,
      totalCount,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching campaign submissions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch campaign submissions" },
      { status: 500 }
    );
  }
}

