
# AGV Protocol - Tokenizing Real-World Assets

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/) [![Foundry](https://img.shields.io/badge/Foundry-Latest-green)](https://getfoundry.sh/) 

> Decentralized ecosystem tokenizing real-world assets (orchards, solar panels, compute farms) with verified physical output.

## 🌟 Overview

AGV Protocol bridges physical assets with blockchain technology, enabling transparent, verifiable tokenization of real-world production. The protocol uses a dual-token model:

- **GVT (Green Value Token)**: Governance and utility token with fixed 1B supply
- **rGGP (Rewarded Green Garden Points)**: Incentive token earned from verified real-world output

### Key Features

 **Verified Output Minting** - Tokens minted only from oracle-verified physical production  
 **DAO Governance** - Two-tier voting system (NFT holders + GVT stakers)  
 **Sustainable Economics** - Bonding curves, vesting, and buyback mechanisms  
 **Multi-Chain Ready** - Designed for BNB Chain and Arbitrum  
 **Security First** - Comprehensive testing, access controls, emergency pauses  
 **Audit Ready** - Clean code, extensive documentation, 138+ tests

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGV Protocol                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐      │
│  │   GVT    │◄────────┤ Bonding  │◄────────┤   rGGP   │      │
│  │ Fixed 1B │ convert │  Curve   │  mint   │ Uncapped │      │
│  │Governance│ vested  │ 7-30 day │         │ Rewards  │      │
│  └────┬─────┘         └──────────┘         └────▲─────┘      │
│       │                                          │            │
│       │              ┌──────────┐                │            │
│       └─────────────►│   DAO    │                │            │
│         governance   │Controller│                │            │
│                      └──────────┘                │            │
│                                                  │            │
│                      ┌──────────┐                │            │
│                      │  Oracle  │────────────────┘            │
│                      │Verification│                           │
│                      └─────┬────┘                             │
│                            │                                  │
│                      ┌─────▼────┐                             │
│                      │PowerToMint│                            │
│                      └─────┬────┘                             │
│                            │                                  │
│                    ┌───────▼───────┐                          │
│                    │  IoT Sensors  │                          │
│                    │ Solar/Orchard │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
agv-protocol/
├── contracts/
│   ├── tokens/
│   │   ├── GVT.sol                      # Governance token (1B cap)
│   │   └── rGGP.sol                     # Rewards token (uncapped)
│   ├── core/
│   │   ├── BondingCurve.sol             # rGGP → GVT conversion
│   │   ├── OracleVerification.sol       # Data validation layer
│   │   └── PowerToMint.sol              # Minting coordination
│   ├── governance/
│   │   └── DAOController.sol            # Protocol governance
│   └── utils/
│       └── VestingVault.sol             # Token vesting management
├── test/
│   ├── GVT.t.sol                        # 20+ tests
│   ├── rGGP.t.sol                       # 18+ tests
│   ├── BondingCurve.t.sol               # 25+ tests
│   ├── VestingVault.t.sol               # 22+ tests
│   ├── PowerToMint.t.sol                # 20+ tests
│   ├── OracleVerification.t.sol         # 15+ tests
│   └── DAOController.t.sol              # 18+ tests
├── script/
│   ├── Deploy.s.sol                     # Base deployment
│   ├── DeployTestnet.s.sol              # Testnet configuration
│   ├── DeployMainnet.s.sol              # Production deployment
│   ├── Verify.s.sol                     # Contract verification
│   ├── deploy.sh                        # Deployment wrapper
│   └── verify-all.sh                    # Batch verification
├── foundry.toml                         # Foundry configuration
├── hardhat.config.js                    # Hardhat configuration
├── package.json                         # npm dependencies
├── DEPLOYMENT.md                        # Deployment guide
└── README.md                            # This file
```

## 🚀 Quick Start

### Prerequisites

```bash
# Required
Node.js >= 16.0.0
npm >= 8.0.0
Foundry (forge, cast, anvil)

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/agv-protocol.git
cd agv-protocol

# Run setup script
./setup.sh

# Or manually:
npm install
forge install
forge build
```

### Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

**Required .env variables:**
=> Deployment Chain: BNB Smart Chain 

```bash
PRIVATE_KEY=your_deployer_private_key
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key
```

### Run Tests

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vv

# Run with gas report
forge test --gas-report

# Run coverage
forge coverage

# Run specific test file
forge test --match-path test/GVT.t.sol -vv

# Run specific test
forge test --match-test testMintFromOutput -vvv
```

### Deploy

```bash
# Deploy to testnet
./script/deploy.sh bscTestnet --broadcast --verify

# Deploy to mainnet (requires confirmation)
./script/deploy.sh bsc --broadcast --verify --slow

# Verify contracts
./script/verify-all.sh bscTestnet
```

### Running Tests

```bash
# All tests
forge test

# With verbosity levels
forge test -vvvvv # Show all traces

# Specific tests
forge test --match-contract GVTTest
forge test --match-test testMint
forge test --match-path test/GVT.t.sol

# Gas reporting
forge test --gas-report

# Coverage
forge coverage
forge coverage --report lcov
```

## 🚀 Deployment

### Testnet Deployment

```bash
# Deploy to BSC Testnet
./script/deploy.sh bscTestnet --broadcast --verify

# Deploy to Arbitrum Sepolia
./script/deploy.sh arbitrumSepolia --broadcast --verify

# Check deployment
cat deployments/bscTestnet-latest.json
```

### Mainnet Deployment

⚠️ **CRITICAL: Complete pre-deployment checklist**

```bash
# Pre-flight check
forge script script/DeployMainnet.s.sol --rpc-url $BSC_RPC_URL -vvvv

# Deploy (requires confirmation)
./script/deploy.sh bsc --broadcast --verify --slow

# Verify
./script/verify-all.sh bsc

# Transfer ownership to multisig
cast send $GVT_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN_ROLE") $MULTISIG \
  --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY
```

See [DEPLOYMENT.md]() for complete guide.


## 🔒 Security

### Access Control

All contracts use OpenZeppelin's `AccessControl`:

```solidity
DEFAULT_ADMIN_ROLE    // Protocol admin
MINTER_ROLE          // Can mint tokens
PAUSER_ROLE          // Can pause contracts
OPERATOR_ROLE        // Day-to-day operations
EXECUTOR_ROLE        // Execute DAO proposals
GUARDIAN_ROLE        // Emergency actions
```



## 🛠️ Development

### Building

```bash
forge build                 # Compile contracts
forge build --force        # Force recompile
forge clean                # Clean artifacts
```

### Formatting

```bash
forge fmt                  # Format contracts
forge fmt --check          # Check formatting
```

### Gas Optimization

```bash
forge test --gas-report                    # Gas usage report
forge snapshot                             # Create gas snapshot
forge snapshot --diff .gas-snapshot        # Compare snapshots
```

### Local Development

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy locally
forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Interact with contracts
cast call $GVT_ADDRESS "symbol()(string)" \
  --rpc-url http://127.0.0.1:8545
```

## 📖 Documentation

- **[DEPLOYMENT.md]()** - Complete deployment guide
- **[Test Documentation]()** - Testing guide
- **[AGV Handbook]()** - Protocol handbook
- **[API Documentation]()** - Contract interfaces
- **[Governance Guide]()** - DAO operations

## 📜 License

This project is licensed under the MIT License - see the [LICENSE]() file for details.
