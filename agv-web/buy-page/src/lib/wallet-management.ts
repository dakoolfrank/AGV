import { adminDb } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface WalletMetadata {
  total_tx: number;
  avg_age: number;
  total_balance: number;
  chains_used: number;
  tier: string;
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

export interface WalletDocument {
  address: string;
  metadata: WalletMetadata;
  status: {
    isWhitelisted: boolean;
    isActivated: boolean;
    hasClaimed: boolean;
    isAirdropped: boolean;
    hasBought: boolean;
    hasStaked: boolean;
  };
  whitelistInfo: {
    inMintingWhitelist: boolean;
    inBuyWhitelist: boolean;
    whitelistedAt: Date | Timestamp | null;
  };
  timestamps: {
    firstConnected: Date | Timestamp | null;
    activatedAt: Date | Timestamp | null;
    claimedAt: Date | Timestamp | null;
    firstBuyAt: Date | Timestamp | null;
    firstStakeAt: Date | Timestamp | null;
  };
  bindings: {
    discordVerified: boolean;
    discordVerifiedAt: Date | Timestamp | null;
    discordUserId: string | null;
    discordUsername: string | null;
    tasksCompleted: boolean;
  };
  earlyCircle?: EarlyCircleWallet;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  lastSyncedAt: Date | Timestamp;
}

const defaultMetadata: WalletMetadata = {
  total_tx: 0,
  avg_age: 0,
  total_balance: 0,
  chains_used: 0,
  tier: 'Tier 3',
};

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

function toTimestamp(date: Date | Timestamp | string | null): Timestamp | null {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (date instanceof Date) return Timestamp.fromDate(date);
  if (typeof date === 'string') return Timestamp.fromDate(new Date(date));
  return null;
}

function toDate(date: Date | Timestamp | string | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  return null;
}

export async function ensureWalletExists(
  address: string,
  metadata?: Partial<WalletMetadata>
): Promise<WalletDocument> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  const walletSnap = await walletRef.get();
  const now = Timestamp.now();

  if (walletSnap.exists) {
    const existing = walletSnap.data() as WalletDocument;
    const updates: Partial<WalletDocument> = {
      updatedAt: now,
    };

    if (metadata) {
      updates.metadata = {
        ...existing.metadata,
        ...metadata,
      };
    }

    if (Object.keys(updates).length > 1) {
      await walletRef.update(updates);
      return { ...existing, ...updates } as WalletDocument;
    }

    return existing;
  }

  const newWallet: WalletDocument = {
    address: normalizedAddress,
    metadata: { ...defaultMetadata, ...metadata },
    status: {
      isWhitelisted: false,
      isActivated: false,
      hasClaimed: false,
      isAirdropped: false,
      hasBought: false,
      hasStaked: false,
    },
    whitelistInfo: {
      inMintingWhitelist: false,
      inBuyWhitelist: false,
      whitelistedAt: null,
    },
    timestamps: {
      firstConnected: null,
      activatedAt: null,
      claimedAt: null,
      firstBuyAt: null,
      firstStakeAt: null,
    },
    bindings: {
      discordVerified: false,
      discordVerifiedAt: null,
      discordUserId: null,
      discordUsername: null,
      tasksCompleted: false,
    },
    earlyCircle: {
      isEarlyCircle: false,
      addedAt: null,
      addedBy: null,
      isSuspicious: false,
      suspiciousReason: null,
      flaggedAt: null,
      flaggedBy: null,
    },
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
  };

  await walletRef.set(newWallet);
  return newWallet;
}

export async function getWallet(address: string): Promise<WalletDocument | null> {
  const normalizedAddress = normalizeAddress(address);
  const walletSnap = await adminDb.collection('wallets').doc(normalizedAddress).get();
  
  if (!walletSnap.exists) return null;
  return walletSnap.data() as WalletDocument;
}

export async function syncWalletFromUsers(address: string): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  const userRef = adminDb.collection('users').doc(normalizedAddress);
  
  const [walletSnap, userSnap] = await Promise.all([
    walletRef.get(),
    userRef.get(),
  ]);

  if (!walletSnap.exists) return;

  const wallet = walletSnap.data() as WalletDocument;
  const updates: Partial<WalletDocument> = {
    updatedAt: Timestamp.now(),
    lastSyncedAt: Timestamp.now(),
  };

  if (userSnap.exists) {
    const user = userSnap.data() as any;
    
    if (user.isActivated !== undefined) {
      updates.status = {
        ...wallet.status,
        isActivated: user.isActivated,
      };
      
      if (user.isActivated && user.activationTime && !wallet.timestamps.activatedAt) {
        updates.timestamps = {
          ...wallet.timestamps,
          activatedAt: toTimestamp(user.activationTime) || Timestamp.now(),
        };
      }
    }

    if (user.discordVerified !== undefined) {
      updates.bindings = {
        ...wallet.bindings,
        discordVerified: user.discordVerified || false,
      };
      
      if (user.discordVerificationTime) {
        updates.bindings.discordVerifiedAt = toTimestamp(user.discordVerificationTime);
      }
      
      if (user.discordUserId) {
        updates.bindings.discordUserId = user.discordUserId;
      }
      
      if (user.discordUsername) {
        updates.bindings.discordUsername = user.discordUsername;
      }
    }

    if (user.hasClaimed !== undefined) {
      updates.status = {
        ...(updates.status || wallet.status),
        hasClaimed: user.hasClaimed,
      };
      
      if (user.hasClaimed && user.claimTime && !wallet.timestamps.claimedAt) {
        updates.timestamps = {
          ...(updates.timestamps || wallet.timestamps),
          claimedAt: toTimestamp(user.claimTime),
        };
      }
    }
  }

  if (Object.keys(updates).length > 2) {
    await walletRef.update(updates);
  }
}

export async function syncWalletFromWhitelists(address: string): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) return;

  const wallet = walletSnap.data() as WalletDocument;
  
  const [mintingWhitelist, buyWhitelist] = await Promise.all([
    adminDb.collection('whitelisted_wallets')
      .where('address', '==', normalizedAddress)
      .limit(1)
      .get(),
    adminDb.collection('buy_whitelisted_wallets')
      .where('walletAddress', '==', normalizedAddress)
      .limit(1)
      .get(),
  ]);

  const inMintingWhitelist = !mintingWhitelist.empty;
  const inBuyWhitelist = !buyWhitelist.empty;
  const isWhitelisted = inMintingWhitelist || inBuyWhitelist;

  const updates: Partial<WalletDocument> = {
    updatedAt: Timestamp.now(),
    lastSyncedAt: Timestamp.now(),
  };

  if (
    wallet.whitelistInfo.inMintingWhitelist !== inMintingWhitelist ||
    wallet.whitelistInfo.inBuyWhitelist !== inBuyWhitelist ||
    wallet.status.isWhitelisted !== isWhitelisted
  ) {
    updates.whitelistInfo = {
      inMintingWhitelist,
      inBuyWhitelist,
      whitelistedAt: isWhitelisted && !wallet.whitelistInfo.whitelistedAt
        ? Timestamp.now()
        : wallet.whitelistInfo.whitelistedAt,
    };
    
    updates.status = {
      ...wallet.status,
      isWhitelisted,
    };
  }

  if (Object.keys(updates).length > 2) {
    await walletRef.update(updates);
  }
}

export async function syncWalletFromConnections(address: string): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) return;

  const wallet = walletSnap.data() as WalletDocument;
  const updates: Partial<WalletDocument> = {
    updatedAt: Timestamp.now(),
    lastSyncedAt: Timestamp.now(),
  };

  // Sync firstConnected timestamp if not set
  let hasConnection = !!wallet.timestamps.firstConnected;
  if (!wallet.timestamps.firstConnected) {
    const connections = await adminDb.collection('wallet_connections')
      .where('walletAddress', '==', normalizedAddress)
      .orderBy('timestamp', 'asc')
      .limit(1)
      .get();

    if (!connections.empty) {
      const firstConnection = connections.docs[0].data();
      const timestamp = firstConnection.timestamp || firstConnection.createdAt;
      
      updates.timestamps = {
        ...wallet.timestamps,
        firstConnected: toTimestamp(timestamp) || Timestamp.now(),
      };
      hasConnection = true;
    }
  }

  // Apply activation logic: if wallet has connected but is NOT whitelisted, it should be activated
  // This handles the case: "Activated wallets are any wallet that connects to the dApp, that we do not have in our wallet list"
  const isNotWhitelisted = !wallet.status.isWhitelisted;
  
  if (hasConnection && isNotWhitelisted && !wallet.status.isActivated) {
    updates.status = {
      ...wallet.status,
      isActivated: true,
    };
    
    if (!wallet.timestamps.activatedAt) {
      const firstConnectedTime = updates.timestamps?.firstConnected || wallet.timestamps.firstConnected;
      updates.timestamps = {
        ...(updates.timestamps || wallet.timestamps),
        activatedAt: firstConnectedTime || Timestamp.now(),
      };
    }
  }

  if (Object.keys(updates).length > 2 || updates.timestamps || updates.status) {
    await walletRef.update(updates);
  }
}

export async function syncWalletFromEvents(address: string): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) return;

  const wallet = walletSnap.data() as WalletDocument;
  const updates: Partial<WalletDocument> = {
    updatedAt: Timestamp.now(),
    lastSyncedAt: Timestamp.now(),
  };

  const [purchases, stakes] = await Promise.all([
    adminDb.collection('purchase_events')
      .where('wallet', '==', normalizedAddress)
      .orderBy('timestamp', 'asc')
      .limit(1)
      .get(),
    adminDb.collection('staking_events')
      .where('walletAddress', '==', normalizedAddress)
      .orderBy('timestamp', 'asc')
      .limit(1)
      .get(),
  ]);

  if (!purchases.empty && !wallet.status.hasBought) {
    const firstPurchase = purchases.docs[0].data();
    updates.status = {
      ...wallet.status,
      hasBought: true,
    };
    updates.timestamps = {
      ...wallet.timestamps,
      firstBuyAt: toTimestamp(firstPurchase.timestamp) || Timestamp.now(),
    };
  }

  if (!stakes.empty && !wallet.status.hasStaked) {
    const firstStake = stakes.docs[0].data();
    updates.status = {
      ...(updates.status || wallet.status),
      hasStaked: true,
    };
    updates.timestamps = {
      ...(updates.timestamps || wallet.timestamps),
      firstStakeAt: toTimestamp(firstStake.timestamp) || Timestamp.now(),
    };
  }

  if (Object.keys(updates).length > 2) {
    await walletRef.update(updates);
  }
}

export async function updateWalletStatus(
  address: string,
  updates: Partial<WalletDocument>
): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const walletRef = adminDb.collection('wallets').doc(normalizedAddress);
  
  await walletRef.update({
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function syncWalletToUsers(
  address: string,
  walletData: WalletDocument
): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const userRef = adminDb.collection('users').doc(normalizedAddress);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return;

  const user = userSnap.data() as any;
  const updates: any = {
    lastUpdated: new Date().toISOString(),
  };

  if (walletData.status.isActivated !== user.isActivated) {
    updates.isActivated = walletData.status.isActivated;
    
    if (walletData.status.isActivated && walletData.timestamps.activatedAt) {
      updates.activationTime = toDate(walletData.timestamps.activatedAt)?.toISOString() || new Date().toISOString();
    }
  }

  if (walletData.bindings.discordVerified !== user.discordVerified) {
    updates.discordVerified = walletData.bindings.discordVerified;
    
    if (walletData.bindings.discordVerifiedAt) {
      updates.discordVerificationTime = toDate(walletData.bindings.discordVerifiedAt)?.toISOString();
    }
    
    if (walletData.bindings.discordUserId) {
      updates.discordUserId = walletData.bindings.discordUserId;
    }
    
    if (walletData.bindings.discordUsername) {
      updates.discordUsername = walletData.bindings.discordUsername;
    }
  }

  if (Object.keys(updates).length > 1) {
    await userRef.update(updates);
  }
}

export async function categorizeWallet(
  address: string,
  walletData: WalletDocument
): Promise<void> {
  const normalizedAddress = normalizeAddress(address);
  const now = Timestamp.now();

  const isWhitelistedActivated = walletData.status.isWhitelisted && walletData.status.isActivated;
  const isWhitelistedNotActivated = walletData.status.isWhitelisted && !walletData.status.isActivated;
  const isActivatedNotWhitelisted = !walletData.status.isWhitelisted && walletData.status.isActivated;

  const [waSnap, wnaSnap, anwSnap] = await Promise.all([
    adminDb.collection('whitelisted_activated').doc(normalizedAddress).get(),
    adminDb.collection('whitelisted_not_activated').doc(normalizedAddress).get(),
    adminDb.collection('activation_not_whitelisted').doc(normalizedAddress).get(),
  ]);

  if (isWhitelistedActivated && !waSnap.exists) {
    await adminDb.collection('whitelisted_activated').doc(normalizedAddress).set({
      walletAddress: normalizedAddress,
      addedAt: now,
    });
  } else if (!isWhitelistedActivated && waSnap.exists) {
    await adminDb.collection('whitelisted_activated').doc(normalizedAddress).delete();
  }

  if (isWhitelistedNotActivated && !wnaSnap.exists) {
    await adminDb.collection('whitelisted_not_activated').doc(normalizedAddress).set({
      walletAddress: normalizedAddress,
      addedAt: now,
    });
  } else if (!isWhitelistedNotActivated && wnaSnap.exists) {
    await adminDb.collection('whitelisted_not_activated').doc(normalizedAddress).delete();
  }

  if (isActivatedNotWhitelisted && !anwSnap.exists) {
    await adminDb.collection('activation_not_whitelisted').doc(normalizedAddress).set({
      walletAddress: normalizedAddress,
      activatedAt: walletData.timestamps.activatedAt || now,
      firstConnected: walletData.timestamps.firstConnected || now,
    });
  } else if (!isActivatedNotWhitelisted && anwSnap.exists) {
    await adminDb.collection('activation_not_whitelisted').doc(normalizedAddress).delete();
  }
}

export async function fullSyncWallet(address: string): Promise<WalletDocument> {
  const normalizedAddress = normalizeAddress(address);
  
  await ensureWalletExists(normalizedAddress);
  await Promise.all([
    syncWalletFromUsers(normalizedAddress),
    syncWalletFromWhitelists(normalizedAddress),
    syncWalletFromConnections(normalizedAddress),
    syncWalletFromEvents(normalizedAddress),
  ]);

  const wallet = await getWallet(normalizedAddress);
  if (!wallet) {
    throw new Error('Wallet not found after sync');
  }

  await categorizeWallet(normalizedAddress, wallet);
  return wallet;
}





