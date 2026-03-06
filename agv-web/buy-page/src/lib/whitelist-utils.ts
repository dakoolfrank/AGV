import { adminDb } from '@/lib/firebase-admin';

// Check if an address is whitelisted (case-insensitive matching)
export async function isAddressWhitelisted(address: string): Promise<boolean> {
  try {
    const normalizedAddress = address.toLowerCase().trim();
    const whitelistRef = adminDb.collection('buy_whitelisted_wallets');
    
    // First try exact match with lowercase
    const whitelistQuery = await whitelistRef
      .where('walletAddress', '==', normalizedAddress)
      .limit(1)
      .get();
    
    if (!whitelistQuery.empty) {
      return true;
    }
    
    // If not found, fetch all documents and do case-insensitive comparison
    // This handles cases where addresses might be stored with mixed case
    const allDocs = await whitelistRef.get();
    
    for (const doc of allDocs.docs) {
      const data = doc.data();
      if (data.walletAddress && data.walletAddress.toLowerCase().trim() === normalizedAddress) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking whitelist:', error);
    return false;
  }
}

// Direct database check (bypasses cache) - case-insensitive
export async function isAddressWhitelistedDirect(address: string): Promise<boolean> {
  try {
    const normalizedAddress = address.toLowerCase().trim();
    const whitelistRef = adminDb.collection('buy_whitelisted_wallets');
    
    // First try exact match with lowercase
    const whitelistQuery = await whitelistRef
      .where('walletAddress', '==', normalizedAddress)
      .limit(1)
      .get();
    
    if (!whitelistQuery.empty) {
      return true;
    }
    
    // If not found, fetch all documents and do case-insensitive comparison
    // This handles cases where addresses might be stored with mixed case
    const allDocs = await whitelistRef.get();
    
    for (const doc of allDocs.docs) {
      const data = doc.data();
      if (data.walletAddress && data.walletAddress.toLowerCase().trim() === normalizedAddress) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking whitelist directly:', error);
    return false;
  }
}

// Batch check multiple addresses
export async function areAddressesWhitelisted(addresses: string[]): Promise<{ address: string; isWhitelisted: boolean }[]> {
  try {
    // Get all whitelisted addresses from database
    const whitelistRef = adminDb.collection('buy_whitelisted_wallets');
    const snapshot = await whitelistRef.get();
    
    // Create a Set of normalized whitelisted addresses for fast lookup
    const whitelistedSet = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.walletAddress) {
        whitelistedSet.add(data.walletAddress.toLowerCase().trim());
      }
    });
    
    // Check each address against the whitelist
    return addresses.map((address: string) => {
      const normalizedAddress = address.toLowerCase().trim();
      return {
        address: normalizedAddress,
        isWhitelisted: whitelistedSet.has(normalizedAddress)
      };
    });
  } catch (error) {
    console.error('Error batch checking whitelist:', error);
    return addresses.map((address: string) => ({
      address: address.toLowerCase().trim(),
      isWhitelisted: false
    }));
  }
}
