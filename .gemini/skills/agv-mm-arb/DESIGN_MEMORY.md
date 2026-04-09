# AGV × WQ-YI Memory 联动设计

> **文档版本**: v1.0 (2026-04-09)  
> **定位**: 记录 AGV S5 做市/套利 Campaign 如何复用 nexrur 底座的 Memory 子系统，与 WQ-YI 共享跨域经验。  
> **前置阅读**: WQ-YI `_DESIGN_MEMORY.md` (MP5-MP8 原始设计) · nexrur `docs/DESIGN.md` §memory

---

## 目录

1. [设计目标](#1-设计目标)
2. [架构全景](#2-架构全景)
3. [与 WQ-YI 记忆体系的关系](#3-与-wq-yi-记忆体系的关系)
4. [三条数据通路](#4-三条数据通路)
5. [Policy 配置](#5-policy-配置)
6. [代码实现索引](#6-代码实现索引)
7. [诊断证据注入时序](#7-诊断证据注入时序)
8. [三级回退与 Tier Boost](#8-三级回退与-tier-boost)
9. [MM 与 Arb 的记忆差异](#9-mm-与-arb-的记忆差异)
10. [WQ-YI 委托路径的隐式记忆](#10-wq-yi-委托路径的隐式记忆)
11. [测试覆盖](#11-测试覆盖)
12. [未来演进](#12-未来演进)

---

## 1. 设计目标

| 编号 | 目标 | 约束 |
|:----:|------|------|
| G1 | Arb-Campaign 诊断时能读取历史失败 lessons，避免重复犯错 | 不破坏 MM 零 LLM 心跳路径 |
| G2 | Campaign 终态时蒸馏结构化经验，写入 vectorstore 供未来检索 | 每个 pair 独立蒸馏，单 pair 失败不污染其他 |
| G3 | tier-boosted 历史检索，按回退层级动态调权 | 配置驱动，不硬编码权重 |
| G4 | 与 WQ-YI 共享同一 nexrur 底座，数据格式和函数签名完全对齐 | AGV 不持有 memory 代码副本 |
| G5 | nexrur 可选依赖，缺失时优雅降级 | `_HAS_MEMORY` 全局 flag + try/except |

---

## 2. 架构全景

```
                            ┌──────────────────────────────┐
                            │   nexrur (L0/L1 底座)         │
                            │                              │
                            │  memory/pipeline.py          │
                            │    ├── RAGPipeline           │
                            │    ├── retrieve_lessons()    │  ← MP7 读
                            │    └── distill_asset_lessons()│  ← MP5 写
                            │                              │
                            │  memory/vectorstore.py       │
                            │    └── FAISS 向量存储         │
                            └─────────┬────────────────────┘
                                      │
                     ┌────────────────┼──────────────────┐
                     │                │                   │
              ┌──────▼──────┐  ┌──────▼──────┐    ┌──────▼──────┐
              │   WQ-YI     │  │   AGV S5    │    │   AUDIT     │
              │  campaign   │  │  campaign   │    │  (未来)     │
              │             │  │             │    │             │
              │ category=   │  │ category=   │    │             │
              │ "diagnosis" │  │ "defi_      │    │             │
              │             │  │  diagnosis" │    │             │
              └─────────────┘  └─────────────┘    └─────────────┘
```

**核心原则**: nexrur memory 子系统是共享底座，三个消费者通过 `category` 参数隔离命名空间。AGV 使用 `"defi_diagnosis"` 类别，WQ-YI 使用 `"diagnosis"`。

---

## 3. 与 WQ-YI 记忆体系的关系

### 3.1 WQ-YI MP5-MP8 回顾

WQ-YI `_DESIGN_MEMORY.md` 定义了 4 条 Memory Phase：

| Phase | 编号 | 功能 | 触发时机 |
|-------|------|------|----------|
| 读-经验 | **MP7** | `retrieve_lessons()` 检索历史结构化教训 | 诊断前注入证据包 |
| 读-历史 | **MP8** | `rag.retrieve()` tier-boosted 模糊检索 | 诊断前注入证据包 |
| 写-蒸馏 | **MP5** | `distill_asset_lessons()` 从终态资产提炼 | Campaign 终态时 |
| 写-索引 | **MP6** | `evidence.record()` → vectorstore 自动入库 | evidence 写入时 |

### 3.2 AGV 复用情况

| MP 编号 | AGV 状态 | 说明 |
|:-------:|:--------:|------|
| MP7 | ✅ 已接入 | `_enrich_evidence_with_memory()` → `retrieve_lessons(category="defi_diagnosis")` |
| MP8 | ✅ 已接入 | `_enrich_evidence_with_memory()` → `rag.retrieve(tier_boost=...)` |
| MP5 | ✅ 已接入 | `_distill_lessons()` → `distill_asset_lessons()` per pair |
| MP6 | ⏳ 继承自 nexrur 底座 | AGV `rag_auto_index: false`（默认关闭），需 Arb evidence 产出足量后开启 |

### 3.3 AGV 与 WQ-YI 的设计差异

| 维度 | WQ-YI | AGV | 差异原因 |
|------|-------|-----|----------|
| 导入方式 | 延迟 `from nexrur...` 内联导入 | 顶层 `try/except` + `_HAS_MEMORY` flag | AGV 模块更紧凑，顶层判断更清晰 |
| MP7 category | `"diagnosis"` | `"defi_diagnosis"` | 隔离 Alpha 量化经验 vs DeFi 做市经验 |
| MP5 粒度 | 单资产终态时 distill | Campaign 终态遍历全部 pairs | DeFi pair 不像 Alpha 有个体终态流 |
| MP8 结构 | `[{text, score, tier}]` 字典列表 | 拼接字符串 `evidence["memory_history"]` | Arb 诊断不需要细粒度 tier 元数据 |
| Policy 作用域 | `step="evaluate"` 步骤级 | `step="defaults"` 全局 | AGV 只有 Arb 一条诊断路径 |
| Tier boost 映射 | 基于 reason_code → tier | 基于 retreat_level (A/B/C) | AGV 三级回退模型更简洁 |

---

## 4. 三条数据通路

### 4.1 MP7 读路径 — 结构化 Lessons 检索

```
_handle_failure()
  → _enrich_evidence_with_memory(evidence, config)
    → retrieve_lessons(
          query = strategy_id,       # e.g. "WBNB_USDT_momentum"
          rag   = self._get_rag_pipeline(),
          top_k = policy.memory_lesson_top_k,  # default: 5
          category = "defi_diagnosis",
      )
    → evidence["memory_lessons"] = [{lesson_id, pattern, detail, confidence}]
```

**数据格式**:

```json
{
  "memory_lessons": [
    {
      "lesson_id": "lsn-2026-04-08-a3f1",
      "pattern": "WBNB_USDT 连续 3 次 slippage > 1.5% 时价格剧烈波动",
      "detail": "Flash Crash 后 pool TVL 骤降 40%，应在 TVL 恢复前暂停交易",
      "confidence": 0.85
    }
  ]
}
```

### 4.2 MP8 读路径 — Tier-Boosted 模糊历史检索

```
_enrich_evidence_with_memory(evidence, config)
  → rag.retrieve(
        query      = "diagnosis {strategy_id} retreat failure",
        top_k      = policy.memory_history_top_k,  # default: 3
        tier_boost = policy.memory_tier_boost[retreat_level],  # A:1.2 B:1.0 C:0.8
    )
  → evidence["memory_history"] = "拼接后的历史摘要文本"
```

**tier_boost 机制**: RAGPipeline.retrieve() 内部按 `metadata.tier` 对匹配分数乘以 boost 系数。A 级回退（execute 层面参数漂移）的历史最相关（1.2×），C 级回退（collect 层面结构性变化）的历史参考价值偏低（0.8×）。

### 4.3 MP5 写路径 — 终态经验蒸馏

```
campaign_finalize()
  → _archive_on_complete(all_pairs, asset_root)
    → _distill_lessons(all_pairs, asset_root)
      → for pair_id in all_pairs:
            distill_asset_lessons(
                asset_id  = pair_id,     # e.g. "WBNB_USDT"
                workspace = orch.workspace,
                rag       = self._get_rag_pipeline(),
                policy    = self._get_policy(),
            )
```

**蒸馏来源** (`distill_asset_lessons` 内部逻辑):
- `outcome.json` — 运行结果（status/reason_code）
- `diagnosis_history` — 历史诊断记录
- `structural_patterns` — 结构化模式识别
- `evidence.jsonl` — 决策证据链

**产出**: 写入 `.memory/lessons.jsonl` + vectorstore（`type="lesson", category="defi_diagnosis"`）

---

## 5. Policy 配置

位于 `_shared/core/policy.yml` 的 `defaults` 段：

```yaml
defaults:
  # ── Memory (MP7/MP8 — 对齐 WQ-YI) ──
  memory_read_enabled: true          # 总开关: MP7+MP8 读取
  memory_distill_enabled: true       # 总开关: MP5 蒸馏写入
  memory_lesson_top_k: 5            # MP7: 检索 lessons 条数
  memory_history_top_k: 3           # MP8: 检索历史条数
  memory_history_max_chars: 1500    # MP8: 单次注入最大字符数
  memory_tier_boost:                # MP8: 按回退级别的权重加成
    A: 1.2   # execute 级 — 近期经验权重高
    B: 1.0   # curate 级 — 标准权重
    C: 0.8   # collect 级 — 结构性问题，历史借鉴有限
```

**开关逻辑**:

```
_HAS_MEMORY=false?  ──────────── → 全跳过（nexrur.memory 未安装）
memory_read_enabled=false? ──── → MP7+MP8 跳过
memory_distill_enabled=false? ─ → MP5 跳过
rag=None? ─────────────────────── → MP8 跳过（MP7 仍走 lessons 文件检索）
```

---

## 6. 代码实现索引

| 文件 | 函数/段落 | 编号 | 行数 | 职责 |
|------|-----------|------|------|------|
| `campaign.py` L47-52 | 顶层 `try/except` 导入 | — | 6 | `_HAS_MEMORY` flag |
| `campaign.py` L405 | `campaign_finalize()` 尾部调用 | MP5 | 1 | 触发蒸馏 |
| `campaign.py` L418-460 | `_distill_lessons()` | MP5 | 43 | 遍历 pairs 蒸馏 |
| `campaign.py` L462-530 | `_handle_failure()` | MP7/8 | 70 | 诊断前注入记忆 |
| `campaign.py` L620-704 | `_enrich_evidence_with_memory()` | MP7+MP8 | 85 | 核心注入逻辑 |
| `campaign.py` L705-712 | `_get_policy()` | — | 8 | Policy 获取辅助 |
| `campaign.py` L714-727 | `_get_rag_pipeline()` | — | 14 | RAG 实例获取 |
| `policy.yml` L27-36 | `defaults.memory_*` | — | 10 | 配置声明 |
| `diagnosis.py` | `_format_evidence()` | — | 不改 | 自动序列化 `memory_lessons` / `memory_history` |

**未修改文件** (设计性决策):

| 文件 | 原因 |
|------|------|
| `diagnosis.py` | `_format_evidence()` 遍历 evidence dict 全部 key → `memory_lessons`/`memory_history` 自动可见于 LLM prompt |
| `toolloop_arb.py` | curate+dataset 委托 WQ-YI，WQ-YI 侧已有独立的 memory 接线 |
| `toolloop_mm.py` | MM 心跳纯确定性路径，无 LLM 诊断，不需要记忆注入 |

---

## 7. 诊断证据注入时序

```
Arb-Campaign cycle N 失败
  │
  ▼
_handle_failure(metrics, config, trace)
  │
  ├─ ① _build_evidence(metrics, config)              ← 构建基础证据
  │     {pair_id, failure_type, retreat_level, pnl, gas_cost, ...}
  │
  ├─ ② _enrich_evidence_with_memory(evidence, config) ← MP7+MP8 注入
  │     ├─ MP7: evidence["memory_lessons"] = [{pattern,detail,confidence}]
  │     └─ MP8: evidence["memory_history"] = "historical text..."
  │
  ├─ ③ self._diagnosis.diagnose(evidence, strategy_id)
  │     └─ _format_evidence() 自动序列化全部 key
  │        → LLM 可见: memory_lessons + memory_history + 基础证据
  │
  └─ ④ validate_diagnosis(diag) → halt / retreat
```

**关键**: 步骤②在③之前，确保 LLM 诊断时已拥有历史上下文。步骤②失败（任何异常）不阻断③——try/except 静默降级。

---

## 8. 三级回退与 Tier Boost

AGV 的三级回退模型直接映射到 `memory_tier_boost` 配置：

| 回退级别 | 错误类型 | 目标步骤 | Tier Boost | 含义 |
|:--------:|----------|:--------:|:----------:|------|
| **A** | `PARAM_DRIFT` / `SLIPPAGE_EXCEEDED` / `MEV_DETECTED` | execute | **1.2** | 参数微调即可修复，近期同类经验高度相关 |
| **B** | `FACTOR_EXHAUSTED` / `SIGNAL_STALE` | curate | **1.0** | 策略需要重新提炼，标准权重 |
| **C** | `STRUCTURAL_CHANGE` / `BUDGET_EXCEEDED` | collect | **0.8** | 市场结构变化，历史经验参考价值有限 |

**Tier Boost 在检索中的效果**:

```
RAGPipeline.retrieve("diagnosis WBNB_USDT retreat failure", tier_boost=1.2)
  → 内部: 对 metadata.tier == A 的结果 score *= 1.2
  → 效果: A 级历史诊断排名上升，在 top_k=3 中更可能出现
```

---

## 9. MM 与 Arb 的记忆差异

| 维度 | MM-Campaign (做市) | Arb-Campaign (套利) |
|------|-------------------|-------------------|
| LLM 诊断 | ❌ 无（纯确定性心跳） | ✅ Flash+Pro 双层 |
| MP7 lessons | ❌ 不适用 | ✅ category="defi_diagnosis" |
| MP8 history | ❌ 不适用 | ✅ tier_boost 按回退级别 |
| MP5 蒸馏 | ✅ Campaign 终态时仍执行 | ✅ Campaign 终态时执行 |
| 诊断引擎 | `None`（未注入） | `DiagnosisEngine` 实例 |

**设计决策**: MM 走心跳路径时 `self._diagnosis is None` → `_handle_failure()` 首行 return → MP7/MP8 完全不触发。但 MM Campaign 终态时 `_distill_lessons()` 仍执行——即使 MM 没有诊断，其运行 outcome 也可能包含可蒸馏的模式（如 TVL 变化趋势）。

---

## 10. WQ-YI 委托路径的隐式记忆

AGV Arb-Campaign 的 curate/dataset 步骤委托 WQ-YI 执行（S5-R2/R3 规则）：

```
Arb-Campaign collect → [本地 AGV]
Arb-Campaign curate  → [委托 WQ-YI KnowledgeBaseSkill(domain="defi")]
Arb-Campaign dataset → [委托 WQ-YI DeFiL1Recommender + DeFiL2Binder]
Arb-Campaign execute → [本地 AGV]
```

**隐式记忆路径**: WQ-YI 的 curate/dataset subagent 内部已有独立的 memory 接线（`skill_curate_knowledge.py` + `toolloop_l1.py` 中的 MP7/MP8 读取）。这意味着：

- WQ-YI 侧的 curate 骨架提取会参考 `category="diagnosis"` 的历史 lessons
- WQ-YI 侧的 L1 推荐会使用 evidence 中的 ToolLoop 历史
- 这些记忆影响通过委托返回的骨架/绑定结果**间接**传递到 AGV

AGV 本地的 MP7/MP8 注入发生在 **Arb 诊断路径**，与 WQ-YI 侧的记忆注入独立且互补：

```
WQ-YI 侧记忆 → 影响 curate/dataset 产出 → 间接影响 AGV 执行质量
AGV 侧记忆   → 影响 Arb 诊断回退决策   → 直接影响 Campaign 循环方向
```

---

## 11. 测试覆盖

位于 `_shared/tests/test_agv_shared.py` → `TestCampaignMemory` 类（14 个测试）：

| 测试 | 编号 | 验证点 |
|------|------|--------|
| `test_enrich_injects_lessons` | MP7 | `retrieve_lessons` 返回值注入 `evidence["memory_lessons"]` |
| `test_enrich_injects_history` | MP8 | `rag.retrieve()` 返回值注入 `evidence["memory_history"]`，tier_boost=1.2 for level A |
| `test_enrich_skipped_when_disabled` | 守卫 | `memory_read_enabled=false` → 不调用任何 memory 函数 |
| `test_enrich_skipped_when_no_memory_module` | 守卫 | `_HAS_MEMORY=False` → 静默跳过 |
| `test_enrich_skipped_when_no_policy` | 守卫 | policy=None → 静默跳过 |
| `test_enrich_graceful_on_retrieve_error` | 降级 | `retrieve_lessons` 抛异常 → evidence 不含 `memory_lessons`，不传播 |
| `test_enrich_graceful_on_rag_error` | 降级 | `rag.retrieve` 抛异常 → evidence 不含 `memory_history`，不传播 |
| `test_distill_called_on_archive` | MP5 | 2 个 pairs → `distill_asset_lessons` 调用 2 次 |
| `test_distill_skipped_when_disabled` | 守卫 | `memory_distill_enabled=false` → 不调用 |
| `test_distill_skipped_when_no_memory_module` | 守卫 | `_HAS_MEMORY=False` → 静默跳过 |
| `test_distill_graceful_per_pair_error` | 降级 | PAIR_A 抛异常 → PAIR_B 仍执行成功 |
| `test_get_rag_from_orchestrator_ctx` | 管道 | `orch._ctx.rag` 正确返回 |
| `test_get_rag_returns_none_when_no_ctx` | 管道 | `orch._ctx=None` → 返回 None |
| `test_enrich_history_uses_getattr` | Bug修复 | SearchResult dataclass 使用 `getattr` 而非 `.get()` |

**回归结果**: 122/122 passed, 0 failed, 0.49s

---

## 12. 未来演进

| 优先级 | 方向 | 内容 | 前置 |
|:------:|------|------|------|
| P1 | MP6 自动索引 | `rag_auto_index: true` → Arb evidence 自动入 vectorstore | Arb Campaign 真实运行产出足量 evidence |
| P2 | 跨域 Lessons | AGV `defi_diagnosis` 经验反哺 WQ-YI 的 DeFi Alpha 优化 | nexrur category 路由机制 |
| P2 | MM 记忆 | MM 心跳路径引入轻量级确定性 lesson 检索（不走 LLM） | MM 产出结构化 evidence |
| P3 | 向量库分区 | AGV/WQ-YI/AUDIT 各自 FAISS 分区，避免检索噪声 | nexrur vectorstore 多租户支持 |
| P3 | Lesson 过期 | 超过 N 天未检索的 lesson 降权或归档 | nexrur TTL 机制 |

---

## 附录 A: nexrur Memory API 签名速查

```python
# ── MP7 读: 检索结构化 lessons ──
def retrieve_lessons(
    query: str,                          # 检索查询 (e.g. strategy_id)
    rag: RAGPipeline | None = None,      # 向量检索管道
    top_k: int = 5,                      # 返回条数
    category: str | None = None,         # 命名空间过滤 (e.g. "defi_diagnosis")
) -> list[dict[str, Any]]:
    # 返回: [{lesson_id, pattern, detail, confidence}]

# ── MP5 写: 终态经验蒸馏 ──
def distill_asset_lessons(
    asset_id: str,                       # 资产/pair 标识 (e.g. "WBNB_USDT")
    workspace: Path,                     # nexrur 根目录
    rag: RAGPipeline | None = None,      # 向量检索管道 (用于写入索引)
    policy: Any = None,                  # PlatformPolicy 实例
) -> list[dict[str, Any]]:
    # 返回: [{lesson_id, asset_id, category, pattern, detail, confidence, source, created_at}]

# ── MP8 读: tier-boosted 模糊检索 ──
class RAGPipeline:
    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 5,
        score_threshold: float = ...,
        tier_boost: float | dict = ...,  # 按 tier 加权
    ) -> list[SearchResult]:
        # SearchResult: dataclass(doc_id, text, score, metadata)
        # 注意: 使用 getattr(h, "text", ...) 而非 h.get("text", ...)
```

## 附录 B: 文件变更清单

| 文件 | 变更类型 | 行数变化 |
|------|:--------:|:--------:|
| `_shared/core/policy.yml` | 新增 | +10 |
| `_shared/engines/campaign.py` | 修改 | +150 |
| `_shared/tests/test_agv_shared.py` | 新增 | +240 |
| `_shared/engines/diagnosis.py` | 未修改 | 0 |
| `scripts/toolloop_arb.py` | 未修改 | 0 |
| `scripts/toolloop_mm.py` | 未修改 | 0 |
