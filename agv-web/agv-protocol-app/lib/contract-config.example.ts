// lib/contract-config.example.ts
// Copy this file to lib/contract-config.ts and fill in your actual contract addresses

import type { Abi } from "abitype";
import { TREE_ABI } from "@/lib/contracts";

export type PassKind = "SEED" | "TREE" | "SOLAR" | "COMPUTE";
export type Standard = "ERC721" | "ERC1155";

export type AgvCollection = {
  kind: PassKind;
  standard: Standard;
  chain: { id: number };
  address: `0x${string}`;
  erc1155TokenIds?: number[];
  stakingAddress: `0x${string}`;
  nftAbi: Abi;
};

export const ERC1155_MIN_ABI = [
  { inputs:[{internalType:"uint256",name:"id",type:"uint256"}], name:"uri", outputs:[{internalType:"string",name:"",type:"string"}], stateMutability:"view", type:"function" },
] as const satisfies Abi;

// TODO: Replace these placeholder addresses with your actual contract addresses
export const AGV_COLLECTIONS: AgvCollection[] = [
  {
    kind: "SEED",
    standard: "ERC721",
    chain: { id: 56 }, // BSC
    address: "0x0000000000000000000000000000000000000000", // Replace with your Seed contract
    stakingAddress: "0x0000000000000000000000000000000000000000", // Replace with your Seed staking contract
    nftAbi: TREE_ABI, // Update if Seed uses different ABI
  },
  {
    kind: "TREE",
    standard: "ERC721",
    chain: { id: 42161 }, // Arbitrum
    address: "0x0000000000000000000000000000000000000000", // Replace with your Tree contract
    stakingAddress: "0x0000000000000000000000000000000000000000", // Replace with your Tree staking contract
    nftAbi: TREE_ABI,
  },
  {
    kind: "SOLAR",
    standard: "ERC721",
    chain: { id: 137 }, // Polygon
    address: "0x0000000000000000000000000000000000000000", // Replace with your Solar contract
    stakingAddress: "0x0000000000000000000000000000000000000000", // Replace with your Solar staking contract
    nftAbi: TREE_ABI, // Update if Solar uses different ABI
  },
  {
    kind: "COMPUTE",
    standard: "ERC1155",
    chain: { id: 56 }, // BSC
    address: "0x0000000000000000000000000000000000000000", // Replace with your Compute contract
    stakingAddress: "0x0000000000000000000000000000000000000000", // Replace with your Compute staking contract
    nftAbi: ERC1155_MIN_ABI,
    erc1155TokenIds: [1, 2, 3, 4], // Update with your actual token IDs
  },
];

// Instructions:
// 1. Copy this file to lib/contract-config.ts
// 2. Replace all 0x0000000000000000000000000000000000000000 addresses with your actual contract addresses
// 3. Update the chain IDs if you're using different chains
// 4. Update the ABIs if your contracts use different interfaces
// 5. Update erc1155TokenIds for ERC-1155 collections
// 6. Test the integration with your contracts
