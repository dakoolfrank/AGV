"""
S5-Arb AgentOps 桥接层

Arb-Campaign 因子套利模式（5 步 collect→curate→dataset→execute→fix）
每个 Ops 遵守 nexrur AgentOpsProtocol: (*) → StepResult

P0: 全步骤 simulate 模式（零外部依赖）
P1: 步骤产出 schema 校验（_shared/schemas/*.yaml）
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from nexrur.engines.orchestrator import AssetRef, StepResult

# 安全护甲复用 MM 的共享组件
from _shared.engines.agent_ops_mm import SafetyArmor
from _shared.engines._bootstrap_schema import validate_step_output

logger = logging.getLogger(__name__)


def _get_asset_root(config: dict[str, Any], workspace: Path) -> Path:
    """从 config 提取 asset_root（消费者根），回退到 workspace。

    双根架构: workspace=nexrur(ai-runs), asset_root=AGV(ai-skills)
    Orchestrator 在 _execute_steps 中注入 config["_asset_root"]。
    """
    raw = config.get("_asset_root")
    return Path(raw) if raw else workspace


# BSC 主流外部池 mock 数据（S5-R1: 不含 pGVT/sGVT）
_DEFAULT_EXTERNAL_POOLS: list[dict[str, Any]] = [
    {
        "pair_id": "WBNB_USDT",
        "pool_address": "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE",
        "base_token": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "quote_token": "0x55d398326f99059fF775485246999027B3197955",
        "base_symbol": "WBNB",
        "quote_symbol": "USDT",
        "dex": "PancakeSwap V2",
        "chain": "BSC",
        "chain_id": 56,
        "price": 580.0,
        "tvl_usd": 45_000_000.0,
        "volume_24h_usd": 12_000_000.0,
    },
    {
        "pair_id": "CAKE_BNB",
        "pool_address": "0x0eD7e52944161450477ee417DE9Cd3a859b14fD0",
        "base_token": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
        "quote_token": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "base_symbol": "CAKE",
        "quote_symbol": "BNB",
        "dex": "PancakeSwap V2",
        "chain": "BSC",
        "chain_id": 56,
        "price": 2.85,
        "tvl_usd": 8_500_000.0,
        "volume_24h_usd": 3_200_000.0,
    },
    {
        "pair_id": "ETH_BNB",
        "pool_address": "0x74E4716E431f45807DCF19f284c7aA99F18a4fbc",
        "base_token": "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        "quote_token": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "base_symbol": "ETH",
        "quote_symbol": "BNB",
        "dex": "PancakeSwap V2",
        "chain": "BSC",
        "chain_id": 56,
        "price": 3800.0,
        "tvl_usd": 22_000_000.0,
        "volume_24h_usd": 8_500_000.0,
    },
]


# ─── CollectOps（S5-Arb Step 1）───
class CollectOps:
    """收集外部 DEX 市场信号，发现套利机会

    S5-R1 合规: 仅扫描外部池 — 禁止 pGVT/sGVT 地址

    simulate 模式: 生成 BSC 主流外部池 mock 市场数据（默认）
    live 模式: 委托 ArbCollectSkill（GeckoTerminal discover → enrich → persist）
    """

    COLLECT_PENDING = Path(".docs/ai-skills/collect/pending")

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        simulate = config.get("simulate", True)
        if simulate:
            return self._collect_simulate(config, workspace, trace_id)
        return self._collect_live(config, workspace, trace_id)

    # ── simulate 模式 ──────────────────────────────────
    def _collect_simulate(
        self, config: dict, workspace: Path, trace_id: str,
    ) -> StepResult:
        """生成外部池 mock 数据（config.target_pools 覆盖默认池列表）"""
        asset_root = _get_asset_root(config, workspace)
        pools = config.get("target_pools", _DEFAULT_EXTERNAL_POOLS)
        now_ts = time.time()
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        produced: list[AssetRef] = []

        for pool in pools:
            pair_id = pool["pair_id"]
            output_dir = asset_root / self.COLLECT_PENDING / pair_id
            output_dir.mkdir(parents=True, exist_ok=True)
            price = pool.get("price", 1.0)
            tvl = pool.get("tvl_usd", 0.0)
            vol_24h = pool.get("volume_24h_usd", 0.0)

            # 1. pool_info.yml
            pool_data = {
                "pair_id": pair_id,
                "pool_address": pool.get("pool_address", ""),
                "base_token": pool.get("base_token", ""),
                "quote_token": pool.get("quote_token", ""),
                # _resolve_pool_info compatibility aliases
                "base": pool.get("base_token", ""),
                "quote": pool.get("quote_token", ""),
                "base_symbol": pool.get("base_symbol", ""),
                "quote_symbol": pool.get("quote_symbol", ""),
                "dex": pool.get("dex", "PancakeSwap V2"),
                "chain": pool.get("chain", "BSC"),
                "chain_id": pool.get("chain_id", 56),
                "price": price,
                "tvl_usd": tvl,
                "volume_24h_usd": vol_24h,
                "collected_at": now_iso,
                "source": "mock",
            }
            # P1: schema 校验 pool_info
            _report = validate_step_output("collect", pool_data)
            if not _report["valid"]:
                logger.warning("collect schema validation: %s", _report["errors"])

            (output_dir / "pool_info.yml").write_text(
                yaml.dump(pool_data, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            # 2. signal.yml
            signals = [
                {
                    "signal_id": f"{pair_id}_price_divergence_{int(now_ts)}",
                    "signal_type": "price_divergence",
                    "strength": 0.65,
                    "pair": pair_id,
                    "pool_address": pool.get("pool_address", ""),
                    "price": price,
                    "reference_price": round(price * 1.008, 8),
                    "divergence_pct": 0.8,
                    "timestamp": now_iso,
                    "source": "mock",
                },
                {
                    "signal_id": f"{pair_id}_volume_spike_{int(now_ts)}",
                    "signal_type": "volume_spike",
                    "strength": 0.45,
                    "pair": pair_id,
                    "pool_address": pool.get("pool_address", ""),
                    "volume_24h_usd": vol_24h,
                    "avg_volume_7d_usd": round(vol_24h * 0.6, 2),
                    "spike_ratio": 1.67,
                    "timestamp": now_iso,
                    "source": "mock",
                },
            ]
            signal_doc = {
                "signals": signals,
                "pair": pair_id,
                "collected_at": now_iso,
                "signal_count": len(signals),
            }
            (output_dir / "signal.yml").write_text(
                yaml.dump(signal_doc, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            # 3. asset_hints.yml
            _pool_addr = pool.get("pool_address", "")
            hints = {
                "pair": pair_id,
                "pool_address": _pool_addr,
                "tvl_usd": tvl,
                "price": price,
                "viable_strategies": ["cross_pool_arbitrage", "volume_momentum"],
                "min_trade_usd": 5.0,
                "max_trade_usd": config.get("max_single_usd", 20.0),
                "canonical_id": _pool_addr,
                "source_url": f"https://www.geckoterminal.com/bsc/pools/{_pool_addr}" if _pool_addr else "",
                "source_type": "dex_pool",
            }
            (output_dir / "asset_hints.yml").write_text(
                yaml.dump(hints, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            produced.append(AssetRef(
                kind="market_signal",
                id=pair_id,
                path=str(output_dir.relative_to(asset_root)),
                metadata={
                    "source": "collect",
                    "trace_id": trace_id,
                    "signals": len(signals),
                    "tvl_usd": tvl,
                    "simulate": True,
                },
            ))

        logger.info(
            "collect: wrote %d external pools (simulate=True, pairs=%s)",
            len(produced), [p.id for p in produced],
        )
        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "collect",
                "trace_id": trace_id,
                "pools": len(produced),
                "mode": "simulate",
                "files_written": ["pool_info.yml", "signal.yml", "asset_hints.yml"],
            },
        )

    # ── live 模式 ──────────────────────────────────────
    def _collect_live(
        self, config: dict, workspace: Path, trace_id: str,
    ) -> StepResult:
        """委托 ArbCollectSkill（GeckoTerminal discover → enrich → persist）"""
        asset_root = _get_asset_root(config, workspace)
        import sys
        collect_dir = (
            Path(__file__).resolve().parents[2]
            / "agv-mm-arb" / "modules" / "collect" / "scripts"
        )
        if str(collect_dir) not in sys.path:
            sys.path.insert(0, str(collect_dir))
        from toolloop_arb_collect import ArbCollectSkill  # type: ignore[import-untyped]

        skill = ArbCollectSkill(config=config.get("collect_config", {}))
        loop = asyncio.new_event_loop()
        try:
            outcome = loop.run_until_complete(skill.run())
        finally:
            loop.close()

        produced: list[AssetRef] = []
        for pair_id in skill.registry.list_pending():
            entry = skill.registry.get(pair_id) or {}
            produced.append(AssetRef(
                kind="market_signal",
                id=pair_id,
                path=str(asset_root / self.COLLECT_PENDING / pair_id),
                metadata={
                    "source": "collect",
                    "trace_id": trace_id,
                    "discovery_method": entry.get("discovery_method", ""),
                    "simulate": False,
                },
            ))
        logger.info("collect(live): %d pools discovered", len(produced))

        return StepResult(
            success=outcome.status != "failed",
            assets_produced=produced,
            metadata={
                "step": "collect",
                "trace_id": trace_id,
                "mode": "live",
                "discovered": outcome.pools_discovered,
                "enriched": outcome.pools_enriched,
            },
        )


# ─── CurateOps（S5-Arb Step 2）— 委托 WQ-YI Subagent ───
class CurateOps:
    """策略骨架提取 — 委托 WQ-YI brain-curate-knowledge (domain=defi)

    架构:
      - simulate 模式 (P0): 确定性本地映射（零 LLM）
      - live 模式: 委托 WQ-YI KnowledgeBaseSkill(domain="defi") — Flash+Pro LLM

    WQ-YI curate DeFi 支持:
      - idea_packet.yml 优先读取（line 1216）
      - defi_preflight_review prompt（line 1259）
      - 信号/市场数据门槛替代学术理论（line 1354）
    """

    COLLECT_PENDING = Path(".docs/ai-skills/collect/pending")
    CURATE_STAGED = Path(".docs/ai-skills/curate/staged")

    # P0 simulate 模式: 信号类型 → 策略类型映射
    _SIGNAL_TO_STRATEGY: dict[str, str] = {
        "price_divergence": "cross_pool_arbitrage",
        "volume_spike": "volume_momentum",
        "lp_imbalance": "lp_imbalance_arb",
        "mean_revert": "mean_reversion",
        "whale_movement": "whale_follow",
    }

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        signals = [a for a in assets_input if a.kind == "market_signal"]
        if not signals:
            logger.warning("curate: no market_signal assets in input")
            return StepResult(success=False, metadata={"reason": "no_signals"})

        # --pair 过滤: 只处理指定的 pair（支持前缀匹配）
        target_pair = config.get("pair")
        if target_pair:
            signals = [s for s in signals if s.id == target_pair or s.id.startswith(target_pair)]
            if not signals:
                logger.warning("curate: pair filter '%s' matched 0 signals", target_pair)
                return StepResult(success=False, metadata={"reason": "pair_filter_empty"})
            logger.info("curate: pair filter '%s' → %d signals", target_pair, len(signals))

        simulate = config.get("simulate", True)
        if simulate:
            return self._curate_simulate(signals, config, workspace, trace_id)
        return self._curate_live(signals, config, workspace, trace_id)

    # ── live 模式: 委托 WQ-YI KnowledgeBaseSkill ──────────
    def _curate_live(
        self,
        signals: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """委托 WQ-YI brain-curate-knowledge (domain=defi) 提取骨架"""
        KnowledgeBaseSkill = self._load_wqyi_curate()
        if KnowledgeBaseSkill is None:
            logger.error("curate live: WQ-YI KnowledgeBaseSkill not available")
            return StepResult(success=False, metadata={"reason": "wqyi_unavailable"})

        asset_root = _get_asset_root(config, workspace)
        produced: list[AssetRef] = []
        errors: list[str] = []

        for sig in signals:
            pair_id = sig.id
            collect_dir = asset_root / self.COLLECT_PENDING / pair_id
            if not collect_dir.is_dir():
                logger.warning("curate: collect dir missing for %s", pair_id)
                errors.append(f"{pair_id}: collect_dir_missing")
                continue

            try:
                # 构造 paper dict (WQ-YI 格式)
                # Bug 2 fix: pair_id 作为 abbr（唯一性保证），不再 pair_id[:4].upper()
                paper_dict = {
                    "abbr": pair_id,
                    "name": pair_id,
                    "path": collect_dir,
                    "domain": "defi",  # ← 关键: 触发 DeFi 门槛逻辑
                    "trace_id": trace_id,  # ← 传递 trace_id 触发自动模式
                }

                # 委托 WQ-YI Skill
                logger.info("curate live: delegating %s to WQ-YI KnowledgeBaseSkill", pair_id)
                skill = KnowledgeBaseSkill(paper_dict)

                # Bug 3 fix: 覆盖 work_dir 到 AGV curate/staged（对齐 toolloop_arb.py）
                curate_dir = asset_root / self.CURATE_STAGED / pair_id
                curate_dir.mkdir(parents=True, exist_ok=True)
                skill.work_dir = curate_dir

                success = skill.run()

                if success:
                    skel_file = curate_dir / "step1_skeletons.yml"

                    if skel_file.exists():
                        skeletons = yaml.safe_load(skel_file.read_text("utf-8")) or {}
                        template_count = len(skeletons.get("tower_templates", [])) + len(skeletons.get("yi_templates", []))
                        # 兼容 DeFi skeleton 格式（旧 prompt 遗留）
                        if not template_count:
                            template_count = len(skeletons.get("strategy_templates", []))
                    else:
                        template_count = 0

                    produced.append(AssetRef(
                        kind="arb_strategy",
                        id=pair_id,
                        path=str(curate_dir.relative_to(asset_root)),
                        metadata={
                            "source": "curate_wqyi",
                            "trace_id": trace_id,
                            "templates": template_count,
                        },
                    ))
                    logger.info("curate live: WQ-YI produced %d templates for %s", template_count, pair_id)
                else:
                    errors.append(f"{pair_id}: wqyi_curate_failed")
                    logger.warning("curate live: WQ-YI failed for %s", pair_id)

                # Bug 4 fix: 清理 WQ-YI 在 collect/pending/ 内创建的残留目录
                for _meta_name in ("staged", "runs"):
                    _meta_dir = collect_dir.parent / _meta_name
                    if _meta_dir.is_dir():
                        import shutil
                        shutil.rmtree(_meta_dir, ignore_errors=True)
                        logger.debug("curate live: cleaned up %s from collect/pending/", _meta_name)

            except Exception as exc:
                logger.error("curate live failed for %s: %s", pair_id, exc)
                errors.append(f"{pair_id}: {exc}")

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "curate",
                "mode": "live_wqyi",
                "trace_id": trace_id,
                "curated": len(produced),
                "errors": errors[:10],
            },
        )

    @staticmethod
    def _load_wqyi_curate():
        """延迟导入 WQ-YI KnowledgeBaseSkill"""
        import sys
        wqyi_scripts = Path("/workspaces/WQ-YI/.gemini/skills/brain-curate-knowledge/scripts")
        if not wqyi_scripts.is_dir():
            logger.warning("curate: WQ-YI curate scripts not found at %s", wqyi_scripts)
            return None
        if str(wqyi_scripts) not in sys.path:
            sys.path.insert(0, str(wqyi_scripts))
        try:
            from skill_curate_knowledge import KnowledgeBaseSkill
            logger.info("curate: using WQ-YI KnowledgeBaseSkill (domain=defi)")
            return KnowledgeBaseSkill
        except ImportError as e:
            logger.warning("curate: failed to import KnowledgeBaseSkill: %s", e)
            return None

    # ── simulate 模式: 确定性本地映射 ──────────
    def _curate_simulate(
        self,
        signals: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """P0 simulate 模式: 确定性骨架生成（零 LLM）"""
        asset_root = _get_asset_root(config, workspace)
        produced: list[AssetRef] = []
        errors: list[str] = []

        for sig in signals:
            pair_id = sig.id
            collect_dir = asset_root / self.COLLECT_PENDING / pair_id
            if not collect_dir.is_dir():
                logger.warning("curate: collect dir missing for %s", pair_id)
                errors.append(f"{pair_id}: collect_dir_missing")
                continue

            try:
                # 读取 collect 产出（兼容两种格式）
                hints = self._load_yaml(collect_dir / "asset_hints.yml")
                idea = self._load_yaml(collect_dir / "idea_packet.yml")

                if idea:
                    signal_data = {"signals": idea.get("signals", [])}
                    mkt = idea.get("market_data", {})
                    src = idea.get("source_evidence", {})
                    pool_data = {
                        "pool_address": src.get("pool_address", ""),
                        "dex": src.get("dex", "PancakeSwap V2"),
                        "chain": src.get("network", "BSC"),
                        "price": mkt.get("price_usd", 0.0),
                        "tvl_usd": mkt.get("tvl_usd", 0.0),
                    }
                    if not signal_data["signals"] and idea.get("hypotheses"):
                        for h in idea["hypotheses"]:
                            signal_data["signals"].append({
                                "signal_type": h.get("strategy", "mean_revert"),
                                "strength": h.get("confidence", 0.5) * 100,
                                "source": "hypothesis",
                                "details": {"text": h.get("hypothesis", "")},
                            })
                else:
                    signal_data = self._load_yaml(collect_dir / "signal.yml")
                    pool_data = self._load_yaml(collect_dir / "pool_info.yml")

                curate_dir = asset_root / self.CURATE_STAGED / pair_id
                curate_dir.mkdir(parents=True, exist_ok=True)

                skeletons = self._build_skeletons(pair_id, signal_data, pool_data, hints)

                _report = validate_step_output("curate", skeletons)
                if not _report["valid"]:
                    logger.warning("curate schema validation for %s: %s", pair_id, _report["errors"])

                skel_file = curate_dir / "step1_skeletons.yml"
                skel_file.write_text(
                    yaml.dump(skeletons, default_flow_style=False, allow_unicode=True),
                    encoding="utf-8",
                )

                logger.info(
                    "curate simulate: wrote %d tower_templates to %s",
                    len(skeletons.get("tower_templates", [])), skel_file,
                )

                produced.append(AssetRef(
                    kind="arb_strategy",
                    id=pair_id,
                    path=str(curate_dir.relative_to(asset_root)),
                    metadata={
                        "source": "curate_simulate",
                        "trace_id": trace_id,
                        "templates": len(skeletons.get("tower_templates", [])),
                    },
                ))
            except Exception as exc:
                logger.error("curate simulate failed for %s: %s", pair_id, exc)
                errors.append(f"{pair_id}: {exc}")

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "curate",
                "mode": "simulate",
                "trace_id": trace_id,
                "curated": len(produced),
                "errors": errors[:10],
            },
        )

    def _build_skeletons(
        self,
        pair_id: str,
        signal_data: dict,
        pool_data: dict,
        hints: dict,
    ) -> dict[str, Any]:
        """从信号 + 池数据构建策略骨架（step1_skeletons.yml 格式）"""
        templates: list[dict[str, Any]] = []
        raw_signals = signal_data.get("signals", [])
        base_price = pool_data.get("price", 0.0)
        tvl = pool_data.get("tvl_usd", 0.0)

        for idx, sig in enumerate(raw_signals, 1):
            sig_type = sig.get("signal_type", "")
            strategy_type = self._SIGNAL_TO_STRATEGY.get(sig_type, "mean_reversion")
            raw_strength = sig.get("strength", 0.0)
            # 归一化到 0-1（collect 产出范围 0-100）
            strength = raw_strength / 100.0 if raw_strength > 1.0 else raw_strength

            templates.append({
                "skeleton_id": f"{pair_id}_{strategy_type}_{idx}",
                "strategy_type": strategy_type,
                "description": (
                    f"{strategy_type.replace('_', ' ').title()} on {pair_id} "
                    f"(signal strength={strength:.2f})"
                ),
                "target_pair": pair_id,
                "pool_address": pool_data.get("pool_address", ""),
                "dex": pool_data.get("dex", "PancakeSwap V2"),
                "chain": pool_data.get("chain", "BSC"),
                "entry_condition": f"{sig_type} > {strength:.2f}",
                "parameters": {
                    "base_price": base_price,
                    "tvl_usd": tvl,
                    "signal_strength": strength,
                    "min_trade_usd": hints.get("min_trade_usd", 5.0),
                    "max_trade_usd": hints.get("max_trade_usd", 20.0),
                },
                "signal_ref": sig,
            })

        return {
            "tower_templates": templates,
            "yi_templates": [],
            "pair": pair_id,
            "pool_info": {
                "pool_address": pool_data.get("pool_address", ""),
                "price": base_price,
                "tvl_usd": tvl,
            },
            "curated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    @staticmethod
    def _load_yaml(path: Path) -> dict:
        """安全加载 YAML（文件不存在返回空 dict）"""
        if not path.exists():
            return {}
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


# ─── DatasetOps（S5-Arb Step 3）───
class DatasetOps:
    """策略参数化 — L1 类别推荐 + L2 指标绑定

    simulate 模式 (P0): 确定性指标绑定 — 零 LLM/跨仓库依赖
    live 模式: 委托 WQ-YI brain-dataset-explorer 的 DeFi L1/L2 工具

    输入: arb_strategy AssetRef (curate 产出, 含 step1_skeletons.yml)
    输出: dataset_binding AssetRef (含 slot_categories.yml + indicator_binding.yml)
    """

    # curate 产出目录 → dataset 产出目录
    CURATE_STAGED = Path(".docs/ai-skills/curate/staged")
    COLLECT_STAGED = Path(".docs/ai-skills/collect/pending/staged")
    DATASET_OUTPUT = Path(".docs/ai-skills/dataset/output")

    # ── P0: 策略类型 → L1 类别映射（确定性） ──
    _STRATEGY_CATEGORIES: dict[str, list[str]] = {
        "cross_pool_arbitrage": ["price_feed", "liquidity_depth"],
        "volume_momentum":      ["volume_metrics", "momentum_indicators"],
        "lp_imbalance_arb":     ["lp_analytics", "price_feed"],
        "mean_reversion":       ["statistical_indicators", "price_feed"],
        "whale_follow":         ["on_chain_analytics", "volume_metrics"],
    }

    # ── P0: 类别 → L2 指标库（确定性 mock） ──
    _CATEGORY_INDICATORS: dict[str, list[dict[str, Any]]] = {
        "price_feed": [
            {"indicator_name": "price_ema_12", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.35},
            {"indicator_name": "price_sma_26", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.25},
            {"indicator_name": "price_spread_bps", "source": "cex_reference", "delay_seconds": 5, "weight": 0.40},
        ],
        "volume_metrics": [
            {"indicator_name": "volume_24h_usd", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.30},
            {"indicator_name": "volume_ma_7d", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.30},
            {"indicator_name": "buy_sell_ratio", "source": "on_chain", "delay_seconds": 1, "weight": 0.40},
        ],
        "momentum_indicators": [
            {"indicator_name": "rsi_14", "source": "computed", "delay_seconds": 0, "weight": 0.40},
            {"indicator_name": "macd_signal", "source": "computed", "delay_seconds": 0, "weight": 0.35},
            {"indicator_name": "price_change_pct_1h", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.25},
        ],
        "liquidity_depth": [
            {"indicator_name": "tvl_usd", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.40},
            {"indicator_name": "reserve_ratio", "source": "on_chain", "delay_seconds": 1, "weight": 0.30},
            {"indicator_name": "depth_imbalance_bps", "source": "on_chain", "delay_seconds": 1, "weight": 0.30},
        ],
        "lp_analytics": [
            {"indicator_name": "lp_token_supply", "source": "on_chain", "delay_seconds": 1, "weight": 0.35},
            {"indicator_name": "impermanent_loss_pct", "source": "computed", "delay_seconds": 0, "weight": 0.35},
            {"indicator_name": "fee_apy_7d", "source": "dex_aggregator", "delay_seconds": 0, "weight": 0.30},
        ],
        "statistical_indicators": [
            {"indicator_name": "price_zscore_24h", "source": "computed", "delay_seconds": 0, "weight": 0.40},
            {"indicator_name": "bollinger_width", "source": "computed", "delay_seconds": 0, "weight": 0.30},
            {"indicator_name": "volatility_1h", "source": "computed", "delay_seconds": 0, "weight": 0.30},
        ],
        "on_chain_analytics": [
            {"indicator_name": "large_tx_count_1h", "source": "on_chain", "delay_seconds": 2, "weight": 0.40},
            {"indicator_name": "unique_traders_1h", "source": "on_chain", "delay_seconds": 2, "weight": 0.30},
            {"indicator_name": "net_flow_usd_1h", "source": "on_chain", "delay_seconds": 2, "weight": 0.30},
        ],
    }

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        strategies = [a for a in assets_input if a.kind == "arb_strategy"]
        if not strategies:
            logger.warning("dataset: no arb_strategy assets in input")
            return StepResult(success=False, metadata={"reason": "no_strategies"})

        # --pair 过滤: 只处理指定的 pair
        target_pair = config.get("pair")
        if target_pair:
            strategies = [s for s in strategies if s.id == target_pair or s.id.startswith(target_pair)]
            if not strategies:
                logger.warning("dataset: pair filter '%s' matched 0 strategies", target_pair)
                return StepResult(success=False, metadata={"reason": "pair_filter_empty"})
            logger.info("dataset: pair filter '%s' → %d strategies", target_pair, len(strategies))

        simulate = config.get("simulate", True)
        if simulate:
            return self._dataset_simulate(strategies, config, workspace, trace_id)
        return self._dataset_live(strategies, config, workspace, trace_id)

    # ── P0: simulate 模式（零依赖确定性绑定） ──────────
    def _dataset_simulate(
        self,
        strategies: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """从 curate 骨架确定性生成 slot_categories + indicator_binding。"""
        asset_root = _get_asset_root(config, workspace)
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        produced: list[AssetRef] = []
        errors: list[str] = []

        for strat in strategies:
            pair_id = strat.id
            skeleton_file = self._find_skeleton(strat, asset_root)
            if skeleton_file is None:
                errors.append(f"{pair_id}: skeleton_not_found")
                continue

            skeletons = yaml.safe_load(skeleton_file.read_text("utf-8")) or {}
            templates = skeletons.get("tower_templates") or skeletons.get("strategy_templates", [])
            if not templates:
                errors.append(f"{pair_id}: empty_templates")
                continue

            output_dir = asset_root / self.DATASET_OUTPUT / pair_id
            output_dir.mkdir(parents=True, exist_ok=True)

            # 为每个 skeleton 生成 binding
            all_bindings: list[dict[str, Any]] = []
            all_categories: set[str] = set()

            for tpl in templates:
                skel_id = tpl.get("skeleton_id", pair_id)
                strategy_type = tpl.get("strategy_type", "mean_reversion")
                categories = self._STRATEGY_CATEGORIES.get(
                    strategy_type, ["price_feed"]
                )
                all_categories.update(categories)

                # L2: 从类别映射中收集指标
                bindings: list[dict[str, Any]] = []
                for cat in categories:
                    indicators = self._CATEGORY_INDICATORS.get(cat, [])
                    for ind in indicators:
                        bindings.append({
                            "indicator_name": ind["indicator_name"],
                            "category": cat,
                            "source": ind.get("source", "computed"),
                            "delay_seconds": ind.get("delay_seconds", 0),
                            "weight": ind.get("weight", 0.33),
                        })

                binding_doc = {
                    "pair_id": pair_id,
                    "skeleton_id": skel_id,
                    "strategy_type": strategy_type,
                    "slot_categories": categories,
                    "bindings": bindings,
                    "bound_at": now_iso,
                    "mode": "simulate",
                }

                # P1: schema 校验
                _report = validate_step_output("dataset", binding_doc)
                if not _report["valid"]:
                    logger.warning("dataset schema validation for %s/%s: %s",
                                   pair_id, skel_id, _report["errors"])

                all_bindings.append(binding_doc)

            # 写 slot_categories.yml
            cat_doc = {
                "pair_id": pair_id,
                "categories": sorted(all_categories),
                "by_skeleton": {
                    b["skeleton_id"]: b["slot_categories"]
                    for b in all_bindings
                },
                "generated_at": now_iso,
            }
            (output_dir / "slot_categories.yml").write_text(
                yaml.dump(cat_doc, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            # 写 indicator_binding.yml（首个 skeleton 为主绑定）
            primary = all_bindings[0] if all_bindings else {}
            (output_dir / "indicator_binding.yml").write_text(
                yaml.dump(primary, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            # 多 skeleton 时写 all_bindings.yml
            if len(all_bindings) > 1:
                (output_dir / "all_bindings.yml").write_text(
                    yaml.dump(all_bindings, default_flow_style=False, allow_unicode=True),
                    encoding="utf-8",
                )

            produced.append(AssetRef(
                kind="dataset_binding",
                id=pair_id,
                path=str(output_dir.relative_to(asset_root)),
                metadata={
                    "source": "dataset",
                    "trace_id": trace_id,
                    "l1_count": len(all_categories),
                    "l2_count": sum(len(b["bindings"]) for b in all_bindings),
                    "skeletons": len(all_bindings),
                    "simulate": True,
                },
            ))

        logger.info(
            "dataset: wrote %d bindings (simulate=True, pairs=%s)",
            len(produced), [p.id for p in produced],
        )
        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "dataset",
                "trace_id": trace_id,
                "bound": len(produced),
                "mode": "simulate",
                "errors": errors[:10],
            },
        )

    # ── live 模式（LLM-driven，需 WQ-YI 跨仓库导入） ──
    def _dataset_live(
        self,
        strategies: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """委托 WQ-YI brain-dataset-explorer 的 DeFi L1/L2 工具。"""
        asset_root = _get_asset_root(config, workspace)
        ai_flash, ai_pro = self._load_ai_clients()
        L1Recommender, L2Binder = self._load_modules()
        knowledge_dir = self._knowledge_dir()

        produced: list[AssetRef] = []
        errors: list[str] = []

        # max_pools 限制 LLM 处理量（live 模式下池数量可能很大）
        max_pools = config.get("max_pools")
        if max_pools and len(strategies) > max_pools:
            logger.info("dataset: truncating %d→%d pools (max_pools=%d)",
                        len(strategies), max_pools, max_pools)
            strategies = strategies[:max_pools]

        for strat in strategies:
            pair_id = strat.id
            skeleton_file = self._find_skeleton(strat, asset_root)
            if skeleton_file is None:
                errors.append(f"{pair_id}: skeleton_not_found")
                continue

            output_dir = asset_root / self.DATASET_OUTPUT / pair_id
            output_dir.mkdir(parents=True, exist_ok=True)

            try:
                l1 = L1Recommender(
                    ai_client=ai_flash, pro_client=ai_pro,
                    knowledge_dir=knowledge_dir,
                )
                l1_results = l1.recommend_all(skeleton_file, output_dir)
                if not l1_results:
                    errors.append(f"{pair_id}: l1_empty")
                    continue

                l1_file = output_dir / "slot_categories.yml"

                l2 = L2Binder(
                    ai_client=ai_flash, pro_client=ai_pro,
                    knowledge_dir=knowledge_dir,
                )
                l2_results = l2.bind_all(l1_file, skeleton_file, output_dir)

                produced.append(AssetRef(
                    kind="dataset_binding",
                    id=pair_id,
                    path=str(output_dir.relative_to(asset_root)),
                    metadata={
                        "source": "dataset",
                        "trace_id": trace_id,
                        "l1_count": len(l1_results),
                        "l2_count": len(l2_results),
                        "simulate": False,
                    },
                ))
            except Exception as exc:
                logger.error("dataset(live) failed for %s: %s", pair_id, exc)
                errors.append(f"{pair_id}: {exc}")

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "dataset",
                "trace_id": trace_id,
                "bound": len(produced),
                "mode": "live",
                "errors": errors[:10],
            },
        )

    def _find_skeleton(self, strat: AssetRef, asset_root: Path) -> Path | None:
        """定位 curate 产出的 step1_skeletons.yml（在 asset_root 下查找）"""
        # 优先: AssetRef.path 指向的目录
        if strat.path:
            candidate = asset_root / strat.path / "step1_skeletons.yml"
            if candidate.exists():
                return candidate

        pair_id = strat.id
        # 回退 1: curate staged
        candidate = asset_root / self.CURATE_STAGED / pair_id / "step1_skeletons.yml"
        if candidate.exists():
            return candidate
        # 回退 2: collect pending staged
        candidate = asset_root / self.COLLECT_STAGED / pair_id / "step1_skeletons.yml"
        if candidate.exists():
            return candidate

        logger.warning("dataset: step1_skeletons.yml not found for %s", pair_id)
        return None

    @staticmethod
    def _load_ai_clients() -> tuple[Any, Any]:
        """加载 Gemini Flash + Pro 客户端（via nexrur）"""
        from nexrur.clients import create_client, NexrurCredentials

        creds = NexrurCredentials()
        flash = create_client(creds, flash=True)
        if flash is None:
            flash = create_client(creds, flash=False)
        if flash is None:
            raise RuntimeError(
                "DeFi Dataset requires LLM — GEMINI_API_KEY not configured"
            )
        pro = create_client(creds, flash=False)
        return flash, pro

    @staticmethod
    def _load_modules() -> tuple[type, type]:
        """延迟导入 L1/L2 模块（委托 WQ-YI brain-dataset-explorer — Flash+Pro 完整版）

        架构: AGV Campaign 委托 WQ-YI subagent 的 DeFi L1/L2 工具
        - WQ-YI toolloop_arb_l1: 362 行, 5 阶段 Pipeline, Flash + Pro 仲裁
        - WQ-YI toolloop_arb_l2: 380 行, 5 阶段 Pipeline, Flash + Pro 仲裁

        S5-R1: AGV 不持有 L1/L2 副本 — 必须委托 WQ-YI
        """
        import sys
        _wqyi_scripts_dir = Path("/workspaces/WQ-YI/.gemini/skills/brain-dataset-explorer/scripts")
        if not _wqyi_scripts_dir.is_dir():
            raise RuntimeError(
                f"Dataset requires WQ-YI DeFi L1/L2 — {_wqyi_scripts_dir} not found. "
                "确保 WQ-YI workspace 存在且路径正确。"
            )
        if str(_wqyi_scripts_dir) not in sys.path:
            sys.path.insert(0, str(_wqyi_scripts_dir))
        logger.info("dataset: using WQ-YI DeFi L1/L2 (Flash+Pro)")

        from toolloop_arb_l1 import DeFiL1Recommender  # type: ignore[import-untyped]
        from toolloop_arb_l2 import DeFiL2Binder  # type: ignore[import-untyped]
        return DeFiL1Recommender, DeFiL2Binder

    @staticmethod
    def _knowledge_dir() -> Path:
        """DeFi factor knowledge 文件目录（委托 WQ-YI — 4 个 _defi_*.yml 共 25KB）

        S5-R1: AGV 不持有 knowledge 副本 — 必须委托 WQ-YI
        """
        wqyi_kdir = Path("/workspaces/WQ-YI/.gemini/skills/brain-dataset-explorer/knowledge/categories")
        if not wqyi_kdir.is_dir():
            raise RuntimeError(
                f"Dataset requires WQ-YI DeFi knowledge — {wqyi_kdir} not found. "
                "确保 WQ-YI workspace 存在且路径正确。"
            )
        return wqyi_kdir


# ─── ArbExecuteOps（S5-Arb Step 4）───
class ArbExecuteOps:
    """执行套利交易

    dry_run 模式: 真实链上数据 + eth_call 仿真 — 除了不花钱，与 live 完全一致
    simulate=True / execute_simulate=True: 向后兼容别名，内部统一映射到 dry_run
    live 模式: 桥接 toolloop_arb._step_execute + SafetyArmor + RealDex
    """

    DATASET_OUTPUT = Path(".docs/ai-skills/dataset/output")
    EXECUTE_OUTPUT = Path(".docs/ai-skills/execute/output")
    EXECUTE_SIMULATOR = Path(".docs/ai-skills/execute/simulator")

    def __init__(self, safety: SafetyArmor | None = None,
                 campaign: Any = None):
        self.safety = safety or SafetyArmor()
        self._campaign = campaign  # 预配置的 ArbCampaignLoop（含真实 executor）

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        bindings = [a for a in assets_input if a.kind == "dataset_binding"]
        if not bindings:
            logger.warning("execute: no dataset_binding assets in input")
            return StepResult(success=False, metadata={"reason": "no_bindings"})

        # --pair 过滤: 只处理指定的 pair
        target_pair = config.get("pair")
        if target_pair:
            bindings = [b for b in bindings if b.id == target_pair or b.id.startswith(target_pair)]
            if not bindings:
                logger.warning("execute: pair filter '%s' matched 0 bindings", target_pair)
                return StepResult(success=False, metadata={"reason": "pair_filter_empty"})
            logger.info("execute: pair filter '%s' → %d bindings", target_pair, len(bindings))

        # execute 默认安全模式 = dry_run。
        # 旧 simulate / execute_simulate 标志统一映射到 dry_run，产出继续写 simulator/。
        dry_run = (
            config.get("dry_run", False)
            or config.get("simulate", True)
            or config.get("execute_simulate", False)
        )
        if dry_run:
            return self._execute_dry_run(bindings, config, workspace, trace_id)
        return self._execute_live(bindings, config, workspace, trace_id)

    # ── dry_run 模式（真实链上数据 + eth_call，不花钱） ──────────
    def _execute_dry_run(
        self,
        bindings: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """复用 live 全部代码链路（pre_flight → reserves → 安全护甲 → build_tx），
        仅在最后一步替换: send_raw_transaction → eth_call。

        与 live 的唯一区别 = DryRunDexExecutor 替代 DexExecutor。
        产出写入 execute/simulator/（与 P0 simulate 共享目录）。
        """
        asset_root = _get_asset_root(config, workspace)

        # ── 快速预检：先扫描 bindings 的文件存在性，避免不必要的凭据加载 ──
        precheck_errors: list[str] = []
        valid_bindings: list[AssetRef] = []
        for binding in bindings:
            pair_id = binding.id
            output_dir = asset_root / (binding.path or str(self.DATASET_OUTPUT / pair_id))
            ind_file = output_dir / "indicator_binding.yml"
            if not ind_file.exists():
                precheck_errors.append(f"{pair_id}: indicator_binding.yml not found")
            else:
                valid_bindings.append(binding)

        # 如果没有有效 binding，提前返回错误（不加载凭据）
        if not valid_bindings:
            return StepResult(
                success=False,
                assets_produced=[],
                metadata={"errors": precheck_errors, "reason": "no_valid_bindings"},
            )

        campaign = self._make_campaign({**config, "_force_dry_run": True}, workspace)

        produced: list[AssetRef] = []
        errors: list[str] = precheck_errors.copy()  # 保留预检错误
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        for binding in valid_bindings:
            pair_id = binding.id
            output_dir = asset_root / (binding.path or str(self.DATASET_OUTPUT / pair_id))

            ind_file = output_dir / "indicator_binding.yml"
            cat_file = output_dir / "slot_categories.yml"
            # ind_file 存在性已在预检中验证

            pool_info = self._resolve_pool(pair_id, asset_root)
            strategies = self._build_strategies(ind_file, cat_file, pool_info)

            if not strategies:
                errors.append(f"{pair_id}: no strategies built")
                continue

            loop = asyncio.new_event_loop()
            try:
                results = loop.run_until_complete(campaign._step_execute(strategies))
            finally:
                loop.close()

            ok = sum(1 for r in results if r.get("status") == "success")
            total_gas = sum(r.get("gas_used", 0) for r in results)

            # 写入 execution_result.yml（dry_run → simulator/ 目录）
            exec_doc = {
                "pair_id": pair_id,
                "strategy_id": strategies[0].strategy_id if strategies else pair_id,
                "mode": "dry_run",
                "executed_at": now_iso,
                "trades": [
                    {
                        "trade_id": f"dryrun_{pair_id}_{i}",
                        "action": "swap",
                        "status": r.get("status", "unknown"),
                        "tx_hash": r.get("tx_hash", ""),
                        "gas_used": r.get("gas_used", 0),
                        "block_number": r.get("block_number", 0),
                        "amount_in": r.get("amount_in", 0),
                        "amount_out": r.get("amount_out", 0),
                        "revert_reason": r.get("revert_reason"),
                        "dry_run": True,
                    }
                    for i, r in enumerate(results)
                ],
                "summary": {
                    "total_trades": len(results),
                    "successful": ok,
                    "failed": len(results) - ok,
                    "total_gas": total_gas,
                },
            }

            exec_dir = asset_root / self.EXECUTE_SIMULATOR / pair_id
            exec_dir.mkdir(parents=True, exist_ok=True)
            (exec_dir / "execution_result.yml").write_text(
                yaml.dump(exec_doc, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            produced.append(AssetRef(
                kind="execution_result",
                id=pair_id,
                path=str(exec_dir.relative_to(asset_root)),
                metadata={
                    "source": "execute",
                    "trace_id": trace_id,
                    "total": len(results),
                    "success": ok,
                    "results": results,
                    "simulate": False,
                    "dry_run": True,
                },
            ))

        logger.info(
            "execute: wrote %d results (dry_run=True, pairs=%s)",
            len(produced), [p.id for p in produced],
        )
        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "execute",
                "trace_id": trace_id,
                "executed": len(produced),
                "mode": "dry_run",
                "errors": errors[:10],
            },
        )

    # ── live 模式（真实/SimDex 执行器） ──────────
    def _execute_live(
        self,
        bindings: list[AssetRef],
        config: dict,
        workspace: Path,
        trace_id: str,
    ) -> StepResult:
        """桥接 ArbCampaignLoop._step_execute + SafetyArmor。"""
        asset_root = _get_asset_root(config, workspace)
        campaign = self._campaign or self._make_campaign(config, workspace)

        produced: list[AssetRef] = []
        errors: list[str] = []
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        for binding in bindings:
            pair_id = binding.id
            output_dir = asset_root / (binding.path or str(self.DATASET_OUTPUT / pair_id))

            ind_file = output_dir / "indicator_binding.yml"
            cat_file = output_dir / "slot_categories.yml"

            if not ind_file.exists():
                errors.append(f"{pair_id}: indicator_binding.yml not found")
                continue

            pool_info = self._resolve_pool(pair_id, asset_root)
            strategies = self._build_strategies(ind_file, cat_file, pool_info)

            if not strategies:
                errors.append(f"{pair_id}: no strategies built")
                continue

            loop = asyncio.new_event_loop()
            try:
                results = loop.run_until_complete(campaign._step_execute(strategies))
            finally:
                loop.close()

            ok = sum(1 for r in results if r.get("status") == "success")
            total_gas = sum(r.get("gas_used", 0) for r in results)

            # 写入 execution_result.yml（live → output/ 目录）
            exec_doc = {
                "pair_id": pair_id,
                "strategy_id": strategies[0].strategy_id if strategies else pair_id,
                "mode": "live",
                "executed_at": now_iso,
                "trades": [
                    {
                        "trade_id": f"live_{pair_id}_{i}",
                        "action": "swap",
                        "status": r.get("status", "unknown"),
                        "tx_hash": r.get("tx_hash", ""),
                        "gas_used": r.get("gas_used", 0),
                        "block_number": r.get("block_number", 0),
                        "amount_in": r.get("amount_in", 0),
                        "amount_out": r.get("amount_out", 0),
                        "revert_reason": r.get("reason"),
                    }
                    for i, r in enumerate(results)
                ],
                "summary": {
                    "total_trades": len(results),
                    "successful": ok,
                    "failed": len(results) - ok,
                    "total_gas": total_gas,
                },
            }

            exec_dir = asset_root / self.EXECUTE_OUTPUT / pair_id
            exec_dir.mkdir(parents=True, exist_ok=True)
            (exec_dir / "execution_result.yml").write_text(
                yaml.dump(exec_doc, default_flow_style=False, allow_unicode=True),
                encoding="utf-8",
            )

            produced.append(AssetRef(
                kind="execution_result",
                id=pair_id,
                path=str(exec_dir.relative_to(asset_root)),
                metadata={
                    "source": "execute",
                    "trace_id": trace_id,
                    "total": len(results),
                    "success": ok,
                    "results": results,
                    "simulate": False,
                },
            ))

        logger.info(
            "execute: wrote %d results (live, pairs=%s)",
            len(produced), [p.id for p in produced],
        )
        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "execute",
                "trace_id": trace_id,
                "executed": len(produced),
                "mode": "live",
                "errors": errors[:10],
            },
        )

    def _make_campaign(self, config: dict, workspace: Path) -> Any:
        """创建 ArbCampaignLoop（无预配置 campaign 时的兜底）"""
        import sys
        _scripts_dir = Path(__file__).resolve().parents[2] / "agv-mm-arb" / "scripts"
        if str(_scripts_dir) not in sys.path:
            sys.path.insert(0, str(_scripts_dir))
        from toolloop_arb import ArbCampaignLoop  # type: ignore[import-untyped]
        from toolloop_mm import (  # type: ignore[import-untyped]
            SlippageGuard, MEVGuard, TVLBreaker, ApproveManager,
            DexExecutor, DryRunDexExecutor,
        )

        dry_run = (
            config.get("dry_run", False)
            or config.get("simulate", False)
            or config.get("execute_simulate", False)
            or config.get("_force_dry_run", False)
        )

        if dry_run:
            # DryRun 模式：真实链上读 + eth_call，不花钱
            from toolloop_mm import PancakeV2Adapter  # type: ignore[import-untyped]
            w3, pk = self._load_web3_credentials(workspace, config)
            adapter = PancakeV2Adapter(web3=w3, private_key=pk)
            executor = DryRunDexExecutor(
                adapter=adapter,
                config=config.get("executor", {}),
            )
            logger.info("execute: using DryRunDexExecutor (simulator path, account=%s)",
                        adapter.get_account())
        else:
            # Live 模式：接线 web3 + PancakeV2Adapter
            from toolloop_mm import PancakeV2Adapter  # type: ignore[import-untyped]
            w3, pk = self._load_web3_credentials(workspace, config)
            adapter = PancakeV2Adapter(web3=w3, private_key=pk)
            executor = DexExecutor(
                adapter=adapter,
                config=config.get("executor", {}),
            )
            logger.info("execute: using DexExecutor (live mode, account=%s)",
                        adapter.get_account())

        # ApproveManager 也需要 web3（live / dry_run 模式）
        approve_mgr = ApproveManager()
        if dry_run:
            approve_mgr = ApproveManager(web3=w3, private_key=pk)
        elif not dry_run:
            # Live 模式同样需要真实 allowance 管理。
            approve_mgr = ApproveManager(web3=w3, private_key=pk)

        # DryRun + force_entry: 跳过 SignalEvaluator，直接测 swap 链路
        loop_config = dict(config)
        if dry_run:
            loop_config.setdefault("force_entry", True)

        return ArbCampaignLoop(
            config=loop_config,
            executor=executor,
            slippage_guard=SlippageGuard(max_slippage_pct=self.safety.slippage.threshold),
            tvl_breaker=TVLBreaker(min_tvl_usd=self.safety.tvl.floor_usd),
            mev_guard=MEVGuard(),
            approve_manager=approve_mgr,
            workspace=workspace,
        )

    @staticmethod
    def _load_web3_credentials(workspace: Path, config: dict | None = None) -> tuple:
        """加载 .env.s5 中的 RPC URL 和私钥，返回 (Web3, private_key)

        双根架构: workspace=nexrur, asset_root=AGV。
        .env.s5 在 AGV 根目录，需要通过 config['_asset_root'] 定位。
        """
        import os
        from web3 import Web3
        from dotenv import load_dotenv

        # 构建搜索路径：asset_root > workspace > 向上遍历
        search_paths: list[Path] = []
        if config:
            ar = config.get("_asset_root")
            if ar:
                search_paths.append(Path(ar))
        search_paths.append(Path(workspace))
        search_paths.extend([workspace.parent, workspace.parent.parent])

        # .env.s5 优先（D3 双文件架构）
        env_s5: Path | None = None
        for base in search_paths:
            candidate = base / ".env.s5"
            if candidate.exists():
                env_s5 = candidate
                break
        if env_s5 is not None:
            load_dotenv(env_s5, override=True)

        rpc_url = os.getenv(
            "BSC_PRIVATE_RPC_URL",
            "https://bsc-dataseed1.binance.org",
        )
        private_key = os.getenv("MM_PRIVATE_KEY", "")
        if not private_key:
            raise RuntimeError(
                "MM_PRIVATE_KEY not found in .env.s5 — "
                "live mode requires a configured wallet"
            )

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise RuntimeError(f"Cannot connect to BSC RPC: {rpc_url}")

        return w3, private_key

    @staticmethod
    def _resolve_pool(pair_id: str, workspace: Path) -> dict:
        """动态导入 _resolve_pool_info"""
        import sys
        _scripts_dir = Path(__file__).resolve().parents[2] / "agv-mm-arb" / "scripts"
        if str(_scripts_dir) not in sys.path:
            sys.path.insert(0, str(_scripts_dir))
        from toolloop_arb import _resolve_pool_info  # type: ignore[import-untyped]
        return _resolve_pool_info(pair_id, workspace)

    @staticmethod
    def _build_strategies(ind_file: Path, cat_file: Path, pool_info: dict) -> list:
        """动态导入 build_strategies_from_binding"""
        import sys
        _scripts_dir = Path(__file__).resolve().parents[2] / "agv-mm-arb" / "scripts"
        if str(_scripts_dir) not in sys.path:
            sys.path.insert(0, str(_scripts_dir))
        from toolloop_arb import build_strategies_from_binding  # type: ignore[import-untyped]
        return build_strategies_from_binding(ind_file, cat_file, pool_info)


# ─── FixOps（S5-Arb Step 5）───
class FixOps:
    """策略修复 — 三级回退（权重调整 / curate 回退 / 策略重构）"""

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        return StepResult(
            success=True,
            metadata={"step": "fix", "trace_id": trace_id},
        )


# ─── 注册帮助器 ───
def register_arb_ops(registry: Any) -> None:
    """将 Arb-Campaign 5 个 Ops 注册到 OpsRegistry"""
    safety = SafetyArmor()
    registry.register("collect", CollectOps())
    registry.register("curate", CurateOps())
    registry.register("dataset", DatasetOps())
    registry.register("execute", ArbExecuteOps(safety=safety, campaign=None))
    registry.register("fix", FixOps())


# ─── 导出 ───
ARB_OPS_MAP = {
    "collect":  CollectOps,
    "curate":  CurateOps,
    "dataset": DatasetOps,
    "execute": ArbExecuteOps,
    "fix":     FixOps,
}
