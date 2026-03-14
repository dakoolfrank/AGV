# S5 MarketMaker-Agent 详细设计

> **文档版本**: v1.2  
> **日期**: 2026-03-13 (v1.0) / 2026-03-14 (v1.1 实施对齐) / 2026-03-15 (v1.2 架构重构对齐)  
> **定位**: 独立 Subagent（双 Campaign 拓扑），与 S1-S4 主管线并行  
> **底座**: nexrur L0 Core + L1 Engines  
> **前置文档**: [DESIGN.md](DESIGN.md) §Σ.4 / [SUBAGENT_KOL_DESIGN.md](SUBAGENT_KOL_DESIGN.md)
>
> **v1.2 重构摘要**：curate/dataset 模块拆分 — 计算逻辑归入 scan（就地）或迁移至 WQ-YI Skill（跨仓），curate/dataset 步骤保留为 stub 等待 brain-curate-knowledge / brain-dataset-explorer 接入。

---

## 目录

- [§1 架构定位（双 Campaign 拓扑）](#1-架构定位双-campaign-拓扑)
- [§2 MM-Campaign 护盘（心跳模式 + 确定性管线）](#2-mm-campaign-护盘心跳模式--确定性管线)
- [§3 Arb-Campaign 套利（完整 5 步：scan→curate→dataset→execute→fix）](#3-arb-campaign-套利完整-5-步scancuratedatasetexecutefix)
- [§4 数据源架构（GeckoTerminal + Moralis 双源互补）](#4-数据源架构geckoterminal--moralis-双源互补)
- [§5 DexExecutor L2 适配层（PancakeSwap V2 封装）](#5-dexexecutor-l2-适配层pancakeswap-v2-封装)
- [§6 三大安全护甲（滑点 / MEV / TVL 熔断）](#6-三大安全护甲滑点--mev--tvl-熔断)
- [§7 nexrur 底座集成（P0-P3 + DiagnosisProfile + CampaignConfig）](#7-nexrur-底座集成p0-p3--diagnosisprofile--campaignconfig)
- [§8 人机协作与预授权额度](#8-人机协作与预授权额度)
- [§9 文件结构与实施路线图](#9-文件结构与实施路线图)
- [§10 风险评估与清醒认知](#10-风险评估与清醒认知)

---

## §1 架构定位（双 Campaign 拓扑）

### 1.1 为什么是独立 Subagent 而非 S3 的子步骤

S5 MarketMaker 与 S1-S4 主管线有本质区别：

| 维度 | S1-S4 主管线 | S5 MarketMaker |
|------|-------------|----------------|
| 触发源 | 人工启动 / 定时调度 | 市场信号（秒级 / 分钟级） |
| 决策频率 | 天级 | 秒级（护盘）/ 分钟级（套利） |
| 回退粒度 | 步骤级（backtrack_table） | 参数级（权重调整）/ 因子级（策略切换） |
| 风险敞口 | 零（纯链上读 + 签名） | 实际资金（LP 操作 + swap） |
| LLM 角色 | 每步决策参与 | 定期校准（小时级），紧急时介入 |

**结论**：S5 必须独立为 Subagent，拥有自己的 Campaign 循环、诊断引擎和预算控制。

### 1.2 双 Campaign 拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                    S5 MarketMaker-Agent                       │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │   MM-Campaign        │  │   Arb-Campaign               │  │
│  │   (护盘 + 反MEV)     │  │   (因子驱动套利)              │  │
│  │                      │  │                              │  │
│  │  心跳模式 · 秒级      │  │  scan→curate→dataset→        │  │
│  │  确定性管线           │  │  execute→fix                 │  │
│  │  零 LLM 依赖         │  │  分钟级 · LLM 校准            │  │
│  │                      │  │                              │  │
│  │  Layer 1: 被动做市    │  │  Layer 3: 外部浅池套利        │  │
│  │  Layer 2: MEV 防御    │  │  WQ-YI 因子引擎移植          │  │
│  └──────────┬───────────┘  └──────────────┬───────────────┘  │
│             │                             │                  │
│             └─────────┬───────────────────┘                  │
│                       │                                      │
│              ┌────────▼────────┐                             │
│              │  DexExecutor L2  │  ← PancakeSwap V2 适配     │
│              │  (共享执行层)    │                             │
│              └────────┬────────┘                             │
│                       │                                      │
│              ┌────────▼────────┐                             │
│              │  nexrur 底座     │  ← P0-P3 治理              │
│              │  (outcome/audit/ │                             │
│              │   evidence/gate) │                             │
│              └─────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 与 DESIGN.md 的关系

| DESIGN.md 概念 | S5 对应 |
|----------------|---------|
| Σ.4 全生命周期闭环 | MM-Campaign = 护盘闭环，Arb-Campaign = 套利闭环 |
| Σ.5 RWA Campaign 模型 | 两个 Campaign 共享同一 AssetRegistry（LP pair 作为 asset） |
| Σ.6 人机协作 | 预授权额度 + 紧急撤回（§8 详述） |
| Σ.7 置信度阈值 | MM: 确定性（无阈值），Arb: 因子置信度 ≥ 0.85 才执行 |
| §3 backtrack_table | Arb 三级回退：权重调整 / curate 回退 / 策略重构 |

### 1.4 三层架构总览

| Layer | 名称 | Campaign | 频率 | LLM 参与 | Phase |
|-------|------|----------|------|---------|-------|
| **L1** | 被动做市（护盘） | MM-Campaign | 秒级心跳 | 无 | Phase 1 ✅ |
| **L2** | MEV 防御（反三明治） | MM-Campaign | 事件驱动 | 无 | Phase 1 ✅ |
| **L3** | 因子驱动套利 | Arb-Campaign | 分钟级 | 定期校准 | Phase 2 ⏳ |

**Phase 1 门槛**：当前 LP TVL（~$100 级别）即可运行 L1+L2。  
**Phase 2 门槛**：需要 TVL 增长 + 因子引擎完成移植。

---

## §2 MM-Campaign 护盘（心跳模式 + 确定性管线）

### 2.1 设计目标

**用最小资金维持 LP 池的基本流动性和价格稳定**。不追求利润，只追求"池子不死"。

当前现实：
- pGVT-USDT LP: ~$100 TVL，$0.005/枚
- sGVT-USDT LP: ~$100 TVL，$0.50/枚
- 日交易量接近零

在这个规模下，MM-Campaign 的任务是**防慢死**（防止池子被单笔大单抽干）而非"做市盈利"。

### 2.2 心跳模式

```python
# CampaignRunner 扩展：HeartbeatMode
class HeartbeatConfig:
    interval_seconds: int = 30          # 心跳间隔
    max_consecutive_noop: int = 120     # 连续无操作上限（1小时后降频）
    degraded_interval_seconds: int = 300  # 降频后间隔
    emergency_interval_seconds: int = 5   # 紧急模式间隔
```

**三档频率**：

| 模式 | 间隔 | 触发条件 |
|------|------|----------|
| 正常 | 30s | 默认 |
| 降频 | 5min | 连续 120 次无操作（市场静默） |
| 紧急 | 5s | 检测到异常交易（大单 / 三明治 / 价格偏移 > 5%） |

### 2.3 确定性管线（零 LLM）

```
每次心跳:
  1. READ    → 链上状态（reserves, price, pending_tx）
  2. DETECT  → 异常检测（价格偏移 / 大单 / MEV 特征）
  3. DECIDE  → 确定性规则（if-else，无 LLM）
  4. EXECUTE → DexExecutor（或 noop）
  5. LOG     → audit.emit + evidence.record
```

**确定性规则示例**：

```python
class MMRules:
    """护盘规则引擎 — 纯确定性，零 LLM"""

    # 价格偏移阈值
    price_deviation_warn: float = 0.03    # 3% → 记录
    price_deviation_act: float = 0.05     # 5% → 触发再平衡
    price_deviation_emergency: float = 0.10  # 10% → 紧急撤流动性

    # 大单检测（相对池子深度）
    whale_trade_pct: float = 0.10         # 单笔 > 池子 10% → 警报
    whale_trade_emergency_pct: float = 0.30  # 单笔 > 池子 30% → 紧急模式

    # LP 再平衡
    rebalance_threshold: float = 0.05     # 两侧偏离 > 5% → 再平衡
    max_rebalance_amount_usd: float = 10.0  # 单次再平衡上限 $10

    # 每日预算
    max_daily_gas_usd: float = 5.0        # 日 gas 费上限
    max_daily_trades: int = 50            # 日交易次数上限
```

### 2.4 Layer 2: MEV 防御

**针对自有池的反三明治 / 反 JIT / 反吸血鬼**：

| 攻击类型 | 检测方法 | 防御手段 |
|---------|---------|---------|
| **三明治攻击** | mempool 监控 pending_tx，识别夹击模式 | 48Club 私有 RPC 提交 / BloXroute 加速 |
| **JIT Liquidity** | 同区块 LP add+remove 检测 | 拆分交易 + 时间抖动（±2 区块） |
| **鲸鱼砸盘** | 单笔 > 池子 30% + 来源地址分析 | 自动撤 LP（先撤后观察） |
| **短周期 LP 吸血鬼** | LP 添加→手续费收割→撤出（<10 区块） | 记录 + 告警（当前规模无需主动防御） |

**BSC MEV 防御栈**：

```yaml
mev_defense:
  private_rpc:
    primary: "48Club"          # BSC 最大矿池私有 RPC
    fallback: "BloXroute"      # 跨链 MEV 保护
  tx_splitting:
    enabled: true
    max_parts: 3               # 大额拆为 ≤3 笔
    jitter_blocks: 2           # 时间抖动 ±2 区块
  detection:
    mempool_scan: true         # 监控 pending transactions
    sandwich_pattern: true     # 识别 front-run + back-run 组合
    alert_threshold: 0.05      # 异常交易 > 5% 池深度 → 告警
```

### 2.5 MM-Campaign 状态机

```
IDLE → HEARTBEAT → [DETECT] → NOOP / REBALANCE / EMERGENCY
                                  │         │           │
                                  │         │           └→ WITHDRAW_LP → COOLDOWN → IDLE
                                  │         └→ EXECUTE_SWAP → LOG → IDLE
                                  └→ LOG → IDLE
```

**nexrur 映射**：

| 状态 | nexrur StepOutcome.status | reason_code |
|------|--------------------------|-------------|
| NOOP | success | `heartbeat_noop` |
| REBALANCE | success | `rebalance_executed` |
| EMERGENCY | partial | `emergency_withdraw` |
| COOLDOWN | partial | `cooldown_active` |
| GAS_EXCEEDED | failed | `daily_gas_exceeded` |
| TX_FAILED | failed | `tx_revert` |

---

## §3 Arb-Campaign 套利（完整 5 步：scan→curate→dataset→execute→fix）

### 3.1 "换头不砍头"：从 WQ-YI 移植

**WQ-YI 8 步管线**：`collect → curate → dataset_l1 → field_updater → dataset_l2 → evaluate → fix → submit`

**Arb-Campaign 5 步管线**：`scan → curate → dataset → execute → fix`

| WQ-YI 步骤 | Arb 对应 | 变化 |
|------------|---------|------|
| collect（arXiv 论文搜集） | **scan**（GeckoTerminal + Moralis 市场信号） | **换头**：数据源从学术论文换成市场数据 |
| curate（骨架提取） | **curate**（策略骨架提取） | 复用：从市场信号中提取套利策略骨架 |
| dataset_l1 + l2（字段绑定） | **dataset**（因子绑定） | 简化：L1/L2 合并为单层，因子池更小 |
| evaluate（仿真 + 门禁） | **execute**（实盘执行 + 确认） | **升级**：从仿真到实盘 |
| fix（Alpha 修复） | **fix**（策略修复） | 复用：失败策略诊断 + 参数调整 |

### 3.2 Step 1: scan（市场信号扫描）

**替代 collect 的数据源层**，从 GeckoTerminal + Moralis 获取实时市场数据。

```python
class ScanOps:
    """scan 步骤 — 市场信号采集"""

    def __call__(self, *, config, workspace, **kwargs) -> StepResult:
        signals = []

        # GeckoTerminal: OHLCV + 交易流 + 趋势池
        ohlcv = gecko_client.get_ohlcv(pool_address, timeframe="1m")
        trades = gecko_client.get_trades(pool_address, limit=100)
        trending = gecko_client.get_trending_pools(network="bsc")

        # Moralis: 持仓变动 + LP 事件
        transfers = moralis_client.get_token_transfers(token_address)
        lp_events = moralis_client.get_pair_events(pair_address)

        # 信号提取
        for signal in extract_signals(ohlcv, trades, transfers, lp_events):
            signals.append(AssetRef(
                kind="market_signal",
                id=signal.sig_id,
                path=None,  # 纯内存，不落盘
                metadata={
                    "type": signal.type,      # price_divergence / volume_spike / lp_imbalance
                    "strength": signal.strength,
                    "source": signal.source,   # gecko / moralis
                    "timestamp": signal.ts,
                }
            ))
        return StepResult(assets_produced=signals)
```

**信号类型**：

| 信号 | 来源 | 触发条件 | 含义 |
|------|------|---------|------|
| `price_divergence` | GeckoTerminal OHLCV | 两池价格差 > 1% | 跨池价差（套利窗口） |
| `volume_spike` | GeckoTerminal trades | 5 分钟量 > 24h 均值 ×3 | 异常交易活动 |
| `lp_imbalance` | Moralis LP events | 单侧 reserve 偏移 > 5% | LP 失衡 |
| `whale_movement` | Moralis transfers | 单笔 > 总供应 1% | 鲸鱼动向 |
| `trending_momentum` | GeckoTerminal trending | 池子进入 trending 前 20 | 热度信号 |

### 3.3 Step 2: curate（策略骨架提取）— stub，等待 brain-curate-knowledge

> **v1.2 变更**：curate 原有的计算逻辑（指标计算、AMM 模式识别、跨池分析）已合并入 scan 模块
> （`toolloop_scan.py`），因为这些本质上是"数据扫描 + 特征提取"而非"骨架设计"。
>
> 当前 curate 步骤是 **stub**，等待对接 WQ-YI `brain-curate-knowledge` Skill——
> 该 Skill 负责从 scan 产出的信号中提取**策略骨架**（含 `{slot}` 占位符 + simulation_settings），
> 与 WQ-YI 8 步管线中 curate 从论文提取 alpha 骨架完全对称。

**目标产出（策略骨架示例）**：

```yaml
# 由 brain-curate-knowledge 产出（当前为 stub 占位）
strategy_skeleton:
  id: "arb-price-div-001"
  type: "cross_pool_arbitrage"
  trigger:
    signal: "price_divergence"
    threshold: 0.015            # 1.5% 价差
  entry:
    buy_pool: "0x5558..."       # pGVT-USDT (低价侧)
    sell_pool: "external_pool"  # 外部浅池 (高价侧)
  sizing:
    method: "fixed_fraction"
    fraction: 0.05              # 可用资金的 5%
  exit:
    take_profit: 0.008          # 0.8% 净利（扣除 gas + 滑点）
    stop_loss: 0.005            # 0.5% 止损
    max_hold_blocks: 10         # 最长持有 10 区块
  risk:
    max_slippage: 0.005         # 0.5%
    require_private_rpc: true
```

**scan 模块已吸收的 curate 计算**：

| 原 curate 功能 | 现归属 | 文件 |
|---------------|--------|------|
| 指标计算（RSI/VWAP/Bollinger/OBV/MACD） | scan `toolloop_scan.py` | `_compute_indicators()` |
| AMM 模式识别（reserve_ratio、impermanent_loss、LP flow） | scan `toolloop_scan.py` | `_detect_amm_patterns()` |
| 跨池分析（价差、深度比、路由效率） | scan `toolloop_scan.py` | `_analyze_cross_pool()` |
| curate 知识库（AMM 算子） | WQ-YI curate knowledge | `amm_operators.yml` |

**LLM 参与点**（小时级校准，非每轮决策）：

```
每 N 小时（默认 4h）:
  1. 收集过去 N 小时的 scan 结果摘要
  2. LLM 评估：当前信号分布是否需要调整策略权重
  3. 输出：{ weight_adjustments: {...}, new_strategies: [...], deprecated: [...] }
  4. 人工确认（非紧急）或自动应用（置信度 > 0.90）
```

### 3.4 Step 3: dataset（因子绑定）— stub，等待 brain-dataset-explorer

> **v1.2 变更**：dataset 原有的 Python 逻辑（signal_scorer / trade_planner / risk_sizer）
> 已迁移至 WQ-YI `brain-dataset-explorer` Skill，分别对应：
>
> | 原 AGV 文件 | WQ-YI 目标 | 对应 WQ-YI 概念 |
> |------------|-----------|----------------|
> | `toolloop_signal_scorer.py` (297行) | `toolloop_arb_l1.py` | dataset L1 — 因子组推荐（slot → factor group） |
> | `toolloop_trade_planner.py` (221行) + `toolloop_risk_sizer.py` (124行) | `toolloop_arb_l2.py` | dataset L2 — 具体指标绑定（factor group → indicator + params） |
> | `arb_factors.yml` (99行) | `knowledge/arb_factors.yml` | dataset knowledge — 因子池定义 |
>
> 当前 dataset 步骤是 **stub**，等待对接 WQ-YI `brain-dataset-explorer` Skill。

**WQ-YI 对称关系**：

| WQ-YI 概念 | Arb 对应 | 说明 |
|------------|---------|------|
| category（BRAIN 数据集分类） | **factor_group**（市场因子分组） | 如 price/liquidity/on_chain/lp_dynamic/sentiment |
| datafield（BRAIN 字段） | **indicator**（技术指标 / 链上指标） | 如 RSI/VWAP/reserve_ratio/tx_count |
| L1 推荐 | 因子组初筛 | 确定性规则（`toolloop_arb_l1.py`） |
| L2 绑定 | 指标精选 + 参数绑定 | 确定性 + 可选 LLM 仲裁（`toolloop_arb_l2.py`） |

**因子池**（定义在 `arb_factors.yml`，Phase 2 初始）：

| 因子组 | 指标 | 来源 |
|--------|------|------|
| **价格** | OHLCV、VWAP、Bollinger、RSI | GeckoTerminal OHLCV |
| **流动性** | reserve_ratio、depth_±2%、slippage_curve | GeckoTerminal + 链上 |
| **链上活动** | tx_count、unique_wallets、avg_trade_size | Moralis |
| **LP 动态** | add/remove 事件频率、net_flow、impermanent_loss | Moralis LP events |
| **情绪** | trending_rank、social_mentions（预留） | GeckoTerminal trending |

### 3.5 Step 4: execute（实盘执行）

```python
class ExecuteOps:
    """execute 步骤 — Arb 实盘执行"""

    def __call__(self, *, assets_input, config, **kwargs) -> StepResult:
        strategies = filter_assets(assets_input, "arb_strategy")
        results = []

        for strategy in strategies:
            # 1. 前置检查（确定性门禁）
            pre_check = self.pre_flight(strategy)
            if not pre_check.passed:
                results.append(AssetRef(
                    kind="execution_result",
                    id=strategy.id,
                    metadata={"status": "blocked", "reason": pre_check.reason}
                ))
                continue

            # 2. 执行
            tx_result = dex_executor.execute(strategy)

            # 3. 确认
            receipt = dex_executor.wait_confirmation(tx_result.tx_hash, timeout=30)

            results.append(AssetRef(
                kind="execution_result",
                id=strategy.id,
                metadata={
                    "status": "executed" if receipt.success else "reverted",
                    "tx_hash": tx_result.tx_hash,
                    "gas_used": receipt.gas_used,
                    "pnl_usd": self.calculate_pnl(strategy, receipt),
                }
            ))

        return StepResult(assets_produced=results)

    def pre_flight(self, strategy) -> PreCheckResult:
        """确定性前置检查 — 零 LLM"""
        checks = [
            self.check_budget_remaining(),      # 日预算未超
            self.check_slippage(strategy),       # 预计滑点 < 阈值
            self.check_gas_price(),              # gas < 合理范围
            self.check_pool_depth(strategy),     # 池深度仍 > 最小值
            self.check_signal_freshness(strategy),  # 信号未过期（< 2min）
        ]
        return PreCheckResult.merge(checks)
```

### 3.6 Step 5: fix（策略修复）

**三级回退（Arb-Campaign 特有）**：

| 级别 | 触发 | 动作 | LLM | 回退到 |
|------|------|------|-----|--------|
| **A: 参数调整** | 滑点超预期 / gas 偏高 | 调整阈值、sizing | 无 | execute（同策略重试） |
| **B: 因子切换** | 连续 3 次失败 / 信号源异常 | 切换因子组合 | ✅ 辅助 | curate（重新提取骨架） |
| **C: 策略重构** | 累计亏损 > 日预算 50% / 市场结构变化 | 暂停 Arb + LLM 全面诊断 | ✅ 主导 | scan（从头扫描） |

**nexrur DiagnosisProfile 对齐**：

```python
arb_diagnosis_profile = DiagnosisProfile(
    name="arb_market_maker",
    retreat_levels={
        "A": {"target_step": "execute", "trigger": "param_drift", "llm": False},
        "B": {"target_step": "curate", "trigger": "factor_exhausted", "llm": True},
        "C": {"target_step": "scan", "trigger": "structural_change", "llm": True},
    },
    max_consecutive_failures=5,         # 连续失败上限
    budget_halt_threshold=0.5,          # 累计亏损 > 50% 日预算 → 暂停
    cooldown_minutes=30,                # C 级回退后冷静期
)
```

### 3.7 AssetRef kind 扩展

| kind | 产出步骤 | 消费步骤 |
|------|---------|---------|
| `market_signal` | scan | curate |
| `arb_skeleton` | curate | dataset |
| `arb_strategy` | dataset | execute |
| `execution_result` | execute | fix |
| `fix_patch` | fix | execute / curate / scan |

---

## §4 数据源架构（GeckoTerminal + Moralis 双源互补）

### 4.1 双源定位

| 维度 | GeckoTerminal | Moralis |
|------|---------------|---------|
| **强项** | DEX 交易数据（OHLCV、trades、trending） | 链上原始数据（transfers、holders、LP events） |
| **时效** | 实时 + 历史 OHLCV | 实时 + 历史 txn |
| **免费额度** | 基础 API 免费（30 req/min） | Token 制（AGV 已持有） |
| **Pro 增值** | 60 req/min + WebSocket + bulk 历史 | 更高 QPS + Stream API |
| **适用层** | scan 信号 + Arb 因子 | LP 监控 + 鲸鱼追踪 + MEV 检测 |
| **我们的关系** | 他们主动推广 Token API，我们自然使用 | 已有 Moralis token |

### 4.2 GeckoTerminal API 封装

```python
class GeckoTerminalClient:
    """GeckoTerminal DEX 数据客户端"""

    BASE_URL = "https://api.geckoterminal.com/api/v2"

    async def get_ohlcv(
        self, pool_address: str, *,
        timeframe: str = "1m",    # 1m / 5m / 15m / 1h / 4h / 1d
        limit: int = 100,
        currency: str = "usd",
    ) -> list[OHLCVBar]:
        """K 线数据 — scan 核心数据源"""
        ...

    async def get_trades(
        self, pool_address: str, *,
        limit: int = 100,
        trade_volume_in_usd_greater_than: float = 0,
    ) -> list[Trade]:
        """最新交易 — 异常检测 + 信号提取"""
        ...

    async def get_pool_info(self, pool_address: str) -> PoolInfo:
        """池信息 — reserve、price、volume_24h、fdv"""
        ...

    async def get_trending_pools(
        self, *, network: str = "bsc", page: int = 1
    ) -> list[TrendingPool]:
        """趋势池 — 热度信号"""
        ...

    async def get_token_price(
        self, token_addresses: list[str], *, network: str = "bsc"
    ) -> dict[str, float]:
        """批量价格 — 跨池价差检测"""
        ...

    async def get_multi_pool_ohlcv(
        self, pool_addresses: list[str], *, timeframe: str = "5m"
    ) -> dict[str, list[OHLCVBar]]:
        """多池 OHLCV — 跨池套利因子"""
        ...
```

**速率控制**：

```yaml
gecko_rate_limit:
  free_tier:
    requests_per_minute: 30
    burst: 5
  pro_tier:                     # 后续升级
    requests_per_minute: 60
    websocket: true
  strategy:
    request_queue: true         # 队列化，不丢弃
    priority: ["ohlcv", "trades", "pool_info", "trending"]
    cache_ttl:
      ohlcv: 60                 # 1min K 线缓存
      pool_info: 300            # 5min 池信息缓存
      trending: 600             # 10min 趋势缓存
```

### 4.3 Moralis API 封装

```python
class MoralisClient:
    """Moralis 链上数据客户端"""

    async def get_token_transfers(
        self, token_address: str, *,
        from_block: int | None = None,
        limit: int = 100,
    ) -> list[TokenTransfer]:
        """代币转账 — 鲸鱼监控"""
        ...

    async def get_token_holders(
        self, token_address: str, *, limit: int = 100
    ) -> list[TokenHolder]:
        """持仓分布 — 集中度风险"""
        ...

    async def get_pair_events(
        self, pair_address: str, *,
        event_type: str = "all",     # swap / mint / burn / sync
        from_block: int | None = None,
    ) -> list[PairEvent]:
        """LP 事件 — 流动性监控"""
        ...

    async def get_token_price(
        self, token_address: str
    ) -> TokenPrice:
        """价格（聚合多源）"""
        ...
```

### 4.4 双源融合策略

```
              ┌─────────────┐     ┌─────────────┐
              │ GeckoTerminal│     │   Moralis    │
              │  (DEX 交易)  │     │  (链上原始)  │
              └──────┬──────┘     └──────┬──────┘
                     │                   │
         ┌───────────▼───────────────────▼──────────┐
         │           DataFusionLayer                 │
         │                                           │
         │  1. 时间对齐（统一 UTC 时间戳）             │
         │  2. 去重（同笔交易两源可能都有）              │
         │  3. 交叉验证（价格偏差 > 1% → 告警）         │
         │  4. 缺失补全（一方断流 → 另一方兜底）         │
         └────────────────┬──────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │    Unified Signal Bus  │
              │  → scan 消费           │
              │  → MM 心跳消费         │
              └───────────────────────┘
```

**交叉验证规则**：

| 场景 | 检测方法 | 处理 |
|------|---------|------|
| 价格分歧 | Gecko price ≠ Moralis price（> 1%） | 取链上 reserves 重新计算，标记不一致方 |
| 单源断流 | 连续 3 个心跳无数据 | 切换到另一源，降级告警 |
| 交易缺失 | Gecko 有 trade，Moralis 无 transfer | 可能是 DEX 聚合器内部路由，标记 |
| 延迟 | 两源时间戳差 > 5s | 取较新的，记录延迟差 |

---

## §5 DexExecutor L2 适配层（PancakeSwap V2 封装）

### 5.1 设计目标

**统一的 DEX 执行接口，隔离链上操作细节**。MM-Campaign 和 Arb-Campaign 共享同一执行层。

```
           MM-Campaign ──┐
                         ├──→ DexExecutor (统一接口)
           Arb-Campaign ─┘         │
                                   ├── PancakeV2Adapter (当前)
                                   ├── PancakeV3Adapter (预留)
                                   └── UniswapV2Adapter (预留)
```

### 5.2 核心接口

```python
class DexExecutor:
    """DEX 执行层 — S5 共享基础设施"""

    def __init__(self, adapter: DexAdapter, signer: Signer, config: ExecutorConfig):
        self.adapter = adapter
        self.signer = signer
        self.config = config

    async def swap(
        self, *,
        token_in: str,
        token_out: str,
        amount_in: int,
        min_amount_out: int,
        deadline_seconds: int = 300,
        use_private_rpc: bool = False,
    ) -> TxResult:
        """执行 swap — 核心操作"""
        ...

    async def add_liquidity(
        self, *,
        token_a: str, token_b: str,
        amount_a: int, amount_b: int,
        min_a: int, min_b: int,
        deadline_seconds: int = 300,
    ) -> TxResult:
        """添加流动性"""
        ...

    async def remove_liquidity(
        self, *,
        token_a: str, token_b: str,
        liquidity: int,
        min_a: int, min_b: int,
        deadline_seconds: int = 300,
    ) -> TxResult:
        """移除流动性 — 紧急撤退核心"""
        ...

    async def get_reserves(self, pair_address: str) -> tuple[int, int]:
        """查询 reserves — 心跳核心"""
        ...

    async def get_amount_out(
        self, amount_in: int, reserve_in: int, reserve_out: int
    ) -> int:
        """链下预计算输出量（不发交易）"""
        ...

    async def estimate_slippage(
        self, *, token_in: str, token_out: str, amount_in: int
    ) -> float:
        """预估滑点（ask vs reserves 计算）"""
        ...
```

### 5.3 PancakeSwap V2 适配

```python
class PancakeV2Adapter(DexAdapter):
    """PancakeSwap V2 适配器"""

    ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"
    FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"
    USDT = "0x55d398326f99059fF775485246999027B3197955"

    # 已知 LP Pair
    PAIRS = {
        "pGVT_USDT": "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0",
        "sGVT_USDT": "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d",
    }

    async def build_swap_tx(self, params: SwapParams) -> RawTransaction:
        """构建 swapExactTokensForTokens 交易"""
        path = [params.token_in, params.token_out]
        if params.token_in != self.USDT and params.token_out != self.USDT:
            path = [params.token_in, self.USDT, params.token_out]  # 经 USDT 路由

        return self.router.functions.swapExactTokensForTokens(
            params.amount_in,
            params.min_amount_out,
            path,
            params.recipient,
            params.deadline,
        ).build_transaction({
            "from": self.signer.address,
            "gas": 250_000,
            "gasPrice": await self.get_gas_price(),
        })
```

### 5.4 安全约束层（嵌入 Executor）

```python
class ExecutorConfig:
    """执行层安全配置 — 硬编码底线，不可被 LLM 覆盖"""

    # === 单笔限制 ===
    max_single_trade_usd: float = 50.0      # Phase 1: 单笔上限 $50
    max_slippage_pct: float = 0.02           # 2% 最大滑点
    min_pool_depth_usd: float = 50.0         # 池深度 < $50 → 拒绝交易

    # === 日限制 ===
    max_daily_volume_usd: float = 500.0      # Phase 1: 日交易量上限 $500
    max_daily_gas_usd: float = 5.0           # 日 gas 上限 $5
    max_daily_trades: int = 100              # 日交易次数上限

    # === 紧急 ===
    emergency_withdraw_enabled: bool = True  # 紧急撤 LP 开关
    emergency_cooldown_minutes: int = 30     # 紧急撤后冷静期

    # === 私有 RPC ===
    private_rpc_url: str | None = None       # 48Club / BloXroute
    use_private_rpc_for_large: bool = True   # 大额交易自动走私有 RPC
    large_trade_threshold_usd: float = 20.0  # > $20 视为"大额"
```

### 5.5 Approve 管理

```python
class ApproveManager:
    """Token Approve 管理 — 安全与效率平衡"""

    async def ensure_allowance(
        self, token: str, spender: str, required: int
    ) -> TxResult | None:
        """检查 + 按需 approve（不 approve MAX_UINT256）"""
        current = await self.get_allowance(token, spender)
        if current >= required:
            return None  # 无需 approve

        # 按需 approve：required × 2（减少频繁 approve，但不无限）
        approve_amount = required * 2
        return await self.approve(token, spender, approve_amount)
```

**安全规则**：
- **禁止** `approve(MAX_UINT256)` — 限制风险敞口
- **每次 approve = 需求量 × 2** — 平衡 gas 与安全
- **定期审计** approve 状态 — 心跳中顺便检查
## §6 三大安全护甲（滑点 / MEV / TVL 熔断）

### 6.1 安全分层

```
┌─────────────────────────────────────────────────┐
│              Layer 3: TVL 熔断                    │
│   TVL < 阈值 → 暂停一切交易 → 仅允许撤 LP          │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │          Layer 2: MEV 防御                │    │
│  │  三明治检测 + 私有 RPC + 交易拆分           │    │
│  │                                          │    │
│  │  ┌──────────────────────────────────┐    │    │
│  │  │      Layer 1: 滑点控制            │    │    │
│  │  │  预计算 + 动态 minOut + 拒绝高滑点  │    │    │
│  │  └──────────────────────────────────┘    │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**从内到外，任意一层触发 → 交易被拒绝，不存在"绕过"。**

### 6.2 Layer 1: 滑点控制

```python
class SlippageGuard:
    """滑点护甲 — 每笔交易必经"""

    max_slippage_pct: float = 0.02    # 2% 硬顶

    async def check(self, swap_params: SwapParams) -> GuardResult:
        # 1. 链下预计算
        expected_out = get_amount_out(
            swap_params.amount_in,
            reserves[0], reserves[1]
        )

        # 2. 计算实际滑点（含手续费）
        ideal_out = swap_params.amount_in * price  # 无滑点理想值
        actual_slippage = 1 - (expected_out / ideal_out)

        # 3. 判定
        if actual_slippage > self.max_slippage_pct:
            return GuardResult(
                passed=False,
                reason=f"slippage {actual_slippage:.2%} > max {self.max_slippage_pct:.2%}"
            )

        # 4. 动态 minOut（expected_out × (1 - buffer)）
        min_out = int(expected_out * (1 - self.max_slippage_pct))
        swap_params.min_amount_out = min_out
        return GuardResult(passed=True)
```

### 6.3 Layer 2: MEV 防御（详见 §2.4 扩展）

| 组件 | 职责 | 状态 |
|------|------|------|
| **MempoolMonitor** | 监控 pending tx，识别三明治模式 | Phase 1 |
| **PrivateRpcRouter** | $20+ 交易走 48Club / BloXroute | Phase 1 |
| **TxSplitter** | 大额拆为 ≤3 笔，间隔 ±2 区块 | Phase 1 |
| **SandwichDetector** | 识别 front-run + back-run 组合 | Phase 1 |
| **JITDefender** | 检测同区块 LP mint+burn | Phase 2 |

### 6.4 Layer 3: TVL 熔断

```python
class TVLCircuitBreaker:
    """TVL 熔断器 — 终极安全阀"""

    # 熔断阈值
    min_tvl_usd: float = 30.0              # TVL < $30 → 熔断
    warn_tvl_usd: float = 80.0             # TVL < $80 → 预警（减少操作）
    critical_reserve_ratio: float = 0.10   # 单侧 reserve < 10% → 熔断

    # 恢复阈值（必须高于触发阈值，防止震荡）
    recover_tvl_usd: float = 100.0         # TVL > $100 → 恢复
    recover_cooldown_minutes: int = 60     # 恢复后冷静 60 分钟

    async def check(self, pool_state: PoolState) -> BreakerResult:
        tvl = pool_state.reserve_a_usd + pool_state.reserve_b_usd

        if tvl < self.min_tvl_usd:
            return BreakerResult(
                tripped=True,
                action="HALT_ALL",          # 暂停一切交易
                allow_withdraw=True,        # 仅允许撤 LP
                reason=f"TVL ${tvl:.0f} < min ${self.min_tvl_usd:.0f}"
            )

        if pool_state.reserve_ratio < self.critical_reserve_ratio:
            return BreakerResult(
                tripped=True,
                action="HALT_ALL",
                allow_withdraw=True,
                reason=f"Reserve ratio {pool_state.reserve_ratio:.1%} < critical 10%"
            )

        if tvl < self.warn_tvl_usd:
            return BreakerResult(
                tripped=False,
                action="REDUCE_ACTIVITY",   # 减频，仅护盘
                allow_withdraw=True,
                reason=f"TVL ${tvl:.0f} < warn ${self.warn_tvl_usd:.0f}"
            )

        return BreakerResult(tripped=False, action="NORMAL")
```

**熔断后行为**：

| 状态 | MM-Campaign | Arb-Campaign | 允许操作 |
|------|------------|-------------|---------|
| NORMAL | 正常心跳 | 正常扫描 | 全部 |
| REDUCE_ACTIVITY | 正常心跳 | **暂停** | 仅护盘 + 撤 LP |
| HALT_ALL | **仅监控** | **暂停** | 仅撤 LP |

### 6.5 三甲联动

```
每笔交易:
  1. TVLCircuitBreaker.check()  → HALT? → 拒绝
  2. MEVGuard.check()           → 三明治? → 延迟/走私有RPC
  3. SlippageGuard.check()      → 高滑点? → 拒绝
  4. BudgetGuard.check()        → 超预算? → 拒绝
  5. DexExecutor.execute()      → 实际执行
```

---

## §7 nexrur 底座集成（P0-P3 + DiagnosisProfile + CampaignConfig）

### 7.1 四大治理映射

| nexrur 治理 | MM-Campaign 对应 | Arb-Campaign 对应 |
|-------------|-----------------|------------------|
| **P0 StepOutcome** | 每次心跳产出 outcome（noop/rebalance/emergency） | 每步产出 outcome（标准 5 步） |
| **P1 Lineage** | `mm_heartbeat_id` → `mm_action_id` | `scan_run_id` → `curate_run_id` → ... → `fix_run_id` |
| **P2 RAG** | 异常模式积累（重复三明治攻击模式可检索） | 策略失败模式积累（跨 campaign 学习） |
| **P3 Gate** | 无门禁（确定性管线不需要上游检查） | execute 前检查 scan+curate+dataset 状态 |

### 7.2 PipelineDescriptor

```python
# MM-Campaign 管线描述
mm_pipeline = PipelineDescriptor(
    name="mm_heartbeat",
    steps=["monitor", "detect", "decide", "execute", "log"],
    step_to_skill={
        "monitor": "market-maker",
        "detect": "market-maker",
        "decide": "market-maker",
        "execute": "market-maker",
        "log": "market-maker",
    },
    optional_steps=frozenset(),     # 全部必需
    produces={
        "monitor": ["pool_state"],
        "detect": ["anomaly_signal"],
        "decide": ["action_plan"],
        "execute": ["tx_result"],
        "log": [],
    },
)

# Arb-Campaign 管线描述
arb_pipeline = PipelineDescriptor(
    name="arb_factor",
    steps=["scan", "curate", "dataset", "execute", "fix"],
    step_to_skill={
        "scan": "market-maker",
        "curate": "brain-curate-knowledge",   # WQ-YI Skill 复用
        "dataset": "brain-dataset-explorer",   # WQ-YI Skill 复用
        "execute": "market-maker",
        "fix": "market-maker",
    },
    optional_steps=frozenset({"fix"}),  # fix 可选
    produces={
        "scan": ["market_signal"],
        "curate": ["arb_skeleton"],
        "dataset": ["arb_strategy"],
        "execute": ["execution_result"],
        "fix": ["fix_patch"],
    },
)
```

### 7.3 CampaignConfig

```python
mm_campaign_config = CampaignConfig(
    pipeline=mm_pipeline,
    max_cycles=None,                    # 无限循环（心跳模式）
    cycle_interval_seconds=30,          # 心跳间隔
    budget=BudgetConfig(
        max_daily_usd=5.0,             # 日 gas 预算
        max_single_usd=10.0,           # 单次操作上限
        halt_on_exceed=True,
    ),
    diagnosis=DiagnosisConfig(
        profile="mm_passive",
        max_consecutive_failures=10,
        cooldown_minutes=5,
    ),
)

arb_campaign_config = CampaignConfig(
    pipeline=arb_pipeline,
    max_cycles=100,                     # 日内最大循环
    cycle_interval_seconds=60,          # 1 分钟循环
    budget=BudgetConfig(
        max_daily_usd=500.0,           # 日交易量上限
        max_single_usd=50.0,           # 单笔上限
        halt_on_exceed=True,
    ),
    diagnosis=DiagnosisConfig(
        profile="arb_market_maker",     # 三级回退
        max_consecutive_failures=5,
        cooldown_minutes=30,
        budget_halt_threshold=0.5,      # 亏损 > 50% 日预算 → 暂停
    ),
)
```

### 7.4 Outcome 扩展码

```yaml
# policy.yml 扩展
outcome_reason_codes:
  market_maker:
    - heartbeat_noop           # 心跳无操作
    - rebalance_executed       # 再平衡完成
    - emergency_withdraw       # 紧急撤流动性
    - cooldown_active          # 冷静期中
    - daily_gas_exceeded       # 日 gas 预算超限
    - daily_volume_exceeded    # 日交易量超限
    - tx_revert                # 交易回滚
    - slippage_exceeded        # 滑点超限
    - tvl_circuit_break        # TVL 熔断
    - mev_detected             # MEV 攻击检测
    - signal_stale             # 信号过期
    - pool_depth_insufficient  # 池深度不足
    - param_drift              # 参数漂移（Arb A级）
    - factor_exhausted         # 因子耗尽（Arb B级）
    - structural_change        # 结构变化（Arb C级）
```

### 7.5 Audit Trail

```python
# 每笔交易的审计记录
ctx.audit.emit("mm_heartbeat", {
    "pool": pair_address,
    "reserves": [r0, r1],
    "price": current_price,
    "action": "rebalance",
    "amount_usd": 5.0,
    "tx_hash": "0x...",
    "gas_used": 150000,
    "slippage_actual": 0.003,
    "mev_risk": "none",
})

# 证据链
ctx.evidence.record("mm_rebalance_rationale", {
    "trigger": "price_deviation_5pct",
    "pre_state": {"price": 0.00475, "reserve_ratio": 0.55},
    "post_state": {"price": 0.00500, "reserve_ratio": 0.50},
    "decision": "deterministic_rule",
    "confidence": 1.0,  # 确定性规则 = 1.0
})
```

---

## §8 人机协作与预授权额度

### 8.1 设计原则

**S5 是唯一涉及实际资金操作的 Subagent**，因此人机协作模型与 S1-S4 完全不同：

| 维度 | S1-S4 | S5 |
|------|-------|-----|
| 风险 | 零（链上只读） | 实际资金 |
| 自主范围 | 宽（仅结果需人工确认） | 窄（预授权额度内自主，超额需确认） |
| 紧急操作 | 无 | 紧急撤 LP（预授权，事后告知） |

### 8.2 预授权额度体系

```yaml
# 预授权配置 — 由人工设定，Agent 不可修改
preauth:
  # === MM-Campaign 预授权 ===
  mm:
    max_single_rebalance_usd: 10.0    # 单次再平衡上限
    max_daily_gas_usd: 5.0            # 日 gas 上限
    emergency_withdraw: true           # 紧急撤 LP 预授权（无需确认）
    auto_resume_after_emergency: false # 紧急撤后不自动恢复（需人工确认）

  # === Arb-Campaign 预授权 ===
  arb:
    max_single_trade_usd: 50.0        # 单笔交易上限
    max_daily_volume_usd: 500.0       # 日交易量上限
    max_daily_loss_usd: 50.0          # 日最大亏损（超限 → 自动暂停）
    strategy_change_requires_approval: true  # 策略切换需人工确认

  # === 全局 ===
  global:
    max_approved_tokens:               # 预批准的 token 列表（仅这些可交易）
      - "0x8F9EC...pGVT"
      - "0x53e59...sGVT"
      - "0x55d39...USDT"
    approved_pools:                    # 预批准的池（仅这些可操作）
      - "0x5558e...pGVT_USDT"
      - "0xBE1B0...sGVT_USDT"
    unapproved_pool_action: "REJECT"  # 未知池 → 拒绝（不是警告）
```

### 8.3 三档授权模型

| 档位 | 触发条件 | Agent 行为 | 人工参与 |
|------|---------|-----------|---------|
| **自主** | 在预授权额度内 | 直接执行 + 审计记录 | 事后查看 |
| **请示** | 超额或新策略 | 暂停 + 发通知 + 等待 | 确认后执行 |
| **紧急** | TVL 暴跌 / 三明治攻击 | 立即撤 LP + 通知 | 事后恢复 |

### 8.4 通知渠道

```python
class NotificationRouter:
    """人机通知——多通道冗余"""

    channels = [
        TelegramNotifier(bot_token="...", chat_id="..."),
        DiscordNotifier(webhook_url="..."),
        # Email 预留
    ]

    async def alert(self, level: str, message: str, data: dict):
        """
        level: info / warn / critical
        - info:     仅 Telegram
        - warn:     Telegram + Discord
        - critical: 全通道 + 重试 3 次
        """
        for channel in self.channels:
            if channel.accepts(level):
                await channel.send(level, message, data)
```

**通知场景**：

| 场景 | 级别 | 内容 |
|------|------|------|
| 心跳正常 | — | 不通知（仅审计日志） |
| 再平衡执行 | info | 金额 + tx_hash |
| 日预算 > 80% | warn | 剩余额度 + 建议 |
| 三明治攻击检测 | warn | 攻击者地址 + 损失估算 |
| 紧急撤 LP | critical | 原因 + 撤出金额 + 后续建议 |
| 策略切换请求 | warn | 新旧策略对比 + 等待确认 |
| TVL 熔断 | critical | 当前 TVL + 触发阈值 |

### 8.5 操作日志（人可读）

```
[2026-03-13 14:30:00] 🟢 MM-HB #4521  pGVT-USDT  NOOP  price=$0.00500  reserves=$52/$51
[2026-03-13 14:30:30] 🟢 MM-HB #4522  pGVT-USDT  NOOP  price=$0.00500  reserves=$52/$51
[2026-03-13 14:31:00] 🟡 MM-HB #4523  pGVT-USDT  REBALANCE  偏移4.8%  swap $3.20  tx=0xab12...
[2026-03-13 14:31:30] 🟢 MM-HB #4524  pGVT-USDT  NOOP  price=$0.00498  reserves=$51/$52
[2026-03-13 15:00:00] 🔴 MM-HB #4580  pGVT-USDT  EMERGENCY  三明治检测  撤LP $48.50  tx=0xcd34...
[2026-03-13 15:00:01] ⚠️  CRITICAL: 紧急撤流动性 — 等待人工确认恢复
```

---

## §9 文件结构与实施路线图

### 9.1 文件结构

> **v1.2 更新**：curate/dataset 模块已拆分——计算逻辑合入 scan 或迁移至 WQ-YI，
> 步骤入口保留为 stub。`modules/curate/` 和 `modules/dataset/` 目录已移除。

```
AGV/
├── .gemini/skills/agv-market-maker/     ← S5 Skill 根目录
│   │
│   ├── DESIGN.md                         ← 本文档（唯一设计真相源）
│   │
│   ├── scripts/                          ← 核心脚本
│   │   ├── skill_market_maker.py         ← 主入口 + 配置中枢（ExecutorConfig/PreauthConfig/MMRules/BudgetTracker）
│   │   │                                    + 双 Pipeline 描述 + run_mm/arb_campaign + CLI
│   │   ├── toolloop_mm.py                ← 共享执行层 + MM心跳
│   │   │   ├── DexExecutor               ←   统一 DEX 接口
│   │   │   ├── PancakeV2Adapter          ←   PancakeSwap V2 适配（BSC Mainnet）
│   │   │   ├── SlippageGuard             ←   Layer 1 滑点硬顶 2%
│   │   │   ├── MEVGuard                  ←   Layer 2 MEV 防御
│   │   │   ├── TVLBreaker + TVLState     ←   Layer 3 TVL 熔断三态
│   │   │   ├── ApproveManager            ←   Token approve（需求×2，禁止 MAX_UINT256）
│   │   │   ├── NotifyRouter              ←   通知路由（CRITICAL→双通道）
│   │   │   ├── MMState                   ←   6 态状态机
│   │   │   ├── PoolSnapshot              ←   链上池快照
│   │   │   ├── HeartbeatDecision         ←   确定性决策
│   │   │   ├── MempoolMonitor            ←   Mempool 监控
│   │   │   └── MMHeartbeatLoop           ←   心跳主循环
│   │   ├── toolloop_arb.py               ← Arb-Campaign 5步管线
│   │   │   ├── RETREAT_LEVELS            ←   三级回退（A:execute / B:curate / C:scan）
│   │   │   ├── SignalRef / StrategyRef   ←   轻量级资产传递
│   │   │   ├── DiagnosisProfile          ←   诊断配置
│   │   │   ├── ArbCampaignLoop           ←   5步循环
│   │   │   ├── _step_curate()  [STUB]    ←   等待 brain-curate-knowledge
│   │   │   └── _step_dataset() [STUB]    ←   等待 brain-dataset-explorer
│   │   └── toolloop_scan.py              ← ScanLoop（scan 循环调度 + 原 curate 计算）
│   │       ├── _compute_indicators()     ←   指标计算（RSI/VWAP/Bollinger/OBV/MACD）[原 curate]
│   │       ├── _detect_amm_patterns()    ←   AMM 模式识别 [原 curate]
│   │       └── _analyze_cross_pool()     ←   跨池分析 [原 curate]
│   │
│   ├── modules/
│   │   └── scan/                          ← 数据源层（唯一保留的子模块）
│   │       ├── scripts/
│   │       │   └── skill_scan.py          ← GeckoTerminalClient + MoralisClient + DataFusion
│   │       │                                 + ScanSkill + SignalBus [+ 原 curate skill 逻辑]
│   │       ├── knowledge/
│   │       │   └── scan_sources.yml       ← 数据源配置
│   │       └── tests/
│   │           └── test_scan.py           ← scan 模块测试
│   │
│   ├── knowledge/                         ← 知识文件（零 Python 依赖）
│   │   ├── mm_rules.yml                   ← 护盘规则（价格偏移/鲸鱼/再平衡/心跳/日限）
│   │   ├── arb_factors.yml                ← 套利因子主文件（5 组因子 + 3 种策略）
│   │   ├── mev_patterns.yml               ← MEV 攻击模式库
│   │   └── safety_thresholds.yml          ← 安全阈值（3 层护甲 + 执行器 + 预授权）
│   │
│   ├── test/                              ← 集成测试
│   │   ├── test_arb_pipeline.py           ← Arb 管线结构
│   │   ├── test_data_fusion.py            ← 双源融合
│   │   ├── test_mm_rules.py               ← MM 规则 YAML 校验
│   │   ├── test_slippage_guard.py         ← 滑点控制
│   │   └── test_tvl_breaker.py            ← TVL 熔断
│   │
│   └── SKILL.md                           ← Prompt 模板（预留）
│
│   # ─── 以下目录已移除（v1.2）───
│   # modules/curate/  → 计算合入 scan，知识迁移至 WQ-YI curate
│   # modules/dataset/ → Python 逻辑迁移至 WQ-YI dataset，知识保留在顶层
```

**WQ-YI 迁移目标（跨仓）**：

```
WQ-YI/
├── .gemini/skills/brain-curate-knowledge/
│   └── knowledge/
│       └── amm_operators.yml              ← 原 curate/knowledge/standard_operators.yml（AMM 算子库）
│
├── .gemini/skills/brain-dataset-explorer/
│   ├── scripts/
│   │   ├── toolloop_arb_l1.py             ← 原 dataset/toolloop_signal_scorer.py（因子组推荐）
│   │   └── toolloop_arb_l2.py             ← 原 dataset/toolloop_trade_planner.py + risk_sizer.py（指标绑定）
│   └── knowledge/
│       └── arb_factors.yml                ← 原 dataset/knowledge/arb_factors.yml（因子池定义）
```

**文件行数**（v1.2 时点）：

| 文件 | 行数 | 职责 |
|------|------|------|
| `skill_market_maker.py` | 435 | 配置中枢 + 编排入口 |
| `toolloop_mm.py` | 564 | 共享执行层 + MM 心跳 |
| `toolloop_arb.py` | ~375 | Arb 5步管线（curate/dataset 为 stub） |
| `toolloop_scan.py` | ~750 | ScanLoop + 原 curate 计算（indicators/AMM/cross-pool） |
| `modules/scan/skill_scan.py` | ~700 | 双源数据客户端 + 融合 + 原 curate skill 逻辑 |
| **AGV 合计** | ~2824 | — |
| **WQ-YI 迁移** | ~740 | toolloop_arb_l1 + toolloop_arb_l2 + amm_operators + arb_factors |

### 9.2 实施路线图

> **v1.2 更新**：curate/dataset 模块拆分完成，scan 扩充完成，WQ-YI 迁移完成。

```
Phase 0: 基础设施 ✅      Phase 1: 护盘上线 ✅/⏳     Phase 2: 套利引擎 ✅/⏳
                                                     
├── DexExecutor L2  ✅    ├── MM-Campaign 心跳  ✅     ├── GeckoTerminal 接入 ✅
│   ├── PancakeV2    ✅   │   ├── 确定性规则引擎 ✅    │   ├── OHLCV + trades  ✅
│   ├── approve_mgr  ✅   │   ├── 心跳状态机     ✅    │   ├── trending + pool  ✅
│   └── safety guards ✅  │   ├── 异常检测       ✅    │   └── 速率控制+缓存   ✅
│                         │   └── audit/evidence  ⏳   │
├── Moralis 接入     ✅   ├── MEV 防御                 ├── Arb-Campaign 5步
│   ├── transfers    ✅   │   ├── mempool monitor ⏳   │   ├── scan (ScanSkill) ✅
│   ├── LP events    ✅   │   ├── 48Club 私有RPC  ⏳   │   ├── curate (STUB)    ⏳ → brain-curate-knowledge
│   └── holders      ✅   │   └── tx splitting    ⏳   │   ├── dataset (STUB)   ⏳ → brain-dataset-explorer
│                         │                           │   ├── execute+preflight ✅
├── nexrur 集成            ├── 通知系统                 │   └── fix (3级回退)    ✅
│   ├── PipelineDesc  ⏳  │   ├── Telegram Bot    ⏳   │
│   ├── CampaignCfg   ⏳  │   └── Discord Webhook ⏳   ├── 因子引擎 (→ WQ-YI)
│   └── outcome codes ✅  │                           │   ├── L1 scorer → WQ-YI ✅ (toolloop_arb_l1.py)
│                         ├── 预授权体系          ✅   │   ├── L2 planner → WQ-YI ✅ (toolloop_arb_l2.py)
├── 测试框架          ✅  │   ├── PreauthConfig   ✅   │   └── arb_factors → WQ-YI ✅
│   ├── 84→38 tests  ✅   │   └── 三档授权        ✅   │
│   └── mock layer   ✅   │                           ├── curate→scan 合并     ✅
│                         ├── 集成测试                 │   ├── indicators        ✅
├── v1.2 架构重构     ✅  │   └── testnet 全流程  ⏳   │   ├── AMM patterns      ✅
│   ├── curate→scan  ✅   │                           │   └── cross-pool        ✅
│   ├── dataset→WQ-YI ✅  └── BSC mainnet 上线    ⏳   │
│   └── stub 化      ✅       (最小预算)              ├── LLM 校准接入        ⏳
│                                                     │   └── 4h 定期校准     ⏳
│                                                     │
│                                                     ├── 诊断引擎
│                                                     │   └── 三级回退         ✅
│                                                     │
│                                                     └── Phase 2 上线
│                                                          (需 TVL 增长)
```

**实施进度摘要（v1.2）**：

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 数据源层 (scan) | ✅ 95% | GeckoTerminal + Moralis + DataFusion + SignalBus + 原 curate 计算合入 |
| 共享执行层 | ✅ 85% | DexExecutor + 三层安全 + Approve，链上交互方法为 stub |
| MM-Campaign | ✅ 80% | 心跳状态机 + 确定性规则 + 三档频率，缺 mempool 真实扫描和通知真实发送 |
| Arb-Campaign | ✅ 60% | 5 步管线 + 回退 + pre_flight，curate/dataset 步骤已 stub 化 |
| 配置中枢 | ✅ 90% | ExecutorConfig + PreauthConfig + MMRules + BudgetTracker，全部 from_yaml |
| nexrur 底座 | ⏳ 10% | policy.yml 码定义完成，PipelineDescriptor/CampaignConfig 未接入 |
| 通知系统 | ⏳ 20% | 路由逻辑完成，Telegram/Discord 真实发送为 stub |
| WQ-YI 迁移 | ✅ 100% | L1/L2 toolloop + amm_operators + arb_factors 已迁移 |
| 测试 | ✅ 调整中 | curate(42)+dataset(31) 测试随模块删除；剩余 scan+集成测试 |

### 9.3 Phase 依赖关系

| 依赖 | 满足条件 | 影响 |
|------|---------|------|
| nexrur L0/L1 稳定 | nexrur 仓库发布 v0.1.0 | 所有 Phase |
| BSC 私有 RPC 接入 | 48Club 或 BloXroute 申请通过 | Phase 1 MEV 防御 |
| LP TVL 增长 | pGVT 或 sGVT 池 TVL > $1000 | Phase 2 Arb |
| GeckoTerminal Pro | 免费额度不够 / 需要 WebSocket | Phase 2 实时信号 |
| 因子引擎验证 | 至少 3 个因子在 BSC DEX 上回测有效 | Phase 2 Arb |

### 9.4 测试策略

| 层级 | 方法 | 覆盖 |
|------|------|------|
| **单元测试** | pytest + mock | 规则引擎、滑点计算、熔断逻辑 |
| **集成测试** | Fork BSC mainnet (`foundry fork`) | DexExecutor ↔ PancakeSwap 真实交互 |
| **模拟测试** | mock data feed + mock executor | 全流程无资金测试 |
| **Testnet** | BSC Testnet（PancakeSwap 有测试网） | Phase 1 上线前必过 |
| **Mainnet 沙盒** | 极小额 ($1-$5) 真实交易 | Phase 1 最终验证 |

---

## §10 风险评估与清醒认知

### 10.1 现实约束

> **必须清醒认识到的事实**：

| 约束 | 现状 | 影响 |
|------|------|------|
| **LP TVL** | ~$100 | 无法做有意义的套利，仅够被动护盘 |
| **日交易量** | 接近零 | 无套利机会，MM-Campaign 大部分时间 NOOP |
| **BSC MEV** | 48Club 垄断 | 私有 RPC 准入不确定 |
| **价格** | pGVT $0.005 / sGVT $0.50 | 极低价格 → 极小金额 → gas 可能 > 利润 |
| **团队** | AI Agent 为主 | 无 7×24 人工盯盘能力 |

### 10.2 风险矩阵

| 编号 | 等级 | 风险 | 缓解措施 | 残余风险 |
|------|------|------|---------|---------|
| R1 | **P0** | 智能合约漏洞导致资金损失 | DexExecutor 审计 + 极小额启动 + approve 不用 MAX_UINT | 合约升级或 DEX 被黑 |
| R2 | **P0** | 私钥泄露 | 独立热钱包 + 最小余额 + 多签预留 | 服务器入侵 |
| R3 | **P1** | Gas 消耗 > 收益 | 日 gas 预算硬顶 $5 + NOOP 优先 | BSC gas 暴涨 |
| R4 | **P1** | MEV 攻击（三明治） | 私有 RPC + 拆分 + 检测 | 新型 MEV 向量 |
| R5 | **P1** | 策略误判导致亏损 | 日亏损上限 $50 + 三级回退 + 人工审批 | 市场黑天鹅 |
| R6 | **P2** | GeckoTerminal API 变更 | 适配层隔离 + Moralis 兜底 | 两源同时断流 |
| R7 | **P2** | 价格计算精度损失 | uint256 全量 + 延迟除法 | AMM 公式极端 |
| R8 | **P2** | 网络延迟导致信号过期 | 信号有效期 2min + 过期自动丢弃 | BSC 网络拥堵 |

### 10.3 "不做什么"清单

| 编号 | 决策 | 原因 |
|------|------|------|
| N1 | **不做高频交易** | BSC 3s 出块，且低 TVL 无利可图 |
| N2 | **不做跨链套利** | 复杂度过高，桥接风险 |
| N3 | **不做借贷杠杆** | 仅有 $100 级别资金，加杠杆无意义 |
| N4 | **不做 MEX/Bot 竞赛** | 无法与专业 MEV bot 竞争 |
| N5 | **不依赖 LLM 实时决策** | 延迟太高（秒级 vs 毫秒级），仅定期校准 |
| N6 | **不追求利润最大化** | Phase 1 目标是"池子不死"，不是"赚钱" |
| N7 | **不在无深度池中交易** | TVL < $30 → 熔断，不尝试 |

### 10.4 成功标准

| Phase | 指标 | 目标 |
|-------|------|------|
| **Phase 1** | LP 存活天数 | > 30 天无人工干预 |
| **Phase 1** | 日均 gas 消耗 | < $1 |
| **Phase 1** | 紧急撤退次数 | < 3 次/月 |
| **Phase 1** | 误报率（假三明治） | < 10% |
| **Phase 2** | Arb 成功率 | > 60%（扣 gas 后净正） |
| **Phase 2** | 日均 PnL | > $0（不亏即可） |
| **Phase 2** | 因子有效覆盖率 | > 3 个因子有显著信号 |

### 10.5 退出策略

**如果 S5 证明不可行**：

1. **优雅退出**：撤出全部 LP → 关闭 MM-Campaign → 保留审计日志
2. **经验迁移**：DexExecutor 可复用给其他链上操作（如 submit pipeline）
3. **数据资产**：GeckoTerminal + Moralis 客户端可复用给 S8 KOL 的链上数据分析
4. **底座投资不浪费**：nexrur 集成代码（PipelineDescriptor、CampaignConfig）是通用的

---

## 附录 A: 关键合约地址

| 名称 | 地址 | 用途 |
|------|------|------|
| PancakeSwap V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | swap / addLiquidity / removeLiquidity |
| PancakeSwap V2 Factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | getPair / createPair |
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` | 基础报价资产 |
| pGVT | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` | AGV 预售代币 |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` | AGV 机构凭证 |
| pGVT-USDT LP | `0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0` | 主护盘目标 |
| sGVT-USDT LP | `0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d` | 次护盘目标 |

## 附录 B: 数据源 API 端点

### GeckoTerminal

| 端点 | 用途 | 频率限制 |
|------|------|---------|
| `GET /networks/bsc/pools/{address}/ohlcv/{timeframe}` | K 线 | 30/min |
| `GET /networks/bsc/pools/{address}/trades` | 最新交易 | 30/min |
| `GET /networks/bsc/pools/{address}` | 池信息 | 30/min |
| `GET /networks/bsc/trending_pools` | 趋势池 | 30/min |
| `GET /networks/bsc/tokens/multi/{addresses}` | 批量价格 | 30/min |

### Moralis

| 端点 | 用途 | 频率限制 |
|------|------|---------|
| `GET /erc20/{address}/transfers` | 代币转账 | 依 plan |
| `GET /erc20/{address}/owners` | 持仓分布 | 依 plan |
| `GET /{pair_address}/events` | LP 事件 | 依 plan |
| `GET /erc20/{address}/price` | 价格 | 依 plan |
