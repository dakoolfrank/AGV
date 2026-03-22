"""
S5-Arb AgentOps 桥接层

Arb-Campaign 因子套利模式（5 步 collect→curate→dataset→execute→fix）
每个 Ops 遵守 nexrur AgentOpsProtocol: (*) → StepResult
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from nexrur.engines.orchestrator import AssetRef, StepResult

# 安全护甲复用 MM 的共享组件
from _shared.engines.agent_ops_mm import SafetyArmor

logger = logging.getLogger(__name__)


# ─── CollectOps（S5-Arb Step 1）───
class CollectOps:
    """收集外部 DEX 浅池市场信号，发现套利机会"""

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
            assets_produced=[
                AssetRef(kind="market_signal", id="arb-signal", metadata={"source": "collect"}),
            ],
            metadata={"step": "collect", "trace_id": trace_id},
        )


# ─── CurateOps（S5-Arb Step 2）───
class CurateOps:
    """从 market_signal 中提取策略骨架 — 委托 WQ-YI KnowledgeBaseSkill (domain=defi)"""

    # collect pending 目录 → curate staged 目录
    COLLECT_PENDING = Path(".docs/ai-skills/collect/pending")
    CURATE_STAGED = Path(".docs/ai-skills/curate/staged")

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        # 过滤上游 market_signal 资产
        signals = [a for a in assets_input if a.kind == "market_signal"]
        if not signals:
            logger.warning("curate: no market_signal assets in input")
            return StepResult(success=False, metadata={"reason": "no_signals"})

        produced: list[AssetRef] = []
        errors: list[str] = []

        for sig in signals:
            pair_id = sig.id
            collect_dir = workspace / self.COLLECT_PENDING / pair_id
            if not collect_dir.is_dir():
                logger.warning("curate: collect dir missing for %s", pair_id)
                errors.append(f"{pair_id}: collect_dir_missing")
                continue

            # 构建 paper dict（KnowledgeBaseSkill 协议）
            paper = {
                "abbr": pair_id,
                "name": pair_id,
                "path": str(collect_dir),
                "domain": "defi",
            }

            try:
                skill = self._load_skill(paper)
                # 重写 work_dir → curate staged 目录
                curate_dir = workspace / self.CURATE_STAGED / pair_id
                curate_dir.mkdir(parents=True, exist_ok=True)
                skill.work_dir = curate_dir

                success = skill.run()
                if success:
                    produced.append(AssetRef(
                        kind="arb_strategy",
                        id=pair_id,
                        path=str(curate_dir.relative_to(workspace)),
                        metadata={"source": "curate", "trace_id": trace_id},
                    ))
                else:
                    errors.append(f"{pair_id}: curate_failed")
            except Exception as exc:
                logger.error("curate failed for %s: %s", pair_id, exc)
                errors.append(f"{pair_id}: {exc}")

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "curate",
                "trace_id": trace_id,
                "curated": len(produced),
                "errors": errors[:10],
            },
        )

    @staticmethod
    def _load_skill(paper: dict) -> Any:
        """延迟导入 KnowledgeBaseSkill（跨仓库 WQ-YI）"""
        import sys
        _curate_dir = Path(__file__).resolve().parents[5] / "WQ-YI" / ".gemini" / "skills" / "brain-curate-knowledge" / "scripts"
        if str(_curate_dir) not in sys.path:
            sys.path.insert(0, str(_curate_dir))
        from skill_curate_knowledge import KnowledgeBaseSkill  # type: ignore[import-untyped]
        return KnowledgeBaseSkill(paper)


# ─── DatasetOps（S5-Arb Step 3）───
class DatasetOps:
    """策略参数化 — L1 类别推荐 + L2 指标绑定 (LLM-driven)

    委托 WQ-YI brain-dataset-explorer 的 DeFi 工具:
      - toolloop_arb_l1.DeFiL1Recommender → slot_categories.yml
      - toolloop_arb_l2.DeFiL2Binder     → indicator_binding.yml

    输入: arb_strategy AssetRef (curate 产出, 含 step1_skeletons.yml)
    输出: dataset_binding AssetRef (含 slot_categories.yml + indicator_binding.yml)
    """

    # curate 产出目录 → dataset 产出目录
    CURATE_STAGED = Path(".docs/ai-skills/curate/staged")
    COLLECT_STAGED = Path(".docs/ai-skills/collect/pending/staged")
    DATASET_OUTPUT = Path(".docs/ai-skills/dataset/output")

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

        # 延迟加载 LLM + L1/L2 模块
        ai_flash, ai_pro = self._load_ai_clients()
        L1Recommender, L2Binder = self._load_modules()
        knowledge_dir = self._knowledge_dir()

        produced: list[AssetRef] = []
        errors: list[str] = []

        for strat in strategies:
            pair_id = strat.id
            skeleton_file = self._find_skeleton(strat, workspace)
            if skeleton_file is None:
                errors.append(f"{pair_id}: skeleton_not_found")
                continue

            output_dir = workspace / self.DATASET_OUTPUT / pair_id
            output_dir.mkdir(parents=True, exist_ok=True)

            try:
                # L1: 类别推荐
                l1 = L1Recommender(
                    ai_client=ai_flash, pro_client=ai_pro,
                    knowledge_dir=knowledge_dir,
                )
                l1_results = l1.recommend_all(skeleton_file, output_dir)
                if not l1_results:
                    errors.append(f"{pair_id}: l1_empty")
                    continue

                l1_file = output_dir / "slot_categories.yml"

                # L2: 指标绑定
                l2 = L2Binder(
                    ai_client=ai_flash, pro_client=ai_pro,
                    knowledge_dir=knowledge_dir,
                )
                l2_results = l2.bind_all(l1_file, skeleton_file, output_dir)

                produced.append(AssetRef(
                    kind="dataset_binding",
                    id=pair_id,
                    path=str(output_dir.relative_to(workspace)),
                    metadata={
                        "source": "dataset",
                        "trace_id": trace_id,
                        "l1_count": len(l1_results),
                        "l2_count": len(l2_results),
                    },
                ))
            except Exception as exc:
                logger.error("dataset failed for %s: %s", pair_id, exc)
                errors.append(f"{pair_id}: {exc}")

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "dataset",
                "trace_id": trace_id,
                "bound": len(produced),
                "errors": errors[:10],
            },
        )

    def _find_skeleton(self, strat: AssetRef, workspace: Path) -> Path | None:
        """定位 curate 产出的 step1_skeletons.yml"""
        # 优先: AssetRef.path 指向的目录
        if strat.path:
            candidate = workspace / strat.path / "step1_skeletons.yml"
            if candidate.exists():
                return candidate

        pair_id = strat.id
        # 回退 1: curate staged
        candidate = workspace / self.CURATE_STAGED / pair_id / "step1_skeletons.yml"
        if candidate.exists():
            return candidate
        # 回退 2: collect pending staged
        candidate = workspace / self.COLLECT_STAGED / pair_id / "step1_skeletons.yml"
        if candidate.exists():
            return candidate

        logger.warning("dataset: step1_skeletons.yml not found for %s", pair_id)
        return None

    @staticmethod
    def _load_ai_clients() -> tuple[Any, Any]:
        """加载 Gemini Flash + Pro 客户端"""
        from brain_alpha.infra.llm import (
            load_gemini_client_from_settings,
            load_gemini_flash_client,
        )
        flash = load_gemini_flash_client()
        if flash is None:
            flash = load_gemini_client_from_settings()
        if flash is None:
            raise RuntimeError(
                "DeFi Dataset requires LLM — GEMINI_API_KEY not configured"
            )
        pro = load_gemini_client_from_settings()
        return flash, pro

    @staticmethod
    def _load_modules() -> tuple[type, type]:
        """延迟导入 L1/L2 模块（跨仓库 WQ-YI）"""
        import sys
        _ds_dir = (
            Path(__file__).resolve().parents[5]
            / "WQ-YI" / ".gemini" / "skills"
            / "brain-dataset-explorer" / "scripts"
        )
        if str(_ds_dir) not in sys.path:
            sys.path.insert(0, str(_ds_dir))
        from toolloop_arb_l1 import DeFiL1Recommender  # type: ignore[import-untyped]
        from toolloop_arb_l2 import DeFiL2Binder  # type: ignore[import-untyped]
        return DeFiL1Recommender, DeFiL2Binder

    @staticmethod
    def _knowledge_dir() -> Path:
        """DeFi category knowledge 文件目录"""
        return (
            Path(__file__).resolve().parents[5]
            / "WQ-YI" / ".gemini" / "skills"
            / "brain-dataset-explorer" / "knowledge" / "categories"
        )


# ─── ArbExecuteOps（S5-Arb Step 4）───
class ArbExecuteOps:
    """执行套利交易 — 桥接 toolloop_arb._step_execute + SafetyArmor

    转换链: dataset_binding AssetRef → indicator_binding.yml → StrategyRef → _step_execute
    """

    DATASET_OUTPUT = Path(".docs/ai-skills/dataset/output")

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

        campaign = self._campaign or self._make_campaign(config, workspace)

        produced: list[AssetRef] = []
        errors: list[str] = []

        for binding in bindings:
            pair_id = binding.id
            output_dir = workspace / (binding.path or str(self.DATASET_OUTPUT / pair_id))

            ind_file = output_dir / "indicator_binding.yml"
            cat_file = output_dir / "slot_categories.yml"

            if not ind_file.exists():
                errors.append(f"{pair_id}: indicator_binding.yml not found")
                continue

            # 转换 indicator_binding → StrategyRef
            pool_info = self._resolve_pool(pair_id, workspace)
            strategies = self._build_strategies(ind_file, cat_file, pool_info)

            if not strategies:
                errors.append(f"{pair_id}: no strategies built")
                continue

            # 执行（async → sync 桥接）
            loop = asyncio.new_event_loop()
            try:
                results = loop.run_until_complete(campaign._step_execute(strategies))
            finally:
                loop.close()

            ok = sum(1 for r in results if r.get("status") == "success")

            produced.append(AssetRef(
                kind="execution_result",
                id=pair_id,
                path=binding.path,
                metadata={
                    "source": "execute",
                    "trace_id": trace_id,
                    "total": len(results),
                    "success": ok,
                    "results": results,
                },
            ))

        return StepResult(
            success=len(produced) > 0,
            assets_produced=produced,
            metadata={
                "step": "execute",
                "trace_id": trace_id,
                "executed": len(produced),
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
            DexExecutor, SimDexExecutor,
        )

        simulate = config.get("simulate", False)
        if simulate:
            executor = SimDexExecutor(config=config.get("executor", {}))
            logger.info("execute: using SimDexExecutor (simulation mode)")
        else:
            executor = DexExecutor(config=config.get("executor", {}))

        return ArbCampaignLoop(
            config=config,
            executor=executor,
            slippage_guard=SlippageGuard(max_slippage_pct=self.safety.slippage.threshold),
            tvl_breaker=TVLBreaker(min_tvl_usd=self.safety.tvl.floor_usd),
            mev_guard=MEVGuard(),
            approve_manager=ApproveManager(),
            workspace=workspace,
        )

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
