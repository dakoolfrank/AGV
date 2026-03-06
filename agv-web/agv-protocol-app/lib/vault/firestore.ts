// lib/vault/firestore.ts
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LockedNFT } from './store';

export interface VaultFirestoreData {
  wallet: string;
  chainKey: string;
  lockedNfts: LockedNFT[];
  lastValidationTime: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Save vault data to Firestore
 */
export async function saveVaultData(wallet: string, chainKey: string, lockedNfts: LockedNFT[], lastValidationTime: number): Promise<void> {
  try {
    const docId = `${wallet.toLowerCase()}_${chainKey}`;
    const vaultRef = doc(db, 'vault_positions', docId);
    
    const data: VaultFirestoreData = {
      wallet: wallet.toLowerCase(),
      chainKey,
      lockedNfts,
      lastValidationTime,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(vaultRef, data, { merge: true });
  } catch (error) {
    console.error('Failed to save vault data:', error);
    throw error;
  }
}

/**
 * Load vault data from Firestore
 */
export async function loadVaultData(wallet: string, chainKey: string): Promise<{
  lockedNfts: LockedNFT[];
  lastValidationTime: number;
} | null> {
  try {
    const docId = `${wallet.toLowerCase()}_${chainKey}`;
    const docRef = doc(db, 'vault_positions', docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as VaultFirestoreData;
    
    return {
      lockedNfts: data.lockedNfts || [],
      lastValidationTime: data.lastValidationTime || 0
    };
  } catch (error) {
    console.error('Failed to load vault data:', error);
    return null;
  }
}

/**
 * Delete vault data from Firestore
 */
export async function deleteVaultData(wallet: string, chainKey: string): Promise<void> {
  try {
    const docId = `${wallet.toLowerCase()}_${chainKey}`;
    const vaultRef = doc(db, 'vault_positions', docId);
    await deleteDoc(vaultRef);
  } catch (error) {
    console.error('Failed to delete vault data:', error);
    throw error;
  }
}

/**
 * Load all vault positions for a wallet across all chains
 */
export async function loadAllVaultData(wallet: string): Promise<Record<string, {
  lockedNfts: LockedNFT[];
  lastValidationTime: number;
}>> {
  try {
    const q = query(
      collection(db, 'vault_positions'),
      where('wallet', '==', wallet.toLowerCase()),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const result: Record<string, { lockedNfts: LockedNFT[]; lastValidationTime: number }> = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as VaultFirestoreData;
      result[data.chainKey] = {
        lockedNfts: data.lockedNfts || [],
        lastValidationTime: data.lastValidationTime || 0
      };
    });
    
    return result;
  } catch (error) {
    console.error('Failed to load all vault data:', error);
    return {};
  }
}
