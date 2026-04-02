# pGVT / sGVT 架构方案 — V3 合规闭环版

> **文档版本**: v3.0  
> **日期**: 2026-03-10  
> **适用仓库**: `tokencontracts-main`  
> **前置文档**: `DESIGN.md` Section E.5 (preGVT / sGVT / GVT 叙事一致性)  
> **链上参考**: VPreGVT V3 `0xD41D6CE...640` (BSC, Dec 22 2025)  
> **已部署生产合约**: pGVT `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` / sGVT `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3`

---

## 0. 决策记录

| # | 决策项 | V2 结论 | V3 结论 | 理由 |
|---|--------|---------|---------|------|
| D1 | pGVT→GVT 转换路径 | ~~admin TGE 批量换发~~ | **用户自助 `convertToGVT()`** | burn pGVT → Migrator mint GVT，用户自决时机，无需 snapshot |
| D2 | sGVT 模式 | S3: 注册制机构凭证 ERC20 | **不变** — 注册制 + 价格锚定 @ $0.5 | 机构会计凭证，registry-gated |
| D3 | pGVT 额度设计 | ~~三层 Cap (stage/global/ceiling=250M)~~ | **单一 MAX_SUPPLY = 100M** | 简化安全模型，100M 更贴合实际预售规模 |
| D4 | 合规层 | ~~无~~ | **Vesting + Staking 追踪 + sealVesting** | 锁定期合规、防投机抛售、TGE 前有序释放 |
| D5 | 预售模式 | ~~外部 Presale.sol 独立合约~~ | **内建 `buy()` + 可选外部 pSale** | V3 自带 USDT 购买流程，pSale 提供 Merkle 白名单/代理销售等高级功能 |
| D6 | 权限模型 | 4 个角色 | **7 个角色** | 细粒度权限分离（vesting/价格/国库/staking 独立管控） |

---

## 0.5 Token 产品线演进总览

> **本节覆盖 pGVT / sGVT / GVT 三条 Token 产品线的演进历史。**
>
> Token 部署运维 → [AGV-RUN.md](AGV-RUN.md)；NFT Pass × 4 + AgentRegistry → [AGV-NFT-AgentRegistry.md](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md)。

### 三条 Token 产品线

AGV 生态在 BSC 上发行了 **3 条 Token 产品线**：

```
产品线 A — 预售凭证（最终通过 TGE 转为 GVT 主令牌）
────────────────────────────────────────────────
PreGVT V1 ──► PreGVT V2 ──► VPreGVT V3 ──► pGVT V3 (生产)
 2025-11-16    2025-11-29     2025-12-22      2026-03-10
   │              │               │               │
   │  bugfix:     │  新增: 三层    │  合规重写:     │  最终生产版:
   │  无DEX保护    │  Cap+黑名单    │  7角色+Vesting  │  100M MAX_SUPPLY
   │  无黑名单     │  +Staking      │  +内建buy()     │  3M已铸造
   │              │               │               │
   └──弃用──────►└──弃用──────►└──参考架构─────►└──✅ BSC主网

产品线 B — 机构凭证（注册制，不可兑换 GVT）
────────────────────────────────────────────
ShadowGVT V1 ──► sGVT V2 ──► sGVT (生产)
 2025-11-30       2026-01-11    2026-03-10
   │                │              │
   │  首版"展示币"    │  注册制重写    │  最终生产版:
   │  仅价格锚       │  +白名单      │  100M MAX_SUPPLY
   │               │  +eligibility  │  30M已铸造
   │               │               │
   └──弃用────────►└──弃用────────►└──✅ BSC主网

产品线 C — 主令牌（TGE 时部署）
──────────────────────────────
GVT → 总量 1B，pGVT 1:1 burn→mint 转入（上限 100M）
      ⏳ 待 TGE 部署

附属资产（仅 Token 相关）
──────────────────────────────
GenesisBadge1155  (2025-11-29)  → 空投徽章 ERC1155，cap 2000，pGVT claim 前置步骤

NFT 相关资产（NFT Pass ×4 / InstitutionalNFT / AgentRegistry）
→ 见 AGV-NFT-AgentRegistry.md
```

### 每次迭代的触发原因

| 迭代 | 触发事件 | 解决了什么 |
|------|---------|-----------|
| PreGVT V1→V2 | V1 无 DEX 保护，上线后可被任意套利 | 新增 blacklist + DEX 路由保护 |
| PreGVT V2→VPreGVT V3 | V2 三层 Cap（250M）过于复杂，权限模型粗糙 | 合规重写：单一 100M Cap + 7 角色 + Vesting + 内建预售 |
| VPreGVT V3→pGVT (生产) | V3 为参考架构，需正式部署到主网 | 正式 AirdropMint 部署 + LP 创建 + 上币申请 |
| ShadowGVT V1→sGVT V2 | V1 仅做展示，无白名单，无法控制流通 | 注册制 mint/burn + eligibleAddress 白名单 + LP 集成 |
| sGVT V2→sGVT (生产) | V2 为参考架构，同上 | 正式主网部署 |

### 跨产品线逻辑依赖

```
GenesisBadge1155 (空投徽章)
     │
     │ claim 5步流程 (buy-page)
     ▼
pGVT allocation (预售凭证分配)
     │
     │ buy() / 直接 transfer
     ▼
pGVT 持有 ←── 预售 (pSale) / 空投 (BatchAirdrop)
     │
     │ TGE 时: convertToGVT() — burn pGVT + Migrator mint GVT
     ▼
GVT 持有 (主令牌) ←── BondingCurve / Staking 等其他铸造路径
     │
     └── pGVT 最多贡献 100M / GVT 总量 1B = 10%

sGVT (机构凭证, 独立体系)
     │
     │ 注册制 mint → 白名单转账 → LP 交易
     │ 不可兑换 GVT，价格锚 $0.50
     │
     └── 机构会计凭证 / 投票权 / 生态权益

# NFT Pass × 4 → 见 AGV-NFT-AgentRegistry.md（独立体系，与 Token 无链上依赖）
```

### 当前状态快照（2026-03-15）

| 资产 | 类型 | 地址 | 供应量 | 状态 |
|------|------|------|--------|------|
| **pGVT** | ERC20 | `0x8F9E...f9` | 3M/100M | ✅ 生产，CoinGecko 被拒→已修复→等 Arb+MM 后重审 |
| **sGVT** | ERC20 | `0x53e5...a3` | 30M/100M | ✅ 生产，CoinGecko 被拒→等 volume 增量 |
| **GVT** | ERC20 | *(待部署)* | 0/1B | ⏳ TGE 时部署 |
| **GenesisBadge** | ERC1155 | `0x704f...29` | 已 mint / 2000 | ✅ 已部署（pGVT claim 前置） |

> NFT Pass × 4 + InstitutionalNFT + AgentRegistry v2 的状态表 → [AGV-NFT-AgentRegistry.md §0.2](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md)

---

## 1. Token 身份卡

### 1.1 pGVT（V3 合规闭环架构）

| 属性 | 值 |
|------|-----|
| Name / Symbol | `pGVT` / `pGVT` |
| Decimals | 18 |
| Solidity | `^0.8.25` |
| 继承 | ERC20 + AccessControl + ReentrancyGuard |
| Supply Model | 按需 mint，**MAX_SUPPLY = 100,000,000 (100M)** |
| 链上已发行 | 3,000,000 (3M)（通过 AirdropMint 脚本部署初始供应） |
| 已空投 | 730,000 pGVT（12 名接收者，BatchAirdrop 脚本） |
| LP 注入 | 10,000 pGVT + 50 USDT（PancakeSwap V2，目标价 $0.005） |
| 剩余库存 | ~2,260,000 pGVT（deployer 钱包，后续预售/空投用） |
| 预售 | 内建 `buy()` — USDT 付款，资金直达 treasury |
| 价格 | 基础 0.005 USDT/pGVT，支持 `stagePrices[]` 多阶段定价 |
| Vesting | 全局 + 个人双层 — `sealVesting()` 永久锁定不可修改 |
| Staking 追踪 | `_update()` 内置白名单 staking 合约检测，自动记账 |
| 转换方式 | `convertToGVT(amount)` — burn pGVT + Migrator mint GVT，**用户自助** |
| V2→V3 迁移 | `initializeFromMigration()` — SYSTEM_ROLE 调用，带 vesting |
| TGE 后状态 | 所有 pGVT 通过 convertToGVT 销毁，合约归零 |

### 1.2 sGVT（V2 机构凭证架构，无变化）

| 属性 | 值 |
|------|-----|
| Name / Symbol | `sGVT` / `sGVT` |
| Decimals | 18 |
| Solidity | `^0.8.20` |
| 继承 | ERC20 + ERC20Pausable + AccessControl |
| Supply Model | **注册制 mint/burn**（MINTER_ROLE / BURNER_ROLE），**maxSupply = 100,000,000 (100M) immutable** |
| 链上已发行 | 30,000,000 (30M)（通过 AirdropMint 脚本部署初始供应） |
| 已空投 | 21,130,000 sGVT（12 名接收者，BatchAirdrop 脚本） |
| LP 注入 | 100 sGVT + 50 USDT（PancakeSwap V2，目标价 $0.50） |
| 剩余库存 | ~8,870,000 sGVT（deployer 钱包，后续机构分配用） |
| 转账控制 | `eligibleAddress` 白名单 — 收款方必须预先注册 |
| 价格锚定 | `PRICE_USD = 0.5e18`，DEX LP 做价格展示 |
| 最终化 | `finalize()` — 永久锁定转账策略（仅 operator ↔ LP 通道） |
| 与 GVT 关系 | **完全独立**，无链上兑换，不占用 GVT 1B cap |

---

## 2. 与现有 GVT Cap 的关系

```
GVT MAX_SUPPLY = 1,000,000,000 (1B)
│
├── [via VestingVault / setAllocation]
│   ├── Team & Advisors:  150M (15%)  — 6mo cliff, 36mo vesting
│   ├── Ecosystem:        200M (20%)  — DAO-gated, up to 48mo
│   └── DAO Treasury:     250M (25%)  — DAOController 管控
│
├── [via pGVT.convertToGVT() → Migrator → GVT.mint()]
│   ├── Seed Round:       ~50M        ← pGVT 预售购买
│   └── Public Sale:      ~50M        ← pGVT 预售购买
│   └── (pGVT MAX_SUPPLY = 100M，用户自助转换，按 vesting 释放)
│
└── [via BondingCurve → GVT.mint()]
    └── Staking/Convert:  150M (15%)  — rGGP→GVT 转换

sGVT: 不在此 cap 体系内（独立 ERC20，注册制 mint，不触发 GVT.mint()）
```

**安全验证链路**（V3）：

1. `pGVT.buy()` / `pGVT.mint()` → `totalMinted + amount <= MAX_SUPPLY` (100M)
2. 用户调 `convertToGVT(amount)` → 检查 `transferableBalance` (vesting + staking 感知)
3. `_burn(msg.sender, amount)` → `migrator.migrateToGVT(user, amount)` → `GVT.mint()`
4. `GVT.mint()` 内部检查 `totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY`
5. → 双重保护：pGVT 100M cap + GVT 1B cap，即使 Migrator 有 bug 也会 revert

---

## 3. 合约详细设计

### 3.1 pGVT.sol（V3 合规闭环）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMigrator {
    function migrateToGVT(address user, uint256 amount) external;
}

interface IStakingContract {
    function getStakeEndTime(address user) external view returns (uint256);
}

/**
 * @title pGVT
 * @notice Compliance-layer presale voucher with vesting, staking tracking, and GVT conversion
 * @dev V3-aligned architecture:
 *   - Built-in presale: buy() with USDT payment token
 *   - Vesting: global + per-user schedules, sealVesting() permanently immutable
 *   - Staking tracking: whitelisted staking contracts, balance tracking in _update
 *   - Migration: initializeFromMigration() from V2→V3 bridge
 *   - Conversion: convertToGVT() burns pGVT and calls migrator
 *
 * Lifecycle:
 *   Deploy → configure presale → buy/mint → vesting lockup → convertToGVT at TGE
 */
contract pGVT is ERC20, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;  // 100M

    // --- 7 Roles (including DEFAULT_ADMIN_ROLE) ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VESTING_CONFIG_ROLE = keccak256("VESTING_CONFIG_ROLE");
    bytes32 public constant PRICE_MANAGER_ROLE = keccak256("PRICE_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant STAKING_MANAGER_ROLE = keccak256("STAKING_MANAGER_ROLE");
    bytes32 public constant SYSTEM_ROLE = keccak256("SYSTEM_ROLE");

    // --- Vesting ---
    struct VestingSchedule {
        uint64 start; uint64 cliff; uint64 duration;
        uint256 total; uint256 claimed; bool immutable_;
    }
    mapping(address => VestingSchedule) public vestingSchedules;
    VestingSchedule public globalVesting;
    bool public vestingSealed;       // sealVesting() → 永久不可修改
    bool public globalVestingEnabled;

    // --- Presale (built-in) ---
    IERC20 public paymentToken;      // USDT
    address public treasury;
    uint256 public pricePerToken;    // 基础价格
    uint256[] public stagePrices;    // 多阶段定价
    uint256[] public stageCaps;      // 各阶段累积上限
    bool public presaleActive;
    uint256 public presaleSupplyCap;
    uint256 public presaleSold;
    uint256 public perUserPurchaseLimit;
    uint256 public totalMinted;

    // --- GVT Conversion ---
    IERC20 public gvtToken;
    IMigrator public migrator;
    address public migrationSource;  // V2→V3 bridge 合约

    // --- Staking Tracking ---
    bool public stakingEnabled;
    mapping(address => bool) public whitelistedStakingContracts;
    mapping(address => uint256) public stakedBalances;

    constructor(address admin) ERC20("pGVT", "pGVT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(VESTING_CONFIG_ROLE, admin);
        _grantRole(PRICE_MANAGER_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        _grantRole(STAKING_MANAGER_ROLE, admin);
        _grantRole(SYSTEM_ROLE, admin);
    }

    // ---------- Presale ----------
    function buy(uint256 amount) external nonReentrant { /* USDT → treasury, mint pGVT, apply vesting */ }
    function calculateCost(uint256 amount) public view returns (uint256) { /* amount * pricePerToken / 1e18 */ }
    function getCurrentStage() public view returns (uint256) { /* stageCaps[] 匹配 presaleSold */ }

    // ---------- Minting ----------
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) { /* totalMinted + amount <= MAX_SUPPLY */ }
    function initializeFromMigration(address user, uint256 amount) external onlyRole(SYSTEM_ROLE) { /* V2→V3 bridge */ }

    // ---------- Vesting ----------
    function setGlobalVesting(uint64 start, uint64 cliff, uint64 duration) external onlyRole(VESTING_CONFIG_ROLE) { }
    function setVestingSchedule(address user, ...) external onlyRole(VESTING_CONFIG_ROLE) { }
    function sealVesting() external onlyRole(DEFAULT_ADMIN_ROLE) { /* 永久不可逆 */ }
    function vestedAmount(address user) public view returns (uint256) { /* 线性释放计算 */ }
    function transferableBalance(address user) public view returns (uint256) { /* unlocked - staked */ }

    // ---------- GVT Conversion ----------
    function convertToGVT(uint256 amount) external nonReentrant {
        // 检查 transferableBalance → burn pGVT → migrator.migrateToGVT(user, amount)
    }

    // ---------- Staking ----------
    function _update(address from, address to, uint256 value) internal override {
        // mint/burn: 无限制
        // → whitelisted staking: 检查 stakeEnd >= vestingEnd, 记 stakedBalances
        // ← whitelisted staking (unstake): 减 stakedBalances
        // 普通转账: 检查 transferableBalance
    }
}
```

#### pGVT 核心流程图

```
用户 USDT                                 Migrator 合约
   │                                          │
   ▼                                          │
buy(amount)                                   │
   │ USDT → treasury                          │
   │ mint pGVT → user                         │
   │ apply globalVesting                       │
   ▼                                          │
 [vesting 锁定期]                              │
   │ cliff 后线性释放                          │
   ▼                                          │
convertToGVT(amount)                          │
   │ check transferableBalance                │
   │ _burn(user, amount)  ──────────────────► migrateToGVT(user, amount)
   │                                          │ → GVT.mint(user, amount)
   ▼                                          ▼
 pGVT 销毁                               GVT 铸造到用户
```

### 3.2 pSale.sol（可选外部预售合约）

> V3 pGVT 已内建 `buy()` 流程。pSale 提供更高级的预售管理功能，两者可共存。

| 特性 | pGVT 内建 `buy()` | pSale 外部合约 |
|------|-------------------|---------------|
| 基础购买 | ✅ | ✅ |
| Merkle 白名单 | ❌ | ✅ |
| 代理销售 (recipient ≠ msg.sender) | ❌ | ✅ |
| 多阶段独立时间窗 | 简化版 (stagePrices/stageCaps) | ✅ (startTime/endTime) |
| 每阶段独立额度 | ❌ | ✅ |
| Pausable | ❌ | ✅ |

pSale 通过 `pGVT.MINTER_ROLE` 调用 `pGVT.mint()`，不绕过 MAX_SUPPLY 检查。

### 3.3 sGVT.sol（注册制机构凭证，无变化）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title sGVT
 * @notice ERC-20 institutional accounting certificate with registry-gated transfers
 * @dev Features:
 * - IsGVTRegistry compliance: eligibleAddress whitelist
 * - mint/burn with investorId tracking (MINTER_ROLE / BURNER_ROLE)
 * - PRICE_USD = 0.5e18 static anchor
 * - finalize() permanently locks transfer policy (operator ↔ LP only)
 * - Pausable emergency mechanism
 * - PancakeSwap V2/V3 compatible
 */
contract sGVT is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant PRICE_USD = 0.5e18;
    address public immutable registry;       // IsGVTRegistry compliance
    address public immutable quoteAsset;     // USDT
    uint8 public immutable pancakeSwapVersion;

    mapping(address => bool) public eligibleAddress;  // 转账白名单
    address public lpPair;
    address public router;
    address public treasury;
    bool public finalized;  // 永久锁定转账策略

    constructor(address admin, address registry_, address quoteAsset_, uint8 pancakeVersion)
        ERC20("sGVT", "sGVT") { /* ... */ }

    function mint(address to, uint256 amount, string calldata investorId) external onlyRole(MINTER_ROLE) { }
    function burn(address from, uint256 amount, string calldata investorId) external onlyRole(BURNER_ROLE) { }
    function finalize() external onlyRole(DEFAULT_ADMIN_ROLE) { /* 永久不可逆 */ }
}
```

---

## 4. 部署脚本

### 4.1 DeploypSale.s.sol（一键部署 pGVT + pSale + sGVT）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../contracts/tokens/pGVT.sol";
import "../contracts/tokens/sGVT.sol";
import "../contracts/presale/pSale.sol";

/**
 * @title DeploypSale
 * @notice Deploys pGVT + pSale + sGVT in one transaction sequence
 * @dev Required .env: PRIVATE_KEY, TREASURY_ADDRESS, USDT_ADDRESS
 */
contract DeploypSale is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envOr("ADMIN_ADDRESS", vm.addr(deployerKey));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy pGVT (V3: MAX_SUPPLY=100M, 7 roles to admin)
        pGVT pgvt = new pGVT(admin);

        // 2. Deploy pSale (外部预售，支持 Merkle 白名单/代理销售)
        pSale presale = new pSale(address(pgvt), usdt, treasury, admin);

        // 3. Grant MINTER_ROLE to pSale
        pgvt.grantRole(pgvt.MINTER_ROLE(), address(presale));

        // 4. Configure pSale Stage 1: 0.005 USDT/pGVT, 5M cap, 90 days
        presale.configureStage(1, 5_000, 5_000_000 * 10**18,
            block.timestamp, block.timestamp + 90 days, 500_000 * 10**18, false, bytes32(0));
        presale.setCurrentStage(1);

        // 5. Configure pGVT built-in presale
        pgvt.setPaymentToken(usdt);
        pgvt.setTreasury(treasury);
        pgvt.setPresaleConfig(5_000_000_000_000_000, 10_000_000 * 10**18, 0); // 0.005 USDT, 10M cap
        // pgvt.setPresaleActive(true);  ← 按需开启

        // 6. Deploy sGVT (registry-gated, USDT, PancakeSwap V2)
        sGVT sgvt = new sGVT(admin, admin, usdt, 2);
        sgvt.grantRole(sgvt.MINTER_ROLE(), admin);
        sgvt.mint(treasury, 22_000_000 * 10**18, "initial-treasury");

        vm.stopBroadcast();
    }
}
```

### 4.2 pGVTMigration.s.sol（TGE 转换设置）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title pGVTMigration
 * @notice V3 TGE setup: deploy Migrator → connect to pGVT + GVT
 *
 * V3 migration = SELF-SERVICE:
 *   1. Admin deploy Migrator (implements IMigrator)
 *   2. Admin grant GVT MINTER_ROLE to Migrator
 *   3. Admin set gvtToken + migrator on pGVT
 *   4. Each user calls pGVT.convertToGVT(amount) — burns pGVT, Migrator mints GVT
 *
 * Required .env: PRIVATE_KEY, GVT_ADDRESS, PGVT_ADDRESS, MIGRATOR_ADDRESS
 */
contract pGVTMigration is Script {
    function run() external {
        // Step 1: Grant GVT MINTER_ROLE to Migrator
        gvt.grantRole(gvt.MINTER_ROLE(), migratorAddress);
        // Step 2: Connect pGVT to GVT + Migrator
        pgvt.setGvtToken(gvtAddress);
        pgvt.setMigrator(migratorAddress);
        // Step 3: Users self-service via convertToGVT()
    }
}
```

---

## 5. 权限矩阵（V3 — 7 角色）

### 5.1 pGVT 权限

| Role | 授予目标 | 职责 | 生命周期 |
|------|---------|------|---------|
| `DEFAULT_ADMIN_ROLE` | multisig | 角色管理、setGvtToken、setMigrator、sealVesting | 永久 |
| `MINTER_ROLE` | admin + pSale 合约 | `mint()` 铸造 | 预售期间 |
| `VESTING_CONFIG_ROLE` | admin (multisig) | setGlobalVesting、setVestingSchedule、makeVestingImmutable | 至 sealVesting |
| `PRICE_MANAGER_ROLE` | admin | setPresaleConfig、setPriceStages、setPresaleActive | 预售期间 |
| `TREASURY_ROLE` | admin (multisig) | setTreasury、withdrawFunds | 永久 |
| `STAKING_MANAGER_ROLE` | admin | whitelistStakingContract、setStakingEnabled | 永久 |
| `SYSTEM_ROLE` | V2→V3 bridge 合约 | initializeFromMigration | 迁移完成后 revoke |

### 5.2 sGVT 权限

| Role | 授予目标 | 职责 | 生命周期 |
|------|---------|------|---------|
| `DEFAULT_ADMIN_ROLE` | multisig | 角色管理、finalize | 永久 |
| `MINTER_ROLE` | registry 合约 | mint with investorId | 至 finalize |
| `BURNER_ROLE` | registry 合约 | burn with investorId | 至 finalize |
| `OPERATOR_ROLE` | admin | setLpPair、setRouter、recordSwap | 永久 |
| `PAUSER_ROLE` | multisig | 紧急暂停 | 永久 |

### 5.3 GVT Migrator 权限

| Role | 授予目标 | 职责 | 生命周期 |
|------|---------|------|---------|
| GVT `MINTER_ROLE` | Migrator 合约 | 在 convertToGVT 调用时 mint GVT | **TGE 期间**，可选 revoke |

> ⚠ **安全重点**: Migrator 合约是 pGVT↔GVT 的唯一桥梁。部署后应通过多签审批。  
> 与 V2 不同，V3 **不需要临时授权 EOA 做 MINTER_ROLE** — Migrator 合约是长期存在的受控桥梁。

---

## 6. Foundry 测试清单

> 当前状态：**264 个测试全部通过**（tokencontracts-main 全量）

### 6.1 pGVT.t.sol（49 tests）

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testDeployment` — 初始状态、7 角色授予 | 基础 |
| 2 | `testMint` / `testMintExceedsMaxSupply` | 核心 + 边界 |
| 3 | `testBuy` / `testBuyNotActive` / `testBuyExceedsCap` / `testBuyExceedsUserLimit` | 内建预售 |
| 4 | `testSetGlobalVesting` / `testSealVesting` / `testSealVestingPreventsFurtherChanges` | Vesting 核心 |
| 5 | `testVestedAmount*` — before cliff / during / after / no schedule | Vesting 计算 |
| 6 | `testTransferableBalance*` — with vesting + staking | 复合余额 |
| 7 | `testTransferBlockedByVesting` / `testTransferAllowedAfterVesting` | 转账门控 |
| 8 | `testConvertToGVT*` — success / exceeds transferable / no migrator | GVT 转换 |
| 9 | `testStakingTracking` / `testStakeViolatesVesting` | Staking 追踪 |
| 10 | `testInitializeFromMigration` / `testMigrationWithVesting` | V2→V3 bridge |
| 11 | `testPriceStages` / `testConfigurePresale` | 多阶段定价 |
| 12 | `testMakeVestingImmutable` | 个人 vesting 锁定 |
| 13 | `testFuzz_*` — mint boundary / buy amounts / vesting timing | Fuzz |

### 6.2 pSale.t.sol（16 tests）

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testBuyMintsCorrectAmount` / `testFuzz_BuyPriceCalculation` | 核心 + Fuzz |
| 2 | `testBuyOnBehalfOfRecipient` | 代理销售 |
| 3 | `testWhitelistVerification` / `testBuyRevertsOutsideStageTime` | 安全 + 边界 |
| 4 | `testPerAddressLimitEnforced` | 额度限制 |
| 5 | `testUSDTTransferredToTreasury` | 资金流向 |
| 6 | `testBuyRevertsWhenStageSoldOut` | 边界 |

### 6.3 sGVT.t.sol（48 tests）

完整覆盖 eligibility、mint/burn with investorId、finalize、pause、LP pair 交互。

### 6.4 pGVTMigration.t.sol（7 tests）

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testConvertToGVTMintCorrectAmount` | 核心 |
| 2 | `testConvertToGVTBurnspGVT` | 核心 |
| 3 | `testConvertRespectsVesting` | 安全 |
| 4 | `testConvertRevertsIfNoMigrator` | 边界 |
| 5 | `testFuzz_ConvertAmount` | Fuzz |

---

## 7. 文件结构

```
tokencontracts-main/
  contracts/
    core/
      BondingCurve.sol            (不改)
      PowerToMint.sol             (不改)
    governance/
      DAOController.sol           (不改)
    tokens/
      GVT.sol                     (不改)
      rGGP.sol                    (不改)
      pGVT.sol                    ★ V3 重写 — vesting + staking + convertToGVT
      sGVT.sol                    ★ V2 对齐 — 注册制机构凭证
    presale/
      pSale.sol                   ★ 外部预售（Merkle 白名单 + 代理销售）
    utils/
      VestingVault.sol            (不改)
    interfaces/
      IrGGP.sol                   (不改)
    _archive/                     ★ 链上验证源码存档
      PreGVT_V1_AllInOne.sol        V1 (0x21cCA..., Nov 16 2025)
      PreGVT_V2_AllInOne.sol        V2 (0xa9e59e..., Nov 29 2025)
      VPreGVT_V3_Verified.sol       V3 (0xD41D6CE..., Dec 22 2025)
      ShadowGVT_V1.sol              ShadowGVT V1 (0xd175D0..., Nov 30 2025)
      sGVT_V2.sol                   sGVT V2 (0xA9765C..., Jan 11 2026)
  script/
    Deploy.s.sol                  (不改)
    DeployMainnet.s.sol           (不改)
    DeployTestnet.s.sol           (不改)
    DeploypSale.s.sol             ★ pGVT + pSale + sGVT 一键部署
    pGVTMigration.s.sol           ★ V3 TGE 转换设置
    AirdropMint.s.sol             ★ 生产部署脚本 — pGVT(3M) + sGVT(30M) 一键部署
    BatchAirdrop.s.sol            ★ JSON 驱动批量空投（12 接收者）
    BatchAirdrop.json             ★ 空投名单（name/pgvt/sgvt/wallet）
    AddLiquidity.s.sol            ★ PancakeSwap V2 LP 创建
  assets/
    icons/
      pGVT.png                    ★ 原始 logo (1536×1024)
      sGVT.png                    ★ 原始 logo (1536×1024)
      pGVT_256.png                ★ 256×256 (CoinGecko 上传用)
      sGVT_256.png                ★ 256×256
      pGVT_64.png                 ★ 64×64
      sGVT_64.png                 ★ 64×64
      pGVT_32.svg                 ★ 32×32 SVG (BscScan Token Info)
      sGVT_32.svg                 ★ 32×32 SVG
  test/
    pGVT.t.sol                    ★ 49 tests
    sGVT.t.sol                    ★ 48 tests
    pSale.t.sol                   ★ 16 tests
    pGVTMigration.t.sol           ★ 7 tests
    GVT.t.sol                     (不改)
    ...
```

---

## 8. V2→V3 演进对照

| 维度 | V2 (旧) | V3 (新) | 改进理由 |
|------|---------|---------|---------|
| **总量** | ABSOLUTE_CEILING = 250M | MAX_SUPPLY = 100M | 100M 更贴合实际预售规模 |
| **Cap 结构** | 三层 (stage/global/ceiling) | 单一 MAX_SUPPLY | 简化安全模型，减少攻击面 |
| **转换方式** | admin 批量 TGE 换发 | `convertToGVT()` 用户自助 | 去中心化，零 admin 介入 |
| **预售** | 外部 Presale.sol | 内建 `buy()` + 可选 pSale | 减少合约间调用开销 |
| **合规** | 无 (Pausable + Burnable) | Vesting + Staking 追踪 + Seal | TGE 前合规锁定、防投机 |
| **权限** | 4 角色 | 7 角色 | 细粒度分权 (vesting/价格/国库 分离) |
| **Solidity** | ^0.8.20 | ^0.8.25 | 支持更多语言特性 |
| **继承** | ERC20 + Burnable + Pausable | ERC20 + AccessControl + ReentrancyGuard | 移除不需要的 Burnable/Pausable，加入 SafeERC20 |

---

## 9. 链上部署谱系（12 个 Token 合约）

> NFT 合约（SeedPass / TreePass / SolarPass / ComputePass / InstitutionalNFT / AgentRegistry）的部署谱系见 [AGV-NFT-AgentRegistry.md](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md) §0.2。
>
> 各版本为何迭代、逻辑关系见 §0.5 全资产演进总览。

### 9.1 预售凭证线（PreGVT → pGVT）

| # | 合约 | 地址 | 部署时间 | 为何迭代 |
|---|------|------|---------|---------|
| 1 | PreGVT V1 | `0x21cCA...` | Nov 16 2025 | 最早版本，无 DEX 保护/黑名单 |
| 2 | PreGVT V2 | `0xa9e59e...` | Nov 29 18:03 | V1 可被任意套利 → 新增 blacklist + DEX 保护 |
| 3 | PreGVTStaking V2 | `0x63CB61...` | Nov 29 18:30 | V2 配套 staking |
| 4 | VPreGVT V3 | `0xD41D6CE...640` | Dec 22 11:50 | V2 权限粗糙+250M Cap→合规重写：单一 100M Cap + 7 角色 + Vesting + 内建 buy() |
| 5 | PreGVTStaking V3 | `0xBe28C4...` | Dec 22 18:32 | V3 配套 staking |
| 6 | Migration V2→V3 | `0xeA2Be1...` | Dec 23 20:21 | V2→V3 余额迁移桥 |
| 7 | **pGVT (生产)** | **`0x8F9EC8...f9`** | **Mar 10 2026** | **V3 正式主网部署，3M 初始供应** |

### 9.2 机构凭证线（ShadowGVT → sGVT）

| # | 合约 | 地址 | 部署时间 | 为何迭代 |
|---|------|------|---------|---------|
| 8 | ShadowGVT V1 | `0xd175D0...` | Nov 30 10:44 | 首版"展示币"，仅价格锚，无白名单控制 |
| 9 | sGVT V2 | `0xA9765C...` | Jan 11 2026 | V1 无法控制流通 → 注册制 mint/burn + eligibleAddress 白名单 |
| 10 | **sGVT (生产)** | **`0x53e599...a3`** | **Mar 10 2026** | **V2 正式主网部署，30M 初始供应** |

### 9.3 附属资产

| # | 合约 | 地址 | 部署时间 | 说明 |
|---|------|------|---------|------|
| 11 | GenesisBadge1155 | `0x704fA1...` | Nov 29 17:48 | 空投徽章 ERC1155，cap 2000 |
| 12 | AirdropBadge V3 | `0x392c85...` | Dec 22 18:57 | V3 配套空投 badge |

---

## 10. 生产部署状态（2026-03-10 上线）

> **操作指令**（部署命令、cast 命令、运维流程）见 [AGV-RUN.md](AGV-RUN.md)。
> 本节仅记录"现状是什么"，不重复"怎么操作"。

### 10.1 关键地址

| 角色 | 地址 |
|------|------|
| Deployer / Admin | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` |
| pGVT | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` |
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` |
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| PancakeSwap V2 Factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` |
| pGVT-USDT LP Pair | `0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0` |
| sGVT-USDT LP Pair | `0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d` |

### 10.2 供应与流动性状态

| Token | 初始 Mint | 已空投 | LP 注入 | 剩余库存 | 价格 |
|-------|----------|--------|---------|---------|------|
| pGVT | 3,000,000 | 730,000 | 10,000 | ~2,260,000 | $0.005 |
| sGVT | 30,000,000 | 21,130,000 | 100 | ~8,870,000 | $0.50 |

### 10.3 sGVT 白名单状态

| 地址类型 | 如何添加 | 状态 |
|---------|---------|------|
| Admin (deployer) | 构造函数自动 | ✅ |
| 12 名空投接收者 | `batchUpdateEligibility()` | ✅ |
| PancakeSwap Router | `setRouter()` | ✅ |
| sGVT-USDT LP Pair | `setLpPair()` | ✅ |

### 10.4 BscScan 合约验证

| 合约 | 验证状态 | 链接 |
|------|---------|------|
| pGVT | ✅ Verified | [BscScan](https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9) |
| sGVT | ✅ Verified | [BscScan](https://bscscan.com/token/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3) |

### 10.7 上币审核状态（2026-03-15 更新）

| 平台 | pGVT | sGVT | 状态 |
|------|------|------|------|
| BscScan 合约验证 | ✅ Verified | ✅ Verified | 完成 |
| BscScan Token Info | ✅ 已通过 | ✅ 已通过 | logo + 项目信息已显示 |
| GeckoTerminal Token Info | ✅ Regular Pass | ✅ Regular Pass | 已索引 + Token Info 通过 |
| DexScreener | ✅ 自动索引 | ✅ 自动索引 | K 线 + 交易量实时展示 |
| **CoinGecko** | **❌ 被拒** | **❌ 被拒** | 见下方详情 |
| CoinMarketCap | ⏳ 未申请 | ⏳ 未申请 | 待 CoinGecko 重审后评估 |
| MetaMask 价格显示 | ❌ 无价格 | ❌ 无价格 | 依赖 CoinGecko 收录 |
| Trust Wallet | ⏳ 暂缓 | ⏳ 暂缓 | PR #35878 已提交，但 assets repo 收费太贵，暂放 |

### 10.8 CoinGecko 被拒详情与修复

#### pGVT 被拒（Request ID: CL1203260035）

- **拒绝原因**: "suspected security risk in smart contract"
- **根因分析**: GoPlus 等安全扫描工具静态检查标记两项红旗：
  - `mint()` 函数存在 + deployer 持有 `MINTER_ROLE` → "无限增发风险"
  - `SYSTEM_ROLE` / `VESTING_CONFIG_ROLE` / `PRICE_MANAGER_ROLE` / `STAKING_MANAGER_ROLE` → "中心化操控风险"

#### 链上修复（2026-03-13 已执行，7 笔 revokeRole 交易）

**修复 1: 移除"无限增发"红旗**
- 操作: `revokeRole(MINTER_ROLE, deployer)` 永久剥离 deployer 的铸币权
- 验证: `hasRole(MINTER_ROLE, 0xAC38...1Ca5)` = **false**

**修复 2: 移除"中心化操控"红旗**
- 操作: 一举剥离 4 个高危管理权限（共 4 笔 revokeRole tx）
  - `SYSTEM_ROLE` → revoked
  - `VESTING_CONFIG_ROLE` → revoked
  - `PRICE_MANAGER_ROLE` → revoked
  - `STAKING_MANAGER_ROLE` → revoked
- 验证: 链上 `hasRole()` 以上 4 角色全部 = **false**

**修复后仅保留 2 个角色（符合行业规范）**:
- `DEFAULT_ADMIN_ROLE` = true（OpenZeppelin 标准最佳实践）
- `TREASURY_ROLE` = true（RWA 类代币必需的资金路由功能）

**证据链**: 7 笔 revokeRole tx hash 已上链（BscScan 可查），BscScan Read Contract 截图确认

#### sGVT 被拒（Request ID: CL1303260002）

- **拒绝原因**: "lack of organic attention" — liquidity, volume, social media sentiment 不足
- **应对**: 需 MarketMaker 增加交易量/流动性 + KOL 增加社媒热度后重新提交

#### CoinGecko 重新申请时间窗口

- **pGVT**: 14 天冷却期已过，但**暂缓重审**——链上已修复，但无 volume 支撑审核员不会认真看。等 Arb→MM 上线产出交易量后再提交
- **sGVT**: 需先满足 volume / social sentiment 条件，前置 = Arb 实盘盈利 → MM 做量
- **行动计划详见** [AGV-RUN.md §7 下一步战场](AGV-RUN.md)

### 10.6 MetaMask / Trust Wallet 价格显示

```
PancakeSwap LP → GeckoTerminal ✅ → CoinGecko ❌被拒 → MetaMask 无价格
```

- MetaMask `wallet_watchAsset` API（2026-02 后）已确认无法绕过 CoinGecko 依赖
- **唯一路径**: CoinGecko 审核通过 或 Trust Wallet assets repo 独立注册

### 10.7 快捷链接

| 平台 | pGVT | sGVT |
|------|------|------|
| BscScan | [Token 页](https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9) | [Token 页](https://bscscan.com/token/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3) |
| GeckoTerminal | [Pool](https://www.geckoterminal.com/bsc/pools/0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0) | [Pool](https://www.geckoterminal.com/bsc/pools/0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d) |
| DexScreener | [Pool](https://dexscreener.com/bsc/0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0) | [Pool](https://dexscreener.com/bsc/0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d) |
| PancakeSwap | [Swap](https://pancakeswap.finance/swap?outputCurrency=0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9) | [Swap](https://pancakeswap.finance/swap?outputCurrency=0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3) |

---

## 附录 A: 与 DESIGN.md E.5 的一致性映射

| DESIGN.md 定义 | 本方案实现 | 一致性 |
|---------------|-----------|--------|
| "preGVT = 预售凭证/额度记录，**不等同于已铸造的 GVT**" | pGVT.sol 是独立 ERC20，不触发 GVT.mint()（convertToGVT 通过 Migrator 间接 mint） | ✅ |
| "GVT 仅通过 mint() 或 setAllocation()+releaseVested() 产生" | convertToGVT → Migrator.migrateToGVT → GVT.mint()，受 cap 保护 | ✅ |
| "sGVT = 锁仓/权益凭证，**不等同于 GVT**" | sGVT 是注册制机构凭证 ERC20，无链上兑换 | ✅ (注*) |

> *注: DESIGN.md 将 sGVT 描述为"锁仓/权益凭证"，实际定位更准确应为"注册制机构会计凭证/价格锚"。建议更新 DESIGN.md E.5。

---

## 附录 B: 完整操作时间线（2026-03-10 生产部署）

| 序号 | 操作 | 交易/结果 | 备注 |
|------|------|----------|------|
| 1 | AirdropMint 部署 pGVT + sGVT | Block 85667560, 5 txns, 0.000276 BNB | pGVT=3M, sGVT=30M |
| 2 | BscScan 合约验证 | 两个均 Pass - Verified | forge verify-contract |
| 3 | Token 图标制作 | pGVT/sGVT 256px + 64px + 32px SVG | assets/icons/ |
| 4 | BscScan Token Info 提交 | 待审核 | 含签名验证 ownership |
| 5 | sGVT 白名单配置 | batchUpdateEligibility(12 地址) | 空投前必须 |
| 6 | BatchAirdrop 执行 | 12 recipients, all success | 730K pGVT + 21.13M sGVT |
| 7 | PancakeSwap LP 创建 | Factory.createPair + addLiquidity ×2 | pGVT $0.005, sGVT $0.50 |
| 8 | sGVT Router/LP 白名单 | setRouter + setLpPair | DEX 交易必须 |
| 9 | 首笔 Swap 交易 | 1 USDT → pGVT, 1 USDT → sGVT | 触发 DEX 索引 |
| 10 | GeckoTerminal 索引确认 | API 查询返回价格数据 | 两池均已索引 |
| 11 | GeckoTerminal Token Info 提交 | Regular Pass, 待审核 | pGVT + sGVT 各提交一次 |
