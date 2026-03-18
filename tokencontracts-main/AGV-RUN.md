# AGV Token 部署与操作指南

> **链**: BNB Chain (BSC Mainnet, Chain ID 56)  
> **代币**: pGVT (V3 合规预售凭证) + sGVT (注册制机构凭证)  
> **文档版本**: v3.1 (2026-03-15)  
> **部署状态**: ✅ 已上线 — pGVT `0x8F9E...f9` / sGVT `0x53e5...a3`  
>  
> **历史沿革与合约架构** → [AGV-pGVT-sGVT.md](AGV-pGVT-sGVT.md)（所有版本演进、合约代码、部署谱系）  
> **NFT 部署运维** → *(待建 AGV-NFT-RUN.md)*，当前内容见 [AGV-NFT-AgentRegistry.md](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md)

---

## 0. 生产环境速查

> 完整地址表、供应量、上币状态、CoinGecko 被拒详情 → [AGV-pGVT-sGVT.md §10](AGV-pGVT-sGVT.md)

| 角色 | 地址 |
|------|------|
| Deployer / Admin | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` |
| pGVT | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` |
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` |

---

## 前置准备

### 1. 安装 Foundry

```bash
# Windows — 下载 nightly binary
# https://github.com/foundry-rs/foundry/releases

# 验证
forge --version
```

### 2. 配置环境变量

在 `tokencontracts-main/` 目录下创建 `.env` 文件：

```env
# 部署者私钥
PRIVATE_KEY=0x...

# BSC RPC
BSC_RPC_URL=https://bsc-dataseed1.binance.org

# BscScan API Key（合约验证用）
BSCSCAN_API_KEY=...

# Admin 地址（留空则使用部署者地址）
ADMIN_ADDRESS=0x...

# BSC USDT 合约地址
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955

# === 部署后填入（已部署） ===
PGVT_ADDRESS=0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9
SGVT_ADDRESS=0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3

# === LP 参数（已执行） ===
PGVT_LP_TOKENS=10000000000000000000000
PGVT_LP_USDT=50000000000000000000
SGVT_LP_TOKENS=100000000000000000000
SGVT_LP_USDT=50000000000000000000

# === TGE 阶段填入 ===
GVT_ADDRESS=0x...
MIGRATOR_ADDRESS=0x...
```

### 3. 确保钱包有足够资产

| 资产 | 数量 | 用途 |
|---|---|---|
| BNB | ~0.01 BNB | Gas 费（BSC gas 极低，~0.05 gwei） |
| USDT (BSC) | 按需 | 建 LP 池 / 做交易 |

BSC USDT 合约: `0x55d398326f99059fF775485246999027B3197955`（18 decimals）

---

## 第一步：部署 pGVT + sGVT（✅ 已完成）

使用 `AirdropMint.s.sol` 部署两个合约并 mint 初始供应：

```bash
cd tokencontracts-main
source .env

# 部署 pGVT (3M) + sGVT (30M)
forge script script/AirdropMint.s.sol:AirdropMint \
  --sig "run(address)" $ADMIN_ADDRESS \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY

# 验证合约（部署后执行）
forge verify-contract $PGVT_ADDRESS contracts/tokens/pGVT.sol:pGVT \
  --chain-id 56 --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" $ADMIN_ADDRESS)

forge verify-contract $SGVT_ADDRESS contracts/tokens/sGVT.sol:sGVT \
  --chain-id 56 --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address,uint8)" $ADMIN_ADDRESS $ADMIN_ADDRESS 0x55d398326f99059fF775485246999027B3197955 2)
```

### 部署后状态

| 合约 | 地址 | 状态 |
|------|------|------|
| pGVT | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` | 3M mint to admin, BscScan verified |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` | 30M mint to admin, BscScan verified |

---

## 第二步：配置 pGVT V3 功能（可选，按需启用）

### 2a. 配置 Vesting（可选但推荐）

```bash
# 设置全局 vesting：30 天 cliff，90 天线性释放
# start = 当前时间戳，cliff = 30天(2592000秒)，duration = 90天(7776000秒)
START_TIME=$(date +%s)

cast send $PGVT_ADDRESS \
  "setGlobalVesting(uint64,uint64,uint64)" \
  $START_TIME 2592000 7776000 \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### 2b. 开启内建预售（可选，与 pSale 可共存）

```bash
# 已在部署脚本中配置好 paymentToken + treasury + presaleConfig
# 只需开启：
cast send $PGVT_ADDRESS \
  "setPresaleActive(bool)" true \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### 2c. 配置 Staking 追踪（可选）

```bash
# 白名单 staking 合约
cast send $PGVT_ADDRESS \
  "whitelistStakingContract(address,bool)" <STAKING_CONTRACT> true \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY

# 开启 staking 追踪
cast send $PGVT_ADDRESS \
  "setStakingEnabled(bool)" true \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### 2d. Seal Vesting（不可逆！TGE 前最后一步）

```bash
# ⚠ 永久锁定所有 vesting 配置，执行后无法修改任何 vesting 参数
cast send $PGVT_ADDRESS \
  "sealVesting()" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

---

## 第三步：批量空投（✅ 已完成）

### 3a. 配置 sGVT 白名单

sGVT 有 `eligibleAddress` 白名单，所有接收者必须先注册：

```bash
source .env && RPC=$BSC_RPC_URL

# 批量添加空投接收者到白名单
cast send $SGVT_ADDRESS \
  "batchUpdateEligibility(address[],bool)" \
  "[0xAddr1,0xAddr2,...]" true \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

### 3b. 执行批量空投

```bash
forge script script/BatchAirdrop.s.sol:BatchAirdrop \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

空投名单在 `script/BatchAirdrop.json`，格式：
```json
[{"name":"Alice","pgvt":100000,"sgvt":1000000,"wallet":"0x..."}]
```

> ⚠ JSON 字段必须按字母序排列（name → pgvt → sgvt → wallet），Foundry `vm.parseJson` 要求

### 已执行结果

- 12 名接收者
- 730,000 pGVT + 21,130,000 sGVT 已分发
- 所有交易 status: success

---

## 第四步：添加 PancakeSwap 流动性（✅ 已完成）

```bash
# sGVT 需要先创建 LP Pair 并注册白名单
source .env && RPC=$BSC_RPC_URL
ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
FACTORY=0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73

# 1. 创建 sGVT-USDT pair（pGVT pair 由 Router.addLiquidity 自动创建）
cast send $FACTORY "createPair(address,address)" $SGVT_ADDRESS $USDT_ADDRESS \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# 2. 查询 pair 地址
SGVT_PAIR=$(cast call $FACTORY "getPair(address,address)(address)" $SGVT_ADDRESS $USDT_ADDRESS --rpc-url $RPC)

# 3. sGVT 白名单注册 Router + LP Pair
cast send $SGVT_ADDRESS "setRouter(address)" $ROUTER --rpc-url $RPC --private-key $PRIVATE_KEY
cast send $SGVT_ADDRESS "setLpPair(address)" $SGVT_PAIR --rpc-url $RPC --private-key $PRIVATE_KEY

# 4. Approve tokens to Router
cast send $PGVT_ADDRESS "approve(address,uint256)" $ROUTER $(cast max-uint) --rpc-url $RPC --private-key $PRIVATE_KEY
cast send $SGVT_ADDRESS "approve(address,uint256)" $ROUTER $(cast max-uint) --rpc-url $RPC --private-key $PRIVATE_KEY
cast send $USDT_ADDRESS "approve(address,uint256)" $ROUTER $(cast max-uint) --rpc-url $RPC --private-key $PRIVATE_KEY

# 5. Add liquidity
DEADLINE=$(($(date +%s) + 600))

# pGVT: 10,000 + 50 USDT → $0.005/pGVT
cast send $ROUTER "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $PGVT_ADDRESS $USDT_ADDRESS \
  10000000000000000000000 50000000000000000000 0 0 \
  $ADMIN_ADDRESS $DEADLINE \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# sGVT: 100 + 50 USDT → $0.50/sGVT
cast send $ROUTER "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $SGVT_ADDRESS $USDT_ADDRESS \
  100000000000000000000 50000000000000000000 0 0 \
  $ADMIN_ADDRESS $DEADLINE \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

### 定价参数（已执行）

| 代币 | LP 代币量 | LP USDT 量 | 目标价格 | LP Pair |
|---|---|---|---|---|
| pGVT | 10,000 | 50 USDT | **$0.005** | `0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0` |
| sGVT | 100 | 50 USDT | **$0.50** | `0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d` |

> 后续如需加厚 LP，使用相同的 `addLiquidity` 命令，调整代币和 USDT 数量即可。

---

## 第五步：做交易触发 DEX 索引（✅ 已完成）

```bash
source .env && RPC=$BSC_RPC_URL
ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
WALLET=$ADMIN_ADDRESS
DEADLINE=$(($(date +%s) + 600))

# Approve USDT to Router
cast send $USDT_ADDRESS "approve(address,uint256)" $ROUTER $(cast max-uint) \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Swap 1 USDT → pGVT
cast send $ROUTER "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1000000000000000000 0 "[$USDT_ADDRESS,$PGVT_ADDRESS]" $WALLET $DEADLINE \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# Swap 1 USDT → sGVT
cast send $ROUTER "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1000000000000000000 0 "[$USDT_ADDRESS,$SGVT_ADDRESS]" $WALLET $DEADLINE \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

> 两个池子的首笔交易已于 2026-03-10 完成，GeckoTerminal 已索引。

---

## 第六步：TGE 转换设置（pGVT → GVT）— ⏳ 待执行

> 此步骤在 GVT 正式上线时执行。需要先部署 GVT + Migrator 合约。

```bash
source .env

forge script script/pGVTMigration.s.sol:pGVTMigration \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

### 执行效果

1. Migrator 合约获得 GVT `MINTER_ROLE`
2. pGVT 连接 gvtToken + migrator
3. 用户可自行调用 `pGVT.convertToGVT(amount)` 完成 1:1 转换

### 用户转换操作

```bash
# 用户通过 dApp 或直接调用
cast send $PGVT_ADDRESS \
  "convertToGVT(uint256)" <转换数量_18位小数> \
  --rpc-url $BSC_RPC_URL \
  --private-key <用户私钥>
```

> 转换量受 `transferableBalance` 限制 — 必须满足 vesting 解锁 + 扣除 staked 部分。

---

## 常用运维命令

### 查询余额

```bash
source .env && RPC=$BSC_RPC_URL

# pGVT 余额
cast call $PGVT_ADDRESS "balanceOf(address)(uint256)" $ADMIN_ADDRESS --rpc-url $RPC

# sGVT 余额
cast call $SGVT_ADDRESS "balanceOf(address)(uint256)" $ADMIN_ADDRESS --rpc-url $RPC

# USDT 余额
cast call $USDT_ADDRESS "balanceOf(address)(uint256)" $ADMIN_ADDRESS --rpc-url $RPC
```

### sGVT 白名单管理

```bash
# 添加单个地址
cast send $SGVT_ADDRESS "updateEligibility(address,bool)" 0xNewAddr true \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# 批量添加
cast send $SGVT_ADDRESS "batchUpdateEligibility(address[],bool)" \
  "[0xAddr1,0xAddr2,0xAddr3]" true \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# 检查某地址是否在白名单
cast call $SGVT_ADDRESS "eligibleAddress(address)(bool)" 0xCheckAddr --rpc-url $RPC
```

### 新增空投（单笔转账）

```bash
# 转 pGVT（无白名单限制）
cast send $PGVT_ADDRESS "transfer(address,uint256)" 0xRecipient 1000000000000000000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY

# 转 sGVT（接收者必须先在白名单中！）
cast send $SGVT_ADDRESS "transfer(address,uint256)" 0xRecipient 1000000000000000000000 \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

### 加厚 LP

```bash
ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
DEADLINE=$(($(date +%s) + 600))

# 示例：追加 100,000 pGVT + 500 USDT
cast send $ROUTER "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $PGVT_ADDRESS $USDT_ADDRESS \
  100000000000000000000000 500000000000000000000 0 0 \
  $ADMIN_ADDRESS $DEADLINE \
  --rpc-url $RPC --private-key $PRIVATE_KEY
```

## 常用操作

### Admin Mint pGVT（空投/补发）

```bash
cast send $PGVT_ADDRESS \
  "mint(address,uint256)" <目标地址> <数量_18位小数> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### V2→V3 迁移初始化

```bash
# SYSTEM_ROLE 调用，为 V2 持有者初始化余额
cast send $PGVT_ADDRESS \
  "initializeFromMigration(address,uint256)" <用户地址> <余额_18位小数> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### sGVT Mint（机构认购）

```bash
# 需要 MINTER_ROLE
cast send $SGVT_ADDRESS \
  "mint(address,uint256,string)" <投资者地址> <数量_18位小数> "investor-id" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY
```

### 查余额

```bash
# pGVT 余额
cast call $PGVT_ADDRESS "balanceOf(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org

# pGVT 可转账余额（扣除 vesting 锁定 + staking）
cast call $PGVT_ADDRESS "transferableBalance(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org

# pGVT 已释放额度
cast call $PGVT_ADDRESS "vestedAmount(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org

# sGVT 余额
cast call $SGVT_ADDRESS "balanceOf(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org
```

### 查合约状态

```bash
# pGVT 总铸造量 / MAX_SUPPLY
cast call $PGVT_ADDRESS "totalMinted()(uint256)" --rpc-url https://bsc-dataseed.binance.org
cast call $PGVT_ADDRESS "MAX_SUPPLY()(uint256)" --rpc-url https://bsc-dataseed.binance.org

# 预售状态
cast call $PGVT_ADDRESS "presaleActive()(bool)" --rpc-url https://bsc-dataseed.binance.org
cast call $PGVT_ADDRESS "presaleSold()(uint256)" --rpc-url https://bsc-dataseed.binance.org

# Vesting 是否已 seal
cast call $PGVT_ADDRESS "vestingSealed()(bool)" --rpc-url https://bsc-dataseed.binance.org
```

---

## 文件清单

| 文件 | 说明 |
|---|---|
| `contracts/tokens/pGVT.sol` | pGVT V3 — vesting + staking + convertToGVT |
| `contracts/tokens/sGVT.sol` | sGVT — 注册制机构凭证 |
| `contracts/presale/pSale.sol` | 外部预售合约（Merkle 白名单 + 代理销售） |
| `script/DeploypSale.s.sol` | 一键部署 pGVT + pSale + sGVT |
| `script/pGVTMigration.s.sol` | TGE 转换设置脚本 |
| `script/AddLiquidity.s.sol` | PancakeSwap LP 定价脚本 |
| `contracts/_archive/` | V1/V2/V3 链上验证源码存档 |

---

## 注意事项

1. **私钥安全**：不要将 `.env` 文件提交到 Git（已在 `.gitignore` 中排除）
2. **sealVesting 不可逆**：执行后永久无法修改任何 vesting 参数，务必确认配置正确
3. **convertToGVT 前提**：需先部署 Migrator 合约并设置 gvtToken + migrator
4. **LP 池深度**：池子太浅容易被砸穿，建议根据实际预售量调整 LP 投入
5. **Gas**：BSC 上 Gas 很便宜，全流程总计约 0.05-0.15 BNB
6. **验证合约**：部署后建议在 BscScan 上 verify source code

---

## 7. 下一步战场（行动计划）

> 上币状态、CoinGecko 被拒根因和链上修复记录 → [AGV-pGVT-sGVT.md §10.5](AGV-pGVT-sGVT.md)  
> NFT 部署运维 → *(待建 AGV-NFT-RUN.md)*，当前架构见 [AGV-NFT-AgentRegistry.md](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md)

### 7.1 CoinGecko 重审（pGVT — 目标 03/28）

| 序号 | 任务 | 状态 |
|------|------|------|
| 1 | 执行 7 笔 revokeRole（deployer 仅保留 DEFAULT_ADMIN + TREASURY） | ✅ 2026-03-13 |
| 2 | 等待 14 天冷却期 | ⏳ → 03/28 可提交 |
| 3 | 准备重审材料：7 笔 tx hash + BscScan Read Contract 截图 + 话术说明 | ⏳ |
| 4 | 提交 CoinGecko 重审（附材料） | ⏳ |
| 5 | 审核通过 → MetaMask 自动显示价格 | — |

### 7.2 CoinGecko 重审（sGVT — 条件驱动）

| 条件 | 当前 | 目标 |
|------|------|------|
| 24h 交易量 | 极低 | 需 MarketMaker 参与 |
| 持有者数量 | ~12 | 需更多空投/分发 |
| 社媒热度 | 低 | 需 KOL 推广 |

**行动**：先满足上述条件后再重新提交。

### 7.3 备选路径（并行）

| 路径 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| **Trust Wallet assets repo** | 独立于 CoinGecko，直接提交 PR 申请 token 展示 | P1 | ✅ PR [#35878](https://github.com/trustwallet/assets/pull/35878) 已提交 (2026-03-15) |
| **CoinMarketCap** | 单独申请（币安旗下，需 volume 证据） | P2 | ⏳ 待 volume 增加 |
| **NFT 分发加速** | 通过 buy-page claim 增加链上交互和用户数 | P1 | ⏳ 可立即执行 |

### 7.4 TGE 转换（pGVT → GVT — 待 GVT 部署）

```
部署 GVT 合约 → 部署 Migrator → 连接 pGVT → 用户自助 convertToGVT()
```

详见第六步 TGE 转换设置。

### 7.5 AgentRegistry v2 部署

代码和 237 个测试均已完成，待以下条件就绪后执行：
- ComputePass / SolarPass 合约 UUPS 升级（加 `agentRegistry` slot）
- 机构客户确认铸造需求

部署步骤见 [AGV-NFT-AgentRegistry.md §9](../agvprotocol-contracts-main/AGV-NFT-AgentRegistry.md)。

### 7.6 Trust Wallet 提交记录（2026-03-15 ✅）

**Fork**: `dakoolfrank/assets` ← `trustwallet/assets`  
**Branch**: `add-pgvt-sgvt-bsc`  
**PR**: [#35878](https://github.com/trustwallet/assets/pull/35878)  
**审核周期**: 自动化审核通常 1-3 天

#### 提交文件

| Token | 目录 | logo | info.json |
|-------|------|------|----------|
| pGVT | `blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/` | 256×256 PNG, 82KB ✅ | name=PreGVT, symbol=pGVT ✅ |
| sGVT | `blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/` | 256×256 PNG, 69KB ✅ | name=Staked GVT, symbol=sGVT ✅ |

#### info.json 社交链接

| 字段 | 值 |
|------|----|
| website | https://agvnexrur.ai |
| twitter | https://x.com/agvnexrur |
| telegram | https://t.me/agvnexrur_bot |
| discord | https://discord.gg/mJKTyqWtKe |
| github | https://github.com/dakoolfrank/AGV |

#### 本地备份

文件副本保存在 `tokencontracts-main/assets/trustwallet/` 目录，含完整操作指南 `SUBMIT-GUIDE.md`。

#### 后续跟进

| 步骤 | 说明 |
|------|------|
| 1 | 等待自动化 CI 检查通过（logo 尺寸/JSON schema） |
| 2 | 如有 CI 失败，按错误信息修正后 force-push |
| 3 | 合并后 Trust Wallet App 内显示 pGVT/sGVT logo |
| 4 | Trust Wallet 价格数据来自 CoinGecko/GeckoTerminal，合并 PR 后 logo 优先显示 |

## 8. CoinGecko 合规修复记录（2026-03-13）

> 被拒根因分析、修复后角色状态 → [AGV-pGVT-sGVT.md §10.5](AGV-pGVT-sGVT.md)

### 8.1 已执行操作（7 笔 revokeRole 交易）

```bash
# === 修复 1: 移除铸币权 ===
# revokeRole(MINTER_ROLE, deployer) — 永久剥离 deployer 铸币权
cast send 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 \
  "revokeRole(bytes32,address)" \
  0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6 \
  0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5 \
  --rpc-url https://bsc-dataseed.binance.org --private-key $PRIVATE_KEY

# === 修复 2-5: 移除 4 个管理角色 ===
# SYSTEM_ROLE
cast send 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 \
  "revokeRole(bytes32,address)" \
  <SYSTEM_ROLE_HASH> 0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5 \
  --rpc-url https://bsc-dataseed.binance.org --private-key $PRIVATE_KEY

# VESTING_CONFIG_ROLE, PRICE_MANAGER_ROLE, STAKING_MANAGER_ROLE — 同上模式

# === 修复 6-7: 同步移除 deployer 自身持有的相应角色管理权 ===
```

### 8.2 修复后状态验证

```bash
# deployer 最终仅保留 2 个角色
cast call 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 \
  "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5 \
  --rpc-url https://bsc-dataseed.binance.org
# → true (DEFAULT_ADMIN_ROLE ✅)

cast call 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 \
  "hasRole(bytes32,address)(bool)" \
  0x3496e2e73c4d42b75d702e60d9e48102720b8691234415571a4f2a9f5b1de207 \
  0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5 \
  --rpc-url https://bsc-dataseed.binance.org
# → true (TREASURY_ROLE ✅)

# MINTER_ROLE = false ✅
# SYSTEM_ROLE = false ✅
# VESTING_CONFIG_ROLE = false ✅
# PRICE_MANAGER_ROLE = false ✅
# STAKING_MANAGER_ROLE = false ✅
```
