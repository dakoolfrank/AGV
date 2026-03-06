# Wallet Management System - Implementation Guide

## Overview
Centralized wallet management with bidirectional sync. Firebase `wallets` collection is primary source. All existing functionality preserved.

## Collections

### `wallets/{address}` (lowercase)
```typescript
{
  address: string;
  metadata: { total_tx, avg_age, total_balance, chains_used, tier };
  status: { isWhitelisted, isActivated, hasClaimed, isAirdropped, hasBought, hasStaked };
  whitelistInfo: { inMintingWhitelist, inBuyWhitelist, whitelistedAt };
  timestamps: { firstConnected, activatedAt, claimedAt, firstBuyAt, firstStakeAt };
  bindings: { discordVerified, discordVerifiedAt, discordUserId, discordUsername, tasksCompleted };
  createdAt, updatedAt, lastSyncedAt: Date;
}
```

### Helper Collections
- `whitelisted_activated/{address}`: `{ walletAddress, addedAt }`
- `whitelisted_not_activated/{address}`: `{ walletAddress, addedAt }`
- `activation_not_whitelisted/{address}`: `{ walletAddress, activatedAt, firstConnected }`

## Core Library Functions

**File**: `lib/wallet-management.ts` (duplicate in both projects)

1. `ensureWalletExists(address, metadata?)` - Create/update wallet
2. `syncWalletFromUsers(address)` - Sync from `users` collection
3. `syncWalletFromWhitelists(address)` - Sync from whitelist collections
4. `syncWalletFromConnections(address)` - Sync from `wallet_connections`
5. `syncWalletFromEvents(address)` - Sync from purchase/claim/stake events
6. `updateWalletStatus(address, updates)` - Update wallet fields
7. `syncWalletToUsers(address, walletData)` - Sync TO `users` (bidirectional)
8. `categorizeWallet(address, walletData)` - Update helper collections
9. `fullSyncWallet(address)` - Complete sync from all sources

## Implementation

### Phase 1: Migration
**File**: `scripts/migrate-wallets-to-firebase.ts`
- Read `wallets_all.csv`
- Create `wallets` documents with metadata
- Sync initial status from existing collections
- Batch write (500 per batch)

### Phase 2: Connection Tracking
**agv-protocol-app**: `app/api/wallet/connection/route.ts` (POST)
**buypage**: Enhance `app/api/analytics/wallet-connection/route.ts`
- Call `ensureWalletExists()`
- Set `firstConnected` if null
- Call `categorizeWallet()`

### Phase 3: Activation
**agv-protocol-app**: `app/api/wallet/activate/route.ts` (POST)
**buypage**: Enhance `app/api/users/route.ts` (action: 'activate')
- Update `status.isActivated = true`
- Sync to `users` collection (bidirectional)
- Call `categorizeWallet()`

### Phase 4: Event Sync
Enhance existing endpoints:
- **Claim**: `buypage/app/api/users/route.ts` (action: 'claim') → `hasClaimed = true`
- **Buy**: `buypage/app/api/users/route.ts` (action: 'record-purchase') → `hasBought = true`
- **Stake**: Staking endpoints → `hasStaked = true`
- **Discord**: `buypage/app/api/link-discord/route.ts` → `discordVerified = true`

### Phase 5: Admin Dashboard
**File**: `app/[locale]/admin/wallets/page.tsx`
- Table with filters (status, tier, search)
- Stats cards
- Pagination (50 per page)
- Export CSV

**API**: `app/api/admin/wallets/route.ts`
- `GET /api/admin/wallets` - List with filters
- `GET /api/admin/wallets/[address]` - Details
- `POST /api/admin/wallets/[address]/sync` - Force sync
- `PATCH /api/admin/wallets/[address]` - Update (admin override)
- `GET /api/admin/wallets/stats` - Statistics

### Phase 6: Wallet Providers
**agv-protocol-app**: `components/wallet/wallet-provider.tsx` - Call `/api/wallet/connection` on connect
**buypage**: Already handled in endpoint enhancement

## Sync Rules
- Sync errors don't break existing functionality
- Check `updatedAt` to avoid overwriting newer data
- All sync operations wrapped in try-catch
- Maintain existing response formats

## Categorization Logic
- `whitelisted_activated`: `isWhitelisted && isActivated`
- `whitelisted_not_activated`: `isWhitelisted && !isActivated`
- `activation_not_whitelisted`: `!isWhitelisted && isActivated`

## Status Mapping (AGV Data Dictionary)
- **activation**: `isActivated = true` (connected + bindings complete)
- **connected**: Session event → `firstConnected` timestamp
- **claim success**: `hasClaimed = true`
- **airdropped**: `isAirdropped = true`
- **buy**: `hasBought = true`
- **stake**: `hasStaked = true`

