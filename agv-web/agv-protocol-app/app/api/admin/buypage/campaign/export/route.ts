import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../_auth";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Generate CSV from data array
 */
function generateCSV(data: Record<string, unknown>[], columns: string[]): string {
  const headers = columns.join(',');
  const rows = data.map(item =>
    columns.map(col => {
      const value = item[col];
      // Escape quotes and wrap in quotes if contains comma or quote
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );
  return [headers, ...rows].join('\n');
}

export async function GET(req: NextRequest) {
  const decoded = await requireAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const submissionsSnapshot = await adminDb
      .collection("campaign_submissions")
      .orderBy("timestamp", "desc")
      .get();

    const submissions = submissionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        walletAddress: data.walletAddress || '',
        xUsername: data.xUsername || '',
        discordUsername: data.discordUsername || '',
        timestamp: data.timestamp || (data.createdAt?.toDate?.()?.toISOString() || ''),
      };
    });

    const csv = generateCSV(submissions, [
      'walletAddress',
      'xUsername',
      'discordUsername',
      'timestamp',
    ]);

    // Generate filename with current date
    const exportDate = new Date().toISOString().split('T')[0];
    const filename = `campaign-submissions-${exportDate}.csv`;

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting campaign submissions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export campaign submissions" },
      { status: 500 }
    );
  }
}

