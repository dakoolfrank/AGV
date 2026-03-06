// lib/agv-config.ts
import type { Abi } from "abitype";
import { SEED_ABI, TREE_ABI, SOLAR_ABI, COMPUTE_ABI } from "@/lib/contracts";

export type PassKind = "SEED" | "TREE" | "SOLAR" | "COMPUTE";
export type Standard = "ERC721" | "ERC1155";

export type AgvCollection = {
  kind: PassKind;
  standard: Standard;
  chain: { id: number };                    // e.g. BSC = { id: 56 }, Arbitrum = { id: 42161 }, Polygon = { id: 137 }
  address: `0x${string}`;
  // For 1155, list relevant tokenIds (if finite and known)
  erc1155TokenIds?: number[];
  // The staking contract for THIS collection on THIS chain (thirdweb Staking721 or Staking1155)
  stakingAddress: `0x${string}`;
  // ABI for the NFT collection (your TREE_ABI for 721A, or minimal 1155)
  nftAbi: Abi;
};

export const ERC1155_MIN_ABI = [
  { inputs:[{internalType:"uint256",name:"id",type:"uint256"}], name:"uri", outputs:[{internalType:"string",name:"",type:"string"}], stateMutability:"view", type:"function" },
] as const satisfies Abi;

// Updated with actual contract addresses and staking contracts from the codebase
export const AGV_COLLECTIONS: AgvCollection[] = [
  {
    kind: "SEED",
    standard: "ERC721",
    chain: { id: 56 }, // BSC
    address: "0xFF362C39eB0eDecA946A5528d30D9c9E9285f3fc",
    stakingAddress: "0xe268e673a220354c70b324C02635620a591651F5",
    nftAbi: SEED_ABI as Abi,
  },
  {
    kind: "TREE",
    standard: "ERC721",
    chain: { id: 56 }, // BSC
    address: "0x1E092126E4AB12503d37dD08E20F9192b8439458",
    stakingAddress: "0xb203C59041Aa907A31CEDc1b5940330FE79240e0",
    nftAbi: TREE_ABI as Abi,
  },
  {
    kind: "SOLAR",
    standard: "ERC721",
    chain: { id: 56 }, // BSC
    address: "0x4F26621592D3B1ca344d187e469a86e2eE5FEa1E",
    stakingAddress: "0xb29A79ef1BA60f6F14C4CEf8009fA62462d02457",
    nftAbi: SOLAR_ABI as Abi,
  },
  {
    kind: "COMPUTE",
    standard: "ERC721",
    chain: { id: 56 }, // BSC
    address: "0x6F503f315c95835A68d140440CA49b5C3e885Ce3",
    stakingAddress: "0xb65F906a95c6da8a68fe06223a7b45B93F32Ef67",
    nftAbi: COMPUTE_ABI as Abi,
  },
  
  // Polygon (Chain ID: 137) - All contracts confirmed
  {
    kind: "SEED",
    standard: "ERC721",
    chain: { id: 137 }, // Polygon
    address: "0x492a86EdEEa01158FcD3C8f2348A4c0431b8A24d",
    stakingAddress: "0x97374395524966dC37173f2687Adfe102cdc379F",
    nftAbi: SEED_ABI as Abi,
  },
  {
    kind: "TREE",
    standard: "ERC721",
    chain: { id: 137 }, // Polygon
    address: "0xf44f237b8775ae985107dd2f877d5c5bbaaea31f",
    stakingAddress: "0x09134a3336b037d81bcF6f9fB0d6d01006486F69",
    nftAbi: TREE_ABI as Abi,
  },
  {
    kind: "SOLAR",
    standard: "ERC721",
    chain: { id: 137 }, // Polygon
    address: "0x19B21F15C2E49dD0697e6D3499C82f0B899B97f2",
    stakingAddress: "0xe7B07808A4EE8F9CB9AA8503Fd0c30543f1F2567",
    nftAbi: SOLAR_ABI as Abi,
  },
  {
    kind: "COMPUTE",
    standard: "ERC721",
    chain: { id: 137 }, // Polygon
    address: "0xa2c1381B89FD986B4dbA4dbb03167A7655107308",
    stakingAddress: "0x5BBe89D35B31aF8Cb98937c608B82F295e9963b3",
    nftAbi: COMPUTE_ABI as Abi,
  },
  
  // Arbitrum (Chain ID: 42161) - All contracts confirmed
  {
    kind: "SEED",
    standard: "ERC721",
    chain: { id: 42161 }, // Arbitrum
    address: "0x90b9E1C8645bC731be19537A4932B26Fc218e464",
    stakingAddress: "0xf2Fbdf4f05D23698EED36F02B632790421bc262e",
    nftAbi: SEED_ABI as Abi,
  },
  {
    kind: "TREE",
    standard: "ERC721",
    chain: { id: 42161 }, // Arbitrum
    address: "0xc574AB1e7e2B27ff4460C299E3448C572894276A",
    stakingAddress: "0xC17c8d0366356148250972aaeEf6DB7e92fbdc17",
    nftAbi: TREE_ABI as Abi,
  },
  {
    kind: "SOLAR",
    standard: "ERC721",
    chain: { id: 42161 }, // Arbitrum
    address: "0x492a86EdEEa01158FcD3C8f2348A4c0431b8A24d",
    stakingAddress: "0xd6DeA02195cA3778c5cd77eE87B010B2A41C38E4",
    nftAbi: SOLAR_ABI as Abi,
  },
  {
    kind: "COMPUTE",
    standard: "ERC721",
    chain: { id: 42161 }, // Arbitrum
    address: "0xf44F237b8775AE985107dd2F877d5c5BBaAea31f",
    stakingAddress: "0x620E35906b65a7D4E717e360Eca3C65B69520DCA",
    nftAbi: COMPUTE_ABI as Abi,
  },
];
