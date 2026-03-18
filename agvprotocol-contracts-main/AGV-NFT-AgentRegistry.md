# NFT Pass & Distribution License 架构方案 — 可执行版

> **文档版本**: v3.1  
> **日期**: 2026-03-18  
> **适用仓库**: `agvprotocol-contracts-main`  
> **定位**: NFT 产品线的架构演进、合约设计与链上状态（单一真相源）  
> **姊妹文档**:  
> - Token 产品线 → [AGV-pGVT-sGVT.md](../tokencontracts-main/AGV-pGVT-sGVT.md)  
> - NFT 部署运维 → [AGV-NFT-RUN.md](AGV-NFT-RUN.md)  
> - Token 部署运维 → [AGV-RUN.md](../tokencontracts-main/AGV-RUN.md)  
> **变更**:  
> - v3.1 — V3 BSC Mainnet 部署完成 + NFT Metadata API 上线 + 首枚 Agent License 铸造  
> - v3.0 — V3 架构重构：废除三池三通道，改为单池 + Agent License 代理权模型（链下结算）  
> - v2.x — Distribution License 设计（仅文档，未编码）  
> - v2.3 — NFT 内容从 AGV-pGVT-sGVT.md 迁入，添加 §0.4 链上字节码 Agent 功能验证矩阵

---

## 0. 决策记录

| # | 决策项 | 结论 | 理由 |
|---|--------|------|------|
| D1 | NFT 合约标准 | **ERC721A (Upgradeable + UUPS)** | 批量铸造 gas 优化，已部署运行 |
| D2 | 机构 Certification 实现 | ~~**ERC1155 + Quota 一体化**~~ → V3 License 模型 | v2 独立 Registry 过重；v3 内嵌 License 到 Pass 合约 |
| D3 | 机构NFT 额度扣减 | **per-distributor per-pass 追踪** | 合约内 mapping 追踪每位分发方额度 |
| D4 | 支付方式 | **USDT (BSC, 18 decimals)** | 所有 NFT Pass 统一 USDT 支付 |
| D5 | AgentRegistry 是否可升级 | ~~否~~ → **V3 取消独立 AgentRegistry** | License 内嵌到 Pass 合约，无需独立 Registry |
| D6 | Soulbound 设计 | **License 不可转让，收藏品可转让** | License 防资质倒卖；收藏品自由流通 |
| D7 | 旧合约处理 | **全部弃用（旧 4 Pass + 旧 ERC1155）** | 旧 4 Pass 由旧团队控制，我们无权限（§0.4 已验证） |
| D8 | ~~SeedPass/TreePass Agent 统一~~ | **被 D9 取代** | V3 部署全新合约，不再升级旧合约 |
| **D9** | **V3 全新合约** | **部署 4 个全新 Pass 合约** | 旧 4 Pass owner = `0x3134...`（旧团队），我们 `0xAC38...` 无任何权限，必须新部署 |
| **D10** | **供应量** | **每种 Pass 1,000,000 (100万)** | 大规模分发需求（Agent + 置换方 + Public） |
| ~~D11~~ | ~~三通道模型~~ | ~~Public (30%) + Agent (30%) + Reserve (40%)~~ | **被 D13 取代** |
| **D12** | **Distribution License** | **License NFT = Pass 图片 + 额度数字** | Agent 持 Soulbound License（显示 Pass 图 + 余额），客户持收藏品 |
| **D13** | **单池 + License 代理权** | **统一 MAX_SUPPLY，无分池；Agent 是销售角色非产品通道** | Agent 链下结算 → Admin 确认后链上铸造扣配额；散客链上自购付 USDT |
| **D14** | **链下结算** | **Agent 佣金/收款全部链下处理** | 合约不碰 Agent ↔ 客户之间的资金流，仅记账配额 |

### 0.0 NFT 产品线演进

```
═══ V1 旧团队时代（owner = 0x3134...，我们无权限）═══

InstitutionalNFT (2025-11)  → 旧 ERC1155 机构凭证，5枚，已弃用 ⛔
    │
NFT Pass × 4 (2025-12 ~ 2026-01)
    ├── SeedPass    600枚  $29   — 已铸 17
    ├── TreePass    300枚  $59   — 已铸 1
    ├── SolarPass   300枚  $199  — 已铸 0
    └── ComputePass  99枚  $499  — 已铸 0

AgentRegistry v2 (未部署)   → ERC1155 Soulbound，代码+237测试完成

═══ V3 AGV 新时代（owner = 0xAC38...，完全自主）═══

Pass × 4 (✅ 已部署 2026-03-17, Block 87205718)
    ├── SeedPass     1,000,000枚  $29   ┐ Proxy: 0x4d5c8A1f...AE5a0
    ├── TreePass     1,000,000枚  $59   ├─ 单池 MAX_SUPPLY + Agent License 代理权
    ├── SolarPass    1,000,000枚  $299  │  散客链上自购 / Agent 链下结算后 Admin 铸造
    └── ComputePass  1,000,000枚  $899  ┘ 8/8 BscScan Verified, 0.00074 BNB

链上 NFT 状态 (2026-03-18):
    SeedPass: totalSupply=2 (Collectible #1 + Agent License #2)
    TreePass/SolarPass/ComputePass: totalSupply=0
```

> V1/V2 旧架构详见下方 §1-12（保留作历史参考）
> **V3 新架构从 [§13](#13-v3--agv-nft-系统) 开始**
    ├── TreePass    300枚  $59   — 基础级，公售+白名单，无 Agent 功能
    ├── SolarPass   300枚  $199  — 中级，公售+Agent Mint，有 agentMint
    └── ComputePass  99枚  $499  — 高级，公售+Agent Mint，有 agentMint

GenesisBadge1155 (2025-11-29) → 空投徽章，cap 2000，pGVT claim 前置步骤
```

### 0.1 链上旧合约审计（2026-03 摸底）

旧 ERC1155 代理凭证合约 `0x4C472a0888f09cC604e265de593FA913aCfAFf3E`（BSC）：

| 项目 | 状态 |
|------|------|
| 源码验证 | ✅ 已在 BSCScan 验证（compiler v0.8.27, 合约名 InstitutionalNFT） |
| 源码归档 | ✅ `contracts/_archive/InstitutionalNFT_V1_OnChain.sol` |
| 合约模式 | 直接部署（非代理），11139 bytes |
| 权限模型 | Ownable（单 owner，非 AccessControl） |
| 功能 | mint / mintBatch / setMinter / setMetadataURI / 标准 ERC1155 |
| 缺失 | 无 burn、无转账限制、无 totalSupply |
| 已 mint | 5 枚（tokenId 1-5，各 1 枚到不同地址） |

**安全风险**：无 burn + 无转账限制 = Agent 凭证可被随意转卖，不满足 Soulbound 需求。

**决策**：新 `AgentRegistry.sol` 继承 ERC1155，替代旧合约。旧合约 5 枚 token 需通知持有人迁移。

### 0.2 链上部署状态（2026-03-15 更新）

#### NFT Pass 合约（UUPS Proxy — 均已部署）

| Pass | Proxy 地址 | 已铸造 / 上限 | 阶段 | Impl 地址 |
|------|-----------|--------------|------|----------|
| **SeedPass** | `0xFF362C39eB0eDecA946A5528d30D9c9E9285f3fc` | 17 / 600 | PUBLIC | `0x24ac1751394c74ecd72ccdb33fc5767ca53cdfe0` |
| **TreePass** | `0x1E092126E4AB12503d37dD08E20F9192b8439458` | 1 / 300 | — | `0x068add54f8a58c33ad7aba26582d25329b19a185` |
| **SolarPass** | `0x4F26621592D3B1ca344d187e469a86e2eE5FEa1E` | 0 / 300 | saleActive=true | `0xdba0d170847c8c61933b28207ff28f833fd1672a` |
| **ComputePass** | `0x6F503f315c95835A68d140440CA49b5C3e885Ce3` | 0 / 99 | saleActive=true | `0x9981d0b53544db2ebe69c3bbeb5299d8985044f2` |

> 全部 5 个合约 (4 Pass + InstitutionalNFT) 的 BscScan verified 源码已归档至 `contracts/_archive/`

#### V3 新合约（✅ 已部署 2026-03-17, Block 87205718）

| 合约 | Proxy 地址 | Impl 地址 | totalSupply | 状态 |
|------|-----------|-----------|:-----------:|------|
| SeedPass | `0x4d5c8A1f66e63Af1d5a88fd1ceA77A61e86AE5a0` | `0xD5591Be97e66d8BF0F64593517f5Fd19D5BBcf1E` | 2 | ✅ Collectible #1 + License #2 |
| TreePass | `0xB27A0EAD07E781b96dcac5965D7733B51D5EfAb1` | `0x0b940eC2D0C0D20e512d03c9A494F07f59A3B0b4` | 0 | ✅ 已部署 |
| SolarPass | `0xeE899BaAfF934616760106620D6ad6CE379C5122` | `0xcE72fF8D798e17961668495D6295522999E93e16` | 0 | ✅ 已部署 |
| ComputePass | `0xA9d26c79D78E16C8ca83cDF417E5487A171101e8` | `0x95082d1B986c94aDA7148Ace52346448aCAFC450` | 0 | ✅ 已部署 |

> BscScan 8/8 Verified。Metadata API 已上线：`https://agvnexrur.ai/api/nft/{pass}/{id}`

#### NFT Metadata API（Vercel 动态路由）

| Pass 类型 | collectibleBaseURI | licenseBaseURI | 状态 |
|-----------|-------------------|----------------|------|
| SeedPass | `https://agvnexrur.ai/api/nft/seedpass/` | `https://agvnexrur.ai/api/nft/seedagent/` | ✅ 均已设置 |
| TreePass | `https://agvnexrur.ai/api/nft/treepass/` | *(待设置)* | ✅ collectible |
| SolarPass | `https://agvnexrur.ai/api/nft/solarpass/` | *(待设置)* | ✅ collectible |
| ComputePass | `https://agvnexrur.ai/api/nft/computepass/` | *(待设置)* | ✅ collectible |

> API 路由：`agv-web/agv-protocol-app/app/api/nft/[pass]/[id]/route.ts`
> 支持 8 种类型：4 Collectible + 4 Agent License（seedagent/treeagent/solaragent/computeagent）

#### 已授予的 Agent License

| Pass | Agent 地址 | Token ID | Quota | Used | Active | 授予日期 |
|------|-----------|:--------:|:-----:|:----:|:------:|----------|
| SeedPass | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` | 2 | 100 | 0 | ✅ | 2026-03-18 |

#### 旧合约（已弃用）

| 合约 | 地址 | 状态 | 替代方案 |
|------|------|------|----------|
| InstitutionalNFT (ERC1155) | `0x4C472a0888f09cC604e265de593FA913aCfAFf3E` | ⛔ **已弃用** | V3 内嵌 License |
| AgentRegistry v2 | *(未部署)* | ⛔ **已取消** | V3 内嵌 License |

> V2 源码已归档：`contracts/_archive/`

### 0.3 SeedPass on-chain vs 本地代码差异

on-chain implementation (v0.8.28) vs 本地 `contracts/SeedPass.sol` — **6 行差异**：

| # | 差异 | on-chain (已部署) | 本地 (最新) | 说明 |
|---|------|------------------|------------|------|
| 1 | import | `ReentrancyGuardUpgradeable` | `ReentrancyGuard` | 本地简化为非升级版 |
| 2 | 继承 | `ReentrancyGuardUpgradeable` | `ReentrancyGuard` | 同上 |
| 3 | 价格 | `PRICE_USDT = 29 * 1e18` | `29 * 1e6` | BSC USDT 精度调整 |
| 4 | initialize | 含 `__UUPSUpgradeable_init()` | 已移除 | 不再需要 |
| 5 | initialize | 含 `__ReentrancyGuard_init()` | 已移除 | 配合继承改为非升级版 |
| 6 | supportsInterface | `super.supportsInterface(id)` | 显式多 ERC 链 | 更明确的接口声明 |

**评估**: 本地代码是部署后的改进版，属正常迭代。可通过 UUPS `upgradeToAndCall()` 升级 on-chain implementation。升级优先级低（功能不受影响）。

### 0.4 链上 BscScan 验证状态（2026-03-16 更新）

> **重要修正**：之前的字节码分析基于错误的 Proxy 地址（文档旧地址 vs 前端真实地址不一致）。
> 使用 BscScan API (Etherscan V2, chainid=56) 重新核实后确认：**全部 4 个 Proxy + 4 个 Impl + InstitutionalNFT 均为已验证合约**。

#### BscScan 验证状态（权威数据）

| 合约 | 地址 | BscScan Verified | ContractName | Compiler |
|------|------|:-:|---|---|
| SeedPass Proxy | `0xFF362C39eB0eDecA946A5528d30D9c9E9285f3fc` | ✅ | ERC1967Proxy | v0.8.28 |
| SeedPass Impl | `0x24ac1751394c74ecd72ccdb33fc5767ca53cdfe0` | ✅ | SeedPass | v0.8.28 |
| TreePass Proxy | `0x1E092126E4AB12503d37dD08E20F9192b8439458` | ✅ | ERC1967Proxy | v0.8.28 |
| TreePass Impl | `0x068add54f8a58c33ad7aba26582d25329b19a185` | ✅ | TreePass | v0.8.28 |
| SolarPass Proxy | `0x4F26621592D3B1ca344d187e469a86e2eE5FEa1E` | ✅ | ERC1967Proxy | v0.8.28 |
| SolarPass Impl | `0xdba0d170847c8c61933b28207ff28f833fd1672a` | ✅ | SolarPass | v0.8.28 |
| ComputePass Proxy | `0x6F503f315c95835A68d140440CA49b5C3e885Ce3` | ✅ | ERC1967Proxy | v0.8.28 |
| ComputePass Impl | `0x9981d0b53544db2ebe69c3bbeb5299d8985044f2` | ✅ | ComputePass | v0.8.28 |
| InstitutionalNFT | `0x4C472a0888f09cC604e265de593FA913aCfAFf3E` | ✅ | InstitutionalNFT | v0.8.27 |

> 地址来源：前端 `agv-web/agv-protocol-app/lib/contracts.ts` (BSC Chain 56 配置)

#### Agent 功能对比（BscScan verified source 确认）

| NFT Pass | `agentMint` | `grantAgentRole` | `revokeAgentRole` | `IAgentRegistry` | `setAgentRegistry` |
|----------|:-:|:-:|:-:|:-:|:-:|
| **SeedPass** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **TreePass** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SolarPass** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **ComputePass** | ✅ | ✅ | ✅ | ❌ | ❌ |

**解读**：
- **SeedPass / TreePass**：链上 implementation 完全没有 agent 基础设施（本地 SeedPass.sol 也没有，设计如此）
- **SolarPass / ComputePass**：链上已有 `agentMint()` + `grantAgentRole()` + `revokeAgentRole()`，**可以直接机构发放**
- **但** `agentRegistry()` 和 `setAgentRegistry()` 不在链上（本地代码更新后未升级 Proxy）
- `agentMint` 内有 `if (address(agentRegistry) != address(0))` 保护 — agentRegistry 未设置时跳过配额扣减，mint 本身正常工作

**链上 config 状态**：

| 字段 | SolarPass | ComputePass |
|------|-----------|-------------|
| saleActive | `true` | `true` |
| metadataFrozen | `false` | `false` |
| publicMinted | 0 | 0 |
| reservedMinted | 0 | 0 |

**结论**：要完整集成 AgentRegistry，需 UUPS 升级 SolarPass/ComputePass 的 implementation（加入 `agentRegistry` storage slot + `setAgentRegistry`）。但即使不升级，当前链上已可通过 `grantAgentRole` + `agentMint` 进行机构发放（仅缺少 per-agent 配额追踪）。

| tokenId | 持有地址 | 新合约对应 |
|---------|----------|------------|
| 1 | `0x9193...9479`（owner/minter） | 部署后由 admin 重新 setQuota |
| 2 | `0x5f9b...e643` | 同上 |
| 3 | `0xdaba...989d` | 同上 |
| 4 | `0xac38...1ca5` | 同上 |
| 5 | `0xa61c...94e3` | 同上 |

---

## 1. 现有 NFT Pass 总览

### 1.1 四种 NFT Pass 身份卡

| 属性 | ComputePass | SolarPass | TreePass | SeedPass |
|------|-------------|-----------|----------|----------|
| MAX_SUPPLY | 99 | 300 | 300 | 600 |
| MAX_PER_WALLET | 1 | 2 | 2 | 3 |
| PUBLIC_ALLOCATION | 49 | 200 | 200 | 400 |
| RESERVED_ALLOCATION | 50 (Agent) | 100 (Agent) | 100 (WL) | 200 (WL) |
| WL 价格 (USDT) | $899 | $299 | $59 | $29 |
| Public 价格 (USDT) | $899 | $299 | $59 | $29 |
| Agent 价格 (USDT) | **$499** | **$199** | — | — |
| 有 AGENT_MINTER_ROLE | ✅ | ✅ | ❌ | ❌ |
| Royalty | 3% | 3% | 5% | 5% |
| 合约类型 | ERC721A + UUPS | ERC721A + UUPS | ERC721A + UUPS | ERC721A + UUPS |

### 1.2 两种铸造模式对比

| 模式 | 适用合约 | 调用方 | 支付方式 | 额度来源 |
|------|---------|--------|---------|---------|
| **Public/WL Mint** | 全部4种 | 用户自己 | 用户付 USDT | PUBLIC_ALLOCATION 或 WHITELIST_ALLOCATION |
| **Agent Mint** | ComputePass, SolarPass | Agent 地址 | Agent 付 USDT (优惠价) | RESERVED_ALLOCATION (全局) |

### 1.3 当前 Agent Mint 的局限性

```
当前：  RESERVED_ALLOCATION = 50 (ComputePass)
        config.reservedMinted += total;  ← 只追踪【全局已铸造总量】

问题：  如果有 Agent-A 和 Agent-B 两个代理
        合约无法区分 A 铸了多少、B 铸了多少
        无法做 per-agent 额度管理 / 记账
```

**这就是为什么需要 AgentRegistry。**

---

## 2. 三种"NFT 概念"与合约映射

管理员定义了三种概念，与合约的对应关系如下：

```
┌───────────────────────────────────────────────────────────────────────┐
│                     管理员定义 → 合约映射（v2: ERC1155 一体化）           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1) Certification (凭证) ← 现在是 ERC1155 NFT                         │
│     ├── 含义: 你是机构代理，拥有 N 个 NFT 的铸造配额                      │
│     ├── 链上实现: AgentRegistry.setQuota(agent, nft, quota)            │
│     │     → 自动 _mint(agent, tokenId, 1, "") 铸造 ERC1155 凭证       │
│     ├── 判定条件: balanceOf(agent, tokenId) > 0  →  你有证书            │
│     ├── Soulbound: 不可转让（_update 中阻止非 mint/burn 转账）           │
│     └── 撤销: revokeAgent → _burn(agent, tokenId, 1)                  │
│                                                                       │
│  2) 机构NFT (带额度扣减的记账系统)                                       │
│     ├── 含义: 每次铸造后从你个人配额中扣减，方便记账                        │
│     ├── 链上实现: AgentRegistry.deductQuota(agent, amount)             │
│     ├── 追踪: agentMinted[agent][nft] 实时记录每个 agent 用了多少         │
│     └── 查询: getRemaining(agent, nft) = quota - minted               │
│                                                                       │
│  3) NFT 本身 (实际 ERC721A Token)                                      │
│     ├── 含义: 铸造到用户钱包的真实 NFT                                   │
│     ├── 链上实现: _safeMint(recipient, amount)                         │
│     ├── 合约: ComputePass / SolarPass / TreePass / SeedPass           │
│     └── 交付时间: 随时可铸造（在配额内）                                  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. 架构图

```
                 ┌──────────────────────────────────────┐
                 │    AgentRegistry (v2: ERC1155)         │  ★ 重构合约
                 │  ┌─ ERC1155 ─────────────────────────┐ │
                 │  │  tokenId 1 = ComputePass 凭证      │ │
                 │  │  tokenId 2 = SolarPass 凭证        │ │
                 │  │  tokenId 3 = TreePass 凭证         │ │
                 │  │  tokenId 4 = SeedPass 凭证         │ │
                 │  │  Soulbound (不可转让)               │ │
                 │  └───────────────────────────────────┘ │
                 │  ┌─ Quota 配额管理 ─────────────────┐   │
                 │  │  agent → nft → quota             │   │
                 │  │  agent → nft → minted            │   │
                 │  └──────────────────────────────────┘   │
                 │                                         │
                 │  setQuota()   → mint ERC1155 + 设额度    │
                 │  revokeAgent() → burn ERC1155 + 清额度   │
                 │  deductQuota() → NFT合约调用扣减额度      │
                 │  setTokenURI() → 设置凭证元数据           │
                 └──────────┬──────────────────────────────┘
                            │
              ┌─────────────┼─────────────┬─────────────┐
              │             │             │             │
              ▼             ▼             ▼             ▼
     ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐
     │ComputePass │ │ SolarPass  │ │ TreePass │ │ SeedPass │
     │ 99 总量     │ │ 300 总量    │ │ 300 总量  │ │ 600 总量  │
     │ 50 reserved│ │ 100 reserv.│ │ 100 WL   │ │ 200 WL   │
     │ $499 agent │ │ $199 agent │ │ 无agent   │ │ 无agent   │
     └────────────┘ └────────────┘ └──────────┘ └──────────┘
          │                │
          │  agentMint()   │  agentMint()
          │  ↓ 调用         │  ↓ 调用
          │  registry      │  registry
          │  .deductQuota()│  .deductQuota()
          ▼                ▼
     ┌──────────────────────────┐
     │   Treasury (USDT 收款)    │
     │   Agent 付优惠价 USDT      │
     │   → NFT 铸造到指定钱包      │
     └──────────────────────────┘
```

---

## 4. AgentRegistry 合约设计（v2: ERC1155 一体化）

### 4.1 设计要点

| 特性 | v1（已弃用） | v2（当前） |
|------|------------|----------|
| 继承 | AccessControl + Pausable | **ERC1155 + ERC1155Burnable + ERC1155Supply + AccessControl + Pausable** |
| 凭证表现形式 | 无链上凭证（纯 mapping） | ERC1155 NFT（可在钱包/市场展示） |
| Soulbound | 不适用 | `_update()` 中阻止非 mint/burn 转账 |
| tokenId 方案 | 不适用 | `nftContractToTokenId[nft] → tokenId` 双向映射 |
| setQuota | 只写 mapping | 写 mapping + 自动 mint ERC1155（首次设置时） |
| revokeAgent | 只清 quota | 清 quota + burn ERC1155 |
| URI | 不适用 | `setTokenURI(tokenId, uri)` + `setBaseURI(base)` |
| 向后兼容 | — | 所有 v1 view 函数保持签名不变（`isAgent`, `getRemaining`, `getAgentInfo`） |

### 4.2 TokenId 方案

| tokenId | 映射到 | 说明 |
|---------|--------|------|
| 1 | ComputePass | 高级机构凭证 |
| 2 | SolarPass | 中级机构凭证 |
| 3 | TreePass | 基础机构凭证（预留） |
| 4 | SeedPass | 入门机构凭证（预留） |
| 5+ | 未来扩展 | admin 通过 `registerNFTContract(nft, tokenId)` 添加 |

### 4.3 AgentRegistry.sol 核心结构

> 完整实现见 `contracts/registry/AgentRegistry.sol`。以下为核心设计概要：

```
继承链: ERC1155 → ERC1155Burnable → ERC1155Supply → AccessControl → Pausable

Roles:
  ADMIN_ROLE         — setQuota / revokeAgent / registerNFTContract / pause
  NFT_CONTRACT_ROLE  — deductQuota（仅 NFT 合约可调用）

State:
  agentQuota[agent][nft]   — 分配的总配额
  agentMinted[agent][nft]  — 已使用的配额
  nftContractToTokenId[nft] — NFT 合约 → tokenId 映射
  tokenIdToNFTContract[id]  — tokenId → NFT 合约反查
  agentList[]              — 已注册 agent 列表
  isRegistered[agent]      — 注册状态

Key Functions:
  setQuota(agent, nft, quota)
    → 首次设置时自动 _mint(agent, tokenId, 1, "")
    → 后续仅更新 quota mapping
  revokeAgent(agent, nft)
    → _burn(agent, tokenId, 1) + quota 清零
  deductQuota(agent, amount)
    → onlyRole(NFT_CONTRACT_ROLE) + whenNotPaused
    → msg.sender 自动作为 nftContract key
  registerNFTContract(nft, tokenId)
    → 建立双向映射 + 授予 NFT_CONTRACT_ROLE

Soulbound:
  _update(from, to, ids, values) override
    → 仅允许 from==0 (mint) 或 to==0 (burn)
    → 其他转账一律 revert SoulboundTransfer()
```

### 4.4 IAgentRegistry.sol (接口)

> 完整文件见 `contracts/interfaces/IAgentRegistry.sol`。v2 新增 ERC1155 相关查询。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentRegistry {
    // === Quota 操作（NFT 合约调用） ===
    function deductQuota(address agent, uint256 amount) external;

    // === 查询（前端 / Agent） ===
    function isAgent(address agent, address nftContract) external view returns (bool);
    function getRemaining(address agent, address nftContract) external view returns (uint256);
    function getAgentInfo(address agent, address nftContract)
        external view returns (uint256 quota, uint256 minted, uint256 remaining);

    // === v2 新增: ERC1155 查询 ===
    function getTokenId(address nftContract) external view returns (uint256);
    function getNFTContract(uint256 tokenId) external view returns (address);
}
```

---

## 5. 现有 NFT 合约改动（最小侵入）

> 与 v1 方案相同 — NFT 合约侧改动不受 AgentRegistry ERC1155 升级影响。

### 5.1 ComputePass.sol 改动

只需在 `agentMint` 函数内加 **2 行**：

```diff
 // --- 新增 State ---
+IAgentRegistry public agentRegistry;      // (新增 storage slot)

 // --- agentMint 函数改动 ---
 function agentMint(address[] calldata recipients, uint256[] calldata amounts)
     external
     onlyRole(AGENT_MINTER_ROLE)
     nonReentrant
     whenNotPaused
 {
     // ...省略前置检查...

+    // ★ 新增: per-agent 额度扣减（如果 registry 已设置）
+    if (address(agentRegistry) != address(0)) {
+        agentRegistry.deductQuota(msg.sender, total);
+    }

     config.reservedMinted += total;
     // ... 其余不变
 }

 // --- 新增 Admin 函数 ---
+function setAgentRegistry(address registry) external onlyRole(ADMIN_ROLE) {
+    agentRegistry = IAgentRegistry(registry);
+}
```

### 5.2 SolarPass.sol 改动

与 ComputePass **完全相同**的改动（加同样的 2 行 + setAgentRegistry）。

### 5.3 TreePass / SeedPass（统一风格升级 — 决策 D8）

**当前链上状态**：无 `agentMint` / `AGENT_MINTER_ROLE` / `agentRegistry`（§0.4 已验证）。

**统一方案（推荐）**：通过 UUPS 升级为 SolarPass/ComputePass 同样的 Agent 架构：

```diff
 // --- 新增到 TreePass.sol / SeedPass.sol ---
+bytes32 public constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");
+IAgentRegistry public agentRegistry;
+uint256 public constant AGENT_PRICE_USDT = ...; // TreePass: TBD, SeedPass: TBD
+uint256 public constant RESERVED_ALLOCATION = ...; // 从现有 WL 额度划转

+function agentMint(address[] calldata recipients, uint256[] calldata amounts)
+    external onlyRole(AGENT_MINTER_ROLE) nonReentrant whenNotPaused { ... }
+function setAgentRegistry(address registry) external onlyRole(ADMIN_ROLE) { ... }
+function grantAgentRole(address agent) external onlyRole(ADMIN_ROLE) { ... }
+function revokeAgentRole(address agent) external onlyRole(ADMIN_ROLE) { ... }
```

**升级考虑**：
- SeedPass WHITELIST_ALLOCATION=200 → 可划出部分作为 RESERVED_ALLOCATION
- TreePass WHITELIST_ALLOCATION=100 → 同上
- Agent 价格需单独定价（建议 SeedPass Agent=$29, TreePass Agent=$59，与公售持平或优惠）
- 升级后 4 个 Pass 统一 Agent 架构，AgentRegistry tokenId 1-4 全覆盖

---

## 6. 业务流程

### 6.1 发放 Certification（Admin 操作 — v2 有 ERC1155 自动铸造）

```
Admin (multisig)
  │
  ├── 0. 注册 NFT 合约（首次）:
  │     registry.registerNFTContract(computePass, 1)  // tokenId 1 = ComputePass
  │     registry.registerNFTContract(solarPass, 2)    // tokenId 2 = SolarPass
  │
  ├── 1. 在 AgentRegistry 中设置配额:
  │     registry.setQuota(agent_A, computePass, 10)
  │       ├── agentQuota[A][ComputePass] = 10
  │       └── ★ 自动 _mint(agent_A, tokenId=1, 1, "")  → ERC1155 凭证到钱包
  │
  │     registry.setQuota(agent_A, solarPass, 20)
  │       ├── agentQuota[A][SolarPass] = 20
  │       └── ★ 自动 _mint(agent_A, tokenId=2, 1, "")
  │
  ├── 2. 在 NFT 合约中授权 Agent 角色:
  │     computePass.grantAgentRole(agent_A)
  │     solarPass.grantAgentRole(agent_A)
  │
  └── 完成: agent_A 现在拥有 Certification
            ├── 钱包中多了 2 个 ERC1155 NFT（ComputePass 凭证 + SolarPass 凭证）
            ├── ComputePass: 10 个配额
            └── SolarPass:   20 个配额
```

### 6.2 Agent 铸造 NFT（= 使用 Certification 额度）

```
Agent_A
  │
  ├── 调用 computePass.agentMint([buyer_1, buyer_2], [1, 1])
  │     ├── Agent_A 支付 2 × $499 USDT = $998 → Treasury
  │     ├── computePass 内部调用 registry.deductQuota(agent_A, 2)
  │     │     ├── 检查: remaining = 10 - 0 = 10 ≥ 2  ✅
  │     │     └── 更新: agentMinted[A][ComputePass] = 2
  │     ├── _safeMint(buyer_1, 1)  → buyer_1 获得 ComputePass #N
  │     └── _safeMint(buyer_2, 1)  → buyer_2 获得 ComputePass #N+1
  │
  └── 铸造后状态:
        registry.getAgentInfo(A, ComputePass)
        → quota: 10, minted: 2, remaining: 8
        registry.balanceOf(A, 1)
        → 1  (ERC1155 凭证仍在，Soulbound 不可转让)
```

### 6.3 撤销 Agent（v2 自动 burn）

```
Admin
  │
  ├── registry.revokeAgent(agent_A, computePass)
  │     ├── agentQuota[A][ComputePass] = 0
  │     ├── ★ _burn(agent_A, tokenId=1, 1)  → ERC1155 凭证从钱包消失
  │     └── agentMinted[A][ComputePass] 保留（历史记账不清）
  │
  └── 撤销后状态:
        registry.balanceOf(A, 1) → 0  (凭证已销毁)
        registry.isAgent(A, computePass) → false
```

### 6.4 查询额度

```solidity
// 查询 Agent_A 在 ComputePass 的完整信息
(uint256 quota, uint256 minted, uint256 remaining) =
    registry.getAgentInfo(agent_A, address(computePass));
// → quota: 10, minted: 2, remaining: 8

// 查询是否仍是有效代理
bool valid = registry.isAgent(agent_A, address(computePass));
// → true (remaining > 0)

// ★ v2: 查询凭证持有（钱包/市场可展示）
uint256 balance = registry.balanceOf(agent_A, 1); // tokenId=1 (ComputePass)
// → 1 (持有凭证)

// ★ v2: 查询凭证总发行量
uint256 totalCerts = registry.totalSupply(1); // 所有持有 ComputePass 凭证的 agent 数
```

---

## 7. 权限矩阵

| 合约 | Role | 授予目标 | 作用 |
|------|------|---------|------|
| **AgentRegistry** | DEFAULT_ADMIN_ROLE | admin (multisig) | 最高管理（角色授予、回收） |
| **AgentRegistry** | ADMIN_ROLE | admin (multisig) | setQuota / batchSetQuota / revokeAgent / registerNFTContract / setTokenURI / pause |
| **AgentRegistry** | NFT_CONTRACT_ROLE | ComputePass / SolarPass 合约地址 | 调用 deductQuota |
| **ComputePass** | ADMIN_ROLE | admin (multisig) | 管理配置 |
| **ComputePass** | AGENT_MINTER_ROLE | 各 Agent 地址 | 铸造 NFT |
| **SolarPass** | ADMIN_ROLE | admin (multisig) | 管理配置 |
| **SolarPass** | AGENT_MINTER_ROLE | 各 Agent 地址 | 铸造 NFT |

> ⚠ **重要**: Agent 同时需要两个权限才能铸造:
> 1. NFT 合约上的 `AGENT_MINTER_ROLE`（调用 agentMint 的门槛）
> 2. AgentRegistry 中的 `quota > 0`（配额检查）
> 3. （v2 额外可验证）`registry.balanceOf(agent, tokenId) > 0`（持有 ERC1155 凭证）

---

## 8. 安全设计

### 8.1 双重检查机制

```
agentMint() 被调用时:
  ├── 检查 1: NFT 合约 — onlyRole(AGENT_MINTER_ROLE)       → 你是代理吗？
  ├── 检查 2: NFT 合约 — totalSupply() + total <= MAX_SUPPLY → 全局总量够吗？
  ├── 检查 3: NFT 合约 — reservedMinted + total <= RESERVED  → reserved 额度够吗？
  ├── 检查 4: AgentRegistry — amount <= remaining            → 你个人额度够吗？ ★
  └── 全部通过 → 扣减额度 + 铸造 + 收款
```

### 8.2 Soulbound 安全（v2 新增）

```
AgentRegistry._update(from, to, ids, values):
  ├── from == address(0)  → mint（仅 setQuota 触发）  ✅
  ├── to == address(0)    → burn（仅 revokeAgent 触发）✅
  └── 其他 → revert SoulboundTransfer()               ❌
```

- **防资质倒卖**: ERC1155 凭证不可在 OpenSea 等市场交易
- **防误操作**: safeTransferFrom / safeBatchTransferFrom 均被阻断
- **ERC1155Burnable.burn()**: 虽然继承了 burn 函数，但 `_update` 确保只有合约自身通过 `_burn` 调用的才能通过（from != 0, to == 0 路径）；agent 直接调用 `burn()` 也被 `_update` 中的权限检查阻断（可选：override `burn/burnBatch` 直接 revert）

### 8.3 向后兼容

```
if (address(agentRegistry) != address(0)) {
    agentRegistry.deductQuota(msg.sender, total);
}
```

- 如果 `agentRegistry` 未设置（= address(0)），行为与当前完全相同
- 升级时先部署 AgentRegistry → 设置配额 → 再调 `setAgentRegistry()`
- **零停机升级**

### 8.4 记账不可篡改

- `agentMinted` 只增不减（没有 resetMinted 函数）
- `setQuota` 要求 `quota >= agentMinted`（不能把配额设到已使用量以下）
- 即使 `revokeAgent` 也只是把 quota 设为 0，历史 minted 记录保留

### 8.5 旧合约迁移风险

- 旧 ERC1155 合约 `0x4C47...` **无 burn 功能**，5 枚旧凭证将永久存在于链上
- 前端/钱包需过滤旧合约地址，仅展示新 AgentRegistry 的 ERC1155 token
- 建议在新合约部署后，通知 5 位持有人新合约地址

---

## 9. 部署流程

### 9.1 部署脚本 (AgentRegistry.s.sol)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/registry/AgentRegistry.sol";

contract DeployAgentRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address computePass = vm.envAddress("COMPUTE_PASS_ADDRESS");
        address solarPass = vm.envAddress("SOLAR_PASS_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. 部署 AgentRegistry（v2: ERC1155 一体化）
        AgentRegistry registry = new AgentRegistry(admin);
        console.log("AgentRegistry deployed at:", address(registry));

        // 2. 注册 NFT 合约（建立 nftContract ↔ tokenId 双向映射）
        registry.registerNFTContract(computePass, 1);  // tokenId 1 = ComputePass
        registry.registerNFTContract(solarPass, 2);    // tokenId 2 = SolarPass
        console.log("Registered NFT contracts with tokenId mapping");

        // 3. 设置凭证元数据 URI（可选）
        // registry.setTokenURI(1, "ipfs://Qm.../computepass.json");
        // registry.setTokenURI(2, "ipfs://Qm.../solarpass.json");

        // 4. 设置初始 Agent 配额（示例）
        // registry.setQuota(agent_A, computePass, 10);
        // registry.setQuota(agent_A, solarPass, 20);

        vm.stopBroadcast();

        // 5. 后续需要在 ComputePass/SolarPass 上调用:
        //    computePass.setAgentRegistry(address(registry));
        //    solarPass.setAgentRegistry(address(registry));
        console.log("NEXT: setAgentRegistry() on NFT contracts");
    }
}
```

### 9.2 部署步骤（按顺序）

| 步骤 | 操作 | 谁执行 |
|------|------|---------|
| 1 | `forge create AgentRegistry --constructor-args $ADMIN` | deployer |
| 2 | `registry.registerNFTContract(computePass, 1)` | admin |
| 3 | `registry.registerNFTContract(solarPass, 2)` | admin |
| 4 | `registry.setTokenURI(1, "ipfs://...")` （可选） | admin |
| 5 | 升级 ComputePass 实现合约（加 agentRegistry slot + 改 agentMint） | admin (UUPS upgrade) |
| 6 | 升级 SolarPass 实现合约（同上） | admin (UUPS upgrade) |
| 7 | `computePass.setAgentRegistry(address(registry))` | admin |
| 8 | `solarPass.setAgentRegistry(address(registry))` | admin |
| 9 | `registry.setQuota(agent_A, computePass, 10)` → 自动 mint ERC1155 | admin |
| 10 | `computePass.grantAgentRole(agent_A)` | admin |
| 11 | **完成** — Agent_A 可以开始铸造，钱包中可见 ERC1155 凭证 | — |

---

## 10. Foundry 测试清单

### 10.1 AgentRegistry.t.sol — 核心测试

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testSetQuotaCreatesAgent` | 核心 |
| 2 | `testDeductQuotaReducesRemaining` | 核心 |
| 3 | `testDeductQuotaRevertsWhenExceedsQuota` | 边界 |
| 4 | `testBatchSetQuotaMultipleAgents` | 功能 |
| 5 | `testRevokeAgentSetsQuotaToZero` | 功能 |
| 6 | `testRevokeAgentPreservesHistory` | 记账 |
| 7 | `testSetQuotaCannotGoBelowMinted` | 安全 |
| 8 | `testOnlyNFTContractCanDeduct` | 权限 |
| 9 | `testOnlyAdminCanSetQuota` | 权限 |
| 10 | `testPauseBlocksDeduction` | 功能 |
| 11 | `testGetAgentsReturnsCorrectList` | 查询 |
| 12 | `testGetAgentInfoReturnsCorrectValues` | 查询 |
| 13 | `testFuzz_DeductNeverExceedsQuota(uint256)` | Fuzz |

### 10.2 ERC1155 特性测试（v2 新增）

| # | 测试用例 | 类型 |
|---|---------|------|
| 14 | `testSetQuotaMintsERC1155` | 核心 |
| 15 | `testSetQuotaDoesNotDoubleMint` | 边界 |
| 16 | `testRevokeAgentBurnsERC1155` | 核心 |
| 17 | `testSoulboundBlocksTransfer` | 安全 |
| 18 | `testSoulboundBlocksBatchTransfer` | 安全 |
| 19 | `testRegisterNFTContractSetsTokenId` | 功能 |
| 20 | `testTokenURIReturnsCorrectURI` | 元数据 |
| 21 | `testTotalSupplyTracksActiveCerts` | 查询 |
| 22 | `testSupportsInterfaceERC1155` | 标准 |

### 10.3 集成测试 (ComputePass + AgentRegistry)

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testAgentMintDeductsFromRegistry` | 集成 |
| 2 | `testAgentMintRevertsWhenQuotaExhausted` | 集成 |
| 3 | `testAgentMintWorksWithoutRegistry` | 兼容 |
| 4 | `testMultipleAgentsMintIndependently` | 集成 |
| 5 | `testAgentCannotExceedPersonalQuota` | 安全 |

---

## 11. 文件结构（最终版）

```
agvprotocol-contracts-main/
  contracts/
    nft/
      ComputePass.sol             (改动: +agentRegistry +setAgentRegistry +deductQuota调用)
      SolarPass.sol               (改动: 同 ComputePass)
      TreePass.sol                (改动: +agentMint +AGENT_MINTER_ROLE +agentRegistry — D8 统一升级)
      SeedPass.sol                (改动: 同 TreePass — D8 统一升级)
    registry/
      AgentRegistry.sol           ★ 重写（v2: ERC1155 + Quota 一体化）
    interfaces/
      IAgentRegistry.sol          ★ 更新（新增 getTokenId/getNFTContract）
  script/
    AgentRegistry.s.sol           ★ 更新（registerNFTContract 带 tokenId）
  test/
    ComputePass.t.sol             (改动: 加集成测试)
    SolarPass.t.sol               (改动: 加集成测试)
    TreePass.t.sol                (改动: 加 agentMint 测试 — D8)
    SeedPass.t.sol                (改动: 加 agentMint 测试 — D8)
    AgentRegistry.t.sol           ★ 更新（新增 ERC1155 测试）
```

改动文件: **10 个**（AgentRegistry.sol + IAgentRegistry.sol + AgentRegistry.t.sol + AgentRegistry.s.sol + 4 × NFT Pass .sol + 2 × 新增测试）

---

## 12. 实施优先级

| 阶段 | 交付物 | 状态 |
|------|--------|------|
| **P0 — AgentRegistry v2** | AgentRegistry.sol（ERC1155 一体化）+ IAgentRegistry.sol + 测试 | ✅ 代码+237测试完成（编译需修 OZ submodule） |
| **P0.5 — 4 Pass 统一升级** | SeedPass/TreePass 加 agentMint + SolarPass/ComputePass 加 agentRegistry | ⏳ D8 新增 |
| **P1 — 部署脚本** | AgentRegistry.s.sol（tokenId 1-4 + URI）+ 4× UUPS 升级脚本 | ⏳ P0.5 之后 |
| **P1.5 — ERC1155 图片** | 4 张 AgentRegistry 凭证图片 + IPFS 上传 + setTokenURI | ⏳ 需用户制作 |
| **P2 — 集成测试** | 端到端: Agent 注册 → ERC1155 mint → 铸造 → 额度扣减 | ⏳ P1 之后 |
| **P3 — 审计** | 安全审计（重点: Soulbound bypass / burn 权限 / 额度不可逆） | 外包 |

---

## 附录 A: 三种概念对比（v2 更新）

| 维度 | Certification (v2) | 机构NFT (额度系统) | NFT 本身 |
|------|-------------------|-------------------|---------|
| 本质 | 代理资格证明 | 带精细记账的配额管理 | 链上 ERC721A Token |
| 链上表现 | **ERC1155 token**（`balanceOf > 0`） | `agentMinted[agent][nft]` 实时追踪 | `ownerOf(tokenId) = buyer` |
| 标准 | ERC1155（Soulbound） | 自定义 mapping | ERC721A |
| 谁持有 | Agent 钱包 | Agent (配额数据) | 买家钱包 |
| 可转让吗 | **否（Soulbound）** | 否（链上记录） | 是（ERC721 transfer） |
| 有价格吗 | 无（资格凭证） | 无（记账工具） | 有（$499/$199 等） |
| 消耗性 | 否（持有即代理） | 是（用了就扣） | 否（铸造后永久） |
| 可见性 | ✅ 钱包/市场可见 | ❌ 内部数据 | ✅ 钱包/市场可见 |

## 附录 B: 与 tokencontracts-main 的关系

```
tokencontracts-main (Token 合约)
├── GVT.sol           → 主代币
├── PreGVT.sol        → 预售凭证
├── ShadowGVT.sol     → 价格锚/展示
├── Presale.sol       → 预售合约
└── 不涉及 NFT

agvprotocol-contracts-main (NFT 合约)        ← AgentRegistry 在这里
├── ComputePass.sol   → 高级 NFT Pass
├── SolarPass.sol     → 中级 NFT Pass
├── TreePass.sol      → 基础 NFT Pass
├── SeedPass.sol      → 入门 NFT Pass
└── AgentRegistry.sol → ★ 新增: 机构代理注册中心
```

两个仓库独立部署、独立升级，无合约级依赖。

---

# V3 — AGV NFT 系统

> 以下为全新架构，取代上方 V1/V2 设计。旧内容保留作历史参考。

---

## 13. V3 — AGV NFT 系统

### 13.0 为什么需要 V3

| 问题 | 详情 |
|------|------|
| **旧合约无权限** | 4 个旧 Pass 的 `owner()` = `0x3134D08860eB0A8473001CcC4Fe51dc78c8052D1`（旧团队），我们的 deployer `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` 无任何角色（§0.4 已验证） |
| **供应量不够** | 旧设计最大 600 枚，Agent/置换方动辄需要数万 |
| **无 License 机制** | 旧设计 Agent 持有大量独立 NFT，钱包展示灾难 |
| **品牌更新** | 旧团队 = AGV Protocol，新品牌 = AGV |
| **旧版三池过度设计** | Public/Agent/Reserve 三个独立配额池本质无区别；Agent 佣金/结算实际在链下发生，链上不应碰 |

### 13.1 V3 产品矩阵

| Pass | MAX_SUPPLY | 价格 (USDT) | 散客链上自购 | Agent 配额（License） |
|------|-----------|-------------|:----------:|:------------------:|
| **SeedPass** | 1,000,000 | $29 | ✅ `mint(qty)` | ✅ `adminMintForAgent()` |
| **TreePass** | 1,000,000 | $59 | ✅ `mint(qty)` | ✅ `adminMintForAgent()` |
| **SolarPass** | 1,000,000 | $299 | ✅ `mint(qty)` | ✅ `adminMintForAgent()` |
| **ComputePass** | 1,000,000 | $899 | ✅ `mint(qty)` | ✅ `adminMintForAgent()` |

**单池模型**：只有 1 个 `MAX_SUPPLY = 1,000,000` 和 1 个 `totalMinted` 计数器。无 Public/Agent/Reserve 分池。

**硬约束 vs 软约束**：

| 约束 | 类型 | 可变 | 说明 |
|------|------|:---:|------|
| MAX_SUPPLY = 1,000,000 | `constant` | ❌ | 合约部署后不可更改 |
| Agent 配额 | `storage` mapping | ✅ | `grantLicense` / `adjustQuota` 可调，每位 Agent 独立 |

### 13.2 两种角色，两种 NFT

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          钱包中的展示效果                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  散客（单个购买）：                                                       │
│    🃏 SolarPass #38291           ← 独立收藏品，精美图片                   │
│    🃏 SolarPass #38292           ← 可以有多个，每个独立展示                │
│                                                                         │
│  Agent 代理商：                                                          │
│    📋 SeedPass License           ← 1 张 Soulbound，图上印 "79,000"      │
│    📋 SolarPass License          ← 1 张 Soulbound，图上印 "200"          │
│    （Agent 不直接调合约铸造，Admin 确认结算后代铸）                          │
│                                                                         │
│  客户（通过 Agent 购买）：                                                 │
│    🃏 SeedPass #50001            ← 和散客拿到的是同一种收藏品 NFT          │
│    🃏 SeedPass #50002            ← 单个或批量，Admin 按客户要求铸造        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**核心理念**：Agent 是**销售角色**，不是产品通道。所有客户（无论散客还是 Agent 介绍的）拿到的都是同一种收藏品 NFT。Agent 仅额外持有一张 License NFT 作为代理资质凭证。

#### License 图片说明

| 角色 | 图片 | 举例 |
|------|------|------|
| **收藏品 NFT** | Pass 标准图（精美收藏品设计） | SolarPass 官方图 |
| **Agent License** | Pass Agent 版图（不同配色/标识 + 额度数字） | SeedPass Agent 图 + "79,000" |

> 每种 Pass 需要 **2 张图**：① 收藏品版 ② Agent License 版（共 8 张图）
> License 上的额度数字可以是**静态图片**（Admin 制作）或**动态元数据**（API 返回）

### 13.3 联合架构图

```
                    ┌─────────────────────────────────────┐
                    │     SeedPass 合约                     │
                    │     (ERC721A + UUPS + AccessControl)  │
                    │                                       │
                    │  ┌── 收藏品层（ERC721A）──────────────┐ │
                    │  │  tokenId 0 ~ 999,999              │ │
                    │  │  标准 ERC721 收藏品                │ │
                    │  │  可转让，钱包/市场展示               │ │
                    │  └───────────────────────────────────┘ │
                    │                                       │
                    │  ┌── License 层（内嵌 mapping）───────┐ │
                    │  │  licenses[agent] → License 信息     │ │
                    │  │    quota — 总额度                   │ │
                    │  │    used — 已用额度                  │ │
                    │  │    tokenId — License NFT ID        │ │
                    │  │  isLicenseToken[tokenId] = true    │ │
                    │  │  Soulbound（License 不可转让）       │ │
                    │  └───────────────────────────────────┘ │
                    │                                       │
                    │  铸造入口:                              │
                    │   mint(qty)                → 散客付 USDT │
                    │   adminMint(to, qty)       → 空投/赠送  │
                    │   adminMintForAgent(agent, to, qty)     │
                    │                   → Agent 结算后 Admin 代铸 │
                    └───────────┬───────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
          散客（自购）      Admin（代铸）      Agent（角色）
          付 USDT           确认 Agent 已结算    持 License
          mint(qty)         adminMintForAgent    链下收款
          → NFT 给自己      → NFT 给客户         → 不碰合约
                            → 扣 Agent 配额
```

**每种 Pass 独立部署**，合约完全相同只是参数不同（名称、价格、图片 URI）。

### 13.4 合约核心设计

#### 13.4.1 存储结构

```solidity
// ═══ 常量 ═══
uint256 public constant MAX_SUPPLY = 1_000_000;
IERC20 public immutable USDT;
uint256 public immutable PRICE;  // 例: 29 * 1e18 ($29, BSC USDT 18 decimals)

// ═══ License 层 ═══
struct License {
    uint256 tokenId;       // License NFT 的 tokenId（ERC721A 中的真实 ID）
    uint256 quota;         // 总分配额度
    uint256 used;          // 已使用额度（Admin 代铸时扣减）
    bool    active;        // 是否有效
}

mapping(address => License) public licenses;    // Agent → License 信息
mapping(uint256 => bool) public isLicenseToken; // tokenId → 是否为 License

// ═══ 管理 ═══
address public treasury;

// ═══ 元数据 ═══
string public collectibleBaseURI;   // 收藏品 NFT 的 baseURI
string public licenseBaseURI;       // License NFT 的 baseURI
```

#### 13.4.2 核心函数

```solidity
// ═══ Admin — License 管理 ═══

/// @notice 授予 Agent License（铸造 1 个 Soulbound License NFT + 设置额度）
function grantLicense(address agent, uint256 quota)
    external onlyRole(ADMIN_ROLE)
{
    require(!licenses[agent].active, "Already has license");

    uint256 startId = _nextTokenId();
    _mint(agent, 1);
    isLicenseToken[startId] = true;

    licenses[agent] = License({
        tokenId: startId,
        quota: quota,
        used: 0,
        active: true
    });

    emit LicenseGranted(agent, startId, quota);
}

/// @notice 调整 Agent 配额（不换 NFT）
function adjustQuota(address agent, uint256 newQuota)
    external onlyRole(ADMIN_ROLE)
{
    License storage lic = licenses[agent];
    require(lic.active, "No active license");
    require(newQuota >= lic.used, "Below already used");
    lic.quota = newQuota;
    emit QuotaAdjusted(agent, newQuota);
}

/// @notice 撤销 Agent License（burn NFT + 清零）
function revokeLicense(address agent) external onlyRole(ADMIN_ROLE) {
    License storage lic = licenses[agent];
    require(lic.active, "No active license");
    uint256 tokenId = lic.tokenId;
    _burn(tokenId);
    isLicenseToken[tokenId] = false;
    lic.active = false;
    emit LicenseRevoked(agent, tokenId);
}

// ═══ 散客自购（链上收款）═══

/// @notice 散客付 USDT 购买（单个或多个）
function mint(uint256 qty) external nonReentrant whenNotPaused {
    require(totalSupply() + qty <= MAX_SUPPLY, "Exceeds max supply");

    uint256 cost = PRICE * qty;
    USDT.safeTransferFrom(msg.sender, treasury, cost);

    _mint(msg.sender, qty);
    emit Mint(msg.sender, qty, cost);
}

// ═══ Admin 铸造（不涉及 Agent）═══

/// @notice Admin 直接铸造（空投、赠送、合作方分发等）
function adminMint(address to, uint256 qty)
    external onlyRole(ADMIN_ROLE) nonReentrant
{
    require(totalSupply() + qty <= MAX_SUPPLY, "Exceeds max supply");
    _mint(to, qty);
    emit AdminMint(to, qty);
}

// ═══ Admin 为 Agent 代铸（链下确认结算后）═══

/// @notice Agent 已链下结算 → Admin 铸造给客户 → 扣减 Agent 配额
function adminMintForAgent(address agent, address to, uint256 qty)
    external onlyRole(ADMIN_ROLE) nonReentrant
{
    License storage lic = licenses[agent];
    require(lic.active, "Agent has no active license");
    require(lic.used + qty <= lic.quota, "Exceeds agent quota");
    require(totalSupply() + qty <= MAX_SUPPLY, "Exceeds max supply");

    lic.used += qty;
    _mint(to, qty);
    emit AgentMintFulfilled(agent, to, qty);
}

// ═══ 元数据 ═══

/// @notice 返回 tokenURI — License 和收藏品使用不同 baseURI
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "Nonexistent token");
    if (isLicenseToken[tokenId]) {
        return string(abi.encodePacked(licenseBaseURI, _toString(tokenId)));
    }
    return string(abi.encodePacked(collectibleBaseURI, _toString(tokenId)));
}

// ═══ Soulbound (License 不可转让) ═══

/// @notice 重写 transferFrom — License token 禁止转让
function _beforeTokenTransfers(
    address from, address to, uint256 startTokenId, uint256 quantity
) internal override {
    if (from != address(0) && to != address(0)) {
        for (uint256 i = 0; i < quantity; i++) {
            require(!isLicenseToken[startTokenId + i], "License is soulbound");
        }
    }
    super._beforeTokenTransfers(from, to, startTokenId, quantity);
}
```

#### 13.4.3 查询函数

```solidity
/// @notice 查询 Agent License 信息
function getLicense(address agent)
    external view
    returns (uint256 tokenId, uint256 quota, uint256 used, uint256 remaining, bool active)
{
    License memory lic = licenses[agent];
    return (lic.tokenId, lic.quota, lic.used, lic.quota - lic.used, lic.active);
}

/// @notice 查询总铸造情况
function supplyInfo()
    external view
    returns (uint256 minted, uint256 maxSupply, uint256 remaining)
{
    uint256 ts = totalSupply();
    return (ts, MAX_SUPPLY, MAX_SUPPLY - ts);
}
```

### 13.5 业务流程图

#### 13.5.1 Admin 初始化

```
Admin
  │
  ├── 部署 SeedPass 合约
  │     参数: USDT 地址, $29, treasury
  │
  ├── 授权 Agent:
  │     grantLicense(agent_A, 79000)
  │     → 铸造 1 个 License NFT → Agent 钱包
  │     → 图片: SeedPass Agent License + "79,000"
  │
  └── 完成初始化
```

#### 13.5.2 散客购买

```
客户 → 访问 buy.agvnexrur.ai
  │
  ├── 连接钱包 → approve USDT
  ├── 调用 mint(1)
  │     → $29 USDT → treasury
  │     → 铸造 SeedPass #N → 客户钱包
  │
  └── 钱包展示: 🃏 SeedPass #N（精美收藏品图）
```

#### 13.5.3 Agent 代售（链下结算 → Admin 代铸）

```
Agent_A 接到 30,000 个 SeedPass 大单:

═══ 步骤 1: 链下结算 ═══

  客户付 30,000 × $29 = $870,000 USDT → Agent_A
  Agent_A 留佣金 → 剩余转给我们（线下/银行/USDT 均可）
  ⚠️ 合约不介入 Agent 与客户之间的资金流转

═══ 步骤 2: Admin 确认收款后链上铸造 ═══

  Admin 调用: adminMintForAgent(agent_A, 客户, 30000)
  ├── 检查: Agent_A License active ✅
  ├── 检查: Agent_A 额度 79,000 - 0 used ≥ 30,000 ✅
  ├── 检查: totalSupply() + 30,000 ≤ MAX_SUPPLY ✅
  ├── Agent_A.used += 30,000
  └── 铸造 30,000 个 SeedPass → 客户钱包

═══ 最终结果 ═══

  Agent_A 钱包: 📋 License — quota: 79,000 | used: 30,000 | remaining: 49,000
  客户钱包:      🃏×30,000 个 SeedPass 收藏品
```

#### 13.5.4 Admin 空投/赠送

```
Admin 给合作方赠送 500 个 SeedPass（不涉及 Agent）:

  Admin 调用: adminMint(合作方, 500)
  → 直接铸造 500 个 SeedPass → 合作方钱包
  → 不影响任何 Agent 的额度
```

### 13.6 Agent 大单场景全流程

> 对应核心场景：Agent 卖了 30,000 个

```
═══ 前置：Agent_A 持有 SeedPass License（79,000 额度）═══

【线下商务】
  Agent_A 找到客户 → 客户买 30,000 个
  客户付 $870,000 → Agent_A
  Agent_A 留佣金（线下约定比例）→ 剩余付给我们

【我们确认收到款项后】

  Admin 调用: adminMintForAgent(agent_A, 客户地址, 30000)
  ├── Agent_A 额度: used 0 → 30,000 → remaining 49,000
  └── 客户获得: 🃏×30,000 个 SeedPass

【链上验证】
  getLicense(agent_A)
  → tokenId: 0 | quota: 79,000 | used: 30,000 | remaining: 49,000 | active: true

  supplyInfo()
  → minted: 30,000 | maxSupply: 1,000,000 | remaining: 970,000
```

> **VS 旧版的简化**：旧版中 Agent 自己调 `agentSell` / `distributeMint` / `transferQuota`（3 个函数 × 多笔交易）。V3 中 Admin 一笔 `adminMintForAgent` 完成，Agent 本人**无需链上操作**。

### 13.7 权限矩阵

| Role | 授予目标 | 可执行函数 |
|------|---------|-----------|
| **DEFAULT_ADMIN_ROLE** | deployer (multisig) | 角色管理 |
| **ADMIN_ROLE** | deployer | `grantLicense`, `revokeLicense`, `adjustQuota`, `adminMint`, `adminMintForAgent`, `setBaseURI`, `pause/unpause` |
| *(任何人)* | 散客 | `mint` |
| *(Agent)* | — | **无链上操作** — Agent 仅持有 License NFT 作为凭证，所有铸造由 Admin 代执行 |

### 13.8 安全设计

| 安全点 | 机制 |
|--------|------|
| **License Soulbound** | `_beforeTokenTransfers` 阻止 License token 转让 |
| **额度不可超用** | `lic.used + qty <= lic.quota` |
| **总量不可超铸** | `totalSupply() + qty <= MAX_SUPPLY` |
| **USDT 安全** | `safeTransferFrom`（需先 approve，仅 `mint()` 涉及） |
| **重入保护** | `nonReentrant` 修饰所有铸造函数 |
| **暂停机制** | `whenNotPaused` 修饰所有铸造函数 |
| **Agent 无链上权限** | Agent 不能自行铸造或转移额度，杜绝"先货后款"风险 |
| **Admin 代铸约束** | `adminMintForAgent` 必须指定 License 有效的 Agent 地址 |

### 13.9 事件清单

```solidity
event LicenseGranted(address indexed agent, uint256 indexed tokenId, uint256 quota);
event LicenseRevoked(address indexed agent, uint256 indexed tokenId);
event QuotaAdjusted(address indexed agent, uint256 newQuota);
event Mint(address indexed buyer, uint256 qty, uint256 totalCost);
event AdminMint(address indexed to, uint256 qty);
event AgentMintFulfilled(address indexed agent, address indexed to, uint256 qty);
```

### 13.10 元数据 & 图片

#### 每种 Pass 需要 2 套图片

| 图片 | 用于 | 风格 | 示例 |
|------|------|------|------|
| **收藏品图** | 散客购买 / Admin 铸造的 NFT | 精美收藏品设计 | SeedPass 标准版 |
| **License 图** | Agent 的 License NFT | Pass 图 + Agent 标识 + 额度数字 | SeedPass Agent License + "79,000" |

> License 图上的额度数字是**静态图片**，Admin 针对每位 Agent 单独制作。
> 如果后期需要动态显示剩余额度，可部署 metadata API 服务端。

#### tokenURI 路由

```
tokenURI(tokenId):
  ├── isLicenseToken[tokenId] == true
  │     → licenseBaseURI/{tokenId}    ← Agent License 元数据
  │       返回: { name: "SeedPass Agent License", image: "agent-seedpass-79000.png", ... }
  │
  └── isLicenseToken[tokenId] == false
        → collectibleBaseURI/{tokenId}  ← 收藏品元数据
          返回: { name: "SeedPass #12345", image: "seedpass-collectible.png", ... }
```

### 13.11 文件结构

```
agvprotocol-contracts-main/
  contracts/
    _archive/
      v1/                                  ← 旧团队链上源码（BscScan 下载）
        SeedPass_V1_OnChain.sol
        TreePass_V1_OnChain.sol
        SolarPass_V1_OnChain.sol
        ComputePass_V1_OnChain.sol
        InstitutionalNFT_V1_OnChain.sol
      v2/                                  ← V2 代码（含 AgentRegistry，已归档）
        SeedPass.sol / TreePass.sol / ...
        AgentRegistry.sol / IAgentRegistry.sol
    nft/                                   ← ★ V3 活跃合约
      PassBase.sol                         ← 公共基类（单池 + License）
      SeedPass.sol                         ← $29, MAX_SUPPLY=1M
      TreePass.sol                         ← $59, MAX_SUPPLY=1M
      SolarPass.sol                        ← $299, MAX_SUPPLY=1M
      ComputePass.sol                      ← $899, MAX_SUPPLY=1M
  script/
    DeployPasses.s.sol                     ← 4 合约部署脚本
    v2/                                    ← V2 旧脚本
  test/
    Pass.t.sol                             ← V3 测试（61 个）
    v2/                                    ← V2 旧测试
```

### 13.12 实施优先级

| 阶段 | 交付物 | 状态 |
|------|--------|------|
| **V3-P0 — 设计** | 架构方案 + 流程确认 | ✅ 完成 |
| **V3-P1 — 合约** | PassBase.sol + 4 子合约 + 测试（61 个） | ✅ 完成 |
| **V3-P2 — 图片** | 6/8 张完成（缺 treeagent.png + computeagent.png） | ⚠️ 2 张待制作 |
| **V3-P3 — 部署** | BSC Mainnet 部署 + BscScan 8/8 Verified | ✅ 2026-03-17 Block 87205718 |
| **V3-P3a — 元数据** | Metadata API + collectibleBaseURI ×4 + licenseBaseURI ×1 | ✅ 2026-03-18 |
| **V3-P3b — 首铸** | Collectible #1 + Agent License #2 (SeedPass) | ✅ 2026-03-18 |
| **V3-P4 — 前端** | buy-page 对接新合约地址 + ABI | ⏳ 待开始 |

### 13.13 V2 vs V3 架构对比

| 维度 | V2（旧架构） | V3（新架构） |
|------|-----------|-----------|
| 合约所有权 | 旧团队 `0x3134...` | 我们 `0xAC38...` |
| 品牌 | AGV Protocol | AGV |
| 供应量 | 99-600 | **1,000,000** |
| 池结构 | 无分池 | **单池 `totalSupply()` vs `MAX_SUPPLY`** |
| Agent 机制 | 独立 AgentRegistry (ERC1155) | **内嵌 License 层（Soulbound ERC721A）** |
| Agent 持有 | ERC1155 Soulbound 凭证 | **1 张 License NFT** |
| Agent 铸造 | `agentMint`（Agent 付 USDT 铸给他人） | **Agent 无链上操作 — Admin `adminMintForAgent` 代铸** |
| Agent 结算 | 链上（Agent 直接收款） | **链下（先款后货，Admin 确认后铸造）** |
| 置换方/佣金 | 无设计 | **链下协商 — 合约不涉及** |
| 额度转移 | 不支持 | **不需要 — Agent 不自行操作链上铸造** |
| 钱包限购 | 1-3 个/钱包 | **无限购** |
| 可转让 | 收藏品可转，凭证 Soulbound | **收藏品可转，License Soulbound** |
