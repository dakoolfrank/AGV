# AGV Protocol — Full-Stack Smart Contract & DApp Repository

> **Owner**: `dakoolfrank/AGV` | **Chain**: Polygon / Sepolia / BNB Chain | **Solidity**: 0.8.20–0.8.27 | **Framework**: Foundry

Decentralized protocol for tokenizing real-world assets (solar panels, orchards, compute farms) with verified physical output, on-chain oracle verification, and DAO governance.

---

## Repository Structure

```
AGV/
├── agvprotocol-contracts-main/    ← NFT Pass 合约 (Foundry)
├── onchainverification-main/      ← Oracle 验证合约 (Foundry)
├── tokencontracts-main/           ← Token 经济合约 (Foundry)
├── agv-web/                       ← 8 个前端应用 (TypeScript/Next.js)
│   ├── agv-protocol-app/          ← 主应用 (264 TS files, 45 pages)
│   ├── buy-page/                  ← NFT 购买页 (103 files, 9 pages)
│   ├── G3-Funding/                ← GVT 融资/Staking (105 files, 17 pages)
│   ├── investor-portal/           ← 投资者门户 (72 files, 19 pages)
│   ├── architecture/              ← 架构展示站 (25 files)
│   ├── asset/                     ← 资产展示 (61 files, 6 pages)
│   ├── public/                    ← 静态页
│   └── template/                  ← 全栈脚手架模板
├── AGV-Agent-Architecture.md      ← AI Agent 自治开发运维架构
├── DESIGN.md                      ← 三模块深度审计 + 风险清单
├── NFT-AgentRegistry-Architecture.md
├── PreGVT-sGVT-Architecture.md
└── RUN.md                         ← 运行指南
```

---

## Smart Contracts

### 1. NFT Pass — `agvprotocol-contracts-main/`

资产注册 NFT 系统，UUPS 可升级，ERC721A 高效铸造。

| Contract | Description | Features |
|----------|-------------|----------|
| **SeedPass** | 种子轮准入 NFT | UUPS, ERC721A, Permit, Whitelist |
| **TreePass** | 果树资产 NFT | UUPS, ERC721A, Pausable |
| **SolarPass** | 光伏资产 NFT | UUPS, ERC721A, Role-based |
| **ComputePass** | 算力资产 NFT | UUPS, ERC721A |
| **AgentRegistry** | AI Agent 注册表 | 链上 Agent 身份管理 |

**Dependencies**: OpenZeppelin Contracts (Upgradeable) + ERC721A-Upgradeable + forge-std

```bash
cd agvprotocol-contracts-main
forge build
forge test
make test-coverage
```

### 2. Oracle Verification — `onchainverification-main/`

链上产出验证 Oracle，EIP-712 签名，月结算即铸币锚点。

| Contract | Description | Features |
|----------|-------------|----------|
| **AGVOracle** | 产出验证 Oracle | EIP-712 签名, 日快照, 月结算 |
| **IAGVOracle** | Oracle 接口 | 标准化接口定义 |

**Core Mechanism**:
- **Daily Snapshots**: 96 records/day (15-min intervals), EIP-712 signed attestations
- **Monthly Settlements**: State Grid bill reconciliation → sole minting anchor
- **Audit Trail**: Versioned amendments + SHA-256 document verification

```bash
cd onchainverification-main
forge build
forge test
```

### 3. Token Economics — `tokencontracts-main/`

双代币经济系统 + DAO 治理 + 铸造编排。

| Contract | Description | Features |
|----------|-------------|----------|
| **GVT** | 治理代币 | 1B 硬上限, Vesting, EIP-2612 Permit |
| **rGGP** | 激励代币 | 无上限, 基于验证产出铸造, Epoch Cap |
| **pGVT** | 预售代币 | PreGVT 迁移用途 |
| **PreGVT** | 预售凭证 | 线性 Vesting → GVT |
| **ShadowGVT** | 影子代币 | 预售抵押锁仓 |
| **BondingCurve** | 兑换曲线 | rGGP→GVT, 10:1 基准, 5% 折扣, 7-30d Vesting |
| **PowerToMint** | 铸造编排器 | IoT→Oracle→Mint, NFT 资产注册, 批量处理 |
| **OracleVerification** | 多源 Oracle 管理 | 签名验证, SLA 追踪 |
| **DAOController** | DAO 治理 | 提案→投票→时间锁→执行, 6 种提案类别 |
| **VestingVault** | 锁仓金库 | 独立 Vesting 管理 |
| **Presale** | 预售合约 | 额度分配 + 锁仓 |

**Minting Pipeline**:
```
IoT Device → AGVOracle (daily snapshot) → Monthly Settlement
    → PowerToMint (verify + orchestrate) → rGGP.mint()
    → BondingCurve (rGGP → GVT conversion, vested)
```

```bash
cd tokencontracts-main
forge build
forge test
```

---

## Frontend Applications — `agv-web/`

8 个 TypeScript/Next.js 前端，与三大合约交互。

| App | Size | Description | Contract Integration |
|-----|------|-------------|---------------------|
| **agv-protocol-app** | 26.6 MB | 主应用 | SeedPass, TreePass, SolarPass, ComputePass, rGGP, PowerToMint (ethers.js) |
| **buy-page** | 29.0 MB | NFT 购买 | SeedPass, TreePass, SolarPass, ComputePass, rGGP (viem) |
| **G3-Funding** | 5.9 MB | GVT 融资/Staking | GVT, mint, staking, wallet (260 refs) |
| **investor-portal** | 45.0 MB | 投资者门户 | Token, PowerToMint, rGGP |
| **architecture** | 8.2 MB | 架构/文档站 | GVT 展示 |
| **asset** | 3.5 MB | 资产展示 | Token 展示 |
| **public** | <0.1 MB | 静态官网 | — |
| **template** | 0.3 MB | 脚手架模板 | 通用全栈模板 |

### Contract ↔ Frontend Matrix

```
                    agv-protocol-app  buy-page  G3-Funding  investor-portal
SeedPass (NFT)            ✓              ✓
TreePass (NFT)            ✓              ✓
SolarPass (NFT)           ✓              ✓
ComputePass (NFT)         ✓              ✓
rGGP (Token)              ✓              ✓                       ✓
GVT (Token)                                        ✓
PowerToMint                ✓                                     ✓
BondingCurve                                        ✓
Staking/Wallet                                      ✓
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGV Protocol                                  │
├──────────────── Smart Contracts (Solidity) ──────────────────────────────┤
│                                                                         │
│  agvprotocol-contracts        onchainverification     tokencontracts    │
│  ┌──────────────────┐        ┌──────────────────┐    ┌──────────────┐  │
│  │ SeedPass     NFT │        │ AGVOracle        │    │ GVT   rGGP   │  │
│  │ TreePass     NFT │───────►│ Daily Snapshots  │───►│ PowerToMint  │  │
│  │ SolarPass    NFT │ asset  │ Monthly Settle   │mint│ BondingCurve │  │
│  │ ComputePass  NFT │ reg   │ EIP-712 Signed   │    │ DAOController│  │
│  │ AgentRegistry    │        └──────────────────┘    │ VestingVault │  │
│  └──────────────────┘                                └──────────────┘  │
│                                                                         │
├──────────────── Frontend (TypeScript/Next.js) ──────────────────────────┤
│                                                                         │
│  agv-protocol-app    buy-page    G3-Funding    investor-portal          │
│  ┌──────────────┐  ┌──────────┐ ┌──────────┐  ┌──────────────┐        │
│  │ Main DApp    │  │ NFT Shop │ │ GVT Fund │  │ Investor     │        │
│  │ ethers.js    │  │ viem     │ │ Staking  │  │ Dashboard    │        │
│  │ 45 pages     │  │ 9 pages  │ │ 17 pages │  │ 19 pages     │        │
│  └──────────────┘  └──────────┘ └──────────┘  └──────────────┘        │
│                                                                         │
│  architecture    asset    public    template                            │
│  ┌──────────┐  ┌──────┐ ┌──────┐  ┌──────────┐                        │
│  │ Docs/Viz │  │ View │ │ Page │  │ Scaffold │                        │
│  └──────────┘  └──────┘ └──────┘  └──────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Origin & Provenance

Three contract repositories originally lived under **[AGV-Protocol](https://github.com/AGV-Protocol/)** organization:

| Original Repo | Status | Local Copy |
|---------------|--------|------------|
| `AGV-Protocol/agvprotocol-contracts` | Removed/Privatized | `agvprotocol-contracts-main/` |
| `AGV-Protocol/onchainverification` | Removed/Privatized | `onchainverification-main/` |
| `AGV-Protocol/tokencontracts` | Removed/Privatized | `tokencontracts-main/` |

8 frontend repositories are still public under AGV-Protocol org (as of 2026-03):

| Repo | Pushed | Size |
|------|--------|------|
| `AGV-Protocol/agv-protocol-app` | 2026-02-23 | 31 MB |
| `AGV-Protocol/investor-portal` | 2025-12-08 | 45 MB |
| `AGV-Protocol/buy-page` | 2025-12-24 | 29 MB |
| `AGV-Protocol/architecture` | 2026-02-25 | 8 MB |
| `AGV-Protocol/G3-Funding` | 2025-12-24 | 4 MB |
| `AGV-Protocol/asset` | 2025-12-08 | 3.5 MB |
| `AGV-Protocol/template` | 2025-12-17 | 79 KB |
| `AGV-Protocol/public` | 2025-08-28 | 5 KB |

This repository (`dakoolfrank/AGV`) consolidates all contract and frontend code into a single maintainable monorepo.

---

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) — Solidity toolchain
- [Node.js](https://nodejs.org/) 18+ — Frontend builds
- Git

### Quick Start

```bash
# Clone
git clone --recursive https://github.com/dakoolfrank/AGV.git
cd AGV

# Build all contracts
cd agvprotocol-contracts-main && forge build && cd ..
cd onchainverification-main && forge build && cd ..
cd tokencontracts-main && forge build && cd ..

# Run all tests
cd agvprotocol-contracts-main && forge test && cd ..
cd onchainverification-main && forge test && cd ..
cd tokencontracts-main && forge test && cd ..
```

### Deployment

Each contract module has Foundry deployment scripts under `script/`:

| Module | Scripts |
|--------|---------|
| agvprotocol-contracts | `SeedPass.s.sol`, `TreePass.s.sol`, `SolarPass.s.sol`, `ComputePass.s.sol`, `AgentRegistry.s.sol` |
| onchainverification | `AGVOracle.s.sol` |
| tokencontracts | `Deploy.s.sol`, `DeployMainnet.s.sol`, `DeployTestnet.s.sol`, `DeployPresale.s.sol`, `AirdropMint.s.sol`, `AddLiquidity.s.sol`, `PreGVTMigration.s.sol` |

See each module's README and [RUN.md](RUN.md) for detailed deployment instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [DESIGN.md](DESIGN.md) | Three-module deep audit — 14 contracts, risk registry (P0-P2), interface matrix |
| [AGV-Agent-Architecture.md](AGV-Agent-Architecture.md) | AI Agent autonomous dev-ops system — Master/SubAgent hierarchy, 4-layer governance, self-healing loops |
| [NFT-AgentRegistry-Architecture.md](NFT-AgentRegistry-Architecture.md) | On-chain Agent Registry — NFT-bound identity, capability attestation |
| [PreGVT-sGVT-Architecture.md](PreGVT-sGVT-Architecture.md) | PreGVT → GVT migration path — Shadow token, presale mechanics |
| [RUN.md](RUN.md) | Operational runbook — build, test, deploy commands |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.20–0.8.27, Foundry (forge/cast/anvil) |
| **Contract Libraries** | OpenZeppelin 5.x (Upgradeable), ERC721A-Upgradeable, forge-std |
| **Upgrade Pattern** | UUPS Proxy (EIP-1967) |
| **Signing** | EIP-712 Typed Data, EIP-2612 Permit |
| **Frontend** | TypeScript, Next.js, React |
| **Web3 Integration** | ethers.js, viem |
| **Target Chains** | Polygon, Sepolia (testnet), BNB Chain |

---

## Statistics

| Category | Count |
|----------|-------|
| Solidity contracts | 21 (.sol in contracts/src) |
| Contract tests | 17 (.t.sol) |
| Deployment scripts | 13 (.s.sol) |
| Frontend apps | 8 |
| TS/TSX source files | 640+ |
| Frontend pages | 98+ |
| Architecture docs | 5 (.md, 211 KB total) |

---

## Related Repositories

| Repo | Purpose |
|------|---------|
| [dakoolfrank/WQ-YI](https://github.com/dakoolfrank/WQ-YI) | 量化 Alpha 研究平台 — AI Agent 流水线 |
| [dakoolfrank/nexrur](https://github.com/dakoolfrank/nexrur) | 共享底座 — 跨域 Agent 治理框架 |
| [AGV-Protocol](https://github.com/AGV-Protocol/) | Original organization (8 public frontend repos) |
