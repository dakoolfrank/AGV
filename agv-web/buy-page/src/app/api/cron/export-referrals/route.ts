import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { TransactionalEmailsApi, SendSmtpEmail, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron Job: Export referral leaderboards
 * Runs every Monday at 00:00 UTC
 * Exports KOL referrals (top 10) and Claim referrals (top 20 + all with ≥$20)
 * Sends CSV files via Brevo API email
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Verify request is from Vercel Cron (security check)
    // If CRON_SECRET is set, Vercel will send it in Authorization header
    // If not set, the endpoint will work without authentication (for testing)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Only check authentication if CRON_SECRET is configured
    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret}`;
      if (!authHeader || authHeader !== expectedAuth) {
        console.error('[CRON] Authentication failed', {
          hasAuthHeader: !!authHeader,
          authHeaderLength: authHeader?.length || 0,
          expectedLength: expectedAuth.length,
        });
        return NextResponse.json({ 
          success: false, 
          error: 'Unauthorized - Invalid or missing CRON_SECRET' 
        }, { status: 401 });
      }
    }

    // Get current week info
    const now = new Date();
    const weekNumber = getISOWeekNumber(now);
    const exportDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Get KOL referral leaderboard (top 10)
    // Note: Fetch all isKolReferral purchases and filter in JavaScript
    // to avoid Firestore composite index requirement
    const kolPurchasesQuery = await adminDb.collection('purchases')
      .where('isKolReferral', '==', true)
      .get();
    
    // Filter out entries without kolId in JavaScript
    const kolPurchases = kolPurchasesQuery.docs.filter(doc => {
      const data = doc.data();
      return data.kolId != null && data.kolId !== '';
    });

    const kolTotals = new Map<string, { totalAmount: number; count: number; kolId: string; kolWallet: string }>();
    
    kolPurchases.forEach(doc => {
      const purchase = doc.data();
      const kolId = purchase.kolId;
      const purchaseAmount = purchase.purchaseAmount || 0;

      if (kolId) {
        const current = kolTotals.get(kolId) || { 
          totalAmount: 0, 
          count: 0, 
          kolId, 
          kolWallet: purchase.kolWallet || '' 
        };
        kolTotals.set(kolId, {
          ...current,
          totalAmount: current.totalAmount + purchaseAmount,
          count: current.count + 1,
        });
      }
    });

    const kolLeaderboard = Array.from(kolTotals.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map((entry, index) => ({
        rank: index + 1,
        kolId: entry.kolId,
        wallet: entry.kolWallet,
        totalReferralAmount: entry.totalAmount,
        numberOfReferrals: entry.count,
        period: `Week ${weekNumber} - ${exportDate}`,
      }));

    // Get Claim referral leaderboard (top 20 + all with ≥$20)
    // Note: Fetch all non-KOL purchases and filter in JavaScript
    // to avoid Firestore composite index requirement
    const claimPurchasesQuery = await adminDb.collection('purchases')
      .where('isKolReferral', '==', false)
      .get();
    
    // Filter out entries without referrerWallet in JavaScript
    const claimPurchases = claimPurchasesQuery.docs.filter(doc => {
      const data = doc.data();
      return data.referrerWallet != null && data.referrerWallet !== '';
    });

    const claimTotals = new Map<string, { totalAmount: number; count: number }>();
    
    claimPurchases.forEach(doc => {
      const purchase = doc.data();
      const referrerWallet = purchase.referrerWallet;
      const purchaseAmount = purchase.purchaseAmount || 0;

      if (referrerWallet) {
        const walletLower = referrerWallet.toLowerCase();
        const current = claimTotals.get(walletLower) || { totalAmount: 0, count: 0 };
        claimTotals.set(walletLower, {
          totalAmount: current.totalAmount + purchaseAmount,
          count: current.count + 1,
        });
      }
    });

    // Top 20
    const top20Claim = Array.from(claimTotals.entries())
      .map(([wallet, data]) => ({ wallet, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 20);

    // All with ≥$20
    const allWithMinAmount = Array.from(claimTotals.entries())
      .map(([wallet, data]) => ({ wallet, ...data }))
      .filter(entry => entry.totalAmount >= 20)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Combine top 20 + all with ≥$20 (remove duplicates)
    const claimLeaderboardMap = new Map<string, typeof top20Claim[0]>();
    top20Claim.forEach(entry => claimLeaderboardMap.set(entry.wallet, entry));
    allWithMinAmount.forEach(entry => {
      if (!claimLeaderboardMap.has(entry.wallet)) {
        claimLeaderboardMap.set(entry.wallet, entry);
      }
    });

    const claimLeaderboard = Array.from(claimLeaderboardMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map((entry, index) => ({
        rank: index + 1,
        walletAddress: entry.wallet,
        totalReferralAmount: entry.totalAmount,
        numberOfReferrals: entry.count,
        period: `Week ${weekNumber} - ${exportDate}`,
      }));

    // Generate CSV files
    const kolCsv = generateCSV(kolLeaderboard, [
      'rank', 'kolId', 'wallet', 'totalReferralAmount', 'numberOfReferrals', 'period'
    ]);
    const claimCsv = generateCSV(claimLeaderboard, [
      'rank', 'walletAddress', 'totalReferralAmount', 'numberOfReferrals', 'period'
    ]);

    console.log('[EXPORT DEBUG] CSV generated:', {
      kolCsvLength: kolCsv.length,
      claimCsvLength: claimCsv.length,
      kolLeaderboardCount: kolLeaderboard.length,
      claimLeaderboardCount: claimLeaderboard.length,
      kolCsvPreview: kolCsv.substring(0, 200),
      claimCsvPreview: claimCsv.substring(0, 200),
      kolCsvLines: kolCsv.split('\n').length,
      claimCsvLines: claimCsv.split('\n').length,
    });
    
    // Ensure CSV files are not empty (at least have headers)
    if (kolCsv.trim().length === 0 || claimCsv.trim().length === 0) {
      console.error('[EXPORT DEBUG] Empty CSV files detected!');
      return NextResponse.json({
        success: false,
        error: 'Generated CSV files are empty',
      }, { status: 500 });
    }

    // Ensure we have data to export
    if (kolLeaderboard.length === 0 && claimLeaderboard.length === 0) {
      console.warn('[EXPORT DEBUG] No data to export');
      return NextResponse.json({
        success: false,
        error: 'No referral data to export',
        message: 'Both KOL and Claim referral leaderboards are empty',
      }, { status: 400 });
    }

    // Send email via Brevo API
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return NextResponse.json({ 
        success: false, 
        error: 'Email service not configured' 
      }, { status: 500 });
    }

    const kolFilename = `kol-referrals-week-${weekNumber}-${exportDate}.csv`;
    const claimFilename = `claim-referrals-week-${weekNumber}-${exportDate}.csv`;

    // Use /tmp directory (only writable directory in Vercel serverless functions)
    const exportsDir = '/tmp';
    
    // Ensure exports directory exists (should already exist, but check anyway)
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const kolFilePath = path.join(exportsDir, kolFilename);
    const claimFilePath = path.join(exportsDir, claimFilename);

    // Write CSV files to physical path
    try {
      await writeFile(kolFilePath, kolCsv, 'utf-8');
      await writeFile(claimFilePath, claimCsv, 'utf-8');
      
      console.log('[EXPORT DEBUG] CSV files written to disk:', {
        kolFilePath,
        claimFilePath,
        kolFileSize: fs.statSync(kolFilePath).size,
        claimFileSize: fs.statSync(claimFilePath).size,
      });
    } catch (writeError) {
      console.error('[EXPORT DEBUG] Error writing files:', writeError);
      return NextResponse.json({
        success: false,
        error: 'Failed to write CSV files',
        details: writeError instanceof Error ? writeError.message : 'Unknown error',
      }, { status: 500 });
    }

    // Read files from physical path (same as NDA example)
    let kolFileContent: Buffer | null = null;
    let claimFileContent: Buffer | null = null;

    try {
      kolFileContent = await readFile(kolFilePath);
      claimFileContent = await readFile(claimFilePath);
      
      console.log('[EXPORT DEBUG] Files read from disk:', {
        kolFileSize: kolFileContent.length,
        claimFileSize: claimFileContent.length,
      });
    } catch (readError) {
      console.error('[EXPORT DEBUG] Error reading files:', readError);
      // Clean up temp files
      try {
        await unlink(kolFilePath);
        await unlink(claimFilePath);
      } catch {}
      return NextResponse.json({
        success: false,
        error: 'Failed to read CSV files',
        details: readError instanceof Error ? readError.message : 'Unknown error',
      }, { status: 500 });
    }

    // Convert to base64 (same as NDA example: fileContent.toString('base64'))
    const kolCsvBase64 = kolFileContent.toString('base64');
    const claimCsvBase64 = claimFileContent.toString('base64');

    console.log('[EXPORT DEBUG] Base64 encoding:', {
      kolCsvBase64Length: kolCsvBase64.length,
      claimCsvBase64Length: claimCsvBase64.length,
    });

    // Initialize Brevo SDK
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);

    // Create email with attachments using SDK
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'AGV Protocol',
      email: 'ir@agvprotocol.org',
    };
    sendSmtpEmail.to = [
      { email: 'bd@agvprotocol.org' },
      { email: 'ajibikeabdulqayyum04@gmail.com' },
    ];
    sendSmtpEmail.subject = `Referral Leaderboard Export - Week ${weekNumber} - ${exportDate}`;
    sendSmtpEmail.htmlContent = `
      <h2>Referral Leaderboard Export</h2>
      <p><strong>Week:</strong> ${weekNumber}</p>
      <p><strong>Export Date:</strong> ${exportDate}</p>
      <p>Please find the attached CSV files with the referral leaderboard data.</p>
      <ul>
        <li>KOL Referrals: Top 10 (${kolLeaderboard.length} entries)</li>
        <li>Claim Referrals: Top 20 + All with ≥$20 (${claimLeaderboard.length} entries)</li>
      </ul>
    `;
    sendSmtpEmail.attachment = [
      {
        name: kolFilename,
        content: kolCsvBase64,
      },
      {
        name: claimFilename,
        content: claimCsvBase64,
      },
    ];

    console.log('[EXPORT DEBUG] Email payload:', {
      sender: sendSmtpEmail.sender,
      to: sendSmtpEmail.to,
      subject: sendSmtpEmail.subject,
      attachmentsCount: sendSmtpEmail.attachment?.length || 0,
      attachmentNames: sendSmtpEmail.attachment?.map(a => a.name) || [],
      attachmentSizes: sendSmtpEmail.attachment?.map(a => a.content?.length || 0) || [],
    });

    // Send email using SDK
    let responseData;
    try {
      responseData = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      const messageId = responseData.body?.messageId || 'unknown';
      
      console.log('[EXPORT DEBUG] Brevo SDK response:', {
        messageId,
        attachmentsSent: sendSmtpEmail.attachment?.length || 0,
        fullResponse: JSON.stringify(responseData, null, 2),
        responseBody: responseData.body,
      });

      console.log('[EXPORT DEBUG] Email sent successfully:', {
        messageId,
        attachmentsSent: sendSmtpEmail.attachment?.length || 0,
        fullResponse: responseData,
      });
    } catch (error: unknown) {
      console.error('[EXPORT DEBUG] Brevo SDK error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullError: error,
      });
      
      // Clean up temp files on error
      try {
        await unlink(kolFilePath);
        await unlink(claimFilePath);
        console.log('[EXPORT DEBUG] Temporary files cleaned up after error');
      } catch (cleanupError) {
        console.warn('[EXPORT DEBUG] Failed to clean up temp files:', cleanupError);
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }

    // Clean up temporary files after successful send
    try {
      await unlink(kolFilePath);
      await unlink(claimFilePath);
      console.log('[EXPORT DEBUG] Temporary files cleaned up');
    } catch (cleanupError) {
      console.warn('[EXPORT DEBUG] Failed to clean up temp files:', cleanupError);
      // Don't fail the request if cleanup fails
    }

    // Track export history in database
    await adminDb.collection('export_history').add({
      weekNumber,
      exportDate,
      kolCount: kolLeaderboard.length,
      claimCount: claimLeaderboard.length,
      timestamp: now.toISOString(),
      createdAt: now.toISOString(),
    });
    console.log({
      success: true,
      message: 'Export completed and email sent',
      data: {
        weekNumber,
        exportDate,
        kolCount: kolLeaderboard.length,
        claimCount: claimLeaderboard.length,
      },
    })
    return NextResponse.json({
      success: true,
      message: 'Export completed and email sent',
      data: {
        weekNumber,
        exportDate,
        kolCount: kolLeaderboard.length,
        claimCount: claimLeaderboard.length,
      },
    });
  } catch (error) {
    console.error('Error in export cron job:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export referrals',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

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

/**
 * Get ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

