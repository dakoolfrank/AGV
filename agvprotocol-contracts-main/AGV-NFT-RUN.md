# AGV-NFT-RUN.md — NFT 部署运维指南

> **文档版本**: v3.0 (V3 单池 + Agent License，含部署准备)  
> **日期**: 2026-03-17  
> **适用仓库**: `agvprotocol-contracts-main`  
> **姊妹文档**:  
> - 架构设计 → [AGV-NFT-AgentRegistry.md](AGV-NFT-AgentRegistry.md) §13  
> - Token 运维 → [AGV-RUN.md](../tokencontracts-main/AGV-RUN.md)

---

## 1. 关键地址

| 角色 | 地址 | 说明 |
|------|------|------|
| **Deployer / Admin** | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` | V3 全新部署 |
| **BSC USDT** | `0x55d398326f99059fF775485246999027B3197955` | 18 decimals |
| **Treasury** | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` | USDT 收款地址（= Deployer） |

### V1 旧合约（不可控，仅参考）

| 合约 | Proxy 地址 | Owner | 说明 |
|------|-----------|-------|------|
| SeedPass | `0xFF362C39...` | `0x3134...` | 旧团队，已铸 17/600 |
| TreePass | `0x1E092126...` | `0x3134...` | 旧团队，已铸 1/300 |
| SolarPass | `0x4F266215...` | `0x3134...` | 旧团队，已铸 0/300 |
| ComputePass | `0x6F503f31...` | `0x3134...` | 旧团队，已铸 0/99 |

> ⚠️ 我们的 deployer `0xAC38...` 在旧 4 Pass 上**无任何角色**，不可操作。

### V3 新合约（已部署 2026-03-17, Block 87205718）

| 合约 | Proxy 地址 | Impl 地址 | 状态 |
|------|-----------|-----------|------|
| SeedPass | `0x4d5c8A1f66e63Af1d5a88fd1ceA77A61e86AE5a0` | `0xD5591Be97e66d8BF0F64593517f5Fd19D5BBcf1E` | ✅ 已部署 |
| TreePass | `0xB27A0EAD07E781b96dcac5965D7733B51D5EfAb1` | `0x0b940eC2D0C0D20e512d03c9A494F07f59A3B0b4` | ✅ 已部署 |
| SolarPass | `0xeE899BaAfF934616760106620D6ad6CE379C5122` | `0xcE72fF8D798e17961668495D6295522999E93e16` | ✅ 已部署 |
| ComputePass | `0xA9d26c79D78E16C8ca83cDF417E5487A171101e8` | `0x95082d1B986c94aDA7148Ace52346448aCAFC450` | ✅ 已部署 |

> **BscScan 验证**：8/8 合约全部 Verified。Gas 总计 0.00074 BNB。

---

## 2. 部署流程

### 2.0 三阶段概览

```
阶段 1: 合约部署         阶段 2: 元数据配置         阶段 3: 业务运营
─────────────            ─────────────              ─────────────
forge script 一键部署    上传图片到 IPFS/API         散客自购 mint()
→ 4 impl + 4 proxy      setCollectibleBaseURI()     Admin 空投 adminMint()
→ BscScan 验证           setLicenseBaseURI()         Agent 代售 adminMintForAgent()
→ 初始状态检查           前端更新新地址+ABI          grantLicense() 授权 Agent
```

**部署后合约初始状态**：

| 属性 | 值 | 说明 |
|------|-----|------|
| `saleActive` | `true` | 散客可立即购买 |
| `totalSupply` | `0` | 未铸造 |
| `MAX_SUPPLY` | `1,000,000` | 不可更改 |
| `ADMIN_ROLE` | deployer | `0xAC38...` |
| `TREASURER_ROLE` | treasury | `0xAC38...`（= deployer） |
| `collectibleBaseURI` | 空 | 需后续 `setCollectibleBaseURI` |
| `licenseBaseURI` | 空 | 需后续 `setLicenseBaseURI` |
| `metadataFrozen` | `false` | URI 可修改 |
| Royalty | 5% → treasury | ERC2981 |

### 2.1 前置准备

```bash
# 确认 .env 配置（已从 tokencontracts-main/.env 复用凭据）
cd agvprotocol-contracts-main
cat .env
# PRIVATE_KEY=0x...                            ← deployer 私钥
# ADMIN_ADDRESS=0xAC380431...                  ← AccessControl admin (= deployer)
# TREASURY_ADDRESS=0xAC380431...               ← USDT 收款地址
# BSC_RPC_URL=https://bsc-dataseed1.binance.org
# BSCSCAN_API_KEY=FY8VC4AA...                  ← BscScan 合约验证
# BSC_USDT=                                    ← 可选，脚本默认 0x55d398...

# 编译合约
forge build

# 运行测试（61 个必须全绿）
forge test -vvv
```

> **凭据来源**：`PRIVATE_KEY` / `ADMIN_ADDRESS` / `TREASURY_ADDRESS` / `BSCSCAN_API_KEY` 均与 `tokencontracts-main/.env` 相同。
> **BSC_USDT** 可不设，脚本内置默认值 `0x55d398326f99059fF775485246999027B3197955`。

### 2.2 部署 4 个 Pass 合约

```bash
# 加载环境变量
source .env

# 部署脚本（一次性部署 4 impl + 4 proxy = 8 个合约）
forge script script/DeployPasses.s.sol:DeployPasses \
    --rpc-url $BSC_RPC_URL \
    --broadcast \
    --verify \
    --etherscan-api-key $BSCSCAN_API_KEY \
    -vvvv
```

> **输出**：脚本会打印 8 个地址（4 impl + 4 proxy），proxy 地址即用户交互的合约地址。
> **产物**：`broadcast/DeployPasses.s.sol/56/run-latest.json`（BSC Mainnet chainId=56）

**部署参数**（V3 单池 — 无通道分配）：

| Pass | PRICE | MAX_SUPPLY |
|------|-------|-----------|
| SeedPass | 29 * 1e18 ($29) | 1,000,000 |
| TreePass | 59 * 1e18 ($59) | 1,000,000 |
| SolarPass | 299 * 1e18 ($299) | 1,000,000 |
| ComputePass | 899 * 1e18 ($899) | 1,000,000 |

### 2.3 部署后验证

```bash
# 读取合约参数
cast call $SEEDPASS "MAX_SUPPLY()" --rpc-url $BSC_RPC_URL
# → 1000000

cast call $SEEDPASS "price()" --rpc-url $BSC_RPC_URL
# → 29000000000000000000 (29 * 1e18)

cast call $SEEDPASS "treasury()" --rpc-url $BSC_RPC_URL
# → 0x...

# 总供应量信息
cast call $SEEDPASS \
    "supplyInfo()(uint256,uint256,uint256)" \
    --rpc-url $BSC_RPC_URL
# → (0, 1000000, 1000000)
#    (minted, maxSupply, remaining)
```

---

## 3. Agent License 管理（Admin 操作）

### 3.1 授予 Agent License

```bash
# 给 Agent_A 授予 SeedPass 79,000 额度
cast send $SEEDPASS \
    "grantLicense(address,uint256)" \
    $AGENT_A 79000 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# 给同一 Agent_A 授予 SolarPass 200 额度
cast send $SOLARPASS \
    "grantLicense(address,uint256)" \
    $AGENT_A 200 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL
```

**执行结果**：
- Agent_A 钱包出现 2 张 License NFT：
  - 📋 SeedPass License（图上印 "79,000"）
  - 📋 SolarPass License（图上印 "200"）
- 链上 `licenses[Agent_A]` 记录额度

### 3.2 查询 Agent 信息

```bash
# 查询 License 完整信息
cast call $SEEDPASS \
    "getLicense(address)(uint256,uint256,uint256,uint256,bool)" \
    $AGENT_A \
    --rpc-url $BSC_RPC_URL
# → (tokenId, 79000, 0, 79000, true)
#    (tokenId, quota, used, remaining, active)
```

### 3.3 调整 Agent 额度

```bash
# Agent 业绩好，调整总额度到 89,000
cast send $SEEDPASS \
    "adjustQuota(address,uint256)" \
    $AGENT_A 89000 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# 验证: quota 变为 89,000
cast call $SEEDPASS \
    "getLicense(address)(uint256,uint256,uint256,uint256,bool)" \
    $AGENT_A --rpc-url $BSC_RPC_URL
```

### 3.4 撤销 Agent

```bash
# 撤销 Agent_A 的 SeedPass License
cast send $SEEDPASS \
    "revokeLicense(address)" \
    $AGENT_A \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# License NFT 保留在 Agent 钱包（当作历史记录），License 标记为 inactive
# revokeLicense 不会 burn NFT，只设 active=false → adminMintForAgent 会 revert NotLicensed
```

---

## 4. 散客购买（用户自操作）

```bash
# 客户先 approve USDT
cast send $USDT \
    "approve(address,uint256)" \
    $SEEDPASS $(cast --to-wei 29) \
    --private-key $CUSTOMER_KEY \
    --rpc-url $BSC_RPC_URL

# 客户调用 mint 购买 1 个
cast send $SEEDPASS \
    "mint(uint256)" \
    1 \
    --private-key $CUSTOMER_KEY \
    --rpc-url $BSC_RPC_URL
# → $29 USDT → treasury
# → 铸造 SeedPass #N → 客户钱包

# 批量购买 5 个
cast send $USDT \
    "approve(address,uint256)" \
    $SEEDPASS $(cast --to-wei 145) \
    --private-key $CUSTOMER_KEY \
    --rpc-url $BSC_RPC_URL

cast send $SEEDPASS \
    "mint(uint256)" \
    5 \
    --private-key $CUSTOMER_KEY \
    --rpc-url $BSC_RPC_URL
# → $145 USDT → treasury
# → 铸造 5 个 SeedPass → 客户钱包
```

---

## 5. Admin 铸造操作

### 5.1 空投/赠送（adminMint）

```bash
# 给合作方赠送 500 个 SeedPass（不涉及 Agent，不收 USDT）
cast send $SEEDPASS \
    "adminMint(address,uint256)" \
    $PARTNER 500 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL
# → 铸造 500 个 SeedPass → 合作方钱包
# → 不影响任何 Agent 额度
```

### 5.2 Agent 代售结算（adminMintForAgent）

> **核心流程**：Agent 链下收款 → 付款给我们 → 我们确认后 Admin 链上铸造

#### 一笔大单的完整流程

> **场景**: Agent_A 卖出 30,000 个 SeedPass

```
═══ 步骤 1: 链下结算 ═══

  客户 → 付 $870,000 → Agent_A
  Agent_A → 留佣金（线下约定比例）→ 剩余付给我们
  ⚠️ 合约不介入 Agent 与客户之间的资金流转

═══ 步骤 2: 我们确认收款后，Admin 链上铸造 ═══
```

```bash
# Admin 为 Agent_A 的客户铸造 30,000 个 SeedPass
cast send $SEEDPASS \
    "adminMintForAgent(address,address,uint256)" \
    $AGENT_A $CUSTOMER 30000 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# 结果:
# Agent_A License: used 0 → 30,000 → remaining 49,000
# 客户: 钱包出现 30,000 个 SeedPass 收藏品
```

#### 验证

```bash
# Agent 状态
cast call $SEEDPASS \
    "getLicense(address)(uint256,uint256,uint256,uint256,bool)" \
    $AGENT_A --rpc-url $BSC_RPC_URL
# → (..., 79000, 30000, 49000, true)
#         quota  used   remaining  active

# 总供应量
cast call $SEEDPASS \
    "supplyInfo()(uint256,uint256,uint256)" \
    --rpc-url $BSC_RPC_URL
# → (30000, 1000000, 970000)
#    (minted, maxSupply, remaining)
```

#### 多次小批量结算

```bash
# Agent_A 又卖了 5,000 个给不同客户
cast send $SEEDPASS \
    "adminMintForAgent(address,address,uint256)" \
    $AGENT_A $CUSTOMER_B 3000 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

cast send $SEEDPASS \
    "adminMintForAgent(address,address,uint256)" \
    $AGENT_A $CUSTOMER_C 2000 \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# Agent_A: used 30,000 → 35,000 → remaining 44,000
```

---

## 6. 元数据与图片

### 6.1 图片清单（`assets/icons/`）

| Pass | 收藏品图 | 状态 | License 图 | 状态 |
|------|---------|:----:|-----------|:----:|
| SeedPass | `seedpass.jpg` (80KB) | ✅ | `seedagent.png` (1.3MB) | ✅ |
| TreePass | `treepass.jpg` (94KB) | ✅ | *缺 `treeagent.png`* | ❌ |
| SolarPass | `solarpass.jpg` (66KB) | ✅ | `solaragent.png` (1.7MB) | ✅ |
| ComputePass | `computepass.jpg` (63KB) | ✅ | *缺 `computeagent.png`* | ❌ |

> **6/8 张已就绪**。缺 TreePass 和 ComputePass 的 Agent License 版。
> **图片不阻塞合约部署** — `setCollectibleBaseURI` / `setLicenseBaseURI` 可随时调用。
> License 图上需印额度数字（可后期 PS 叠加或用 metadata API 动态生成）。

### 6.2 设置 BaseURI

```bash
# 设置收藏品 BaseURI
cast send $SEEDPASS \
    "setCollectibleBaseURI(string)" \
    "https://api.agvnexrur.ai/metadata/seedpass/" \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL

# 设置 License BaseURI
cast send $SEEDPASS \
    "setLicenseBaseURI(string)" \
    "https://api.agvnexrur.ai/metadata/seedpass-license/" \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL
```

### 6.3 元数据 JSON 格式

**收藏品元数据**（每个 tokenId 一个 JSON）：
```json
{
  "name": "SeedPass #12345",
  "description": "AGV SeedPass — 入门级身份凭证",
  "image": "ipfs://Qm.../seedpass-collectible.png",
  "attributes": [
    { "trait_type": "Pass Type", "value": "Seed" },
    { "trait_type": "Tier", "value": "Entry" },
    { "trait_type": "Price (USDT)", "display_type": "number", "value": 29 }
  ]
}
```

**License 元数据**（每个 License tokenId 一个 JSON，可动态生成）：
```json
{
  "name": "SeedPass Agent License",
  "description": "Agent distribution license for SeedPass — Quota: 79,000",
  "image": "ipfs://Qm.../seedpass-license-79000.png",
  "attributes": [
    { "trait_type": "Pass Type", "value": "Seed" },
    { "trait_type": "Total Quota", "display_type": "number", "value": 79000 },
    { "trait_type": "Used", "display_type": "number", "value": 0 },
    { "trait_type": "Remaining", "display_type": "number", "value": 79000 }
  ]
}
```

---

## 7. 紧急操作

### 7.1 暂停合约

```bash
# 发现异常 → 立即暂停所有铸造
cast send $SEEDPASS "pause()" --private-key $PRIVATE_KEY --rpc-url $BSC_RPC_URL
cast send $TREEPASS "pause()" --private-key $PRIVATE_KEY --rpc-url $BSC_RPC_URL
cast send $SOLARPASS "pause()" --private-key $PRIVATE_KEY --rpc-url $BSC_RPC_URL
cast send $COMPUTEPASS "pause()" --private-key $PRIVATE_KEY --rpc-url $BSC_RPC_URL

# 恢复
cast send $SEEDPASS "unpause()" --private-key $PRIVATE_KEY --rpc-url $BSC_RPC_URL
```

### 7.2 UUPS 升级

```bash
# 编译新 implementation
forge build

# 部署新 implementation
forge create contracts/nft/SeedPass.sol:SeedPass \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL \
    --verify --etherscan-api-key $BSCSCAN_API_KEY

# 升级 proxy
cast send $SEEDPASS_PROXY \
    "upgradeToAndCall(address,bytes)" \
    $NEW_IMPL "0x" \
    --private-key $PRIVATE_KEY \
    --rpc-url $BSC_RPC_URL
```

---

## 8. 监控与查询

### 8.1 全局状态

```bash
# 总供应量信息
cast call $SEEDPASS \
    "supplyInfo()(uint256,uint256,uint256)" \
    --rpc-url $BSC_RPC_URL
# → (minted, maxSupply, remaining)
```

### 8.2 Agent 销售排行

```bash
# 查询多个 Agent 的 used 数量
for agent in $AGENT_A $AGENT_B $AGENT_C; do
    echo "Agent: $agent"
    cast call $SEEDPASS \
        "getLicense(address)(uint256,uint256,uint256,uint256,bool)" \
        $agent --rpc-url $BSC_RPC_URL
done
```

### 8.3 事件监听

```bash
# 监听散客购买
cast logs --from-block latest \
    --address $SEEDPASS \
    "Mint(address,uint256,uint256)" \
    --rpc-url $BSC_RPC_URL

# 监听 Admin 铸造
cast logs --from-block latest \
    --address $SEEDPASS \
    "AdminMint(address,uint256)" \
    --rpc-url $BSC_RPC_URL

# 监听 Agent 代铸结算
cast logs --from-block latest \
    --address $SEEDPASS \
    "AgentMintFulfilled(address,address,uint256)" \
    --rpc-url $BSC_RPC_URL

# 监听 License 授予/撤销
cast logs --from-block latest \
    --address $SEEDPASS \
    "LicenseGranted(address,uint256,uint256)" \
    --rpc-url $BSC_RPC_URL

cast logs --from-block latest \
    --address $SEEDPASS \
    "LicenseRevoked(address,uint256)" \
    --rpc-url $BSC_RPC_URL
```

---

## 9. 典型操作速查

| 操作 | 执行者 | 函数 | USDT 流向 |
|------|--------|------|-----------|
| 散客购买 | 客户 | `mint(qty)` | 客户 → treasury |
| 授权 Agent | Admin | `grantLicense(agent, quota)` | 无 |
| 调整额度 | Admin | `adjustQuota(agent, newQuota)` | 无 |
| 撤销 Agent | Admin | `revokeLicense(agent)` | 无（burn License NFT） |
| 空投/赠送 | Admin | `adminMint(to, qty)` | 无 |
| Agent 结算铸造 | Admin | `adminMintForAgent(agent, to, qty)` | 无（链下已结算） |
| 暂停 | Admin | `pause()` | 无 |
| 恢复 | Admin | `unpause()` | 无 |

> **V3 核心简化**：Agent **本人无需任何链上操作**。所有 Agent 相关铸造都由 Admin 通过 `adminMintForAgent` 完成，确保“先款后货”。

---

## 10. 安全检查清单

### 部署前（阶段 1）

- [x] `forge test -vvv` 全部通过（61 个测试全绿）
- [x] 合约代码零 TODO/FIXME
- [x] `.env` 已创建（从 `tokencontracts-main/.env` 复用凭据）
- [x] `.env.example` 已更新为 V3 模板
- [x] `.gitignore` 包含 `.env`（不会误提交私钥）
- [ ] USDT 地址正确（BSC: `0x55d398326f99059fF775485246999027B3197955`）
- [ ] Treasury 地址正确
- [ ] Deployer 钱包有足够 BNB 支付 gas（8 个合约部署约 0.1-0.3 BNB）
- [ ] 价格正确（18 decimals: $29 = 29000000000000000000）
- [ ] MAX_SUPPLY = 1,000,000

### 部署后（阶段 1 完成后立即验证）

- [ ] `forge script` 输出 8 个地址（4 impl + 4 proxy）→ 记录到上方 §1 表格
- [ ] BscScan 合约验证通过（`--verify` 自动提交）
- [ ] `cast call $PROXY "price()"` 返回正确价格
- [ ] `cast call $PROXY "supplyInfo()"` 返回 `(0, 1000000, 1000000)`
- [ ] `cast call $PROXY "hasRole(bytes32,address)" $ADMIN_ROLE $ADMIN` 返回 `true`
- [ ] 非 Admin 地址调 `adminMint` revert

### 元数据配置后（阶段 2）

- [ ] `setCollectibleBaseURI` 设置 4 个合约
- [ ] `setLicenseBaseURI` 设置 4 个合约
- [ ] `tokenURI(tokenId)` 返回正确 URL

### 业务验证（阶段 3 开售前）

- [ ] 散客 `mint(1)` 正确收取 USDT 并铸造
- [ ] `grantLicense` 铸造 Soulbound License NFT 到 Agent 钱包
- [ ] `adminMintForAgent` 扣减 Agent 额度并铸造给指定地址
- [ ] `adminMint` 直接铸造（不影响 Agent 额度）
- [ ] License token 不可转让（Soulbound — transfer revert）
- [ ] 收藏品 token 可正常转让
- [ ] `pause()` 阻断所有铸造
- [ ] 超过 Agent quota 时 revert
- [ ] 超过 MAX_SUPPLY 时 revert
- [ ] 前端 `buy.agvnexrur.ai` 更新 V3 合约地址 + ABI

> **foundry.toml 提示**：当前 `[rpc_endpoints]` 无 BSC，部署时通过 CLI `--rpc-url $BSC_RPC_URL` 传入即可。如需 `forge verify-contract` 单独验证，在 `[etherscan]` 中添加：
> ```toml
> [etherscan]
> bsc = { key = "${BSCSCAN_API_KEY}", url = "https://api.bscscan.com/api" }
> ```
