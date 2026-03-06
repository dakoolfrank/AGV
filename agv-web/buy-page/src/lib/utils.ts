import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// BNB balance checking utility using Moralis
export async function checkBNBBalance(address: string): Promise<{
  balance: number;
  hasMinimumBalance: boolean;
  error?: string;
}> {
  try {
    const moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    
    if (!moralisApiKey) {
      console.warn('Moralis API key not found, using fallback method');
      // Fallback: try to get balance using a public RPC endpoint
      return await getBNBBalanceFromRPC(address);
    }
    
    // Use Moralis API to get native balance on BSC
    const response = await fetch(`https://deep-index.moralis.io/api/v2.2/${address}/balance?chain=bsc`, {
      headers: {
        'X-API-Key': moralisApiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.balance) {
      // Convert from Wei to BNB (1 BNB = 10^18 Wei)
      const balanceInBNB = parseInt(data.balance) / Math.pow(10, 18);
      const minimumRequired = 0.00005; // 0.00005 BNB minimum
      
      return {
        balance: balanceInBNB,
        hasMinimumBalance: balanceInBNB >= minimumRequired
      };
    } else {
      console.warn('Moralis API returned no balance data, trying fallback method');
      return await getBNBBalanceFromRPC(address);
    }
  } catch (error) {
    console.warn('Moralis API failed, trying fallback method:', error);
    return await getBNBBalanceFromRPC(address);
  }
}

// Enhanced Moralis balance checking with token support
export async function checkTokenBalance(address: string, tokenAddress?: string): Promise<{
  balance: number;
  hasMinimumBalance: boolean;
  error?: string;
  tokenInfo?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}> {
  try {
    const moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    
    if (!moralisApiKey) {
      console.warn('Moralis API key not found, using fallback method');
      return await getBNBBalanceFromRPC(address);
    }
    
    let apiUrl: string;
    if (tokenAddress) {
      // Get specific token balance
      apiUrl = `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=bsc&token_addresses[]=${tokenAddress}`;
    } else {
      // Get native BNB balance
      apiUrl = `https://deep-index.moralis.io/api/v2.2/${address}/balance?chain=bsc`;
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-API-Key': moralisApiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (tokenAddress && data.length > 0) {
      // Token balance response
      const tokenData = data[0];
      const balance = parseFloat(tokenData.balance) / Math.pow(10, tokenData.decimals);
      const minimumRequired = 0.00005; // Adjust based on token
      
      return {
        balance,
        hasMinimumBalance: balance >= minimumRequired,
        tokenInfo: {
          name: tokenData.name,
          symbol: tokenData.symbol,
          decimals: tokenData.decimals,
        }
      };
    } else if (!tokenAddress && data.balance) {
      // Native BNB balance response
      const balanceInBNB = parseInt(data.balance) / Math.pow(10, 18);
      const minimumRequired = 0.00005; // 0.00005 BNB minimum
      
      return {
        balance: balanceInBNB,
        hasMinimumBalance: balanceInBNB >= minimumRequired,
        tokenInfo: {
          name: 'BNB',
          symbol: 'BNB',
          decimals: 18,
        }
      };
    } else {
      console.warn('Moralis API returned no balance data, trying fallback method');
      return await getBNBBalanceFromRPC(address);
    }
  } catch (error) {
    console.warn('Moralis API failed, trying fallback method:', error);
    return await getBNBBalanceFromRPC(address);
  }
}

// Fallback method using direct RPC call
async function getBNBBalanceFromRPC(address: string): Promise<{
  balance: number;
  hasMinimumBalance: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('https://bsc-dataseed.binance.org/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });

    const data = await response.json();
    
    if (data.result) {
      // Convert from hex to decimal, then from Wei to BNB
      const balanceInWei = parseInt(data.result, 16);
      const balanceInBNB = balanceInWei / Math.pow(10, 18);
      const minimumRequired = 0.00005; // 0.00005 BNB minimum
      
      return {
        balance: balanceInBNB,
        hasMinimumBalance: balanceInBNB >= minimumRequired
      };
    } else {
      return {
        balance: 0,
        hasMinimumBalance: false,
        error: 'Failed to fetch balance from RPC'
      };
    }
  } catch (error) {
    return {
      balance: 0,
      hasMinimumBalance: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}