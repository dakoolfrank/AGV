// Client-side Early Circle utilities for buypage
// Note: Some functions require server-side access, so they're simplified here

export type VolumeTier = 'NONE' | 'TIER_150' | 'TIER_300';

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
 */
export function normalizeAmount(amount: number, currency: string = 'USD'): number {
  return amount;
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

