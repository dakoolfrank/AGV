# DESIGN_TEST.md — AGV S5 三层测试架构

> **版本**: v1.0 (2026-03-30)  
> **适用**: AGV S5 做市/套利系统  
> **设计目标**: 可被 WQ-YI（量化管线）和 AUDIT（审计系统）直接借鉴复用  

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [三层总览](#2-三层总览)
3. [Layer 1: pytest mock 单测](#3-layer-1-pytest-mock-单测)
4. [Layer 2: 集成测试（python 直接运行）](#4-layer-2-集成测试python-直接运行)
5. [Layer 3: CLI / Campaign 编排](#5-layer-3-cli--campaign-编排)
6. [三执行模式](#6-三执行模式simulatedryrunlive)
7. [命名约定与目录分隔](#7-命名约定与目录分隔)
8. [轻量测试运行器模式](#8-轻量测试运行器模式)
9. [Schema 校验集成](#9-schema-校验集成)
10. [跨仓借鉴指南](#10-跨仓借鉴指南)

---

## 1. 设计哲学

### 核心问题

AI 做市/量化系统有三种截然不同的"测试需求"：

| 需求 | 特征 | 传统 pytest 能做？ |
|------|------|:-:|
| 逻辑正确性 | 纯函数，零副作用，毫秒级 | ✅ 完美 |
| API/链上集成 | 真 HTTP、真 LLM、真 RPC，秒/分钟级 | ❌ 不适合（超时、费钱、不确定性） |
| 全链路编排 | 5 步管线串行、诊断回退、归档复活 | ❌ 不适合（运维操作，非测试） |

**一把尺子量三种东西 = 灾难。**  
把集成测试强塞进 pytest → 超时 flaky；把编排操作伪装成测试 → 概念混乱。

### 解法：按副作用分层，按目录物理隔离

```
副作用 = 0     → Layer 1: pytest，AI 自主跑
副作用 = HTTP  → Layer 2: python 脚本，人工触发
副作用 = 全链路 → Layer 3: CLI 命令，运维操作
```

**这不是"约定优于配置"，而是"隔离优于混淆"。** `pytest.ini` 的 `testpaths` 配置让 pytest 永远碰不到 Layer 2/3。

---

## 2. 三层总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 3: CLI / Campaign 编排                      │
│  python -m _shared.cli.arb_campaign --simulate --max-cycles 1       │
│  人工触发 │ 全链路 │ 诊断/回退/归档/复活                               │
├─────────────────────────────────────────────────────────────────────┤
│                    Layer 2: 集成测试                                 │
│  python test_execute_integration.py TestExecuteDryRun               │
│  人工触发 │ 真HTTP/LLM/RPC │ 命名: test/ (单数)                      │
├─────────────────────────────────────────────────────────────────────┤
│                    Layer 1: pytest mock 单测                        │
│  pytest -v  (340 tests, <3s)                                        │
│  AI自主跑 │ 全mock │ 命名: tests/ (复数)                             │
└─────────────────────────────────────────────────────────────────────┘
```

| 层级 | 测试数 | 触发方式 | 数据源 | 耗时 | AI 可跑 |
|------|:------:|---------|--------|------|:------:|
| **Layer 1** | 375+ | `pytest` | 全 mock + `tmp_path` | <3s | ✅ |
| **Layer 2** | ~20 | `python xxx.py` | 真 HTTP / LLM / RPC | 分钟级 | ❌ |
| **Layer 3** | — | CLI 命令 | 全链路 | 数十分钟 | ❌ |

---

## 3. Layer 1: pytest mock 单测

### 3.1 目录结构

```
agv-mm-arb/
├── pytest.ini                    ← testpaths = tests modules/tests
├── tests/                        ← 技能级 mock（复数 = pytest）
│   ├── conftest.py               ← sys.path 配置
│   ├── test_pancake_adapter.py   ← 39 tests: PancakeV2, ERC20, DexExecutor
│   ├── test_arb_e2e.py           ← 50+ tests: 全步骤 E2E mock
│   ├── test_slippage_guard.py    ← 5 tests: 滑点硬顶
│   ├── test_tvl_breaker.py       ← 6 tests: TVL 熔断
│   ├── test_notify.py            ← 24 tests: Telegram/Discord 路由
│   ├── test_data_fusion.py       ← 11 tests: 多源数据合并
│   ├── test_mm_rules.py          ← 7 tests: MM 规则常量
│   ├── test_arb_pipeline.py      ← 6 tests: 管线排序
│   └── test_pipeline_artifacts.py ← 9 tests: 磁盘产出物校验（从 Layer 2 迁出）
├── modules/tests/                ← 模块级 mock（复数 = pytest）
│   ├── test_collect.py           ← 57+ tests: 池发现/价格/GeckoTerminal
│   └── test_arb_collect.py       ← 82+ tests: 注册表/富化/信号质量
└── ...

_shared/tests/
└── test_p0p1_simulate.py         ← 41 tests: 底座级 4 步管线 + Schema
```

### 3.2 pytest.ini

```ini
[pytest]
testpaths = tests modules/tests
```

**关键**：`testpaths` 只包含 `tests/`（复数）和 `modules/tests/`（复数），**故意排除** `test/`（单数）和 `modules/*/test/`（单数）。这是 Layer 1 与 Layer 2 的物理边界。

### 3.3 conftest.py 模式

```python
# tests/conftest.py — sys.path 配置，无自定义 fixture
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent   # → agv-mm-arb/
sys.path.insert(0, str(ROOT_DIR))                   # agv-mm-arb/ 根
sys.path.insert(0, str(ROOT_DIR / "scripts"))       # scripts/（toolloop_*.py）
sys.path.insert(0, str(ROOT_DIR.parent / "_shared" / "engines"))  # _shared/
```

所有 Layer 1 测试使用 pytest 内建 `tmp_path` 做文件隔离，**不依赖外部状态**。

### 3.4 底座级 P0/P1 测试（`test_p0p1_simulate.py`）

Fixture 模式——所有 5 个 Ops 共用同一套 `step_kwargs`：

```python
@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    return tmp_path

@pytest.fixture
def step_kwargs(workspace, trace_id, base_config) -> dict:
    return {
        "pipeline_run_id": "pipe-test-001",
        "step_run_id": "step-test-001",
        "trace_id": trace_id,
        "assets_input": [],
        "config": base_config,
        "workspace": workspace,
    }
```

**测试节（§）编号**：

| § | 类名 | 测试数 | 验证内容 |
|---|------|:------:|----------|
| §1 | `TestSchemaInfra` | 12 | SchemaValidator 单例 + 5 步 schema 加载 |
| §2 | `TestCollectSimulate` | 3 | collect → market_signal 产出 + 3 文件 |
| §3 | `TestCurateOps` | 3 | curate → arb_strategy 骨架 + schema |
| §4 | `TestDatasetSimulate` | 7 | dataset → binding + indicators + category |
| §5 | `TestExecuteSimulate` | 6 | execute → trades + summary + schema |
| §5b | `TestExecuteDryRunDispatch` | 3 | dry_run 路由优先级 + metadata |
| §6 | `TestFixOps` | 2 | fix 存根 + minimal schema |
| §7 | `TestE2ESimulatePipeline` | 3 | 4 步端到端 + 全 schema |
| §8 | `TestRegisterOps` | 1 | register_arb_ops 注册 5 个 |

### 3.5 运行命令

```bash
# agv-mm-arb 全量（375 tests，<3s）
cd /workspaces/AGV/.gemini/skills/agv-mm-arb
python -m pytest -v

# 底座级（41 tests）
cd /workspaces/AGV/.gemini/skills/_shared
python -m pytest tests/test_p0p1_simulate.py -v

# 单文件
python -m pytest tests/test_pancake_adapter.py -v

# 单类
python -m pytest tests/test_pancake_adapter.py::TestDexExecutor -v

# 单方法
python -m pytest tests/test_pancake_adapter.py::TestDexExecutor::test_swap_success -v
```

---

## 4. Layer 2: 集成测试（python 直接运行）

### 4.1 目录结构

```
agv-mm-arb/
├── test/                                    ← 顶层集成测试（单数 = python）
│   └── test_execute_integration.py          ← 5 类: Dataset/Strategy/Simulate/DryRun/Live
├── modules/
│   ├── collect/test/
│   │   └── test_collect_integration.py      ← 7+ 类: GeckoTerminal API + 池发现
│   ├── curate/test/
│   │   └── test_curate_integration.py       ← 3+ 类: LLM 骨架提取
│   └── dataset/test/
│       └── test_dataset_integration.py      ← 3+ 类: L1+L2 字段绑定
```

### 4.2 为什么不用 pytest？

| pytest 特性 | 集成测试的问题 |
|-------------|---------------|
| 默认超时 300s | 一次 collect 扫描 72 池 = ~23 分钟 |
| `--tb=short` | 真 HTTP 错误需要完整 traceback |
| 并行 `-n auto` | GeckoTerminal API 限速 30 req/min |
| CI 自动运行 | 真 LLM 调用每次 $0.01+，CI 跑 100 次 = 浪费 |
| fixture 隔离 | 集成测试故意读写 `.docs/ai-skills/`（共享状态） |

**结论**：集成测试用 `python xxx.py` 直接运行，人工控制时机和范围。

### 4.3 运行语法

```bash
# 全部类
python test_execute_integration.py

# 单个类
python test_execute_integration.py TestExecuteDryRun

# 单个方法
python test_execute_integration.py TestExecuteDryRun.test_dry_run_writes_to_simulator_dir
```

filter 语法统一：`ClassName` 或 `ClassName.method_name`，不需要 `::` 分隔符。

### 4.4 四个集成测试文件

#### test_execute_integration.py（执行层）

**前置条件**：`dataset/output/{pair_id}/indicator_binding.yml` 已存在

| 类 | 测试数 | 前置 | 验证 |
|----|:------:|------|------|
| `TestExecuteDryRun` | 2 | .env.s5 | DryRun 执行器 → eth_call + `simulator/` |
| `TestExecuteLive` | 2 | .env.s5 + BNB | Live 执行器 → chain tx + `output/` |

> **已清理**：`TestDatasetArtifacts`(3) + `TestStrategyConstruction`(2) 是纯磁盘读+内存转换，
> 属 Layer 1，已迁至 `tests/test_pipeline_artifacts.py`。

**数据流**：
```
dataset/output/{pair}/indicator_binding.yml
  → build_strategies() → StrategyRef[]
        → ArbExecuteOps 按执行器类型派发
        ├─ DryRunDexExecutor → simulator/execution_result.yml
        └─ DexExecutor/Live  → output/execution_result.yml

* `simulate=True` 仅为旧配置兼容别名，内部仍落到 DryRunDexExecutor。
```

#### test_collect_integration.py（采集层）

**前置条件**：网络可达 GeckoTerminal API

| 类 | 验证 |
|----|------|
| `TestGeckoTerminalPoolInfo` | 池元数据端点 |
| `TestGeckoTerminalOHLCV` | K 线数据 |
| `TestGeckoTerminalTrending` | 热门池列表 |
| `TestGeckoTerminalTrades` | 最近交易 |
| `TestGeckoTerminalPoolsByVolume` | 按交易量排序池 |
| `TestArbCollectPipeline` | discover + enrich 阶段（真实 API） |
| `TestS5R1Compliance` | 产出物不含 pGVT/sGVT（S5-R1 合规） |
| `TestProductionCollect` | 全管线 → .docs/ 生产目录（含 LLM） |
| `TestCollectOpsLive` | CollectOps(simulate=False) → tmpdir |

> 注：`TestRegistryRoundtrip`（纯合成数据）和 `test_persist_creates_files`（合成 SignalPacket）已移至 Layer 1 pytest。

#### test_curate_integration.py（策略提取层）

**前置条件**：collect 产出 + WQ-YI LLM 可用

| 类 | 验证 |
|----|------|
| `TestCurateOpsBridge` | CurateOps(simulate=False) 真实 LLM 委托 WQ-YI |

> **已清理**：`TestCurateOutput`(2) 是纯磁盘读校验，已迁至 `tests/test_pipeline_artifacts.py`。

#### test_dataset_integration.py（数据绑定层）

**前置条件**：curate 产出 + BRAIN MCP 可用

| 类 | 验证 |
|----|------|
| `TestDatasetLiveBridge` | DatasetOps(simulate=False) 真实 MCP 绑定 |

> **已清理**：`TestExistingDatasetOutput`(2) 是纯磁盘读校验，已迁至 `tests/test_pipeline_artifacts.py`。

### 4.5 集成测试的链式依赖

```
test_collect_integration.py     (独立，只需网络)
        ↓ 产出 collect/pending/{pair}/
test_curate_integration.py      (依赖 collect 产出 + WQ-YI)
        ↓ 产出 curate/staged/{pair}/skeleton.yml
test_dataset_integration.py     (依赖 curate 产出 + MCP)
        ↓ 产出 dataset/output/{pair}/indicator_binding.yml
test_execute_integration.py     (依赖 dataset 产出)
    ↓ DryRun 产出 execute/simulator/；Live 产出 execute/output/
```

推荐按此顺序逐层运行。每层产出是下层的前置条件。

---

## 5. Layer 3: CLI / Campaign 编排

### 5.1 入口

```bash
cd /workspaces/AGV
python -m _shared.cli.arb_campaign [flags]
```

### 5.2 命令速查

| 命令 | 副作用 | 用途 |
|------|--------|------|
| `--status` | 只读 | 查看活跃/归档 pair 状态 |
| `--simulate` | 写 simulator/ | 默认模式，P0 mock 全管线 |
| `--simulate --max-cycles 1` | 写 simulator/ | 单轮模拟 |
| `--live-data` | 真 HTTP + 写 simulator/ | 数据真、执行假（混合模式） |
| `--live` | 真 HTTP + 链上 tx | **花钱！** 生产模式 |
| `--dry-run` | 只读 | 打印配置，不执行 |
| `--cleanup` | **删除** artifacts | 清理（保留 registry） |
| `--archive WBNB_USDT` | 物理搬目录 | 手动归档 |
| `--archive ALL` | 物理搬目录 | 全部归档 |
| `--revive WBNB_USDT` | 物理搬目录 | 复活归档 pair |
| `--revive ALL` | 物理搬目录 | 复活全部 |

### 5.3 编排栈

```
CLI main()
  → _find_asset_root()               # AGV/.docs/ai-skills/
  → _find_nexrur_workspace()          # nexrur/docs/ai-runs/
  → GeminiLLMClient.from_settings_or_none()
  → DiagnosisEngine(llm, prompts)
  → OpsRegistry + register_arb_ops()
  → OrchestratorV2(workspace, asset_root, ...)
  → CampaignRunner(profile, config, diagnosis, orchestrator)
       └── runner.run()
            → collect → curate → L1 → field_updater → L2 → evaluate → fix → submit
```

### 5.4 config 文件合并

```yaml
# arb_campaign.yml
goal:           # 最高优先级
  seed_keyword: "momentum"
  max_single_usd: 20.0
campaign:       # Campaign 参数
  max_cycles: 1
safety:         # 安全护甲
  slippage: { threshold: 0.02 }
  tvl: { floor_usd: 30 }
orchestrator:   # 底座编排
diagnosis:      # 诊断引擎
```

---

## 6. 两执行模式（DryRun/Live）+ 一个旧配置别名

### 6.1 模式对比

| 维度 | DryRun | Live |
|------|:---:|:---:|
| **实际行为** | 真实链上读取 + `eth_call` | 真实链上读取 + 广播 |
| **执行器** | `DryRunDexExecutor` | `DexExecutor` |
| **链上写入** | ❌（`eth_call`） | ✅（`send_raw_transaction`） |
| **Gas 费用** | $0 | 真实 BNB |
| **需要私钥** | ✅ | ✅ |
| **需要 RPC** | ✅ | ✅ |
| **产出目录** | `execute/simulator/` | `execute/output/` |
| **tx_hash 格式** | `dryrun-NNNN` | 真实链上 hash |
| **储备金读取** | `getReserves()` 真实 | `getReserves()` 真实 |
| **安全护甲** | SlippageGuard+MEVGuard+TVLBreaker 真实 | 同左 |

`simulate=True` 不是第三种模式，只是旧配置名，最终仍映射到 DryRun。

### 6.2 config 控制

```python
# DryRun（推荐）
config = {"dry_run": True}

# 旧配置兼容别名（内部仍走 DryRun）
config = {"simulate": True}

# Live
config = {"simulate": False}  # 或 config = {}
```

**优先级**：`dry_run=True` 与 `simulate=True` 最终都走 DryRun。是否写入 `simulator/` 或 `output/`，由执行器类型决定，不由目录名猜测。

### 6.3 DryRun 的价值

```
┌─────────────────────────────────────────────┐
│  DryRun                           Live      │
│  ████████                         █████     │
│  95% 真实                         100%      │
│  ◀────────────仅 1 步差异────────────▶      │
└─────────────────────────────────────────────┘
```

DryRun 用 Ethereum 的 `eth_call` 机制——在当前区块状态上执行交易但不提交。**除了最后的 `send_raw_transaction` 替换为 `eth_call`，其余代码路径与 Live 完全一致**。

---

## 7. 命名约定与目录分隔

### 7.1 核心规则

| 目录名 | 语法 | 含义 | pytest 可见 |
|--------|------|------|:---:|
| `tests/`（**复数**） | pytest | Layer 1 mock 单测 | ✅ |
| `modules/tests/`（**复数**） | pytest | Layer 1 模块级 mock | ✅ |
| `test/`（**单数**） | python 直接运行 | Layer 2 集成测试 | ❌ |
| `modules/*/test/`（**单数**） | python 直接运行 | Layer 2 模块级集成 | ❌ |
| `cli/` | `python -m` | Layer 3 编排 | ❌ |

**一个字母的区别（`s`）= 完全不同的测试层级。**

`pytest.ini` 中 `testpaths = tests modules/tests` 确保了物理隔离——pytest 永远不会碰到 `test/` 目录。

### 7.2 为什么不用 pytest marker？

```python
# ❌ 方案 B: 用 marker 隔离
@pytest.mark.integration
def test_live_collect():
    ...  # pytest 仍会收集此文件，即使不运行
```

问题：
1. **pytest 收集阶段可能触发副作用**（import 时执行全局代码）
2. **CI 中需要 `--ignore` 或 `-m "not integration"`**——容易遗漏
3. **新人看到 `test_` 开头的文件 = 默认认为跑 pytest**——误操作

**目录分隔 = 零配置、零歧义、零意外。**

---

## 8. 轻量测试运行器模式

### 8.1 设计

Layer 2 集成测试使用自建轻量运行器替代 pytest。核心代码 ~30 行：

```python
class SkipTest(Exception):
    """跳过测试（前置条件不满足）"""

def _run_all(*classes, filter_name: str | None = None) -> int:
    """
    轻量测试运行器。
    
    filter_name 语法:
      - None          → 运行全部
      - "ClassName"   → 运行单个类
      - "ClassName.method_name" → 运行单个方法
    """
    passed = failed = skipped = 0
    for cls in classes:
        # 类级过滤
        if filter_name and "." not in filter_name and cls.__name__ != filter_name:
            continue
        try:
            obj = cls()           # __init__ 中检查前置条件
        except SkipTest as e:
            # 前置条件不满足 → 跳过整个类
            skipped += count_test_methods(cls)
            continue
            
        for method_name in sorted(dir(cls)):
            if not method_name.startswith("test_"):
                continue
            # 方法级过滤
            if filter_name and "." in filter_name:
                target = filter_name.split(".", 1)[1]
                if method_name != target:
                    continue
            try:
                getattr(obj, method_name)()
                passed += 1
            except SkipTest:
                skipped += 1
            except Exception:
                failed += 1
                traceback.print_exc()
    
    print(f"\n{'='*60}")
    print(f"Passed: {passed}  Failed: {failed}  Skipped: {skipped}")
    return 1 if failed else 0
```

### 8.2 入口模式

```python
if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(_run_all(
        TestDatasetArtifacts,      # 前置验证
        TestStrategyConstruction,  # 策略构建
        TestExecuteSimulate,       # P0 mock
        TestExecuteDryRun,         # eth_call 仿真
        TestExecuteLive,           # 真实链上
        filter_name=filt,
    ))
```

**类的顺序 = 执行顺序 = 依赖顺序。** 排在前面的是后面的前置条件。

> ⚠️ **注意**：此处只应列出真正需要外部资源（HTTP/LLM/RPC）的 Layer 2 类。
> 纯磁盘/内存测试即使依赖管线产出物，也属于 Layer 1（`@pytest.mark.skipif` 控制跳过）。

### 8.3 SkipTest 前置检查模式

```python
class TestExecuteLive:
    """Live 模式 — 需要 .env.s5 + BNB 余额"""
    
    def __init__(self):
        if not (AGV_ROOT / ".env.s5").exists():
            raise SkipTest("No .env.s5 found — skip live tests")
        if not DATASET_OUTPUT.exists():
            raise SkipTest(f"No dataset output at {DATASET_OUTPUT}")
```

`__init__` 中检查前置条件，不满足则 `raise SkipTest`——**整个类的所有方法被跳过**，避免级联失败。

### 8.4 对比 pytest

| 特性 | _run_all | pytest |
|------|----------|--------|
| 执行顺序 | **确定性**（参数顺序） | 不确定（按文件/类名排序） |
| 前置条件 | `__init__ + SkipTest` | `@pytest.fixture + skip` |
| 超时控制 | 无限制（集成测试可能很慢） | 默认 300s |
| 输出格式 | 简洁（PASS/FAIL/SKIP 三行） | 丰富（但可能过长） |
| 过滤语法 | `Class.method`（点分隔） | `File::Class::method`（双冒号） |
| 依赖安装 | 零（纯标准库） | 需要 pytest |

---

## 9. Schema 校验集成

### 9.1 架构

```
_shared/schemas/
├── collect.yaml        ← collect 步骤产出 schema
├── curate.yaml         ← curate 步骤产出 schema
├── dataset.yaml        ← dataset 步骤产出 schema
├── execute.yaml        ← execute 步骤产出 schema
└── fix.yaml            ← fix 步骤产出 schema

_shared/engines/_bootstrap_schema.py
├── get_agv_validator()         ← SchemaValidator 单例
└── validate_step_output(step, data)  ← 便捷校验
```

### 9.2 在测试中使用

```python
from _shared.engines._bootstrap_schema import validate_step_output

# Layer 1: mock 测试中校验产出格式
data = yaml.safe_load((exec_dir / "execution_result.yml").read_text("utf-8"))
report = validate_step_output("execute", data)
assert report["valid"], f"Schema errors: {report['errors']}"

# Layer 2: 集成测试中同样校验
data = yaml.safe_load(real_output.read_text("utf-8"))
report = validate_step_output("execute", data)
assert report["valid"]
```

**Layer 1 和 Layer 2 使用同一套 schema**——mock 产出的格式与真实产出的格式必须一致。

---

## 10. 跨仓借鉴指南

### 10.1 WQ-YI 如何复用此架构

WQ-YI 已有 `_shared/tests/`（1495 个 pytest），对应 Layer 1。缺少的是：

| 层级 | WQ-YI 现状 | 借鉴 AGV 后 |
|------|-----------|------------|
| Layer 1 | ✅ 1495 tests | 不变 |
| Layer 2 | ⚠️ 散落在各 skill 的 `test/` | 统一 `_run_all` 运行器 + SkipTest 模式 |
| Layer 3 | ✅ `alphas_campaign` CLI | 不变（已有 --explore/--cleanup/--revive） |

**迁移步骤**：
1. 确认 `pytest.ini` 的 `testpaths` 排除 `test/`（单数）目录
2. 各 skill 的 `test/` 目录集成测试统一采用 `_run_all` 运行器
3. 添加 `SkipTest` 前置检查（MCP 可达？LLM 可用？）

### 10.2 AUDIT 如何复用此架构

AUDIT 项目以 Python 脚本 + Markdown 为主，测试需求不同：

| 层级 | AUDIT 应用 |
|------|-----------|
| Layer 1 | 数据清洗函数单测（CSV 解析、金额格式化、摘要分类） |
| Layer 2 | 穿透脚本集成测试（`penetrate.py` 读真实 CSV → 生成报告） |
| Layer 3 | 全量报告生成（22 份 Markdown 一键重跑） |

### 10.3 通用模板

任何项目采用此架构只需：

```
your-project/
├── pytest.ini                    # testpaths = tests (仅复数)
├── tests/                        # Layer 1: pytest mock
│   ├── conftest.py               # sys.path + fixtures
│   └── test_*.py                 # 纯 mock 测试
├── test/                         # Layer 2: python 集成
│   └── test_*_integration.py     # _run_all + SkipTest
└── cli/                          # Layer 3: 编排
    └── campaign.py               # argparse CLI
```

**核心契约**：
- `tests/`（复数）= pytest 领地，全 mock，AI 随时可跑
- `test/`（单数）= python 领地，有副作用，人工触发
- `cli/` = 运维操作，不是测试

---

## 附录: 完整命令速查

```bash
# ═══════════ Layer 1: pytest (AI 可跑) ═══════════

# AGV S5 全量 (340 tests)
cd /workspaces/AGV/.gemini/skills/agv-mm-arb && python -m pytest -v

# 底座级 (41 tests)
cd /workspaces/AGV/.gemini/skills/_shared && python -m pytest tests/test_p0p1_simulate.py -v

# 单类
python -m pytest tests/test_pancake_adapter.py::TestDexExecutor -v

# 关键字过滤
python -m pytest -k "dry_run" -v


# ═══════════ Layer 2: python (人工触发) ═══════════

# 按管线顺序（推荐）
cd modules/collect/test  && python test_collect_integration.py
cd modules/curate/test   && python test_curate_integration.py
cd modules/dataset/test  && python test_dataset_integration.py
cd test/                 && python test_execute_integration.py

# 单类
python test_execute_integration.py TestExecuteDryRun

# 单方法
python test_execute_integration.py TestExecuteDryRun.test_dry_run_writes_to_simulator_dir


# ═══════════ Layer 3: CLI (运维操作) ═══════════

cd /workspaces/AGV

# 查看状态
python -m _shared.cli.arb_campaign --status

# 单轮模拟
python -m _shared.cli.arb_campaign --simulate --max-cycles 1

# DryRun（打印配置）
python -m _shared.cli.arb_campaign --dry-run -v

# 生产
python -m _shared.cli.arb_campaign --live

# 归档/复活
python -m _shared.cli.arb_campaign --archive WBNB_USDT
python -m _shared.cli.arb_campaign --revive ALL
```
