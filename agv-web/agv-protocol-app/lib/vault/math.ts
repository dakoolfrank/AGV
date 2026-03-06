export const SEC_PER_DAY = 86400;

/**
 * Sigmoid function for XP soft-cap
 * @param x - XP value
 * @returns Sigmoid value between 0 and 1
 */
export function sigmoid(x: number): number {
  return x / (1 + x / 2000);
}

/**
 * Calculate XP weight based on sigmoid function
 * @param xp - Current XP value
 * @param K - Base multiplier (default 0.25)
 * @param tierCoeff - Tier coefficient (default 1.0)
 * @returns XP weight multiplier
 */
export function xpWeight(xp: number, K = 0.25, tierCoeff = 1.0): number {
  return K * tierCoeff * sigmoid(xp);
}

/**
 * Calculate daily base rate from APR percentage
 * @param aprPct - APR as percentage (e.g., 100 for 100%)
 * @returns Daily rate as fraction
 */
export function dailyBase(aprPct: number): number {
  return aprPct / 100 / 365;
}

/**
 * Calculate daily yield for a single NFT
 * @param aprPct - APR percentage
 * @param nftMult - NFT multiplier
 * @param xp - Current XP
 * @param K - Base XP multiplier (default 0.25)
 * @param tierCoeff - Tier coefficient (default 1.0)
 * @returns Daily yield as fraction
 */
export function dailyYield(
  aprPct: number,
  nftMult: number,
  xp: number,
  K = 0.25,
  tierCoeff = 1.0
): number {
  const base = dailyBase(aprPct);
  const w = xpWeight(xp, K, tierCoeff);
  return base * nftMult * (1 + w);
}

/**
 * Clamp daily total to prevent excessive rewards
 * @param totalDailyRggp - Total daily rGGP
 * @param cap - Daily cap (default 900)
 * @returns Clamped value
 */
export function clampDaily(totalDailyRggp: number, cap = 900): number {
  return Math.min(totalDailyRggp, cap);
}

/**
 * Calculate per-second rate from daily yield
 * @param dailyYield - Daily yield as fraction
 * @param nominalUnit - Nominal unit (default 1.0)
 * @returns Per-second rate
 */
export function perSecondRate(dailyYield: number, nominalUnit = 1.0): number {
  return (dailyYield * nominalUnit) / SEC_PER_DAY;
}

/**
 * Calculate accrued rewards from start time to now
 * @param startTs - Start timestamp in seconds
 * @param dailyYield - Daily yield as fraction
 * @param nominalUnit - Nominal unit (default 1.0)
 * @returns Accrued rewards
 */
export function calculateAccrued(
  startTs: number,
  dailyYield: number,
  nominalUnit = 1.0
): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = Math.max(0, now - startTs);
  const elapsedDays = elapsedSeconds / SEC_PER_DAY;
  return dailyYield * nominalUnit * elapsedDays;
}

/**
 * Format wallet address for display
 * @param address - Full wallet address
 * @returns Shortened address
 */
export function formatWalletAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format number with appropriate precision
 * @param num - Number to format
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string
 */
export function formatNumber(num: number, decimals = 2): string {
  return num.toFixed(decimals);
}

/**
 * Format large numbers with K/M/B suffixes
 * @param num - Number to format
 * @returns Formatted string with suffix
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(2);
}
