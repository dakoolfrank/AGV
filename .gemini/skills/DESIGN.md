# AGV Protocol — Agent-Driven Design Document

> **版本**: v4.4  
> **日期**: 2026-03-22  
> **定位**: 统一设计文档，替代原 `DESIGN.md` v2.0 + `ARCHITECTURE.md` v1.2  
> **核心主张**: AGV 不是一个"用 AI 写代码"的项目，而是一个**用 Agent 替代运维人力**的 RWA 协议

---

## 目录

### Part 1: 战略定位
- [Σ.1 核心命题](#σ1-核心命题)
- [Σ.2 当前 Agent 热潮的根本缺陷](#σ2-当前-agent-热潮的根本缺陷)
- [Σ.3 nexrur 底座能力](#σ3-nexrur-底座能力)
- [Σ.4 三层降维打击](#σ4-三层降维打击)
- [Σ.5 AGV 全生命周期闭环](#σ5-agv-全生命周期闭环)
- [Σ.6 RWA 多站点 Campaign 模型](#σ6-rwa-多站点-campaign-模型)
- [Σ.7 人机协作结构](#σ7-人机协作结构)
- [Σ.8 三包架构总览](#σ8-三包架构总览)
- [Σ.9 风险与清醒认知](#σ9-风险与清醒认知)
- [Σ.10 商业论证与市场定位](#σ10-商业论证与市场定位)
- [Σ.11 RWA 利益相关者价值主张](#σ11-rwa-利益相关者价值主张)
- [Σ.12 数据不可篡改：对齐比特币信任模型](#σ12-数据不可篡改对齐比特币信任模型)

### Part 2: 协议审计与工程分析
- [A. 执行摘要](#a-执行摘要)
- [B. 三层架构总览](#b-三层架构总览)
- [C. 各层详细分析](#c-各层详细分析)
- [D. 风险清单 (P0–P2)](#d-风险清单-p0p2)
- [E. Oracle 对齐方案](#e-oracle-对齐方案)
- [F. 代码完成度评估](#f-代码完成度评估)
- [G. 测试覆盖概览](#g-测试覆盖概览)

### Part 3: 5 Subagent 流水线架构
- [§1 架构演进：从碎片化到数据驱动流水线](#1-架构演进从碎片化到数据驱动流水线)
- [§2 nexrur 底座：Agent 的大脑与神经系统](#2-nexrur-底座agent-的大脑与神经系统)
- [§3 五步流水线总览](#3-五步流水线总览)
- [§4 S1: Asset + Oracle — 物理电站锚定](#4-s1-asset--oracle--物理电站锚定)
- [§5 S2: Chain Ops — 链上运维](#5-s2-chain-ops--链上运维)
- [§6 S3: Digital Ops — 数字化展现（L1 Web3 + L2 Web2）](#6-s3-digital-ops--数字化展现l1-web3--l2-web2)
- [§7 S4: KOL Operations — 社区增长与传播](#7-s4-kol-operations--社区增长与传播)
- [§8 安全边界与人工闸门](#8-安全边界与人工闸门)
- [§9 S5: MarketMaker-Agent — 做市与套利（分支 Campaign）](#9-s5-marketmaker-agent--做市与套利分支-campaign)

### Part 4: 实施路线图
- [R. 四阶段实施路线图](#r-四阶段实施路线图)

### Part 5: 附录
- [附录 A: 合约参数表](#附录-a-合约参数表)
- [附录 B: 角色/权限矩阵](#附录-b-角色权限矩阵)
- [附录 C: Subagent × 工具映射](#附录-c-subagent--工具映射)
- [附录 D: 三包查找表](#附录-d-三包查找表)
- [附录 E: 开发环境盘点](#附录-e-开发环境盘点)
- [附录 F: 第三方服务矩阵](#附录-f-第三方服务矩阵)

---

# Part 1: 战略定位

## Σ.1 核心命题

**AGV Protocol 是第一个全生命周期 Agent 驱动的 RWA 协议。**

传统 RWA 项目的痛点不在"写代码难"，而在**运维人力密集**：

| 维度 | 传统做法 | AGV Agent 做法 |
|------|---------|---------------|
| 合约部署 | DevOps 手动 `forge script` + 逐项检查 | S2 Chain Ops 自动审计→部署→验证 |
| 链上数据核验 | 人工对账 Excel + 抽样检查 | S1 Asset+Oracle 实时采集 + 对账 |
| 版本依赖升级 | 开发者逐项手动升级 + 人工回归 | S2 Chain Ops (合约) + S3 Digital Ops (前端) 扫描→重构→PR |
| 基础设施监控 | 人工检查 Vercel/Firebase/Redis | S3 Digital Ops 状态巡检 + 自动告警 |
| Oracle 喂价 | 运维手动签名 + 提交 | S1 Asset+Oracle 自动签名→提交→验证 |

**一句话**：传统区块链项目用 30 人做运维的工作，AGV 用 3 人 + Agent 集群完成。

## Σ.2 当前 Agent 热潮的根本缺陷

市面上 99% 的"AI Agent"项目存在三个致命缺陷：

### 缺陷 1：无状态

```
用户 → "帮我部署合约"
Agent → 生成 Solidity 代码
用户 → "出错了"
Agent → "什么错？" ← 完全不记得上一步
```

**nexrur 解法**：`StepOutcome` + `Checkpoint` + `AssetRegistry` — 每步运行的输入/输出/状态全量持久化，断点续跑。

### 缺陷 2：无失败处理

```
合约编译失败 → Agent 说"请检查语法" → 结束
```

**nexrur 解法**：`DiagnosisEngine` + 自愈双循环 — 编译失败 → 自动分析错误 → 修复 → 重试 → 仍失败 → 升级修复策略 → 最终人工干预。

### 缺陷 3：无治理

```
Agent 擅自删除了文件 / 推送了未测试的代码 / 修改了线上合约
```

**nexrur 解法**：四层治理 P0-P3（Outcome / Lineage / RAG / Gate）+ 人工闸门 — Agent 的每个动作都有审计日志、证据链、门禁拦截。

## Σ.3 nexrur 底座能力

nexrur 是从 WQ-YI 量化平台提取的通用 Agent 底座，已经过 850+ 单元测试验证。

### 代码规模

| 层级 | 文件数 | 代码行数 | 职责 |
|------|--------|----------|------|
| **L0 Core** | 12 | ~2,500 | outcome / audit / evidence / policy / cache / manifest / validator |
| **L1 Engines** | 8 | ~9,500 | orchestrator / agent_ops / campaign / diagnosis / tool_loop / registry |
| **L2 Adapters** | *(AGV 新建)* | ~500 (估) | contract_pipeline / contract_lifecycle / forge_executor |
| **L3 Skills** | *(AGV 新建)* | ~1,500 (估) | 4 主 Subagent 脚本 (S1-S4) |
| **Tests** | 26 | ~8,500 | 850+ 单元测试 |
| **合计** | 43+ | ~12,000+ | — |

### 四层洋葱架构

```
┌──────────────────────────────────────────────────────┐
│  L3 Skills       │ S1 Asset+Oracle / S2 Chain / S3 Digital / S4 KOL │
├──────────────────┤                                        │
│  L2 Adapters     │ contract_pipeline / forge_executor     │
├──────────────────┤                                        │
│  L1 Engines      │ orchestrator / campaign / diagnosis    │
├──────────────────┤                                        │
│  L0 Core         │ outcome / audit / evidence / policy    │
└──────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
      nexrur 包          AGV 适配层           AGV 技能层
   (pip install)        (仓库内)             (仓库内)
```

**依赖方向**：L3 → L2 → L1 → L0，禁止反向依赖。

### 核心引擎映射

| nexrur 引擎 | WQ-YI 用途 | AGV 用途 |
|-------------|-----------|---------|
| `Orchestrator` | 8 步量化流水线 | 8 步合约运维流水线 |
| `CampaignRunner` | 多资产循环编排 | 多站点 RWA Campaign |
| `DiagnosisEngine` | Alpha 仿真失败诊断 | 合约编译/测试失败诊断 |
| `ToolLoopRunner` | 数据字段绑定状态机 | forge/cast 工具循环 |
| `AssetRegistry` | Alpha 10 态生命周期 | 合约 10 态生命周期 |
| `StepOutcome` | 量化步骤运行结果 | 合约步骤运行结果 |
| `EvaluateGate` | Alpha 门禁 | 合约部署门禁 |

## Σ.4 三层降维打击

### 第一层：经验降维

WQ-YI 已在生产环境运行 6 个月，处理过：
- **2,000+** 次 Alpha 仿真
- **500+** 次自动诊断修复
- **50+** 次全链路 Campaign

这些经验直接体现在 nexrur 引擎的设计中（如 SK1-SK14 骨架级诊断协议、D1 跨 trace 去重、D5 高潜力检测）。

### 第二层：生命周期降维

| 对比维度 | 普通 AI 项目 | AGV |
|---------|------------|-----|
| 写代码 | ✅ | ✅ |
| 编译测试 | ❌ 人工 | ✅ Agent 自动闭环 |
| 失败诊断 | ❌ 人工 | ✅ DiagnosisEngine |
| 部署验证 | ❌ 人工 | ✅ S2 Chain Ops + S3 Digital Ops |
| 线上监控 | ❌ 人工 | ✅ S3 Digital Ops |
| 数据对账 | ❌ 人工 | ✅ S1 Asset+Oracle |
| 版本管理 | ❌ 人工 | ✅ S2 Chain Ops (合约) + S3 Digital Ops (前端) |
| 文档维护 | ❌ 人工 | ✅ S3 Digital Ops (L2 docs 站同步) |

### 第三层：RWA 业务降维

RWA 的特殊性在于**链上链下必须一致**。传统项目用人工审计保证一致性，AGV 用 Agent：

```
IoT 电表读数 → S1 Asset+Oracle 自动对比 → AGVOracle 链上锚
    ↑                    ↕                           ↓
物理世界             自动暂停（不一致时）           智能合约结算
```

## Σ.5 AGV 全生命周期闭环

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGV Agent 全生命周期                           │
│                                                                  │
│  DETECT ──→ ANALYZE ──→ PLAN ──→ WRITE ──→ TEST               │
│    ↑                                           ↓                │
│  MONITOR ←── DEPLOY ←── REVIEW ←── FIX ←────────              │
│                                                                  │
│  每一步都有：StepOutcome + Audit + Evidence + Gate              │
└─────────────────────────────────────────────────────────────────┘
```

| 阶段 | 执行者 | 输入 | 输出 | 门禁 |
|------|--------|------|------|------|
| **DETECT** | S1 Asset+Oracle / S3 Digital Ops | 监控信号 | 异常报告 | — |
| **ANALYZE** | DiagnosisEngine | 异常报告 | 根因分析 + 修复建议 | — |
| **PLAN** | Orchestrator | 根因分析 | 执行计划（哪个 Subagent、从哪步回退） | P3 Gate |
| **WRITE** | Subagent (S1/S2/S3) | 执行计划 | 代码/配置变更 | — |
| **TEST** | S2 Chain Ops | 代码变更 | forge test 结果 | P0 Outcome |
| **FIX** | DiagnosisEngine | 测试失败 | 修复后代码 | 最大重试 3 次 |
| **REVIEW** | Orchestrator + 人工 | 修复后代码 | 审核通过/驳回 | P3 Gate（高风险人工） |
| **DEPLOY** | S2 Chain Ops / S3 Digital Ops | 审核通过的代码 | 链上部署 / 前端部署 | **强制人工确认** |
| **MONITOR** | S3 Digital Ops | 部署后状态 | 健康报告 | — |

## Σ.6 RWA 多站点 Campaign 模型

AGV 的 RWA 业务本质是"多个光伏站点，每个站点独立生命周期"：

```
Campaign: "Q1 2026 新增站点"
├── Station A (广州)  → [collect → curate → deploy → verify → monitor]
├── Station B (深圳)  → [collect → curate → deploy → verify → monitor]
└── Station C (佛山)  → [collect → curate → deploy → verify → monitor]
                              ↑
                    CampaignRunner 循环编排
                    ├── 资产去重 (D1)
                    ├── 失败诊断 (DiagnosisEngine)
                    ├── 预算终止 (max_cycles)
                    └── 终态归档 (AssetRegistry)
```

**映射关系**：

| WQ-YI 概念 | AGV 概念 |
|-----------|---------|
| Alpha 资产 | 光伏站点合约包 |
| 仿真 (simulation) | forge test + 链上验证 |
| 达标 (Sharpe ≥ 目标) | 全部测试通过 + 审计 clean |
| Campaign 循环 | 批量站点部署 + 巡检 |

## Σ.7 人机协作结构

**核心原则：Agent 做 90% 重复工作，人类做 10% 关键决策。**

| 操作类型 | Agent 权限 | 人类角色 |
|---------|-----------|---------|
| 代码生成/修改 | ✅ 完全自主 | 可选 review |
| `forge test` | ✅ 完全自主 | — |
| `forge script --broadcast` (testnet) | ✅ 有条件自主 | 通知 |
| `forge script --broadcast` (mainnet) | ❌ 禁止自主 | **强制人工确认** |
| Git commit / push | ❌ 禁止自主 | **人工决定时机** |
| 环境变量修改 | ✅ `.env.local` | 人工确认 Vercel vars |
| 合约 upgrade (proxy) | ❌ 禁止自主 | **强制人工 + multisig** |

### 信心阈值三级系统

| 级别 | 信心阈值 | 行为 |
|------|---------|------|
| **Auto** | ≥ 0.95 | Agent 完全自主执行 |
| **Master** | 0.70 – 0.95 | Orchestrator 复核后执行 |
| **Human** | < 0.70 | 必须人工确认 |

### 绝对禁止区（无论信心值多高）

```
❌ mainnet broadcast（必须人工签名）
❌ proxy upgrade（必须 multisig）
❌ 删除/覆盖 .bak / .audit / .evidence 文件
❌ 修改 .gitmodules / submodule 目录
❌ git push --force
```

### 信心阈值校准方法论

阈值不是拍脑袋定的 — 需要**数据驱动校准**，分三步：

**Step 1: 历史基线（Phase 0-1 收集）**

在 Phase 0-1 期间，所有 Agent 操作均以 **Human** 模式运行（信心值记录但不自动执行），积累 baseline 数据：

```
每次 Agent 决策 → 记录 (confidence_score, human_decision, actual_outcome)
                                  ↓
               agent_confidence_log.jsonl (至少 200 条)
```

**Step 2: ROC 曲线回测（Phase 1 末期）**

```
取 confidence_score vs human_agree (0/1) 画 ROC 曲线
  ↓
找到最优阈值：
  ├── Auto 阈值 = specificity ≥ 0.99 的最低 confidence（即误报率 < 1%）
  ├── Master 阈值 = sensitivity ≥ 0.95 的最低 confidence（即漏报率 < 5%）
  └── Human 阈值 = Master 阈值以下全部人工
```

**Step 3: 在线校准（Phase 2+ 持续）**

| 机制 | 说明 |
|------|------|
| 滑动窗口 | 最近 100 次决策滑动更新阈值 |
| 域差异化 | 不同操作类型（test/deploy/send）独立阈值 |
| 衰减因子 | 6 个月前的数据权重降至 0.5 |
| 人工 override 回馈 | 人工推翻 Agent 决策 → 反向调整阈值 |

**校准验收标准**：Auto 区间误操作率 < 1%，Human 升级中 Agent 正确但被拦截率 < 10%。

## Σ.8 三包架构总览

```
┌─────────────────────────────────────────────────────┐
│               nexrur (pip install nexrur)             │
│  通用 Agent 底座 — L0 Core + L1 Engines              │
│  43 文件 / 12,000 行 / 850+ 测试                     │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ↓                         ↓
┌─────────────────┐      ┌─────────────────────┐
│   WQ-YI (量化)   │      │   AGV (合约)          │
│  L2: Alpha 适配  │      │  L2: Contract 适配    │
│  L3: 6 个 Skill  │      │  L3: 7 个 Agent 场景  │
│  cnhkmcp (MCP)   │      │  Foundry + Vercel     │
└─────────────────┘      └─────────────────────┘
```

| 包 | 仓库 | 安装方式 | 职责 |
|----|------|---------|------|
| `nexrur` | `dakoolfrank/nexrur` | `pip install nexrur` | 通用底座 |
| `WQ-YI` | `dakoolfrank/WQ-YI` | 工作区 | 量化领域适配 |
| `AGV` | `dakoolfrank/AGV` | 工作区 | 区块链领域适配 |

## Σ.9 风险与清醒认知

| 风险 | 等级 | 应对 |
|------|------|------|
| nexrur 底座尚未发布 pip 包 | 高 | Phase 0 首要任务 |
| L2 适配层代码量未知 | 中 | 先实现最小可行子集（S2 Chain Ops） |
| Foundry 工具链与 nexrur ToolLoop 的集成复杂度 | 中 | 先做 `forge_executor.py` 概念验证 |
| 链上操作不可逆 | 严重 | 绝对禁止区 + 强制人工闸门 |
| Agent 幻觉导致错误修复 | 中 | DiagnosisEngine 的 `max_retry=3` + 人工升级 |
| 7 个前端版本分裂 | 低 | 已在 `agv-web/AGV-WEB-RUN.md` 中详细记录，S3 Digital Ops (L2) 负责 |

## Σ.10 商业论证与市场定位

### 目标市场规模（TAM/SAM/SOM）

| 层级 | 市场 | 规模 | 依据 |
|------|------|------|------|
| **TAM** | 全球 RWA 代币化市场 | $16T (2030E) | BCG + ADDX 报告，含房产/基建/大宗商品/私募债 |
| **SAM** | 分布式能源 RWA（光伏/储能/充电桩） | $800B (2030E) | BloombergNEF 分布式光伏 + IEA 储能预测 |
| **SOM** | 东南亚 + 大湾区光伏站点代币化 | $2-5B (2028E) | 越南/泰国/广东光伏装机量 × 代币化渗透率 3-5% |

### 单站经济模型（Unit Economics）

**以典型 5MW 工商业光伏站为例（年化）**：

| 成本项 | 传统运维模式 | AGV Agent 模式 | 节省 |
|--------|:---:|:---:|:---:|
| 运维团队（3人×12月） | $108,000 | $12,000（1人监督） | **89%** |
| 合约审计（年度） | $50,000 | $5,000（Agent 持续审计） | **90%** |
| 链上对账（月结） | $24,000（外包会计） | $2,400（Agent 自动） | **90%** |
| 基础设施监控 | $18,000（SaaS 订阅） | $3,600（Agent 巡检） | **80%** |
| 文档/合规维护 | $12,000 | $1,200 | **90%** |
| **年度总成本** | **$212,000** | **$24,200** | **88.6%** |
| **每 MW 成本** | **$42,400** | **$4,840** | — |

> 假设：站点位于广东，并网电价 ¥0.45/kWh，年利用小时 1,100h，年发电收入 ~$340,000。
> 传统模式运维成本占收入 62%，AGV 模式降至 7.1%。

### 竞品对比：DevOps 自建 vs AGV

| 维度 | 自建 DevOps 栈 | AGV Agent 平台 | 优势 |
|------|:---:|:---:|:---:|
| **组件** | GitHub Actions + Prometheus + Grafana + PagerDuty + 自研脚本 | nexrur 底座 + 4 主 Subagent | 统一架构 |
| **初始搭建** | 2-3 个月 + DevOps 工程师 | 即插即用（pip install nexrur） | **快 10×** |
| **部署覆盖** | CI/CD 仅覆盖代码→测试→部署 | 代码→测试→诊断→修复→部署→监控→对账→文档 | **8 步全覆盖** |
| **失败诊断** | 人工看日志 | DiagnosisEngine 自动分类 + 修复建议 | **自动化** |
| **链上操作** | 无 | 内置 Gate 门禁 + 人工闸门 | **安全** |
| **RWA 对账** | 无 | S1 Asset+Oracle 自动链上链下对比 | **独有** |
| **知识传递** | Wiki / Confluence（静态） | RAG 向量库（动态、可检索） | **活知识** |
| **人力需求** | 1 DevOps + 1 SRE（全职） | 1 人兼职监督 | **省 80%** |
| **年度成本** | ~$150,000（人力+SaaS） | ~$20,000（计算+存储） | **省 87%** |

### 差异化论证

**AGV 不是另一个 "AI Agent 写代码" 平台**，主要差异：

| 对比维度 | 通用 AI Agent（Devin/Cursor/Copilot） | AGV Protocol |
|---------|------|------|
| 目标 | 替代开发者写代码 | 替代运维团队做全生命周期管理 |
| 价值链 | 代码生成 → 完 | 代码→测试→诊断→部署→监控→对账→安全→文档 |
| 行业知识 | 通用 | RWA + DeFi + 光伏深度定制 |
| 链上能力 | 无 | forge/cast 集成 + EIP-712 签名 + Gate 门禁 |
| 底座复用 | 无（每个项目重写） | nexrur 底座跨项目复用（WQ-YI 已验证 6 个月） |
| 治理 | 无 | P0-P3 四层治理 + 信心阈值 + 绝对禁止区 |

### 光伏站故事（Pitch Narrative）

> **场景**：广州南沙 5MW 工商业光伏站，2026 年 Q2 完成代币化上链。
>
> **Day 1** — S2 Chain Ops 检测到 `SolarPass.sol` 新增了站点元数据字段，自动编译 → 237 个测试全通过 → 生成变更审计报告。
>
> **Day 7** — S1 Asset+Oracle 发现电表读数（IoT）与 Oracle 上链数据偏差 0.3%（阈值 1%），标记 PASS 并归档 evidence。
>
> **Day 14** — S2 Chain Ops 检测到一个未知地址尝试调用 `pGVT.mint()`，立即告警。Agent 确认该地址无 `MINTER_ROLE` → 交易 revert → 记录事件 + 通知运维。
>
> **Day 30** — 月结。S1 Asset+Oracle 自动汇总：发电量 458,333 kWh，Token 结算 $206,250，链上链下偏差 < 0.1%。S3 Digital Ops (L2) 同步更新投资者报告。
>
> **全程 0 名全职运维人员参与。** 站点负责人每周花 30 分钟审阅 Agent 周报，仅在 mainnet 部署时人工签名。

## Σ.11 RWA 利益相关者价值主张

**同一套系统，对三类人说不同的话：**

### 资产管理人（Asset Manager）视角

| 痛点 | AGV 解决方案 | 量化收益 |
|------|-------------|----------|
| 每站需要 3 人运维团队 | Agent 替代 90% 重复工作 | 人力成本降 89% |
| 第三方审计慢且贵（年度一次） | S2 Chain Ops 持续审计（每次代码变更触发） | 审计成本降 90%，频率提升 ∞ |
| 月结对账依赖外包会计 | S1 Asset+Oracle 自动对账 | 对账成本降 90%，实时性提升 |
| 多站点扩张线性增加人力 | CampaignRunner 批量编排 | 管理 10 个站 ≈ 管理 1 个站的成本 |

**一句话 Pitch**：*"从第一个站到第一百个站，运维成本几乎不变。"*

### 公用事业 / EPC（Utility / Engineering）视角

| 痛点 | AGV 解决方案 | 量化收益 |
|------|-------------|----------|
| 电表数据与结算不一致导致纠纷 | S1 Asset+Oracle 双重数据锚定 + 链上链下对账 | 纠纷率降 95% |
| 合约升级风险（影响结算） | UUPS Proxy + 强制 multisig + S2 Chain Ops 回归测试 | 升级事故率 → 0 |
| IoT 设备故障检测滞后 | S1 Asset+Oracle + S3 Digital Ops 实时监控 | MTTR（平均修复时间）降 80% |

**一句话 Pitch**：*"链上链下 100% 一致，纠纷归零。"*

### 交易所 / 二级市场（Exchange / DeFi）视角

| 痛点 | AGV 解决方案 | 量化收益 |
|------|-------------|----------|
| RWA Token 缺乏可审计性（机构不敢上） | 全链路 evidence.jsonl + audit.jsonl | 满足机构级合规要求 |
| 底层资产状况不透明 | S1 Asset+Oracle 实时对账 + S3 Digital Ops 公开 Dashboard | 大幅降低信息不对称 |
| 链上数据可能造假 | EIP-712 签名 + 多 Oracle 锚点 + Agent 交叉验证 | 数据可信度从 "信任" 升级为 "验证" |

**一句话 Pitch**：*"不是让你相信数据，而是让你自己能验证数据。"*

## Σ.12 数据不可篡改：对齐比特币信任模型

**比特币的核心不是"去中心化"，是"改一个字节全网都知道"。** AGV 把同样的逻辑应用到 RWA。

### 传统 RWA 的信任缺口

```
物理电站 →→→ 【人工填 Excel】 →→→ 上链 →→→ "看，链上数据不可篡改！"
               ↑
          这里随便改，没人知道
```

传统 RWA 的"不可篡改"只覆盖链上那一段。从电表到上链之间的人工环节，想改就改，审计也只是年度抽样。

### AGV 的密码学锁链

```
物理电表 → S1 自动采集 + EIP-712 签名 + 链上链下对账
              ↓
         任何篡改 → 签名不匹配 → 熔断
              ↓
         S2 链上锚定（合约代码公开，改了就无效）
              ↓
         S3 前端展现（数据从链上读，不是从后端造）
              ↓
         S4 KOL（只是把已验证的数据变成人话）
```

### 三层角色对应

| 层 | 对齐比特币 | AGV 实现 | 服务对象 |
|---|---|---|---|
| **S1→S2 数据锚定** | PoW 不可伪造 → 全节点验证 | 电表 EIP-712 签名 → 合约校验 → outcome.json 存证 | **投资者**：底层资产数据可验证 |
| **S2→S3 链上到线上** | 区块浏览器公开查询 | 链上状态 → S3 自动同步前端 → audit.jsonl 全程记录 | **监管/审计**：抽查 S1→S2 任意环节可追溯 |
| **S4 传播** | 不涉及信任 | 内容基于已验证数据生成，降低获客边际成本 | **社区**：省人工，非核心信任环节 |

### 篡改成本对比

| 攻击面 | 比特币 | AGV | 传统 RWA |
|--------|--------|-----|----------|
| 数据源 | 需 51% 算力 | 需同时控制电表硬件 + Oracle 私钥 + 合约 admin | 改一个 Excel 单元格 |
| 链上数据 | 需 51% 攻击 | 需控制 BSC 验证节点 | 同左 |
| 展示层 | N/A | 前端从链上读取，改前端不影响链上真相 | 后端数据库随便改 |
| 审计追溯 | 全历史公开 | outcome + audit + evidence 三件套全程记录 | 年度抽样，事后追溯困难 |

**核心结论**：S1→S2 是投资者信任的根基（数据不可篡改），S3 是监管合规的根基（可抽查可追溯），S4 只是效率工具。

---

# Part 2: 协议审计与工程分析

## A. 执行摘要

**AGV Protocol 由 3 个独立 Foundry 项目组成，共 14 个非接口 Solidity 合约，526 个测试全部通过。**

| 维度 | 数据 |
|------|------|
| 合约项目 | 3 个（NFT Pass / Oracle 验证 / Token 经济） |
| 非接口合约 | 14 个 |
| 测试总数 | 526 个（全部通过） |
| 测试代码 | 6,346 行 |
| Solidity 版本 | `^0.8.20`（NFT+Token）/ `0.8.27` pinned（Oracle） |
| 设计模式 | UUPS Proxy / ERC721A / EIP-712 / EIP-2612 / AccessControl |
| 完成度 | 80-85%（单模块完整，跨模块集成缺失） |

### 关键差距

| 已完成 | 未完成 |
|--------|--------|
| 单模块合约 + 单元测试 | 跨模块集成测试 |
| BSC Mainnet 部署 (pGVT/sGVT/NFT/Badge) | AGVOracle 部署 |
| 4 个部署脚本 | TGE 迁移执行 |
| P0 风险已修复 | P1 风险部分未修复 |
| 前端 3/7 已部署 Vercel | 前端 4/7 待部署 |

## B. 合约架构：以 Subagent 数据流为视角

**设计哲学**：不按 Foundry 项目分层（旧 Layer 1/2/3），而按 Subagent 数据流组织——每组合约服务于哪个 Subagent，数据从哪来、到哪去。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   AGV Protocol 合约架构（Subagent 视角）                  │
│                                                                         │
│  S1 Asset + Oracle（数据源 — 投资者信任根基）                             │
│  ├── AGVOracle.sol         EIP-712 签名       (电表→链上锚定)            │
│  ├── OracleVerifier.sol    验证器              (签名校验+阈值熔断)        │
│  └── AgentRegistry.sol     注册表              (Agent 身份+设备绑定)      │
│                                                                         │
│  S2 Chain Ops（合约层 — 链上业务逻辑）                                    │
│  ├── SeedPass.sol          ERC721A + UUPS    (入场凭证)                  │
│  ├── TreePass.sol          ERC721A + UUPS    (中级凭证)                  │
│  ├── SolarPass.sol         ERC721A + UUPS    (高级凭证)                  │
│  ├── ComputePass.sol       ERC721A + UUPS    (算力凭证)                  │
│  ├── pGVT.sol (V3)         ERC20 + 7 角色    (预售令牌)                  │
│  ├── sGVT.sol              ERC20 + 白名单    (机构凭证)                  │
│  ├── GVT.sol               ERC20 + Permit    (主令牌, TGE后)             │
│  ├── Migrator.sol          pGVT→GVT 桥      (自助转换)                   │
│  ├── pSale.sol             Merkle 预售       (外部预售)                   │
│  ├── BondingCurve.sol      联合曲线          (价格发现)                   │
│  ├── DAOController.sol     治理              (投票权占位)                 │
│  └── PowerToMint.sol       NFT→铸造权        (Pass 赋能)                 │
│                                                                         │
│  S3 Digital Ops（前端层 — 读 S2 链上状态，渲染给用户）                     │
│  └── 7 个前端项目读取上述合约（见 §5 + AGENTS.md 前端矩阵）               │
│                                                                         │
│  S4 KOL（传播层 — 基于 S2→S3 已验证数据生成内容）                         │
│  └── 无独立合约，消费 S3 已渲染的数据                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Subagent 间数据流与信任级别

```
S1 (Oracle)                S2 (Chain Ops)              S3 (Digital Ops)        S4 (KOL)
电表 EIP-712 签名     ───→  合约校验+锚定          ───→  链上读取+渲染     ───→  内容生成
  │                          │                           │                      │
  │ 信任级别: 密码学保证      │ 信任级别: 代码公开         │ 信任级别: 数据来源      │ 非信任层
  │ (改签名=全网知道)         │ (改合约=全网知道)          │   可溯源到 S1+S2       │ (纯效率)
  └──── 投资者信任根基 ──────┘                           └── 监管审计根基 ────────┘
```

### 跨 Subagent 合约依赖

| 调用方 | 被调用方 | 依赖关系 | 所属 Subagent 边界 |
|--------|---------|----------|-------------------|
| PowerToMint | NFT Pass (4种) | NFT 持有量 → 铸造权计算 | S2 内部 |
| BondingCurve | AGVOracle | Oracle 喂价 → 曲线定价 | S1→S2 跨边界 |
| DAOController | GVT/sGVT | Token 持有量 → 投票权 | S2 内部 |
| pGVT.convertToGVT | Migrator → GVT | burn pGVT → mint GVT | S2 内部 |
| S3 前端 | 所有 S2 合约 | 只读调用（view/pure） | S2→S3 跨边界 |

**关键测试缺口**：S1→S2 跨边界依赖（Oracle→BondingCurve）缺乏集成测试——这是 Phase 1 的核心交付物。

## C. 各层详细分析

### C.1 NFT Pass — S2 Chain Ops (agvprotocol-contracts-main)

| 合约 | 行数 | 设计模式 | 测试数 | 特殊功能 |
|------|------|---------|--------|---------|
| SeedPass | ~200 | ERC721A + UUPS | 60 | 批量 mint, whitelist |
| TreePass | ~180 | ERC721A + UUPS | 55 | upgrade from Seed |
| SolarPass | ~190 | ERC721A + UUPS | 50 | 高 tier, 限量 |
| ComputePass | ~170 | ERC721A + UUPS | 45 | 算力挖矿凭证 |
| AgentRegistry | ~150 | AccessControl | 27 | Agent 身份注册 |

**已修复**：全部 237 个测试通过。

**注意点**：
- `tokenOfOwnerByPage` 当持有量大时可能 OOG（out of gas）
- UUPS `_authorizeUpgrade` 必须有 `onlyOwner` / `onlyRole`

### C.2 Oracle 验证 — S1 Asset+Oracle (onchainverification-main)

| 合约 | 行数 | 设计模式 | 测试数 | 特殊功能 |
|------|------|---------|--------|---------|
| AGVOracle | ~300 | EIP-712 Typed Data | 15 | 日快照签名, 月结算锚 |
| OracleVerifier | ~150 | 纯验证 | 10 | 签名校验 + 阈值检查 |

**风险**：
- 签名重放攻击需要 nonce 机制（P1-05）
- `IAGVOracle` 接口定义与实现不完全一致（P0-04 已标记）

### C.3 Token 经济 — S2 Chain Ops (tokencontracts-main)

**pGVT V3 是关键重写**，引入 7 角色分权模型：

| 角色 | 授予目标 | 职责 |
|------|---------|------|
| `DEFAULT_ADMIN_ROLE` | multisig | 角色管理 |
| `MINTER_ROLE` | admin + pSale | `mint()` (受 MAX_SUPPLY 限制) |
| `VESTING_CONFIG_ROLE` | admin | vesting 配置 (sealVesting 前) |
| `PRICE_MANAGER_ROLE` | admin | 预售定价 |
| `TREASURY_ROLE` | admin | 资金管理 |
| `STAKING_MANAGER_ROLE` | admin | 质押白名单 |
| `SYSTEM_ROLE` | V2→V3 bridge | 迁移 (临时) |

**供应量状态（2026-03-10）**：

| Token | MAX_SUPPLY | 已铸造 | 已空投 | LP 投入 | 单价 |
|-------|-----------|--------|--------|---------|------|
| pGVT | 100M | 3M | 730K | 10K | $0.005 |
| sGVT | 100M | 30M | 21.13M | 100 | $0.50 |
| GVT | 1B | — | — | — | 待 TGE |

**TGE 迁移路径**：用户自助 `pGVT.convertToGVT(amount)` → burn pGVT → Migrator → mint GVT，双重 cap 保护。

## D. 风险清单 (P0–P2)

### P0 严重 (已修复)

| 编号 | 风险 | 模块 | 状态 | 修复方式 |
|------|------|------|------|---------|
| P0-01 | DAOController 投票权硬编码 `return 1000e18` | Token | ✅ 已修复 | → `revert("Not implemented")` |
| P0-02 | BondingCurve `min==max` 除零 | Token | ✅ 已修复 | `require(min < max)` |
| P0-03 | PowerToMint 无 E2E 跨模块测试 | NFT↔Token | ⚠️ 部分 | 单元测试有，集成测试缺 |
| P0-04 | IAGVOracle 接口 vs 实现不一致 | Oracle | ⚠️ 待修复 | 需对齐接口签名 |

### P1 高危

| 编号 | 风险 | 模块 | 说明 |
|------|------|------|------|
| P1-01 | NFT mint 重入 | NFT | ERC721A 内建保护，但自定义 callback 需审查 |
| P1-02 | Permit 前置交易 | Token | EIP-2612 允许第三方 approve，需检查 `deadline` |
| P1-03 | Oracle 签名重放 | Oracle | 需 nonce + expiry 双保险 |
| P1-04 | sGVT 白名单绕过 | Token | `finalize()` 后仅 operator↔LP 可转，需验证 |
| P1-05 | Proxy storage 碰撞 | NFT | UUPS 升级时需验证 storage layout |
| P1-06 | BondingCurve 精度丢失 | Token | 大额交易时 `uint256` 除法向下取整 |
| P1-07 | pSale Merkle 伪造 | Token | 需验证 leaf 结构包含 address + amount |
| P1-08 | LP 创建时价格操纵 | Token | 首笔 LP 添加时无预言机保护 |

### P2 中等

| 编号 | 风险 | 说明 |
|------|------|------|
| P2-01 | unchecked 溢出 (BondingCurve) | Solidity 0.8+ 默认不需要，但 `unchecked` 块需审查 |
| P2-02 | 事件缺失 | 部分状态变更无 event emit |
| P2-03 | Gas 估算不足 | `tokenOfOwnerByPage` 大量持有者可能 OOG |

## E. Oracle 对齐方案

**问题**：3 个合约项目各自定义了 "Oracle" 概念，需要统一为"单一真相源"。

### 方案 A：AGVOracle 作为唯一 Oracle（推荐）

```
IoT 电表 → 后端服务 → EIP-712 签名 → AGVOracle.submitDailySnapshot()
                                            ↓
                                    OracleVerifier.verify()
                                            ↓
                              BondingCurve / DAOController 读取
```

**优点**：单一接口，易于 Agent 自动化。
**工作量**：~2 周（接口对齐 + 集成测试 + SubAgent）。

### 方案 B：双 Oracle 模式

- AGVOracle：物理数据（发电量、设备状态）
- Chainlink Price Feed：金融价格（USDT/BNB 等）

**优点**：关注点分离。
**工作量**：~3 周（额外集成 Chainlink）。

**当前选择**：Phase 0-1 用方案 A，Phase 2 按需引入 Chainlink。

## F. 代码完成度评估

| 模块 | 合约完成 | 测试完成 | 部署完成 | 集成测试 | 总评 |
|------|:---:|:---:|:---:|:---:|------|
| NFT Pass (4 合约) | 95% | 90% | ✅ BSC | ❌ | 缺跨模块 E2E |
| AgentRegistry | 80% | 85% | ❌ | ❌ | 缺 Agent 身份验证 |
| AGVOracle | 85% | 80% | ❌ | ❌ | 缺接口对齐 |
| pGVT V3 | 95% | 95% | ✅ BSC | ❌ | 缺 TGE 迁移测试 |
| sGVT | 90% | 95% | ✅ BSC | ❌ | 缺 LP finalize 测试 |
| pSale | 85% | 80% | ✅ BSC | ❌ | 缺 Merkle 边界测试 |
| BondingCurve | 75% | 70% | ❌ | ❌ | 缺大额交易 fuzz |
| DAOController | 60% | 50% | ❌ | ❌ | 投票权未实现 |
| PowerToMint | 80% | 75% | ❌ | ❌ | 缺 NFT↔Token E2E |

**总评**：单模块 80-85% 完成，跨模块集成 < 20%。

## G. 测试覆盖概览

| 项目 | 测试文件 | 测试数 | 代码行 | 结果 |
|------|---------|--------|--------|------|
| agvprotocol-contracts-main | 6 files | 237 | ~2,500 | ✅ 全通过 |
| onchainverification-main | 3 files | 25 | ~800 | ✅ 全通过 |
| tokencontracts-main | 11 files | 264 | ~3,046 | ✅ 全通过 |
| **合计** | **20 files** | **526** | **~6,346** | **全绿** |

### 测试缺口

| 缺口 | 影响 | 优先级 |
|------|------|--------|
| 跨模块集成测试 | PowerToMint E2E、Oracle→BondingCurve | P0 |
| Fuzz 测试 | BondingCurve 大额、pGVT vesting 边界 | P1 |
| Invariant 测试 | Token 总量不变性 | P1 |
| Gas 基准测试 | tokenOfOwnerByPage OOG | P2 |

---

# Part 3: 4 主 Subagent 流水线架构

> **v4.0 架构演进**：从 v3.1 的 S1-S8 碎片化场景矩阵，收敛为 **4 主 Subagent 数据驱动流水线**。
> 底座能力由 `nexrur` 包统一提供（迁移自 WQ-YI `_shared/` 的 14,800 行实战代码），各 Subagent 专注领域逻辑。
> 此架构参考了 WQ-YI `brain-dataset-explorer` 的 L1/L2 双层合一模式。

## §1 架构演进：从碎片化到数据驱动流水线

### v3.1 的问题：8 个碎片化 Agent

旧架构 S1-S8 是**独立的运维巡检员**——DevOps Agent ping 合约编译、Dependency Agent 扫描版本、Infra Agent 检查 SaaS 健康状态……它们各自触发、各自报告、互不关联。

| 问题 | 表现 |
|------|------|
| **无数据流** | S1 编译通过 ≠ S5 部署成功，中间无因果链 |
| **重复治理** | 每个 Agent 自行实现 outcome/audit/retry |
| **无法诊断** | 失败后只能"告警+人工排查"，没有根因分析 |
| **无法回退** | 被动巡检，不知道该从哪一步重试 |

### v4.0 的解法：4 主 Subagent 流水线

**核心洞察**：AGV 的数据从物理世界流向社交传播，是一条**因果链**，不是独立的巡检点。

```
物理电站        链上锚定         数字化展现          社交传播
━━━━━━━━━━ → ━━━━━━━━━━ → ━━━━━━━━━━━━━━━━ → ━━━━━━━━━━
   S1              S2              S3                S4
 电表读数       NFT mint      ┌─ L1: Web3 ──┐     Twitter
 Oracle签名     Token铸造     │ Thirdweb     │     Discord
 日快照         LP/空投       │ Moralis      │     Telegram
 月结算         DEX运维       └──────┬───────┘     Brevo
 熔断/告警      TGE迁移              │ 数据整理
                              ┌──────▼───────┐
                              │ L2: Web2     │
                              │ Vercel/CF    │
                              │ Firebase     │
                              │ 翻译/地图    │
                              │ build+deploy │
                              └──────────────┘
```

**每个 Subagent 的输出 = 下一个 Subagent 的输入**：
- S1 产出 `DailySnapshotData`（链上锚定所需的电表数据）→ S2 消费
- S2 产出链上状态（totalSupply / NFT 持仓 / LP 价格）→ S3 消费
- S3 产出部署好的前端（实时展现链上数据）→ S4 消费（把最新数据变成传播内容）

### 旧 Agent → 新 Subagent 职责映射

v3.1 的 S1-S8 不是被"删除"了，而是被**吸收**进 4 主 Subagent + nexrur 底座。下表逐一交代去向：

| 旧 Agent (v3.1) | 归入 (v4.1) | 具体落地位置 |
|-----------------|-------------|-------------|
| **S1 DevOps Agent** | **S2 Chain Ops** | `forge build/test/script`、合约审计、部署验证（§5） |
| **S2 Oracle Agent** | **S1 Asset+Oracle** | EIP-712 签名、日快照/月结算、数据采集（§4） |
| **S3 Reconciliation Agent** | **S1 Asset+Oracle** | 链上链下对账、偏差检测、熔断告警（§4） |
| **S4 Infra Agent** | **S3 Digital Ops (L2)** | Vercel/Firebase/Redis/Cloudflare 健康巡检（§6） |
| **S5 Dependency Agent** | **S2 (合约) + S3 (前端)** | submodule 版本扫描 (S2) + pnpm 依赖审计 (S3.L2) |
| **S6 Documentation Agent** | **S3 Digital Ops (L2)** | architecture 文档站同步、README/DESIGN.md 维护（§6 L2 产出） |
| **S7 Security Agent** | **S2 Chain Ops + §8 安全边界** | 链上异常检测 (S2)、不可逆操作 abort checklist (§8) |
| **S8 KOL Agent** | **S4 KOL** | 内容生成→审核→发布→外联（§7, `SUBAGENT_KOL_DESIGN.md`） |

**关键设计决策**：
- **Documentation** 归入 S3.L2 而非独立 Agent，因为文档站就是 7 个 Vercel 项目之一（`architecture`），更新逻辑与 `vercel deploy` 同源
- **Security** 拆分为两部分：链上监控归 S2（forge test 持续运行 + 角色检查）、操作安全归 §8（不可逆 abort checklist + blocking_codes）
- **Reconciliation** 归入 S1 而非 S2，因为对账的核心是"链下数据 vs 链上数据"，数据源头在 S1

### 与 WQ-YI 的精确类比

| 概念 | WQ-YI（量化 Alpha） | AGV（RWA 电站） |
|------|---------------------|-----------------|
| **底座** | `_shared/` (14,800 行) | `nexrur` (迁移同一套代码) |
| **编排器** | `orchestrator.py` 8 步 | Orchestrator 5 步（4 Subagent） |
| **诊断引擎** | `diagnosis.py` Flash+Pro | 同一引擎 + `ChainDiagnosisProfile` |
| **循环编排** | `campaign.py` 多资产循环 | 同一引擎 + `RWACampaignConfig` |
| **双层 Subagent** | `dataset-explorer` L1/L2 | S3 `Digital Ops` L1(Web3)/L2(Web2) |
| **中间刷新层** | `field_updater` | S3 数据整理分析层 |
| **实战验证量** | 5000+ Alpha 诊断 | 复用同一诊断引擎 |

## §2 nexrur 底座：Agent 的大脑与神经系统

> 完整设计见 [`nexrur/docs/Shared-Platform-Design.md`](../nexrur/docs/Shared-Platform-Design.md)

### nexrur 不是"胶水层"

旧架构中的"S4 Infra Agent"是胶水——ping 一下 Vercel、查一下 Firebase，然后发个告警。nexrur 是**大脑**——决定做不做、怎么做、失败了从哪一步重来。

| | 旧 S4 Infra Agent | nexrur 底座 |
|---|---|---|
| **Subagent 失败时** | 发告警，等人来 | DiagnosisEngine 双层诊断 → CampaignRunner 精确回退 |
| **跨步关联** | 无 | P1 Lineage 全链路 run_id 追踪 |
| **历史经验** | 无 | P2 RAG 检索历史修复方案 |
| **门禁** | 无 | P3 Gate 5 条规则自动阻断 |
| **断点续跑** | 无 | Checkpoint JSON 恢复 |
| **资产追踪** | 无 | AssetRegistry 10 态状态机 |
| **代码量** | ~200 行一次性脚本 | 14,800 行 + 1,311 测试 |

### 四大核心能力

#### 能力 1：P0-P3 治理机制

| 层级 | 职责 | AGV 具体化 |
|------|------|-----------|
| **P0 StepOutcome** | 每步必须产出 `outcome.json` | 每次 `forge test` / `cast call` / `vercel deploy` 都有结果记录 |
| **P1 Lineage** | 全链路 run_id 追踪 | S1 `oracle_run_id` → S2 `chain_run_id` → S3 `digital_run_id` 精确关联 |
| **P2 RAG** | 证据入向量库，语义检索 | "上次 forge test 因 stack too deep 失败"→ 检索到 `via_ir=true` 修复方案 |
| **P3 Gate** | 上游门禁（G0-G4） | S3 启动前检查 S2 链上状态是否 PASS，否则阻断 |

#### 能力 2：DiagnosisEngine — 失败根因分析

```
S2 Chain Ops 失败（forge test revert）
  ↓
DiagnosisEngine.diagnose()
  ├── Flash LLM (~2s): "pGVT.buy() revert — 可能是 presaleActive=false"
  ├── Pro LLM (验证): "确认。target_step=S2, reason_code=presale_inactive"
  └── RepairDiagnosis: {target_step: "S2", action: "cast send setPresaleActive(true)"}
  ↓
CampaignRunner: 精确回退到 S2 内部修复步骤
```

DiagnosisEngine 在 WQ-YI 上经过 **5000+ 次 Alpha 诊断**验证，同一引擎通过 `DiagnosisProfile` 注入 AGV 领域知识即可复用。

#### 能力 3：CampaignRunner — 循环编排 + 回退（self.orch 模式）

CampaignRunner 内部持有 Orchestrator (`self.orch`)，对齐 WQ-YI 架构：

- **Arb 模式**：`orch.run(end_step="execute")` → 诊断回退 → `orch.reset_from_step()` + `orch.resume()`
- **MM 模式**：无 Orchestrator，纯确定性心跳（30s 循环，零 LLM）
- **5 项终止条件**：目标达成 / 轮次上限 / 亏损熔断 / 连续失败 / 诊断停机

#### 能力 4：ToolLoopRunner — 多轮工具状态机

S3.L1 (Web3) 的 Thirdweb/Moralis 调用、S3.L2 (Web2) 的 Vercel/Firebase 操作，都通过 ToolLoopRunner 统一管理。

**TC 约束族**（从 WQ-YI 迁移）：TC1 查询审查、TC2 行为约束（去重/黑名单/熔断）、TC3 工具 bug 防御。

### nexrur 四层洋葱架构

```
┌─────────────────────────────────────────────────────────┐
│ L3: Skills (AGV 各 Subagent / WQ-YI 各 Skill)          │  ← 不在 nexrur
├─────────────────────────────────────────────────────────┤
│ L2: Adapters (AGV: ForgeExecutor / WQ-YI: MCPExecutor)  │  ← 不在 nexrur
├─────────────────────────────────────────────────────────┤
│ L1: Engines (Orchestrator, Campaign, Diagnosis, ToolLoop)│  ← nexrur
├─────────────────────────────────────────────────────────┤
│ L0: Core (Outcome, Audit, Evidence, Policy, Registry)    │  ← nexrur
└─────────────────────────────────────────────────────────┘
```

AGV 通过 4 个注入点接入 nexrur：

| 注入点 | AGV 实现 | 说明 |
|--------|---------|------|
| `PipelineDescriptor` | `AGV_PIPELINE`（4 步） | 定义 S1→S2→S3→S4 步骤链 |
| `CampaignConfig` | `RWACampaignConfig` | 回退策略表 + 终止条件 |
| `DiagnosisProfile` | `ChainDiagnosisProfile` | Solidity/链上错误诊断 prompt |
| `ToolExecutor` | `ForgeExecutor` / `VercelExecutor` | 工具执行后端 |

## §3 五步流水线总览

> **为什么是 5 步而非 4 步**：`digital_ops` 拆为 2 个逻辑步骤（L1 Web3 / L2 Web2），因为 L1 产出链上数据快照后，L2 才能构建和部署前端。
> 这与 WQ-YI 的 `dataset_l1` / `field_updater` / `dataset_l2` 拆分逻辑完全一致。

### 步骤定义

```python
AGV_STEP_ORDER = [
    "asset_oracle",    # S1
    "chain_ops",       # S2
    "digital_ops_l1",  # S3.L1 (Web3 数据采集)
    "digital_ops_l2",  # S3.L2 (Web2 构建部署)
    "kol",             # S4
]

AGV_STEP_TO_SUBAGENT = {
    "asset_oracle":   "agv-asset-oracle",    # S1
    "chain_ops":      "agv-chain-ops",       # S2
    "digital_ops_l1": "agv-digital-ops",     # S3.L1 (Web3)
    "digital_ops_l2": "agv-digital-ops",     # S3.L2 (Web2)
    "kol":            "agv-kol",             # S4
}

OPTIONAL_STEPS = frozenset({"kol"})  # S4 可选——无新内容时跳过
```

### AssetRef 资产流转

| Step | 产出 (kind) | 消费 (kind) |
|------|------------|------------|
| **S1 asset_oracle** | `daily_snapshot`, `monthly_settlement`, `station_status` | *(外部触发)* |
| **S2 chain_ops** | `token_state`, `nft_state`, `lp_state`, `tx_receipt` | `monthly_settlement` |
| **S3.L1 digital_ops** | `chain_data_snapshot`, `api_response` | `token_state`, `nft_state`, `lp_state` |
| **S3.L2 digital_ops** | `deploy_receipt`, `build_artifact` | `chain_data_snapshot` |
| **S4 kol** | `content_draft`, `campaign_record` | `deploy_receipt`, `chain_data_snapshot` |

### 回退策略表（backtrack_table）

| reason_code | 回退目标 | 场景 |
|-------------|---------|------|
| `oracle_data_stale` | S1 | 电表数据过期，需重新采集 |
| `oracle_signature_invalid` | S1 | EIP-712 签名验证失败 |
| `forge_compile_error` | S2 | 合约编译失败 |
| `forge_test_revert` | S2 | 测试 revert |
| `cast_send_revert` | S2 | 链上交易 revert |
| `moralis_timeout` | S3.L1 | 链上数据索引超时 |
| `thirdweb_error` | S3.L1 | 合约交互失败 |
| `vercel_build_fail` | S3.L2 | 前端构建失败 |
| `vercel_deploy_fail` | S3.L2 | 部署失败 |
| `firebase_auth_error` | S3.L2 | Firebase 配置问题 |
| `content_review_reject` | S4 | KOL 内容审核不通过 |
| `api_rate_limit` | S4 | Twitter/Discord API 限流 |

### Checkpoint 结构

```json
{
  "trace_id": "trace-2026-03-12T10-00-00Z-a1b2",
  "pipeline_run_id": "pipe-2026-03-12T10-00-00Z-c3d4",
  "status": "running",
  "current_step": "digital_ops_l1",
  "steps": {
    "asset_oracle": {"status": "completed", "step_run_id": "..."},
    "chain_ops":    {"status": "completed", "step_run_id": "..."},
    "digital_ops_l1": {"status": "running", "step_run_id": "..."}
  },
  "asset_pool": [
    {"kind": "daily_snapshot", "id": "station-001/2026-03-12"},
    {"kind": "token_state", "id": "pGVT/2026-03-12"}
  ]
}
```

## §4 S1: Asset + Oracle — 物理电站锚定

### 场景描述

S1 是**物理世界到数字世界的入口**。电站电表每 15 分钟产生一次读数，S1 负责：采集 → 校验 → 签名 → 上链存证 → 异常熔断。

### 数据源：电站电表

| 数据 | 采集频率 | 格式 | 说明 |
|------|---------|------|------|
| `solarKWhSum` | 每 15 分钟 | kWh × 10 | 光伏并网发电量 |
| `selfConsumedKWh` | 每 15 分钟 | kWh × 10 | 自消纳电量（仅披露） |
| `computeHoursSum` | 每 15 分钟 | h × 10 | 算力运行时长 |
| `records` | — | uint16 | 预期 96 条（15 分钟 × 24 小时） |

**采集协议**（待实现）：Modbus TCP / MQTT → 本地网关 → CSV 文件 → SHA-256 签名

### 链上合约：AGVOracle

S1 直接操作的链上合约（`onchainverification-main/src/AGVOracle.sol`，379 行）：

**角色模型**：

| 角色 | 说明 | S1 Agent 权限 |
|------|------|-------------|
| `DEFAULT_ADMIN_ROLE` | DAO multisig 合约管理 | ❌ 禁止 |
| `ORACLE_TEAM` | 日快照提交 | ⚠️ 有条件（自动） |
| `SETTLEMENT_MULTISIG` | 月结算提交 | ❌ 强制人工 |

**核心函数**：

| 函数 | 链上操作 | Agent 权限 | 说明 |
|------|---------|-----------|------|
| `storeDailySnapshot(data, signature)` | 写入日快照 | ⚠️ | EIP-712 签名验证后存入 |
| `storeMonthlySettlement(...)` | 写入月结算 | ❌ 强制人工 | 金额锚定 mint，revision=1 |
| `amendMonthlySettlement(...)` | 修正月结算 | ❌ 强制人工 | revision++ 追加修正 |
| `getEffectiveMonthlySettlement(...)` | 只读查询 | ✅ | 查询当前有效月结算 |

**EIP-712 签名结构**：

```solidity
struct DailySnapshotEIP712 {
    string date;              // "2026-03-12"
    string stationId;         // "station-001"
    uint256 solarKWhSum_x10;
    uint256 selfConsumedKWh_x10;
    uint256 computeHoursSum_x10;
    uint16 records;
    bytes32 sheetSha256;      // CSV 文件的 SHA-256
}
```

### 4 步执行流程

```
Step 1: Collect (采集)
  ├── 数据源: 电表网关 CSV / MQTT 消息 / 手动上传
  ├── 校验: records==96, 数值范围合理, 时间戳连续
  ├── 计算: sheetSha256 = SHA-256(canonical CSV)
  └── 输出: AssetRef(kind="daily_snapshot")

Step 2: Sign (签名)
  ├── 构造 EIP-712 typed data hash
  ├── ORACLE_TEAM 私钥签名
  └── 输出: signature bytes

Step 3: Store (上链)
  ├── 日快照: cast send storeDailySnapshot(data, sig) → Agent 自动
  ├── 月结算: cast send storeMonthlySettlement(...) → ❌ 强制人工
  └── 输出: AssetRef(kind="monthly_settlement", tx_hash=...)

Step 4: Monitor (监控 + 熔断)
  ├── 连续性: 今日 vs 昨日快照，偏差 > 30% → 告警
  ├── 完整性: records < 90 (< 93.75%) → 数据缺失告警
  ├── 签名: 链上 signer ≠ 预期地址 → 紧急熔断
  ├── 月对账: Σ(日快照 kWh) vs 月结算 kWh，偏差 > 5% → 审查
  └── 输出: AssetRef(kind="station_status")
```

### 工具清单

| 工具 | 类型 | 说明 |
|------|------|------|
| `csv_parser` | 本地 | 解析电表 CSV 文件 |
| `eip712_sign` | 本地 | 构造 + 签名 EIP-712 typed data |
| `cast call` | 链上 (只读) | 查询链上快照/结算状态 |
| `cast send` | 链上 (写入) | 提交日快照（需 ORACLE_TEAM 角色） |
| `sha256sum` | 本地 | 计算 CSV 文件哈希 |

### 门禁规则

| 操作 | Agent 权限 | 门禁 |
|------|-----------|------|
| CSV 采集 + 校验 | ✅ 完全自主 | P0 Outcome |
| EIP-712 签名 | ✅ 完全自主 | evidence 记录签名哈希 |
| `storeDailySnapshot` | ⚠️ 有条件 | 签名验证通过 + records ≥ 90 |
| `storeMonthlySettlement` | ❌ 强制人工 | 金额复核 + 多签 |
| `amendMonthlySettlement` | ❌ 强制人工 | 修正理由 + 多签 |
| 熔断告警 | ✅ 完全自主 | 自动发送到 Discord #alerts |

### 诊断 reason_codes

| reason_code | 含义 | DiagnosisEngine 处理 |
|-------------|------|---------------------|
| `oracle_data_stale` | 电表数据过期（> 24h 无更新） | 回退 S1 Step 1，检查网关连接 |
| `oracle_signature_invalid` | EIP-712 签名验证失败 | 回退 S1 Step 2，检查私钥/typed data |
| `oracle_records_incomplete` | records < 90 | 回退 S1 Step 1，等待补采 |
| `oracle_deviation_alarm` | 日vs月偏差 > 5% | 标记审查，不自动修正 |
| `oracle_store_revert` | 链上交易 revert | 检查 gas / nonce / role 权限 |

## §5 S2: Chain Ops — 链上运维

### 场景描述

S2 管理 **3 个合约仓库 / 19 个合约** 的全部链上操作：编译、测试、部署、Token 运维、LP 管理、TGE 迁移。

### 三个合约仓库

| 仓库 | Solidity 版本 | 合约数 | 测试数 | 特殊配置 |
|------|-------------|--------|--------|---------|
| `agvprotocol-contracts-main` | ^0.8.20 | 5 | 237 | ERC721A + UUPS |
| `onchainverification-main` | 0.8.27 (pinned) | 2 | 25 | EIP-712 |
| `tokencontracts-main` | ^0.8.20 | 13 | 264 | `via_ir=true` |

### 执行流程

```
触发（代码变更 / 定时 / 人工指令）
  ↓
影响范围分析（哪些合约？哪个 Foundry 项目？）
  ↓
forge build → 编译
  ├── 成功 → forge test -vvv
  │            ├── 全部通过 → outcome.json(status=success)
  │            └── 失败 → DiagnosisEngine 分析
  │                        ├── 可修复 → 修复 → 重新测试
  │                        └── 需人工 → 诊断报告 + 通知
  └── 失败 → DiagnosisEngine 分析编译错误
              ├── import 缺失 → 自动补充
              ├── 版本冲突 → 提示人工
              └── 语法错误 → 定位 + 修复建议
```

### 工具清单

| 工具 | 权限 | 说明 |
|------|------|------|
| `forge build` | ✅ 自主 | 编译（3 个项目分别配置） |
| `forge test -vvv` | ✅ 自主 | Verbose 测试 |
| `forge test --gas-report` | ✅ 自主 | Gas 分析 |
| `forge coverage` | ✅ 自主 | 覆盖率 |
| `forge script --dry-run` | ✅ 自主 | 部署模拟 |
| `forge script --broadcast` (testnet) | ⚠️ 条件 | P3 Gate + 通知 |
| `forge script --broadcast` (mainnet) | ❌ 禁止 | **强制人工签名** |
| `cast call` | ✅ 自主 | 链上只读查询 |
| `cast send` (testnet) | ⚠️ 条件 | P3 Gate |
| `cast send` (mainnet) | ❌ 禁止 | **强制人工签名** |

### 合约管辖矩阵

| 子领域 | 合约 | 关键操作 |
|--------|------|---------|
| **NFT** | SeedPass, TreePass, SolarPass, ComputePass, AgentRegistry | 批量 mint, UUPS 升级 |
| **Token** | pGVT V3, sGVT, GVT(待), Migrator, pSale | 预售/Vesting/TGE 迁移 |
| **DeFi** | BondingCurve, DAOController, PowerToMint | 曲线参数, 投票权 |
| **Oracle** | AGVOracle, OracleVerifier | 日快照测试 (S1 提交, S2 验证) |

### Token 运维子流程

| 操作 | 前置检查 | Agent 权限 |
|------|---------|-----------|
| `pGVT.buy()` 预售 | presaleActive==true, stage cap 未满 | ⚠️ 测试可自动 |
| `pGVT.setPresaleActive()` | PRICE_MANAGER_ROLE | ⚠️ testnet 自动 |
| `pGVT.sealVesting()` | **不可逆** — abort checklist 全满足 | ❌ 强制人工 |
| `sGVT.updateEligibility()` | DEFAULT_ADMIN_ROLE | ⚠️ 批量需确认 |
| `sGVT.finalize()` | **不可逆** — 白名单+LP+router 全配置 | ❌ 强制人工 |
| `pGVT.convertToGVT()` 批量 | GVT 已部署 + Migrator 已配置 | ❌ 强制人工 |
| LP `addLiquidity` | 价格偏离 < 5%, 滑点 < 2% | ❌ 强制人工 |

### 对账能力（原 Reconciliation Agent 的职能）

S2 内置链上/链下对账能力，不再需要独立的对账 Agent：

| 对账项 | 链上源 | 链下源 | 偏差阈值 |
|--------|-------|--------|---------|
| pGVT totalSupply | `cast call pGVT.totalSupply()` | 空投记录 | 0.01% |
| sGVT totalSupply | `cast call sGVT.totalSupply()` | BatchAirdrop 配置 | 0.01% |
| LP 价格 | PancakeSwap `getReserves()` | 预设锚定价格 | 5% |
| 日快照 kWh | `AGVOracle.dailySnapshots()` | 电表 CSV | 1% |
| 月结算 | `AGVOracle.monthlySettlements()` | Σ(日快照) | 5% |

### 诊断 reason_codes

| reason_code | 含义 | 回退 |
|-------------|------|------|
| `forge_compile_error` | 编译失败 | S2 内部重试 |
| `forge_test_revert` | 测试 revert | S2 DiagnosisEngine |
| `forge_test_timeout` | 测试超时 | 检查 fuzz 轮次 / via_ir |
| `gas_over_budget` | Gas 超预算 | 优化建议 |
| `storage_layout_break` | 存储布局破坏 | ❌ 停机 + 人工 |
| `cast_send_revert` | 链上交易 revert | 检查 role/nonce/gas |
| `reconciliation_mismatch` | 对账偏差超阈值 | 告警 + 审查 |
| `role_mismatch` | 权限不匹配 | 检查 role 授予链 |
| `via_ir_required` | 需要 via_ir 但未启用 | 自动修复 foundry.toml |

### 输出产物

```
docs/ai-runs/chain-ops/{run_id}/
├── compile_report.json      # 编译结果
├── test_report.json         # 测试结果（passed/failed/skipped）
├── reconciliation.json      # 对账结果
├── outcome.json             # P0
├── audit.jsonl              # P1
└── evidence.jsonl           # P2 (失败信息→RAG)
```

## §6 S3: Digital Ops — 数字化展现（L1 Web3 + L2 Web2）

### 设计灵感：WQ-YI dataset-explorer 的 L1/L2 模式

WQ-YI 的 `brain-dataset-explorer` 是**一个 Subagent 对应三个编排步骤**：

| 编排步骤 | 做什么 | 类比 S3 |
|---------|--------|--------|
| `dataset_l1` | Flash LLM 高召回推荐 category | S3.L1 Web3 拿链上数据 |
| `field_updater` | 刷新 category 元数据 | S3 数据整理层 |
| `dataset_l2` | ToolLoop 状态机精确绑定字段 | S3.L2 Web2 精确部署 |

**关键设计决策**：L1 和 L2 **同属一个 Subagent**——它们共享领域知识，不能被拆成独立 Agent。正如 WQ-YI 中 L1 category 推荐和 L2 字段绑定必须共享 `_semantic.yaml` 和 `_variants.yaml`，S3 的 Web3 查询和 Web2 部署必须共享合约 ABI、前端组件映射、环境变量矩阵等上下文。

### S3 三层架构

```
┌────────────────────────────────────────────────────────────────┐
│  S3.L1: Web3 运行时层                                           │
│  ├── Thirdweb SDK: 合约交互 (NFT mint / Token balance / LP)    │
│  ├── Moralis API: 链上数据索引 (BSC 事件、交易历史)              │
│  ├── BSC RPC: 原始链上调用 (cast call / eth_call)               │
│  └── Firebase Admin: Auth + Firestore 数据同步                  │
├────────────────────────────────────────────────────────────────┤
│  数据整理层 (Middle Layer)                                      │
│  ├── 链上原始数据 → 前端可消费格式                                │
│  │   (uint256 → human-readable, wei → ether, x10 → float)     │
│  ├── 环境变量矩阵校验 (15 组 × 7 项目)                          │
│  ├── ABI 一致性校验 (合约地址 vs 前端 contracts.ts)              │
│  └── 构建参数准备 (Node.js 版本 / pnpm 版本 / vercel.json)     │
├────────────────────────────────────────────────────────────────┤
│  S3.L2: Web2 展现层                                             │
│  ├── Vercel: 7 项目构建 + 部署 + 域名绑定                       │
│  ├── Cloudflare: DNS 解析 + CDN + SSL                           │
│  ├── Google Translation: 5 项目 i18n                            │
│  ├── Google Maps: asset 项目地理展示                              │
│  ├── Upstash Redis: 翻译缓存 + 限流                             │
│  └── Brevo: 定时邮件报告                                         │
└────────────────────────────────────────────────────────────────┘
```

### S3.L1: Web3 运行时层

#### 工具清单

| 工具 | 类型 | 使用项目 | 说明 |
|------|------|---------|------|
| Thirdweb SDK v5 | npm | agv-protocol-app, buy-page, G3-Funding, architecture | 合约读写交互 |
| Moralis API | REST | agv-protocol-app, buy-page | BSC 链数据索引 |
| BSC RPC (cast call) | 链上只读 | 所有 | 原始合约查询 |
| Firebase Admin | npm | 5 个项目 | Auth + Firestore + Storage |
| ethers.js v6 | npm | agv-protocol-app | `new Contract(addr, abi, signer)` |
| viem v2 | npm | buy-page | `getContract({ address, abi, client })` |

**⚠️ Web3 库不可混用**（AGENTS.md X4 规则）：每个项目固定使用一种 Web3 库，S3 Agent 必须根据目标项目选择正确的调用方式。

#### L1 执行流程

```
S3.L1 接收 S2 产出的 AssetRef(kind="token_state"/"nft_state"/"lp_state")
  ↓
Step 1: 链上数据快照
  ├── cast call pGVT.totalSupply()
  ├── cast call sGVT.totalSupply()
  ├── Moralis: 获取最近 NFT mint 事件
  ├── PancakeSwap: getReserves() 计算价格
  └── AGVOracle: 获取最新日快照
  ↓
Step 2: Firebase 同步
  ├── Auth: 用户数量统计
  ├── Firestore: 更新 token-stats collection
  └── Storage: 上传快照 JSON
  ↓
输出: AssetRef(kind="chain_data_snapshot")
```

### 数据整理层 (Middle Layer)

正如 WQ-YI 的 `field_updater` 在 L1 和 L2 之间刷新 category 元数据，S3 的数据整理层在 Web3 查询和 Web2 部署之间做**格式转换 + 一致性校验**。

#### 三项校验

| 校验 | 内容 | 失败处理 |
|------|------|---------|
| **ABI 一致性** | 合约部署地址 vs 前端 `contracts.ts` 中的地址 | 自动更新前端配置 |
| **环境变量完整性** | `.env.example` 中的 15 组变量 vs Vercel 实际配置 | 告警 + 补充建议 |
| **构建参数** | Node.js 20.x / pnpm 9 / vercel.json installCommand | 自动修复 |

#### 项目 × 服务矩阵

| 项目 | Firebase | Thirdweb | Moralis | Upstash | Translation | Maps |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| agv-protocol-app | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| investor-portal | ✅ | — | — | — | ✅ | — |
| buy-page | ✅ | ✅ | ✅ | — | ✅ | — |
| G3-Funding | ✅ | ✅ | — | ✅ | — | — |
| asset | ✅ | — | — | — | ✅ | ✅ |
| architecture | — | ✅ | — | — | — | — |
| taskon-verification | — | — | — | — | — | — |

### S3.L2: Web2 展现层

#### 7 项目部署配置

| 项目 | Vercel 名 | 域名 | Next.js | React | Tailwind |
|------|----------|------|---------|-------|----------|
| agv-protocol-app | agv | www.agvnexrur.ai | 15.5.7 | 18 | v3 |
| investor-portal | agv-invest | invest.agvnexrur.ai | 15.5.7 | 19 | v4 |
| buy-page | agv-buy | buy.agvnexrur.ai | 15.2.3 | 19 | v4 |
| G3-Funding | agv-fund | fund.agvnexrur.ai | 14.2.33 | 18 | v3 |
| asset | agv-assets | assets.agvnexrur.ai | 15.5.7 | 19 | v4 |
| architecture | agv-docs | docs.agvnexrur.ai | 15.2.3 | 19 | v4 |
| taskon-verification | agv-api | api.agvnexrur.ai | — | — | — |

#### L2 执行流程

```
S3.L2 接收数据整理层产出的 AssetRef(kind="chain_data_snapshot")
  ↓
Step 1: 构建准备
  ├── 校验 .env (FIREBASE_PROJECT_ID 等必需变量)
  ├── 校验 vercel.json (installCommand = "npx pnpm@9 install --no-frozen-lockfile")
  ├── 校验版本兼容性 (React 18 vs 19, Tailwind v3 vs v4)
  └── pnpm install (workspace 根目录)
  ↓
Step 2: 构建
  ├── pnpm --filter <project> build
  ├── 失败 → DiagnosisEngine 分析构建错误
  │         ├── 缺 env → 自动补充 (vercel env add)
  │         ├── TS 类型错误 → 修复建议
  │         └── OOM → 建议增加 NODE_OPTIONS
  └── 成功 → 构建产物
  ↓
Step 3: 部署
  ├── vercel --prod (从项目子目录)
  ├── DNS 校验 (Cloudflare CNAME 记录)
  └── 页面可访问性验证 (HTTP 200)
  ↓
Step 4: 监控
  ├── Vercel: 构建状态 / 域名健康 / 证书到期
  ├── Firebase: Auth 配额 / Firestore 规则
  ├── Cloudflare: DNS 解析 / SSL / 缓存命中率
  ├── Upstash Redis: 连接数 / 内存 / TTL
  └── Moralis: API 限额 / 响应时间
  ↓
输出: AssetRef(kind="deploy_receipt", metadata={url, build_time, status})
```

#### Vercel 构建关键约束

| 约束 | 说明 | Agent 处理 |
|------|------|-----------|
| Install 必须用 `npx pnpm@9` | corepack bug 绕过 | 校验 vercel.json |
| Root Directory 必须留空 | CLI 已从子目录执行 | 不设置 Dashboard |
| Node.js 20.x | 全部统一 | 校验 Dashboard Settings |
| PNPM_VERSION=9 (plain type) | 环境变量 | 校验 Vercel env |
| FIREBASE_PROJECT_ID 必需 | SSR 阶段强制校验 | 构建前预检 |

### 诊断 reason_codes

| reason_code | 属于 | 含义 | 回退 |
|-------------|------|------|------|
| `moralis_timeout` | L1 | Moralis API 超时 | 重试 + fallback RPC |
| `thirdweb_error` | L1 | Thirdweb 合约交互失败 | 检查 ABI/地址 |
| `firebase_auth_error` | L1 | Firebase 认证配置问题 | 检查 env vars |
| `vercel_build_fail` | L2 | pnpm build 失败 | DiagnosisEngine |
| `vercel_deploy_fail` | L2 | 部署失败 | 检查 vercel.json |
| `env_var_missing` | L2 | 环境变量缺失 | 自动补充 |
| `dns_resolution_fail` | L2 | DNS 解析失败 | 检查 Cloudflare |
| `version_conflict` | L2 | React/Next/Tailwind 版本混用 | 按项目固定版本 |

## §7 S4: KOL Operations — 社区增长与传播

### 架构定位

S4 是流水线的**末端消费者**——消费 S3 产出的部署好的前端 + S2 产出的链上数据，生成传播内容并管理 KOL 全生命周期。

> **详细设计见** [`SUBAGENT_KOL_DESIGN.md`](SUBAGENT_KOL_DESIGN.md)（~530 行，含 6 步 Pipeline、工具清单、门禁规则、传播平台矩阵）

### 6 步 Pipeline 概要

| Step | 名称 | 输入 | 输出 |
|------|------|------|------|
| 1 | Scout (发现) | Twitter/YouTube/论坛 | `kol_candidates.yml` |
| 2 | Outreach (外联) | 候选 KOL + LLM 模板 | `outreach_log.jsonl` |
| 3 | Review (审核) | KOL 内容草稿 | `review_report.json` |
| 4 | Track (追踪) | UTM/Bitly/GA | `performance_metrics.jsonl` |
| 5 | Settle (结算) | 绩效数据 | `settlement_record.json` |
| 6 | RAG (沉淀) | 全流程证据 | `evidence.jsonl` |

### 传播平台

| 平台 | 账号 | 用途 |
|------|------|------|
| Twitter/X | @agvnexrur | 品牌主账号，日常内容 |
| Discord | discord.gg/mJKTyqWtKe | 社区治理，KOL 协调 |
| Telegram | @agvnexrur_bot | 实时通知，快讯推送 |
| Brevo | 邮件API | 定时报告，KOL 外联 |

### 门禁（关键约束）

| 操作 | Agent 权限 |
|------|-----------|
| KOL 发现 + 评分 | ✅ 完全自主 |
| 外联发送 (≤10 封) | ✅ 自主 |
| 外联发送 (>10 封) | ⚠️ 人工确认 |
| Token 结算 | ❌ **强制人工确认 + 金额复核** |

## §8 安全边界与人工闸门

### 链上操作分级

| 操作 | 链 | Agent 权限 | 门禁 |
|------|-----|-----------|------|
| `forge test` | 无链 | ✅ 完全自主 | P0 Outcome |
| `forge script` (dry-run) | 无链 | ✅ 完全自主 | P0 Outcome |
| `forge script --broadcast` (testnet) | BSC Testnet | ⚠️ 有条件 | P3 Gate + 通知 |
| `forge script --broadcast` (mainnet) | BSC Mainnet | ❌ 禁止 | **强制人工签名** |
| `cast send` (testnet) | BSC Testnet | ⚠️ 有条件 | P3 Gate |
| `cast send` (mainnet) | BSC Mainnet | ❌ 禁止 | **强制人工签名** |
| `storeDailySnapshot` | BSC Mainnet | ⚠️ 有条件 | 签名验证 + records ≥ 90 |
| UUPS `upgradeToAndCall` | 任何链 | ❌ 禁止 | **multisig** |
| `sealVesting()` | 任何链 | ❌ 禁止 | **不可逆，强制人工** |
| `sGVT.finalize()` | 任何链 | ❌ 禁止 | **不可逆，强制人工** |

### 不可逆操作 Fail-fast 规则

**对链上不可逆操作，Agent 必须在执行前通过 abort checklist，任一项不满足 → 立即终止 + 人工升级：**

| 操作 | Abort 条件（任一触发 → 终止） | 后果 |
|------|------|------|
| `sealVesting()` | ① globalVesting 未设置 ② 有未过 cliff 的个人锁仓 ③ 参数与治理决议不一致 ④ 模拟 revert | vesting 永久锁定 |
| `sGVT.finalize()` | ① 白名单未含所有已知机构 ② LP pair 未设置 ③ router 未设置 ④ 模拟 revert | 转账策略永久锁定 |
| `upgradeToAndCall` | ① 新实现未在 testnet 验证 ② storage layout 不兼容 ③ 无 multisig ④ 无回滚方案 | Proxy 不可逆升级 |
| `convertToGVT()` 批量 | ① GVT 未部署 ② Migrator 无 MINTER_ROLE ③ gvtToken==address(0) ④ 单笔 > 配额 10% | pGVT 永久销毁 |
| LP `addLiquidity` | ① 价格偏离 > 5% ② 滑点 > 2% ③ 流动性 < 安全下限 ④ 非预期 pair 地址 | 初始定价锁定 |
| `revokeRole(DEFAULT_ADMIN)` | ① 仅存 1 个 admin ② 新 admin 未确认 ③ 无 timelock | 永久失去控制权 |

### 执行协议

```
Agent 收到不可逆操作请求
  ↓
1. 查询 abort checklist → 任一不满足 → ABORT + evidence.record("abort_reason")
2. 全部满足 → 生成 dry-run 模拟 (forge script --dry-run / cast call)
3. dry-run 成功 → 生成人工签名请求
4. 人工确认签名 → 执行
5. 执行后 → 验证链上状态 → evidence.record("post_execution_verify")
```

### AGV blocking_codes（agv_policy.yml）

```yaml
steps:
  chain_ops:
    gate:
      blocking_codes:
        - forge_compile_error
        - forge_test_revert
        - gas_over_budget
        - role_mismatch
        - storage_layout_break
      acceptable_statuses:
        - success
        - partial
  digital_ops:
    gate:
      blocking_codes:
        - vercel_build_fail
        - env_var_missing
        - firebase_auth_error
      acceptable_statuses:
        - success
        - partial
```

---

## §9 S5: MarketMaker-Agent — 做市与套利（分支 Campaign）

> **详细设计**: [agv-mm-arb/DESIGN.md](agv-mm-arb/DESIGN.md) v1.5

### 架构定位

S5 是**从 S2 chain_ops 分叉的独立分支**，与 S3/S4 主干并行运行。
它不参与 Orchestrator 编排，而是由独立的 CampaignRunner 实例驱动。

```
主干 (Orchestrator 编排):
  S1 → S2 ─┬→ S3.L1 → S3.L2 → S4
            │
分支 (独立 CampaignRunner):
            ├→ S5-Arb (collect→curate→dataset→execute→fix)  ← Arb 优先上线
            └→ S5-MM  (monitor→detect→decide→execute→log) ← 随后跟进

ForkPoint: chain_ops 之后，共享 lp_state 资产
```

### 双 Campaign 拓扑

| Campaign | 模式 | 频率 | LLM | 用途 |
|----------|------|------|-----|------|
| **S5-Arb** | 因子驱动 5 步管线 | 1 分钟/循环 | 定期校准 | **主动套利收益** |
| **S5-MM** | 确定性心跳 | 30 秒/心跳 | 零 | 被动护盘维稳 |

### 关键设计决策（D1-D5, 2026-03-19 确定）

| 编号 | 决策 | 结论 | 理由 |
|------|------|------|------|
| **D1** | Web3 库 | **web3.py** | BSC 生态最成熟，PancakeSwap V2 兼容 |
| **D2** | 上线优先级 | **Arb 优先** | collect 已生产级（93 测试），主动收益 > 被动护盘 |
| **D3** | 环境变量 | **AGV/.env + AGV/.env.s5** 双文件 | 做市私钥与 Web/合约凭据安全隔离 |
| **D4** | 部署模型 | **supervisord** 进程管理 | 单机双 Campaign，无 K8s 开销 |
| **D5** | 代码去重 | **toolloop_mm.py 为唯一真相源** | agent_ops_mm.py 薄桥接，禁止重复定义 Safety 类 |

### 三层安全护甲

| 层级 | 组件 | 阈值 |
|------|------|------|
| **Layer 1** | SlippageGuard | 2% 硬顶 |
| **Layer 2** | MEVGuard | $20+ → 私有 RPC |
| **Layer 3** | TVLBreaker | <$30 → HALT_ALL |

### 预授权体系（PreAuth — 人工设限，Agent 不可覆盖）

```yaml
preauth:
  arb:                                   # Arb 优先
    max_single_trade_usd: 50.0
    max_daily_volume_usd: 500.0
    max_daily_loss_usd: 50.0              # 超出 → 自动暂停
  mm:
    max_single_rebalance_usd: 10.0
    max_daily_gas_usd: 5.0
  global:
    approved_tokens: [pGVT, sGVT, USDT]
    approved_pools: [pGVT-USDT, sGVT-USDT]
    unapproved_pool_action: REJECT
```

### 实施路径（Arb 优先）

| Phase | 内容 | 状态 |
|-------|------|------|
| **Phase 0** | nexrur 安装 + _shared 108 测试 | ✅ 全绿 |
| **Phase 1** | D5 去重 + D3 统一 .env | ⏳ 待实施 |
| **Phase 2** | PancakeV2Adapter (web3.py) — Arb+MM 共享基座 | ⏳ 待实施 |
| **Phase 3** | Arb 端到端联调 (collect→curate→dataset→execute→fix) | ⏳ 待实施 |
| **Phase 4** | Arb 上线（BSC Mainnet 极小额真实交易） | ⏳ |
| **Phase 5** | MM 心跳联调 + 上线（复用 Phase 2 Adapter） | ⏳ |
| **Phase 6** | supervisord 部署 + 通知渠道 (Telegram+Discord) | ⏳ |

### 代码清单

| 文件 | 行数 | 职责 | 测试 |
|------|------|------|------|
| `skill_mm_arb.py` | 435 | 配置中枢 + 编排入口 | 35 |
| `toolloop_mm.py` | 564 | 共享执行层 + MM 心跳 | — |
| `toolloop_arb.py` | 375 | Arb 5 步管线 + 三级回退 | — |
| `modules/collect/` | ~1450 | GeckoTerminal + Moralis 双源融合 | 93 |
| `_shared/engines/_profiles.py` | 370 | 3 Profile + Lifecycle + Registry | 108 |
| **合计** | ~3194 | — | **236** |

---

# Part 4: 实施路线图

## R. 四阶段实施路线图

### Phase 0: 底座接入 (M0.1 – M0.3)

| 里程碑 | 内容 | 交付物 | 前置 |
|--------|------|--------|------|
| **M0.1** | nexrur pip 包发布 | `pip install nexrur` 可用 | — |
| **M0.2** | L2 适配层骨架 | `forge_executor.py`, `vercel_executor.py` | M0.1 |
| **M0.3** | S2 概念验证 | 单合约 `forge build → test → outcome.json` | M0.2 |

**M0 验收标准**：
```bash
pip install nexrur
python -c "from nexrur.core import StepOutcome; print('OK')"
python agv_agents/chain_ops.py --project tokencontracts-main --dry-run
# → 输出 outcome.json (status: success, test_passed: 264)
```

### Phase 1: 前两步闭环 (M1.1 – M1.3)

| 里程碑 | 内容 | 交付物 | 前置 |
|--------|------|--------|------|
| **M1.1** | S2 Chain Ops 生产化 | 3 个合约仓库全覆盖 + DiagnosisEngine | M0.3 |
| **M1.2** | S1 Asset+Oracle MVP | CSV 采集 + EIP-712 签名 + storeDailySnapshot | M0.1 |
| **M1.3** | S1→S2 联调 | S1 日快照 → S2 对账验证 | M1.1, M1.2 |

**MVP Loop 验收（M1.3 达成时）**：
1. S1 采集 CSV → EIP-712 签名 → storeDailySnapshot 上链 → outcome.json 产出
2. S2 自动 `cast call` 验证链上快照 vs 本地 CSV → 偏差 > 1% 告警
3. 两步 Lineage 关联：`oracle_run_id → chain_run_id`
4. 端到端延迟 < 5 分钟

### Phase 2: 全链路贯通 (M2.1 – M2.4)

| 里程碑 | 内容 | 交付物 | 前置 |
|--------|------|--------|------|
| **M2.1** | S3.L1 Web3 层 | Thirdweb/Moralis/Firebase 数据采集 | M1.1 |
| **M2.2** | S3.L2 Web2 层 | 7 项目 Vercel 自动构建 + 部署 | M2.1 |
| **M2.3** | S4 KOL MVP | 内容生成 + 审核 + 发布 | M2.2 |
| **M2.4** | CampaignRunner 集成 | 全链路 S1→S2→S3→S4 循环编排 | M2.1-M2.3 |

### Phase 3: 自愈与规模化 (M3.1 – M3.3)

| 里程碑 | 内容 | 交付物 | 前置 |
|--------|------|--------|------|
| **M3.1** | DiagnosisEngine 领域校准 | ChainDiagnosisProfile 实战调优 | M2.4 |
| **M3.2** | 多站点 Campaign | CampaignRunner 适配多电站 | M3.1 |
| **M3.3** | CI/CD 集成 | GitHub Actions → Agent 触发 | M3.2 |

### 整体时间线

```
Phase 0 (底座接入)   ████                          ← nexrur pip + L2 骨架 + PoC
Phase 1 (前两步)          ████████                  ← S1+S2 闭环 + MVP Loop
Phase 2 (全链路)                   ██████████       ← S3 L1/L2 + S4 KOL + Campaign
Phase 3 (自愈)                              ██████  ← Diagnosis 调优 + 多站点 + CI/CD
```

---

# Part 5: 附录

## 附录 A: 合约参数表

### pGVT V3

| 参数 | 值 | 说明 |
|------|-----|------|
| `MAX_SUPPLY` | 100,000,000 | 最大供应量 |
| `name` | "PreGVT" | Token 名称 |
| `symbol` | "pGVT" | Token 符号 |
| `decimals` | 18 | 精度 |
| `presaleActive` | true | 预售开关 |
| `Stage 1 price` | 0.005 USDT | 首阶段价格 |
| `Stage 1 cap` | 5,000,000 | 首阶段上限 |

### sGVT

| 参数 | 值 | 说明 |
|------|-----|------|
| `MAX_SUPPLY` | 100,000,000 | 最大供应量 |
| `name` | "Solar GVT" | Token 名称 |
| `symbol` | "sGVT" | Token 符号 |
| `decimals` | 18 | 精度 |
| `eligibleAddress` | 白名单制 | 接收方必须在白名单中 |

### GVT (待 TGE)

| 参数 | 值 | 说明 |
|------|-----|------|
| `MAX_SUPPLY` | 1,000,000,000 | 最大供应量 (双重 cap) |
| `name` | "GVT Token" | Token 名称 |
| `symbol` | "GVT" | Token 符号 |
| `decimals` | 18 | 精度 |
| Permit | EIP-2612 | Gasless approve |

### 链上部署地址 (BSC Mainnet)

| 合约 | 地址 | 状态 |
|------|------|------|
| pGVT V3 | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` | ✅ 已部署 |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` | ✅ 已部署 |
| Airdrop Badge | `0x704fa14df689ebdfaa4615019ab23a99c6041b29` | ✅ 已部署 |
| Deployer | `0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5` | — |
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` | — |
| PancakeSwap Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | — |
| pGVT-USDT LP | `0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0` | ✅ |
| sGVT-USDT LP | `0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d` | ✅ |

## 附录 B: 角色/权限矩阵

### pGVT V3 七角色

| 角色 | Admin | pSale | Multisig | Bridge | 说明 |
|------|:---:|:---:|:---:|:---:|------|
| DEFAULT_ADMIN_ROLE | — | — | ✅ | — | 角色管理 |
| MINTER_ROLE | ✅ | ✅ | — | — | mint (MAX_SUPPLY 限制) |
| VESTING_CONFIG_ROLE | — | — | ✅ | — | vesting (sealVesting 前) |
| PRICE_MANAGER_ROLE | ✅ | — | — | — | 预售定价 |
| TREASURY_ROLE | — | — | ✅ | — | 资金管理 |
| STAKING_MANAGER_ROLE | ✅ | — | — | — | 质押白名单 |
| SYSTEM_ROLE | — | — | — | ✅ | 迁移 (临时) |

### sGVT 权限

| 角色 | Admin | Operator | 说明 |
|------|:---:|:---:|------|
| DEFAULT_ADMIN_ROLE | ✅ | — | 白名单管理 + finalize |
| OPERATOR_ROLE | — | ✅ | DEX 路由配置 |
| MINTER_ROLE | ✅ | — | 机构铸造 |

### AGVOracle 权限

| 角色 | 说明 | S1 Agent |
|------|------|---------|
| DEFAULT_ADMIN_ROLE | 合约管理 | ❌ |
| ORACLE_TEAM | 日快照提交 | ⚠️ 有条件 |
| SETTLEMENT_MULTISIG | 月结算提交 | ❌ 强制人工 |

## 附录 C: Subagent × 工具映射

| Subagent | 合约/服务 | 工具 |
|----------|----------|------|
| **S1 Asset+Oracle** | AGVOracle | csv_parser, eip712_sign, cast call/send, sha256sum |
| **S2 Chain Ops** | 19 个合约 (3 仓库) | forge build/test/script/coverage, cast call/send |
| **S3.L1 Web3** | Thirdweb/Moralis/Firebase | thirdweb SDK, moralis API, firebase-admin, ethers.js/viem |
| **S3.L2 Web2** | Vercel/Cloudflare/Upstash | vercel CLI/API, cloudflare API, pnpm, brevo API |
| **S4 KOL** | Twitter/Discord/Telegram | tweepy, discord.py, telegram bot API, brevo |

## 附录 D: 三包查找表

| 需求 | 找哪里 |
|------|--------|
| StepOutcome / Audit / Evidence | `nexrur` → `src/nexrur/core/` |
| Orchestrator / CampaignRunner | `nexrur` → `src/nexrur/engines/` |
| DiagnosisEngine | `nexrur` → `src/nexrur/engines/` |
| forge CLI 包装 | `AGV` → `agv_agents/tools/forge_executor.py` (待建) |
| Vercel CLI 包装 | `AGV` → `agv_agents/tools/vercel_executor.py` (待建) |
| 4 个 Subagent 脚本 | `AGV` → `agv_agents/L3/` (待建) |
| Alpha 仿真适配 (参考) | `WQ-YI` → `.gemini/skills/_shared/engines/` |
| 量化 ToolLoop (参考) | `WQ-YI` → `.gemini/skills/_shared/engines/tool_loop.py` |
| 量化 DiagnosisEngine (参考) | `WQ-YI` → `.gemini/skills/_shared/engines/diagnosis.py` |
| KOL Pipeline 详细设计 | `AGV` → `SUBAGENT_KOL_DESIGN.md` |

## 附录 E: 开发环境盘点

| 工具 | 版本 | 用途 |
|------|------|------|
| Foundry (forge) | latest | Solidity 编译/测试/部署 |
| Node.js | 20.x | 前端构建 |
| pnpm | 9.x | 前端包管理 (workspace) |
| Python | 3.10+ | Agent 脚本 + nexrur |
| Vercel CLI | 50.29+ | 前端部署 |
| cast | latest (forge 内) | 链上交互 |
| solc | 0.8.20 / 0.8.27 | Solidity 编译器 |
| OpenZeppelin | 4.x | 合约库 |
| ERC721A | v4.x | NFT 批量 mint |

### Codespace 资源限制

| 规格 | CPU | 内存 | 影响 |
|------|-----|------|------|
| 基础 | 2C | 8G | `forge build` OK, Next.js build 可能 OOM |
| 推荐 | 4C | 16G | 全部构建可完成 |

## 附录 F: 第三方服务矩阵

| 服务 | 用途 | 使用项目 | 关键配置 |
|------|------|---------|---------|
| **Firebase** | Auth + Firestore + Storage | protocol-app, investor, buy-page, G3, asset | 3 Admin vars + 6 Client vars |
| **Thirdweb** | 钱包连接 + 合约交互 | protocol-app, buy-page, G3, architecture | NEXT_PUBLIC_THIRDWEB_CLIENT_ID |
| **Moralis** | BSC 链数据索引 | protocol-app, buy-page | MORALIS_API_KEY + NEXT_PUBLIC |
| **Upstash Redis** | 翻译缓存 + 限流 | protocol-app, G3 | REST_URL + TOKEN |
| **Cloudflare** | DNS + CDN + SSL | 全部 | 域名: agvnexrur.ai |
| **Vercel** | Hosting + SSR + Serverless | 7 项目 | installCommand = npx pnpm@9 |
| **Brevo** | 邮件通知 + KOL 外联 | buy-page, investor | BREVO_API_KEY |
| **Google Translation** | 多语言 i18n | protocol-app, investor, buy-page, asset | TRANSLATION_API_KEY |
| **Google Maps** | 资产地理展示 | asset | MAPS_API_KEY + 4 vars |
| **Discord** | 社区 + OAuth | buy-page (claim) | CLIENT_ID + SECRET + GUILD_ID |
| **Notion** | 钱包白名单 | taskon-verification | NOTION_TOKEN + DATABASE_ID |
| **Tally** | 申请表验证 | taskon-verification | TALLY_SIGNING_SECRET |
| **PancakeSwap** | DEX LP | 链上 | Router: 0x10ED...024E |
| **BscScan** | 合约验证 + Token Info | 链上 | API Key (部署时用) |
| **GeckoTerminal** | 价格聚合 | 自动索引 | 无需配置 |

---

> **文档维护**：本文档由 S3 Digital Ops Agent 负责与代码保持同步。  
> **v4.4 变更**：CampaignRunner self.orch 模式重写对齐 WQ-YI（Method B — CampaignRunner 内部持有 Orchestrator），322 测试全通过。  
> **v4.3 变更**：新增 §9 S5 MarketMaker-Agent 分支 Campaign 章节（双 Campaign 拓扑 + D1-D5 设计决策 + Arb 优先路径 + 三层安全 + 预授权体系）；Part 3 标题从"4 主 Subagent"更新为"5 Subagent"；删除重复的 `_DESIGN.md`。  
> **v4.2 变更**：新增 Σ.12 比特币信任模型对齐（S1→S2 投资者信任根基 / S2→S3 监管审计根基 / S4 纯效率）；Part 2 Section B 从旧 Layer 1/2/3 项目分层重写为 Subagent 数据流视角；C.1/C.2/C.3 标题标注 Subagent 归属。  
> **v4.1 变更**：v4.0 从 S1-S8 碎片化 Agent 架构重写为 4 主 Subagent 数据驱动流水线；v4.1 清除 Part 1 旧模型残影、修复 STEP_ORDER 4→5 步 schema 对齐、路线图三→四阶段、新增运维职责映射表。  
> 修改合约/前端/部署状态时，应同步更新对应章节。  
> 原始 v3.1 已备份为 `DESIGN.md.bak`。
