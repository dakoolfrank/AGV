# agv-market-maker

> **S5 MarketMaker-Agent** — 做市与套利智能体

## 概述

双 Campaign 拓扑：
- **MM-Campaign**：护盘 + 反 MEV（心跳模式，确定性管线，零 LLM）
- **Arb-Campaign**：因子驱动套利（5 步管线：scan→curate→dataset→execute→fix）

## 目录结构

```
agv-market-maker/
├── SKILL.md                    ← AI prompt 模板（SkillPromptStore）
├── README.md                   ← 本文件
├── DESIGN.md                   ← 详细设计索引
├── knowledge/                  ← 纯知识文件（无运行时状态）
│   ├── mm_rules.yml            ← MM-Campaign 确定性规则
│   ├── arb_factors.yml         ← Arb-Campaign 因子池定义
│   ├── mev_patterns.yml        ← MEV 攻击模式库
│   └── safety_thresholds.yml   ← 三层安全护甲阈值
├── scripts/                    ← 主程序 + Tool Loops
│   ├── skill_market_maker.py   ← 主程序入口
│   ├── toolloop_mm.py          ← MM-Campaign Tool Loop + 共享执行层
│   │                              (DexExecutor / PancakeV2 / SlippageGuard
│   │                               MEVGuard / TVLBreaker / ApproveManager
│   │                               NotifyRouter / MMHeartbeatLoop)
│   └── toolloop_arb.py         ← Arb-Campaign Tool Loop（5 步管线）
├── modules/                    ← 3 个对称子模块
│   ├── scan/                   ← 市场信号扫描
│   │   ├── SKILL.md
│   │   ├── scripts/
│   │   │   ├── skill_scan.py   ← ScanSkill + GeckoTerminal + Moralis + DataFusion
│   │   │   └── toolloop_scan.py ← SignalBus + ScanLoop
│   │   ├── knowledge/
│   │   │   └── scan_sources.yml
│   │   └── tests/
│   │       └── test_scan.py    ← 84 tests ✅
│   ├── curate/                 ← 因子提炼（对齐 WQ-YI curate-knowledge）
│   │   ├── scripts/
│   │   │   ├── toolloop_curate_arb.py ← 合并库（指标 + AMM 数学 + 跨池分析）
│   │   │   └── skill_curate_arb.py    ← CurateArbSkill 主入口
│   │   ├── knowledge/
│   │   │   └── standard_operators.yml
│   │   └── tests/
│   │       └── test_curate.py  ← 42 tests ✅
│   └── dataset/                ← 策略绑定（对齐 WQ-YI dataset-explorer）
│       ├── scripts/
│       │   ├── toolloop_signal_scorer.py  ← 多因子打分引擎（4 策略类型）
│       │   ├── toolloop_trade_planner.py  ← ScoredSignal → TradePlan
│       │   ├── toolloop_risk_sizer.py     ← 半 Kelly 仓位 + 6 层风控
│       │   └── skill_dataset_arb.py       ← DatasetArbSkill 主入口
│       ├── knowledge/
│       │   └── arb_factors.yml
│       └── tests/
│           └── test_dataset.py ← 31 tests ✅
└── test/                       ← 顶层测试
    ├── test_mm_rules.py        ← 规则 YAML 结构校验
    ├── test_slippage_guard.py  ← 滑点护甲单元测试
    ├── test_tvl_breaker.py     ← TVL 熔断器单元测试
    ├── test_data_fusion.py     ← 数据融合结构测试
    └── test_arb_pipeline.py    ← 5 步管线结构测试
```

### 架构关键：3 个自建子模块 + WQ-YI 对齐

```
scan (⚡自建)  →  curate (⚡自建)  →  dataset (⚡自建)  →  execute (⚡自建)  →  fix (⚡自建)
    ↑                  ↑                    ↑
    │            toolloop_curate_arb.py   toolloop_signal_scorer.py
    │            (指标+AMM+跨池)        toolloop_trade_planner.py
    │                                    toolloop_risk_sizer.py
GeckoTerminal   CurateArbSkill        DatasetArbSkill
+ Moralis       (→ CuratedArbContext)  (→ list[TradePlan])
```

- **curate 步骤**：`CurateArbSkill(ctx=ctx).run(scan_outputs)` — 技术指标 + AMM 数学 + 跨池分析
- **dataset 步骤**：`DatasetArbSkill(ctx=ctx).run(curated_context)` — L1 信号打分 + L2 交易计划生成
- **WQ-YI 对齐**：curate ↔ brain-curate-knowledge，dataset ↔ brain-dataset-explorer（Phase 2 接入点）

## 相关文档

- [SUBAGENT_MARKETMAKER_DESIGN.md](../../../.docs/SUBAGENT_MARKETMAKER_DESIGN.md) — 完整设计文档
- [DESIGN.md](DESIGN.md) — 设计索引
- [SUBAGENT_KOL_DESIGN.md](../../../SUBAGENT_KOL_DESIGN.md) — S8 KOL Subagent（姐妹设计）

## 测试

```bash
# 全量测试（157 个）
cd .gemini/skills/agv-market-maker
python -m pytest test/ modules/scan/tests/ modules/curate/tests/ modules/dataset/tests/ -v

# 分模块
python -m pytest modules/scan/tests/     -v  # 84 tests
python -m pytest modules/curate/tests/   -v  # 42 tests
python -m pytest modules/dataset/tests/  -v  # 31 tests
```

## 依赖

- GeckoTerminal API（DEX 交易数据）
- Moralis API（链上原始数据）
- PancakeSwap V2 Router（链上执行）
- web3.py / eth-account（BSC 交互）
