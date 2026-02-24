# AGV Oracle - On-Chain Verification System

A Solidity smart contract system for storing and verifying Real World Asset (Solar,Compute) generation data on-chain, with cryptographic evidence trails and immutable monthly settlement records.

## Overview

AGVOracle is an on-chain oracle contract that:
- **Stores daily power generation snapshots** with EIP-712 cryptographic signatures
- **Records monthly settlement data** as the sole source of truth for token minting
- **Maintains full audit trails** with versioned amendments and SHA-256 file verification
- **Implements role-based access control** for secure multi-party operations

## Key Features

###  Daily Snapshots
- 15-minute interval data (96 records per day)
- EIP-712 signed attestations from tech team
- Immutable once stored (evidence layer only)
- Grid-delivered and self-consumed energy tracking

###  Monthly Settlements
- State Grid bill reconciliation (audit master)
- Versioned amendments with full history
- Multi-signature authorization required
- SHA-256 verification of supporting documents

###  Security
- Role-based access control (OpenZeppelin)
- Pausable emergency stop mechanism
- EIP-712 typed data signing
- Immutable historical records

## Architecture

```
┌─────────────────────┐
│   ORACLE_TEAM       │  → Posts daily snapshots (evidence)
│   (Tech/Data Admin) │
└─────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│      AGVOracle Contract         │
│  ┌──────────────────────────┐   │
│  │  Daily Snapshots         │   │  Evidence layer
│  │  (EIP-712 signed)        │   │  (not mint-determining)
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  Monthly Settlements     │   │  Minting anchor
│  │  (Multisig-gated)        │   │  (sole source of truth)
│  └──────────────────────────┘   │
└─────────────────────────────────┘
           ▲
           │
┌─────────────────────┐
│ SETTLEMENT_MULTISIG │  → Posts/amends monthly settlements
│ (Finance + Tech)    │
└─────────────────────┘
```

## Installation

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Solidity ^0.8.19

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd agv-onchain-verification

# Install dependencies
forge install

# Build
forge build

# Run tests
forge test

# Run tests with coverage
forge coverage --ir-minimum
```

## Testing

Comprehensive test suite covering:
- Daily snapshot storage and validation
- Monthly settlement creation and amendments
- Role-based access control
- Pausable functionality
- EIP-712 signature verification
- Edge cases and error conditions

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test test_StoreDailySnapshot_Success

# Run with verbosity
forge test -vvvv

# Generate gas report
forge test --gas-report
```

## Deployment

### Quick Start

1. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your values
```

2. **Deploy to testnet:**
```bash
source .env
forge script script/DeployAGVOracle.s.sol:DeployAGVOracle \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

3. **Test locally with Anvil:**
```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy
source .env.local
forge script script/DeployAGVOracle.s.sol:DeployAGVOracle \
  --rpc-url http://localhost:8545 \
  --broadcast \
  -vvvv
```

<!-- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions. -->

## Usage

### Roles

| Role | Permissions | Typical Holders |
|------|-------------|-----------------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles, pause contract | DAO Multisig |
| `ORACLE_TEAM` | Post daily snapshots | Tech Lead, Data Admin |
| `SETTLEMENT_MULTISIG` | Post/amend monthly settlements | Finance + Tech Multisig |

### Daily Snapshot Workflow

1. Tech team collects 15-minute interval data (96 records/day)
2. Generate CSV file with data
3. Create EIP-712 signature
4. Call `storeDailySnapshot()` with signed data
5. Event emitted with snapshot hash for verification

### Monthly Settlement Workflow

1. Receive State Grid bill (audit master)
2. Reconcile with daily snapshots
3. Settlement multisig calls `storeMonthlySettlement()`
4. Event emitted → triggers token minting (off-chain)
5. If correction needed: use `amendMonthlySettlement()` with reason

### Amendment Process

All amendments are tracked with:
- Full historical record (all revisions stored)
- Reason for amendment (e.g., "Red invoice correction")
- New revision number (auto-incremented)
- Timestamp and reconciler address



## Data Formats

### Scaling Conventions
- Energy (kWh): multiply by 10 (e.g., 500.5 kWh → 5005)
- Compute hours: multiply by 10 (e.g., 24.5h → 245)
- Tariff: basis points (e.g., 0.5 → 5000 bp)

### Date/Time Formats
- Daily date: `YYYY-MM-DD` (UTC, ISO-8601)
- Monthly period: `YYYY-MM` (UTC, ISO-8601)

### Station ID
- Format: `STATION-XXX` (e.g., `STATION-001`)
- Unique identifier per solar station

## Security Considerations

### Access Control
- Admin role should be a multisig (Gnosis Safe recommended)
- Settlement multisig requires at least 2-of-3 signatures
- Tech team members should use hardware wallets

### Immutability
- Daily snapshots cannot be overwritten
- Monthly settlements maintain full revision history
- All amendments tracked with reason and reconciler

### Emergency Controls
- Pausable functionality for emergency stops
- Only admin can pause/unpause
- Paused state blocks all state-changing operations

## Development

### Project Structure
```
.
├── src/
│   ├── AGVOracle.sol          # Main contract implementation
│   └── interfaces/
│       └── IAGVOracle.sol     # Contract interface
├── script/
│   └── AGVOracle.s.sol        # Deployment script
├── test/
│   └── AGVOracle.t.sol        # Test suite
├── .env.example               # Environment template
├── foundry.toml               # Foundry configuration
├── DEPLOYMENT.md              # Detailed deployment guide
└── README.md                  # This file
```

### Running Tests Locally

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test file
forge test --match-path test/AGVOracle.t.sol

# Run with coverage
forge coverage --ir-minimum
```

## License

MIT License - see [LICENSE](./LICENSE) file for details


