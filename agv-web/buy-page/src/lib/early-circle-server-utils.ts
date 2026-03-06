import { adminDb } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { extractErrorReason } from './early-circle-utils';

export interface EarlyCircleEvent {
  eventType: string;
  walletAddress: string;
  timestamp: Timestamp;
  isEarlyCircle: boolean;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EarlyCircleConfig {
  isActive: boolean;
  startTimestamp: Timestamp | null;
  endTimestamp: Timestamp | null;
  updatedAt: Timestamp;
  updatedBy: string | null;
}

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
 * Validate Early Circle referral
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

    const isReferredEarlyCircle = await isWalletEarlyCircle(referredWallet);
    if (!isReferredEarlyCircle) {
      return {
        isValid: false,
        hasClaimed: false,
        hasFirstBuy: false,
        reason: 'Referred wallet is not in Early Circle',
      };
    }

    const referredWalletDoc = await adminDb.collection('wallets').doc(referredWallet.toLowerCase()).get();
    const referredWalletData = referredWalletDoc.data();
    const hasClaimed = referredWalletData?.status?.hasClaimed === true;

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
 * Track claim events with error handling
 */
export async function trackClaimEvent(
  walletAddress: string,
  eventType: 'claim_started' | 'claim_success' | 'claim_failed',
  metadata?: {
    txHash?: string;
    claimedAmount?: string;
    reasonCode?: string;
    rawError?: string;
  }
) {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const isEarlyCircle = await isWalletEarlyCircle(normalizedAddress);
    const isActive = await isEarlyCircleActive();

    if (!isActive || !isEarlyCircle) {
      return; // Don't track if Early Circle is not active
    }

    const eventData: EarlyCircleEvent = {
      eventType,
      walletAddress: normalizedAddress,
      timestamp: Timestamp.now(),
      isEarlyCircle: true,
      source: 'web',
      metadata: {
        ...metadata,
        ...(eventType === 'claim_failed' && metadata?.rawError && {
          reasonCode: metadata.reasonCode || extractErrorReason(metadata.rawError),
        }),
      },
    };

    await adminDb.collection('early_circle_events').add(eventData);
  } catch (error) {
    console.error('Error tracking claim event:', error);
    // Don't throw - event tracking should not break user flow
  }
}

/**
 * Track buy events with error handling
 */
export async function trackBuyEvent(
  walletAddress: string,
  eventType: 'buy_started' | 'buy_success' | 'buy_failed',
  metadata?: {
    intendedAmount?: number;
    txHash?: string;
    assetPair?: string;
    amountNormalised?: number;
    isFirstBuy?: boolean;
    reasonCode?: string;
    rawError?: string;
  }
) {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const isEarlyCircle = await isWalletEarlyCircle(normalizedAddress);
    const isActive = await isEarlyCircleActive();

    if (!isActive || !isEarlyCircle) {
      return; // Don't track if Early Circle is not active
    }

    const eventData: EarlyCircleEvent = {
      eventType,
      walletAddress: normalizedAddress,
      timestamp: Timestamp.now(),
      isEarlyCircle: true,
      source: 'web',
      metadata: {
        ...metadata,
        ...(eventType === 'buy_failed' && metadata?.rawError && {
          reasonCode: metadata.reasonCode || extractErrorReason(metadata.rawError),
        }),
      },
    };

    await adminDb.collection('early_circle_events').add(eventData);
  } catch (error) {
    console.error('Error tracking buy event:', error);
    // Don't throw - event tracking should not break user flow
  }
}

/**
 * Track referral events
 */
export async function trackReferralEvent(
  referrerWallet: string,
  referredWallet: string,
  eventType: 'referral_attribution' | 'referral_validated',
  metadata?: {
    source?: string;
    hasClaimed?: boolean;
    hasFirstBuy?: boolean;
    isValidEarlyCircleReferral?: boolean;
  }
) {
  try {
    const referrerNormalized = referrerWallet.toLowerCase();
    const referredNormalized = referredWallet.toLowerCase();
    
    const isReferrerEarlyCircle = await isWalletEarlyCircle(referrerNormalized);
    const isReferredEarlyCircle = await isWalletEarlyCircle(referredNormalized);
    const isActive = await isEarlyCircleActive();

    if (!isActive || !isReferrerEarlyCircle) {
      return; // Don't track if Early Circle is not active or referrer is not in Early Circle
    }

    const eventData: EarlyCircleEvent = {
      eventType,
      walletAddress: referrerNormalized,
      timestamp: Timestamp.now(),
      isEarlyCircle: true,
      source: metadata?.source || 'web',
      metadata: {
        referrerWallet: referrerNormalized,
        referredWallet: referredNormalized,
        ...metadata,
      },
    };

    await adminDb.collection('early_circle_events').add(eventData);
  } catch (error) {
    console.error('Error tracking referral event:', error);
    // Don't throw - event tracking should not break user flow
  }
}

