"""
Arb-Campaign Tool Loop — 5 步管线 (DESIGN.md §3)

collect → curate → dataset → execute → fix

调用方式对齐 WQ-YI:
  WQ-YI 不使用 AgentOps。Skill 的调用方式是直接实例化类 + 调方法:
    KnowledgeBaseSkill(paper_dict, ctx=ctx).run()
    DatasetExplorerSkill(ctx=ctx).generate_all_L1(skeleton_file)
    DatasetExplorerSkill(ctx=ctx).bind_all_l2_for_skeleton(skel_id)
  AGV 的 curate/dataset 步骤直接调用 WQ-YI 的 Skill 类，不经过 AgentOps。

管线步骤:
  - collect:  modules/collect/ 子模块（自建 — GeckoTerminal + Moralis）
  - curate:  直接调 WQ-YI KnowledgeBaseSkill
  - dataset: 委托 DatasetOps (agent_ops_arb.py) — 唯一 L1+L2 真相源
  - execute: 共享执行层（toolloop_mm.py 中的 DexExecutor）
  - fix:     三级回退诊断

AssetRef kind 映射（§3.7）:
  collect → market_signal → curate → arb_skeleton → dataset → arb_strategy
  → execute → execution_result → fix → fix_patch

三级回退（§3.6）:
  A: 参数调整 → execute（同策略重试，零 LLM）
  B: 因子切换 → curate（重新提取骨架，LLM 辅助）
  C: 策略重构 → collect（从头收集，LLM 主导）
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── 共享执行层导入 ──────────────────────────────────
try:
    from toolloop_mm import (
        ROUTER, USDT, KNOWN_PAIRS, PANCAKE_V2_PAIR_ABI,
        SlippageGuard, MEVGuard, TVLBreaker,
        ApproveManager,
    )
except ImportError:
    ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"
    USDT = "0x55d398326f99059fF775485246999027B3197955"
    KNOWN_PAIRS = {}  # type: ignore[assignment]
    PANCAKE_V2_PAIR_ABI = []  # type: ignore[assignment]
    SlippageGuard = None  # type: ignore[assignment,misc]
    MEVGuard = None  # type: ignore[assignment,misc]
    TVLBreaker = None  # type: ignore[assignment,misc]
    ApproveManager = None  # type: ignore[assignment,misc]

# ── AGV 池 → Token 映射 ─────────────────────────────
POOL_TOKEN_MAP: dict[str, dict[str, str]] = {
    "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0": {
        "base": "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",   # pGVT
        "quote": "0x55d398326f99059fF775485246999027B3197955",  # USDT
        "name": "pGVT_USDT",
    },
    "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d": {
        "base": "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3",   # sGVT
        "quote": "0x55d398326f99059fF775485246999027B3197955",  # USDT
        "name": "sGVT_USDT",
    },
}

# 默认交易金额 10 USDT (18 decimals on BSC)
DEFAULT_TRADE_SIZE_WEI = 10 * 10**18


# ── 三级回退（§3.6）──────────────────────────────────
RETREAT_LEVELS = {
    "A": {"target_step": "execute", "llm": False, "trigger": "param_drift"},
    "B": {"target_step": "curate",  "llm": True,  "trigger": "factor_exhausted"},
    "C": {"target_step": "collect",  "llm": True,  "trigger": "structural_change"},
}


# ── 策略转换层（dataset 产出 → StrategyRef）──────────

def _resolve_pool_info(pair_id: str, workspace: Path | None = None) -> dict:
    """pair_id → pool_address / token_in / token_out

    查找链路:
      1. POOL_TOKEN_MAP 地址匹配（末 6 位 hex 子串）
      2. collect 目录元数据文件（pool_address 字段）
      3. 返回空（execute pre_flight 会阻断）
    """
    # 1. POOL_TOKEN_MAP 匹配
    pid_low = pair_id.lower()
    for addr, info in POOL_TOKEN_MAP.items():
        addr_low = addr.lower()
        if addr_low[-6:] in pid_low or pid_low in info.get("name", "").lower():
            return {
                "pool_address": addr,
                "token_in": info["quote"],
                "token_out": info["base"],
                "name": info["name"],
            }

    # 2. collect 目录元数据
    if workspace:
        import yaml as _yaml
        for base in [
            Path(workspace) / ".docs" / "ai-skills" / "collect" / "pending" / "staged",
            Path(workspace) / ".docs" / "ai-skills" / "collect" / "pending",
        ]:
            pair_dir = base / pair_id
            if not pair_dir.is_dir():
                continue
            for yml_file in sorted(pair_dir.glob("*.yml"))[:5]:
                try:
                    data = _yaml.safe_load(yml_file.read_text()) or {}
                    if data.get("pool_address"):
                        return {
                            "pool_address": data["pool_address"],
                            "token_in": data.get("token0", data.get("quote", "")),
                            "token_out": data.get("token1", data.get("base", "")),
                            "name": pair_id,
                        }
                except Exception:
                    continue

    # 3. 无法解析
    logger.warning("_resolve_pool_info: unresolved pair_id=%s", pair_id)
    return {"pool_address": "", "token_in": "", "token_out": "", "name": pair_id}


def build_strategies_from_binding(
    indicator_binding_file: Path,
    slot_categories_file: Path | None = None,
    pool_info: dict | None = None,
    *,
    default_amount_wei: int = DEFAULT_TRADE_SIZE_WEI,
) -> list:  # list[StrategyRef] — forward ref
    """dataset 产出 → 可执行 StrategyRef 列表

    将 indicator_binding.yml 按 skeleton_id 分组，每个骨架生成一个 StrategyRef。
    pool_info 提供链上执行参数（pool_address / token_in / token_out）。
    """
    import yaml as _yaml

    data = _yaml.safe_load(Path(indicator_binding_file).read_text())
    bindings = data.get("indicator_bindings", [])
    if not bindings:
        return []

    # 读 slot_categories 获取 strategy_type 映射
    skel_type_map: dict[str, str] = {}
    if slot_categories_file and Path(slot_categories_file).exists():
        try:
            cat_data = _yaml.safe_load(Path(slot_categories_file).read_text())
            for sb in (cat_data or {}).get("strategy_bindings", []):
                skel_type_map[sb["skeleton_id"]] = sb.get("strategy_type", "unknown")
        except Exception:
            pass

    # 按 skeleton_id 分组
    skel_groups: dict[str, list[dict]] = {}
    for b in bindings:
        sid = b.get("skeleton_id", "")
        if sid:
            skel_groups.setdefault(sid, []).append(b)

    pool = pool_info or {}
    amount_wei = int(pool.get("amount_in_wei", default_amount_wei))

    strategies: list[StrategyRef] = []
    for skel_id, group in skel_groups.items():
        # 聚合所有 category 的指标
        all_indicators: dict[str, dict] = {}
        for binding in group:
            cat = binding.get("category", "unknown")
            all_indicators[cat] = {
                "indicators": binding.get("selected_indicators", []),
                "param_hints": binding.get("param_hints", {}),
                "confidence": binding.get("confidence", 0.0),
            }

        confs = [d["confidence"] for d in all_indicators.values() if d["confidence"] > 0]
        avg_conf = sum(confs) / len(confs) if confs else 0.0

        strategies.append(StrategyRef(
            strategy_id=skel_id,
            strategy_type=skel_type_map.get(skel_id, "unknown"),
            confidence=avg_conf,
            entry={
                "pool_address": pool.get("pool_address", ""),
                "token_in": pool.get("token_in", ""),
                "token_out": pool.get("token_out", ""),
                "amount_in_wei": amount_wei,
                "amount_usd": amount_wei / 10**18,
                "direction": "buy",
            },
            sizing={"amount_in_usd": amount_wei / 10**18},
            exit_rules={"condition": "immediate_fill", "ttl": 120},
            metadata={
                "indicators": all_indicators,
                "categories": list(all_indicators.keys()),
                "binding_count": len(group),
            },
        ))

    return strategies


# ── 轻量 AssetRef（§3.7 kind 枚举）─────────────────
@dataclass
class SignalRef:
    """collect 产出 — 市场信号"""
    sig_id: str
    signal_type: str          # price_divergence / volume_spike / lp_imbalance / ...
    strength: float = 0.0
    source: str = "gecko"
    pool_address: str = ""
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    @property
    def is_fresh(self) -> bool:
        """信号有效期 2min（§3.5 signal_freshness）"""
        return (time.time() - self.timestamp) < 120.0


@dataclass
class StrategyRef:
    """dataset 产出 — 可执行策略"""
    strategy_id: str
    strategy_type: str        # cross_pool_arbitrage / volume_momentum / lp_imbalance_arb
    signal: SignalRef | None = None
    entry: dict = field(default_factory=dict)
    sizing: dict = field(default_factory=dict)
    exit_rules: dict = field(default_factory=dict)
    confidence: float = 0.0
    metadata: dict = field(default_factory=dict)


# ── DiagnosisProfile（§3.6 + §7.3）─────────────────
@dataclass
class DiagnosisProfile:
    """Arb-Campaign 诊断配置"""
    max_consecutive_failures: int = 5
    budget_halt_threshold: float = 0.5    # 亏损 > 50% 日预算 → 暂停
    cooldown_minutes: int = 30            # C 级回退后冷静期
    max_level_a_retries: int = 3          # A 级最大重试（超过升级到 B）


class ArbCampaignLoop:
    """Arb-Campaign 5 步管线循环（§3）"""

    STEPS = ["collect", "curate", "dataset", "execute", "fix"]

    def __init__(
        self,
        *,
        config: dict | None = None,
        executor: Any = None,
        budget: Any = None,
        preauth: Any = None,
        notify: Any = None,
        diagnosis: DiagnosisProfile | None = None,
        slippage_guard: Any = None,
        tvl_breaker: Any = None,
        mev_guard: Any = None,
        approve_manager: Any = None,
        workspace: Path | None = None,
    ):
        self.config = config or {}
        self._executor = executor
        self._budget = budget
        self._preauth = preauth
        self._notify = notify
        self._diagnosis = diagnosis or DiagnosisProfile()
        self._slippage_guard = slippage_guard
        self._tvl_breaker = tvl_breaker
        self._mev_guard = mev_guard
        self._approve_manager = approve_manager
        self._workspace = workspace or Path.cwd()
        self._simulate = bool(config.get("simulate") if config else False)
        # 运行状态
        self._running = False
        self._cycle_count = 0
        self._consecutive_failures = 0
        self._current_retreat_level: str | None = None
        self._cooldown_until: float = 0.0

    # ── Helpers ──────────────────────────────────────
    async def _get_ordered_reserves(
        self, pool_address: str, token_in: str,
    ) -> tuple[int, int]:
        """获取按 (reserve_in, reserve_out) 排序的 reserves"""
        r0, r1 = await self._executor.get_reserves(pool_address)
        pool_info = POOL_TOKEN_MAP.get(pool_address)
        if not pool_info:
            return (r0, r1)
        base = pool_info["base"].lower()
        quote = pool_info["quote"].lower()
        # PancakeV2: token0 = smaller address
        token0 = min(base, quote)
        if token_in.lower() == token0:
            return (r0, r1)
        return (r1, r0)

    # NOTE: _local_strategy_builder 已移除 — dataset 由 nexrur DatasetOps 调用
    # WQ-YI DeFiL1Recommender + DeFiL2Binder (LLM-driven) 处理

    # ── Step 1: collect ─────────────────────────────────
    async def _step_collect(self) -> list[SignalRef]:
        """市场信号收集 — modules/collect/ (Arb 版)

        使用 ArbCollectSkill 三阶段管线:
          discover → enrich → persist → 读 registry → 转 SignalRef
        """
        import sys
        from pathlib import Path
        collect_dir = Path(__file__).resolve().parent.parent / "modules" / "collect" / "scripts"
        if str(collect_dir) not in sys.path:
            sys.path.insert(0, str(collect_dir))
        from toolloop_arb_collect import ArbCollectSkill

        skill = ArbCollectSkill(config=self.config.get("collect", {}))
        outcome = await skill.run()

        # 从 registry 读取已持久化的 pending 池对 → 转 SignalRef
        signals = []
        for pair_id in skill.registry.list_pending():
            entry = skill.registry.get(pair_id) or {}
            signals.append(SignalRef(
                sig_id=pair_id,
                signal_type="pool_discovery",
                strength=0.0,
                source="arb_collect",
                pool_address=entry.get("pool_address", ""),
                metadata={"discovery_method": entry.get("discovery_method", ""), **entry},
            ))

        logger.info("collect: %d persisted (discovered=%d, enriched=%d, skipped=%d)",
                     len(signals), outcome.pools_discovered,
                     outcome.pools_enriched, outcome.pools_skipped)
        return signals

    # ── Step 2: curate ───────────────────────────────
    async def _step_curate(self, signals: list[SignalRef]) -> list[dict]:
        """策略骨架提取 — WQ-YI KnowledgeBaseSkill(domain=defi)"""
        import sys as _sys
        _wqyi = Path(__file__).resolve().parents[5] / "WQ-YI"
        _curate_dir = _wqyi / ".gemini" / "skills" / "brain-curate-knowledge" / "scripts"
        if str(_curate_dir) not in _sys.path:
            _sys.path.insert(0, str(_curate_dir))
        from skill_curate_knowledge import KnowledgeBaseSkill  # type: ignore[import-untyped]

        skeletons: list[dict] = []
        for sig in signals:
            pair_id = sig.sig_id
            collect_dir = None
            for candidate in [
                self._workspace / ".docs" / "ai-skills" / "collect" / "pending" / pair_id,
                self._workspace / ".docs" / "ai-skills" / "collect" / "pending" / "staged" / pair_id,
            ]:
                if candidate.is_dir():
                    collect_dir = candidate
                    break
            if collect_dir is None:
                logger.warning("curate: collect dir missing for %s", pair_id)
                continue

            paper = {"abbr": pair_id, "name": pair_id, "path": str(collect_dir), "domain": "defi"}
            try:
                skill = KnowledgeBaseSkill(paper)
                curate_dir = self._workspace / ".docs" / "ai-skills" / "curate" / "staged" / pair_id
                curate_dir.mkdir(parents=True, exist_ok=True)
                skill.work_dir = curate_dir
                success = skill.run()
                if success:
                    skeletons.append({"id": pair_id, "path": str(curate_dir), "type": "curated"})
                else:
                    logger.warning("curate: skill returned failure for %s", pair_id)
            except Exception as exc:
                logger.error("curate failed for %s: %s", pair_id, exc)

        logger.info("curate: %d skeletons from %d signals", len(skeletons), len(signals))
        return skeletons

    # ── 产物写入 ────────────────────────────────────
    def _write_execute_artifacts(
        self, results: list[dict], strategies: list[StrategyRef],
    ) -> Path | None:
        """写执行产物到 .docs/ai-skills/execute/output/"""
        import yaml as _yaml
        from datetime import datetime, timezone

        output_root = self._workspace / ".docs" / "ai-skills" / "execute" / "output"
        output_root.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        run_dir = output_root / ts
        run_dir.mkdir(parents=True, exist_ok=True)

        # 策略 → 结果 映射
        strat_map = {s.strategy_id: s for s in strategies}

        records = []
        for r in results:
            sid = r.get("strategy_id", "unknown")
            s = strat_map.get(sid)
            record = {
                "strategy_id": sid,
                "strategy_type": s.strategy_type if s else "unknown",
                "status": r.get("status", "unknown"),
                "reason": r.get("reason"),
                "tx_hash": r.get("tx_hash"),
                "gas_used": r.get("gas_used"),
                "block_number": r.get("block_number"),
                "simulated": r.get("simulated", False),
                "amount_in": r.get("amount_in"),
                "amount_out": r.get("amount_out"),
                "price_impact": r.get("price_impact"),
            }
            if s:
                record["entry"] = s.entry
                record["confidence"] = s.confidence
            records.append(record)

        summary = {
            "run_timestamp": ts,
            "cycle": self._cycle_count,
            "total": len(records),
            "success": sum(1 for r in records if r["status"] == "success"),
            "blocked": sum(1 for r in records if r["status"] == "blocked"),
            "errors": sum(1 for r in records if r["status"] == "error"),
            "simulated": any(r.get("simulated") for r in records),
            "results": records,
        }

        artifact_path = run_dir / "execution_results.yml"
        artifact_path.write_text(
            _yaml.dump(summary, default_flow_style=False, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        logger.info("execute: artifacts written to %s", artifact_path)
        return run_dir

    # ── Step 3: dataset ──────────────────────────────
    async def _step_dataset(self, skeletons: list[dict]) -> list[StrategyRef]:
        """指标绑定 + 策略构建 — 委托 DatasetOps (L1+L2) → StrategyRef

        DatasetOps 是 L1→L2 管线的唯一真相源；本方法只做:
          1. skeletons dict → AssetRef 转换
          2. 调 DatasetOps
          3. 产出目录 → StrategyRef 转换
        """
        from nexrur.engines.orchestrator import AssetRef as _AssetRef
        from _shared.engines.agent_ops_arb import DatasetOps

        # skeleton dict → AssetRef（DatasetOps 需要 kind="arb_strategy"）
        assets = []
        for skel in skeletons:
            assets.append(_AssetRef(
                kind="arb_strategy",
                id=skel["id"],
                path=skel.get("path", ""),
                metadata={"type": skel.get("type", "curated")},
            ))

        ops = DatasetOps()
        _tid = f"arb-cycle-{self._cycle_count}"
        result = ops(
            pipeline_run_id=_tid,
            step_run_id=f"{_tid}-dataset",
            trace_id=_tid,
            assets_input=assets,
            config={},
            workspace=self._workspace,
        )

        # DatasetOps 产出 → StrategyRef 转换
        all_strategies: list[StrategyRef] = []
        for asset in result.assets_produced:
            output_dir = self._workspace / asset.path
            ind_file = output_dir / "indicator_binding.yml"
            l1_file = output_dir / "slot_categories.yml"
            if ind_file.exists():
                pool_info = _resolve_pool_info(asset.id, self._workspace)
                strategies = build_strategies_from_binding(ind_file, l1_file, pool_info)
                all_strategies.extend(strategies)

        logger.info("dataset: %d strategies from %d skeletons", len(all_strategies), len(skeletons))
        return all_strategies

    # ── Step 4: execute ──────────────────────────────
    async def _step_execute(self, strategies: list[StrategyRef]) -> list[dict]:
        """执行（实盘或模拟） — DexExecutor + 三层安全护甲（§3.5）"""
        results = []
        for strategy in strategies:
            result = await self._execute_single(strategy)
            results.append(result)
        ok = sum(1 for r in results if r.get("status") == "success")
        logger.info("execute: %d results (%d success)", len(results), ok)

        # 写产物到 .docs/ai-skills/execute/output/
        try:
            self._write_execute_artifacts(results, strategies)
        except Exception as exc:
            logger.warning("execute: artifact write failed: %s", exc)

        return results

    async def _execute_single(self, strategy: StrategyRef) -> dict:
        """单策略执行 — pre_flight → approve → swap → 记账"""
        sid = strategy.strategy_id
        entry = strategy.entry

        # 1. Pre-flight
        pre = await self.pre_flight(strategy)
        if not pre["passed"]:
            return {"strategy_id": sid, "status": "blocked", "reason": pre["reason"]}

        # 2. Extract execution params
        pool_address = entry.get("pool_address", "")
        token_in = entry.get("token_in", "")
        token_out = entry.get("token_out", "")
        amount_in_wei = int(entry.get("amount_in_wei", 0))

        if not all([pool_address, token_in, token_out, amount_in_wei > 0]):
            return {"strategy_id": sid, "status": "blocked",
                    "reason": "incomplete_entry_params"}

        if not self._executor:
            return {"strategy_id": sid, "status": "blocked", "reason": "no_executor"}

        # 3. TVL breaker
        if self._tvl_breaker and not self._tvl_breaker.allows_arb():
            return {"strategy_id": sid, "status": "blocked",
                    "reason": f"tvl_breaker:{self._tvl_breaker.halt_reason}"}

        # 4. Get reserves + expected output
        try:
            r_in, r_out = await self._get_ordered_reserves(pool_address, token_in)
        except Exception as exc:
            return {"strategy_id": sid, "status": "error",
                    "reason": f"get_reserves:{exc}"}

        expected_out = await self._executor.get_amount_out(amount_in_wei, r_in, r_out)
        if expected_out <= 0:
            return {"strategy_id": sid, "status": "blocked",
                    "reason": "zero_expected_output"}

        # 5. Slippage guard
        ideal_out = amount_in_wei * r_out // r_in if r_in > 0 else 0
        min_amount_out = expected_out * 98 // 100
        if self._slippage_guard:
            check = await self._slippage_guard.check(
                amount_in=amount_in_wei, expected_out=expected_out,
                ideal_out=ideal_out,
            )
            if not check["passed"]:
                return {"strategy_id": sid, "status": "blocked",
                        "reason": f"slippage:{check['reason']}"}
            min_amount_out = check.get("min_amount_out", min_amount_out)

        # 6. MEV guard
        if self._mev_guard and await self._mev_guard.should_delay():
            return {"strategy_id": sid, "status": "delayed",
                    "reason": "mev_cooldown"}

        # 7. Ensure allowance
        if self._approve_manager:
            try:
                router = ROUTER
                if self._executor.adapter:
                    router = self._executor.adapter.router_address
                await self._approve_manager.ensure_allowance(
                    token_in, router, amount_in_wei,
                )
            except Exception as exc:
                return {"strategy_id": sid, "status": "error",
                        "reason": f"approve:{exc}"}

        # 8. Execute swap
        try:
            tx_result = await self._executor.swap(
                token_in=token_in, token_out=token_out,
                amount_in=amount_in_wei, min_amount_out=min_amount_out,
            )
        except Exception as exc:
            return {"strategy_id": sid, "status": "error",
                    "reason": f"swap:{exc}"}

        # 9. Record budget
        status = tx_result.get("status", "unknown")
        if self._budget and status == "success":
            gas_usd = tx_result.get("gas_used", 0) * 3e-9 * 300
            self._budget.record_trade(
                gas_usd=gas_usd,
                volume_usd=entry.get("amount_usd", 0),
            )

        return {
            "strategy_id": sid,
            "status": status,
            "tx_hash": tx_result.get("tx_hash"),
            "gas_used": tx_result.get("gas_used"),
            "block_number": tx_result.get("block_number"),
            "simulated": tx_result.get("simulated", False),
            "amount_in": tx_result.get("amount_in"),
            "amount_out": tx_result.get("amount_out"),
            "price_impact": tx_result.get("price_impact"),
        }

    # ── Step 5: fix ──────────────────────────────────
    async def _step_fix(self, results: list[dict]) -> str | None:
        """策略修复 — 三级回退诊断（§3.6）

        失败分类:
          - 结构性 (tvl_breaker/no_executor) → C (re-collect)
          - 因子性 (zero_expected_output/slippage) → B (re-curate)
          - 参数性 (tx_revert/approve_fail) → A (param adjust)

        Returns:
            回退目标步骤名（collect/curate/execute），或 None（无需修复）
        """
        failures = [r for r in results if r.get("status") not in ("success", "delayed")]
        if not failures:
            self._consecutive_failures = 0
            self._current_retreat_level = None
            return None

        self._consecutive_failures += 1
        reasons = [r.get("reason", "") for r in failures]

        # 分类失败原因 → 确定回退级别
        structural = any(
            k in r for r in reasons for k in ("tvl_breaker", "no_executor", "tvl_halt")
        )
        factor_issue = any(
            k in r for r in reasons
            for k in ("zero_expected_output", "slippage", "get_reserves")
        )

        if structural:
            level = "C"
        elif factor_issue and self._consecutive_failures > self._diagnosis.max_level_a_retries:
            level = "B"
        elif self._consecutive_failures <= self._diagnosis.max_level_a_retries:
            level = "A"
        elif self._consecutive_failures <= self._diagnosis.max_consecutive_failures:
            level = "B"
        else:
            level = "C"

        self._current_retreat_level = level
        retreat = RETREAT_LEVELS[level]
        target = retreat["target_step"]

        logger.warning(
            "fix: level %s retreat → %s (consecutive=%d, reasons=%s)",
            level, target, self._consecutive_failures,
            "; ".join(reasons[:3]),
        )

        # C 级回退 → 冷静期
        if level == "C":
            self._cooldown_until = time.monotonic() + self._diagnosis.cooldown_minutes * 60
            logger.warning("fix: C-level cooldown for %d minutes",
                           self._diagnosis.cooldown_minutes)

        return target

    # ── 前置检查（§3.5 pre_flight）───────────────────
    async def pre_flight(self, strategy: Any) -> dict:
        """确定性前置检查 — 零 LLM，7 项门控"""
        reasons = []

        # 1. 预算检查
        if self._budget:
            ok, reason = self._budget.can_trade()
            if not ok:
                reasons.append(reason)

        # 2. 信号新鲜度 (< 2min)
        sig = getattr(strategy, "signal", None)
        if sig and hasattr(sig, "is_fresh") and not sig.is_fresh:
            reasons.append("signal_stale")

        # 3. 置信度阈值 (≥ 0.85)
        confidence = getattr(strategy, "confidence", 0.0)
        if confidence < 0.85:
            reasons.append(f"low_confidence ({confidence:.2f} < 0.85)")

        # 4. 池深度检查（需 preauth）
        if self._preauth and hasattr(strategy, "signal"):
            pool = getattr(strategy.signal, "pool_address", "")
            if pool and not self._preauth.is_pool_approved(pool):
                reasons.append(f"pool_not_approved ({pool[:10]}...)")

        # 5. 冷静期检查
        if time.monotonic() < self._cooldown_until:
            remaining = self._cooldown_until - time.monotonic()
            reasons.append(f"cooldown_active ({remaining:.0f}s remaining)")

        # 6. TVL 熔断检查
        if self._tvl_breaker and not self._tvl_breaker.allows_arb():
            reasons.append(f"tvl_halt:{self._tvl_breaker.halt_reason}")

        # 7. 执行参数完整性
        entry = getattr(strategy, "entry", {})
        if entry and not entry.get("pool_address"):
            reasons.append("missing_pool_address")

        if reasons:
            return {"passed": False, "reason": "; ".join(reasons)}
        return {"passed": True, "reason": None}

    # ── 单次循环 ─────────────────────────────────────
    async def run_cycle(self, *, start_step: str | None = None) -> dict:
        """单次 5 步循环（支持回退重入）

        Args:
            start_step: 回退时从此步开始（默认 collect）
        """
        self._cycle_count += 1
        start = start_step or "collect"
        start_idx = self.STEPS.index(start) if start in self.STEPS else 0

        signals: list[SignalRef] = []
        skeletons: list[dict] = []
        strategies: list[StrategyRef] = []
        results: list[dict] = []
        retreat_target: str | None = None

        for step_name in self.STEPS[start_idx:]:
            try:
                if step_name == "collect":
                    signals = await self._step_collect()
                    if not signals:
                        return {"cycle": self._cycle_count, "outcome": "no_signals"}
                elif step_name == "curate":
                    skeletons = await self._step_curate(signals)
                    if not skeletons:
                        return {"cycle": self._cycle_count, "outcome": "curate_failed"}
                elif step_name == "dataset":
                    strategies = await self._step_dataset(skeletons)
                    if not strategies:
                        return {"cycle": self._cycle_count, "outcome": "no_strategies"}
                elif step_name == "execute":
                    results = await self._step_execute(strategies)
                    ok = sum(1 for r in results if r.get("status") == "success")
                    if ok and self._notify:
                        await self._notify.send(
                            level="INFO", title="Arb trades executed",
                            body=f"cycle={self._cycle_count}",
                            data={"success": ok, "total": len(results)},
                        )
                elif step_name == "fix":
                    retreat_target = await self._step_fix(results)
            except Exception as exc:
                logger.error("step %s failed: %s", step_name, exc)
                if self._notify:
                    await self._notify.send(
                        level="WARNING", title="Arb step failed",
                        body=f"cycle={self._cycle_count} step={step_name}",
                        data={"error": str(exc)[:200]},
                    )
                return {
                    "cycle": self._cycle_count,
                    "outcome": "step_error",
                    "failed_step": step_name,
                    "error": str(exc),
                }

        return {
            "cycle": self._cycle_count,
            "outcome": "completed",
            "signals": len(signals),
            "skeletons": len(skeletons),
            "strategies": len(strategies),
            "results": len(results),
            "retreat_target": retreat_target,
        }

    # ── Campaign 主循环 ──────────────────────────────
    async def run_campaign(self, *, max_cycles: int = 100):
        """Campaign 主循环 — 包含预算检查 + 回退重入 + 诊断"""
        self._running = True
        retreat_from: str | None = None
        interval = self.config.get("cycle_interval_seconds", 60)

        try:
            while self._running and self._cycle_count < max_cycles:
                # 冷静期
                if time.monotonic() < self._cooldown_until:
                    wait = self._cooldown_until - time.monotonic()
                    logger.info("campaign: cooldown %.0fs remaining", wait)
                    await asyncio.sleep(min(wait, interval))
                    continue

                # 预算检查
                if self._budget:
                    ok, reason = self._budget.can_trade()
                    if not ok:
                        logger.warning("campaign: budget blocked — %s", reason)
                        if self._notify:
                            await self._notify.send(
                                level="WARNING", title="Arb budget exhausted",
                                body=f"cycle={self._cycle_count}",
                                data={"reason": reason},
                            )
                        break

                # 执行循环（支持回退重入）
                result = await self.run_cycle(start_step=retreat_from)
                retreat_from = result.get("retreat_target")

                logger.info(
                    "campaign: cycle %d → %s (retreat=%s)",
                    self._cycle_count, result["outcome"], retreat_from,
                )

                # 诊断升级
                if (self._consecutive_failures
                        >= self._diagnosis.max_consecutive_failures
                        and self._current_retreat_level != "C"):
                    logger.error("campaign: max failures reached, halting")
                    if self._notify:
                        await self._notify.send(
                            level="CRITICAL", title="Arb campaign HALTED",
                            body=f"Max failures ({self._diagnosis.max_consecutive_failures}) reached",
                            data={"cycles": self._cycle_count},
                        )
                    break

                await asyncio.sleep(interval)
        finally:
            self._running = False
            logger.info("campaign: stopped after %d cycles", self._cycle_count)

    def stop(self):
        """优雅停止"""
        self._running = False
