import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/admin/buypage/tickets
 * Get all migration tickets with optional filters
 */
export async function GET(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startAfter = searchParams.get("startAfter");

    let query: any = adminDb.collection("migration_tickets");

    // Apply filters
    if (walletAddress) {
      query = query.where("walletAddress", "==", walletAddress.toLowerCase().trim());
    }
    if (status) {
      query = query.where("status", "==", status.trim());
    }

    // Order by createdAt descending
    query = query.orderBy("createdAt", "desc").limit(limit);

    if (startAfter) {
      const startAfterDoc = await adminDb.collection("migration_tickets").doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const tickets = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ticketId: data.ticketId || "",
        walletAddress: data.walletAddress || "",
        oldBalance: data.oldBalance || 0,
        status: data.status || "pending",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.timestamp || "",
        timestamp: data.timestamp || data.createdAt?.toDate?.()?.toISOString() || "",
      };
    });

    // Get total count and status counts
    const totalSnapshot = await adminDb.collection("migration_tickets").get();
    const totalCount = totalSnapshot.size;
    
    const statusCounts: Record<string, number> = {};
    totalSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const ticketStatus = data.status || "pending";
      statusCounts[ticketStatus] = (statusCounts[ticketStatus] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: tickets,
      totalCount,
      statusCounts,
      hasMore: snapshot.docs.length === limit,
    });
  } catch (error: any) {
    console.error("Error fetching migration tickets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/buypage/tickets
 * Close a migration ticket (update status to 'closed')
 */
export async function PATCH(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ticketId } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    // Find the ticket by document ID or ticketId field
    let ticketDoc;
    
    // Try to find by document ID first
    const docRef = adminDb.collection("migration_tickets").doc(ticketId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      ticketDoc = doc;
    } else {
      // If not found by doc ID, search by ticketId field
      const querySnapshot = await adminDb
        .collection("migration_tickets")
        .where("ticketId", "==", ticketId)
        .limit(1)
        .get();
      
      if (querySnapshot.empty) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 }
        );
      }
      
      ticketDoc = querySnapshot.docs[0];
    }

    const currentData = ticketDoc.data();
    if (currentData?.status === "closed") {
      return NextResponse.json(
        { error: "Ticket is already closed" },
        { status: 400 }
      );
    }

    // Update ticket status to closed
    await ticketDoc.ref.update({
      status: "closed",
      closedAt: new Date(),
      closedBy: decoded.email || "unknown",
    });

    return NextResponse.json({
      success: true,
      message: "Ticket closed successfully",
    });
  } catch (error: any) {
    console.error("Error closing ticket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to close ticket" },
      { status: 500 }
    );
  }
}












