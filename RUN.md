# AGV Token 部署与操作指南

> **链**: BNB Chain (BSC Mainnet, Chain ID 56)
>
> **代币**: pGVT (presale voucher) + sGVT (display/price anchor)

---

## 前置准备

### 1. 安装 Foundry

```bash
# Windows — 下载 nightly binary
# https://github.com/foundry-rs/foundry/releases
# 解压到 %USERPROFILE%\.foundry\bin

# 验证
forge --version
```

### 2. 配置环境变量

在 `tokencontracts-main/` 目录下创建 `.env` 文件：

```env
# 部署者私钥（即你的钱包私钥）
PRIVATE_KEY=0x...

# 你的钱包地址（接收 pGVT + sGVT 的目标地址）
AIRDROP_TO=0x...

# 第一步部署完成后填入（第二步需要）
PGVT_ADDRESS=0x...
SGVT_ADDRESS=0x...
```

### 3. 确保钱包有足够资产

| 资产 | 数量 | 用途 |
|---|---|---|
| BNB | ~0.05 BNB | Gas 费 |
| USDT (BSC) | 5,500 USDT | 建 LP 池 |

BSC USDT 合约: `0x55d398326f99059fF775485246999027B3197955`

---

## 第一步：部署合约 + 铸造空投

部署 pGVT 和 sGVT 合约，各铸造 100 万代币到你的钱包。

```bash
cd tokencontracts-main

forge script script/AirdropMint.s.sol:AirdropMint \
  --rpc-url https://bsc-dataseed.binance.org \
  --broadcast \
  --private-key <你的私钥> \
  -s "run(address)" <你的钱包地址>
```

或者使用 `.env` 文件：

```bash
source .env

forge script script/AirdropMint.s.sol:AirdropMint \
  --rpc-url https://bsc-dataseed.binance.org \
  --broadcast
```

### 输出

脚本会打印：

```
pGVT  deployed: 0x...   ← 记录这个地址！
sGVT  deployed: 0x...   ← 记录这个地址！
wallet pGVT balance: 1000000
wallet sGVT balance: 1000000
```

**将部署的地址填入 `.env` 的 `PGVT_ADDRESS` 和 `SGVT_ADDRESS`。**

### 结果

| 代币 | Symbol | 钱包余额 | 状态 |
|---|---|---|---|
| pGVT | `pGVT` | 1,000,000 | 可后续 mint 追加 |
| sGVT | `sGVT` | 1,000,000 | 固定供应，全部在你手里 |

---

## 第二步：添加 PancakeSwap 流动性（定价）

在 PancakeSwap V2 上建立 LP 池，让代币有价格。

```bash
forge script script/AddLiquidity.s.sol:AddLiquidity \
  --rpc-url https://bsc-dataseed.binance.org \
  --broadcast \
  --private-key <你的私钥>
```

### 定价参数

| 代币 | LP 代币量 | LP USDT 量 | 目标价格 |
|---|---|---|---|
| pGVT | 100,000 | 500 USDT | **$0.005** |
| sGVT | 10,000 | 5,000 USDT | **$0.5** |

> 要调整 LP 池大小或价格，修改 `script/AddLiquidity.s.sol` 顶部的常量。
> 池子越大 → 价格越稳定，抗波动能力越强。

### 结果

| 代币 | 价格 | 剩余可空投 |
|---|---|---|
| pGVT | $0.005 | 900,000 |
| sGVT | $0.5 | 990,000 |

LP 建好后，MetaMask / Trust Wallet / BscScan 上就能看到价格。

---

## 后续操作

### 追加铸造 pGVT

pGVT 有 `mint()` 函数，持有 MINTER_ROLE 的地址可以追加铸造：

```bash
# 通过 cast 直接调用
cast send <PGVT_ADDRESS> "mint(address,uint256)" <目标地址> <数量> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <私钥>
```

数量需要带 18 位小数，例如铸造 50 万：
```bash
cast send <PGVT_ADDRESS> "mint(address,uint256)" <目标地址> 500000000000000000000000 \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <私钥>
```

### 转账 sGVT 给别人

sGVT 没有 mint 函数，只能从你钱包 transfer：

```bash
cast send <SGVT_ADDRESS> "transfer(address,uint256)" <接收地址> <数量> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <私钥>
```

### 查余额

```bash
# pGVT 余额
cast call <PGVT_ADDRESS> "balanceOf(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org

# sGVT 余额
cast call <SGVT_ADDRESS> "balanceOf(address)(uint256)" <钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org
```

---

## 文件清单

| 文件 | 说明 |
|---|---|
| `contracts/tokens/pGVT.sol` | pGVT 合约 — 轻量 ERC20，admin 可 mint |
| `contracts/tokens/ShadowGVT.sol` | sGVT 合约 — 固定供应 ERC20 |
| `script/AirdropMint.s.sol` | 第一步：部署 + 铸造空投脚本 |
| `script/AddLiquidity.s.sol` | 第二步：PancakeSwap LP 定价脚本 |

---

## 注意事项

1. **私钥安全**：不要将 `.env` 文件提交到 Git（已在 `.gitignore` 中排除）
2. **LP 池深度**：池子太浅容易被砸穿，建议根据实际空投量调整 LP 投入
3. **Symbol 区分**：新 pGVT symbol 为 `pGVT`，与链上已有 `preGVT` 不同；sGVT 同名但不同合约地址
4. **Gas**：BSC 上 Gas 很便宜，两步操作总计约 0.01-0.05 BNB
5. **验证合约**：部署后建议在 BscScan 上 verify source code，增加可信度

---

## NFT Pass 部署与机构(Agent)铸造指南

> NFT 合约位于 `agvprotocol-contracts-main/contracts/nft/`

### NFT Pass 一览

| Pass | 总量 | 公开/白名单 | 机构预留 | 公开价 | 机构价 | 版税 |
|------|------|-----------|---------|--------|--------|------|
| ComputePass | 99 | 49 | 50 | $899 | $499 | 3% |
| SolarPass | 300 | 200 | 100 | $299 | $199 | 3% |
| TreePass | 300 | 200+100(WL) | — | $59 | — | 5% |
| SeedPass | 600 | 400+200(WL) | — | $29 | — | 5% |

> ComputePass 和 SolarPass 支持机构铸造（agentMint），TreePass 和 SeedPass 目前只有公开/白名单铸造。

---

### NFT 图片与元数据设置

NFT 图片不存在区块链上，通过 IPFS 元数据间接引用。每个 Pass 有 **正式图片** 和 **机构图片** 两种。

#### 第一步：准备 8 张图片

| # | 文件名（建议） | 用途 |
|---|---|---|
| 1 | `compute-public.png` | ComputePass 正式铸造 |
| 2 | `compute-agent.png` | ComputePass 机构铸造 |
| 3 | `solar-public.png` | SolarPass 正式铸造 |
| 4 | `solar-agent.png` | SolarPass 机构铸造 |
| 5 | `tree-public.png` | TreePass 正式铸造 |
| 6 | `tree-agent.png` | TreePass 机构铸造（预留） |
| 7 | `seed-public.png` | SeedPass 正式铸造 |
| 8 | `seed-agent.png` | SeedPass 机构铸造（预留） |

#### 第二步：上传图片到 IPFS

推荐使用 [Pinata](https://pinata.cloud)（免费额度足够）：

1. 注册 Pinata 账号
2. 点击 **Upload** → **File**，上传 8 张图片
3. 每张图片会得到一个 CID，格式如：`QmXyz123...`
4. 图片 URL 为：`ipfs://QmXyz123...`

#### 第三步：为每个 Pass 创建元数据 JSON 文件夹

**ComputePass 正式铸造元数据**（文件夹 `compute-public/`）：

为 tokenId 1~49 各创建一个无后缀 JSON 文件，内容统一：

```json
{
  "name": "AGV ComputePass #TOKEN_ID",
  "description": "AGV Protocol ComputePass - Premium Tier",
  "image": "ipfs://Qm图片CID（compute-public.png的CID）",
  "attributes": [
    { "trait_type": "Tier", "value": "Compute" },
    { "trait_type": "Supply", "value": "99" },
    { "trait_type": "Mint Type", "value": "Public" }
  ]
}
```

**ComputePass 机构铸造元数据**（文件夹 `compute-agent/`）：

为 tokenId 50~99 各创建一个无后缀 JSON 文件：

```json
{
  "name": "AGV ComputePass #TOKEN_ID (Agent)",
  "description": "AGV Protocol ComputePass - Agent Certified Edition",
  "image": "ipfs://Qm图片CID（compute-agent.png的CID）",
  "attributes": [
    { "trait_type": "Tier", "value": "Compute" },
    { "trait_type": "Supply", "value": "99" },
    { "trait_type": "Mint Type", "value": "Agent" }
  ]
}
```

> 其他 Pass 同理，替换名称、图片 CID 和属性值即可。
>
> 如果所有同类 token 共用同一张图，JSON 内容可完全相同，只是文件名（tokenId）不同。

#### 第四步：上传 JSON 文件夹到 IPFS

在 Pinata 上传整个文件夹（如 `compute-public/`），得到文件夹 CID。

#### 第五步：调用合约设置 BaseURI

**ComputePass：**

```bash
cast send <COMPUTE_PASS_ADDRESS> \
  "setBaseURI(string)" "ipfs://QmComputePass元数据文件夹CID/" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

**SolarPass：**

```bash
cast send <SOLAR_PASS_ADDRESS> \
  "setBaseURI(string)" "ipfs://QmSolarPass元数据文件夹CID/" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

**TreePass / SeedPass：**

```bash
cast send <TREE_PASS_ADDRESS> \
  "setBaseURI(string)" "ipfs://QmTree正式CID/" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>

cast send <SEED_PASS_ADDRESS> \
  "setBaseURI(string)" "ipfs://QmSeed正式CID/" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

> **重要**：URI 末尾必须有 `/`，否则 `tokenURI(1)` 会变成 `ipfs://QmCID1` 而不是 `ipfs://QmCID/1`。

#### 第六步：锁定元数据（可选，不可逆）

确认图片无误后，调用 `freezeMetadata()` 永久锁定，之后无法再修改 URI：

```bash
cast send <PASS_ADDRESS> "freezeMetadata()" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

---

### 机构(Agent)铸造操作流程

#### 1. 部署 AgentRegistry

```bash
cd agvprotocol-contracts-main

forge script script/AgentRegistry.s.sol:DeployAgentRegistry \
  --rpc-url https://bsc-dataseed.binance.org \
  --broadcast \
  --private-key <ADMIN私钥>
```

记录输出的 AgentRegistry 合约地址。

#### 2. 将 AgentRegistry 绑定到 NFT 合约

```bash
# ComputePass 绑定
cast send <COMPUTE_PASS_ADDRESS> \
  "setAgentRegistry(address)" <AGENT_REGISTRY_ADDRESS> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>

# SolarPass 绑定
cast send <SOLAR_PASS_ADDRESS> \
  "setAgentRegistry(address)" <AGENT_REGISTRY_ADDRESS> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

#### 3. 注册机构 + 分配配额

```bash
# 给机构地址设置 ComputePass 配额（如 10 个）
cast send <AGENT_REGISTRY_ADDRESS> \
  "setQuota(address,address,uint256)" <机构钱包地址> <COMPUTE_PASS_ADDRESS> 10 \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>

# 给机构地址设置 SolarPass 配额（如 20 个）
cast send <AGENT_REGISTRY_ADDRESS> \
  "setQuota(address,address,uint256)" <机构钱包地址> <SOLAR_PASS_ADDRESS> 20 \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

#### 4. 授予机构铸造角色

```bash
# ComputePass
cast send <COMPUTE_PASS_ADDRESS> \
  "grantAgentRole(address)" <机构钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>

# SolarPass
cast send <SOLAR_PASS_ADDRESS> \
  "grantAgentRole(address)" <机构钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

#### 5. 机构执行铸造

机构用自己的钱包（需提前 approve USDT 给 Pass 合约）：

```bash
# 先 approve USDT（机构钱包操作）
cast send 0x55d398326f99059fF775485246999027B3197955 \
  "approve(address,uint256)" <COMPUTE_PASS_ADDRESS> 999999999999 \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <机构私钥>

# 机构铸造 ComputePass 给 2 个用户，各 1 个
cast send <COMPUTE_PASS_ADDRESS> \
  "agentMint(address[],uint256[])" "[<用户A地址>,<用户B地址>]" "[1,1]" \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <机构私钥>
```

> 费用：机构自付 USDT（$499/个 ComputePass，$199/个 SolarPass），直接转到 Treasury。

#### 6. 查询机构信息

```bash
# 查看机构是否已注册
cast call <AGENT_REGISTRY_ADDRESS> \
  "isAgent(address)(bool)" <机构钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org

# 查看剩余配额
cast call <AGENT_REGISTRY_ADDRESS> \
  "getRemaining(address,address)(uint256)" <机构钱包地址> <COMPUTE_PASS_ADDRESS> \
  --rpc-url https://bsc-dataseed.binance.org

# 查看机构详情（配额、已铸造、是否激活）
cast call <AGENT_REGISTRY_ADDRESS> \
  "getAgentInfo(address,address)(uint256,uint256,bool)" <机构钱包地址> <COMPUTE_PASS_ADDRESS> \
  --rpc-url https://bsc-dataseed.binance.org
```

#### 7. 吊销机构（如需要）

```bash
# 吊销机构所有NFT合约的配额
cast send <AGENT_REGISTRY_ADDRESS> \
  "revokeAgent(address)" <机构钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>

# 同时撤销铸造角色
cast send <COMPUTE_PASS_ADDRESS> \
  "revokeAgentRole(address)" <机构钱包地址> \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key <ADMIN私钥>
```

---

### 快速操作清单

| 步骤 | 操作 | 执行者 |
|------|------|--------|
| 1 | 部署 4 个 NFT Pass 合约 | Admin |
| 2 | 部署 AgentRegistry | Admin |
| 3 | 绑定 AgentRegistry 到 ComputePass/SolarPass | Admin |
| 4 | 上传 8 张图片到 IPFS | Admin |
| 5 | 为每个 Pass 生成元数据 JSON 并上传 IPFS | Admin |
| 6 | 调用 setBaseURI / setAgentBaseURI 设置元数据 | Admin |
| 7 | 注册机构 + 设置配额 (setQuota) | Admin |
| 8 | 授予机构铸造角色 (grantAgentRole) | Admin |
| 9 | 机构 approve USDT 给 Pass 合约 | 机构 |
| 10 | 机构调用 agentMint 铸造 NFT 给用户 | 机构 |
| 11 | 确认无误后 freezeMetadata 锁定 | Admin |
