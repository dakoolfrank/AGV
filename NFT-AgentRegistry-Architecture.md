# NFT Pass & AgentRegistry 架构方案 — 可执行版

> **文档版本**: v1.0  
> **日期**: 2026-02-25  
> **适用仓库**: `agvprotocol-contracts-main`  
> **前置文档**: `PreGVT-sGVT-Architecture.md`

---

## 0. 决策记录

| # | 决策项 | 结论 | 理由 |
|---|--------|------|------|
| D1 | NFT 合约标准 | **ERC721A (Upgradeable + UUPS)** | 批量铸造 gas 优化，已部署运行 |
| D2 | 机构 Certification 实现 | **AgentRegistry 合约统一管理** | 一个合约同时覆盖 Cert + 额度扣减 |
| D3 | 机构NFT 额度扣减 | **per-agent per-nft 追踪** | 当前合约只追踪总 reserved，需升级为个人额度 |
| D4 | 支付方式 | **USDT (ERC20, 6 decimals)** | 所有 NFT Pass 统一 USDT 支付 |
| D5 | AgentRegistry 是否可升级 | **否（immutable 部署）** | 逻辑简单，减少升级风险 |

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
│                     管理员定义 → 合约映射                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1) Certification (凭证)                                              │
│     ├── 含义: 你是机构代理，拥有 N 个 NFT 的铸造配额                      │
│     ├── 链上实现: AgentRegistry.setQuota(agent, nft, quota)            │
│     ├── 判定条件: agentQuota[agent][nft] > 0  →  你有证书               │
│     └── 交付时间: 5个工作日（开通账户 + 链上授权）                         │
│                                                                       │
│  2) 机构NFT (带额度扣减的记账系统)                                       │
│     ├── 含义: 每次铸造后从你个人配额中扣减，方便记账                        │
│     ├── 链上实现: AgentRegistry.deductQuota(agent, amount)             │
│     ├── 追踪: agentMinted[agent][nft] 实时记录每个 agent 用了多少         │
│     ├── 查询: getRemaining(agent, nft) = quota - minted               │
│     └── 交付时间: 还需 ~25 天开发                                       │
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
                 ┌─────────────────────────────┐
                 │       AgentRegistry          │  ★ 新增合约
                 │  (Certification + 额度管理)    │
                 │                               │
                 │  agent → nft → quota          │  ← Certification
                 │  agent → nft → minted         │  ← 机构NFT (扣减)
                 │                               │
                 │  setQuota()                   │  ← Admin 发凭证
                 │  batchSetQuota()              │  ← 批量发凭证
                 │  deductQuota()                │  ← NFT合约调用扣减
                 │  revokeAgent()                │  ← 撤销代理资格
                 │  getRemaining()               │  ← 查询剩余额度
                 │  isAgent()                    │  ← 查询是否有效代理
                 └──────────┬────────────────────┘
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

## 4. AgentRegistry 合约设计

### 4.1 AgentRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentRegistry
 * @notice 机构代理注册中心 — 统一管理 Certification 和 per-agent 额度扣减
 * @dev
 * - Certification = setQuota(agent, nft, quota) → agent 获得铸造资格 + 配额
 * - 机构NFT = agentMint 时自动调用 deductQuota() → 从个人配额扣减
 * - 支持多个 NFT 合约共用同一个 Registry
 * - 不可升级（immutable 部署），逻辑简单无需升级
 */
contract AgentRegistry is AccessControl, Pausable {

    // ===================== Roles =====================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant NFT_CONTRACT_ROLE = keccak256("NFT_CONTRACT_ROLE");

    // ===================== State =====================

    /// @notice agent => nftContract => 分配的总配额
    mapping(address => mapping(address => uint256)) public agentQuota;

    /// @notice agent => nftContract => 已使用的配额
    mapping(address => mapping(address => uint256)) public agentMinted;

    /// @notice 所有已注册 agent 地址列表（用于遍历/快照）
    address[] public agentList;
    mapping(address => bool) public isRegistered;

    // ===================== Events =====================
    event AgentRegistered(address indexed agent);
    event QuotaSet(address indexed agent, address indexed nftContract, uint256 quota);
    event QuotaBatchSet(address indexed nftContract, uint256 agentCount);
    event QuotaDeducted(address indexed agent, address indexed nftContract, uint256 amount, uint256 remaining);
    event AgentRevoked(address indexed agent, address indexed nftContract);

    // ===================== Constructor =====================
    constructor(address admin) {
        require(admin != address(0), "ZeroAddress");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ===================== Admin: Certification 管理 =====================

    /**
     * @notice 给 agent 设置对某个 NFT 合约的配额（= 发放 Certification）
     * @param agent 代理地址
     * @param nftContract NFT Pass 合约地址 (ComputePass / SolarPass 等)
     * @param quota 分配的铸造配额数量
     * @dev quota = 0 等同于撤销该合约的代理资格
     */
    function setQuota(address agent, address nftContract, uint256 quota)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(agent != address(0) && nftContract != address(0), "ZeroAddress");
        require(quota >= agentMinted[agent][nftContract], "QuotaBelowMinted");

        // 自动注册到 agentList
        if (!isRegistered[agent]) {
            isRegistered[agent] = true;
            agentList.push(agent);
            emit AgentRegistered(agent);
        }

        agentQuota[agent][nftContract] = quota;
        emit QuotaSet(agent, nftContract, quota);
    }

    /**
     * @notice 批量设置多个 agent 对同一 NFT 合约的配额
     * @param agents 代理地址数组
     * @param nftContract NFT Pass 合约地址
     * @param quotas 配额数组（与 agents 一一对应）
     */
    function batchSetQuota(
        address[] calldata agents,
        address nftContract,
        uint256[] calldata quotas
    ) external onlyRole(ADMIN_ROLE) {
        require(agents.length == quotas.length, "LengthMismatch");
        require(nftContract != address(0), "ZeroAddress");

        for (uint256 i; i < agents.length;) {
            address agent = agents[i];
            require(agent != address(0), "ZeroAddress");
            require(quotas[i] >= agentMinted[agent][nftContract], "QuotaBelowMinted");

            if (!isRegistered[agent]) {
                isRegistered[agent] = true;
                agentList.push(agent);
                emit AgentRegistered(agent);
            }

            agentQuota[agent][nftContract] = quotas[i];
            emit QuotaSet(agent, nftContract, quotas[i]);

            unchecked { ++i; }
        }
        emit QuotaBatchSet(nftContract, agents.length);
    }

    /**
     * @notice 撤销 agent 对某个 NFT 合约的全部配额
     * @dev 不清除 agentMinted 记录（保留历史记账）
     */
    function revokeAgent(address agent, address nftContract)
        external
        onlyRole(ADMIN_ROLE)
    {
        agentQuota[agent][nftContract] = 0;
        emit AgentRevoked(agent, nftContract);
    }

    // ===================== NFT 合约调用: 额度扣减 =====================

    /**
     * @notice NFT 合约铸造时调用，扣减 agent 的个人配额
     * @param agent 执行铸造的代理地址
     * @param amount 本次铸造数量
     * @dev 只有被授予 NFT_CONTRACT_ROLE 的合约地址才能调用
     *      msg.sender = NFT 合约地址，自动作为 nftContract key
     */
    function deductQuota(address agent, uint256 amount)
        external
        onlyRole(NFT_CONTRACT_ROLE)
        whenNotPaused
    {
        address nftContract = msg.sender;
        uint256 remaining = agentQuota[agent][nftContract] - agentMinted[agent][nftContract];
        require(amount <= remaining, "ExceedsAgentQuota");

        agentMinted[agent][nftContract] += amount;

        emit QuotaDeducted(agent, nftContract, amount, remaining - amount);
    }

    // ===================== Admin: Registry 管理 =====================

    /**
     * @notice 授予 NFT 合约调用 deductQuota 的权限
     * @param nftContract NFT Pass 合约地址
     */
    function registerNFTContract(address nftContract) external onlyRole(ADMIN_ROLE) {
        require(nftContract != address(0), "ZeroAddress");
        _grantRole(NFT_CONTRACT_ROLE, nftContract);
    }

    /**
     * @notice 撤销 NFT 合约的调用权限
     */
    function unregisterNFTContract(address nftContract) external onlyRole(ADMIN_ROLE) {
        _revokeRole(NFT_CONTRACT_ROLE, nftContract);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ===================== View Functions =====================

    /**
     * @notice 查询 agent 是否是某个 NFT 合约的有效代理
     * @return true if agent has remaining quota > 0
     */
    function isAgent(address agent, address nftContract) external view returns (bool) {
        return agentQuota[agent][nftContract] > agentMinted[agent][nftContract];
    }

    /**
     * @notice 查询 agent 对某个 NFT 合约的剩余可铸造数量
     */
    function getRemaining(address agent, address nftContract) external view returns (uint256) {
        return agentQuota[agent][nftContract] - agentMinted[agent][nftContract];
    }

    /**
     * @notice 查询 agent 对某个 NFT 合约的完整信息
     * @return quota 总配额, minted 已使用, remaining 剩余
     */
    function getAgentInfo(address agent, address nftContract)
        external
        view
        returns (uint256 quota, uint256 minted, uint256 remaining)
    {
        quota = agentQuota[agent][nftContract];
        minted = agentMinted[agent][nftContract];
        remaining = quota - minted;
    }

    /**
     * @notice 获取已注册 agent 总数
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice 分页获取 agent 列表（防 gas 超限）
     * @param offset 起始索引
     * @param limit 最大返回数量
     */
    function getAgents(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory agents)
    {
        uint256 total = agentList.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        agents = new address[](end - offset);
        for (uint256 i = offset; i < end;) {
            agents[i - offset] = agentList[i];
            unchecked { ++i; }
        }
    }
}
```

### 4.2 IAgentRegistry.sol (接口)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentRegistry {
    function deductQuota(address agent, uint256 amount) external;
    function isAgent(address agent, address nftContract) external view returns (bool);
    function getRemaining(address agent, address nftContract) external view returns (uint256);
    function getAgentInfo(address agent, address nftContract)
        external view returns (uint256 quota, uint256 minted, uint256 remaining);
}
```

---

## 5. 现有 NFT 合约改动（最小侵入）

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
     require(recipients.length == amounts.length, "InvalidConfiguration");

     uint256 total;
     uint256 totalPayment;
     for (uint256 i; i < amounts.length;) {
         total += amounts[i];
         totalPayment += amounts[i] * AGENT_PRICE_USDT;
         unchecked { ++i; }
     }

     require(totalSupply() + total <= MAX_SUPPLY, "ExceedsMaxSupply");
     require(config.reservedMinted + total <= RESERVED_ALLOCATION, "ExceedsReservedAllocation");

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

### 5.3 TreePass / SeedPass

**不需要改动** — 这两个合约没有 Agent Mint 功能，不涉及机构额度。

---

## 6. 业务流程

### 6.1 发放 Certification（Admin 操作）

```
Admin (multisig)
  │
  ├── 1. 在 AgentRegistry 中设置配额:
  │     registry.setQuota(agent_A, ComputePass, 10)   // A 可铸造 10 个 ComputePass
  │     registry.setQuota(agent_A, SolarPass, 20)     // A 可铸造 20 个 SolarPass
  │
  ├── 2. 在 NFT 合约中授权 Agent 角色:
  │     computePass.grantAgentRole(agent_A)
  │     solarPass.grantAgentRole(agent_A)
  │
  └── 完成: agent_A 现在拥有 Certification
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
```

### 6.3 查询额度（前端 / Agent 查看）

```solidity
// 查询 Agent_A 在 ComputePass 的完整信息
(uint256 quota, uint256 minted, uint256 remaining) =
    registry.getAgentInfo(agent_A, address(computePass));
// → quota: 10, minted: 2, remaining: 8

// 查询是否仍是有效代理
bool valid = registry.isAgent(agent_A, address(computePass));
// → true (remaining > 0)
```

---

## 7. 权限矩阵

| 合约 | Role | 授予目标 | 作用 |
|------|------|---------|------|
| **AgentRegistry** | DEFAULT_ADMIN_ROLE | admin (multisig) | 最高管理 |
| **AgentRegistry** | ADMIN_ROLE | admin (multisig) | setQuota / batchSetQuota / revokeAgent |
| **AgentRegistry** | NFT_CONTRACT_ROLE | ComputePass 合约地址 | 调用 deductQuota |
| **AgentRegistry** | NFT_CONTRACT_ROLE | SolarPass 合约地址 | 调用 deductQuota |
| **ComputePass** | ADMIN_ROLE | admin (multisig) | 管理配置 |
| **ComputePass** | AGENT_MINTER_ROLE | 各 Agent 地址 | 铸造 NFT |
| **SolarPass** | ADMIN_ROLE | admin (multisig) | 管理配置 |
| **SolarPass** | AGENT_MINTER_ROLE | 各 Agent 地址 | 铸造 NFT |

> ⚠ **重要**: Agent 同时需要两个权限才能铸造:
> 1. NFT 合约上的 `AGENT_MINTER_ROLE`（调用 agentMint 的门槛）
> 2. AgentRegistry 中的 `quota > 0`（配额检查）

---

## 8. 安全设计

### 8.1 双重检查机制

```
agentMint() 被调用时:
  ├── 检查 1: NFT 合约 — onlyRole(AGENT_MINTER_ROLE)       → 你是代理吗？
  ├── 检查 2: NFT 合约 — totalSupply() + total <= MAX_SUPPLY → 全局总量够吗？
  ├── 检查 3: NFT 合约 — reservedMinted + total <= RESERVED  → reserved 额度够吗？
  ├── 检查 4: AgentRegistry — amount <= remaining            → 你个人额度够吗？ ★新增
  └── 全部通过 → 扣减额度 + 铸造 + 收款
```

### 8.2 向后兼容

```
if (address(agentRegistry) != address(0)) {
    agentRegistry.deductQuota(msg.sender, total);
}
```

- 如果 `agentRegistry` 未设置（= address(0)），行为与当前完全相同
- 升级时先部署 AgentRegistry → 设置配额 → 再调 `setAgentRegistry()`
- **零停机升级**

### 8.3 记账不可篡改

- `agentMinted` 只增不减（没有 resetMinted 函数）
- `setQuota` 要求 `quota >= agentMinted`（不能把配额设到已使用量以下）
- 即使 `revokeAgent` 也只是把 quota 设为 0，历史 minted 记录保留

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

        // 1. 部署 AgentRegistry
        AgentRegistry registry = new AgentRegistry(admin);
        console.log("AgentRegistry deployed at:", address(registry));

        // 2. 注册 NFT 合约（授予 NFT_CONTRACT_ROLE）
        registry.registerNFTContract(computePass);
        registry.registerNFTContract(solarPass);
        console.log("Registered ComputePass and SolarPass");

        // 3. 设置初始 Agent 配额（示例）
        // registry.setQuota(agent_A, computePass, 10);
        // registry.setQuota(agent_A, solarPass, 20);

        vm.stopBroadcast();

        // 4. 后续需要在 ComputePass/SolarPass 上调用:
        //    computePass.setAgentRegistry(address(registry));
        //    solarPass.setAgentRegistry(address(registry));
        console.log("NEXT STEP: Call setAgentRegistry() on NFT contracts");
    }
}
```

### 9.2 部署步骤（按顺序）

| 步骤 | 操作 | 谁执行 |
|------|------|---------|
| 1 | 部署 AgentRegistry | deployer |
| 2 | `registry.registerNFTContract(computePass)` | admin |
| 3 | `registry.registerNFTContract(solarPass)` | admin |
| 4 | 升级 ComputePass 实现合约（加 agentRegistry slot + 改 agentMint） | admin (UUPS upgrade) |
| 5 | 升级 SolarPass 实现合约（同上） | admin (UUPS upgrade) |
| 6 | `computePass.setAgentRegistry(address(registry))` | admin |
| 7 | `solarPass.setAgentRegistry(address(registry))` | admin |
| 8 | `registry.setQuota(agent_A, computePass, 10)` | admin |
| 9 | `computePass.grantAgentRole(agent_A)` | admin |
| 10 | **完成** — Agent_A 可以开始铸造 | — |

---

## 10. Foundry 测试清单

### 10.1 AgentRegistry.t.sol

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

### 10.2 集成测试 (ComputePass + AgentRegistry)

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
      TreePass.sol                (不改)
      SeedPass.sol                (不改)
    registry/
      AgentRegistry.sol           ★ 新增
    interfaces/
      IAgentRegistry.sol          ★ 新增
  script/
    ComputePass.s.sol             (不改)
    SolarPass.s.sol               (不改)
    TreePass.s.sol                (不改)
    SeedPass.s.sol                (不改)
    AgentRegistry.s.sol           ★ 新增
  test/
    ComputePass.t.sol             (改动: 加集成测试)
    SolarPass.t.sol               (改动: 加集成测试)
    TreePass.t.sol                (不改)
    SeedPass.t.sol                (不改)
    AgentRegistry.t.sol           ★ 新增
```

新增文件: **3 个**（1 合约 + 1 接口 + 1 部署脚本 + 1 测试）
改动文件: **4 个**（ComputePass.sol, SolarPass.sol, 及其测试）

---

## 12. 实施优先级

| 阶段 | 交付物 | 预估工作量 | 依赖 |
|------|--------|-----------|------|
| **P0 — AgentRegistry** | AgentRegistry.sol + IAgentRegistry.sol + 测试 | 1-2 天 | 无 |
| **P0.5 — 集成改造** | ComputePass / SolarPass 加 registry 调用 | 0.5 天 | P0 |
| **P1 — 部署脚本** | AgentRegistry.s.sol + 升级脚本 | 0.5 天 | P0.5 |
| **P2 — 集成测试** | 端到端测试: Agent 注册 → 铸造 → 额度扣减 | 1 天 | P1 |
| **P3 — 审计** | 安全审计（重点: 权限、额度扣减不可逆性） | 外包 / 1 周 | P2 |

**总估算: 3-4 天开发 + 测试，不含审计。**

---

## 附录 A: Certification vs 机构NFT vs NFT 本身

| 维度 | Certification | 机构NFT (额度系统) | NFT 本身 |
|------|--------------|-------------------|---------|
| 本质 | 代理资格证明 | 带精细记账的配额管理 | 链上 ERC721A Token |
| 链上表现 | `agentQuota[agent][nft] > 0` | `agentMinted[agent][nft]` 实时追踪 | `ownerOf(tokenId) = buyer` |
| 谁持有 | Agent | Agent (配额数据) | 买家 |
| 可转让吗 | 否（Admin 授权） | 否（链上记录） | 是（ERC721 transfer） |
| 有价格吗 | 无（资格凭证） | 无（记账工具） | 有（$499/$199 等） |
| 消耗性 | 否 | 是（用了就扣） | 否（铸造后永久） |

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
