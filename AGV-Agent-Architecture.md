# AGV Agent — 协议级自治开发运维系统架构设计

> **文档版本**: v1.0  
> **日期**: 2026-03-04  
> **定位**: 将 AGV Protocol 的三仓库人类架构师/开发者/运维者角色，交由 LLM Agent 系统自治执行  
> **底座**: nexrur — 三包共享平台底座（详见 `Shared-Platform-Design.md`）  
> **前置文档**:  
> - `DESIGN.md` v2.0 — AGV Protocol 战略定位 + 代码审计备忘录（含 Σ 章降维打击）  
> - `Shared-Platform-Design.md` v2.0 — nexrur × AGV × WQ-YI 三包平台设计（四层洋葱 + 模块抽象 + 包结构）  
> - `NFT-AgentRegistry-Architecture.md` — NFT Pass & AgentRegistry 架构方案  
> - WQ-YI `AGENTS.md` — 量化 Agent 编排底座完整规范  
>
> **变更记录**:  
> | 版本 | 日期 | 变更 |
> |---|---|---|
> | v0.1 | 2026-03-03 | 初版讨论稿 |
> | v1.0 | 2026-03-04 | 对齐 nexrur 三包架构；§12-13 移入 DESIGN.md Σ 章；§6/§3.2/附录B 精简并交叉引用；重编章号 |
> | v1.1 | 2026-03-04 | 新增附录D 多电站电表模拟器设计 |
> | v1.2 | 2026-03-04 | 新增附录E 开发环境与部件全景清单 |

---

## 目录

- [1. 核心洞察：你要替代的不是代码，是"人"](#1-核心洞察你要替代的不是代码是人)
- [2. 现状诊断：三个仓库的人类操作清单](#2-现状诊断三个仓库的人类操作清单)
- [3. AGV Agent 总体架构](#3-agv-agent-总体架构)
  - [3.1 三层架构：Master Agent + 3 SubAgent + Gate](#31-三层架构master-agent--3-subagent--gate)
  - [3.2 与 nexrur 四层洋葱的对齐](#32-与-nexrur-四层洋葱的对齐)
- [4. Master Agent：跨域架构师](#4-master-agent跨域架构师)
  - [4.1 核心职责](#41-核心职责)
  - [4.2 编排管线（Pipeline）](#42-编排管线pipeline)
  - [4.3 跨域决策引擎](#43-跨域决策引擎)
- [5. 三个 SubAgent 详解](#5-三个-subagent-详解)
  - [5.1 SubAgent-NFT（agvprotocol-contracts-main）](#51-subagent-nftagvprotocol-contracts-main)
  - [5.2 SubAgent-Oracle（onchainverification-main）](#52-subagent-oracleonchainverification-main)
  - [5.3 SubAgent-Token（tokencontracts-main）](#53-subagent-tokentokencontracts-main)
- [6. 四层治理：AGV 落地实例](#6-四层治理agv-落地实例)
  - [6.1 P0 Outcome — 结果治理](#61-p0-outcome--结果治理)
  - [6.2 P1 Lineage — 血缘治理](#62-p1-lineage--血缘治理)
  - [6.3 P2 RAG — 证据治理](#63-p2-rag--证据治理)
  - [6.4 P3 Gate — 门控治理](#64-p3-gate--门控治理)
- [7. 自愈双循环：编译→测试→诊断→修复](#7-自愈双循环编译测试诊断修复)
  - [7.1 Inner Loop：单合约自愈](#71-inner-loop单合约自愈)
  - [7.2 Outer Loop：跨仓库自愈](#72-outer-loop跨仓库自愈)
  - [7.3 不可自愈边界：链上操作](#73-不可自愈边界链上操作)
- [8. ToolLoop 状态机：确定性执行管线](#8-toolloop-状态机确定性执行管线)
- [9. 跨域知识索引（Evidence → RAG）](#9-跨域知识索引evidence--rag)
- [10. 示例场景：电表控制铸币的完整 Agent 流程](#10-示例场景电表控制铸币的完整-agent-流程)
- [11. 更多跨域场景清单](#11-更多跨域场景清单)
- [12. 机构验真指标（KPI）](#12-机构验真指标kpi)
- [13. 安全边界与人类 Gate](#13-安全边界与人类-gate)
- [14. 实施路线图](#14-实施路线图)
- [附录 A：AGV 合约与 Agent 工具映射](#附录-a-agv-合约与-agent-工具映射)
- [附录 B：三包概念速查（精简版）](#附录-b-三包概念速查精简版)
- [附录 C：四主体业务结构与 Agent 嵌入点](#附录-c-四主体业务结构与-agent-嵌入点)
- [附录 D：多电站电表模拟器设计](#附录-d-多电站电表模拟器设计)
- [附录 E：开发环境与部件全景清单](#附录-e-开发环境与部件全景清单)

---

## 1. 核心洞察：你要替代的不是代码，是"人"

传统理解"AI + 智能合约"是：用 LLM 生成 Solidity 代码。这只是 AGV Agent 的一小部分。

AGV Agent 要替代的是**横跨三个合约仓库的人类架构师角色**——这个人每天做的事情包括：

| 人类操作 | 具体内容 | 频率 |
|---------|---------|------|
| **跨仓库理解** | 读 AGVOracle → 发现月结算没约束 PowerToMint 的铸造 | 架构审查时 |
| **设计决策** | "两个应该连起来"→ 写接口 → 写集成代码 | 需求变更时 |
| **编码** | 写 Solidity + 测试 + 部署脚本 | 持续开发 |
| **编译诊断** | `forge build` 报错 → 读错误 → 修代码 → 重编 | 每次改动 |
| **测试循环** | `forge test` → 失败 → 读 revert reason → 修 → 重跑 | 反复迭代 |
| **跨仓部署** | 先部署 Oracle → 拿地址 → 传给 Token 合约部署脚本 | 部署时 |
| **运维监控** | 月结算是否按时上链？铸造量是否异常？ | 每日/每月 |
| **风险响应** | Oracle 停报了 → 要不要暂停铸造？ → 调 `pause()` | 异常时 |

**AGV Agent = 把上表所有操作交给 LLM Agent 系统**：

```
之前：你（人类） ──读代码──写代码──跑测试──部署──监控──响应──→ 三个合约仓库

之后：你（Gate审批者）                                    ┐
        │                                                │
        └── 只审批：主网部署 / UUPS升级 / 大额铸造          │
                                                         │
      AGV Master Agent ──理解──设计──编码──测试──部署──→ 三个合约仓库
        ├── SubAgent-NFT      (理解NFT Pass语义)
        ├── SubAgent-Oracle   (理解日快照/月结算语义)
        └── SubAgent-Token    (理解rGGP/GVT/BondingCurve语义)
```

类比当前对话：你是人类，GitHub Copilot（我）是 Coding Agent，我在帮你读代码、理解架构、做跨仓库设计。**AGV Agent 就是把这个关系固化成一个 7×24 自治系统**。

---

## 2. 现状诊断：三个仓库的人类操作清单

基于 `DESIGN.md` 审计发现，当前需要人类执行的操作全量清单：

### 2.1 开发态操作

| # | 操作 | 涉及仓库 | 难度 | Agent 可自治? |
|---|------|---------|------|-------------|
| 1 | P0 缺陷修复（DAO投票权/除零/端到端测试/接口对齐） | token + oracle | 高 | ✅ 可（编码+测试闭环） |
| 2 | 三仓库链上集成代码（当前完全隔离） | 全部 | 高 | ✅ 可（跨域设计+编码） |
| 3 | AI 生成代码清理（`[cite:XX]`标记/拼写错误/模板克隆） | oracle + nft | 中 | ✅ 可（模式匹配+重构） |
| 4 | BasePass 基类重构（4个NFT合约的共性提取） | nft | 中 | ✅ 可（AST分析+重构） |
| 5 | 共享 Mock 提取（4个测试文件重复的 MockUSDT） | nft | 低 | ✅ 可 |
| 6 | DAOController 跨合约集成（投票权=NFT持仓+GVT质押） | token + nft | 高 | ✅ 可（跨域接口设计） |
| 7 | Oracle 真值锚点对齐（AGVOracle ↔ OracleVerification） | oracle + token | 高 | ✅ 可（架构决策+编码） |

### 2.2 部署态操作

| # | 操作 | 涉及仓库 | 风险 | Agent 可自治? |
|---|------|---------|------|-------------|
| 8 | 测试网部署全流程 | 全部 | 低 | ✅ 可（forge script） |
| 9 | 主网部署 | 全部 | **极高** | ⚠️ 需 Gate 审批 |
| 10 | UUPS 升级执行 | nft | **极高** | 🔴 必须人类审批 |
| 11 | 多签操作（月结算提交） | oracle | 高 | ⚠️ 需 Gate 审批 |

### 2.3 运维态操作

| # | 操作 | 涉及仓库 | 频率 | Agent 可自治? |
|---|------|---------|------|-------------|
| 12 | 日快照数据提交 | oracle | 每日 | ✅ 可（定时+EIP-712签名） |
| 13 | 月结算数据提交 | oracle | 每月 | ⚠️ 需 Gate 审批（涉及铸币权） |
| 14 | 铸造量监控 vs 月结算上限 | oracle + token | 持续 | ✅ 可（链上监听+告警） |
| 15 | Oracle 存活性检查 | oracle | 持续 | ✅ 可（stale source 自动暂停） |
| 16 | Epoch 管理（rGGP/BondingCurve） | token | 每季 | ✅ 可 |
| 17 | 异常响应（暂停/恢复） | 全部 | 异常时 | ⚠️ 暂停可自治，恢复需 Gate |

---

## 3. AGV Agent 总体架构

### 3.1 三层架构：Master Agent + 3 SubAgent + Gate

```
                        ┌──────────────────────┐
                        │    Human Gate         │
                        │  (你/多签/DAO)         │
                        │                      │
                        │  审批：               │
                        │  · 主网部署           │
                        │  · UUPS 升级          │
                        │  · 月结算提交          │
                        │  · 大额铸造 (>阈值)    │
                        └──────────┬───────────┘
                                   │ approve / reject
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     AGV Master Agent                                 │
│                                                                      │
│  职责：跨域架构决策 · 管线编排 · 冲突仲裁 · Gate 路由                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Orchestrator (编排器)                        │  │
│  │  Step 1: Detect   → 发现跨域问题/需求                          │  │
│  │  Step 2: Design   → 跨域接口设计                               │  │
│  │  Step 3: Assign   → 分配给 SubAgent                           │  │
│  │  Step 4: Build    → SubAgent 编码                             │  │
│  │  Step 5: Test     → 单仓 + 集成测试                            │  │
│  │  Step 6: Review   → 交叉审查 + Gate 判断                       │  │
│  │  Step 7: Deploy   → 测试网/主网部署                             │  │
│  │  Step 8: Monitor  → 链上持续监控                               │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────┬───────┴────────┬───────────────────┐         │
│  │                   │                │                   │         │
│  ▼                   ▼                ▼                   │         │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │         │
│ │ SubAgent    │  │ SubAgent    │  │ SubAgent    │       │         │
│ │ NFT         │  │ Oracle      │  │ Token       │       │         │
│ │             │  │             │  │             │       │         │
│ │ 理解：       │  │ 理解：       │  │ 理解：       │       │         │
│ │ · 4种Pass   │  │ · 日快照     │  │ · GVT/rGGP  │       │         │
│ │ · ERC721A   │  │ · 月结算     │  │ · Bonding   │       │         │
│ │ · UUPS      │  │ · EIP-712   │  │ · DAO       │       │         │
│ │ · Merkle WL │  │ · 修正链    │  │ · Vesting   │       │         │
│ │             │  │             │  │ · PowerMint │       │         │
│ │ 工具：       │  │ 工具：       │  │ 工具：       │       │         │
│ │ forge build │  │ forge build │  │ forge build │       │         │
│ │ forge test  │  │ forge test  │  │ forge test  │       │         │
│ │ 读/写 .sol  │  │ 读/写 .sol  │  │ 读/写 .sol  │       │         │
│ └─────────────┘  └─────────────┘  └─────────────┘       │         │
│                                                          │         │
│  ┌───────────────────────────────────────────────────────┘         │
│  │                                                                 │
│  ▼                                                                 │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │                    nexrur 底座                               │   │
│ │                                                              │   │
│ │  outcome.sol.json  — 编译/测试/部署结果      (L0 Core)        │   │
│ │  audit.jsonl       — 事件流黑匣子            (L0 Core)        │   │
│ │  evidence.jsonl    — 决策证据链              (L0 Core)        │   │
│ │  runtime           — RunContext (trace_id, asset_ref)         │   │
│ │  policy            — PlatformPolicy (Gate 阈值, 自愈策略)      │   │
│ │  cache             — LLM/编译缓存                             │   │
│ │  orchestrator      — Orchestrator + CampaignRunner  (L1)     │   │
│ │  diagnosis         — DiagnosisEngine                (L1)     │   │
│ │  toolloop          — ToolLoopRunner + ToolExecutor  (L1)     │   │
│ └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 与 nexrur 四层洋葱的对齐

> **完整的四层洋葱模型、逐模块代码设计、pyproject.toml 包结构** → 见 `Shared-Platform-Design.md` §4-20

AGV Agent 架构中的每个组件都对应 nexrur 四层洋葱的一个层级：

```
┌─ L3 Skills ───────────────────────────────────────────────────┐
│  本文档 §5: 三个 SubAgent 的领域知识 + 工具清单                  │
│  detect-change / write-solidity / forge-test / deploy-script  │
├─ L2 Adapters ─────────────────────────────────────────────────┤
│  contract_pipeline.py    → AGV 8-step PipelineDescriptor      │
│  contract_lifecycle.py   → 合约 DRAFT→DEPLOYED→MONITORED      │
│  contract_diagnosis.py   → COMPILE_ERROR / TEST_REVERT 等 13码 │
│  forge_executor.py       → ForgeExecutor: forge build/test    │
├─ L1 Engines (nexrur 共享) ────────────────────────────────────┤
│  Orchestrator · ToolLoopRunner · CampaignRunner               │
│  DiagnosisEngine · AgentOps                                   │
├─ L0 Core (nexrur 共享) ──────────────────────────────────────┤
│  RunContext · AuditBus · EvidenceStore · PlatformPolicy       │
│  StepOutcome · CacheKey · VectorStore · RAGPipeline           │
└───────────────────────────────────────────────────────────────┘
```

**关键映射速查**：

| 本文档章节 | nexrur 对应 | Shared-Platform 详细设计 |
|---|---|---|
| §6 四层治理 (P0-P3) | L0 StepOutcome + L0 AuditBus + L0 EvidenceStore + L0 PlatformPolicy | §5-14 |
| §7 自愈双循环 | L1 DiagnosisEngine + L2 contract_diagnosis.py | §11 |
| §8 ToolLoop 状态机 | L1 ToolLoopRunner + L2 forge_executor.py | §9 |
| §9 跨域知识索引 | L0 EvidenceStore + L0 VectorStore | §14-15 |
| §10-11 场景 | L2 contract_pipeline.py 驱动 L1 Orchestrator | §6, §10 |

---

## 4. Master Agent：跨域架构师

### 4.1 核心职责

Master Agent 不写具体的 Solidity 代码——它做的是**你现在做的事**：

1. **问题发现**：读三个仓库的合约/测试/部署脚本，发现跨域问题
2. **架构决策**：决定"AGVOracle 应该控制 PowerToMint 的铸造上限"
3. **接口设计**：定义 `IAGVOracle` 接口，让 SubAgent-Token 能调用
4. **任务分配**：指挥 SubAgent-Oracle 暴露接口 + SubAgent-Token 消费接口
5. **冲突仲裁**：SubAgent-Oracle 说月结算是 immutable，SubAgent-Token 说需要 amend 后重新计算——Master 做裁决
6. **Gate 路由**：判断哪些操作可以自治（测试网部署），哪些需要人类审批（主网升级）

### 4.2 编排管线（Pipeline）

```
Sprint Pipeline（一次完整的跨域开发周期）

┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: DETECT                                                       │
│ ─────────────────                                                    │
│ 输入：DESIGN.md 风险清单 / 新需求 / 链上异常事件                        │
│ 处理：Master Agent 识别跨域影响范围                                     │
│ 输出：Impact Report                                                  │
│   {                                                                  │
│     trigger: "P1-04: 三仓库缺乏链上集成",                              │
│     affected_repos: ["onchainverification", "tokencontracts"],       │
│     affected_contracts: ["AGVOracle", "PowerToMint"],                │
│     cross_domain: true,                                              │
│     severity: "P0"                                                   │
│   }                                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Step 2: DESIGN                                                       │
│ ─────────────────                                                    │
│ 输入：Impact Report + 三仓库 ABI/NatSpec/现有接口                      │
│ 处理：Master Agent 生成跨域接口设计                                     │
│ 输出：Interface Design Document                                      │
│   {                                                                  │
│     new_interface: "IAGVOracle.getEffectiveMonthlySettlement()",     │
│     consumer: "PowerToMint.processOutput()",                         │
│     constraint: "periodMintedKWh <= gridDeliveredKWh_x10",          │
│     breaking_changes: ["PowerToMint 新增 agvOracle 依赖"],           │
│     evidence: ["DESIGN.md#E.1", "AGVOracle.sol#L220-L230"]          │
│   }                                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3: ASSIGN                                                       │
│ ─────────────────                                                    │
│ 处理：Master Agent 将设计拆分为 SubAgent 任务                           │
│ 输出：Task Assignment                                                │
│   SubAgent-Oracle:                                                   │
│     - 确保 getEffectiveMonthlySettlement() 为 public view            │
│     - 导出 IAGVOracle interface 到共享位置                             │
│   SubAgent-Token:                                                    │
│     - PowerToMint 新增 IAGVOracle 依赖                               │
│     - processOutput() 新增月结算上限校验                               │
│     - 新增 periodMintedKWh 存储 + 视图函数                            │
│     - 编写集成测试                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Step 4: BUILD                                                        │
│ ─────────────────                                                    │
│ 处理：各 SubAgent 并行编码                                              │
│ 工具：读/写 .sol + forge build                                        │
│ 自愈：编译失败 → Inner Loop 诊断修复                                    │
│ 输出：编译通过的合约代码                                                │
├─────────────────────────────────────────────────────────────────────┤
│ Step 5: TEST                                                         │
│ ─────────────────                                                    │
│ 处理：                                                                │
│  (a) 各 SubAgent 单仓测试 (forge test --match-contract)              │
│  (b) Master Agent 编排集成测试 (跨仓 mock)                             │
│ 自愈：测试失败 → 读 revert reason → 定向修代码 → 重跑                   │
│ 输出：测试全绿 + 覆盖率报告                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Step 6: REVIEW                                                       │
│ ─────────────────                                                    │
│ 处理：                                                                │
│  (a) 交叉审查：SubAgent-Oracle 审查 Token 对其接口的使用是否正确         │
│  (b) Gate 判断：是否需要人类审批                                        │
│ 规则：                                                                │
│  · 修改 _authorizeUpgrade → 🔴 强制人类审批                           │
│  · 修改 MINTER_ROLE 权限 → 🔴 强制人类审批                            │
│  · 纯逻辑修改 + 测试全绿 → ✅ 自动通过                                 │
│ 输出：Review Report + Gate Decision                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Step 7: DEPLOY                                                       │
│ ─────────────────                                                    │
│ 处理：                                                                │
│  测试网 → SubAgent 自动执行 forge script                               │
│  主网 → 生成部署脚本 → 提交 Gate → 等人类 approve → 执行               │
│ 输出：部署结果 + 合约地址 + verify 状态                                 │
├─────────────────────────────────────────────────────────────────────┤
│ Step 8: MONITOR                                                      │
│ ─────────────────                                                    │
│ 处理：持续监控链上状态                                                  │
│  · 铸造量 vs 月结算上限                                                │
│  · Oracle 存活性 (stale source detection)                            │
│  · Epoch cap 使用率                                                  │
│  · 异常交易 (非预期 role 调用)                                         │
│ 触发：发现异常 → 回到 Step 1 (新的 Sprint)                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 跨域决策引擎

Master Agent 需要理解的**跨域依赖拓扑**：

```
agvprotocol-contracts-main          onchainverification-main          tokencontracts-main
┌─────────────────────┐            ┌─────────────────────┐           ┌──────────────────────┐
│ ComputePass (NFT)   │ ──持仓──→ │                     │           │ DAOController        │
│ SolarPass (NFT)     │           │                     │           │  getVotingPower()    │
│ TreePass (NFT)      │ ──tokenId─→│                     │           │  ⚠ 现在返回硬编码 1   │
│ SeedPass (NFT)      │  注册到    │ AGVOracle            │──月结算──→│                      │
│                     │           │  gridDeliveredKWh   │  上限控制  │ PowerToMint          │
│                     │           │  effectiveRevision  │           │  processOutput()     │
│                     │           │                     │           │  ⚠ 现在无上限约束     │
│                     │           └─────────────────────┘           │                      │
│                     │                                             │ rGGP                 │
│                     │                                             │  mintFromOutput()    │
│                     │ ──持仓量──→                                  │  epochCap (季度)     │
│                     │  + GVT质押量                                 │                      │
│                     │  = 投票权                                    │ BondingCurve         │
│                     │                                             │  rGGP → GVT          │
│                     │                                             │  ⚠ 除零漏洞 (P0-02) │
│                     │                                             │                      │
│                     │                                             │ GVT                  │
│                     │ ──Vesting──→                                 │  1B 硬上限           │
│                     │  释放应受资产产出约束                           │  VestingVault        │
└─────────────────────┘                                             └──────────────────────┘

虚线 = 当前缺失的集成（需要 Agent 建立）
实线 = 当前已存在的调用关系
```

---

## 5. 三个 SubAgent 详解

### 5.1 SubAgent-NFT（agvprotocol-contracts-main）

**领域知识清单**：

| 知识项 | 内容 |
|--------|------|
| 合约标准 | ERC721A-Upgradeable + UUPS 代理模式 |
| 四种 Pass | ComputePass(99) / SolarPass(300) / TreePass(300) / SeedPass(600) |
| 铸造模式 | Public Mint / Whitelist Mint / Agent Mint（ComputePass/SolarPass 专有） |
| 支付 | USDT (ERC20, 6 decimals) |
| 角色 | ADMIN_ROLE / TREASURER_ROLE / AGENT_MINTER_ROLE |
| 升级风险 | `_authorizeUpgrade` → 系统性风险点，修改需 Gate |
| 已知问题 | 4 合约应重构为 BasePass 基类；MockUSDT 重复 |

**可执行工具**：

| 工具 | 用途 |
|------|------|
| `forge build` (agvprotocol) | 编译 NFT 合约 |
| `forge test` (agvprotocol) | 运行 NFT 测试 |
| `read/write .sol` | 修改合约源码 |
| `cast call` | 读取链上 NFT 状态（totalSupply, balanceOf） |

### 5.2 SubAgent-Oracle（onchainverification-main）

**领域知识清单**：

| 知识项 | 内容 |
|--------|------|
| 数据架构 | 两层：DailySnapshot（证据层）+ MonthlySettlement（锚点层） |
| 签名标准 | EIP-712 typed data signature |
| 角色 | ORACLE_TEAM（日快照）/ SETTLEMENT_MULTISIG（月结算） |
| 采样要求 | 每日 96 条（15 分钟间隔） |
| 修正机制 | `amendMonthlySettlement()` 自动递增 revision，完整历史保留 |
| 关键数据 | `gridDeliveredKWh_x10`（国网电费单确认的交付电量） |
| 已知问题 | IAGVOracle 接口与 AGVOracle 实现不匹配 (P0-04)；max revision 测试空壳 (P2-01) |

**可执行工具**：

| 工具 | 用途 |
|------|------|
| `forge build` (onchainverification) | 编译 Oracle 合约 |
| `forge test` (onchainverification) | 运行 Oracle 测试 |
| `read/write .sol` | 修改合约源码 |
| `cast call getEffectiveMonthlySettlement()` | 读取链上月结算数据 |
| `EIP-712 sign` | 构造日快照签名 |

### 5.3 SubAgent-Token（tokencontracts-main）

**领域知识清单**：

| 知识项 | 内容 |
|--------|------|
| GVT | 治理代币，1B 硬上限，线性 Vesting，EIP-2612 Permit |
| rGGP | 激励代币，无上限，基于验证产出铸造（10/kWh, 25/kg, 15/hour），Epoch Cap |
| BondingCurve | rGGP→GVT 转换，10:1 基准比率，5% 折扣，7-30 天 Vesting |
| PowerToMint | IoT→Oracle→Mint 编排器，NFT 资产注册，批量处理 |
| OracleVerification | 多源 Oracle 管理，签名验证，SLA 追踪 |
| DAOController | 提案→投票→时间锁→执行，6 种提案类别 |
| VestingVault | 独立锁仓管理 |
| 已知问题 | BondingCurve 除零 (P0-02)；PowerToMint 无成功路径 E2E 测试 (P0-03)；`batchProcessOutputs` 外部自调用 (P1-02)；VestingVault 允许超额承诺 (P1-03) |

**可执行工具**：

| 工具 | 用途 |
|------|------|
| `forge build` (tokencontracts) | 编译 Token 合约 |
| `forge test` (tokencontracts) | 运行 Token 测试 |
| `read/write .sol` | 修改合约源码 |
| `cast call/send` | 链上交互（读余额、触发铸造等） |

---

## 6. 四层治理：AGV 落地实例

> **四层治理的底座代码设计**（StepOutcome / AuditBus / EvidenceStore / PlatformPolicy）→ 见 `Shared-Platform-Design.md` §5-14  
> 本节聚焦 AGV Agent 的**具体落地**：每一层在 Solidity 开发运维场景中长什么样。

### 6.1 P0 Outcome — 结果治理

每一步操作的确定性结果，由 nexrur L0 `StepOutcome` 承载。

```json
// outcome.json 示例
{
  "sprint_id": "sprint-2026-03-003",
  "step": "BUILD",
  "subagent": "SubAgent-Token",
  "target": "PowerToMint.sol",
  "status": "PASS",
  "metrics": {
    "compile_time_ms": 3200,
    "test_count": 47,
    "test_pass": 47,
    "test_fail": 0,
    "coverage_line": 0.92,
    "coverage_branch": 0.85
  },
  "artifacts": [
    "out/PowerToMint.sol/PowerToMint.json",
    "test-results.json"
  ]
}
```

**判定规则**：

| 条件 | Outcome |
|------|---------|
| `forge build` 成功 + `forge test` 全绿 + 覆盖率 ≥ 阈值 | ✅ PASS |
| `forge build` 失败 | ❌ COMPILE_ERROR → 触发 Inner Loop 自愈 |
| `forge test` 有 failure | ❌ TEST_FAILURE → 触发 Inner Loop 自愈 |
| 覆盖率 < 阈值 | ⚠️ LOW_COVERAGE → 触发补测试 |
| 自愈循环超过 N 次 | 🔴 STUCK → 上报 Master Agent / Gate |

### 6.2 P1 Lineage — 血缘治理

记录**每一个合约修改的设计依据**，由 nexrur L0 `AuditBus` 以 JSONL 持久化。

```json
// lineage.jsonl 示例（每行一条记录）
{
  "action": "ADD_DEPENDENCY",
  "contract": "PowerToMint",
  "change": "新增 IAGVOracle agvOracle 状态变量",
  "reason": "DESIGN.md P1-04: 三仓库缺乏链上集成",
  "evidence_refs": [
    "DESIGN.md#E.1",
    "AGVOracle.sol#getEffectiveMonthlySettlement",
    "PowerToMint.sol#processOutput"
  ],
  "decided_by": "Master Agent",
  "timestamp": "2026-03-03T10:30:00Z"
}

{
  "action": "ADD_REQUIRE",
  "contract": "PowerToMint.processOutput",
  "change": "require(newTotal <= settlement.gridDeliveredKWh_x10)",
  "reason": "月结算应为铸造上限。超发风险: IoT数据可无限触发铸造，无总量约束",
  "evidence_refs": [
    "AGVOracle.sol#storeMonthlySettlement注释: 'sole minting anchor'",
    "rGGP.sol#epochCap 仅控制季度上限，无月度粒度"
  ],
  "decided_by": "Master Agent",
  "cross_domain": true,
  "timestamp": "2026-03-03T10:35:00Z"
}
```

**关键价值**：当审计方问"为什么 PowerToMint 要依赖 AGVOracle？"——不需要人来回答，Lineage 直接给出完整因果链。

### 6.3 P2 RAG — 证据治理

三个仓库的结构化知识索引，由 nexrur L0 `EvidenceStore` + `VectorStore` 承载。  
> 双层证据（global RAG + asset-following）的实现细节 → 见 `Shared-Platform-Design.md` §14-15

**索引内容**：

| 数据源 | 索引方式 | 用途 |
|--------|---------|------|
| 14 个合约的 ABI + NatSpec | 按函数/事件索引 | SubAgent 理解合约接口 |
| 300 个测试用例的断言 | 按 revert reason 索引 | 自愈时快速定位失败原因 |
| DESIGN.md 风险清单 | 按 P0/P1/P2 + 合约名索引 | Master Agent 识别跟踪问题 |
| 历史 Sprint 的 Lineage | 按合约名 + 修改类型索引 | 避免重复决策、保持一致性 |
| 链上历史事件 | 按合约 + 事件类型索引 | 运维监控的基准数据 |
| OpenZeppelin 文档 | 按模式名索引 | SubAgent 编码时参考最佳实践 |
| Foundry 文档 | 按命令/cheatcode 索引 | SubAgent 写测试时参考 |

**检索示例**：

```
Master Agent 问: "PowerToMint 的 processOutput 会不会因为
                  AGVOracle 未部署而 revert？"

RAG 返回:
  1. PowerToMint.sol#L109: oracleVerification.submitData(...)
     → 如果 oracleVerification 是零地址，会 revert
  2. PowerToMint.constructor: require(_oracleVerification != address(0))
     → 构造时有校验
  3. DESIGN.md P1-06: DeployMainnet 全部地址为零
     → 部署脚本的地址需要填充
```

### 6.4 P3 Gate — 门控治理

由 nexrur L0 `PlatformPolicy` + L1 `StepRisk` 注解驱动的三级 Gate 体系。  
> Gate 阈值配置 → 见 `Shared-Platform-Design.md` §12-13 `policy.yml`；置信度阈值细化 → 见本文 §13

```
┌─────────────────────────────────────────────────────────────────┐
│                    P3 Gate 三级体系                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: 自动 Gate（Agent 内部，无需人类）                       │
│  ─────────────────────────────────                               │
│  · forge build 失败 → 阻塞，进入自愈                              │
│  · forge test 失败 → 阻塞，进入自愈                               │
│  · 覆盖率 < 80% → 阻塞，补测试                                   │
│  · 自愈循环 > 5 次 → 升级到 Level 2                               │
│                                                                 │
│  Level 2: Master Agent Gate（Master 决策，仍无需人类）            │
│  ─────────────────────────────────────────                       │
│  · SubAgent 自愈失败 → Master 重新评估设计                         │
│  · 跨域接口不一致 → Master 仲裁                                   │
│  · 测试网部署地址管理 → Master 统一分配                            │
│  · 问题超出 Master 能力 → 升级到 Level 3                          │
│                                                                 │
│  Level 3: 人类 Gate（不可逆操作，必须人类审批）                     │
│  ──────────────────────────────────────                          │
│  · 主网部署 (forge script --broadcast --rpc-url mainnet)         │
│  · UUPS 升级 (upgradeToAndCall)                                  │
│  · 月结算提交 (storeMonthlySettlement) — 控制铸币权                │
│  · 修改 ADMIN_ROLE / MINTER_ROLE 权限                            │
│  · rGGP.revokeMint (已铸造代币撤销)                               │
│  · BondingCurve 参数修改 (涉及代币经济)                           │
│  · 单次铸造量 > 阈值                                              │
│                                                                 │
│  熔断规则：                                                      │
│  ──────────                                                     │
│  · 单 Sprint 修改文件数 > 20 → 暂停，要求人类 review              │
│  · 单合约删除行数 > 新增行数 × 2 → 暂停（防止误删）               │
│  · gas 估算超过阈值 → 暂停                                       │
│  · 链上铸造量接近月结算上限 90% → 告警                             │
│  · 链上铸造量超过月结算上限 → 自动调用 pause() → 通知人类          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 自愈双循环：编译→测试→诊断→修复

### 7.1 Inner Loop：单合约自愈

```
SubAgent 编写/修改 .sol 文件
         │
         ▼
    forge build ──────────────────────────┐
         │                                │
    编译成功?                              │ 编译失败
         │                                │
         ▼                                ▼
    forge test                     读 error message
         │                                │
    测试全绿?                         LLM 诊断根因
         │                                │
    ┌────┴────┐                    ┌──────┴──────┐
    │         │                    │             │
   YES       NO                  类型判断        │
    │         │                    │             │
    ▼         ▼                    ▼             ▼
  PASS   读 revert reason     import 缺失    类型不匹配
          │                    → 加 import    → 修类型
          ▼                        │             │
     LLM 诊断                     └──────┬───────┘
          │                              │
     ┌────┴────┐                         ▼
     │         │                    重新 forge build
    逻辑错误  配置错误              (回到顶部, 最多 N 次)
     │         │
     ▼         ▼
  定向修改   修 foundry.toml
  被测函数   /remappings.txt
     │         │
     └────┬────┘
          │
          ▼
    重新 forge test
    (回到顶部, 最多 M 次)
```

**诊断驱动 vs 盲目重试的区别**：

| 场景 | 盲目重试 | AGV Agent 诊断驱动 |
|------|---------|-------------------|
| `revert "Exceeds cap"` | 随机改参数 | 读 epochCap[SOLAR] 的值 → 对比 outputAmount → 精确调整 setUp 中的 cap 或 mint 量 |
| `Error: function not found` | 删了重写 | 检查 interface 声明 vs 实现 → 发现是参数类型不匹配 → 只改签名 |
| `EvmError: OutOfGas` | 加 gas limit | 分析循环次数 → 发现 `batchProcessOutputs` 的 `this.processOutput()` 是外部调用 → 改为内部调用 |

### 7.2 Outer Loop：跨仓库自愈

```
Master Agent 发现跨域集成问题
         │
         ▼
    指挥 SubAgent-A 暴露接口
    指挥 SubAgent-B 消费接口
         │
         ▼
    集成测试 (mock SubAgent-A 的合约)
         │
    测试失败?
         │
    ┌────┴────┐
    │         │
   YES       NO → PASS
    │
    ▼
  Master Agent 诊断
    │
    ├── 接口签名不匹配 → 指挥 SubAgent-A 修改
    ├── 数据精度不一致 (x10 vs x18) → 指挥 SubAgent-B 加转换
    ├── 缺少跨合约授权 (role) → 指挥双方添加
    └── 设计方案本身有缺陷 → Master 重新 DESIGN → 回到 Step 2
```

### 7.3 不可自愈边界：链上操作

**关键认知**：WQ-YI 的所有操作在链下 Python 环境，可以无限重试。AGV Agent 的链上操作**不可逆**。

| 操作域 | 可自愈? | 原因 |
|--------|--------|------|
| `forge build` | ✅ 无限自愈 | 本地编译，零成本 |
| `forge test` | ✅ 无限自愈 | 本地 EVM 模拟，零成本 |
| `forge script` (测试网) | ✅ 可重试 | 测试网水龙头，可弃旧重部署 |
| `forge script` (主网) | 🔴 不可逆 | 真钱 gas + 合约地址永久 |
| `cast send` (主网) | 🔴 不可逆 | 交易上链即定 |
| UUPS `upgradeToAndCall` | 🔴 不可逆 | 升级错误可能砖合约 |

**因此**：Gate 在链上操作前必须拦截。自愈仅限于链下开发循环。

---

## 8. ToolLoop 状态机：确定性执行管线

**WQ-YI 的 ToolLoop** 用确定性状态机替代了 LLM 逐轮路由，消除了"LLM 决定下一步调什么工具"的不确定性和开销。

**AGV 的 ToolLoop** 同理——`forge build → forge test → 诊断 → 修复` 是一个确定性循环，不需要 LLM 每轮决定"下一步该干什么"：

```
┌─────────────────────────────────────────────────────────────────┐
│                   ToolLoop State Machine                         │
│                                                                 │
│  States:                                                        │
│    IDLE → EDITING → COMPILING → TESTING → DIAGNOSING → FIXING  │
│     ↑                                                    │      │
│     └────────────────────────────────────────────────────┘      │
│                                                                 │
│  Transitions:                                                   │
│                                                                 │
│  IDLE ──(收到任务)──→ EDITING                                    │
│    Agent 编写/修改 .sol 文件                                     │
│                                                                 │
│  EDITING ──(完成编辑)──→ COMPILING                               │
│    执行 forge build                                              │
│                                                                 │
│  COMPILING ──(成功)──→ TESTING                                   │
│  COMPILING ──(失败)──→ DIAGNOSING                                │
│    执行 forge test                                               │
│                                                                 │
│  TESTING ──(全绿)──→ IDLE (输出 PASS outcome)                    │
│  TESTING ──(有失败)──→ DIAGNOSING                                │
│                                                                 │
│  DIAGNOSING ──(诊断完成)──→ FIXING                               │
│    LLM 分析 error/revert reason，生成修复方案                     │
│                                                                 │
│  FIXING ──(修复完成)──→ COMPILING (重新开始)                      │
│  FIXING ──(超过重试上限)──→ IDLE (输出 STUCK outcome, 升级 Gate)  │
│                                                                 │
│  置信度门控:                                                     │
│    · 诊断结果的置信度 < 0.5 → 不自动修复，升级到 Master/人类      │
│    · 修复影响范围 > 3 个文件 → 需要 Master 确认                   │
│    · 修复涉及 access control → 需要人类 Gate                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 跨域知识索引（Evidence → RAG）

```
┌──────────────────────────────────────────────────────────────┐
│                    知识索引架构                                │
│                                                              │
│  数据源层                                                     │
│  ─────────                                                   │
│  agvprotocol/     onchainverification/     tokencontracts/   │
│  ├ 4 sol          ├ 2 sol                  ├ 8 sol           │
│  ├ 4 test         ├ 1 test                 ├ 7 test          │
│  └ 4 script       └ 1 script               └ 6 script       │
│                                                              │
│  + DESIGN.md (938 行风险清单/架构分析)                         │
│  + NFT-AgentRegistry-Architecture.md (713 行)                │
│  + PreGVT-sGVT-Architecture.md                               │
│  + RUN.md                                                    │
│                                                              │
│  索引层 (FAISS / Chroma)                                     │
│  ──────────────────────                                      │
│  向量索引:                                                    │
│    - 合约函数 (函数名 + NatSpec + 参数 + 返回值)               │
│    - 事件定义 (事件名 + 参数)                                  │
│    - 角色/权限 (role name + 关联函数)                          │
│    - 风险项 (P0/P1/P2 + 描述 + 影响合约)                      │
│    - 测试断言 (测试名 + assert/require + revert reason)       │
│                                                              │
│  结构化索引:                                                  │
│    - ABI 映射: function_selector → contract → repo            │
│    - 依赖图: contract → imports → inherited                   │
│    - 角色矩阵: role → contract → allowed_functions            │
│                                                              │
│  检索层                                                       │
│  ─────────                                                   │
│  Master Agent: "PowerToMint 调用 AGVOracle 需要什么角色?"      │
│  → RAG 返回:                                                 │
│    1. AGVOracle.getEffectiveMonthlySettlement → public view   │
│       (无需角色，任何地址可读)                                  │
│    2. AGVOracle.storeMonthlySettlement → SETTLEMENT_MULTISIG  │
│       (写操作需要多签角色)                                     │
│    3. PowerToMint 当前持有 MINTER_ROLE (在 rGGP 上)           │
│       (不需要额外角色即可读 Oracle)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. 示例场景：电表控制铸币的完整 Agent 流程

以"onchainverification-main 的月结算发电量控制 tokencontracts-main 的 rGGP 铸造上限"为例，展示完整的 Agent 执行流程：

### Step 1: DETECT

```
触发源：Master Agent 读取 DESIGN.md
发现：
  - P1-04: "三个项目之间缺乏链上集成"
  - E.1: "AGVOracle 自称 'sole minting anchor'，
          但 PowerToMint 的铸造链路完全绕过它"

Impact Report:
  trigger: "P1-04 + E.1: Oracle月结算未约束Token铸造"
  affected: [AGVOracle, PowerToMint, rGGP]
  severity: P0 (超发风险)
```

### Step 2: DESIGN

```
Master Agent 设计:
  方案: "两级验证——月结算总量控制 + 单笔签名验证"

  AGVOracle (宏观真值):
    getEffectiveMonthlySettlement() → gridDeliveredKWh_x10
    = 该站点该月的铸造天花板

  PowerToMint (微观执行):
    新增: IAGVOracle agvOracle
    新增: mapping(string => mapping(string => uint256)) periodMintedKWh
    processOutput() 新增:
      require(periodMintedKWh + outputAmount <= settlement.gridDeliveredKWh_x10)

  OracleVerification (不变):
    继续做单笔 IoT 数据签名验证

Lineage 记录:
  reason: "国网电费单 = 不可篡改权威来源 → 作为铸造上限"
  refs: [DESIGN.md#E.1, AGVOracle.sol#L56注释]
```

### Step 3: ASSIGN

```
SubAgent-Oracle 任务:
  1. 确认 getEffectiveMonthlySettlement() 已是 external view ✅
  2. 导出 IAGVOracle.sol 接口文件到共享位置
  3. 修复 P0-04: IAGVOracle 接口与实现对齐

SubAgent-Token 任务:
  1. PowerToMint 新增 IAGVOracle 状态变量 + constructor 参数
  2. processOutput() 新增 period 参数 + 月结算上限校验
  3. 新增 periodMintedKWh 存储 + getPeriodMinted() 视图
  4. 新增 stationId 到 NFTAsset 结构
  5. 编写集成测试:
     a. Happy path: 铸造量 ≤ 月结算 → 成功
     b. 边界: 铸造量 = 月结算 → 成功
     c. 超额: 铸造量 > 月结算 → revert "Exceeds monthly settlement cap"
     d. 无结算: period 未提交月结算 → revert "No settlement found"
     e. 修正后: amend 降低了月结算 → 已铸造 + 新铸造 > 新上限 → revert
```

### Step 4: BUILD — SubAgent-Oracle

```
ToolLoop:
  EDITING → 修改 IAGVOracle.sol 对齐实现
  COMPILING → forge build → ✅ 成功
  TESTING → forge test → ✅ 全绿
  Outcome: PASS
```

### Step 4: BUILD — SubAgent-Token (并行)

```
ToolLoop 第1轮:
  EDITING → 修改 PowerToMint.sol
  COMPILING → forge build → ❌ 失败
    Error: "IAGVOracle" not found
  DIAGNOSING → import 路径错误（跨仓库文件）
  FIXING → 创建 interfaces/IAGVOracle.sol（从 SubAgent-Oracle 的输出复制）

ToolLoop 第2轮:
  COMPILING → forge build → ❌ 失败
    Error: struct MonthlySettlementData not visible
  DIAGNOSING → 接口中 struct 定义需要单独导出
  FIXING → 在 IAGVOracle.sol 中定义 struct

ToolLoop 第3轮:
  COMPILING → forge build → ✅ 成功
  TESTING → forge test → ❌ 失败
    [FAIL] test_processOutput_exceedsSettlement()
    revert: No settlement found
  DIAGNOSING → 测试 setUp 中忘记 mock AGVOracle 的月结算数据
  FIXING → setUp 中添加 vm.mockCall 或部署真实 AGVOracle + 提交月结算

ToolLoop 第4轮:
  TESTING → forge test → ✅ 全绿 (5/5 新测试通过)
  Outcome: PASS
```

### Step 5: TEST (集成测试)

```
Master Agent 编排:
  在 test/ 中创建 Integration_OracleToMint.t.sol
  部署顺序: AGVOracle → rGGP → OracleVerification → PowerToMint
  测试流程:
    1. Oracle SETTLEMENT_MULTISIG 提交月结算: 1000 kWh
    2. PowerToMint 铸造 500 kWh → ✅ 成功
    3. PowerToMint 铸造 501 kWh → ❌ revert "Exceeds monthly settlement cap"
    4. Oracle amend 月结算: 1200 kWh
    5. PowerToMint 铸造 200 kWh → ✅ 成功 (总计700 < 1200)
```

### Step 6: REVIEW

```
交叉审查:
  SubAgent-Oracle 确认: Token 对 getEffectiveMonthlySettlement 的调用方式正确
  SubAgent-Token 确认: 不会意外修改 Oracle 状态（纯 view 调用）

Gate 判断:
  · 修改了 PowerToMint 的 processOutput 签名 → 检查是否有链上已部署版本
  · 当前: 未部署（全零地址, P1-06）→ 无兼容性风险 → ✅ 自动通过
  · 如果已部署: → 🔴 需要人类审批（涉及 UUPS 升级）
```

### Step 7-8: DEPLOY + MONITOR

```
测试网: SubAgent 自动部署 → 验证合约 → 冒烟测试
主网: 生成完整部署脚本 → 提交 Gate → 等人类审批

监控:
  Master Agent 持续检查:
    cast call PowerToMint.getPeriodMinted(stationId, period)
    vs
    cast call AGVOracle.getEffectiveMonthlySettlement(period, stationId)
    → 使用率 > 90% → 告警
    → 使用率 = 100% → 该站点本月无法继续铸造
```

---

## 11. 更多跨域场景清单

电表控制铸币只是一个例子。以下是 Master Agent 需要处理的全部跨域集成场景：

| # | 场景 | 源仓库 | 目标仓库 | 数据流 | 当前状态 |
|---|------|-------|---------|--------|---------|
| 1 | **月结算控制铸造上限** | Oracle | Token | `gridDeliveredKWh_x10` → `PowerToMint` 铸造天花板 | ❌ 缺失 |
| 2 | **NFT 持仓决定投票权** | NFT | Token | `balanceOf(voter)` → `DAOController.getVotingPower()` | ❌ 硬编码 |
| 3 | **GVT 质押量加权投票** | Token(GVT) | Token(DAO) | `GVT.balanceOf(voter)` → 投票权加权 | ❌ 硬编码 |
| 4 | **NFT tokenId 注册到 PowerToMint** | NFT | Token | `ComputePass.tokenId` → `PowerToMint.registerNFTAsset()` | ⚠️ 手动 |
| 5 | **月结算修正触发铸造审查** | Oracle | Token | `amendMonthlySettlement()` → 检查已铸造是否超新上限 | ❌ 缺失 |
| 6 | **Oracle 收益率影响 BondingCurve** | Oracle | Token | 月度实际收益率 → BondingCurve 转换率动态调整 | ❌ 缺失 |
| 7 | **资产产出约束 Vesting 释放** | Oracle | Token | 无产出 → VestingVault 暂停释放 | ❌ 缺失 |
| 8 | **Oracle SLA 违约触发全局暂停** | Oracle | NFT+Token | `checkStaleSources()` → 全协议 `pause()` | ❌ 缺失 |
| 9 | **NFT 转让同步 PowerToMint 所有者** | NFT | Token | `Transfer` 事件 → `updateAssetOwner()` | ❌ 缺失 |
| 10 | **跨仓库部署地址管理** | 全部 | 全部 | 先部署 A → 拿地址 → 传给 B 的构造函数 | ⚠️ 手动 |

> **📌 RWA 行业价值分析与四大杀手级应用**（v0.1 原 §12-13）已整合至 `DESIGN.md` v2.0 Σ.4-Σ.6，不再重复。

---

## 12. 机构验真指标（KPI）

机构端最终看的不是"架构宣言"，而是可量化的产出、自治度与风控表现：

### 12.1 产出类

| 指标 | 定义 | 目标 |
|------|------|------|
| 月结确权包出具周期 | 从月末到 Proof Pack 完成的天数 (T+X) | T+3 内 |
| 证据链完整率 | 1 - (缺失项数 / 应有项数) | ≥ 99% |
| 证据链补齐平均时间 | 从发现缺失到补齐的小时数 | < 4h |
| 合约代码—合同条款一致性 | 每个 require 可追溯到合同条款的覆盖率 | ≥ 95% |

### 12.2 自治类

| 指标 | 定义 | 目标 |
|------|------|------|
| 无人干预率 | 结算周期自动完成比例（无需 Level 3 Gate） | ≥ 80% |
| 自愈成功率 | 异常触发后 Agent 自行解决（无需人工）的比例 | ≥ 70% |
| 门控命中率 | 正确阻断不合规操作 / 全部不合规操作 | ≥ 99% |
| 误报率 | 错误阻断合规操作 / 全部 Gate 触发 | < 5% |
| 编译→测试通过平均轮次 | ToolLoop 从 EDITING 到 PASS 的平均迭代次数 | < 3 轮 |

### 12.3 成本/风控类

| 指标 | 定义 | 目标 |
|------|------|------|
| 单项目尽调成本下降 | 对比人工律师/审计工时 | ≥ 60% 降幅 |
| 风险事件 MTTR | 发现→处置完成的平均时间 | < 1h |
| 熔断误报率 | 不应暂停时暂停 / 全部暂停 | < 3% |
| 熔断漏报率 | 应暂停时未暂停 / 全部应暂停 | 0%（硬性要求） |

### 12.4 合规有效性指标

| 指标 | 定义 | 目标 |
|------|------|------|
| 报告驳回率 | Agent 出具的报告被监管/审计方驳回次数 / 总出具次数 | < 2% |
| 法律效力边界声明 | Agent 输出是否明确标注"参考材料"vs"正式文件" | 100% 标注 |

---

## 13. 安全边界与人类 Gate

> 链上不可逆性的 StepRisk 注解系统 → 见 `Shared-Platform-Design.md` §12  
> policy.yml Gate 阈值配置 → 见 `Shared-Platform-Design.md` §13

### 13.1 链上不可逆性 — 与 WQ-YI 的根本差异

| 维度 | WQ-YI（量化场景） | AGV Agent（链上场景） | 差距倍率 |
|------|------------------|---------------------|---------|
| 失败代价 | Alpha 不通过 → 浪费配额 | 合规失败 → 法律责任 + 投资者损失 | 10-100× |
| 操作可逆性 | Alpha 提交可重试 | 链上铸造/分配不可逆 | ∞ |
| 监管环境 | 无监管（量化平台自有规则） | 强监管（证监会、银保监、能源局） | 质的飞跃 |
| 数据标准化 | WorldQuant API 高度结构化 | 合同/发票/运维记录格式混乱 | 数据治理工作量巨大 |
| 责任主体 | 个人交易员 | 持牌机构 | 法律责任完全不同 |

### 13.2 Gate 严格度上调

链下量化场景的 Gate 在 80% 置信度即可放行（`Shared-Platform-Design.md` §12 StepRisk）。AGV Agent 的链上操作 Gate 大幅上调：

| 操作类型 | 要求置信度 | Gate 级别 |
|---------|-----------|---------|
| 本地编译/测试 | N/A | Level 1 自动 |
| 测试网部署 | 70%+ | Level 2 Master |
| 主网合约部署 | 99%+ | Level 3 人类 |
| UUPS 升级 | 99.9%+ | Level 3 人类 + 多签 |
| 月结算提交 | 99%+ | Level 3 人类 + 多签 |
| 大额铸造 (> Epoch Cap 10%) | 95%+ | Level 3 人类 |

### 13.3 绝对不可自治的操作

以下操作**永远不能**由 Agent 自主执行，无论置信度多高：

1. **主网 UUPS 升级** — 升级错误可能永久砖掉合约
2. **DEFAULT_ADMIN_ROLE 转移** — 等同于交出合约所有权
3. **rGGP.revokeMint 大规模撤销** — 直接影响用户资产
4. **BondingCurve 参数大幅修改** — 影响代币经济模型
5. **紧急全局 pause/unpause** — 影响整个协议运作

---

## 14. 实施路线图

### Phase 0：最小闭环验证（1-2 个月）

| 里程碑 | 内容 | 验收标准 |
|--------|------|---------|
| M0.1 | 单 SubAgent ToolLoop | SubAgent-Token 能自动 `forge build → test → 诊断 → 修 → 重跑` 并修复一个 P0 缺陷 |
| M0.2 | RAG 索引 | 三仓库 14 合约的 ABI/NatSpec/测试 全量索引 → SubAgent 能回答"PowerToMint 需要什么角色" |
| M0.3 | 单域 Outcome/Lineage | 一次 ToolLoop 运行产生完整的 outcome.json + lineage.jsonl |

### Phase 1：跨域集成（2-3 个月）

| 里程碑 | 内容 | 验收标准 |
|--------|------|---------|
| M1.1 | Master Agent 编排 | Master Agent 能识别 P1-04 → 设计接口 → 分配给两个 SubAgent → 产出集成代码 |
| M1.2 | 电表控制铸币 | 完整跑通第 10 节的示例场景（从 DETECT 到 TEST 全通过） |
| M1.3 | Gate 体系 | Level 1/2 自动 Gate 工作；Level 3 能正确拦截主网部署请求 |

### Phase 2：链上运维自治（3-6 个月）

| 里程碑 | 内容 | 验收标准 |
|--------|------|---------|
| M2.1 | 测试网全流程 | Agent 自动部署三仓库到测试网 → 集成冒烟测试通过 → 无人干预 |
| M2.2 | 链上监控 | MONITOR 步骤持续运行 → 检测到 Oracle stale → 自动 pause 铸造 → 通知人类 |
| M2.3 | 自动尽调 PoC | 给一个示范项目的材料 → Agent 出具 Proof Pack → 人工评审通过率 > 80% |

### Phase 3：产品化（6-12 个月）

| 里程碑 | 内容 | 验收标准 |
|--------|------|---------|
| M3.1 | 主网辅助部署 | Agent 生成部署脚本 → 人类审批 → Agent 执行 → 验证 |
| M3.2 | 合规披露自动化 | 月报自动生成 → 人工审批 → 提交 |
| M3.3 | 多项目支持 | Agent 同时管理 2+ 个 RWA 项目（不同资产类型） |

---

## 附录 A：AGV 合约与 Agent 工具映射

| 合约 | 关键函数 | Agent 操作 | 工具 |
|------|---------|-----------|------|
| ComputePass | `publicMint()` / `agentMint()` | 读取铸造状态/模拟铸造 | `cast call` / `forge test` |
| SolarPass | `publicMint()` / `agentMint()` | 同上 | 同上 |
| TreePass | `publicMint()` / `whitelistMint()` | 同上 | 同上 |
| SeedPass | `publicMint()` / `whitelistMint()` | 同上 | 同上 |
| AGVOracle | `storeDailySnapshot()` | 构造 EIP-712 签名 → 提交 | `cast send` + EIP-712 |
| AGVOracle | `storeMonthlySettlement()` | 月结算数据提交（需 Gate） | `cast send` (gated) |
| AGVOracle | `getEffectiveMonthlySettlement()` | 读取月结算数据 | `cast call` |
| rGGP | `mintFromOutput()` | 监控铸造事件 | `cast logs` |
| rGGP | `revokeMint()` | 撤销欺诈铸造（需 Gate） | `cast send` (gated) |
| PowerToMint | `processOutput()` | 监控铸造量 vs 月结算上限 | `cast call` |
| PowerToMint | `registerNFTAsset()` | NFT→资产注册 | `cast send` |
| BondingCurve | `convert()` | 监控转换量/曲线参数 | `cast call` |
| GVT | `releaseVested()` | 监控 Vesting 释放 | `cast call` |
| DAOController | `createProposal()` / `vote()` | 治理提案管理（需 Gate） | `cast send` (gated) |

---

## 附录 B：三包概念速查（精简版）

> **完整的逐模块代码设计** → 见 `Shared-Platform-Design.md` §3-20  
> **完整的 nexrur→AGV 映射全景** → 见 `DESIGN.md` v2.0 Σ.8

| nexrur 核心概念 | AGV Agent 中的角色 | 本文对应章节 |
|---|---|---|
| **L0 RunContext** | SprintContext: sprint_id, repo_scope, gate_level | §4.2 |
| **L0 StepOutcome** | 编译/测试/部署结果 (outcome.json) | §6.1 |
| **L0 AuditBus** | forge 命令日志 + 链上交易记录 (audit.jsonl) | §6.2 |
| **L0 EvidenceStore** | 合约 ABI/NatSpec + DESIGN.md 风险项 + Sprint Lineage | §6.3, §9 |
| **L0 PlatformPolicy** | Gate 阈值 + 自愈策略 + 熔断规则 | §6.4, §13 |
| **L1 Orchestrator** | 8-step Pipeline (DETECT→MONITOR) | §4.2 |
| **L1 ToolLoopRunner** | forge build→test→diagnose→fix 确定性循环 | §7, §8 |
| **L1 DiagnosisEngine** | COMPILE_ERROR / TEST_REVERT 等 13 码 → 定向回退 | §7.1 |
| **L1 CampaignRunner** | Sprint 级编排（每日目标、最大失败周期） | §10-11 |
| **L2 PipelineDescriptor** | AGV 8-step 定义 (contract_pipeline.py) | §4.2 |
| **L2 LifecycleGraph** | DRAFT→COMPILING→TESTED→DEPLOYED→MONITORED | §5 |
| **L2 ForgeExecutor** | forge build/test/script → ToolExecutor 协议实现 | §8 |
| **L3 Skills** | detect-change / write-solidity / forge-test / deploy-script / monitor-chain | §5 |

---

## 附录 C：四主体业务结构与 Agent 嵌入点

### C.1 四主体结构

```
中瓦（发电资产）
  │
  ├── 可计量可审计的发电数据
  │   → AGV Agent SubAgent-Oracle 自动提交日快照/月结算
  │
  ▼
德衡（算力负荷 + 现金流锚）
  │
  ├── 容量费 / 最低负荷 / 最低保底付款
  │   → AGV Agent MONITOR 持续核验回款 vs 保底
  │   → Gate 熔断：连续 N 期未达保底 → 冻结
  │
  ▼
安集卫（境内备案主体）  ← ★ AGV Agent 合规治理中台嵌入点
  │
  ├── 真实性责任 + 资产并入标准
  │   → Due Diligence Agent 出具可回放尽调报告
  │   → Auto Reporting Agent 生成月报/披露
  │   → 全链路 Lineage 满足监管穿透要求
  │
  ▼
JLL（境外发行）
  │
  └── 面向合格投资者产品化发行
      → Contract-to-Code Compiler 生成发行合约
      → Risk Oracle Agent 持续风控与熔断
```

### C.2 合规边界（Agent 必须遵守）

| 红线 | AGV Agent 策略 |
|------|---------------|
| 境内不发币 | Gate 规则：任何主网铸造操作 → 检查目标链 → 境内链禁止 |
| 不公众募资 | Gate 规则：NFT 铸造白名单 → 仅合格投资者地址 |
| 不做二级交易营销 | Agent 不生成任何营销材料 |
| 前置备案 | Gate 规则：主网部署前 → 检查 `备案状态` 标志 |
| 材料真实性责任 | RAG + Lineage 保证每条数据可追溯到原始材料 |

### C.3 示范模板

**月结确权包（Proof Pack）模板**：

```
proof_pack/
  └── 2026-02/
      ├── metering/           ← 计量点原始数据
      │   └── station_001/
      │       ├── daily_snapshots/   (30个CSV + SHA-256)
      │       └── iot_raw/           (原始15min采样)
      ├── settlement/         ← 结算单
      │   ├── state_grid_bill.pdf    (国网电费单)
      │   └── bank_receipt.pdf       (银行回单)
      ├── operations/         ← 运维台账
      │   ├── maintenance_log.csv
      │   └── sla_compliance.json
      ├── reconciliation/     ← 对账
      │   ├── daily_vs_monthly.json  (日快照累计 vs 月结算差异)
      │   └── mint_vs_settlement.json (已铸造 vs 月结算上限)
      ├── anomalies/          ← 异常说明
      │   └── 2026-02-15_low_output.md (附原因+证据)
      ├── hashes/             ← 哈希存证
      │   ├── all_file_hashes.json
      │   └── onchain_tx_hash.txt    (AGVOracle storeMonthlySettlement txhash)
      └── evidence_index.json ← 证据索引（文件→AGV RAG 索引ID映射）
```

---

## 附录 D：多电站电表模拟器设计

> **目的**：在开发环境（Anvil 本地 EVM）中模拟多个电站的电表数据运行，验证合约逻辑在多站并发场景下的正确性。  
> **前提**：AGVOracle 合约已原生支持多电站——`dailySnapshots[stationId][date]`、`monthlySettlements[stationId][period][revision]` 均以 `stationId` 为一级索引。

### D.1 合约层现状

| 合约 | 多电站支持 | 当前缺口 |
|---|---|---|
| AGVOracle | ✅ `stationId` (string) 无数量限制 | 无 |
| PowerToMint | ✅ 每个 NFT tokenId 绑定一个 `sourceId` + `AssetType` | `processOutput()` 未读 Oracle 月结算做铸造上限校验（§10 待补） |
| rGGP | ✅ `epochCap` 按季度控制，不限电站数 | 无月度粒度约束 |

### D.2 数据模型

```
电站参数:
  station_id:        "STATION-{id}"
  capacity_kw:       装机容量 (e.g. 500kW)
  latitude:          纬度 → 决定日照小时数
  panel_degradation: 0.98 (每年衰减系数)
  noise_factor:      0.05 (天气随机波动 σ)

每 15 分钟输出:
  solar_kw = capacity_kw × irradiance(time, latitude) × degradation × (1 + ε)
  kwh_interval = solar_kw × 0.25    (15min = 0.25h)

日汇总 (对应 DailySnapshotData):
  solarKWhSum_x10    = sum(96 intervals) × 10
  selfConsumedKWh_x10 = solarKWhSum_x10 × self_consume_ratio
  computeHoursSum_x10 = 240    (固定 24.0h)
  records            = 96
  sheetSha256        = SHA256(canonical CSV of 96 rows)

月汇总 (对应 MonthlySettlementData):
  gridDeliveredKWh_x10 = sum(30 days solarKWhSum_x10) - sum(selfConsumedKWh_x10)
  tariff_bp            = 4500   (0.45 元/kWh × 10000)
  monthFilesAggSha256  = SHA256(concat(30 daily sheetSha256))
  settlementPdfSha256  = SHA256(mock State Grid bill)
```

日照模型（简化正弦）：

$$P(t) = P_{max} \cdot \max\!\Big(0,\; \sin\!\Big(\pi \cdot \frac{t - t_{rise}}{t_{set} - t_{rise}}\Big)\Big) \cdot (1 + \epsilon), \quad \epsilon \sim \mathcal{N}(0, \sigma^2)$$

其中 $t_{rise}$、$t_{set}$ 由纬度和日期决定。精度不需很高——目的是产生合理范围数据并触发边界条件。

### D.3 模拟场景矩阵

| # | 场景 | 参数 | 验证目标 |
|---|---|---|---|
| 1 | **正常运行** | N 站 × 30 天 | 日快照批量提交 + 月结算 + 铸造上限 |
| 2 | **部分停机** | 某站第 15-18 天输出=0 | Oracle stale 检测 → 暂停铸造 |
| 3 | **发电骤降** | 装机 500kW 但连续 3 天 < 50kW | 异常告警 → Gate 熔断 |
| 4 | **月结算修正** | amend 后 gridDeliveredKWh 降低 | 已铸造 > 新上限 → revert |
| 5 | **多资产类型** | SOLAR + COMPUTE 混合 | 不同 ratePerUnit 的铸造计算 |
| 6 | **跨月边界** | 月末 23:45 到次月 00:15 | period 切换正确性 |
| 7 | **批量铸造** | 50 笔 batchProcessOutputs | gas 消耗 + 重入防护 |
| 8 | **并发提交** | 两站同一区块提交月结算 | 无竞态/无干扰 |

### D.4 双轨实现

**A. Foundry 测试（确定性验证）**

放在 `onchainverification-main/test/MultiStation.t.sol`：

```solidity
// 伪代码
function test_MultiStation_30Days() public {
    string[3] memory stations = ["STATION-001", "STATION-002", "STATION-003"];
    uint256[3] memory capacities = [uint256(500), 200, 1000]; // kW

    for (uint d = 0; d < 30; d++) {
        string memory date = _formatDate(2026, 3, d + 1);
        for (uint s = 0; s < stations.length; s++) {
            uint256 kwh_x10 = _simulateDay(capacities[s], d);
            DailySnapshotEIP712 memory snap = _buildSnapshot(
                stations[s], date, kwh_x10
            );
            bytes memory sig = _sign(techTeam1PK, snap);
            vm.prank(techTeam1);
            oracle.storeDailySnapshot(snap, sig);
        }
        vm.warp(block.timestamp + 1 days);
    }
    // 月结算 + 铸造 + 断言
    for (uint s = 0; s < stations.length; s++) {
        vm.prank(settlementMultisig1);
        oracle.storeMonthlySettlement("2026-03", stations[s], ...);
    }
}
```

**优点**：确定性、零外部依赖、CI 可跑  
**范围**：合约逻辑正确性、gas 消耗、revert 条件

**B. Python 模拟器 + Anvil（端到端验证）**

```python
# agv/tools/meter_simulator.py  (~200-400 行)
class Station:
    def __init__(self, station_id: str, capacity_kw: float, lat: float):
        self.id = station_id
        self.capacity_kw = capacity_kw
        self.lat = lat

    def generate_day(self, date: date) -> list[float]:
        """返回 96 个 15 分钟区间的 kWh"""
        hours = pd.date_range(date, periods=96, freq='15min')
        irradiance = solar_model(hours, self.lat)
        noise = np.random.normal(1.0, 0.05, 96)
        return (self.capacity_kw * irradiance * noise * 0.25).clip(min=0)

class MeterSimulator:
    def __init__(self, stations: list[Station], anvil_rpc: str):
        self.stations = stations
        self.w3 = Web3(Web3.HTTPProvider(anvil_rpc))

    def run_month(self, year: int, month: int):
        for day in month_days(year, month):
            for station in self.stations:
                data = station.generate_day(day)
                csv_path = self.write_csv(station.id, day, data)
                self.submit_daily_snapshot(station.id, day, data, csv_path)
        for station in self.stations:
            self.submit_monthly_settlement(station.id, year, month)
```

**优点**：Python 写统计模型自然；可复用 WQ-YI 数据分析能力  
**范围**：端到端集成（数据生成→签名→提交→铸造→验证）

### D.5 规模与 gas 估算

| N 电站 | 日快照/月 | 月结算/月 | Anvil 预估耗时 | 备注 |
|---|---|---|---|---|
| 3 | 90 tx | 3 tx | < 5s | Phase 0 最小验证 |
| 10 | 300 tx | 10 tx | < 15s | Phase 1 常规规模 |
| 100 | 3,000 tx | 100 tx | < 2min | 压力测试 |
| 1,000 | 30,000 tx | 1,000 tx | ~10min | 需优化 stationId 为 bytes32 |

> **注意**：当前 `stationId` 使用 `string` 类型，每次 mapping 查询需 `keccak256(bytes(stationId))`。100+ 站的 gas 开销可观。如需规模化，应将 `stationId` 改为 `bytes32`（breaking change，Phase 2+ 评估）。

### D.6 三包归属

| 组件 | 包 | 层级 | 说明 |
|---|---|---|---|
| 日照模型 / 数据生成引擎 | **nexrur** | L1 Engines | 通用模拟引擎，未来可换成风电/储能模型 |
| EIP-712 签名构造 + Anvil 交互 | **AGV** | L2 Adapters | `agv/tools/meter_simulator.py` |
| Foundry 集成测试 | **AGV** | L3 Skills | `MultiStation.t.sol` |
| 模拟数据 CSV / 月结算 JSON | **AGV** | data/ | 同时作为 RAG 证据链测试素材 |

### D.7 与路线图对齐

| Phase | 相关里程碑 | 模拟器交付 |
|---|---|---|
| **Phase 0** M0.2 (RAG 索引) | 三仓库 14 合约全量索引 | 模拟数据 = RAG 证据链的测试素材 |
| **Phase 0** M0.3 (Outcome/Lineage) | 一次 ToolLoop 产生完整 outcome + lineage | 模拟器运行 = 端到端 outcome 验证 |
| **Phase 1** M1.2 (电表控制铸币) | §10 完整场景跑通 | 3 站 × 1 月模拟数据 = M1.2 验收数据集 |
| **Phase 2** M2.1 (测试网全流程) | 三仓库→测试网自动部署 | 模拟器接入测试网 RPC 即可复用 |

---

## 附录 E：开发环境与部件全景清单

截至 v1.2，AGV Protocol + nexrur 三包体系的资产盘点与缺口一览。

### E.1 文档层（设计蓝图）

| # | 文档 | 行数 | 职责 | 状态 |
|---|---|---|---|---|
| 1 | DESIGN.md v2.0 | 1,256 | 为什么做 — 战略定位(Σ) + 代码审计(A-I) | ✅ |
| 2 | AGV-Agent-Architecture.md v1.2 | ~1,500 | Agent 怎么干活 — SubAgent/自愈/ToolLoop/场景/KPI/Gate/路线图/模拟器/全景清单 | ✅ |
| 3 | Shared-Platform-Design.md v2.0 | 3,239 | 底座怎么拆 — 四层洋葱/模块代码设计/三包结构 | ✅ |
| 4 | NFT-AgentRegistry-Architecture.md | ~713 | NFT Pass + AgentRegistry 方案 | ✅ |
| 5 | PreGVT-sGVT-Architecture.md | — | PreGVT/sGVT 代币方案 | ✅ |
| 6 | VScode-Workspace-Guide.md | — | 本地三包 VS Code 工作区指南 | ✅ |
| 7 | VAcode-Codespace-Guide.md v1.1 | ~443 | Codespace SSH 开发指南（含 devcontainer 已实施） | ✅ |
| 8 | RUN.md | — | AGV 快速运行手册 | ✅ |

### E.2 代码层（已有资产）

| # | 组件 | 位置 | 内容 | 状态 |
|---|---|---|---|---|
| 1 | Solidity 合约 × 14 | `agvprotocol-contracts-main/` | 4 NFT Pass (ERC721A-Upgradeable) | ✅ 已审计 |
| | | `onchainverification-main/` | AGVOracle (日快照+月结算+EIP-712) | ✅ 已审计 |
| | | `tokencontracts-main/` | rGGP, GVT, BondingCurve, PowerToMint, DAO, Vesting, OracleVerification | ✅ 已审计 |
| 2 | Foundry 测试 × ~300 | 三仓库各自 `test/` | 单元测试 + 部分集成测试 | ✅ |
| 3 | 部署脚本 | 三仓库各自 `script/` | forge script（地址待填充 P1-06） | ⚠️ 全零地址 |
| 4 | nexrur 底座原型 | `quant/WQ-YI/_shared/` | 43 文件, ~12,000 行, 850+ 测试 | ✅ 运行中 |
| 5 | WQ-YI Agent | `WQ-YI/` | brain_alpha + cnhkmcp + skills + tools_ai | ✅ 运行中 |
| 6 | Foundry 子模块 × 4 | `agvprotocol-contracts-main/lib/` | forge-std, openzeppelin-contracts, openzeppelin-contracts-upgradeable, ERC721A-Upgradeable | ✅ |

### E.3 开发环境层

| # | 工具 | 状态 | 说明 |
|---|---|---|---|
| 1 | VS Code 本地 | ✅ | `D:\SouceFile\` 多根工作区 |
| 2 | Codespace SSH | ✅ | WQ-YI 为锚点，SSH 远程开发 |
| 3 | Foundry (forge/cast/anvil) | ✅ | 合约编译/测试/本地 EVM |
| 4 | Python 3.10 + venv | ✅ | WQ-YI Agent 运行环境 |
| 5 | Git 三仓库 | ✅ | AGV (HTTPS), WQ-YI (SSH), nexrur (待创建) |
| 6 | `.devcontainer` | ✅ | `devcontainer.json` + `setup.sh` 已实施（见 VAcode-Codespace-Guide.md v1.1 §4） |

### E.4 尚缺部件清单

| # | 缺失部件 | 优先级 | 预估 | 阻塞什么 |
|---|---|---|---|---|
| C1 | `dakoolfrank/nexrur` GitHub 仓库 | P0 | 0.5d | 三包分割动不了 |
| C2 | nexrur `pyproject.toml` + 从 `_shared/` 迁移 | P0 | 2-3d | AGV 包无法 `pip install nexrur` |
| C3 | AGV L2 适配器代码 | P1 | 3-5d | ToolLoop/诊断/Pipeline 无法运行 |
| | — `contract_pipeline.py` | | | 8-step PipelineDescriptor |
| | — `contract_lifecycle.py` | | | DRAFT→DEPLOYED→MONITORED |
| | — `contract_diagnosis.py` | | | 13 个 reason_code + 回退表 |
| | — `forge_executor.py` | | | ForgeExecutor → forge CLI 封装 |
| C4 | 多电站 Foundry 集成测试 `MultiStation.t.sol` | P1 | 1-2d | 附录 D 方案 A |
| C5 | Python 电表模拟器 `meter_simulator.py` | P1 | 1-2d | 附录 D 方案 B |
| C6 | PowerToMint ↔ AGVOracle 链上集成（§10 场景） | P0 | 2-3d | 铸造无月结算上限约束 |
| C7 | `.devcontainer` 实际 push + Rebuild | P2 | 0.5d | Codespace 三包自动配置 |
| C8 | CI/CD（GitHub Actions） | P2 | 1d | 自动测试/lint |
| C9 | `nexrur-workspace.code-workspace` 文件 | P2 | 0.1d | 已设计在 VScode-Workspace-Guide.md |

### E.5 结论：是否"基本全了"？

- **文档层**：全了。8 份文档覆盖"为什么→怎么做→怎么拆→怎么开发"。
- **合约层 + 测试层**：全了，但有 1 个关键缺口（C6: PowerToMint 不读 Oracle 月结算），这是最高优先级的代码工作。
- **底座层**：原型全了（`_shared/` 12,000 行），但 nexrur 仓库还没创建（C1-C2），AGV 适配器还没写（C3）。
- **模拟器**：设计全了（附录 D），代码待建（C4-C5）。
- **开发环境**：本地可用；Codespace `.devcontainer` 已修改待 push（C7）；CI 还是纸面方案（C8）。

> **一句话：蓝图完备，代码还差一程。** 最小闭环需要先做 **C1 + C6**，然后 **C3 + C4** 就可以跑 Phase 0 M0.1（单 SubAgent ToolLoop 修复一个 P0 缺陷）。

---

## 结论

AGV Agent 不是"AI 写智能合约"——市场上有一堆工具在做单文件 Solidity 生成。

**AGV Agent 是一个理解整条 RWA 协议语义的自治系统**，能像人类架构师一样跨三个仓库做架构决策、编码测试、部署运维——而人类从"操作者"退到"Gate 审批者"。

它站在 nexrur 的 9,500 行共享底座之上（L0 Core + L1 Engines），通过 L2 适配器（contract_pipeline / forge_executor / contract_diagnosis）注入 Solidity 领域语义，用 L3 Skills 驱动三个 SubAgent 执行开发运维。

> **战略价值（降维打击、RWA 四大杀手应用）** → 见 `DESIGN.md` v2.0 Σ 章  
> **底座工程（四层洋葱、模块设计、三包结构）** → 见 `Shared-Platform-Design.md` v2.0 §4-20  
> **本文聚焦**：Agent 如何干活——SubAgent 领域知识、自愈双循环、ToolLoop 状态机、场景走通、KPI、Gate 细则、路线图。

---

*文档结束（v1.0）。实施前需与法律、合规、安全团队评审。*
