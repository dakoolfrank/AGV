# 【内部通知】关于响应银发〔2026〕42 号文件进行代币架构合规迁移的说明

> **发文单位**: AGV NEXRUR AGENT 技术管理委员会  
> **发文日期**: 2026 年 3 月 13 日  
> **密级**: 内部（仅限骨干人员）  
> **版本**: v1.0

---

## 一、背景与原因

### 1.1 监管环境变化

2026 年 2 月 6 日，中国人民银行等八部委联合发布《关于进一步规范虚拟资产与现实世界资产相关业务的通知》（银发〔2026〕42 号，以下简称"42 号文件"）。同日，中国证监会发布《境内资产境外发行资产支持证券代币业务的监管指引》（证监会公告〔2026〕1 号）及《境内资产境外发行资产支持证券代币业务备案指引第 1 号》。

上述文件首次为境内资产通过区块链技术在境外发行代币化权益凭证提供了合法合规路径，同时明确了以下核心要求：

| 维度 | 42 号文件要求 |
|------|-------------|
| **穿透式监管** | 能够识别实际控制人及资产的最终受益方 |
| **资产映射路径** | 代币与底层资产之间的映射关系必须清晰、可审计 |
| **信息披露** | 资金流向、代币用途、收益分配机制须持续合规披露 |
| **分类监管** | RWA 按债类（银保监管）、股权类/资产证券化（证监管）、衍生品类（对应部门）分别归口 |
| **备案制度** | 通过证监会 NERIS 平台（https://neris.csrc.gov.cn/）进行网上备案申报 |

### 1.2 为什么需要迁移

经与法律及合规顾问充分沟通后，我们确认：**早期发行的 AGV Protocol 代币在以下方面不满足 42 号文件的合规要求**：

- **资产映射路径不清晰** — 早期代币的发行机制混合了实验性与功能性用途，无法做穿透式监管
- **历史流通记录不规范** — 部分早期空投/转账未按合规要求保留完整审计链路
- **代币用途界定模糊** — 更接近"实验性与功能性混合形态"，不利于持续合规披露
- **主体不明确** — 旧主体"AGV Protocol Foundation"未按新规进行备案登记

### 1.3 迁移决策

为响应 42 号文件的监管导向，降低合规不确定性，并为后续引入更多真实资产标的及机构资金预留空间，**经管理层决议**：

> **以 AGV NEXRUR AGENT 作为全新的合规基准主体，以 pGVT / sGVT / GVT 三代币体系作为全新的合规基准代币，对原 AGV Protocol 进行替代与承接。**

在保持原有骨干人员经济权益（持有人可按约定比例认领/映射）的前提下，新代币体系在以下维度全部按 42 号文件要求重新设计：

- ✅ 发行机制（V3 合规闭环架构，7 角色权限模型）
- ✅ 资产对应关系（物理电站 → Oracle 验证 → 链上锚定，可穿透审计）
- ✅ 资金用途披露（内建预售 `buy()` → treasury 直达，链上可追溯）
- ✅ 链上治理结构（DAO Controller + Vesting + Staking 追踪）
- ✅ 备案对接准备（NERIS 平台账号开设及材料准备中）

---

## 二、新合规架构说明

### 2.1 主体变更

| 维度 | 旧 | 新 |
|------|-----|-----|
| **法律主体** | AGV Protocol Foundation | **AGV NEXRUR AGENT** |
| **域名** | *(分散)* | **agvnexrur.ai**（已备案） |
| **链上部署钱包** | 同下 | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` |
| **Agent 治理** | 无 | nexrur 底座 + 4 主 Subagent 流水线 |

### 2.2 为什么使用 Agent 架构

42 号文件要求的"持续合规披露"意味着项目必须有**持续的运维能力**来完成：链上数据核验、Oracle 喂价、前端/合约巡检、社区运营等日常工作。

传统项目依赖 30+ 人的运维团队，成本高且难以保证一致性。**AGV NEXRUR AGENT 的设计理念是用 Agent 集群替代人力密集的运维工作**，保障合规披露的持续性和可审计性：

| Agent | 职责 | 合规关联 |
|-------|------|---------|
| **S1 Asset + Oracle** | 物理电站数据采集 → EIP-712 签名 → 链上锚定 | 资产映射路径的技术保障 |
| **S2 Chain Ops** | 合约审计 → 部署 → 升级 → 链上对账 | 穿透式监管的基础设施 |
| **S3 Digital Ops** | 网站巡检 → 内容更新 → 状态监控 | 信息披露的持续性保障 |
| **S4 KOL Ops** | 社区运营 → 内容发布 → 合规传播 | 投资者教育与合规宣传 |

所有 Agent 运行均产出 `StepOutcome`（运行结果）+ `audit.jsonl`（审计日志）+ `evidence.jsonl`（决策证据），形成**完整的合规审计链路**。

---

## 三、新合约地址与批复状态

### 3.1 已部署合约（BNB Chain / BSC Mainnet, Chain ID 56）

| 合约 | 地址 | 类型 | 合规状态 |
|------|------|------|---------|
| **pGVT** (预售凭证) | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` | ERC20, V3 合规闭环, 7 角色 | ✅ 已部署，42 号文件对齐 |
| **sGVT** (机构凭证) | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` | ERC20, 注册制, 白名单 | ✅ 已部署，42 号文件对齐 |
| **Airdrop Badge** | `0x704fa14df689ebdfaa4615019ab23a99c6041b29` | ERC1155, 空投徽章 | ✅ 已部署 |
| **NFT Pass** (4 类) | *(见 agvprotocol-contracts)* | ERC721A + UUPS | ✅ 已部署 |
| **GVT** (主令牌) | *(TGE 时部署)* | ERC20, 1B Cap, Permit | ⏳ 待 TGE |

### 3.2 代币参数

| Token | 最大供应量 | 已发行 | 已空投 | LP 流动性 | 单价 |
|-------|----------|--------|--------|----------|------|
| **pGVT** | 100,000,000 | 3,000,000 | 730,000 | PancakeSwap V2 | $0.005 |
| **sGVT** | 100,000,000 | 30,000,000 | 21,130,000 | PancakeSwap V2 | $0.50 |
| **GVT** | 1,000,000,000 | — | — | — | 待定 |

### 3.3 DEX 流动性池

| 交易对 | LP Pair 地址 | 平台 |
|--------|-------------|------|
| pGVT / USDT | `0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0` | PancakeSwap V2 |
| sGVT / USDT | `0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d` | PancakeSwap V2 |

### 3.4 上币审核与批复状态

| 平台 | pGVT | sGVT | 状态 |
|------|------|------|------|
| **BscScan** 合约验证 | ✅ Verified | ✅ Verified | 合约源码已验证 |
| **BscScan** Token Info | ✅ 已通过 | ✅ 已通过 | logo + 项目信息已显示，**待更新邮箱+网址** |
| **GeckoTerminal** | ✅ Regular Pass | ✅ Regular Pass | 已索引 + Token Info 通过 |
| **CoinGecko** | ❌ 被拒 (CL1203260035) | ❌ 被拒 (CL1303260002) | **暂缓重审**（等 Arb→MM→KOL 就位后再申） |
| **PancakeSwap** | ✅ 可交易 | ✅ 可交易 | 已创建流动性 |
| **Trust Wallet** | ⏳ 暂缓 | ⏳ 暂缓 | PR #35878 已提交但 assets repo 收费太贵，暂放 |

### 3.5 pGVT V3 合规改进要点

较旧版本的核心改进（与 42 号文件对齐）：

| 维度 | 旧架构 | V3 合规架构 | 42 号文件对应要求 |
|------|--------|------------|-----------------|
| 权限模型 | 4 角色 | **7 角色细粒度分权** | 穿透式监管（可识别各角色权责） |
| 供应上限 | 三层 Cap (250M) | **单一 MAX_SUPPLY = 100M** | 资金用途清晰 |
| 预售机制 | 外部合约 | **内建 `buy()` + 可选 pSale** | 资金流向可追溯（直达 treasury） |
| 锁仓合规 | 无 | **Vesting + Staking + `sealVesting()`** | 防投机，有序释放 |
| TGE 转换 | admin 批量换发 | **用户自助 `convertToGVT()`** | 去中心化，无 admin 干预 |
| 审计链路 | 无 | **Agent StepOutcome + audit.jsonl** | 持续合规披露 |

---

## 四、新网址及平台

### 4.1 官方网站矩阵

所有网站均已切换至 **agvnexrur.ai** 域名体系，内容已按 42 号文件要求进行合规更新：

| 网站 | 地址 | 功能 | 状态 |
|------|------|------|------|
| **主站** (DApp) | https://agvnexrur.ai | 资产总览、NFT 管理、余额查询 | ✅ 在线 |
| **认领页** | https://buy.agvnexrur.ai | NFT 购买 + **空投认领 (claim)** | ✅ 在线 |
| **融资页** | https://fund.agvnexrur.ai | pGVT 预售购买、Staking | ✅ 在线 |
| **投资者门户** | https://invest.agvnexrur.ai | 投资者仪表盘 | ⏳ 部署中 |
| **资产展示** | https://assets.agvnexrur.ai | 物理资产地理展示 | ⏳ 部署中 |
| **架构文档** | https://docs.agvnexrur.ai | 技术架构与白皮书 | ⏳ 部署中 |

### 4.2 链上验证链接

| 平台 | pGVT | sGVT |
|------|------|------|
| BscScan | https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 | https://bscscan.com/token/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3 |
| GeckoTerminal | https://www.geckoterminal.com/bsc/pools/0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0 | https://www.geckoterminal.com/bsc/pools/0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d |
| PancakeSwap | https://pancakeswap.finance/swap?outputCurrency=0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9 | https://pancakeswap.finance/swap?outputCurrency=0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3 |

### 4.3 社交平台（官方渠道）

| 平台 | 账号 | 地址 |
|------|------|------|
| **Twitter / X** | @agvnexrur | https://x.com/agvnexrur |
| **Discord** | AGV NEXRUR | https://discord.gg/mJKTyqWtKe |
| **Telegram** | @agvnexrur_bot | https://t.me/agvnexrur_bot |
| **GitHub** | dakoolfrank/AGV | https://github.com/dakoolfrank/AGV |

---

## 五、骨干人员代币认领说明

### 5.1 认领资格

**仅限获得管理层确认的内部骨干人员。** 认领额度根据：原 AGV Protocol 持有量、贡献等级、岗位职责综合评定。具体额度由管理层通过 Firestore 后台预先配置。

### 5.2 认领流程（5 步）

请登录 **https://buy.agvnexrur.ai/claim** 按以下步骤完成：

```
Step 1 → 社区加入      加入 Discord 服务器 + 关注 Twitter
Step 2 → 身份验证      Discord OAuth 身份认证（绑定钱包地址）
Step 3 → 徽章认领      链上 claim ERC1155 空投徽章（Airdrop Badge, 限 2000 枚）
Step 4 → 额度分配      系统根据预设配置显示你的 pGVT 认领额度
Step 5 → 兑现认领      确认并领取 pGVT 至你的钱包
```

### 5.3 重要前置条件

#### pGVT 认领
- 确保钱包已连接 **BNB Smart Chain (BSC)**
- 认领后 pGVT 将直接到账，可在 PancakeSwap 查看余额
- pGVT 后续可通过 `convertToGVT()` 自助转换为 GVT（TGE 后开放）

#### sGVT 认领（如适用）
- **⚠️ sGVT 为注册制代币，收款钱包地址必须预先加入白名单**
- 请提前将你的 BSC 钱包地址报送至管理层，由 Admin 调用 `updateEligibility(address, true)` 开通
- 未加入白名单的地址将无法接收 sGVT（转账会被合约自动拒绝）

### 5.4 认领时间窗口

| 阶段 | 时间 | 说明 |
|------|------|------|
| 白名单收集 | 即日起 — 2026 年 3 月 20 日 | 提交 BSC 钱包地址至管理层 |
| 认领开放 | 管理层确认后开放 | 登录 buy.agvnexrur.ai/claim 完成 5 步 |
| 认领截止 | 另行通知 | 逾期未领视为放弃 |

---

## 六、合规备案进展

### 6.1 证监会 NERIS 平台备案

按照 42 号文件及 1 号备案指引要求，我们正在通过证监会网上办事服务平台（NERIS）推进备案申报：

| 事项 | 状态 | 说明 |
|------|------|------|
| NERIS 平台账号注册 | ⏳ 进行中 | 以境内经营实体的统一社会信用代码注册组织机构账号 |
| 备案材料准备 | ⏳ 进行中 | 募集说明书、交易全套方案、资产评估报告等 |
| 预沟通 | ⏳ 待安排 | 首次备案前与监管机构的非正式沟通 |
| 正式提交 | ⏳ 待定 | 预计材料齐备后 5 个工作日内提交 |

### 6.2 其他合规动作

- [x] 代币架构 V3 合规重设计（pGVT 7 角色权限、Vesting/Staking 合规追踪）
- [x] 链上合约 BscScan 源码验证（合约代码公开可审计）
- [x] CoinGecko 上币申请提交（pGVT + sGVT，Request ID 已获取）
- [x] 官方网站域名统一（agvnexrur.ai 体系）
- [ ] NERIS 平台组织机构账号开通
- [ ] 合规法律意见书出具
- [ ] 资产评估与审计报告

---

## 七、安全注意事项

1. **切勿在任何公开或非官方渠道分享本文件** — 本文件包含内部战略信息
2. **认领仅通过 buy.agvnexrur.ai/claim** — 不会通过私信、邮件或其他方式索要私钥/助记词
3. **核实合约地址** — 操作前务必核对本文件中的合约地址，谨防钓鱼
4. **sGVT 白名单** — 未经白名单注册的转账将直接被合约拒绝（合约层面强制执行，非人为干预）
5. **Vesting 锁仓** — 认领的 pGVT 可能受 Vesting 时间表约束，可转账余额 = 已解锁额度 − 质押额度

---

## 八、常见问题

**Q1: 原 AGV Protocol 代币怎么处理？**  
A: 原代币将按约定比例映射至 pGVT。具体映射比例由管理层评定，认领时系统自动计算。

**Q2: pGVT 什么时候能换成 GVT？**  
A: TGE（代币生成事件）后，通过 `convertToGVT()` 自助转换。TGE 时间待定，届时另行通知。转换比例为 1:1，但受 Vesting 释放进度约束。

**Q3: 为什么从 AGV Protocol Foundation 改名为 AGV NEXRUR AGENT？**  
A: 42 号文件要求备案主体清晰可追溯。新主体 AGV NEXRUR AGENT 按照新监管框架重新设立，专门用于合规运营 RWA 业务，同时采用 Agent 驱动架构实现持续合规披露。

**Q4: 合约是否经过审计？**  
A: 合约源码已在 BscScan 验证公开，全量单元测试（526 个测试全部通过，覆盖 19/19 合约）。正式第三方审计报告正在评估合作机构。

**Q5: CoinGecko 上币进展如何？**  
A: pGVT 和 sGVT 均已提交 CoinGecko 申请但被拒（pGVT: "合约安全风险" — 已通过 7 笔 revokeRole 链上修复；sGVT: "缺乏关注度"）。当前暂缓重审，待 Arb 实盘上线 → MM 做市增加交易量 → KOL 推广后再重新提交。CoinGecko 通过后，MetaMask / Trust Wallet 将自动显示代币价格和 Logo。

---

## 九、联络方式

如有疑问，请通过以下渠道联络：

- **Discord**: https://discord.gg/mJKTyqWtKe（#internal 频道）
- **Telegram**: @agvnexrur_bot
- **技术支持**: 通过 Discord 联系管理员

---

> **AGV NEXRUR AGENT 技术管理委员会**  
> 2026 年 3 月 13 日  
> *本文件为内部文件，未经授权不得外传*
