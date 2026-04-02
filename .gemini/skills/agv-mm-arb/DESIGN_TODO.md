# DESIGN_TODO.md — S5 Arb 管线实测计划（✅ 已完成，已合并入 DESIGN.md v1.9）

> **创建日期**: 2026-03-28  
> **完成日期**: 2026-03-29  
> **状态**: ✅ 全部完成 — 内容已合并入 [DESIGN.md](DESIGN.md) §9.4  
> **目标**: 从 340 个 mock 测试 → 真实集成测试 → CLI 全链路实测  
> **前置文档**: [DESIGN.md](DESIGN.md) / [AGENTS.md](/workspaces/AGV/AGENTS.md) §S5-R

---

## 目录

1. [现状总览](#1-现状总览)
2. [已知缺陷（必须先修）](#2-已知缺陷必须先修)
3. [测试矩阵（现有 → 缺失）](#3-测试矩阵现有--缺失)
4. [实施计划（5 阶段）](#4-实施计划5-阶段)
5. [逐步验收标准](#5-逐步验收标准)
6. [运行环境与依赖](#6-运行环境与依赖)
7. [风险与注意事项](#7-风险与注意事项)

---

## 1. 现状总览

### 1.1 管线架构（4 步所有权）

```
collect → curate → dataset → execute
  AGV      WQ-YI    WQ-YI     AGV
```

| 步骤 | 所有者 | 主脚本 | 行数 | 状态 |
|------|--------|--------|------|------|
| **collect** | AGV | `toolloop_arb_collect.py` + `skill_collect.py` | 1696 + 1173 | ✅ 生产级 |
| **curate** | WQ-YI（委托） | `skill_curate_knowledge.py` (domain=defi) | 1800+ | ✅ 已对接，1.3% pass rate |
| **dataset** | WQ-YI（委托） | `toolloop_arb_l1.py` + `toolloop_arb_l2.py` | 362 + 380 | ⏳ STUB — 代码存在但未串联 |
| **execute** | AGV | `toolloop_arb.py` + `toolloop_mm.py` | 843 + 978 | ✅ 框架完整，链上交互为 stub |

### 1.2 代码规模

| 位置 | 文件 | 行数 |
|------|------|------|
| AGV `scripts/` | skill_mm_arb + toolloop_arb + toolloop_mm | 2,330 |
| AGV `modules/collect/scripts/` | toolloop_arb_collect + skill_collect + toolloop_mm_collect | 2,869 |
| AGV **合计** | 8 个 .py | ~5,199 |
| WQ-YI 委托 | toolloop_arb_l1 + toolloop_arb_l2 + curate(defi 部分) | ~2,542 |

### 1.3 测试现状

**340 个测试，100% mock，0 个集成测试。**（开始前）

| 文件 | 测试数 | 位置 | 覆盖 |
|------|--------|------|------|
| `test_arb_collect.py` | 118 | collect/tests/ | collect 3-phase pipeline |
| `test_collect.py` | 52 | collect/tests/ | GeckoTerminal + Moralis + DataFusion |
| `test_arb_e2e.py` | 75 | test/ | 5 步管线端到端（全 mock） |
| `test_pancake_adapter.py` | 39 | test/ | PancakeV2Adapter |
| `test_notify.py` | 24 | test/ | Telegram + Discord 通知 |
| `test_data_fusion.py` | 11 | test/ | 双源数据融合 |
| `test_mm_rules.py` | 7 | test/ | MM 规则 YAML 校验 |
| `test_arb_pipeline.py` | 6 | test/ | 管线结构 |
| `test_slippage_guard.py` | 5 | test/ | 滑点控制 |
| `test_tvl_breaker.py` | 6 | test/ | TVL 熔断 |
| `test_agv_shared.py` | 109 | _shared/tests/ | 底座 AGV 扩展 |
| `test_clients_cli.py` | 40 | _shared/tests/ | CLI 客户端 |
| `test_p0p1_simulate.py` | 34 | _shared/tests/ | P0/P1 模拟 |
| **合计** | **526** | | **0 个 `@pytest.mark.integration`** |

### 1.4 Collect 数据清单

| 状态 | pair 数 | 说明 |
|------|---------|------|
| **pending** | 18 | 活跃池（WBNB_USDT ×8, ETH_USDT ×2, 其他 ×8） |
| **archived** | 60 | 已穷尽/中断 |
| **合计** | 78 | — |

> 数据路径: `/workspaces/AGV/.docs/ai-skills/collect/`

### 1.5 CLI 运行模式

```bash
# 三种模式
python -m _shared.cli.arb_campaign --simulate      # 默认: 全 mock
python -m _shared.cli.arb_campaign --live-data      # API 真实，execute 模拟
python -m _shared.cli.arb_campaign --live           # 全真实（链上交易）
```

配置文件: `_shared/cli/arb_campaign.yml`（调试期参数: 10 cycles, $100/day, $20/trade）

---

## 2. 已知缺陷（必须先修）

### BUG-1: S5-R1 违规 — POOL_TOKEN_MAP 包含自家池

**文件**: `scripts/toolloop_arb.py` 第 59-68 行

```python
# ❌ 违反 S5-R1: Arb 代码禁止出现 pGVT/sGVT 池地址
POOL_TOKEN_MAP = {
    "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0": {  # pGVT_USDT
        "base": "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",  # pGVT
        ...
    },
    "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d": {  # sGVT_USDT
        "base": "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3",  # sGVT
        ...
    },
}
```

**修复**: 删除 pGVT/sGVT 条目，替换为外部池（WBNB_USDT, CAKE_BNB 等）或改为动态加载 collect 产出。

**影响范围**: `_resolve_pool_info()` 函数依赖此 MAP，修改后需更新关联的 test_arb_e2e.py 中的 mock。

### BUG-2: Curate 通过率极低（1.3%）

**现象**: 78 个 collect 产出 → 仅 ~1 个通过 curate。

**可能原因**:
- KnowledgeBaseSkill 的 `domain="defi"` 门槛对 DEX pair 过于严格
- collect 产出的 `idea_packet.yml` 格式不满足 curate 预期
- curate 的 `preflight_review` prompt 未针对 DeFi DEX 场景调优

**诊断方法**: 手动运行单个 pair 的 curate，观察具体失败原因。

### BUG-3: Dataset 步骤为 STUB

**文件**: `scripts/toolloop_arb.py` → `_step_dataset()` 是占位符

**依赖**: WQ-YI 的 `toolloop_arb_l1.py` (362 行) 和 `toolloop_arb_l2.py` (380 行) 已存在，但未通过 `agent_ops_arb.py` 串联。

### BUG-4: Execute 链上交互为 STUB

**文件**: `toolloop_mm.py` → `PancakeV2Adapter` 的 `swap()` / `add_liquidity()` 方法返回 mock 结果。

**依赖**: 需要 `web3.py` + BSC RPC（公链或私有）。

---

## 3. 测试矩阵（现有 → 缺失）

### 3.1 按步骤

| 步骤 | 单元测试 (mock) | 集成测试 (live API) | E2E 测试 (CLI) |
|------|:-:|:-:|:-:|
| **collect** | ✅ 170 个 | ❌ 缺失 | ❌ 缺失 |
| **curate** | ❌ 0 个 (WQ-YI 无 DeFi 测试) | ❌ 缺失 | ❌ 缺失 |
| **dataset** | ❌ 0 个 (WQ-YI 无 DeFi 测试) | ❌ 缺失 | ❌ 缺失 |
| **execute** | ✅ 130 个 | ❌ 缺失 | ❌ 缺失 |
| **full pipeline** | ✅ 34 个 (simulate) | ❌ 缺失 | ❌ 缺失 |

### 3.2 按测试类型（需新建）

| 测试类型 | 文件名 | 测试对象 | 外部依赖 | 标记 |
|---------|--------|---------|---------|------|
| collect 集成 | `test_collect_integration.py` | GeckoTerminal API 真实调用 | 网络 | `@pytest.mark.integration` |
| curate 集成 | `test_curate_integration.py` | KnowledgeBaseSkill + Gemini | Gemini API Key | `@pytest.mark.integration` |
| dataset 集成 | `test_dataset_integration.py` | DeFiL1Recommender + DeFiL2Binder | Gemini + MCP | `@pytest.mark.integration` |
| execute 模拟 | `test_execute_integration.py` | PancakeV2Adapter + BSC RPC (readonly) | BSC RPC | `@pytest.mark.integration` |
| CLI --live-data | `test_cli_live_data.py` | 全链路（execute 模拟） | 全部 | `@pytest.mark.e2e` |

---

## 4. 实施计划（5 阶段）

### Phase 0: 修复前置缺陷（BUG-1）

**目标**: 清理 S5-R1 违规，为实测扫清障碍。

| 任务 | 说明 | 文件 |
|------|------|------|
| 0.1 删除 POOL_TOKEN_MAP 中 pGVT/sGVT | S5-R1 强制 | `toolloop_arb.py` L59-68 |
| 0.2 更新 `_resolve_pool_info()` | 改为从 collect pending 目录动态读取 | `toolloop_arb.py` |
| 0.3 修复受影响的 mock 测试 | test_arb_e2e.py 引用了旧地址 | `test/test_arb_e2e.py` |
| 0.4 运行全量 mock 测试确认无回归 | 526 个测试必须全绿 | — |

**验收**: `pytest .gemini/skills/ -v` 全通过 + `grep -r "pGVT\|sGVT\|0x5558\|0xBE1B" scripts/toolloop_arb.py` 返回空。

### Phase 1: Collect 集成测试

**目标**: 验证 GeckoTerminal / Moralis API 真实可用，collect 能产出有效的 `idea_packet.yml`。

| 任务 | 说明 |
|------|------|
| 1.1 创建 `conftest.py` 集成测试基础设施 | `@pytest.mark.integration` 标记 + skip 无网络 |
| 1.2 编写 `test_collect_integration.py` | 真实调用 GeckoTerminal → 验证 OHLCV/trades 返回 |
| 1.3 验证 collect 3-phase 对真实数据 | discover → enrich → persist 产出 idea_packet.yml |
| 1.4 验证 DataFusion 双源合并 | GeckoTerminal + Moralis（需 API Key） |

**依赖**: 网络连接（GeckoTerminal 免费 API 无需 Key）。Moralis 需要 `MORALIS_API_KEY`。

**运行**: `pytest modules/collect/tests/test_collect_integration.py -m integration -v`

### Phase 2: Curate 集成测试 + 通过率诊断

**目标**: 找出 curate 1.3% 通过率的根因，提升到可用水平。

| 任务 | 说明 |
|------|------|
| 2.1 手动运行一个 pending pair 的 curate | 收集完整错误日志和 outcome |
| 2.2 分析 KnowledgeBaseSkill DeFi 分支的门槛 | `preflight_review` + `defi_preflight_review` prompt |
| 2.3 创建 `test_curate_integration.py` | 真实调用 Gemini API，从 pending pair 提取策略骨架 |
| 2.4 调优 curate 门槛（如需要） | 放宽 DeFi 域的准入条件 |

**依赖**: `GEMINI_API_KEY`（在 `brain_alpha/.env` 中配置）。

**关键路径**: 这是整条管线的**最大瓶颈**——如果 curate 不通过，后续 dataset/execute 无输入。

### Phase 3: Dataset 串联 + 集成测试

**目标**: 将 WQ-YI 的 DeFiL1Recommender + DeFiL2Binder 真正串入 Arb 管线。

| 任务 | 说明 |
|------|------|
| 3.1 实装 `toolloop_arb.py` 中 `_step_dataset()` | 调用 WQ-YI L1 + L2 |
| 3.2 确认 agent_ops_arb.py DatasetOps 接线 | `_load_modules()` 加载 WQ-YI 模块 |
| 3.3 创建 `test_dataset_integration.py` | 给定 curate 骨架 → L1 推荐 → L2 绑定 |
| 3.4 验证 dataset 产出格式匹配 execute 消费 | StrategyRef → execute pre_flight |

**依赖**: Gemini API + MCP Server（cnhkmcp）+ 至少 1 个通过 curate 的骨架。

### Phase 4: Execute 模拟 + CLI 全链路

**目标**: 验证 execute 能消费 dataset 产出，CLI `--live-data` 模式跑通。

| 任务 | 说明 |
|------|------|
| 4.1 创建 `test_execute_integration.py` | BSC RPC readonly 查询（池状态、价格） |
| 4.2 补全 PancakeV2Adapter 真实交互 | web3.py 连接 BSC RPC（只读+模拟） |
| 4.3 CLI `--live-data` 单 cycle 验证 | 全管线串联（execute 模拟） |
| 4.4 CLI `--live` 极小额测试 | $1 真实交易（需人工确认） |

**依赖**: BSC RPC URL（.env.s5 `BSC_PRIVATE_RPC_URL`）、做市钱包私钥。

---

## 5. 逐步验收标准

| Phase | 验收条件 | 预计产出 |
|-------|---------|---------|
| **Phase 0** | 526 mock 全绿 + S5-R1 零违规 | 干净的代码基线 |
| **Phase 1** | collect 集成测试 ≥ 5 个通过（真实 API） | `test_collect_integration.py` |
| **Phase 2** | curate 通过率 ≥ 10%（至少 2/18 pending 通过）| `test_curate_integration.py` + 诊断报告 |
| **Phase 3** | dataset L1→L2 对至少 1 个骨架产出完整绑定 | `test_dataset_integration.py` + StrategyRef |
| **Phase 4** | CLI `--live-data` 完成 1 个完整 cycle（5 步） | E2E 运行日志 + outcome.json |

---

## 6. 运行环境与依赖

### 6.1 Python 环境

```bash
# AGV 不建独立 venv，复用 WQ-YI（永久共识 2026-03-23）
source /workspaces/WQ-YI/.venv/bin/activate

# 已有依赖（web3, requests, pyyaml, pytest 等）
# 缺失依赖检查:
python -c "import web3; print(web3.__version__)"          # BSC 交互
python -c "import requests; print(requests.__version__)"  # API 调用
python -c "import yaml; print(yaml.__version__)"          # YAML 配置
```

### 6.2 环境变量

| 变量 | 文件 | Phase 需要 | 说明 |
|------|------|-----------|------|
| *(无)* | — | Phase 1 (collect GeckoTerminal) | 免费 API 无需 Key |
| `MORALIS_API_KEY` | `.env.s5` | Phase 1 (Moralis) | DataFusion 双源 |
| `GEMINI_API_KEY` | `brain_alpha/.env` | Phase 2-3 | Curate + Dataset LLM |
| `BSC_PRIVATE_RPC_URL` | `.env.s5` | Phase 4 | 链上查询/交易 |
| `MM_PRIVATE_KEY` | `.env.s5` | Phase 4 (--live) | 做市钱包 |
| `TELEGRAM_BOT_TOKEN` | `.env.s5` | Phase 4 | 告警通知 |

### 6.3 测试命令速查

```bash
# 全量 mock（不需要任何外部依赖）
cd /workspaces/AGV
python -m pytest .gemini/skills/ -v --tb=short

# 仅 S5 mock
python -m pytest .gemini/skills/agv-mm-arb/ .gemini/skills/_shared/tests/test_agv_shared.py -v

# 集成测试（需要网络/API Key）
python -m pytest .gemini/skills/agv-mm-arb/ -m integration -v

# 单步 collect 集成
python -m pytest .gemini/skills/agv-mm-arb/modules/collect/tests/test_collect_integration.py -v

# CLI 模拟
python -m _shared.cli.arb_campaign --simulate --dry-run

# CLI 真实数据
python -m _shared.cli.arb_campaign --live-data
```

---

## 7. 风险与注意事项

### 7.1 S5-R 规则（永久共识，不可违反）

| 规则 | 内容 |
|------|------|
| **S5-R1** | AGV 不持有 `toolloop_arb_l1.py` / `toolloop_arb_l2.py` 副本 |
| **S5-R2** | curate 委托 WQ-YI `KnowledgeBaseSkill(domain="defi")`，失败 → fail-fast |
| **S5-R3** | dataset 委托 WQ-YI `DeFiL1Recommender` + `DeFiL2Binder`，不可用 → RuntimeError |
| **S5-R4** | DeFi knowledge 文件只在 WQ-YI，AGV 不复制 |

### 7.2 最大瓶颈：Curate 通过率

当前 1.3% 通过率意味着 **78 个 pair 仅 ~1 个能往下走**。如果 Phase 2 无法提升通过率到 ≥ 10%，后续 Phase 3/4 没有输入数据。

**备选方案**: 如果 curate DeFi 门槛确实过严，可考虑：
- 调低 `defi_preflight_review` prompt 的门槛
- 增加 mock curate 模式（绕过 LLM，输出固定骨架用于 Phase 3/4 调试）
- 手动构造 1-2 个合格骨架，先跑通 dataset → execute

### 7.3 资金安全

- Phase 4 `--live` 模式涉及真实链上交易，**必须人工确认后执行**
- `MM_PRIVATE_KEY` 必须是独立钱包，**不得与 Deployer (`0xAC38...`) 共用**
- 初始测试金额 ≤ $5，日限额 $25（arb_campaign.yml `safety.daily_max_loss_usd`）

### 7.4 WQ-YI 依赖风险

curate + dataset 委托 WQ-YI 模块。如果 WQ-YI 正在重构这些模块，可能导致 AGV 管线中断。

**缓解**: 测试前先确认 WQ-YI 相关文件未被大幅修改：
```bash
git -C /workspaces/WQ-YI log --oneline -5 -- .gemini/skills/brain-curate-knowledge/scripts/skill_curate_knowledge.py
git -C /workspaces/WQ-YI log --oneline -5 -- .gemini/skills/brain-dataset-explorer/scripts/toolloop_arb_l1.py
```

---

## 进度追踪

| Phase | 状态 | 开始 | 完成 | 备注 |
|-------|------|------|------|------|
| **Phase 0** | ✅ 完成 | 2026-03-28 | 2026-03-28 | S5-R1 修复 — POOL_TOKEN_MAP 清除 pGVT/sGVT |
| **Phase 1** | ✅ 完成 | 2026-03-28 | 2026-03-29 | Collect 集成测试 — 1 passed (72 discovered, 48 persisted, ~23min) |
| **Phase 2** | ✅ 完成 | 2026-03-29 | 2026-03-30 | Curate 集成测试 — 6 passed / 0 skipped（signal_strength + cache 修复） |
| **Phase 3** | ✅ 完成 | 2026-03-29 | 2026-03-29 | Dataset 串联 + 集成测试 — 4 passed / 2 skipped |
| **Phase 4** | ✅ 完成 | 2026-03-29 | 2026-03-29 | Execute 集成测试 — 8 passed / 1 skipped；CLI --simulate --dry-run 通过 |

### 本轮修复

| 问题 | 修复 |
|------|------|
| `test/test_execute_integration.py` `_resolve_pool_info` 使用 `SKILL_ROOT` 而非 `AGV_ROOT` | 两处替换为 `AGV_ROOT` |
| `tests/test_execute_integration.py` 同上 | 同上 |
| `modules/collect/__init__.py` 缺失导致 conftest 冲突（`tests.conftest` 重名） | 创建空 `__init__.py` |
| BUG-2: signal_strength 返回 0-100 范围，未归一化到 0-1 | `raw_strength / 100.0 if raw_strength > 1.0` in `agent_ops_arb.py` |
| BUG-2: `_pick_pending_pair()` 仅接受 `pool_info.yml` | 扩展为同时接受 `pool_info.yml` 和 `idea_packet.yml` |
| BUG-2: curate 重复导入 sys.modules 冲突 | `_curate_ops_cache` 单例模式避免重复加载 |

### 未修复遗留

| 编号 | 问题 | 严重度 | 说明 |
|------|------|--------|------|
| BUG-2 | Curate 通过率 ~1.3% | 中 | ✅ 已修复 — signal_strength 归一化 + _pick_pending_pair 扩展 + _curate_ops_cache 单例，6/6 集成测试通过 |
| BUG-4 | Execute 链上交互为 simulate stub | 低 | Phase 2 上线时实装 |
