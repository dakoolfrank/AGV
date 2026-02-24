# preGVT / sGVT 架构方案 — 可执行版

> **文档版本**: v1.0  
> **日期**: 2026-02-24  
> **适用仓库**: `tokencontracts-main`  
> **前置文档**: `DESIGN.md` Section E.5 (preGVT / sGVT / GVT 叙事一致性)

---

## 0. 决策记录

| # | 决策项 | 结论 | 理由 |
|---|--------|------|------|
| D1 | preGVT→GVT 转换路径 | **Path A: 项目方 TGE 批量换发** | 用户无需操作，零 claim 成本 |
| D2 | sGVT 模式 | **S3: 固定供应展示/价格锚 ERC20** | 已部署 ~2200万枚 @ $0.5，非vault |
| D3 | preGVT 额度设计 | **两层 Cap**: globalCap (多签可调) + ABSOLUTE_CEILING (编译级) | 阶段灵活 + 最终安全 |
| D4 | preGVT 第一阶段 | 500万枚（已发售+空投完成） | 链上已有 ~5M 流通 |

---

## 1. Token 身份卡

### 1.1 preGVT

| 属性 | 值 |
|------|-----|
| Name | Pre Green Value Token |
| Symbol | preGVT |
| Decimals | 18 |
| Supply Model | 按需 mint（阶段化），**非**固定供应 |
| ABSOLUTE_CEILING | 250,000,000 (250M) — 对应 GVT 1B 中 Seed 15% + Public 10% |
| globalCap (初始) | 5,000,000 (5M) — 第一阶段 |
| 当前已发行 | **~5,000,000 (5M)**（已通过预售 + 空投分发） |
| 发行方式 | 预售购买（USDT 付款）+ 空投激励，持续进行中 |
| 转换方式 | TGE 时 admin 批量 mint GVT 到每个 preGVT 持有者，1:1 |
| TGE 后状态 | pause() 永冻，合约保留为历史凭证 |

### 1.2 sGVT

| 属性 | 值 |
|------|-----|
| Name | Shadow Green Value Token |
| Symbol | sGVT |
| Decimals | 18 |
| Supply Model | **固定供应**，构造函数一次性 mint |
| 当前已发行 | ~22,000,000 (22M) @ $0.5 USDT |
| 价格锚定 | 通过 DEX LP pool (sGVT-USDT) 做价格展示 |
| 与 GVT 关系 | **完全独立**，无链上兑换，不占用 GVT 1B cap |
| TGE 后角色 | 淡化（可继续作为辅助展示，也可 pause 退场） |

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
├── [via preGVT → TGE Migration → GVT.mint()]
│   ├── Seed Round:       150M (15%)  ← preGVT 阶段化预售
│   └── Public Sale:      100M (10%)  ← preGVT 阶段化预售
│
└── [via BondingCurve → GVT.mint()]
    └── Staking/Convert:  150M (15%)  — rGGP→GVT 转换

sGVT: 不在此 cap 体系内（独立 ERC20，总量 ~22M，不触发 GVT.mint()）
```

**安全验证链路**：

1. preGVT.mint() → 三层 cap 检查 (stageCap / globalCap / ABSOLUTE_CEILING)
2. TGE: admin pause preGVT → snapshot → 调 GVT.mint(holder, balance) 逐笔
3. GVT.mint() 内部检查 `totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY`
4. → 即使 migration 脚本有 bug，GVT 自身也会 revert

---

## 3. 合约详细设计

### 3.1 PreGVT.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PreGVT (Pre Green Value Token)
 * @notice Presale voucher ERC20, 1:1 redeemable for GVT at TGE
 * @dev Features:
 * - Three-layer cap: stageCap < globalCap < ABSOLUTE_CEILING
 * - Staged minting via Presale contract (MINTER_ROLE)
 * - Pause after TGE to permanently freeze (historical record only)
 * - NOT GVT — no governance, no staking, no bonding curve access
 */
contract PreGVT is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CAP_ADMIN_ROLE = keccak256("CAP_ADMIN_ROLE");

    /// @notice Absolute ceiling — compile-time constant, NEVER changeable
    uint256 public constant ABSOLUTE_CEILING = 250_000_000 * 10 ** 18; // 250M

    /// @notice Adjustable global cap — multisig can increase (up to ABSOLUTE_CEILING)
    uint256 public globalCap;

    /// @notice Current active stage
    uint256 public currentStage;

    struct Stage {
        uint256 cap;     // Max mintable in this stage
        uint256 minted;  // Already minted in this stage
        bool active;     // Is this stage currently active
    }

    mapping(uint256 => Stage) public stages;

    event GlobalCapUpdated(uint256 oldCap, uint256 newCap, address indexed updatedBy);
    event StageCreated(uint256 indexed stageId, uint256 cap);
    event StageActivated(uint256 indexed stageId);
    event StageClosed(uint256 indexed stageId, uint256 totalMinted);

    constructor(address admin, uint256 _initialGlobalCap) ERC20("Pre Green Value Token", "preGVT") {
        require(_initialGlobalCap <= ABSOLUTE_CEILING, "Exceeds absolute ceiling");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(CAP_ADMIN_ROLE, admin);

        globalCap = _initialGlobalCap;
    }

    // ===================== Stage Management =====================

    function createStage(uint256 cap) external onlyRole(CAP_ADMIN_ROLE) returns (uint256) {
        currentStage++;
        stages[currentStage] = Stage({cap: cap, minted: 0, active: true});
        emit StageCreated(currentStage, cap);
        return currentStage;
    }

    function closeStage(uint256 stageId) external onlyRole(CAP_ADMIN_ROLE) {
        require(stages[stageId].active, "Stage not active");
        stages[stageId].active = false;
        emit StageClosed(stageId, stages[stageId].minted);
    }

    // ===================== Cap Management =====================

    function setGlobalCap(uint256 newCap) external onlyRole(CAP_ADMIN_ROLE) {
        require(newCap <= ABSOLUTE_CEILING, "Exceeds absolute ceiling");
        require(newCap >= totalSupply(), "Below current supply");
        uint256 oldCap = globalCap;
        globalCap = newCap;
        emit GlobalCapUpdated(oldCap, newCap, msg.sender);
    }

    // ===================== Minting =====================

    /**
     * @notice Mint preGVT — called by Presale contract
     * @dev Three-layer cap enforcement:
     *   1. stageCap: stages[currentStage].minted + amount <= stages[currentStage].cap
     *   2. globalCap: totalSupply() + amount <= globalCap
     *   3. ABSOLUTE_CEILING: totalSupply() + amount <= ABSOLUTE_CEILING
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(amount > 0, "Amount=0");

        Stage storage stage = stages[currentStage];
        require(stage.active, "No active stage");
        require(stage.minted + amount <= stage.cap, "Stage cap exceeded");
        require(totalSupply() + amount <= globalCap, "Global cap exceeded");
        // ABSOLUTE_CEILING check is redundant if globalCap <= ABSOLUTE_CEILING (enforced in setGlobalCap)
        // but we keep it as defense-in-depth
        require(totalSupply() + amount <= ABSOLUTE_CEILING, "Absolute ceiling exceeded");

        stage.minted += amount;
        _mint(to, amount);
    }

    // ===================== Pause (for TGE freeze) =====================

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ===================== Overrides =====================

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
```

### 3.2 Presale.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IPreGVT {
    function mint(address to, uint256 amount) external;
}

/**
 * @title Presale
 * @notice Staged presale contract — users deposit USDT, receive preGVT
 * @dev Features:
 * - Multi-stage pricing (seed / private / public)
 * - Per-stage whitelist via Merkle root
 * - Per-address purchase limits
 * - Funds go to treasury address
 * - Sales agents can buy on behalf of users (recipient ≠ msg.sender)
 */
contract Presale is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IPreGVT public immutable preGVT;
    IERC20 public immutable paymentToken;  // USDT (6 decimals on BSC)
    address public treasury;

    struct SaleStage {
        uint256 price;            // USDT per preGVT (scaled: price in 6-decimal USDT for 1e18 preGVT)
        uint256 cap;              // Max preGVT sellable in this stage
        uint256 sold;             // preGVT sold so far
        uint256 startTime;
        uint256 endTime;
        uint256 maxPerAddress;    // Max preGVT per address (0 = unlimited)
        bool whitelistOnly;
        bytes32 whitelistRoot;    // Merkle root (if whitelistOnly)
    }

    uint256 public currentStageId;
    mapping(uint256 => SaleStage) public saleStages;
    mapping(uint256 => mapping(address => uint256)) public purchased; // stage => buyer => amount

    event Purchase(
        uint256 indexed stageId,
        address indexed buyer,
        address indexed recipient,
        uint256 usdtAmount,
        uint256 preGVTAmount
    );
    event StageConfigured(uint256 indexed stageId);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    constructor(
        address _preGVT,
        address _paymentToken,
        address _treasury,
        address admin
    ) {
        preGVT = IPreGVT(_preGVT);
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Buy preGVT — USDT in, preGVT out
     * @param recipient Address to receive preGVT (can be different from msg.sender for agent sales)
     * @param usdtAmount Amount of USDT to spend
     * @param merkleProof Whitelist proof (empty array if not whitelistOnly)
     */
    function buy(
        address recipient,
        uint256 usdtAmount,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused {
        SaleStage storage stage = saleStages[currentStageId];
        require(block.timestamp >= stage.startTime && block.timestamp <= stage.endTime, "Stage not active");
        require(usdtAmount > 0, "Amount=0");

        // Whitelist check
        if (stage.whitelistOnly) {
            bytes32 leaf = keccak256(abi.encodePacked(recipient));
            require(MerkleProof.verify(merkleProof, stage.whitelistRoot, leaf), "Not whitelisted");
        }

        // Calculate preGVT amount: (usdtAmount * 1e18) / price
        // price is in 6-decimal USDT per 1e18 preGVT
        uint256 preGVTAmount = (usdtAmount * 1e18) / stage.price;
        require(preGVTAmount > 0, "Amount too small");

        // Stage cap check
        require(stage.sold + preGVTAmount <= stage.cap, "Stage cap exceeded");

        // Per-address limit check
        if (stage.maxPerAddress > 0) {
            require(
                purchased[currentStageId][recipient] + preGVTAmount <= stage.maxPerAddress,
                "Per-address limit exceeded"
            );
        }

        // Transfer USDT to treasury
        paymentToken.safeTransferFrom(msg.sender, treasury, usdtAmount);

        // Mint preGVT to recipient
        preGVT.mint(recipient, preGVTAmount);

        // Update tracking
        stage.sold += preGVTAmount;
        purchased[currentStageId][recipient] += preGVTAmount;

        emit Purchase(currentStageId, msg.sender, recipient, usdtAmount, preGVTAmount);
    }

    /**
     * @notice Configure a sale stage
     */
    function configureStage(
        uint256 stageId,
        uint256 price,
        uint256 cap,
        uint256 startTime,
        uint256 endTime,
        uint256 maxPerAddress,
        bool whitelistOnly,
        bytes32 whitelistRoot
    ) external onlyRole(OPERATOR_ROLE) {
        saleStages[stageId] = SaleStage({
            price: price,
            cap: cap,
            sold: 0,
            startTime: startTime,
            endTime: endTime,
            maxPerAddress: maxPerAddress,
            whitelistOnly: whitelistOnly,
            whitelistRoot: whitelistRoot
        });
        emit StageConfigured(stageId);
    }

    function setCurrentStage(uint256 stageId) external onlyRole(OPERATOR_ROLE) {
        currentStageId = stageId;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
```

### 3.3 ShadowGVT.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ShadowGVT (sGVT)
 * @notice Fixed-supply display / price-anchor token for AGV Protocol
 * @dev
 * - One-time mint in constructor — NO mint function exists
 * - Serves as early-stage price reference via DEX LP
 * - Completely independent from GVT — no on-chain redemption
 * - Does NOT count toward GVT 1B hard cap
 *
 * Current deployment: ~22M supply @ $0.5 USDT
 */
contract ShadowGVT is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Total ever-minted — set in constructor, immutable
    uint256 public immutable INITIAL_SUPPLY;

    constructor(
        address admin,
        uint256 initialSupply,
        address treasury
    ) ERC20("Shadow Green Value Token", "sGVT") {
        require(treasury != address(0), "Invalid treasury");
        require(initialSupply > 0, "Supply=0");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        INITIAL_SUPPLY = initialSupply;
        _mint(treasury, initialSupply);
        // NO mint function — supply is permanently fixed
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
```

---

## 4. 部署脚本

### 4.1 DeployPresale.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/PreGVT.sol";
import "../contracts/tokens/ShadowGVT.sol";
import "../contracts/presale/Presale.sol";

contract DeployPresale is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envOr("ADMIN_ADDRESS", vm.addr(deployerKey));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy PreGVT (initial globalCap = 5M for Stage 1)
        PreGVT preGVT = new PreGVT(admin, 5_000_000 * 10 ** 18);
        console.log("PreGVT deployed at:", address(preGVT));

        // 2. Deploy Presale
        Presale presale = new Presale(
            address(preGVT),
            usdt,
            treasury,
            admin
        );
        console.log("Presale deployed at:", address(presale));

        // 3. Grant MINTER_ROLE to Presale
        preGVT.grantRole(preGVT.MINTER_ROLE(), address(presale));
        console.log("Granted MINTER_ROLE to Presale");

        // 4. Create Stage 1 on PreGVT
        preGVT.createStage(5_000_000 * 10 ** 18); // 5M cap
        console.log("Stage 1 created: 5M preGVT cap");

        // 5. Configure Presale Stage 1 (price = 0.5 USDT per preGVT)
        presale.configureStage(
            1,                          // stageId
            500_000,                    // price: 0.5 USDT (6 decimals) per 1e18 preGVT
            5_000_000 * 10 ** 18,       // cap: 5M
            block.timestamp,            // startTime (adjust for production)
            block.timestamp + 90 days,  // endTime
            100_000 * 10 ** 18,         // maxPerAddress: 100K
            false,                      // whitelistOnly
            bytes32(0)                  // no whitelist root
        );
        presale.setCurrentStage(1);
        console.log("Presale Stage 1 configured");

        // 6. Deploy ShadowGVT (22M, matching existing deployment)
        ShadowGVT sGVT = new ShadowGVT(admin, 22_000_000 * 10 ** 18, treasury);
        console.log("ShadowGVT deployed at:", address(sGVT));

        vm.stopBroadcast();
    }
}
```

### 4.2 PreGVTMigration.s.sol (TGE 时执行)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/PreGVT.sol";

/**
 * @title PreGVTMigration
 * @notice TGE batch conversion script: preGVT holders → GVT 1:1
 * @dev Execution steps:
 *   1. Off-chain: snapshot all preGVT holders + balances
 *   2. On-chain: preGVT.pause() — freeze all transfers
 *   3. On-chain: GVT.grantRole(MINTER_ROLE, migrationEOA) — temporary
 *   4. On-chain: for each holder: GVT.mint(holder, balance)
 *   5. On-chain: GVT.revokeRole(MINTER_ROLE, migrationEOA) — cleanup
 *   6. Verify: sum(minted) == preGVT.totalSupply()
 *
 * @dev CRITICAL: The GVT.mint() call enforces:
 *   totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY
 *   This means even if this script is buggy, the GVT contract itself will revert.
 */
contract PreGVTMigration is Script {
    // These arrays are populated off-chain from the preGVT snapshot
    // In production, load from JSON file via vm.parseJson()

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address gvtAddress = vm.envAddress("GVT_ADDRESS");
        address preGVTAddress = vm.envAddress("PREGVT_ADDRESS");

        GVT gvt = GVT(gvtAddress);
        PreGVT preGVT = PreGVT(preGVTAddress);

        // Load snapshot data (in production, from JSON)
        // address[] memory holders = ...;
        // uint256[] memory balances = ...;

        vm.startBroadcast(deployerKey);

        // Step 1: Pause preGVT (freeze transfers)
        preGVT.pause();
        console.log("preGVT paused");

        // Step 2: Batch mint GVT
        // NOTE: The broadcaster must have GVT MINTER_ROLE
        //
        // for (uint256 i = 0; i < holders.length; i++) {
        //     gvt.mint(holders[i], balances[i]);
        //     console.log("Minted GVT for:", holders[i], balances[i]);
        // }

        // Step 3: Verify
        // require(gvt.totalSupply() includes the newly minted amount)
        console.log("preGVT totalSupply:", preGVT.totalSupply());
        console.log("GVT totalSupply after migration:", gvt.totalSupply());

        // Step 4: Revoke MINTER_ROLE from migrator
        // gvt.revokeRole(gvt.MINTER_ROLE(), vm.addr(deployerKey));

        vm.stopBroadcast();

        console.log("TGE Migration complete.");
    }
}
```

---

## 5. 权限矩阵（完整增量）

| 合约 | Role | 授予目标 | 生命周期 |
|------|------|---------|---------|
| PreGVT | DEFAULT_ADMIN_ROLE | admin (multisig) | 永久 |
| PreGVT | MINTER_ROLE | Presale.sol | 预售期间 → TGE 后 revoke |
| PreGVT | PAUSER_ROLE | admin (multisig) | TGE 时 pause |
| PreGVT | CAP_ADMIN_ROLE | admin (multisig) | 用于调整 globalCap |
| GVT | MINTER_ROLE | + migration EOA | **仅 TGE 当天**，完成后立即 revoke |
| ShadowGVT | DEFAULT_ADMIN_ROLE | admin (multisig) | 永久 |
| ShadowGVT | PAUSER_ROLE | admin (multisig) | 可选 |
| Presale | OPERATOR_ROLE | admin | 配置 stage |
| Presale | PAUSER_ROLE | admin (multisig) | 紧急暂停 |

> ⚠ **安全重点**: GVT MINTER_ROLE 授予 migration EOA 必须是**临时的**。migration 脚本最后一步必须执行 `revokeRole`。

---

## 6. Foundry 测试清单

### 6.1 PreGVT.t.sol

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testMintRespectsThreeLayerCap` | 核心 |
| 2 | `testMintRevertsWhenStageCapExceeded` | 边界 |
| 3 | `testMintRevertsWhenGlobalCapExceeded` | 边界 |
| 4 | `testMintRevertsWhenAbsoluteCeilingExceeded` | 边界 |
| 5 | `testSetGlobalCapCannotExceedCeiling` | 权限 |
| 6 | `testSetGlobalCapCannotGoBelowSupply` | 边界 |
| 7 | `testOnlyMinterCanMint` | 权限 |
| 8 | `testPauseFreezesAllTransfers` | 功能 |
| 9 | `testStageCreationAndClosure` | 功能 |
| 10 | `testFuzz_MintNeverExceedsCeiling(uint256)` | Fuzz |

### 6.2 Presale.t.sol

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testBuyMintsCorrectAmount` | 核心 |
| 2 | `testBuyOnBehalfOfRecipient` | 功能（代理销售） |
| 3 | `testBuyRevertsOutsideStageTime` | 边界 |
| 4 | `testBuyRevertsWhenStageSoldOut` | 边界 |
| 5 | `testWhitelistVerification` | 安全 |
| 6 | `testPerAddressLimitEnforced` | 边界 |
| 7 | `testUSDTTransferredToTreasury` | 核心 |
| 8 | `testFuzz_BuyPriceCalculation(uint256)` | Fuzz |

### 6.3 ShadowGVT.t.sol

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testInitialSupplyCorrect` | 核心 |
| 2 | `testNoMintFunctionExists` | 安全 |
| 3 | `testPauseFreezesTransfers` | 功能 |
| 4 | `testBurnReducesSupply` | 功能 |
| 5 | `testTreasuryReceivesAllTokens` | 核心 |

### 6.4 PreGVTMigration.t.sol

| # | 测试用例 | 类型 |
|---|---------|------|
| 1 | `testMigrationMintsCorrectGVTAmounts` | 核心 |
| 2 | `testMigrationTotalEqualsPreGVTSupply` | 完整性 |
| 3 | `testMigrationRevertsIfGVTCapExceeded` | 安全 |
| 4 | `testMigrationRevertsIfPreGVTNotPaused` | 流程 |
| 5 | `testMinterRoleRevokedAfterMigration` | 安全 |

---

## 7. 文件结构（最终版）

```
tokencontracts-main/
  contracts/
    core/
      BondingCurve.sol            (不改)
      OracleVerification.sol      (不改)
      PowerToMint.sol             (不改)
    governance/
      DAOController.sol           (不改)
    tokens/
      GVT.sol                     (不改)
      rGGP.sol                    (不改)
      PreGVT.sol                  ★ 新增
      ShadowGVT.sol               ★ 新增
    presale/
      Presale.sol                 ★ 新增
    utils/
      VestingVault.sol            (不改)
    interfaces/
      IrGGP.sol                   (不改)
      IPreGVT.sol                 ★ 新增
  script/
    Deploy.s.sol                  (不改)
    DeployPresale.s.sol           ★ 新增
    PreGVTMigration.s.sol         ★ 新增
  test/
    PreGVT.t.sol                  ★ 新增
    ShadowGVT.t.sol               ★ 新增
    Presale.t.sol                 ★ 新增
    PreGVTMigration.t.sol         ★ 新增
```

新增文件: **7 个**（3 合约 + 1 接口 + 2 脚本 + 4 测试 → 实际 10 个文件）

---

## 8. 实现优先级

| 阶段 | 交付物 | 预估工作量 |
|------|--------|-----------|
| **P0 — 复刻已部署合约** | PreGVT.sol + Presale.sol（对齐链上已有 ~5M 发行量）+ 测试 | 2-3 天 |
| **P0 — 展示币** | ShadowGVT.sol（对齐链上已有 ~22M）+ 测试 | 0.5 天 |
| **P0.5 — 后续阶段预售** | 新 stage 配置 + globalCap 扩容 | 配置项 |
| **P1 — TGE 准备** | PreGVTMigration.s.sol + migration 测试 + snapshot 工具 | 2-3 天 |
| **P2 — 审计** | 全部合约提交安全审计 | 外包 / 1-2 周 |

---

## 附录 A: 与 DESIGN.md E.5 的一致性映射

| DESIGN.md 定义 | 本方案实现 | 一致性 |
|---------------|-----------|--------|
| "preGVT = 预售凭证/额度记录，**不等同于已铸造的 GVT**" | PreGVT.sol 是独立 ERC20，不触发 GVT.mint() | ✅ |
| "GVT 仅通过 mint() 或 setAllocation()+releaseVested() 产生" | TGE Migration 通过 GVT.mint() 进行，受 cap 保护 | ✅ |
| "sGVT = 锁仓/权益凭证，**不等同于 GVT**" | ShadowGVT 是独立固定供应 ERC20，无链上兑换 | ✅ (注*) |

> *注: DESIGN.md 将 sGVT 描述为"锁仓/权益凭证"，实际用途更接近"价格锚/展示"。建议更新 DESIGN.md E.5 以反映实际定位。
