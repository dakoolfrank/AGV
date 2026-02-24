# AGV Protocol — 代码审计与架构设计备忘录（可交付版）

> **文档版本**: v1.0  
> **审计日期**: 2026-02-23  
> **适用仓库**:  
> - `agvprotocol-contracts-main` — NFT 资产凭证层  
> - `onchainverification-main` — 链上验证 / 结算锚点层  
> - `tokencontracts-main` — 代币经济 / 治理层  
>
> **⚠ 交付注意**: 请在最终交付稿中补充每个仓库的 `git rev-parse HEAD`，让审计/开发能复现同一版本。

---

## 目录

- [A. 结论摘要](#a-结论摘要)
- [B. 协议架构总览](#b-协议架构总览)
  - [B.1 三层架构](#b1-三层架构)
  - [B.2 合约清单与依赖](#b2-合约清单与依赖)
  - [B.3 数据流与铸造链路](#b3-数据流与铸造链路)
- [C. 各层详细分析](#c-各层详细分析)
  - [C.1 NFT Pass 发售系统](#c1-nft-pass-发售系统)
  - [C.2 链上验证系统 (AGVOracle)](#c2-链上验证系统-agvoracle)
  - [C.3 代币经济体系](#c3-代币经济体系)
- [D. 风险清单（P0 / P1 / P2）](#d-风险清单p0--p1--p2)
  - [D.1 严重等级定义](#d1-严重等级定义)
  - [P0-01 DAOController 投票权占位](#p0-01-daocontroller-投票权占位治理可被任意人参与)
  - [P0-02 BondingCurve 折扣计算除零](#p0-02-bondingcurve-折扣计算除零)
  - [P0-03 PowerToMint 缺少成功路径端到端测试](#p0-03-powertomint-缺少成功路径端到端测试)
  - [P0-04 IAGVOracle 接口与实现不匹配](#p0-04-iagvoracle-接口与实现不匹配)
  - [P1-01 rGGP.mintFromOutput 不使用 signature](#p1-01-rggpmintfromoutput-不使用-signature)
  - [P1-02 PowerToMint.batchProcessOutputs 外部自调用](#p1-02-powertomintbatchprocessoutputs-外部自调用)
  - [P1-03 VestingVault 允许超额承诺](#p1-03-vestingvault-允许超额承诺)
  - [P1-04 三个项目之间缺乏链上集成](#p1-04-三个项目之间缺乏链上集成)
  - [P1-05 Makefile 脚本引用错误](#p1-05-makefile-脚本引用错误)
  - [P1-06 DeployMainnet 全部地址为零](#p1-06-deploymainnet-全部地址为零)
  - [P2-01 AGVOracle max revision 测试空壳](#p2-01-agvoracle-max-revision-测试空壳)
  - [P2-02 测试文件命名与注释问题](#p2-02-测试文件命名与注释问题)
  - [P2-03 构建配置冗余与残留](#p2-03-构建配置冗余与残留)
- [E. 两套 Oracle 的"唯一真值"对齐方案](#e-两套-oracle-的唯一真值对齐方案)
  - [E.1 现状矛盾点](#e1-现状矛盾点)
  - [E.2 对齐目标](#e2-对齐目标)
  - [E.3 方案 1：链上强绑定](#e3-方案-1链上强绑定)
  - [E.4 方案 2：运营可落地](#e4-方案-2运营可落地)
  - [E.5 preGVT / sGVT / GVT 叙事一致性](#e5-pregvt--sgvt--gvt-叙事一致性)
- [F. 代码完整度评估](#f-代码完整度评估)
- [G. 测试覆盖度总览](#g-测试覆盖度总览)
- [H. 修复清单（最小闭环交付）](#h-修复清单最小闭环交付)
- [I. AI 生成代码清理与优化](#i-ai-生成代码清理与优化)
  - [I.1 溯源发现摘要](#i1-溯源发现摘要)
  - [I.2 必须清理项（审计前阻塞）](#i2-必须清理项审计前阻塞)
  - [I.3 强烈建议重构项](#i3-强烈建议重构项)
  - [I.4 代码风格统一项](#i4-代码风格统一项)
- [附录 A：合约参数速查表](#附录-a合约参数速查表)
- [附录 B：角色与权限矩阵](#附录-b角色与权限矩阵)
- [附录 C：硬编码地址清单](#附录-c硬编码地址清单)

---

## A. 结论摘要

AGV Protocol 是一个将实体资产（果园、太阳能电站、算力农场）代币化的 Web3 生态系统。架构三层（NFT / 验证 / 经济）在工程上成立，共计 **14 个 Solidity 合约**、**300 个测试用例**。

**核心判断**：

| 维度 | 评估 |
|------|------|
| 各合约单体完整度 | **80-85%** — 核心业务逻辑基本完整 |
| 跨项目集成 | **缺失** — 三个仓库完全隔离，胶水层尚未编写 |
| 生产就绪度 | **未就绪** — 存在 3 个 P0 硬风险需上线前修复 |

**两个关键"硬伤"**：

1. **两套"验证/Oracle"体系并存**：`onchainverification/AGVOracle`（月结算=唯一铸币锚点）与 `tokencontracts/OracleVerification + PowerToMint`（基于签名的链上铸造通路）之间无链上绑定，叙事矛盾。
2. **DAO 投票权占位** + **BondingCurve 除零** 属于上线前必须修的硬风险。

---

## B. 协议架构总览

### B.1 三层架构

```
┌────────────────────────────────────────────────────────────────────┐
│                        AGV Protocol                                │
├─────────────────┬──────────────────────┬──────────────────────────┤
│   Layer 1       │   Layer 2            │   Layer 3                │
│   NFT 资产凭证   │   链上验证 / 结算      │   代币经济 / 治理         │
│                 │                      │                          │
│  agvprotocol-   │  onchainverification │  tokencontracts-main     │
│  contracts-main │  -main               │                          │
├─────────────────┼──────────────────────┼──────────────────────────┤
│  ComputePass    │  AGVOracle           │  GVT (治理代币)           │
│  SolarPass      │  IAGVOracle          │  rGGP (激励代币)          │
│  TreePass       │                      │  BondingCurve            │
│  SeedPass       │                      │  OracleVerification      │
│                 │                      │  PowerToMint             │
│                 │                      │  DAOController           │
│                 │                      │  VestingVault            │
│                 │                      │  IrGGP                   │
└─────────────────┴──────────────────────┴──────────────────────────┘
```

### B.2 合约清单与依赖

| 仓库 | 合约 | Solidity 版本 | 关键依赖 |
|------|------|--------------|---------|
| agvprotocol-contracts | ComputePass / SolarPass / TreePass / SeedPass | ^0.8.20 | ERC721A-Upgradeable, OZ-Upgradeable (UUPS, AccessControl, ERC2981, Pausable, ReentrancyGuard) |
| onchainverification | AGVOracle / IAGVOracle | ^0.8.27 | OZ (AccessControl, Pausable, EIP712) |
| tokencontracts | GVT / rGGP / BondingCurve / OracleVerification / PowerToMint / DAOController / VestingVault | ^0.8.20 | OZ (ERC20, AccessControl, Pausable, ECDSA, ReentrancyGuard) |

### B.3 数据流与铸造链路

```
                    NFT 购买                IoT 传感器数据
                       │                        │
                       ▼                        ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  NFT Pass 合约            │    │  AGVOracle                    │
│  (ComputePass/SolarPass/  │    │  ├─ storeDailySnapshot()      │
│   TreePass/SeedPass)      │    │  │  (EIP-712 签名, 96条/天)    │
│                          │    │  └─ storeMonthlySettlement()  │
│  用户持有 NFT              │    │     (多签, 唯一铸币锚点)        │
│  = 拥有实体资产份额         │    └──────────────┬───────────────┘
└─────────┬────────────────┘                    │
          │                                     │ (当前缺失: 无链上绑定)
          │ tokenId 注册                         ▼
          ▼                     ┌──────────────────────────────┐
┌──────────────────┐            │  OracleVerification           │
│  PowerToMint     │◄───────────│  (ECDSA 验签, 多源管理)        │
│  IoT→Oracle→Mint │            │  验证通过 → mintFromOutput()   │
└────────┬─────────┘            └──────────────────────────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐            ┌──────────────────────────────┐
│  rGGP            │◄───────────│  rGGP.mintFromOutput()        │
│  (无上限激励代币)  │            │  Solar: 10/kWh               │
└────────┬─────────┘            │  Orchard: 25/kg              │
         │                      │  Compute: 15/hour            │
         │ rGGP → GVT 转换      └──────────────────────────────┘
         ▼
┌──────────────────┐     ┌──────────────────┐
│  BondingCurve    │────►│  GVT             │
│  10:1 基准比率    │     │  (10亿硬上限)     │
│  5% 折扣         │     │  治理 + Vesting   │
│  7-30天 Vesting  │     └────────┬─────────┘
└──────────────────┘              │
                                  │ 治理投票
                                  ▼
                    ┌──────────────────────────────┐
                    │  DAOController                │
                    │  提案→投票→时间锁→执行           │
                    │  6种提案类别                    │
                    │  NFT+GVT 双层治理 (⚠ 未实现)    │
                    └──────────────────────────────┘
```

---

## C. 各层详细分析

### C.1 NFT Pass 发售系统

**技术栈**: Solidity ^0.8.20 | ERC721A-Upgradeable | UUPS 代理 | OpenZeppelin Upgradeable

四个高度同构的 NFT 合约，代表不同类型实体资产的所有权凭证：

| 合约 | 资产类型 | 供应量 | 每钱包上限 | 公开/预留 | WL价(USDT) | 公开价 | 代理价 | 版税 |
|------|---------|-------|----------|----------|-----------|-------|-------|------|
| **ComputePass** | 算力节点 | 99 | 1 | 49/50 | 899 | 899 | 499 | 3% |
| **SolarPass** | 太阳能板 | 300 | 2 | 200/100 | 299 | 299 | 199 | 3% |
| **TreePass** | 果树 | 300 | 2 | 200/100 | 59 | 59 | — | 5% |
| **SeedPass** | 种子/基础 | 600 | 3 | 400/200 | 29 | 29 | — | 5% |

**共同特性**:
- UUPS 可升级代理模式 + ERC2981 版税标准
- USDT 支付（6位小数精度）
- Merkle Tree 白名单验证
- AccessControl (ADMIN_ROLE, TREASURER_ROLE) + ReentrancyGuard + Pausable
- 元数据冻结功能（不可逆）
- 存储间隙 `__gap[44]` 保障升级安全

**设计差异**:

| 特性 | ComputePass / SolarPass | TreePass / SeedPass |
|------|------------------------|---------------------|
| 代理铸造 | ✅ AGENT_MINTER_ROLE + `agentMint()` | ❌ 无 |
| 配额计数器 | 白名单与公售共享 `publicMinted` | 独立 `whitelistMinted` + `publicMinted` |
| 影响 | WL 铸造会消耗公售配额 | WL 与公售独立追踪 |

**外部审计**: Beosin 审计仅覆盖此 NFT 层。

---

### C.2 链上验证系统 (AGVOracle)

**技术栈**: Solidity ^0.8.27 | OpenZeppelin AccessControl + Pausable | EIP-712

#### 两层数据架构

| 层级 | 写入者 | 数据 | 性质 |
|------|--------|------|------|
| **每日快照** (证据层) | ORACLE_TEAM | 15分钟采样×96条/天, EIP-712 签名 | 不可变, **不决定铸币** |
| **月度结算** (锚点层) | SETTLEMENT_MULTISIG | 电网账单对账, SHA-256 文件验证 | 可修正(版本化), **唯一铸币依据** |

#### 关键数据结构

```solidity
struct DailySnapshotData {
    uint256 solarGenerationKWh_x10;   // 太阳能发电量 (kWh×10)
    uint256 selfConsumedKWh_x10;       // 自消费量
    uint256 computeHours_x10;          // 算力时长 (h×10)
    uint16  recordCount;               // 期望=96 (15min采样)
    bytes32 csvFileHash;               // SHA-256 哈希
    address eip712Signer;              // 签名者
}

struct MonthlySettlementData {
    uint256 gridDeliveredKWh_x10;      // 电网交付电量
    uint256 gridPriceBasisPoints;      // 电价(基点)
    bytes32 monthlyFileAggregateHash;  // 月度文件聚合哈希
    bytes32 stateGridBillPdfHash;      // 国网账单 PDF 哈希
    bytes32 bankReceiptHash;           // 银行回单哈希
    uint8   revision;                  // 修订版本号 (>=1)
}
```

#### 核心函数

| 函数 | 权限 | 行为 |
|------|------|------|
| `storeDailySnapshot()` | ORACLE_TEAM | EIP-712 验签后存储, 每站每日不可变 |
| `storeMonthlySettlement()` | SETTLEMENT_MULTISIG | 首次结算 revision=1, 每站每月仅一次 |
| `amendMonthlySettlement()` | SETTLEMENT_MULTISIG | 修正结算, 自动递增 revision, 保留完整历史 |

---

### C.3 代币经济体系

#### GVT — 治理代币

| 属性 | 值 |
|------|---|
| 标准 | ERC20 + Burnable + Permit (EIP-2612) + Pausable |
| 硬上限 | 1,000,000,000 (10 亿) GVT |
| 铸造 | MINTER_ROLE 控制, `totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY` |
| 分配 | 内置线性 Vesting: `setAllocation()` + `releaseVested()` |

#### rGGP — 激励代币

| 属性 | 值 |
|------|---|
| 标准 | ERC20 + Burnable |
| 供应量 | **无上限** |
| 铸造率 | Solar: 10 rGGP/kWh, Orchard: 25 rGGP/kg, Compute: 15 rGGP/hour |
| 通胀控制 | Epoch 机制（季度 90 天），每种资产每 epoch 上限默认 1000 万 |
| 安全 | 防重复铸造 (processedMints), 7 天数据有效期, REVOKER_ROLE 可撤销 |

#### BondingCurve — rGGP → GVT 转换

| 参数 | 值 |
|------|---|
| 基准比率 | 10:1 (10 rGGP = 1 GVT) |
| 折扣 | 最高 5%, 按 Vesting 天数线性递增 |
| Vesting 范围 | 7-30 天 |
| Epoch 上限 | 每 epoch 最多转换 1000 万 GVT |
| 国库容量 | 5000 万 GVT |

#### OracleVerification — 预言机验证层

- 多来源管理: Chainlink, Pyth, API3, 自定义
- ECDSA 签名验证数据完整性
- 30 天无更新自动停用 (stale 检测)
- SLA 追踪 (成功率、提交计数)
- 验证通过后调用 `rGGP.mintFromOutput()` 铸造

#### PowerToMint — 铸造协调器

- IoT 设备 → 边缘节点 → Oracle → PowerToMint → rGGP Mint 完整流程
- NFT 资产注册 (tokenId → 物理资产映射)
- 单笔 / 批量处理 (最多 50 笔/批)
- 防重复、时间戳顺序验证
- 资产可停用 / 重新激活

#### DAOController — DAO 治理

| 参数 | 值 |
|------|---|
| 投票延迟 | 1 天 |
| 投票期 | 7 天 |
| 提议门槛 | 100,000 GVT |
| 法定人数 | 4,000,000 GVT |
| 时间锁 | 2 天 |
| 提案类别 | 参数变更 / 国库分配 / 排放调整 / 紧急操作 / 资产验证 / 协议升级 |
| ⚠ 投票权 | **占位实现** — `getVotingPower()` 返回硬编码值 |

#### VestingVault — 锁仓金库

| 模板 | Cliff | 锁仓期 | 可撤销 |
|------|-------|--------|--------|
| 团队 | 6 个月 | 36 个月 | ✅ |
| 战略投资者 | 6 个月 | 24 个月 | ❌ |
| 公售 | 0 | 6 个月 | ❌ |

---

## D. 风险清单（P0 / P1 / P2）

### D.1 严重等级定义

| 等级 | 定义 |
|------|------|
| **P0** | 主网前**必须修**；不修会导致逻辑不可用 / 可被滥用 / 关键承诺不成立 |
| **P1** | **强烈建议修**；不修会导致安全边界依赖配置 / 运营易出错 / 未来升级高风险 |
| **P2** | 优化 / 一致性；不修不一定出事故，但会导致成本 / 可维护性 / 叙事不一致 |

---

### P0-01 DAOController 投票权占位：治理可被"任意人"参与

**位置**: `tokencontracts/contracts/governance/DAOController.sol` → `getVotingPower()`

**证据片段**:
```solidity
// For asset proposals, check NFT balance
if (category == ProposalCategory.ASSET_VERIFICATION) {
    // TODO: Check NFT balance
    return 1; // Placeholder
}

// For protocol proposals, check staked GVT
// TODO: Check staked GVT balance
return 1000 * 10 ** 18; // Placeholder
```

**影响**:
- 任何地址都获得固定票权（只要能进入投票函数），治理结果失真
- 对外宣传的"NFT holders + GVT stakers 双层治理"在代码层面**尚未实现**
- 恶意用户可批量创建地址操纵投票

**修复建议（最小可上线方案）**:

| 提案类型 | 建议实现 |
|---------|---------|
| ASSET_VERIFICATION | `votes = ERC721(nftContract).balanceOf(account)` (或按 tokenId/类别加权) |
| 其他协议类 | 若有 staking: `votes = Staking(stakingContract).stakedBalanceOf(account)`；若暂无: 先用 `ERC20(gvtToken).balanceOf(account)` |

**关键**: 必须引入**快照机制**（至少按 `proposal.startBlock` 读 balance，或用 OZ Votes/Governor 体系）——避免投票期间转账刷票。

**验证用例 (Foundry)**:
```solidity
function test_NoVotingPower_Revert() external {
    // 无 GVT/NFT 的地址投票应 revert("No voting power")
}

function test_AssetProposal_VotesEqualNFTBalance() external {
    // mint 2 个 NFT 给 voter → 投票权 = 2
}

function test_ProtocolProposal_VotesEqualGVTBalanceOrStaked() external {
    // 给 voter mint/转入 GVT → 投票权匹配余额
}

function test_Snapshot_BlockBased() external {
    // proposal 创建后转走 token → 不应影响当次投票权
}
```

---

### P0-02 BondingCurve 折扣计算除零

**位置**: `tokencontracts/contracts/core/BondingCurve.sol` → `convert()` 与 `previewConversion()`

**证据片段**:
```solidity
discountBonus = ((vestingDays - minVestingDays) * maxDiscount) / (maxVestingDays - minVestingDays);
//                                                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                                当 max == min 时, 分母 = 0
```

**影响**:
- DAO/管理员一旦把 `minVestingDays == maxVestingDays`（例如都设为 7），**转换整体不可用**
- 典型"参数导致协议停摆"风险

**修复建议（二选一）**:

| 方案 | 实现 | 优劣 |
|------|------|------|
| **A（最稳）** | `updateCurveParams()` 强制 `require(maxVestingDays > minVestingDays)` | 简单直接，但不支持固定期限模式 |
| **B（兼容）** | 若相等则 `discountBonus = 0`（或固定折扣） | 允许"固定 Vesting 天数"场景 |

**验证用例**:
```solidity
function test_UpdateCurveParams_RevertIfMaxEqMin() external { /* 方案A */ }
function test_Convert_WorksWhenMaxEqMin_DiscountZero() external { /* 方案B */ }
function test_PreviewConversion_NoDiv0() external { /* 覆盖 preview 路径 */ }
```

---

### P0-03 PowerToMint 缺少成功路径端到端测试

**位置**: `tokencontracts/test/PowerToMint.t.sol`

**证据**: 现有 18 个测试覆盖初始化/注册/大量 revert，但**零条**构造有效签名 → `processOutput()` 成功 → `OracleVerification.submitData()` 通过验签 → `rGGP.mintFromOutput()` 增加余额的完整正向用例。

**影响**:
- "Power-to-Mint（产出→铸币）"是协议最核心承诺，没有正向测试审计机构很难给出高置信结论
- 容易出现前端 ABI 对接/签名不匹配导致无法铸造的问题

**修复建议**: 补至少 2 条端到端成功用例（Solar + Compute）。

**验证用例（推荐写法）**:
```solidity
function test_ProcessOutput_Solar_E2E() external {
    // 1. 注册 NFT 资产
    // 2. 用 vm.sign(privateKey, digest) 生成签名
    //    (digest 需与 OracleVerification 的 messageHash 完全一致)
    // 3. 调用 processOutput(tokenId, output, timestamp, signature)
    // 4. assert: rGGP.balanceOf(nftOwner) 增加
    // 5. assert: processedOutputs[outputId] == true
    // 6. assert: 统计项递增
}

function test_ProcessOutput_Compute_E2E() external {
    // 同上，使用 Compute 资产类型
}
```

---

### P0-04 IAGVOracle 接口与实现不匹配

**位置**: `onchainverification/src/interface/IAGVOracle.sol` vs `onchainverification/src/AGVOracle.sol`

**证据**:
```solidity
// 接口声明 (IAGVOracle.sol):
function storeDailySnapshot(bytes memory snapshotData, bytes memory signature) external;

// 实际实现 (AGVOracle.sol):
function storeDailySnapshot(DailySnapshotEIP712 calldata snapshot, bytes calldata signature) external;
```

**影响**: 接口无法用于合约间类型安全调用。任何依赖 `IAGVOracle` 接口与 AGVOracle 交互的外部合约都将编译失败或 ABI 不匹配。

**修复建议**: 更新 `IAGVOracle` 接口，使函数签名与实现完全一致（包含结构体类型定义）。

---

### P1-01 rGGP.mintFromOutput 不使用 signature

**位置**: `tokencontracts/contracts/tokens/rGGP.sol` → `mintFromOutput(...)`

**证据**: 函数入参包含 `bytes calldata signature`，但函数体内**不验签**，只校验时间/epoch cap，直接 `_mint()`。

**影响**:
- 当前安全边界完全依赖 AccessControl 的 MINTER_ROLE 只授予可信合约
- 一旦运维把 MINTER_ROLE 误授给 EOA/第三方合约，可绕过 OracleVerification 的验签逻辑

**修复建议（两段式）**:
1. **硬化调用边界**: 部署脚本中保证 MINTER_ROLE 只授予 `OracleVerification`（或单一铸币协调合约），文档明确说明
2. **可选增强**: 将 `mintFromOutput` 改为 `internal`，由 OracleVerification 作为唯一入口；或在 rGGP 内部重复做一次验签（成本更高，不一定必要）

**验证用例**:
```solidity
function test_MintFromOutput_RevertWhenCallerNotMinter() external {
    // EOA 直接调应 revert
}

function test_MintFromOutput_SucceedsOnlyViaOracleVerification() external {
    // 仅通过 OracleVerification.submitData() 能 mint
}
```

---

### P1-02 PowerToMint.batchProcessOutputs 外部自调用

**位置**: `tokencontracts/contracts/core/PowerToMint.sol` → `batchProcessOutputs()`

**证据片段**:
```solidity
for (uint256 i = 0; i < outputs.length; i++) {
    this.processOutput(...); // 外部调用自身
}
```

**影响**:
- 额外 gas 开销（每次迭代外部 CALL 而非内部跳转）
- 要求合约自身持有 MINTER_ROLE
- 未来若 `processOutput` 的 access control / 重入语义变化，batch 易出边界问题

**修复建议**: 抽取 `internal _processOutput(...)`，`processOutput` 和 `batchProcessOutputs` 都调用 internal 版本。

**验证用例**:
```solidity
function test_Batch_EqualsSingle() external {
    // batch 与单笔多次调用效果一致（统计/余额/去重）
}
```

---

### P1-03 VestingVault 允许超额承诺

**位置**: `tokencontracts/contracts/utils/VestingVault.sol` → `createVestingSchedule()`

**证据**: 只做 `totalAllocated += amount` 记账，不检查 `token.balanceOf(address(this))`；兑现时才 `safeTransfer`。

**影响**: 可创建**无法兑付的 vesting 计划**（承诺与兑付不一致，属于财务/合规风险点）。

**修复建议（二选一）**:

| 方案 | 实现 |
|------|------|
| **A（强约束）** | 创建时校验 `vaultBalance >= (allocated - claimed - revoked) + amount` |
| **B（弱约束+流程）** | 允许创建，但文档和 UI 明确"先 deposit 再 schedule"，加守护函数 |

**验证用例**:
```solidity
function test_CreateSchedule_RevertIfInsufficientVaultBalance() external { /* 方案A */ }
function test_Claim_FailsIfUnderfunded() external { /* 回归测试 */ }
```

---

### P1-04 三个项目之间缺乏链上集成

**现状**: 三个仓库在代码层面**完全隔离**，没有任何跨项目 import 或地址引用。

**架构设计要求但未实现的集成点**:

| 调用方 | 被调用方 | 预期集成 | 当前状态 |
|--------|---------|---------|---------|
| PowerToMint | AGVOracle | 读取月度结算作为铸币依据 | ❌ 无连接 |
| DAOController | NFT Pass 合约 | 查询 NFT 余额用于投票权 | ❌ TODO 占位 |
| OracleVerification | AGVOracle | 两套 Oracle 对齐 | ❌ 独立实现 |

**修复建议**: 见 [E 章节](#e-两套-oracle-的唯一真值对齐方案) 的对齐方案。

---

### P1-05 Makefile 脚本引用错误

**位置**: `agvprotocol-contracts-main/Makefile`

| 目标 | 错误 | 应改为 |
|------|------|--------|
| `upgrade-tp-polygon` | 调用 `script/SeedPass.s.sol:UpgradeSeedPass` | `script/TreePass.s.sol:UpgradeTreePass` |
| `configure-slp-polygon` | 调用 `script/TreePass.s.sol:ConfigureSolarPass` | `script/SolarPass.s.sol:ConfigureSolarPass` |

**影响**: 部署运维时执行错误的升级/配置脚本，导致错误合约被升级。

---

### P1-06 DeployMainnet 全部地址为零

**位置**: `tokencontracts/script/DeployMainnet.s.sol`

**证据**:
```solidity
address constant TEAM_MULTISIG = address(0);      // TODO: Set team multisig
address constant DAO_MULTISIG = address(0);        // TODO: Set DAO multisig
address constant TREASURY_MULTISIG = address(0);   // TODO: Set treasury multisig
address constant CHAINLINK_SIGNER = address(0);    // TODO: Set Chainlink oracle
address constant PYTH_SIGNER = address(0);         // TODO: Set Pyth oracle
// teamMembers[1] = address(0);                    // TODO: Add individual allocations ×2
```

**影响**: 主网部署脚本**完全不可用**（`performPreDeploymentChecks()` 会直接 revert）。

**附加问题**: `DeployTestnet.s.sol` 的合约名 `DeployScript` 与 `Deploy.s.sol` 冲突（同名不继承，完全独立复制）。

---

### P2-01 AGVOracle max revision 测试空壳

**位置**: `onchainverification/test/AGVOracle.t.sol` → `test_MaxRevision_RevertWhenReached()`

**证据**: 测试体为空，注释说明"因为创建 255 个修订不实际"。

**修复建议**: 用 Foundry 的 `vm.store` 强行把 `effectiveRevision` 写到 254 再调 `amend`。

---

### P2-02 测试文件命名与注释问题

| 问题 | 文件 |
|------|------|
| `DAOController.sol` 测试文件命名后缀应为 `.t.sol` | `tokencontracts/test/DAOController.sol` |
| SolarPass 测试注释写 "Exceeds 1500 max supply" 但实际 MAX_SUPPLY=300 | `agvprotocol-contracts-main/test/SolarPass.t.sol` |
| TreePass 测试注释写 "Exceeds 600 max supply" 但实际 MAX_SUPPLY=300 | `agvprotocol-contracts-main/test/TreePass.t.sol` |
| ComputePass `test_WhitelistMint_PremiumPricing` 注释写 "499 USDT" 但断言 899 | `agvprotocol-contracts-main/test/ComputePass.t.sol` |
| SeedPass `test_WhitelistMint_BeforeStart` revert 消息为 `PublicSaleNotStarted` 而非 `SaleNotStarted` | `agvprotocol-contracts-main/test/SeedPass.t.sol` |

---

### P2-03 构建配置冗余与残留

| 问题 | 位置 |
|------|------|
| `foundry.toml` remapping 引用 `openzeppelin-contracts-upgradeable` 但 lib/ 中**不存在** | `onchainverification-main/foundry.toml` |
| `remappings.txt` 与 `foundry.toml` 重复定义 | `tokencontracts-main/remappings.txt` |
| `Deploy.sh` 引用不存在的 `script/Verify.s.sol` | `tokencontracts-main/script/Deploy.sh` |
| `CHANGELOG.md` 完全为空 | `agvprotocol-contracts-main/CHANGELOG.md` |
| `.PHONY` 列表包含已删除的 mumbai 相关目标 | `agvprotocol-contracts-main/Makefile` |

---

## E. 两套 Oracle 的"唯一真值"对齐方案

### E.1 现状矛盾点

当前公开代码存在**两套"验证/Oracle"体系并存**的架构矛盾：

| 体系 | 仓库 | 声明 |
|------|------|------|
| **AGVOracle** | onchainverification | Monthly Settlement 是 token minting 的**唯一真值锚点** ("sole source of truth")；日快照是 evidence layer ("not mint-determining") |
| **OracleVerification + PowerToMint** | tokencontracts | 基于签名验证的链上铸造通路: `PowerToMint.processOutput()` → `OracleVerification.submitData()` 验签 → `rGGP.mintFromOutput()` |

**三个冲突点**:
1. "到底是谁决定 mint：月结算还是日数据？"
2. "如果 AGVOracle 说 off-chain 触发 mint，那链上 PowerToMint 的 mint 又算什么？"
3. "preGVT/sGVT 的发放与真正 GVT 铸造的关系如何自洽？"

### E.2 对齐目标

> **统一声明（一句话版）**：
> GVT 的最终发行与可审计结算以 AGVOracle 的 Monthly Settlement 为唯一锚点；rGGP 的日常激励可按链上验证或批量结算发放，但每个结算周期必须可回溯到 Monthly Settlement 的哈希证据。

### E.3 方案 1：链上强绑定

> **最"审计友好"，但开发工作量更大**

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  AGVOracle       │     │  SettlementAdapter   │     │ OracleVerification│
│  (月度结算)       │────►│  (新增合约)           │────►│  (submitData)     │
│  storeMonthly... │     │  读取结算 → 构造      │     │  验签 → rGGP mint │
└──────────────────┘     │  submitData 参数      │     └──────────────────┘
                         └─────────────────────┘
```

**实现方式**:
1. 新增 `SettlementAdapter` 合约
2. 读取 `AGVOracle.getEffectiveMonthlySettlement()` 后，构造 `OracleVerification.submitData()` 所需字段：
   - `sourceId = keccak256(stationId, period, revision)` — 唯一且可去重
   - `timestamp = monthlySettlement.timestamp`
   - `outputAmount = gridDeliveredKWh_x10`
   - `signature`: 由 SETTLEMENT_MULTISIG 对 messageHash 签名（与 OracleVerification 的 ECDSA recover 一致）
3. OracleVerification 仅接受来自 adapter 的调用（或 adapter 持有 ORACLE_ROLE）

**优点**: "唯一真值"在合约层锁死，审计最舒服  
**缺点**: 多合约集成、跨仓库依赖，工程改动大

### E.4 方案 2：运营可落地

> **最现实，适合当前阶段**

保留当前 PowerToMint → OracleVerification 的日常链路，但规定：

1. **"最终结算口径"只认 AGVOracle 的 `MonthlySettlementStored` 事件**（它已经是多签 gating + hash 证据）
2. **每月结算作业**（off-chain）:
   - 读取 AGVOracle 的 `MonthlySettlementStored(period, stationId, ..., revision, reconciler)`
   - 计算该 period 可铸造 rGGP（或可转 GVT）的总量
   - 调用 `tokencontracts/OracleVerification.submitData(...)`，其中：
     - `sourceId = keccak256(stationId, period, revision)`
     - `timestamp = settlement.timestamp`
     - `signature = SETTLEMENT_MULTISIG` 对同一 messageHash 签名
3. 在 tokencontracts 侧注册该 source: `registerSource(sourceId, signer, "settlement")`，设置更严格的数据 age/阈值

**优点**: 不需要大改合约结构；可直接解决叙事与可审计落点  
**缺点**: 对运营流程与密钥管理要求更高（但本来就需要多签）

### E.5 preGVT / sGVT / GVT 叙事一致性

结合 `GVT.sol` 的实现（硬上限 + allocation/vesting + MINTER_ROLE，且 allocation 占用 cap headroom），建议统一口径：

| 概念 | 定义 | 链上实现 |
|------|------|---------|
| **preGVT** | 预售"凭证/额度记录"，**不等同于已铸造的 GVT** | 链下记录或 VestingVault 中的 schedule |
| **sGVT** | 锁仓/权益凭证（如果存在），**不等同于 GVT** | 可通过 VestingVault 或 BondingCurve 的锁仓记录体现 |
| **GVT** | 真正铸造的治理代币 | 仅通过 `GVT.mint()` (MINTER_ROLE) 或 `setAllocation()` + `releaseVested()` 产生 |

> 最终口径应能回溯到 "Monthly Settlement 锚点" 或审计认可的结算规则。

---

## F. 代码完整度评估

### 模块级完整度

| 模块 | 完整度 | 说明 |
|------|--------|------|
| 4 个 NFT Pass 合约 | ⭐⭐⭐⭐⭐ | 代码完整、测试充分、部署脚本齐全 |
| AGVOracle | ⭐⭐⭐⭐ | 核心逻辑完整，接口文件不匹配 |
| GVT / rGGP 代币 | ⭐⭐⭐⭐⭐ | 功能完整、测试充分 |
| BondingCurve / VestingVault | ⭐⭐⭐⭐⭐ | 功能完整、测试覆盖好 |
| OracleVerification / PowerToMint | ⭐⭐⭐⭐ | 代码完整但 PowerToMint 缺少成功路径测试 |
| DAOController | ⭐⭐☆☆☆ | 框架在，核心投票权逻辑未实现 |
| 部署脚本 | ⭐⭐⭐☆☆ | Testnet 可用，Mainnet 全是占位符 |
| 跨项目集成 | ⭐☆☆☆☆ | 完全缺失 |

### 已知缺失文件

| 缺失项 | 位置 |
|--------|------|
| `script/Verify.s.sol` | `tokencontracts-main` (被 Deploy.sh 引用) |
| `openzeppelin-contracts-upgradeable` lib | `onchainverification-main` (被 foundry.toml 引用) |
| 有效的 CHANGELOG | `agvprotocol-contracts-main` (文件存在但为空) |

---

## G. 测试覆盖度总览

| # | 文件 | 测试数 | 行数 | 覆盖评估 |
|---|------|--------|------|---------|
| 1 | ComputePass.t.sol | 37 | 1171 | ✅ 全面 |
| 2 | SeedPass.t.sol | 35 | 853 | ✅ 全面 |
| 3 | SolarPass.t.sol | 39 | 1207 | ✅ 全面 |
| 4 | TreePass.t.sol | 33 | 894 | ✅ 全面 |
| 5 | AGVOracle.t.sol | 22 | 389 | ⚠ max revision 空测试 |
| 6 | BondingCurve.t.sol | 22 | 289 | ✅ 含 fuzz |
| 7 | GVT.t.sol | 16 | 206 | ✅ 含 fuzz |
| 8 | rGGP.t.sol | 18 | 278 | ✅ 含 fuzz |
| 9 | PowerToMint.t.sol | 18 | 192 | ❌ **缺少成功路径** |
| 10 | OracleVerification.t.sol | 17 | 266 | ✅ |
| 11 | VestingVault.t.sol | 27 | 342 | ✅ 含 fuzz |
| 12 | DAOController.sol | 16 | 259 | ⚠ 缺 execute; 投票权未真实测试 |
| | **总计** | **300** | **6346** | |

---

## H. 修复清单（最小闭环交付）

### 必须修（P0）— 主网前阻塞项

| # | 修复项 | 合约 | 工作量预估 |
|---|--------|------|-----------|
| 1 | 实现真实 voting power（NFT/GVT + 快照/防刷票） | DAOController | 2-3 天 |
| 2 | 消除除零（`max > min` 或特判） | BondingCurve | 0.5 天 |
| 3 | 补端到端成功测试（带有效签名, Solar + Compute） | PowerToMint.t.sol | 1-2 天 |
| 4 | 更新接口使函数签名与实现一致 | IAGVOracle | 0.5 天 |

### 强烈建议修（P1）

| # | 修复项 | 合约 | 工作量预估 |
|---|--------|------|-----------|
| 5 | 去掉 `this.processOutput` 外部自调用，改 internal | PowerToMint | 0.5 天 |
| 6 | 创建 schedule 时校验余额或明确运营约束，补测试 | VestingVault | 1 天 |
| 7 | 修复 Makefile 脚本引用错误 (upgrade-tp / configure-slp) | Makefile | 0.5 小时 |
| 8 | 填充 DeployMainnet 地址，或增加 CI check 阻止零地址部署 | DeployMainnet.s.sol | 配置项 |
| 9 | 硬化 rGGP MINTER_ROLE 授权边界，文档明确 | rGGP + 部署脚本 | 0.5 天 |

### 叙事对齐（必须给审计/机构看的说明）

| # | 交付项 |
|---|--------|
| 10 | 明确采用"方案 1（链上强绑定）/ 方案 2（运营可落地）"之一，把 Monthly Settlement = 唯一真值锚点 与 tokencontracts 的实际铸币入口对齐 |
| 11 | 统一 preGVT / sGVT / GVT 口径，写入协议文档/审计范围说明 |

---

## I. AI 生成代码清理与优化

> **来源**：本节内容同步自 `AGV-vs-WQYI-Complexity-Compare.md` 第 12 节（AI 辅助生成溯源）与第 14.1 节（AGV 落地建议）。
>
> **背景**：外部代码溯源分析显示 AGV 约 85% 代码由对话式 AI（Perplexity 搜索 → ChatGPT/Claude 整文件生成）一次性产出。AI 生成的代码在功能上基本完整，但留下了多处需要在**正式审计前清理**的痕迹。

### I.1 溯源发现摘要

| 子项目 | AI 生成占比 | 关键判据 |
|--------|-----------|---------|
| agvprotocol-contracts-main | ~90% | 4 个 NFT Pass 合约 + 4 个测试 + 4 个部署脚本呈 **4×3 精确模板克隆** |
| onchainverification-main | ~95% | `IAGVOracle.sol` 含 20+ 处 `[cite: 65]`…`[cite: 93]` Perplexity 引用标记残留 |
| tokencontracts-main | ~75% | 公式化 NatSpec 模板 + TODO 占位 + `unchecked { ++i; }`；BondingCurve 数学有人工调整痕迹 |

**生成模式判断**：不是 GitHub Copilot 逐行补全，而是**对话式 AI 从设计文档一次性生成完整 .sol 文件**——证据包括完整合约整文件输出、Features 列表模式、模板克隆、以及 `[cite:]` 标记从搜索结果传递残留。

### I.2 必须清理项（审计前阻塞）

这些问题如果**不在提交审计前清理**，会直接影响审计方对代码质量和专业度的判断。

| # | 清理项 | 位置 | 具体操作 | 工作量 |
|---|--------|------|---------|--------|
| I-01 | **移除 `[cite: XX]` 引用标记** | `onchainverification-main/src/interface/IAGVOracle.sol` L11–L62 | 逐行删除 20+ 处 `[cite: N]` 注释标记 | 0.5 小时 |
| I-02 | **修正 `MetadataFrozened` 拼写** | 4 个 NFT Pass 合约的事件定义 | `MetadataFrozened` → `MetadataFrozen`（注意：事件名修改会影响 ABI / 前端监听，需同步更新） | 0.5 小时 |

### I.3 强烈建议重构项

这些不是"阻塞项"，但会被有经验的审计方**作为代码质量减分项**标注。

| # | 重构项 | 位置 | 具体方案 | 工作量 |
|---|--------|------|---------|--------|
| I-03 | **4 个 NFT Pass 抽取 `BasePass` 基类** | `agvprotocol-contracts-main/contracts/` | 抽取 ComputePass / SolarPass / TreePass / SeedPass 的公共逻辑（继承链 7 层、Config struct、initialize 序列、事件定义）到 `BasePass.sol`，子合约仅保留常量差异（MAX_SUPPLY / PRICE_USDT 等） | 2-3 天 |
| I-04 | **提取共享 `MockUSDT`** | `agvprotocol-contracts-main/test/` | 4 个测试文件各自独立定义了完全相同的 `MockUSDT` 合约。提取到 `test/mocks/MockUSDT.sol`，4 个测试统一 import | 0.5 天 |
| I-05 | **合并 4 个部署脚本的公共部分** | `agvprotocol-contracts-main/script/` | 4 个 Deploy 脚本是精确克隆，提取 `BaseDeployPass.s.sol` 基类 | 1 天 |

**I-03 是重构收益最大的单项**——当前 4 个 Pass 合约每个 ~320 行且逐行一致，重构后：
- 基类 ~280 行 + 4 个子合约各 ~40 行 = **总行数从 ~1,280 降到 ~440**（减 65%）
- 修一个 bug 只需改 1 处而非 4 处
- 审计方只需审计 1 个核心逻辑而非 4 份重复

### I.4 代码风格统一项

优先级较低，但有助于提升整体工程形象。

| # | 统一项 | 位置 | 说明 |
|---|--------|------|------|
| I-06 | 移除 `// Maps to Daily_Snapshot fields` 等设计映射注释 | `AGVOracle.sol` L29/L39/L52 | 这类注释是 AI 从设计文档生成时的可追溯性标记，在生产代码中应删除或改写为标准 NatSpec |
| I-07 | 统一 NatSpec 风格 | 全部合约 | 当前每个合约头部都是 `@title` → `@notice` → `@dev` → `Features:` 列表（AI 高频模式），建议精简或个性化 |
| I-08 | 审视 `unchecked { ++i; }` 使用 | 全部含循环的合约 | Solidity ≥0.8 默认溢出检查；`unchecked` gas 优化在 for 循环索引上是安全的，但应确认每处使用确实无溢出风险 |
| I-09 | 清理 `address(0) // TODO` 占位 | `DeployMainnet.s.sol`（7 处）、`DAOController`（2 处） | 要么填入真实地址，要么添加显式 `revert("Not configured")` 而非静默使用零地址 |

### I.5 清理后预期效果

| 指标 | 清理前 | 清理后 |
|------|--------|--------|
| agvprotocol 核心合约行数 | ~1,280（4×320） | ~440（1 基类 + 4 子合约） |
| 审计面 | 4 份几乎相同的合约需各自审计 | 1 份基类 + 4 份极短差异文件 |
| AI 痕迹残留 | `[cite:]` 20+ 处、拼写错误、重复 Mock | 全部清除 |
| 审计方第一印象 | "模板克隆，可能 AI 生成" | "标准工程化，有重构意识" |

---

## 附录 A：合约参数速查表

### NFT Pass 参数

| 参数 | ComputePass | SolarPass | TreePass | SeedPass |
|------|------------|-----------|----------|----------|
| MAX_SUPPLY | 99 | 300 | 300 | 600 |
| MAX_PER_WALLET | 1 | 2 | 2 | 3 |
| PUBLIC_ALLOCATION | 49 | 200 | 200 | 400 |
| RESERVED_ALLOCATION | 50 | 100 | 100 | 200 |
| WL_PRICE_USDT | 899 | 299 | 59 | 29 |
| PUBLIC_PRICE_USDT | 899 | 299 | 59 | 29 |
| AGENT_PRICE_USDT | 499 | 199 | — | — |
| ROYALTY_BPS | 300 (3%) | 300 (3%) | 500 (5%) | 500 (5%) |
| USDT_DECIMALS | 6 | 6 | 6 | 6 |
| Storage Gap | `__gap[44]` | `__gap[44]` | `__gap[44]` | `__gap[44]` |

### 代币参数

| 参数 | GVT | rGGP |
|------|-----|------|
| MAX_SUPPLY | 1,000,000,000 | 无上限 |
| SOLAR 费率 | — | 10 rGGP/kWh |
| ORCHARD 费率 | — | 25 rGGP/kg |
| COMPUTE 费率 | — | 15 rGGP/hour |
| EPOCH 长度 | — | 90 天 |
| 默认 EPOCH CAP | — | 10,000,000 / 类型 |

### BondingCurve 参数

| 参数 | 默认值 |
|------|--------|
| baseRatio | 10 (10 rGGP : 1 GVT) |
| slope | configurable |
| maxDiscount | 500 (5%) |
| minVestingDays | 7 |
| maxVestingDays | 30 |
| epochCap | 10,000,000 GVT |
| treasuryCapacity | 50,000,000 GVT |

### DAOController 参数

| 参数 | 默认值 |
|------|--------|
| votingDelay | 1 天 |
| votingPeriod | 7 天 |
| proposalThreshold | 100,000 GVT |
| quorum | 4,000,000 GVT |
| timelockDelay | 2 天 |

### VestingVault 模板

| 模板 | Cliff | 总锁仓 | 可撤销 |
|------|-------|--------|--------|
| Team | 6 月 | 36 月 | ✅ |
| Strategic | 6 月 | 24 月 | ❌ |
| Public | 0 | 6 月 | ❌ |

---

## 附录 B：角色与权限矩阵

### agvprotocol-contracts-main (NFT)

| 角色 | ComputePass | SolarPass | TreePass | SeedPass | 权限 |
|------|------------|-----------|----------|----------|------|
| DEFAULT_ADMIN_ROLE | ✅ | ✅ | ✅ | ✅ | 角色管理 |
| ADMIN_ROLE | ✅ | ✅ | ✅ | ✅ | setSaleConfig, setWhitelistRoot, setBaseURI, freeze, pause/unpause |
| TREASURER_ROLE | ✅ | ✅ | ✅ | ✅ | withdraw |
| AGENT_MINTER_ROLE | ✅ | ✅ | — | — | agentMint (折扣批量铸造) |

### onchainverification-main (Oracle)

| 角色 | 权限 |
|------|------|
| DEFAULT_ADMIN_ROLE | 角色管理, pause/unpause |
| ORACLE_TEAM | storeDailySnapshot |
| SETTLEMENT_MULTISIG | storeMonthlySettlement, amendMonthlySettlement |

### tokencontracts-main (经济)

| 角色 | GVT | rGGP | BondingCurve | OracleVerif. | PowerToMint | DAO | VestingVault |
|------|-----|------|-------------|-------------|-------------|-----|-------------|
| DEFAULT_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MINTER_ROLE | mint | mintFromOutput | — | — | — | — | — |
| PAUSER_ROLE | pause | pause | pause | pause | pause | — | — |
| REVOKER_ROLE | — | revokeMint | — | — | — | — | — |
| OPERATOR_ROLE | — | — | withdraw, update | — | — | — | — |
| ORACLE_ROLE | — | — | — | submitData | — | — | — |
| GUARDIAN_ROLE | — | — | — | — | — | cancel | — |
| ADMIN_ROLE | — | config | config | register, config | register, config | updateParams | create, revoke |

---

## 附录 C：硬编码地址清单

所有硬编码地址**仅出现在部署脚本中**，核心合约源码中无硬编码地址：

| 地址 | 网络 | 用途 | 出现位置 |
|------|------|------|---------|
| `0xdAC17F958D2ee523a2206206994597C13D831ec7` | Ethereum Mainnet | USDT | 4 个 NFT Pass 部署脚本 |
| `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | Polygon | USDT | 4 个 NFT Pass 部署脚本 |
| `0x7169D38820dfd117C3FA1f22a697dBA58d90BA06` | Sepolia | Mock USDT | 4 个 NFT Pass 部署脚本 |
| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 测试 | Hardhat 默认账户 #1 (agent) | ComputePass.s.sol, SolarPass.s.sol |

> ⚠ `0x7099...` 是 Hardhat/Anvil 的默认测试账户，正式环境**不应使用**。

---

*文档结束。请在最终交付时补充各仓库 commit hash。*
