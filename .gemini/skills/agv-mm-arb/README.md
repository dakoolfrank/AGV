# agv-mm-arb

> **S5 MM-Arb Agent** — 做市与套利智能体（v1.5, 2026-03-22）

## 概述

双 Campaign 拓扑：
- **MM-Campaign**：护盘 + 反 MEV（心跳模式，确定性管线，零 LLM）
- **Arb-Campaign**：因子驱动套利（5 步管线：collect→curate→dataset→execute→fix）

### 架构关键

```
collect (⚡自建)  →  curate (→ CurateOps)  →  dataset (⏳stub)  →  execute (⚡自建)  →  fix (⚡自建)
    ↑                    ↑                       ↑
    │              nexrur CurateOps         等待 WQ-YI
    │              → KnowledgeBaseSkill     brain-dataset-explorer
    │                (domain="defi")
GeckoTerminal
+ Moralis
```

- **collect 步骤**：`CollectSkill` — GeckoTerminal + Moralis 双源融合 + 技术指标 + AMM 模式识别
- **curate 步骤**：✅ 已对接 WQ-YI `brain-curate-knowledge`（C1-C4 + DeFi 域适配），经 nexrur `CurateOps` 桥接层执行
- **dataset 步骤**：⏳ stub，等待对接 WQ-YI `brain-dataset-explorer`
- **execute 步骤**：DexExecutor + 三层安全护甲（滑点/MEV/TVL 熔断）
- **fix 步骤**：三级回退（A:参数调整 / B:因子切换 / C:策略重建）

## 目录结构

```
agv-mm-arb/
├── DESIGN.md                    ← 详细设计（唯一真相源, v1.5）
├── README.md                    ← 本文件
├── SKILL.md                     ← AI prompt 模板（SkillPromptStore）
│
├── scripts/                     ← 核心脚本
│   ├── skill_mm_arb.py           ← 主入口 + 配置中枢 + 双 Campaign 编排 + CLI
│   ├── toolloop_mm.py           ← 共享执行层 + MM 心跳
│   │                               (DexExecutor / PancakeV2Adapter / SlippageGuard
│   │                                MEVGuard / TVLBreaker / ApproveManager
│   │                                NotifyRouter / MMHeartbeatLoop)
│   └── toolloop_arb.py          ← Arb-Campaign 5 步管线
│                                    (curate → CurateOps 委托, dataset → stub)
│
├── modules/
│   └── collect/                 ← 数据源层（唯一保留的子模块）
│       ├── SKILL.md
│       ├── scripts/
│       │   ├── skill_collect.py          ← CollectSkill + GeckoTerminal + Moralis + DataFusion + SignalBus
│       │   ├── toolloop_mm_collect.py    ← CollectLoop（collect 循环调度 + 指标计算 + AMM 识别 + 跨池分析）
│       │   └── toolloop_arb_collect.py   ← Arb collect 管线
│       ├── knowledge/
│       │   └── collect_sources.yml       ← 数据源配置
│       └── tests/
│           ├── test_collect.py           ← collect 核心测试 (52)
│           └── test_arb_collect.py       ← arb collect 测试 (118)
│
├── knowledge/                   ← 知识文件（零 Python 依赖）
│   ├── mm_rules.yml             ← 护盘规则（价格偏移/鲸鱼/再平衡/心跳/日限）
│   ├── arb_factors.yml          ← 套利因子主文件（5 组因子 + 3 种策略）
│   ├── mev_patterns.yml         ← MEV 攻击模式库
│   └── safety_thresholds.yml    ← 安全阈值（3 层护甲 + 执行器 + 预授权）
│
└── test/                        ← 集成测试
    ├── test_arb_e2e.py          ← Arb 端到端 (75)
    ├── test_arb_pipeline.py     ← Arb 管线结构 (6)
    ├── test_pancake_adapter.py  ← PancakeV2 适配 (39)
    ├── test_notify.py           ← 通知系统 (24)
    ├── test_data_fusion.py      ← 双源融合 (11)
    ├── test_mm_rules.py         ← MM 规则 YAML 校验 (7)
    ├── test_tvl_breaker.py      ← TVL 熔断器 (6)
    └── test_slippage_guard.py   ← 滑点控制 (5)
```

> **已移除（v1.2）**：`modules/curate/`（计算合入 collect，curate 委托 CurateOps → KnowledgeBaseSkill(domain="defi")）、`modules/dataset/`（Python 逻辑迁移至 WQ-YI brain-dataset-explorer）

## 相关文档

- [DESIGN.md](DESIGN.md) — S5 详细设计（v1.5, 唯一真相源）
- [主 DESIGN.md](../DESIGN.md) — 全系统战略设计（v4.3）
- [AGENTS.md](../../../AGENTS.md) — 仓库级 Agent 指引（含 D1-D5 永久共识）

## 测试

```bash
# 全量测试（343 个）
cd .gemini/skills/agv-mm-arb
python -m pytest test/ modules/collect/tests/ -v

# 分模块
python -m pytest modules/collect/tests/  -v  # 170 tests (collect 52 + arb_collect 118)
python -m pytest test/                   -v  # 173 tests (e2e 75 + pancake 39 + notify 24 + fusion 11 + mm 7 + arb 6 + tvl 6 + slip 5)
```

## 依赖

- **web3.py** / eth-account（BSC 交互, D1 决策）
- GeckoTerminal API（DEX 交易数据 — OHLCV + trades + trending）
- Moralis API（链上原始数据 — transfers + LP events + holders）
- PancakeSwap V2 Router（链上执行）
- nexrur L0 Core + L1 Engines（底座治理 — P0 Outcome / P1 Lineage / CurateOps）
