# rGGP Vault Implementation

This document describes the implementation of the rGGP Vault page as specified in the Vault Page Playbook (v0: Simulated Rewards).

## Overview

The Vault page is a client-only "simulated vault" that reads short-TTL JSON feeds and renders a live rGGP counter, APR bars, and a leaderboard. It is migration-safe: later we can swap the data sources to on-chain without changing the UI.

## Features Implemented

### ✅ Core Features
- **Live rGGP Counter**: Real-time counter that updates per-second using requestAnimationFrame
- **APR Bars**: Visual breakdown of Real/Boost/Social rewards with tooltips
- **Position Cards**: Display of staked NFTs with individual yields and stats
- **XP Panel**: Shows current XP, last updated time, and links to Zealy/TaskOn
- **Leaderboard**: Top 100 users ranked by rGGP accrued
- **Tier Selection**: Dropdown to switch between Flex/1m/3m/6m/12m lock tiers
- **Wallet Integration**: Mock wallet connection (ready for real wallet integration)

### ✅ Data Management
- **API Endpoints**: RESTful APIs for APR, XP, NFTs, and leaderboard data
- **State Management**: Zustand store for centralized state management
- **Math Utilities**: Centralized calculations for yields, XP weights, and sigmoid functions
- **Caching**: Appropriate cache headers for different data types

### ✅ UI/UX
- **Responsive Design**: Works on desktop and mobile
- **Loading States**: Skeleton loaders for all components
- **Error Handling**: Graceful error states with retry options
- **Accessibility**: ARIA labels, screen reader support
- **Empty States**: Helpful prompts when no data is available

## File Structure

```
app/
├── [locale]/vault/page.tsx          # Main vault page
├── api/vault/
│   ├── apr/route.ts                 # APR data endpoint
│   ├── xp/route.ts                  # XP data endpoint
│   ├── nfts/route.ts                # NFT positions endpoint
│   └── leaderboard/route.ts         # Leaderboard endpoint

components/vault/
├── VaultHeader.tsx                  # Wallet connection & tier selection
├── LiveCounter.tsx                  # Real-time rGGP counter
├── AprBars.tsx                      # APR breakdown visualization
├── PositionCard.tsx                 # Individual NFT position cards
├── XpPanel.tsx                      # XP status and links
└── Leaderboard.tsx                  # Top 100 leaderboard

lib/vault/
├── api.ts                           # API client functions
├── math.ts                          # Mathematical calculations
├── store.ts                         # Zustand state management
└── useLiveCounter.ts                # Live counter animation hook

public/
├── tiers.json                       # Static tier configuration
└── leaderboard.json                 # Static leaderboard data
```

## Key Components

### Live Counter
- Uses `requestAnimationFrame` for smooth 60fps animation
- Calculates per-second rate from daily yield
- Accessible with `aria-live="polite"`
- Resets when start value changes

### Math Calculations
- **Sigmoid Function**: `x / (1 + x/2000)` for XP soft-cap
- **Daily Base**: `APR / 365` for daily rate
- **XP Weight**: `K * TierCoeff * sigmoid(xp)` where K=0.25
- **Daily Yield**: `daily_base * NFTmult * (1 + xp_weight)`
- **Daily Cap**: Clamped at 900 rGGP per day

### State Management
- Centralized Zustand store with devtools
- Auto-hydration when wallet connects
- Recalculation when tier changes
- Error handling and loading states

## API Endpoints

### GET /api/vault/apr?tier=<tier>
Returns APR data for a specific tier:
```json
{
  "apr": 480,
  "split": {
    "real": 0.25,
    "boost": 0.60,
    "social": 0.15
  }
}
```

### GET /api/vault/xp?wallet=<address>
Returns XP data for a wallet:
```json
{
  "xp": 4200,
  "asOf": 1738886400
}
```

### GET /api/vault/nfts?wallet=<address>
Returns NFT positions for a wallet:
```json
{
  "wallet": "0x...",
  "positions": [
    {
      "type": "Seed",
      "start_ts": 1738886400,
      "lock_tier": "flex"
    }
  ]
}
```

### GET /api/vault/leaderboard
Returns top 100 leaderboard:
```json
{
  "asOf": 1738886400,
  "rows": [
    {
      "rank": 1,
      "wallet": "0x...",
      "rggp": 12345.67,
      "xp": 4200
    }
  ]
}
```

## Configuration

### Tier Configuration (public/tiers.json)
```json
{
  "tiers": {
    "flex": {"apr": 100, "split": {"real": 0.25, "boost": 0.60, "social": 0.15}},
    "1m": {"apr": 350, "split": {"real": 0.25, "boost": 0.60, "social": 0.15}},
    "3m": {"apr": 400, "split": {"real": 0.25, "boost": 0.60, "social": 0.15}},
    "6m": {"apr": 480, "split": {"real": 0.25, "boost": 0.60, "social": 0.15}},
    "12m": {"apr": 490, "split": {"real": 0.30, "boost": 0.60, "social": 0.10}}
  },
  "nftMultipliers": {"Seed": 1.0, "Tree": 1.5, "Solar": 3.0}
}
```

## Migration Notes

This implementation is designed to be migration-safe. To move to on-chain data:

1. **Replace API endpoints** with contract/indexer calls
2. **Update data fetching** in `lib/vault/api.ts`
3. **Add real wallet integration** in `VaultHeader.tsx`
4. **Keep all UI components** unchanged
5. **Add vesting/claim functionality** when rGGP is on-chain

## Testing Checklist

- [ ] Changing tier updates APR, daily yield, bars immediately
- [ ] Counter increases steadily ~per second (±1%)
- [ ] XP change reflects within ≤60m
- [ ] Daily cap clamps output (simulate extreme XP)
- [ ] UTC verified: accrual consistent regardless of timezone
- [ ] Empty states/Errors render gracefully
- [ ] "Simulated rewards (pre-on-chain)" badge visible
- [ ] Leaderboard top 100 renders with stable ordering
- [ ] Lighthouse: Perf ≥ 90, A11y ≥ 90

## Dependencies Added

- `zustand`: State management library

## Usage

1. Navigate to `/vault` in the application
2. Connect a wallet (currently mocked)
3. View live rGGP counter and APR breakdown
4. See staked NFT positions and yields
5. Check XP status and leaderboard
6. Switch between lock tiers to see different APRs

The page automatically refreshes data every 5 minutes and shows real-time updates for the counter.
