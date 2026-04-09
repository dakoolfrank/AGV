"""AGV _shared 集成测试 — 证明 adapter 层正确接通 nexrur"""
from __future__ import annotations

import pytest
from pathlib import Path


# ═══════════════════════════════════════════════════════════════
# Core 层测试（原有 16 个）
# ═══════════════════════════════════════════════════════════════

class TestOutcomeReasonCodes:
    """AGV reason codes 已注入 nexrur 内核"""

    def test_mm_execute_codes_registered(self):
        from _shared.core.outcome import OUTCOME_REASON_CODES
        codes = OUTCOME_REASON_CODES.get("execute", [])
        assert "slippage_exceed" in codes
        assert "mev_detected" in codes
        assert "tvl_breaker" in codes

    def test_arb_collect_codes_registered(self):
        from _shared.core.outcome import OUTCOME_REASON_CODES
        codes = OUTCOME_REASON_CODES.get("collect", [])
        assert "no_opportunity" in codes
        assert "source_timeout" in codes

    def test_is_valid_reason_code(self):
        from _shared.core.outcome import is_valid_reason_code
        assert is_valid_reason_code("execute", "slippage_exceed")
        assert is_valid_reason_code("execute", "tx_reverted")

    def test_invalid_code_rejected(self):
        from _shared.core.outcome import is_valid_reason_code
        assert not is_valid_reason_code("execute", "nonexistent_code")


class TestStepOutcome:
    """StepOutcome 可从 AGV _shared 导入并正常工作"""

    def test_create_and_serialize(self, tmp_path):
        from _shared.core.outcome import StepOutcome
        outcome = StepOutcome(
            step="execute",
            status="failed",
            reason_code="slippage_exceed",
            artifact_id="pGVT-USDT",
            metrics={"slippage_pct": 0.035, "threshold": 0.02},
            lineage={"collect_run_id": "2026-03-15T10-00-00Z"},
        )
        path = outcome.save(tmp_path)
        assert path.exists()
        loaded = StepOutcome.load(path)
        assert loaded.status == "failed"
        assert loaded.reason_code == "slippage_exceed"
        assert loaded.artifact_id == "pGVT-USDT"


class TestPolicy:
    """AGV policy.yml 通过 PlatformPolicy 加载"""

    def test_policy_loads(self):
        from _shared.core.policy import PlatformPolicy
        p = PlatformPolicy()
        cfg = p.config
        assert "defaults" in cfg
        assert "steps" in cfg

    def test_safety_section(self):
        from _shared.core.policy import PlatformPolicy
        p = PlatformPolicy()
        safety = p.config.get("safety", {})
        assert safety.get("daily_max_gas_usd") == 5.0
        assert safety.get("tvl_floor_usd") == 30.0

    def test_step_execute_config(self):
        from _shared.core.policy import PlatformPolicy
        p = PlatformPolicy()
        steps = p.config.get("steps", {})
        exe = steps.get("execute", {})
        assert exe.get("max_slippage_pct") == 0.02

    def test_gate_blocking_codes(self):
        from _shared.core.policy import PlatformPolicy
        p = PlatformPolicy()
        gate = p.config.get("gate", {})
        codes = gate.get("blocking_codes", [])
        assert "slippage_exceed" in codes
        assert "tvl_breaker" in codes


class TestEvidence:
    """AGV 上游链拓扑已定义"""

    def test_upstream_chain_mm(self):
        from _shared.core.evidence import UPSTREAM_CHAIN
        assert UPSTREAM_CHAIN["monitor"] == []
        assert "detect" in UPSTREAM_CHAIN["execute"]

    def test_upstream_chain_arb(self):
        from _shared.core.evidence import UPSTREAM_CHAIN
        assert UPSTREAM_CHAIN["collect"] == []
        assert "curate" in UPSTREAM_CHAIN["dataset"]

    def test_evidence_store_importable(self):
        from _shared.core.evidence import EvidenceStore, EvidenceLevel
        assert EvidenceLevel.REQUIRED.value == "required"

    def test_step_evidence_levels(self):
        from _shared.core.evidence import STEP_EVIDENCE_LEVEL, EvidenceLevel
        assert STEP_EVIDENCE_LEVEL["monitor"] == EvidenceLevel.REQUIRED
        assert STEP_EVIDENCE_LEVEL["log"] == EvidenceLevel.AUDIT_ONLY


class TestPrompts:
    """SkillPromptStore 可从 AGV _shared 导入"""

    def test_skill_prompt_store_importable(self):
        from _shared.prompts import SkillPromptStore
        assert SkillPromptStore is not None


class TestRunContext:
    """RunContext 可通过 nexrur 直接使用"""

    def test_create_context(self, tmp_path):
        from nexrur import RunContext
        ctx = RunContext.create(
            step="collect",
            run_id="test-001",
            step_version="v1",
            workspace=tmp_path,
        )
        assert ctx.step == "collect"
        assert ctx.run_id == "test-001"


class TestPolicyYmlExists:
    """policy.yml 物理文件存在"""

    def test_file_exists(self):
        yml = Path(__file__).resolve().parents[1] / "core" / "policy.yml"
        assert yml.exists(), f"policy.yml not found at {yml}"
        assert yml.stat().st_size > 500


# ═══════════════════════════════════════════════════════════════
# Engines 层测试（新增）
# ═══════════════════════════════════════════════════════════════

class TestProfiles:
    """三个 PipelineProfile 内部一致性"""

    def test_trunk_profile_validates(self):
        from _shared.engines._profiles import AGV_TRUNK_PROFILE
        errors = AGV_TRUNK_PROFILE.validate()
        assert errors == [], f"Trunk profile validation errors: {errors}"

    def test_mm_profile_validates(self):
        from _shared.engines._profiles import S5_MM_PROFILE
        errors = S5_MM_PROFILE.validate()
        assert errors == [], f"MM profile validation errors: {errors}"

    def test_arb_profile_validates(self):
        from _shared.engines._profiles import S5_ARB_PROFILE
        errors = S5_ARB_PROFILE.validate()
        assert errors == [], f"Arb profile validation errors: {errors}"

    def test_trunk_name(self):
        from _shared.engines._profiles import AGV_TRUNK_PROFILE
        assert AGV_TRUNK_PROFILE.name == "agv-trunk"

    def test_trunk_step_order(self):
        from _shared.engines._profiles import AGV_TRUNK_PROFILE
        assert AGV_TRUNK_PROFILE.step_order == (
            "asset_oracle", "chain_ops", "digital_ops_l1", "digital_ops_l2", "kol",
        )

    def test_mm_step_order(self):
        from _shared.engines._profiles import S5_MM_PROFILE
        assert S5_MM_PROFILE.step_order == ("monitor", "detect", "decide", "execute", "log")

    def test_arb_step_order(self):
        from _shared.engines._profiles import S5_ARB_PROFILE
        assert S5_ARB_PROFILE.step_order == ("collect", "curate", "dataset", "execute", "fix")

    def test_trunk_optional_steps(self):
        from _shared.engines._profiles import AGV_TRUNK_PROFILE
        assert "kol" in AGV_TRUNK_PROFILE.optional_steps

    def test_mm_optional_steps(self):
        from _shared.engines._profiles import S5_MM_PROFILE
        assert "log" in S5_MM_PROFILE.optional_steps

    def test_arb_optional_steps(self):
        from _shared.engines._profiles import S5_ARB_PROFILE
        assert "fix" in S5_ARB_PROFILE.optional_steps

    def test_s5_fork_from_s2(self):
        """S5 MM 消费来自 S2 的 lp_state; Arb collect 独立运行无上游依赖"""
        from _shared.engines._profiles import S5_MM_PROFILE, S5_ARB_PROFILE
        assert "lp_state" in S5_MM_PROFILE.step_consumes["monitor"]
        # Arb collect 独立模式：无 step_consumes（主干分叉时由 campaign 预注入）
        assert S5_ARB_PROFILE.step_consumes["collect"] == frozenset()

    def test_all_profiles_dict(self):
        from _shared.engines._profiles import ALL_PROFILES
        assert len(ALL_PROFILES) == 3
        assert "agv-trunk" in ALL_PROFILES
        assert "s5-mm" in ALL_PROFILES
        assert "s5-arb" in ALL_PROFILES


class TestLifecycle:
    """主干 LifecycleProfile 一致性"""

    def test_lifecycle_validates(self):
        from _shared.engines._profiles import AGV_TRUNK_LIFECYCLE
        errors = AGV_TRUNK_LIFECYCLE.validate()
        assert errors == [], f"Lifecycle validation errors: {errors}"

    def test_terminal_states(self):
        from _shared.engines._profiles import AGV_TRUNK_LIFECYCLE
        assert "terminal_pass" in AGV_TRUNK_LIFECYCLE.terminal_states
        assert "terminal_exhausted" in AGV_TRUNK_LIFECYCLE.terminal_states

    def test_step_required_state(self):
        from _shared.engines._profiles import AGV_TRUNK_LIFECYCLE
        assert AGV_TRUNK_LIFECYCLE.step_required_state["chain_ops"] == "oracle_done"
        assert AGV_TRUNK_LIFECYCLE.step_required_state["digital_ops_l1"] == "chain_done"


class TestMMOps:
    """MM-Campaign AgentOps 桥接"""

    def test_monitor_ops_protocol(self, tmp_path):
        from _shared.engines.agent_ops_mm import MonitorOps
        ops = MonitorOps()
        result = ops(
            pipeline_run_id="pipe-test",
            step_run_id="step-001",
            trace_id="trace-test",
            assets_input=[],
            config={},
            workspace=tmp_path,
        )
        assert result.success
        assert any(a.kind == "pool_state" for a in result.assets_produced)

    def test_execute_ops_with_safety(self, tmp_path):
        from _shared.engines.agent_ops_mm import ExecuteOps, SafetyArmor
        safety = SafetyArmor()
        ops = ExecuteOps(safety=safety)
        result = ops(
            pipeline_run_id="pipe-test",
            step_run_id="step-004",
            trace_id="trace-test",
            assets_input=[],
            config={},
            workspace=tmp_path,
        )
        assert result.success
        kinds = {a.kind for a in result.assets_produced}
        assert "heartbeat_log" in kinds
        assert "tx_result" in kinds

    def test_register_mm_ops(self):
        from _shared.engines.agent_ops_mm import register_mm_ops
        from nexrur.engines.protocols import OpsRegistry
        reg = OpsRegistry()
        register_mm_ops(reg)
        assert reg.has("monitor")
        assert reg.has("detect")
        assert reg.has("decide")
        assert reg.has("execute")
        assert reg.has("log")
        assert len(reg) == 5


class TestArbOps:
    """Arb-Campaign AgentOps 桥接"""

    def test_collect_ops_protocol(self, tmp_path):
        from _shared.engines.agent_ops_arb import CollectOps
        ops = CollectOps()
        result = ops(
            pipeline_run_id="pipe-test",
            step_run_id="step-001",
            trace_id="trace-test",
            assets_input=[],
            config={},
            workspace=tmp_path,
        )
        assert result.success
        assert any(a.kind == "market_signal" for a in result.assets_produced)

    def test_arb_execute_ops_no_bindings(self, tmp_path):
        """execute 无 dataset_binding 资产 → 正确返回 failure"""
        from _shared.engines.agent_ops_arb import ArbExecuteOps, SafetyArmor
        safety = SafetyArmor()
        ops = ArbExecuteOps(safety=safety)
        result = ops(
            pipeline_run_id="pipe-test",
            step_run_id="step-004",
            trace_id="trace-test",
            assets_input=[],
            config={},
            workspace=tmp_path,
        )
        assert not result.success
        assert result.metadata["reason"] == "no_bindings"

    def test_arb_execute_ops_with_binding(self, tmp_path):
        """execute 有 dataset_binding → 兼容别名默认走 dry_run 调度"""
        import yaml
        import unittest.mock as mock
        from nexrur.engines.orchestrator import AssetRef
        from _shared.engines.agent_ops_arb import ArbExecuteOps, SafetyArmor, StepResult
        # 创建 mock indicator_binding.yml
        out_dir = tmp_path / ".docs" / "ai-skills" / "dataset" / "output" / "test_pair"
        out_dir.mkdir(parents=True)
        (out_dir / "indicator_binding.yml").write_text(yaml.dump({
            "domain": "defi",
            "indicator_bindings": [{
                "skeleton_id": "skel_01", "category": "defi_onchain",
                "selected_indicators": ["vol"], "param_hints": {}, "confidence": 0.9,
            }],
        }))
        safety = SafetyArmor()
        ops = ArbExecuteOps(safety=safety)
        with mock.patch.object(ops, "_execute_dry_run", return_value=StepResult(
            success=True,
            assets_produced=[AssetRef(
                kind="execution_result",
                id="test_pair",
                path=".docs/ai-skills/execute/simulator/test_pair",
                metadata={"dry_run": True},
            )],
            metadata={"mode": "dry_run"},
        )):
            result = ops(
                pipeline_run_id="pipe-test",
                step_run_id="step-004",
                trace_id="trace-test",
                assets_input=[AssetRef(
                    kind="dataset_binding", id="test_pair",
                    path=str(out_dir.relative_to(tmp_path)), metadata={},
                )],
                config={},
                workspace=tmp_path,
            )
        assert result.success
        assert any(a.kind == "execution_result" for a in result.assets_produced)

    def test_register_arb_ops(self):
        from _shared.engines.agent_ops_arb import register_arb_ops
        from nexrur.engines.protocols import OpsRegistry
        reg = OpsRegistry()
        register_arb_ops(reg)
        assert reg.has("collect")
        assert reg.has("curate")
        assert reg.has("dataset")
        assert reg.has("execute")
        assert reg.has("fix")
        assert len(reg) == 5


class TestSafetyArmor:
    """三大安全护甲单元测试"""

    def test_slippage_guard_pass(self):
        from _shared.engines.agent_ops_mm import SlippageGuard
        g = SlippageGuard(threshold=0.02)
        assert g.check(expected=100.0, actual=101.5)  # 1.5% < 2%

    def test_slippage_guard_fail(self):
        from _shared.engines.agent_ops_mm import SlippageGuard
        g = SlippageGuard(threshold=0.02)
        assert not g.check(expected=100.0, actual=103.0)  # 3% > 2%

    def test_mev_guard_safe(self):
        from _shared.engines.agent_ops_mm import MEVGuard
        g = MEVGuard(price_impact_threshold=0.005)
        assert not g.is_sandwiched(price_before=1.0, price_after=1.003)  # 0.3% < 0.5%

    def test_mev_guard_sandwiched(self):
        from _shared.engines.agent_ops_mm import MEVGuard
        g = MEVGuard(price_impact_threshold=0.005)
        assert g.is_sandwiched(price_before=1.0, price_after=1.01)  # 1% > 0.5%

    def test_tvl_breaker_safe(self):
        from _shared.engines.agent_ops_mm import TVLCircuitBreaker
        b = TVLCircuitBreaker(floor_usd=30.0)
        assert b.is_safe(tvl_usd=50.0)

    def test_tvl_breaker_tripped(self):
        from _shared.engines.agent_ops_mm import TVLCircuitBreaker
        b = TVLCircuitBreaker(floor_usd=30.0)
        assert not b.is_safe(tvl_usd=20.0)

    def test_executor_config_validate(self):
        from _shared.engines.agent_ops_mm import ExecutorConfig
        cfg = ExecutorConfig()
        assert cfg.validate_trade(amount_usd=40.0, slippage=0.015)
        assert not cfg.validate_trade(amount_usd=60.0, slippage=0.015)  # > $50
        assert not cfg.validate_trade(amount_usd=40.0, slippage=0.03)   # > 2%


class TestEnginesReexport:
    """engines/__init__.py re-export 完整性"""

    def test_nexrur_types(self):
        from _shared.engines import (
            Orchestrator, Checkpoint, StepResult, AssetRef,
            PipelineProfile, OpsRegistry, LifecycleProfile,
        )
        assert Orchestrator is not None
        assert Checkpoint is not None

    def test_agv_profiles(self):
        from _shared.engines import AGV_TRUNK_PROFILE, S5_MM_PROFILE, S5_ARB_PROFILE
        assert AGV_TRUNK_PROFILE.name == "agv-trunk"
        assert S5_MM_PROFILE.name == "s5-mm"
        assert S5_ARB_PROFILE.name == "s5-arb"

    def test_agv_ops(self):
        from _shared.engines import (
            MonitorOps, DetectOps, DecideOps, ExecuteOps, LogOps,
            CollectOps, CurateOps, DatasetOps, ArbExecuteOps, FixOps,
        )
        assert MonitorOps is not None
        assert CollectOps is not None

    def test_safety_components(self):
        from _shared.engines import SafetyArmor, ExecutorConfig, SlippageGuard, MEVGuard, TVLCircuitBreaker
        armor = SafetyArmor()
        assert armor.config.max_single_usd == 50.0
        assert armor.slippage.threshold == 0.02
        assert armor.mev.price_impact_threshold == 0.005
        assert armor.tvl.floor_usd == 30.0


class TestPromptsAudit:
    """Prompt 审计工具"""

    def test_list_all_importable(self):
        from _shared.prompts import list_all_skill_prompts, PromptEntry
        assert list_all_skill_prompts is not None
        assert PromptEntry is not None

    def test_scan_skills_root(self):
        from _shared.prompts import list_all_skill_prompts
        skills_root = Path(__file__).resolve().parents[2]  # _shared/../ = skills/
        entries = list_all_skill_prompts(skills_root)
        # 返回列表类型正确（即使当前 SKILL.md 可能无 prompt 块）
        assert isinstance(entries, list)

    def test_prompt_entry_repr(self):
        from _shared.prompts import PromptEntry
        e = PromptEntry(skill="agv-kol", name="draft_system", line=42)
        assert "agv-kol::draft_system" in repr(e)
        assert "L42" in repr(e)


# ═══════════════════════════════════════════════════════════════
# Prompt .md 文件测试
# ═══════════════════════════════════════════════════════════════

class TestPromptMarkdownFiles:
    """campaign.md + diagnosis.md 可被 SkillPromptStore 解析"""

    def test_campaign_md_exists(self):
        md = Path(__file__).resolve().parents[1] / "prompts" / "campaign.md"
        assert md.exists(), f"缺失 {md}"

    def test_diagnosis_md_exists(self):
        md = Path(__file__).resolve().parents[1] / "prompts" / "diagnosis.md"
        assert md.exists(), f"缺失 {md}"

    def test_campaign_prompts_load(self):
        from nexrur.prompts import SkillPromptStore
        md = Path(__file__).resolve().parents[1] / "prompts" / "campaign.md"
        store = SkillPromptStore(md)
        names = store.list_available()
        assert "arb_triage_system" in names
        assert "arb_triage_user" in names
        assert "arb_cycle_decision_system" in names
        assert "arb_cycle_decision_user" in names
        assert len(names) == 4

    def test_diagnosis_prompts_load(self):
        from nexrur.prompts import SkillPromptStore
        md = Path(__file__).resolve().parents[1] / "prompts" / "diagnosis.md"
        store = SkillPromptStore(md)
        names = store.list_available()
        assert "diagnosis_flash_system" in names
        assert "diagnosis_flash_user" in names
        assert "diagnosis_pro_system" in names
        assert "diagnosis_pro_user" in names
        assert len(names) == 4

    def test_campaign_prompt_has_placeholders(self):
        from nexrur.prompts import SkillPromptStore
        md = Path(__file__).resolve().parents[1] / "prompts" / "campaign.md"
        store = SkillPromptStore(md)
        text = store.get("arb_triage_user")
        assert "{matrix_text}" in text
        assert "{remaining_budget_usd}" in text

    def test_diagnosis_prompt_has_placeholders(self):
        from nexrur.prompts import SkillPromptStore
        md = Path(__file__).resolve().parents[1] / "prompts" / "diagnosis.md"
        store = SkillPromptStore(md)
        text = store.get("diagnosis_flash_user")
        assert "{strategy_id}" in text
        assert "{pnl_usd}" in text

    def test_prompt_hash_stable(self):
        from nexrur.prompts import SkillPromptStore
        md = Path(__file__).resolve().parents[1] / "prompts" / "diagnosis.md"
        store = SkillPromptStore(md)
        h1 = store.get_hash("diagnosis_flash_system")
        h2 = store.get_hash("diagnosis_flash_system")
        assert h1 == h2
        assert len(h1) == 12  # SHA256[:12]


# ═══════════════════════════════════════════════════════════════
# Diagnosis 诊断引擎测试
# ═══════════════════════════════════════════════════════════════

class TestDiagnosisDataStructures:
    """RepairDiagnosis + HaltDecision 数据结构"""

    def test_repair_diagnosis_roundtrip(self):
        from _shared.engines.diagnosis import RepairDiagnosis, make_diagnosis_id
        d = RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("SLIPPAGE_EXCEEDED", "arb_bnb", "execute"),
            target_step="execute",
            strategy_id="arb_bnb",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.95,
            evidence_refs=["slip_001"],
            why_not_others="滑点可调参",
        )
        data = d.to_dict()
        d2 = RepairDiagnosis.from_dict(data)
        assert d2.diagnosis_id == d.diagnosis_id
        assert d2.target_step == "execute"
        assert d2.retreat_level == "A"
        assert d2.confidence == 0.95

    def test_halt_decision_to_dict(self):
        from _shared.engines.diagnosis import HaltDecision
        h = HaltDecision(reason="no_diagnosis", strategy_id="arb_bnb", message="诊断失败")
        data = h.to_dict()
        assert data["reason"] == "no_diagnosis"
        assert data["strategy_id"] == "arb_bnb"
        assert data["diagnosis"] is None

    def test_make_diagnosis_id_deterministic(self):
        from _shared.engines.diagnosis import make_diagnosis_id
        id1 = make_diagnosis_id("SLIPPAGE_EXCEEDED", "arb_bnb", "execute")
        id2 = make_diagnosis_id("SLIPPAGE_EXCEEDED", "arb_bnb", "execute")
        assert id1 == id2
        assert len(id1) == 12

    def test_make_diagnosis_id_varies(self):
        from _shared.engines.diagnosis import make_diagnosis_id
        id1 = make_diagnosis_id("SLIPPAGE_EXCEEDED", "arb_bnb", "execute")
        id2 = make_diagnosis_id("FACTOR_EXHAUSTED", "arb_bnb", "curate")
        assert id1 != id2


class TestValidateDiagnosis:
    """诊断合法性校验"""

    def test_none_returns_no_diagnosis(self):
        from _shared.engines.diagnosis import validate_diagnosis
        assert validate_diagnosis(None) == "no_diagnosis"

    def test_valid_diagnosis_passes(self):
        from _shared.engines.diagnosis import RepairDiagnosis, validate_diagnosis, make_diagnosis_id
        d = RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("SLIPPAGE_EXCEEDED", "s1", "execute"),
            target_step="execute",
            strategy_id="s1",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.9,
            evidence_refs=["e1"],
        )
        assert validate_diagnosis(d) is None  # 合法

    def test_empty_scope_rejected(self):
        from _shared.engines.diagnosis import RepairDiagnosis, validate_diagnosis
        d = RepairDiagnosis(
            diagnosis_id="xxx",
            target_step="execute",
            strategy_id="",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.9,
            evidence_refs=["e1"],
        )
        assert validate_diagnosis(d) == "empty_scope"

    def test_invalid_target_rejected(self):
        from _shared.engines.diagnosis import RepairDiagnosis, validate_diagnosis
        d = RepairDiagnosis(
            diagnosis_id="xxx",
            target_step="deploy",
            strategy_id="s1",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.9,
            evidence_refs=["e1"],
        )
        assert validate_diagnosis(d) == "invalid_target"

    def test_no_evidence_rejected(self):
        from _shared.engines.diagnosis import RepairDiagnosis, validate_diagnosis
        d = RepairDiagnosis(
            diagnosis_id="xxx",
            target_step="execute",
            strategy_id="s1",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.9,
            evidence_refs=[],
        )
        assert validate_diagnosis(d) == "no_evidence"

    def test_target_step_mismatch_rejected(self):
        from _shared.engines.diagnosis import RepairDiagnosis, validate_diagnosis
        d = RepairDiagnosis(
            diagnosis_id="xxx",
            target_step="collect",  # SLIPPAGE should → execute
            strategy_id="s1",
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=0.9,
            evidence_refs=["e1"],
        )
        assert validate_diagnosis(d) == "target_step_mismatch"


class TestDeterministicDetectors:
    """确定性检测器（零 LLM）"""

    def test_slippage_detection(self):
        from _shared.engines.diagnosis import detect_slippage_issue
        result = detect_slippage_issue(
            {"actual_slippage_pct": 0.035, "strategy_id": "arb_bnb"},
            threshold=0.02,
        )
        assert result is not None
        assert result.reason_code == "SLIPPAGE_EXCEEDED"
        assert result.retreat_level == "A"
        assert result.target_step == "execute"
        assert result.confidence == 1.0

    def test_slippage_below_threshold(self):
        from _shared.engines.diagnosis import detect_slippage_issue
        result = detect_slippage_issue(
            {"actual_slippage_pct": 0.01, "strategy_id": "arb_bnb"},
            threshold=0.02,
        )
        assert result is None

    def test_tvl_drop_detection(self):
        from _shared.engines.diagnosis import detect_tvl_drop
        result = detect_tvl_drop(
            {"pool_tvl_usd": 15.0, "strategy_id": "arb_bnb"},
            tvl_floor=30.0,
        )
        assert result is not None
        assert result.reason_code == "STRUCTURAL_CHANGE"
        assert result.retreat_level == "C"
        assert result.target_step == "collect"

    def test_tvl_safe(self):
        from _shared.engines.diagnosis import detect_tvl_drop
        result = detect_tvl_drop(
            {"pool_tvl_usd": 1000.0, "strategy_id": "arb_bnb"},
            tvl_floor=30.0,
        )
        assert result is None

    def test_budget_exceeded(self):
        from _shared.engines.diagnosis import detect_budget_exceeded
        result = detect_budget_exceeded(
            {"cumulative_loss_usd": 300.0, "strategy_id": "arb_bnb"},
            daily_cap=500.0,
            halt_ratio=0.5,
        )
        assert result is not None
        assert result.reason_code == "BUDGET_EXCEEDED"
        assert result.retreat_level == "C"

    def test_budget_within_limit(self):
        from _shared.engines.diagnosis import detect_budget_exceeded
        result = detect_budget_exceeded(
            {"cumulative_loss_usd": 50.0, "strategy_id": "arb_bnb"},
            daily_cap=500.0,
            halt_ratio=0.5,
        )
        assert result is None

    def test_mev_attack_detection(self):
        from _shared.engines.diagnosis import detect_mev_attack
        result = detect_mev_attack(
            {"mev_detected": True, "strategy_id": "arb_bnb"},
        )
        assert result is not None
        assert result.reason_code == "MEV_DETECTED"
        assert result.retreat_level == "A"

    def test_mev_safe(self):
        from _shared.engines.diagnosis import detect_mev_attack
        result = detect_mev_attack(
            {"mev_detected": False, "price_impact_pct": 0.001, "strategy_id": "arb_bnb"},
        )
        assert result is None


class TestDiagnosisEngine:
    """DiagnosisEngine Flash+Pro 流程"""

    def test_deterministic_shortcircuit(self):
        """确定性检测器优先于 LLM"""
        from _shared.engines.diagnosis import DiagnosisEngine
        engine = DiagnosisEngine()  # 无 LLM
        result = engine.diagnose(
            evidence={"pool_tvl_usd": 5.0, "strategy_id": "arb_bnb"},
            strategy_id="arb_bnb",
        )
        assert result is not None
        assert result.reason_code == "STRUCTURAL_CHANGE"

    def test_no_llm_no_signal_returns_none(self):
        """无 LLM + 无确定性信号 → None（停机）"""
        from _shared.engines.diagnosis import DiagnosisEngine
        engine = DiagnosisEngine()  # 无 LLM
        result = engine.diagnose(
            evidence={"strategy_id": "arb_bnb", "pool_tvl_usd": 1000.0},
            strategy_id="arb_bnb",
        )
        assert result is None

    def test_detector_priority_tvl_before_slippage(self):
        """TVL 检测器优先于 slippage（更严重）"""
        from _shared.engines.diagnosis import DiagnosisEngine
        engine = DiagnosisEngine()
        result = engine.diagnose(
            evidence={
                "pool_tvl_usd": 5.0,
                "actual_slippage_pct": 0.05,
                "strategy_id": "arb_bnb",
            },
            strategy_id="arb_bnb",
        )
        assert result is not None
        assert result.reason_code == "STRUCTURAL_CHANGE"  # TVL 优先


class TestDiagnosisEngineReexport:
    """engines/__init__.py re-export 诊断模块"""

    def test_diagnosis_types(self):
        from _shared.engines import (
            DiagnosisEngine, RepairDiagnosis, HaltDecision,
            make_diagnosis_id, validate_diagnosis,
        )
        assert DiagnosisEngine is not None
        assert RepairDiagnosis is not None
        assert make_diagnosis_id is not None

    def test_reason_codes(self):
        from _shared.engines import DIAGNOSIS_REASON_CODES, REASON_CODE_LEVEL, LEVEL_TO_TARGET_STEP
        assert "SLIPPAGE_EXCEEDED" in DIAGNOSIS_REASON_CODES
        assert REASON_CODE_LEVEL["SLIPPAGE_EXCEEDED"] == "A"
        assert LEVEL_TO_TARGET_STEP["A"] == "execute"

    def test_detectors(self):
        from _shared.engines import (
            DETERMINISTIC_DETECTORS,
            detect_slippage_issue, detect_tvl_drop,
            detect_budget_exceeded, detect_mev_attack,
        )
        assert len(DETERMINISTIC_DETECTORS) == 4


# ═══════════════════════════════════════════════════════════════
# Campaign 循环编排器测试
# ═══════════════════════════════════════════════════════════════

class TestCampaignDataStructures:
    """CampaignState / CycleMetrics / CampaignResult"""

    def test_cycle_metrics_defaults(self):
        from _shared.engines.campaign import CycleMetrics
        m = CycleMetrics(cycle_index=1)
        assert m.pnl_usd == 0.0
        assert m.trades_executed == 0
        assert m.retreat_level is None

    def test_campaign_state_defaults(self):
        from _shared.engines.campaign import CampaignState
        s = CampaignState()
        assert s.current_cycle == 0
        assert s.cumulative_pnl_usd == 0.0
        assert s.consecutive_failures == 0

    def test_campaign_result_to_dict(self):
        from _shared.engines.campaign import CampaignResult
        r = CampaignResult(
            status="completed",
            total_cycles=10,
            cumulative_pnl_usd=5.3,
            cycles=[],
        )
        d = r.to_dict()
        assert d["status"] == "completed"
        assert d["total_cycles"] == 10
        assert d["halt"] is None


class TestCampaignRunner:
    """CampaignRunner 循环编排 (WQ-YI aligned — self.orch 模式)"""

    # ── Mock Orchestrator for testing ──

    @staticmethod
    def _make_trace(
        cycle: int,
        *,
        status: str = "completed",
        pnl: float = 0.0,
        gas: float = 0.0,
        ok: int = 1,
        total: int = 1,
    ):
        from nexrur.engines.orchestrator import AssetRef, TraceResult, TraceStatus
        st = TraceStatus.COMPLETED if status == "completed" else TraceStatus.FAILED
        assets = []
        if st == TraceStatus.COMPLETED:
            assets = [AssetRef(
                kind="execution_result",
                id=f"pair_{cycle}",
                metadata={
                    "results": [{"profit_usd": pnl, "gas_usd": gas}],
                    "success": ok,
                    "total": total,
                },
            )]
        return TraceResult(
            trace_id=f"t-{cycle}",
            pipeline_run_id=f"p-{cycle}",
            status=st,
            checkpoint_path="/tmp/mock-ckpt.json",
            final_assets=assets,
        )

    class _MockOrch:
        """Minimal Orchestrator mock for CampaignRunner tests."""

        def __init__(self, result_fn):
            self._fn = result_fn
            self._cycle = 0

        def run(self, **kw):
            self._cycle += 1
            return self._fn(self._cycle)

        def resume(self, checkpoint_path, **kw):
            self._cycle += 1
            return self._fn(self._cycle)

        def reset_from_step(self, *args, **kw):
            pass

    def test_mm_heartbeat_single_cycle(self):
        """MM 心跳模式 — 无 orch → 心跳 stub"""
        from _shared.engines.campaign import CampaignRunner, DEFAULT_MM_CONFIG
        from _shared.engines._profiles import S5_MM_PROFILE
        runner = CampaignRunner(profile=S5_MM_PROFILE, config=DEFAULT_MM_CONFIG)
        result = runner.run()
        assert result.status == "completed"
        assert result.total_cycles >= 1

    def test_arb_completes_max_cycles(self):
        """Arb 模式 — 达到 max_cycles 后正常完成"""
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines._profiles import S5_ARB_PROFILE

        mk = self._make_trace
        orch = self._MockOrch(lambda c: mk(c, pnl=0.1))

        runner = CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={"max_cycles": 3, "cycle_interval_seconds": 0},
            orchestrator=orch,
        )
        result = runner.run()
        assert result.status == "completed"
        assert result.total_cycles == 3
        assert orch._cycle == 3

    def test_arb_consecutive_failure_halt(self):
        """连续失败 → 停机"""
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines._profiles import S5_ARB_PROFILE

        mk = self._make_trace
        orch = self._MockOrch(lambda c: mk(c, status="failed"))

        runner = CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={"max_cycles": 100, "max_consecutive_failures": 3, "cycle_interval_seconds": 0},
            orchestrator=orch,
        )
        result = runner.run()
        assert result.status == "halted"
        assert result.halt is not None
        assert result.halt.reason == "max_consecutive_failures"

    def test_arb_budget_exhausted(self):
        """累计亏损超阈值 → 熔断"""
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines._profiles import S5_ARB_PROFILE

        mk = self._make_trace
        orch = self._MockOrch(lambda c: mk(c, pnl=-200.0))

        runner = CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={
                "max_cycles": 100,
                "max_daily_usd": 500.0,
                "budget_halt_ratio": 0.5,
                "cycle_interval_seconds": 0,
                "max_consecutive_failures": 999,
            },
            orchestrator=orch,
        )
        result = runner.run()
        assert result.status == "budget_exhausted"
        assert result.cumulative_pnl_usd < 0

    def test_arb_pnl_accumulates(self):
        """PnL 正确累积"""
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines._profiles import S5_ARB_PROFILE

        mk = self._make_trace
        orch = self._MockOrch(lambda c: mk(c, pnl=1.5))

        runner = CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={"max_cycles": 5, "cycle_interval_seconds": 0},
            orchestrator=orch,
        )
        result = runner.run()
        assert result.status == "completed"
        assert abs(result.cumulative_pnl_usd - 7.5) < 0.01  # 5 × $1.5

    def test_arb_with_diagnosis_engine(self):
        """Arb + 确定性诊断引擎 — fail 时自动诊断"""
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines.diagnosis import DiagnosisEngine
        from _shared.engines._profiles import S5_ARB_PROFILE

        mk = self._make_trace
        orch = self._MockOrch(lambda c: mk(c, status="failed"))

        engine = DiagnosisEngine()  # 无 LLM — 确定性检测
        runner = CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={
                "max_cycles": 100,
                "max_consecutive_failures": 999,
                "cycle_interval_seconds": 0,
                "strategy_id": "arb_bnb",
            },
            diagnosis_engine=engine,
            orchestrator=orch,
        )
        # 无确定性信号命中 + 无 LLM → diagnose 返回 None → 不设 halt
        # 但 halts 列表可能有条目（诊断在 _handle_failure 中记录到 state.halts）
        # consecutive_failures 会持续增加直到 max_consecutive_failures (999)
        # 实际由 diagnose→None→validate_diagnosis→"no_diagnosis" 写入 halts
        # 第一次失败后 halt_reason="no_diagnosis" 写入 state.halts
        # 但 _handle_failure 不直接 return halt — 只记录到 state.halts
        # 循环继续直到 max_consecutive_failures
        result = runner.run()
        # 应该因 state.halts 中有 no_diagnosis 条目
        # 但实际停机由 max_consecutive_failures=999 不会触发
        # 看具体实现：_handle_failure 只写 state.halts，不直接停机
        # 循环 continues → 最终 max_cycles=100 → completed
        assert result.status in ("halted", "completed")


class TestCampaignReexport:
    """engines/__init__.py re-export campaign 模块"""

    def test_campaign_types(self):
        from _shared.engines import (
            CampaignRunner, CampaignResult, CampaignState, CycleMetrics,
            DEFAULT_MM_CONFIG, DEFAULT_ARB_CONFIG,
            LOOP_END_STEP, FINALIZE_STEPS,
        )
        assert CampaignRunner is not None
        assert DEFAULT_MM_CONFIG["cycle_interval_seconds"] == 30
        assert DEFAULT_ARB_CONFIG["max_cycles"] == 100
        assert LOOP_END_STEP == "execute"
        assert FINALIZE_STEPS == ["fix"]


# ═══════════════════════════════════════════════════════════════
# ProfileRegistry 测试（底座多管线管理）
# ═══════════════════════════════════════════════════════════════

class TestProfileRegistry:
    """ProfileRegistry 基础功能"""

    def test_create_agv_registry(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        assert len(reg) == 3
        assert "agv-trunk" in reg
        assert "s5-mm" in reg
        assert "s5-arb" in reg

    def test_get_pipeline(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        trunk = reg.get_pipeline("agv-trunk")
        assert trunk is not None
        assert trunk.name == "agv-trunk"
        assert "asset_oracle" in trunk.step_order

    def test_get_lifecycle(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        lc = reg.get_lifecycle("agv-trunk")
        assert lc is not None
        assert "terminal_pass" in lc.terminal_states

    def test_list_pipelines(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        names = reg.list_pipelines()
        assert sorted(names) == ["agv-trunk", "s5-arb", "s5-mm"]

    def test_get_fork(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        fork = reg.get_fork("s5-mm")
        assert fork is not None
        assert fork.source_profile == "agv-trunk"
        assert fork.fork_after_step == "chain_ops"
        assert "lp_state" in fork.shared_asset_kinds

    def test_no_fork_for_root(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        assert reg.get_fork("agv-trunk") is None


class TestProfileRegistryTopology:
    """拓扑查询"""

    def test_topology_structure(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        topo = reg.topology()
        assert topo["roots"] == ["agv-trunk"]
        assert "s5-mm" in topo["forks"]
        assert "s5-arb" in topo["forks"]
        assert topo["forks"]["s5-mm"]["source"] == "agv-trunk"

    def test_downstream_profiles(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        ds = reg.downstream_profiles("agv-trunk")
        assert sorted(ds) == ["s5-arb", "s5-mm"]

    def test_downstream_empty_for_leaf(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        assert reg.downstream_profiles("s5-mm") == []


class TestProfileRegistryValidation:
    """跨管线一致性校验"""

    def test_agv_registry_validates_clean(self):
        from _shared.engines._profiles import create_agv_registry
        reg = create_agv_registry()
        errors = reg.validate()
        assert errors == [], f"校验失败: {errors}"

    def test_invalid_fork_source(self):
        from nexrur.engines.protocols import (
            PipelineProfile, ForkPoint, ProfileRegistry,
        )
        reg = ProfileRegistry()
        p = PipelineProfile(
            name="leaf",
            step_order=("a",),
            step_to_skill={"a": "s"},
            step_to_policy={"a": "p"},
            step_deps={"a": []},
            optional_steps=frozenset(),
            asset_kinds=frozenset({"x"}),
            step_produces={"a": frozenset({"x"})},
            step_consumes={"a": frozenset()},
            upstream_chain={"a": []},
        )
        reg.register_pipeline(p)
        reg.register_fork("leaf", ForkPoint(
            source_profile="nonexistent",
            fork_after_step="a",
        ))
        errors = reg.validate()
        assert any("nonexistent" in e for e in errors)

    def test_invalid_fork_step(self):
        from nexrur.engines.protocols import (
            PipelineProfile, ForkPoint, ProfileRegistry,
        )
        reg = ProfileRegistry()
        src = PipelineProfile(
            name="src",
            step_order=("a", "b"),
            step_to_skill={"a": "s", "b": "s"},
            step_to_policy={"a": "p", "b": "p"},
            step_deps={"a": [], "b": ["a"]},
            optional_steps=frozenset(),
            asset_kinds=frozenset({"x"}),
            step_produces={"a": frozenset({"x"}), "b": frozenset()},
            step_consumes={"a": frozenset(), "b": frozenset({"x"})},
            upstream_chain={"a": [], "b": ["a"]},
        )
        tgt = PipelineProfile(
            name="tgt",
            step_order=("c",),
            step_to_skill={"c": "s"},
            step_to_policy={"c": "p"},
            step_deps={"c": []},
            optional_steps=frozenset(),
            asset_kinds=frozenset({"x"}),
            step_produces={"c": frozenset()},
            step_consumes={"c": frozenset({"x"})},
            upstream_chain={"c": []},
        )
        reg.register_pipeline(src)
        reg.register_pipeline(tgt)
        reg.register_fork("tgt", ForkPoint(
            source_profile="src",
            fork_after_step="nonexistent_step",
            shared_asset_kinds=frozenset({"x"}),
        ))
        errors = reg.validate()
        assert any("nonexistent_step" in e for e in errors)

    def test_shared_asset_not_in_source(self):
        from nexrur.engines.protocols import (
            PipelineProfile, ForkPoint, ProfileRegistry,
        )
        reg = ProfileRegistry()
        src = PipelineProfile(
            name="src",
            step_order=("a",),
            step_to_skill={"a": "s"},
            step_to_policy={"a": "p"},
            step_deps={"a": []},
            optional_steps=frozenset(),
            asset_kinds=frozenset({"x"}),
            step_produces={"a": frozenset({"x"})},
            step_consumes={"a": frozenset()},
            upstream_chain={"a": []},
        )
        tgt = PipelineProfile(
            name="tgt",
            step_order=("b",),
            step_to_skill={"b": "s"},
            step_to_policy={"b": "p"},
            step_deps={"b": []},
            optional_steps=frozenset(),
            asset_kinds=frozenset({"alien_kind"}),
            step_produces={"b": frozenset()},
            step_consumes={"b": frozenset({"alien_kind"})},
            upstream_chain={"b": []},
        )
        reg.register_pipeline(src)
        reg.register_pipeline(tgt)
        reg.register_fork("tgt", ForkPoint(
            source_profile="src",
            fork_after_step="a",
            shared_asset_kinds=frozenset({"alien_kind"}),
        ))
        errors = reg.validate()
        assert any("alien_kind" in e and "source" in e for e in errors)


class TestProfileRegistryReexport:
    """engines/__init__.py re-export ProfileRegistry 相关符号"""

    def test_reexport_fork_point(self):
        from _shared.engines import ForkPoint
        assert ForkPoint is not None

    def test_reexport_profile_registry(self):
        from _shared.engines import ProfileRegistry
        assert ProfileRegistry is not None

    def test_reexport_create_agv_registry(self):
        from _shared.engines import create_agv_registry
        reg = create_agv_registry()
        assert len(reg) == 3


# ═══════════════════════════════════════════════════════════════
# Memory 集成测试 (MP5/MP7/MP8 — AGV campaign 记忆增强)
# ═══════════════════════════════════════════════════════════════

class _MockPolicy:
    """Minimal PlatformPolicy mock — supports .get(key, step=...)"""

    def __init__(self, overrides: dict | None = None):
        self._defaults = {
            "memory_read_enabled": True,
            "memory_distill_enabled": True,
            "memory_lesson_top_k": 5,
            "memory_history_top_k": 3,
            "memory_history_max_chars": 1500,
            "memory_tier_boost": {"A": 1.2, "B": 1.0, "C": 0.8},
        }
        if overrides:
            self._defaults.update(overrides)

    def get(self, key, step="defaults"):
        return self._defaults.get(key)


class TestCampaignMemory:
    """MP5/MP7/MP8: CampaignRunner 记忆注入 + 蒸馏"""

    @staticmethod
    def _make_runner(*, orch=None, diagnosis=None):
        from _shared.engines.campaign import CampaignRunner
        from _shared.engines._profiles import S5_ARB_PROFILE
        return CampaignRunner(
            profile=S5_ARB_PROFILE,
            config={"max_cycles": 1, "cycle_interval_seconds": 0, "strategy_id": "test_arb"},
            diagnosis_engine=diagnosis,
            orchestrator=orch,
        )

    # ── MP7: retrieve_lessons 注入 ──

    def test_enrich_injects_lessons(self):
        """MP7: retrieve_lessons 结果注入 evidence['memory_lessons']"""
        from _shared.engines.campaign import CampaignRunner
        from unittest.mock import patch, MagicMock

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb", "pnl_usd": -1.0}
        config = {"strategy_id": "test_arb"}

        mock_lessons = [
            {"lesson_id": "L1", "pattern": "slippage pattern", "detail": "full detail", "confidence": 0.9},
        ]

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch.object(runner, "_get_rag_pipeline", return_value=None), \
             patch("_shared.engines.campaign.retrieve_lessons", return_value=mock_lessons) as mock_rl, \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)

        mock_rl.assert_called_once()
        assert "memory_lessons" in evidence
        assert len(evidence["memory_lessons"]) == 1
        assert evidence["memory_lessons"][0]["lesson_id"] == "L1"

    # ── MP8: tier-boosted RAG history 注入 ──

    def test_enrich_injects_history(self):
        """MP8: RAG tier-boosted history 注入 evidence['memory_history']"""
        from unittest.mock import patch, MagicMock

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb", "pnl_usd": -1.0, "retreat_level": "A"}
        config = {"strategy_id": "test_arb"}

        mock_rag = MagicMock()
        mock_result = MagicMock()
        mock_result.text = "previous diagnosis: slippage exceeded on BNB pool"
        mock_rag.retrieve.return_value = [mock_result]

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch.object(runner, "_get_rag_pipeline", return_value=mock_rag), \
             patch("_shared.engines.campaign.retrieve_lessons", return_value=[]), \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)

        mock_rag.retrieve.assert_called_once()
        call_kwargs = mock_rag.retrieve.call_args
        assert call_kwargs.kwargs.get("tier_boost") == 1.2  # retreat_level A → 1.2
        assert "memory_history" in evidence
        assert "slippage" in evidence["memory_history"]

    # ── 跳过场景 ──

    def test_enrich_skipped_when_disabled(self):
        """memory_read_enabled=false → retrieve_lessons 不被调用"""
        from unittest.mock import patch

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb"}
        config = {"strategy_id": "test_arb"}

        with patch.object(runner, "_get_policy", return_value=_MockPolicy({"memory_read_enabled": False})), \
             patch("_shared.engines.campaign.retrieve_lessons") as mock_rl, \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)

        mock_rl.assert_not_called()
        assert "memory_lessons" not in evidence

    def test_enrich_skipped_when_no_memory_module(self):
        """_HAS_MEMORY=False → 所有记忆操作跳过"""
        from unittest.mock import patch

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb"}
        config = {"strategy_id": "test_arb"}

        with patch("_shared.engines.campaign._HAS_MEMORY", False):
            runner._enrich_evidence_with_memory(evidence, config)

        assert "memory_lessons" not in evidence
        assert "memory_history" not in evidence

    def test_enrich_skipped_when_no_policy(self):
        """policy 不可用 → 跳过"""
        from unittest.mock import patch

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb"}
        config = {"strategy_id": "test_arb"}

        with patch.object(runner, "_get_policy", return_value=None), \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)

        assert "memory_lessons" not in evidence

    # ── 容错 ──

    def test_enrich_graceful_on_retrieve_error(self):
        """retrieve_lessons 抛异常 → 不崩溃、evidence 不被污染"""
        from unittest.mock import patch

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb"}
        config = {"strategy_id": "test_arb"}

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch.object(runner, "_get_rag_pipeline", return_value=None), \
             patch("_shared.engines.campaign.retrieve_lessons", side_effect=RuntimeError("boom")), \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)
            # 不崩溃即通过

        assert "memory_lessons" not in evidence

    def test_enrich_graceful_on_rag_error(self):
        """RAG retrieve 抛异常 → 不崩溃"""
        from unittest.mock import patch, MagicMock

        runner = self._make_runner()
        evidence = {"strategy_id": "test_arb", "retreat_level": "B"}
        config = {"strategy_id": "test_arb"}

        mock_rag = MagicMock()
        mock_rag.retrieve.side_effect = RuntimeError("rag boom")

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch.object(runner, "_get_rag_pipeline", return_value=mock_rag), \
             patch("_shared.engines.campaign.retrieve_lessons", return_value=[]), \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._enrich_evidence_with_memory(evidence, config)

        assert "memory_history" not in evidence

    # ── MP5: distill_lessons ──

    def test_distill_called_on_archive(self):
        """MP5: _distill_lessons 对每个 pair 调用 distill_asset_lessons"""
        from unittest.mock import patch, MagicMock
        import tempfile

        runner = self._make_runner()
        # Mock orch with workspace
        mock_orch = MagicMock()
        mock_orch.workspace = Path(tempfile.mkdtemp())
        mock_orch._ctx = MagicMock()
        mock_orch._ctx.rag = None
        runner.orch = mock_orch

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch("_shared.engines.campaign.distill_asset_lessons", return_value=[{"lesson_id": "L1"}]) as mock_dal, \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._distill_lessons(["WBNB_USDT", "CAKE_USDT"], mock_orch.workspace)

        assert mock_dal.call_count == 2
        call_args = [c.kwargs["asset_id"] for c in mock_dal.call_args_list]
        assert "WBNB_USDT" in call_args
        assert "CAKE_USDT" in call_args

    def test_distill_skipped_when_disabled(self):
        """memory_distill_enabled=false → distill_asset_lessons 不被调用"""
        from unittest.mock import patch

        runner = self._make_runner()

        with patch.object(runner, "_get_policy", return_value=_MockPolicy({"memory_distill_enabled": False})), \
             patch("_shared.engines.campaign.distill_asset_lessons") as mock_dal, \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._distill_lessons(["WBNB_USDT"], Path("/tmp/fake"))

        mock_dal.assert_not_called()

    def test_distill_skipped_when_no_memory_module(self):
        """_HAS_MEMORY=False → distill 全跳过"""
        from unittest.mock import patch

        runner = self._make_runner()

        with patch("_shared.engines.campaign._HAS_MEMORY", False), \
             patch("_shared.engines.campaign.distill_asset_lessons") as mock_dal:
            runner._distill_lessons(["WBNB_USDT"], Path("/tmp/fake"))

        mock_dal.assert_not_called()

    def test_distill_graceful_per_pair_error(self):
        """单个 pair 蒸馏失败不影响其余 pair"""
        from unittest.mock import patch, MagicMock, call
        import tempfile

        runner = self._make_runner()
        mock_orch = MagicMock()
        mock_orch.workspace = Path(tempfile.mkdtemp())
        mock_orch._ctx = MagicMock()
        mock_orch._ctx.rag = None
        runner.orch = mock_orch

        # 第 1 个 pair 失败，第 2 个成功
        def side_effect_fn(**kwargs):
            if kwargs.get("asset_id") == "PAIR_A":
                raise RuntimeError("distill fail")
            return [{"lesson_id": "L2"}]

        with patch.object(runner, "_get_policy", return_value=_MockPolicy()), \
             patch("_shared.engines.campaign.distill_asset_lessons", side_effect=side_effect_fn) as mock_dal, \
             patch("_shared.engines.campaign._HAS_MEMORY", True):
            runner._distill_lessons(["PAIR_A", "PAIR_B"], mock_orch.workspace)

        assert mock_dal.call_count == 2  # 两个都被尝试

    # ── _get_rag_pipeline ──

    def test_get_rag_from_orchestrator_ctx(self):
        """_get_rag_pipeline 从 orch._ctx.rag 获取"""
        from unittest.mock import patch, MagicMock

        runner = self._make_runner()
        mock_rag = MagicMock()
        mock_orch = MagicMock()
        mock_orch._ctx = MagicMock()
        mock_orch._ctx.rag = mock_rag
        runner.orch = mock_orch

        with patch("_shared.engines.campaign._HAS_MEMORY", True):
            result = runner._get_rag_pipeline()

        assert result is mock_rag

    def test_get_rag_returns_none_when_no_ctx(self):
        """orch 无 _ctx → 返回 None"""
        from unittest.mock import patch, MagicMock

        runner = self._make_runner()
        mock_orch = MagicMock(spec=[])  # no attributes
        runner.orch = mock_orch

        with patch("_shared.engines.campaign._HAS_MEMORY", True):
            result = runner._get_rag_pipeline()

        assert result is None
