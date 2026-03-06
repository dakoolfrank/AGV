// Define the Thirdweb contract type
type ThirdwebContract = {
  address: `0x${string}`;
  chain: any;
  abi: any;
  client: any;
};

// Minting caps for each NFT type (global across all chains)
export const MINTING_CAPS = {
  seed: {
    totalSupply: 600, // Total: 600 (Whitelist: 200, Public: 400, Agent: 0)
    whitelistSupply: 200, // Total whitelist cap
  },
  tree: {
    totalSupply: 300, // Total: 300 (Whitelist: 100, Public: 200, Agent: 0)
    whitelistSupply: 100, // Total whitelist cap
  },
  solar: {
    totalSupply: 300, // Not available for minting
    whitelistSupply: 0,
  },
  compute: {
    totalSupply: 99, // Not available for minting
    whitelistSupply: 0,
  },
} as const;

type NftType = keyof typeof MINTING_CAPS;

// Utility function for retrying async operations
async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw new Error(`Max retries reached: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.warn(`Retry ${i + 1}/${retries} after ${delay}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
}

// Check if minting is allowed based on supply caps
export async function canMintNFT({
  nftContract,
  nftType,
  quantity,
}: {
  nftContract: ThirdwebContract;
  nftType: NftType;
  quantity: number;
}): Promise<{ allowed: boolean; message: string }> {
  try {
    // Restrict minting to SeedPass and TreePass
    if (nftType !== 'seed' && nftType !== 'tree') {
      return {
        allowed: false,
        message: `Minting not available for ${nftType} at this time`,
      };
    }

    // Validate contract
    if (!nftContract.address || !nftContract.chain || !nftContract.abi) {
      return {
        allowed: false,
        message: "Invalid contract configuration: missing address, chain, or ABI",
      };
    }

    // Get total supply from contract with retry
    const totalSupply = await withRetry(async () => {
      const { readContract } = await import("thirdweb");
      return await readContract({
        contract: nftContract,
        method: "totalSupply",
        params: [],
      });
    }, 3, 1000);

    const totalMinted = Number(totalSupply?.toString() || "0");
    const maxSupply = MINTING_CAPS[nftType].totalSupply; // Use totalSupply instead of whitelistSupply

    // Check supply cap
    if (totalMinted + quantity > maxSupply) {
      return {
        allowed: false,
        message: `Supply cap exceeded: ${totalMinted}/${maxSupply} already minted for ${nftType}`,
      };
    }

    return { allowed: true, message: 'Minting allowed' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error('Error checking minting caps:', errorMessage);
    return { allowed: false, message: `Error checking minting caps: ${errorMessage}` };
  }
}