// lib/rewards.ts
export type ChainId = "56" | "137" | "42161";
export type NftType = "seed" | "tree" | "solar" | "compute";

export const DAY_MS = 86_400_000;

export const BASE_DAILY_RRGP: Record<NftType, number> = {
  seed: 5,       // SeedPass ($29)  -> 5 rGGP/day
  tree: 10,      // TreePass ($59)  -> 10 rGGP/day
  solar: 25,     // SolarPass ($299)-> 25 rGGP/day
  compute: 100,  // ComputePass($899)-> 100 rGGP/day
};

const BRACKETS = [
  { days: 730, mult: 5.0 }, // 2 years
  { days: 365, mult: 4.5 }, // 1 year
  { days: 180, mult: 4.0 }, // 180 days
  { days: 90, mult: 3.0 }, // 90 days
  { days: 30, mult: 1.5 }, // 30 days
  { days: 7, mult: 1.0 }, // 7 days (minimum)
];

export function normalizeLockDays(raw: number): number {
  // Snap to closest *lower or equal* bracket; enforce minimum 7 days
  if (!Number.isFinite(raw)) return 7;
  const d = Math.max(7, Math.floor(raw));
  for (const b of BRACKETS) if (d >= b.days) return b.days;
  return 7;
}

export function bonusFor(lockDays: number): number {
  const d = normalizeLockDays(lockDays);
  return BRACKETS.find(b => d >= b.days)?.mult ?? 1.0;
}

export function baseDailyFor(nftType: NftType): number {
  return BASE_DAILY_RRGP[nftType];
}

export function scheduledTotal(nftType: NftType, amount: number, lockDays: number): number {
  const base = baseDailyFor(nftType);
  const mult = bonusFor(lockDays);
  return base * amount * normalizeLockDays(lockDays) * mult;
}

export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function wholeDaysBetweenUTC(start: Date, end: Date): number {
  const s = utcMidnight(start);
  const e = utcMidnight(end);
  return Math.max(0, Math.floor((e - s) / DAY_MS));
}

export function accruedToDate(params: {
  nftType: NftType;
  amount: number;
  stakedAt: Date;
  lockDays: number;
  now?: Date;          // default: current time
}): { daysCounted: number; accrued: number; cap: number; multiplier: number } {
  const { nftType, amount } = params;
  const lock = normalizeLockDays(params.lockDays);
  const mult = bonusFor(lock);
  const cap = scheduledTotal(nftType, amount, lock);
  const now = params.now ?? new Date();
  const unlockAt = new Date(params.stakedAt.getTime() + lock * DAY_MS);

  const countedDays = wholeDaysBetweenUTC(params.stakedAt, new Date(Math.min(now.getTime(), unlockAt.getTime())));
  const base = baseDailyFor(nftType);
  const raw = base * amount * countedDays * mult;

  return {
    daysCounted: countedDays,
    accrued: Math.min(cap, raw),
    cap,
    multiplier: mult,
  };
}
