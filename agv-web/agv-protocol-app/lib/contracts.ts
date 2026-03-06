// Simplified contracts configuration without Thirdweb imports
// This avoids ES module compatibility issues

export const CHAINS = {
  "56": {
    chainId: "56",
    name: "Binance Smart Chain",
    symbol: "BNB",
    explorer: "https://bscscan.com",
    nft: "0xe268e673a220354c70b324C02635620a591651F5"
  },
  "137": {
    chainId: "137",
    name: "Polygon",
    symbol: "MATIC",
    explorer: "https://polygonscan.com",
    nft: ""
  },
  "42161": {
    chainId: "42161",
    name: "Arbitrum One",
    symbol: "ETH",
    explorer: "https://arbiscan.io",
    nft: ""
  }
} as const;

export const USDT_ADDRESSES = {
  "56": "0x55d398326f99059fF775485246999027B3197955", // BSC USDT
  "137": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon USDT
  "42161": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum USDT
} as const;

export const NFT_CONTRACTS = {
  "56": {
    seed: "0xFF362C39eB0eDecA946A5528d30D9c9E9285f3fc",
    tree: "0x1E092126E4AB12503d37dD08E20F9192b8439458",
    solar: "0x4F26621592D3B1ca344d187e469a86e2eE5FEa1E",
    compute: "0x6F503f315c95835A68d140440CA49b5C3e885Ce3",
  },
  "137": {
    seed: "0x492a86EdEEa01158FcD3C8f2348A4c0431b8A24d",
    tree: "0xf44f237b8775ae985107dd2f877d5c5bbaaea31f",
    solar: "0x19B21F15C2E49dD0697e6D3499C82f0B899B97f2",
    compute: "0xa2c1381B89FD986B4dbA4dbb03167A7655107308",
  },
  "42161": {
    seed: "0x90b9E1C8645bC731be19537A4932B26Fc218e464",
    tree: "0xc574AB1e7e2B27ff4460C299E3448C572894276A",
    solar: "0x492a86EdEEa01158FcD3C8f2348A4c0431b8A24d",
    compute: "0xf44F237b8775AE985107dd2F877d5c5BBaAea31f",
  }
} as const;


// -----------------------------
// ABIs
// -----------------------------

// Shared SEED ABI (identical across BSC, Polygon, Arbitrum)

export const SOLAR_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"AccessControlBadConfirmation","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bytes32","name":"neededRole","type":"bytes32"}],"name":"AccessControlUnauthorizedAccount","type":"error"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"AddressEmptyCode","type":"error"},{"inputs":[],"name":"ApprovalCallerNotOwnerNorApproved","type":"error"},{"inputs":[],"name":"ApprovalQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"BalanceQueryForZeroAddress","type":"error"},{"inputs":[{"internalType":"address","name":"implementation","type":"address"}],"name":"ERC1967InvalidImplementation","type":"error"},{"inputs":[],"name":"ERC1967NonPayable","type":"error"},{"inputs":[{"internalType":"uint256","name":"numerator","type":"uint256"},{"internalType":"uint256","name":"denominator","type":"uint256"}],"name":"ERC2981InvalidDefaultRoyalty","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC2981InvalidDefaultRoyaltyReceiver","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"numerator","type":"uint256"},{"internalType":"uint256","name":"denominator","type":"uint256"}],"name":"ERC2981InvalidTokenRoyalty","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC2981InvalidTokenRoyaltyReceiver","type":"error"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[],"name":"FailedCall","type":"error"},{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[],"name":"MintERC2309QuantityExceedsLimit","type":"error"},{"inputs":[],"name":"MintToZeroAddress","type":"error"},{"inputs":[],"name":"MintZeroQuantity","type":"error"},{"inputs":[],"name":"NotCompatibleWithSpotMints","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"OwnerQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"OwnershipNotInitializedForExtraData","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[],"name":"SequentialMintExceedsLimit","type":"error"},{"inputs":[],"name":"SequentialUpToTooSmall","type":"error"},{"inputs":[],"name":"SpotMintTokenIdTooSmall","type":"error"},{"inputs":[],"name":"TokenAlreadyExists","type":"error"},{"inputs":[],"name":"TransferCallerNotOwnerNorApproved","type":"error"},{"inputs":[],"name":"TransferFromIncorrectOwner","type":"error"},{"inputs":[],"name":"TransferToNonERC721ReceiverImplementer","type":"error"},{"inputs":[],"name":"TransferToZeroAddress","type":"error"},{"inputs":[],"name":"URIQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"UUPSUnauthorizedCallContext","type":"error"},{"inputs":[{"internalType":"bytes32","name":"slot","type":"bytes32"}],"name":"UUPSUnsupportedProxiableUUID","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agent","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"AgentMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agent","type":"address"},{"indexed":false,"internalType":"bool","name":"authorized","type":"bool"}],"name":"AgentUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"newBaseURI","type":"string"}],"name":"BaseURIUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"fromTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"toTokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"ConsecutiveTransfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"version","type":"uint64"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[],"name":"MetadataFrozened","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"PublicMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"wlEndTime","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"SaleConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TreasuryWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"implementation","type":"address"}],"name":"Upgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"WhitelistMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"newRoot","type":"bytes32"}],"name":"WhitelistUpdated","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"UPGRADE_INTERFACE_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"recipients","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"agentMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"config","outputs":[{"internalType":"uint64","name":"wlStartTime","type":"uint64"},{"internalType":"uint64","name":"wlEndTime","type":"uint64"},{"internalType":"bool","name":"saleActive","type":"bool"},{"internalType":"bool","name":"metadataFrozen","type":"bool"},{"internalType":"uint256","name":"publicMinted","type":"uint256"},{"internalType":"uint256","name":"reservedMinted","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"freezeMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentPhase","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRemainingPublicSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRemainingReservedSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agent","type":"address"}],"name":"grantAgentRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"usdtAddress","type":"address"},{"internalType":"address","name":"treasury","type":"address"},{"internalType":"bytes32","name":"initialMerkleRoot","type":"bytes32"},{"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"internalType":"uint256","name":"wlEndTime","type":"uint256"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes32[]","name":"merkleProof","type":"bytes32[]"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"numberMinted","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"callerConfirmation","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"agent","type":"address"}],"name":"revokeAgentRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"salePrice","type":"uint256"}],"name":"royaltyInfo","outputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"newBaseURI","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint96","name":"fee","type":"uint96"}],"name":"setRoyaltyInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"internalType":"uint256","name":"wlEndTime","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"name":"setSaleConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newTreasury","type":"address"}],"name":"setTreasuryReceiver","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"newRoot","type":"bytes32"}],"name":"setWhitelistRoot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"result","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"treasuryReceiver","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeToAndCall","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"usdtToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"whitelistMerkleRoot","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"withdrawTreasury","outputs":[],"stateMutability":"nonpayable","type":"function"}]

export const COMPUTE_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"AccessControlBadConfirmation","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bytes32","name":"neededRole","type":"bytes32"}],"name":"AccessControlUnauthorizedAccount","type":"error"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"AddressEmptyCode","type":"error"},{"inputs":[],"name":"ApprovalCallerNotOwnerNorApproved","type":"error"},{"inputs":[],"name":"ApprovalQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"BalanceQueryForZeroAddress","type":"error"},{"inputs":[{"internalType":"address","name":"implementation","type":"address"}],"name":"ERC1967InvalidImplementation","type":"error"},{"inputs":[],"name":"ERC1967NonPayable","type":"error"},{"inputs":[{"internalType":"uint256","name":"numerator","type":"uint256"},{"internalType":"uint256","name":"denominator","type":"uint256"}],"name":"ERC2981InvalidDefaultRoyalty","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC2981InvalidDefaultRoyaltyReceiver","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"numerator","type":"uint256"},{"internalType":"uint256","name":"denominator","type":"uint256"}],"name":"ERC2981InvalidTokenRoyalty","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC2981InvalidTokenRoyaltyReceiver","type":"error"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[],"name":"FailedCall","type":"error"},{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[],"name":"MintERC2309QuantityExceedsLimit","type":"error"},{"inputs":[],"name":"MintToZeroAddress","type":"error"},{"inputs":[],"name":"MintZeroQuantity","type":"error"},{"inputs":[],"name":"NotCompatibleWithSpotMints","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"OwnerQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"OwnershipNotInitializedForExtraData","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[],"name":"SequentialMintExceedsLimit","type":"error"},{"inputs":[],"name":"SequentialUpToTooSmall","type":"error"},{"inputs":[],"name":"SpotMintTokenIdTooSmall","type":"error"},{"inputs":[],"name":"TokenAlreadyExists","type":"error"},{"inputs":[],"name":"TransferCallerNotOwnerNorApproved","type":"error"},{"inputs":[],"name":"TransferFromIncorrectOwner","type":"error"},{"inputs":[],"name":"TransferToNonERC721ReceiverImplementer","type":"error"},{"inputs":[],"name":"TransferToZeroAddress","type":"error"},{"inputs":[],"name":"URIQueryForNonexistentToken","type":"error"},{"inputs":[],"name":"UUPSUnauthorizedCallContext","type":"error"},{"inputs":[{"internalType":"bytes32","name":"slot","type":"bytes32"}],"name":"UUPSUnsupportedProxiableUUID","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agent","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"AgentMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"agent","type":"address"},{"indexed":false,"internalType":"bool","name":"authorized","type":"bool"}],"name":"AgentUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"newBaseURI","type":"string"}],"name":"BaseURIUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"fromTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"toTokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"ConsecutiveTransfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"version","type":"uint64"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[],"name":"MetadataFrozened","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"PublicMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"wlEndTime","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"SaleConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TreasuryWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"implementation","type":"address"}],"name":"Upgraded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"WhitelistMint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"newRoot","type":"bytes32"}],"name":"WhitelistUpdated","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"UPGRADE_INTERFACE_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"recipients","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"agentMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"config","outputs":[{"internalType":"uint64","name":"wlStartTime","type":"uint64"},{"internalType":"uint64","name":"wlEndTime","type":"uint64"},{"internalType":"bool","name":"saleActive","type":"bool"},{"internalType":"bool","name":"metadataFrozen","type":"bool"},{"internalType":"uint256","name":"publicMinted","type":"uint256"},{"internalType":"uint256","name":"reservedMinted","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"freezeMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentPhase","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRemainingPublicSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRemainingReservedSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"agent","type":"address"}],"name":"grantAgentRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"usdtAddress","type":"address"},{"internalType":"address","name":"treasury","type":"address"},{"internalType":"bytes32","name":"initialMerkleRoot","type":"bytes32"},{"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"internalType":"uint256","name":"wlEndTime","type":"uint256"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes32[]","name":"merkleProof","type":"bytes32[]"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"numberMinted","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxiableUUID","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"callerConfirmation","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"agent","type":"address"}],"name":"revokeAgentRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"salePrice","type":"uint256"}],"name":"royaltyInfo","outputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"newBaseURI","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint96","name":"fee","type":"uint96"}],"name":"setRoyaltyInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"wlStartTime","type":"uint256"},{"internalType":"uint256","name":"wlEndTime","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"name":"setSaleConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newTreasury","type":"address"}],"name":"setTreasuryReceiver","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"newRoot","type":"bytes32"}],"name":"setWhitelistRoot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"result","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"treasuryReceiver","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newImplementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeToAndCall","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"usdtToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"whitelistMerkleRoot","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"withdrawTreasury","outputs":[],"stateMutability":"nonpayable","type":"function"}]

export const SEED_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "AccessControlBadConfirmation", "type": "error" },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "bytes32", "name": "neededRole", "type": "bytes32" }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  { "inputs": [{ "internalType": "address", "name": "target", "type": "address" }], "name": "AddressEmptyCode", "type": "error" },
  { "inputs": [], "name": "ApprovalCallerNotOwnerNorApproved", "type": "error" },
  { "inputs": [], "name": "ApprovalQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "BalanceQueryForZeroAddress", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "implementation", "type": "address" }], "name": "ERC1967InvalidImplementation", "type": "error" },
  { "inputs": [], "name": "ERC1967NonPayable", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "numerator", "type": "uint256" },
      { "internalType": "uint256", "name": "denominator", "type": "uint256" }
    ],
    "name": "ERC2981InvalidDefaultRoyalty",
    "type": "error"
  },
  { "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }], "name": "ERC2981InvalidDefaultRoyaltyReceiver", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "numerator", "type": "uint256" },
      { "internalType": "uint256", "name": "denominator", "type": "uint256" }
    ],
    "name": "ERC2981InvalidTokenRoyalty",
    "type": "error"
  },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "receiver", "type": "address" }], "name": "ERC2981InvalidTokenRoyaltyReceiver", "type": "error" },
  { "inputs": [], "name": "EnforcedPause", "type": "error" },
  { "inputs": [], "name": "ExpectedPause", "type": "error" },
  { "inputs": [], "name": "FailedCall", "type": "error" },
  { "inputs": [], "name": "InvalidInitialization", "type": "error" },
  { "inputs": [], "name": "MintERC2309QuantityExceedsLimit", "type": "error" },
  { "inputs": [], "name": "MintToZeroAddress", "type": "error" },
  { "inputs": [], "name": "MintZeroQuantity", "type": "error" },
  { "inputs": [], "name": "NotCompatibleWithSpotMints", "type": "error" },
  { "inputs": [], "name": "NotInitializing", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
  { "inputs": [], "name": "OwnerQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "OwnershipNotInitializedForExtraData", "type": "error" },
  { "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "SafeERC20FailedOperation", "type": "error" },
  { "inputs": [], "name": "SequentialMintExceedsLimit", "type": "error" },
  { "inputs": [], "name": "SequentialUpToTooSmall", "type": "error" },
  { "inputs": [], "name": "SpotMintTokenIdTooSmall", "type": "error" },
  { "inputs": [], "name": "TokenAlreadyExists", "type": "error" },
  { "inputs": [], "name": "TransferCallerNotOwnerNorApproved", "type": "error" },
  { "inputs": [], "name": "TransferFromIncorrectOwner", "type": "error" },
  { "inputs": [], "name": "TransferToNonERC721ReceiverImplementer", "type": "error" },
  { "inputs": [], "name": "TransferToZeroAddress", "type": "error" },
  { "inputs": [], "name": "URIQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "UUPSUnauthorizedCallContext", "type": "error" },
  { "inputs": [{ "internalType": "bytes32", "name": "slot", "type": "bytes32" }], "name": "UUPSUnsupportedProxiableUUID", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256" }
    ],
    "name": "AgentMint",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "agent", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "authorized", "type": "bool" }], "name": "AgentUpdated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "approved", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Approval", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }], "name": "ApprovalForAll", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "string", "name": "newBaseURI", "type": "string" }], "name": "BaseURIUpdated", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "fromTokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "toTokenId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" }
    ],
    "name": "ConsecutiveTransfer",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint64", "name": "version", "type": "uint64" }], "name": "Initialized", "type": "event" },
  { "anonymous": false, "inputs": [], "name": "MetadataFrozened", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Paused", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }], "name": "PublicMint", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "previousAdminRole", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "newAdminRole", "type": "bytes32" }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": true, "internalType": "address", "name": "sender", "type": "address" }], "name": "RoleGranted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": true, "internalType": "address", "name": "sender", "type": "address" }], "name": "RoleRevoked", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "wlStartTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }, { "indexed": false, "internalType": "bool", "name": "active", "type": "bool" }], "name": "SaleConfigUpdated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Transfer", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "token", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "TreasuryWithdraw", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Unpaused", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "implementation", "type": "address" }], "name": "Upgraded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }], "name": "WhitelistMint", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "newRoot", "type": "bytes32" }], "name": "WhitelistUpdated", "type": "event" },
  { "inputs": [], "name": "DEFAULT_ADMIN_ROLE", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "UPGRADE_INTERFACE_VERSION", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [],
    "name": "config",
    "outputs": [
      { "internalType": "uint64", "name": "wlStartTime", "type": "uint64" },
      { "internalType": "uint64", "name": "wlEndTime", "type": "uint64" },
      { "internalType": "bool", "name": "saleActive", "type": "bool" },
      { "internalType": "bool", "name": "metadataFrozen", "type": "bool" },
      { "internalType": "uint16", "name": "publicMinted", "type": "uint16" },
      { "internalType": "uint16", "name": "whitelistMinted", "type": "uint16" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [], "name": "freezeMetadata", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "getApproved", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getCurrentPhase", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getRemainingPublicSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getRemainingWhitelistSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }], "name": "getRoleAdmin", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "grantRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "hasRole", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "symbol", "type": "string" },
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "usdtAddress", "type": "address" },
      { "internalType": "address", "name": "treasury", "type": "address" },
      { "internalType": "bytes32", "name": "initialMerkleRoot", "type": "bytes32" },
      { "internalType": "uint256", "name": "wlStartTime", "type": "uint256" },
      { "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes32[]", "name": "merkleProof", "type": "bytes32[]" }], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "numberMinted", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "paused", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "proxiableUUID", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "callerConfirmation", "type": "address" }], "name": "renounceRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "revokeRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "salePrice", "type": "uint256" }], "name": "royaltyInfo", "outputs": [{ "internalType": "address", "name": "receiver", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "payable", "type": "function" },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "bytes", "name": "_data", "type": "bytes" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "newBaseURI", "type": "string" }], "name": "setBaseURI", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }, { "internalType": "uint96", "name": "fee", "type": "uint96" }], "name": "setRoyaltyInfo", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "wlStartTime", "type": "uint256" }, { "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "name": "setSaleConfig", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newTreasury", "type": "address" }], "name": "setTreasuryReceiver", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "newRoot", "type": "bytes32" }], "name": "setWhitelistRoot", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }], "name": "supportsInterface", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "tokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "result", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "transferFrom", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "treasuryReceiver", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newImplementation", "type": "address" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "upgradeToAndCall", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "usdtToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "whitelistMerkleRoot", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "withdrawTreasury", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

// Shared TREE ABI (identical across BSC, Polygon, Arbitrum)
export const TREE_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "AccessControlBadConfirmation", "type": "error" },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "bytes32", "name": "neededRole", "type": "bytes32" }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  { "inputs": [{ "internalType": "address", "name": "target", "type": "address" }], "name": "AddressEmptyCode", "type": "error" },
  { "inputs": [], "name": "ApprovalCallerNotOwnerNorApproved", "type": "error" },
  { "inputs": [], "name": "ApprovalQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "BalanceQueryForZeroAddress", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "implementation", "type": "address" }], "name": "ERC1967InvalidImplementation", "type": "error" },
  { "inputs": [], "name": "ERC1967NonPayable", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "numerator", "type": "uint256" },
      { "internalType": "uint256", "name": "denominator", "type": "uint256" }
    ],
    "name": "ERC2981InvalidDefaultRoyalty",
    "type": "error"
  },
  { "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }], "name": "ERC2981InvalidDefaultRoyaltyReceiver", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "numerator", "type": "uint256" },
      { "internalType": "uint256", "name": "denominator", "type": "uint256" }
    ],
    "name": "ERC2981InvalidTokenRoyalty",
    "type": "error"
  },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "receiver", "type": "address" }], "name": "ERC2981InvalidTokenRoyaltyReceiver", "type": "error" },
  { "inputs": [], "name": "EnforcedPause", "type": "error" },
  { "inputs": [], "name": "ExpectedPause", "type": "error" },
  { "inputs": [], "name": "FailedCall", "type": "error" },
  { "inputs": [], "name": "InvalidInitialization", "type": "error" },
  { "inputs": [], "name": "MintERC2309QuantityExceedsLimit", "type": "error" },
  { "inputs": [], "name": "MintToZeroAddress", "type": "error" },
  { "inputs": [], "name": "MintZeroQuantity", "type": "error" },
  { "inputs": [], "name": "NotCompatibleWithSpotMints", "type": "error" },
  { "inputs": [], "name": "NotInitializing", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
  { "inputs": [], "name": "OwnerQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "OwnershipNotInitializedForExtraData", "type": "error" },
  { "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "SafeERC20FailedOperation", "type": "error" },
  { "inputs": [], "name": "SequentialMintExceedsLimit", "type": "error" },
  { "inputs": [], "name": "SequentialUpToTooSmall", "type": "error" },
  { "inputs": [], "name": "SpotMintTokenIdTooSmall", "type": "error" },
  { "inputs": [], "name": "TokenAlreadyExists", "type": "error" },
  { "inputs": [], "name": "TransferCallerNotOwnerNorApproved", "type": "error" },
  { "inputs": [], "name": "TransferFromIncorrectOwner", "type": "error" },
  { "inputs": [], "name": "TransferToNonERC721ReceiverImplementer", "type": "error" },
  { "inputs": [], "name": "TransferToZeroAddress", "type": "error" },
  { "inputs": [], "name": "URIQueryForNonexistentToken", "type": "error" },
  { "inputs": [], "name": "UUPSUnauthorizedCallContext", "type": "error" },
  { "inputs": [{ "internalType": "bytes32", "name": "slot", "type": "bytes32" }], "name": "UUPSUnsupportedProxiableUUID", "type": "error" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "approved", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Approval", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }], "name": "ApprovalForAll", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "string", "name": "newBaseURI", "type": "string" }], "name": "BaseURIUpdated", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "fromTokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "toTokenId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" }
    ],
    "name": "ConsecutiveTransfer",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint64", "name": "version", "type": "uint64" }], "name": "Initialized", "type": "event" },
  { "anonymous": false, "inputs": [], "name": "MetadataFrozened", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Paused", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }], "name": "PublicMint", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "previousAdminRole", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "newAdminRole", "type": "bytes32" }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": true, "internalType": "address", "name": "sender", "type": "address" }], "name": "RoleGranted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": true, "internalType": "address", "name": "sender", "type": "address" }], "name": "RoleRevoked", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "wlStartTime", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }, { "indexed": false, "internalType": "bool", "name": "active", "type": "bool" }], "name": "SaleConfigUpdated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Transfer", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "token", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "TreasuryWithdraw", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Unpaused", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "implementation", "type": "address" }], "name": "Upgraded", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "minter", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }], "name": "WhitelistMint", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "newRoot", "type": "bytes32" }], "name": "WhitelistUpdated", "type": "event" },
  { "inputs": [], "name": "DEFAULT_ADMIN_ROLE", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "UPGRADE_INTERFACE_VERSION", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [],
    "name": "config",
    "outputs": [
      { "internalType": "uint64", "name": "wlStartTime", "type": "uint64" },
      { "internalType": "uint64", "name": "wlEndTime", "type": "uint64" },
      { "internalType": "bool", "name": "saleActive", "type": "bool" },
      { "internalType": "bool", "name": "metadataFrozen", "type": "bool" },
      { "internalType": "uint256", "name": "publicMinted", "type": "uint256" },
      { "internalType": "uint256", "name": "whitelistMinted", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [], "name": "freezeMetadata", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "getApproved", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getCurrentPhase", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getRemainingPublicSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getRemainingWhitelistSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }], "name": "getRoleAdmin", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "grantRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "hasRole", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "symbol", "type": "string" },
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "usdtAddress", "type": "address" },
      { "internalType": "address", "name": "treasury", "type": "address" },
      { "internalType": "bytes32", "name": "initialMerkleRoot", "type": "bytes32" },
      { "internalType": "uint256", "name": "wlStartTime", "type": "uint256" },
      { "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes32[]", "name": "merkleProof", "type": "bytes32[]" }], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "numberMinted", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "paused", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "proxiableUUID", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "callerConfirmation", "type": "address" }], "name": "renounceRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "role", "type": "bytes32" }, { "internalType": "address", "name": "account", "type": "address" }], "name": "revokeRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "salePrice", "type": "uint256" }], "name": "royaltyInfo", "outputs": [{ "internalType": "address", "name": "receiver", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "payable", "type": "function" },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "bytes", "name": "_data", "type": "bytes" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "newBaseURI", "type": "string" }], "name": "setBaseURI", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }, { "internalType": "uint96", "name": "fee", "type": "uint96" }], "name": "setRoyaltyInfo", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "wlStartTime", "type": "uint256" }, { "internalType": "uint256", "name": "wlEndTime", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "name": "setSaleConfig", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newTreasury", "type": "address" }], "name": "setTreasuryReceiver", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "newRoot", "type": "bytes32" }], "name": "setWhitelistRoot", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }], "name": "supportsInterface", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "tokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "result", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "transferFrom", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "treasuryReceiver", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newImplementation", "type": "address" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "upgradeToAndCall", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "usdtToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "whitelistMerkleRoot", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "withdrawTreasury", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

// Standard USDT ABI (as provided)
export const USDT_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Simplified ABI for NFT contracts
export const NFT_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "quantity", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Staking contract addresses
export const STAKE_CONTRACTS = {
  "56": {
    seed: "0xe268e673a220354c70b324C02635620a591651F5", 
    tree: "0xb203C59041Aa907A31CEDc1b5940330FE79240e0", 
    solar: "0xb29A79ef1BA60f6F14C4CEf8009fA62462d02457", 
    compute: "0xb65F906a95c6da8a68fe06223a7b45B93F32Ef67", 
  },
  "137": {
    seed: "0x97374395524966dC37173f2687Adfe102cdc379F", 
    tree: "0x09134a3336b037d81bcF6f9fB0d6d01006486F69", 
    solar: "0xe7B07808A4EE8F9CB9AA8503Fd0c30543f1F2567", 
    compute: "0x5BBe89D35B31aF8Cb98937c608B82F295e9963b3", 
  },
  "42161": {
    seed: "0xf2Fbdf4f05D23698EED36F02B632790421bc262e", 
    tree: "0xC17c8d0366356148250972aaeEf6DB7e92fbdc17",
    solar: "0xd6DeA02195cA3778c5cd77eE87B010B2A41C38E4",
    compute: "0x620E35906b65a7D4E717e360Eca3C65B69520DCA", 
  },
} as const;

// Staking contract ABI (simplified for StakeERC721)
export const STAKE_ABI = [
  {
    inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "staker", type: "address" }],
    name: "getStakeInfo",
    outputs: [
      { internalType: "uint256", name: "tokensStaked", type: "uint256" },
      { internalType: "uint256", name: "rewards", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getStakedTokens",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "timeUnit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardsPerUnitTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Reward rates per tier (tokens per day)
export const REWARD_RATES = {
  seed: 10,    // 10 tokens per day
  tree: 25,    // 25 tokens per day
  solar: 50,   // 50 tokens per day
  compute: 100, // 100 tokens per day
} as const;

export type ChainId = keyof typeof CHAINS;
export type CollectionKey = keyof typeof NFT_CONTRACTS["56"];
