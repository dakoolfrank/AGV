import { adminDb } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface EarlyCircleConfig {
  isActive: boolean;
  startTimestamp: Timestamp | null;
  endTimestamp: Timestamp | null;
  updatedAt: Timestamp;
  updatedBy: string | null;
}

export interface EarlyCircleWallet {
  isEarlyCircle: boolean;
  addedAt: Timestamp | null;
  addedBy: string | null;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  flaggedAt: Timestamp | null;
  flaggedBy: string | null;
}

export type VolumeTier = 'NONE' | 'TIER_150' | 'TIER_300';

export type ClaimStatus = 'none' | 'success' | 'failed';

export type ClaimFailureReason = 
  | 'INSUFFICIENT_FUNDS'
  | 'USER_REJECTED'
  | 'NETWORK_ERROR'
  | 'CONTRACT_REVERT'
  | 'UNKNOWN';

export type BuyFailureReason = 
  | 'INSUFFICIENT_FUNDS'
  | 'USER_REJECTED'
  | 'NETWORK_ERROR'
  | 'CONTRACT_REVERT'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'PRESALE_NOT_ACTIVE'
  | 'CONTRACT_PAUSED'
  | 'UNKNOWN';

/**
 * Get Early Circle configuration
 */
export async function getEarlyCircleConfig(): Promise<EarlyCircleConfig | null> {
  try {
    const configDoc = await adminDb.collection('early_circle_config').doc('current').get();
    if (!configDoc.exists) {
      return null;
    }
    return configDoc.data() as EarlyCircleConfig;
  } catch (error) {
    console.error('Error fetching Early Circle config:', error);
    return null;
  }
}

/**
 * Check if Early Circle is currently active
 */
export async function isEarlyCircleActive(): Promise<boolean> {
  const config = await getEarlyCircleConfig();
  if (!config || !config.isActive) {
    return false;
  }

  const now = Timestamp.now();
  const start = config.startTimestamp;
  const end = config.endTimestamp;

  if (!start || !end) {
    return false;
  }

  return now >= start && now <= end;
}

/**
 * Check if a wallet is in Early Circle
 */
export async function isWalletEarlyCircle(walletAddress: string): Promise<boolean> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const walletDoc = await adminDb.collection('wallets').doc(normalizedAddress).get();
    
    if (!walletDoc.exists) {
      return false;
    }

    const wallet = walletDoc.data();
    return wallet?.earlyCircle?.isEarlyCircle === true;
  } catch (error) {
    console.error('Error checking Early Circle wallet:', error);
    return false;
  }
}

/**
 * Check if current time is within Early Circle window
 */
export function isWithinEarlyCircleWindow(
  timestamp: Timestamp | Date | string | null,
  config: EarlyCircleConfig | null
): boolean {
  if (!timestamp || !config || !config.isActive) {
    return false;
  }

  const time = timestamp instanceof Timestamp 
    ? timestamp 
    : timestamp instanceof Date 
    ? Timestamp.fromDate(timestamp)
    : Timestamp.fromDate(new Date(timestamp));

  const start = config.startTimestamp;
  const end = config.endTimestamp;

  if (!start || !end) {
    return false;
  }

  return time >= start && time <= end;
}

/**
 * Calculate volume tier based on total buy volume
 */
export function calculateVolumeTier(totalVolume: number): VolumeTier {
  if (totalVolume >= 300) {
    return 'TIER_300';
  } else if (totalVolume >= 150) {
    return 'TIER_150';
  }
  return 'NONE';
}

/**
 * Normalize amount to USD equivalent
 * For now, assumes amounts are already in USD
 * Can be extended to support currency conversion
 */
export function normalizeAmount(amount: number, currency: string = 'USD'): number {
  // For now, return as-is if USD
  // Can add currency conversion logic here
  return amount;
}

/**
 * Validate Early Circle referral
 * A valid referral requires:
 * - Referred wallet is in Early Circle
 * - Referred wallet has claimed
 * - Referred wallet has at least one qualifying buy within Early Circle window
 */
export async function validateEarlyCircleReferral(
  referrerWallet: string,
  referredWallet: string
): Promise<{
  isValid: boolean;
  hasClaimed: boolean;
  hasFirstBuy: boolean;
  reason?: string;
}> {
  try {
    const config = await getEarlyCircleConfig();
    if (!config || !config.isActive) {
      return {
        isValid: false,
        hasClaimed: false,
        hasFirstBuy: false,
        reason: 'Early Circle is not active',
      };
    }

    // Check if referred wallet is in Early Circle
    const isReferredEarlyCircle = await isWalletEarlyCircle(referredWallet);
    if (!isReferredEarlyCircle) {
      return {
        isValid: false,
        hasClaimed: false,
        hasFirstBuy: false,
        reason: 'Referred wallet is not in Early Circle',
      };
    }

    // Check if referred wallet has claimed
    const referredWalletDoc = await adminDb.collection('wallets').doc(referredWallet.toLowerCase()).get();
    const referredWalletData = referredWalletDoc.data();
    const hasClaimed = referredWalletData?.status?.hasClaimed === true;

    // Check if referred wallet has first buy within Early Circle window
    const purchaseEvents = await adminDb.collection('purchase_events')
      .where('wallet', '==', referredWallet.toLowerCase())
      .orderBy('timestamp', 'asc')
      .get();

    let hasFirstBuy = false;
    if (!purchaseEvents.empty) {
      const firstPurchase = purchaseEvents.docs[0].data();
      const purchaseTime = firstPurchase.timestamp;
      hasFirstBuy = isWithinEarlyCircleWindow(purchaseTime, config);
    }

    const isValid = hasClaimed && hasFirstBuy;

    return {
      isValid,
      hasClaimed,
      hasFirstBuy,
      reason: isValid ? undefined : 'Referred wallet has not completed claim and buy',
    };
  } catch (error) {
    console.error('Error validating Early Circle referral:', error);
    return {
      isValid: false,
      hasClaimed: false,
      hasFirstBuy: false,
      reason: 'Error validating referral',
    };
  }
}

/**
 * Get error message for user-facing display
 */
export function getErrorMessage(reasonCode: ClaimFailureReason | BuyFailureReason): string {
  const errorMessages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Insufficient funds for transaction. Please ensure you have enough balance.',
    USER_REJECTED: 'Transaction was rejected. Please approve the transaction in your wallet.',
    NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
    CONTRACT_REVERT: 'Transaction failed. Please check your eligibility and try again.',
    INSUFFICIENT_ALLOWANCE: 'Token approval required. Please approve the transaction.',
    PRESALE_NOT_ACTIVE: 'Presale is not currently active. Please try again later.',
    CONTRACT_PAUSED: 'Contract is currently paused. Please try again later.',
    UNKNOWN: 'An unexpected error occurred. Please try again or contact support.',
  };

  return errorMessages[reasonCode] || errorMessages.UNKNOWN;
}

/**
 * Extract error reason code from error message
 */
export function extractErrorReason(error: Error | string): ClaimFailureReason | BuyFailureReason {
  const errorString = typeof error === 'string' ? error : error.message?.toLowerCase() || '';

  if (errorString.includes('insufficient funds') || errorString.includes('insufficient balance')) {
    return 'INSUFFICIENT_FUNDS';
  }
  if (errorString.includes('user rejected') || errorString.includes('rejected') || errorString.includes('denied')) {
    return 'USER_REJECTED';
  }
  if (errorString.includes('network') || errorString.includes('fetch') || errorString.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  if (errorString.includes('revert') || errorString.includes('execution reverted')) {
    return 'CONTRACT_REVERT';
  }
  if (errorString.includes('allowance') || errorString.includes('approval')) {
    return 'INSUFFICIENT_ALLOWANCE';
  }
  if (errorString.includes('presale not active') || errorString.includes('presalenotactive')) {
    return 'PRESALE_NOT_ACTIVE';
  }
  if (errorString.includes('paused') || errorString.includes('Paused')) {
    return 'CONTRACT_PAUSED';
  }

  return 'UNKNOWN';
}

