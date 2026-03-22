"""
DiagnosisEngine — S5 Arb-Campaign 三级回退诊断引擎

当 Arb execute 步骤失败后，由 Campaign 调用本引擎
诊断根因并产出 RepairDiagnosis，指导三级回退：
  Level A → execute (参数调整)
  Level B → curate  (因子切换)
  Level C → collect    (策略重构)

设计要点:
- Flash 做快速初判，Pro **始终**做仲裁验证（涉及资金安全）
- MM-Campaign 纯确定性，不走本引擎
- 不抛异常，任何失败路径返回 None → Campaign 停机
- Prompt 从 prompts/diagnosis.md 加载（SkillPromptStore 模式）

使用示例::

    engine = DiagnosisEngine(llm=my_client, prompts=my_store)
    result = engine.diagnose(evidence_bundle, strategy_id="arb_bnb_usdt")
    if result is None:
        # 停机 — 诊断失败
        ...

参照: WQ-YI ``_shared/engines/diagnosis.py``（Flash+Pro 模式 + 确定性检测器）
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)


# ============================================================
# 协议定义（LLM + PromptStore）
# ============================================================

class LLMClient(Protocol):
    """最小 LLM 接口 — 适配任意后端"""

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str = "",
        temperature: float = 0.0,
        schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ...


class PromptStore(Protocol):
    """Prompt 检索接口 — 兼容 SkillPromptStore"""

    def get(self, name: str) -> str:
        ...

    def has(self, name: str) -> bool:
        ...

    def get_hash(self, name: str) -> str:
        ...


# ============================================================
# 三级回退配置
# ============================================================

# reason_code 枚举
DIAGNOSIS_REASON_CODES: frozenset[str] = frozenset({
    # Level A: 参数调整
    "PARAM_DRIFT",
    "SLIPPAGE_EXCEEDED",
    "MEV_DETECTED",
    # Level B: 因子切换
    "FACTOR_EXHAUSTED",
    "SIGNAL_STALE",
    "DATA_SOURCE_ERROR",
    # Level C: 策略重构
    "STRUCTURAL_CHANGE",
    "BUDGET_EXCEEDED",
    "STRATEGY_INVALID",
})

# reason_code → retreat level
REASON_CODE_LEVEL: dict[str, str] = {
    "PARAM_DRIFT":       "A",
    "SLIPPAGE_EXCEEDED": "A",
    "MEV_DETECTED":      "A",
    "FACTOR_EXHAUSTED":  "B",
    "SIGNAL_STALE":      "B",
    "DATA_SOURCE_ERROR": "B",
    "STRUCTURAL_CHANGE": "C",
    "BUDGET_EXCEEDED":   "C",
    "STRATEGY_INVALID":  "C",
}

# retreat level → target_step
LEVEL_TO_TARGET_STEP: dict[str, str] = {
    "A": "execute",   # 参数调整 → 同策略重试
    "B": "curate",    # 因子切换 → 重新组合
    "C": "collect",   # 策略重构 → 从头收集
}

# 合法的 target_step
VALID_REPAIR_TARGETS: frozenset[str] = frozenset({"execute", "curate", "collect"})


# ============================================================
# 数据结构
# ============================================================

class RepairDiagnosis:
    """诊断结果 — 由 Flash+Pro 产出

    与 WQ-YI 的 RepairDiagnosis 对标，但字段适配 DeFi 场景。
    """
    __slots__ = (
        "diagnosis_id", "target_step", "strategy_id", "reason_code",
        "retreat_level", "confidence", "evidence_refs", "why_not_others",
        "repair_hint", "flash_raw", "pro_final", "prompt_hashes",
    )

    def __init__(
        self,
        *,
        diagnosis_id: str,
        target_step: str,
        strategy_id: str,
        reason_code: str,
        retreat_level: str,
        confidence: float,
        evidence_refs: list[str] | None = None,
        why_not_others: str = "",
        repair_hint: str = "",
        flash_raw: dict[str, Any] | None = None,
        pro_final: dict[str, Any] | None = None,
        prompt_hashes: dict[str, str] | None = None,
    ) -> None:
        self.diagnosis_id = diagnosis_id
        self.target_step = target_step
        self.strategy_id = strategy_id
        self.reason_code = reason_code
        self.retreat_level = retreat_level
        self.confidence = confidence
        self.evidence_refs = evidence_refs or []
        self.why_not_others = why_not_others
        self.repair_hint = repair_hint
        self.flash_raw = flash_raw or {}
        self.pro_final = pro_final or {}
        self.prompt_hashes = prompt_hashes or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "diagnosis_id": self.diagnosis_id,
            "target_step": self.target_step,
            "strategy_id": self.strategy_id,
            "reason_code": self.reason_code,
            "retreat_level": self.retreat_level,
            "confidence": self.confidence,
            "evidence_refs": self.evidence_refs,
            "why_not_others": self.why_not_others,
            "repair_hint": self.repair_hint,
            "flash_raw": self.flash_raw,
            "pro_final": self.pro_final,
            "prompt_hashes": self.prompt_hashes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RepairDiagnosis":
        return cls(
            diagnosis_id=data["diagnosis_id"],
            target_step=data["target_step"],
            strategy_id=data["strategy_id"],
            reason_code=data["reason_code"],
            retreat_level=data["retreat_level"],
            confidence=data["confidence"],
            evidence_refs=data.get("evidence_refs", []),
            why_not_others=data.get("why_not_others", ""),
            repair_hint=data.get("repair_hint", ""),
            flash_raw=data.get("flash_raw", {}),
            pro_final=data.get("pro_final", {}),
            prompt_hashes=data.get("prompt_hashes", {}),
        )


class HaltDecision:
    """停机决策 — Campaign 遇到无法自动处理的情况时产出"""
    __slots__ = ("reason", "strategy_id", "diagnosis", "message")

    def __init__(
        self,
        *,
        reason: str,
        strategy_id: str,
        diagnosis: RepairDiagnosis | None = None,
        message: str = "",
    ) -> None:
        self.reason = reason
        self.strategy_id = strategy_id
        self.diagnosis = diagnosis
        self.message = message

    def to_dict(self) -> dict[str, Any]:
        return {
            "reason": self.reason,
            "strategy_id": self.strategy_id,
            "diagnosis": self.diagnosis.to_dict() if self.diagnosis else None,
            "message": self.message,
        }


# ============================================================
# 工具函数
# ============================================================

def make_diagnosis_id(
    reason_code: str,
    strategy_id: str,
    target_step: str,
) -> str:
    """生成确定性 diagnosis_id（SHA256[:12]）"""
    raw = f"{reason_code}:{strategy_id}:{target_step}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def validate_diagnosis(diagnosis: RepairDiagnosis | None) -> str | None:
    """校验诊断合法性

    Returns:
        None: 合法
        str: 停机原因
    """
    if diagnosis is None:
        return "no_diagnosis"

    if not diagnosis.strategy_id:
        return "empty_scope"

    if diagnosis.target_step not in VALID_REPAIR_TARGETS:
        return "invalid_target"

    if diagnosis.reason_code not in DIAGNOSIS_REASON_CODES:
        return "invalid_reason_code"

    if not diagnosis.evidence_refs:
        return "no_evidence"

    # reason_code → retreat_level → target_step 一致性
    expected_level = REASON_CODE_LEVEL.get(diagnosis.reason_code)
    expected_step = LEVEL_TO_TARGET_STEP.get(expected_level or "")
    if expected_step and expected_step != diagnosis.target_step:
        return "target_step_mismatch"

    return None


# ============================================================
# 确定性检测器（零 LLM — 优先于 Flash 调用）
# ============================================================

def detect_slippage_issue(
    evidence: dict[str, Any],
    threshold: float = 0.02,
) -> RepairDiagnosis | None:
    """确定性检测：滑点超阈值 → Level A"""
    slippage = evidence.get("actual_slippage_pct", 0)
    if slippage > threshold:
        strategy_id = evidence.get("strategy_id", "unknown")
        return RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("SLIPPAGE_EXCEEDED", strategy_id, "execute"),
            target_step="execute",
            strategy_id=strategy_id,
            reason_code="SLIPPAGE_EXCEEDED",
            retreat_level="A",
            confidence=1.0,
            evidence_refs=["slippage_detection"],
            why_not_others=f"滑点 {slippage:.1%} > 阈值 {threshold:.1%}，确定性信号",
            repair_hint=f"建议降低 max_slippage_pct 至 {threshold * 0.8:.4f}",
        )
    return None


def detect_tvl_drop(
    evidence: dict[str, Any],
    tvl_floor: float = 30.0,
) -> RepairDiagnosis | None:
    """确定性检测：TVL 低于熔断线 → Level C"""
    tvl = evidence.get("pool_tvl_usd", float("inf"))
    if tvl < tvl_floor:
        strategy_id = evidence.get("strategy_id", "unknown")
        return RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("STRUCTURAL_CHANGE", strategy_id, "collect"),
            target_step="collect",
            strategy_id=strategy_id,
            reason_code="STRUCTURAL_CHANGE",
            retreat_level="C",
            confidence=1.0,
            evidence_refs=["tvl_circuit_breaker"],
            why_not_others=f"池 TVL ${tvl:.0f} < 熔断线 ${tvl_floor:.0f}",
            repair_hint="池深度不足，需从头收集寻找替代池",
        )
    return None


def detect_budget_exceeded(
    evidence: dict[str, Any],
    daily_cap: float = 500.0,
    halt_ratio: float = 0.5,
) -> RepairDiagnosis | None:
    """确定性检测：累计亏损超预算阈值 → Level C"""
    loss = evidence.get("cumulative_loss_usd", 0)
    if loss > daily_cap * halt_ratio:
        strategy_id = evidence.get("strategy_id", "unknown")
        return RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("BUDGET_EXCEEDED", strategy_id, "collect"),
            target_step="collect",
            strategy_id=strategy_id,
            reason_code="BUDGET_EXCEEDED",
            retreat_level="C",
            confidence=1.0,
            evidence_refs=["budget_monitor"],
            why_not_others=f"累计亏损 ${loss:.0f} > 阈值 ${daily_cap * halt_ratio:.0f}",
            repair_hint="暂停所有策略，等待市场恢复后从头收集",
        )
    return None


def detect_mev_attack(
    evidence: dict[str, Any],
    price_impact_threshold: float = 0.005,
) -> RepairDiagnosis | None:
    """确定性检测：三明治攻击信号 → Level A"""
    mev = evidence.get("mev_detected", False)
    impact = evidence.get("price_impact_pct", 0)
    if mev or impact > price_impact_threshold:
        strategy_id = evidence.get("strategy_id", "unknown")
        return RepairDiagnosis(
            diagnosis_id=make_diagnosis_id("MEV_DETECTED", strategy_id, "execute"),
            target_step="execute",
            strategy_id=strategy_id,
            reason_code="MEV_DETECTED",
            retreat_level="A",
            confidence=0.95,
            evidence_refs=["mev_detection"],
            why_not_others="三明治攻击信号，调整 deadline / 拆分交易可缓解",
            repair_hint="缩短 deadline 至 30s，拆分大额交易",
        )
    return None


# 确定性检测器注册表（优先级从高到低）
DETERMINISTIC_DETECTORS = [
    detect_tvl_drop,
    detect_budget_exceeded,
    detect_mev_attack,
    detect_slippage_issue,
]


# ============================================================
# Prompt 加载
# ============================================================

_DIAGNOSIS_MD = Path(__file__).resolve().parent.parent / "prompts" / "diagnosis.md"


def _load_diagnosis_prompts() -> "PromptStore | None":
    """从 diagnosis.md 加载 prompt，失败时返回 None"""
    try:
        from ..prompts import SkillPromptStore
        if _DIAGNOSIS_MD.exists():
            return SkillPromptStore(_DIAGNOSIS_MD)
    except Exception:
        pass
    return None


_CAMPAIGN_MD = Path(__file__).resolve().parent.parent / "prompts" / "campaign.md"


def _load_campaign_prompts() -> "PromptStore | None":
    """从 campaign.md 加载 prompt，失败时返回 None"""
    try:
        from ..prompts import SkillPromptStore
        if _CAMPAIGN_MD.exists():
            return SkillPromptStore(_CAMPAIGN_MD)
    except Exception:
        pass
    return None


# ============================================================
# DiagnosisEngine（Flash + Pro）
# ============================================================

class DiagnosisEngine:
    """三级回退诊断引擎（Arb-Campaign 专用）

    流程：
    1. 确定性检测器优先 → 有结果直接返回（跳过 LLM）
    2. Flash LLM 快速初判
    3. Pro LLM 始终仲裁验证（资金安全）
    4. Pro disagree → 使用 Pro 结果
    5. 任何异常 → 返回 None → Campaign 停机

    参照: WQ-YI DiagnosisEngine（Flash+Pro 模式）
    """

    def __init__(
        self,
        *,
        llm: LLMClient | None = None,
        prompts: PromptStore | None = None,
        model: str = "",
    ) -> None:
        self._llm = llm
        self._prompts = prompts or _load_diagnosis_prompts()
        self._model = model

    def diagnose(
        self,
        evidence: dict[str, Any],
        strategy_id: str,
    ) -> RepairDiagnosis | None:
        """执行诊断：确定性检测 → Flash → Pro

        Returns:
            RepairDiagnosis 或 None（诊断失败 → 停机）
        """
        # ── Phase 0: 确定性检测器 ──
        for detector in DETERMINISTIC_DETECTORS:
            result = detector(evidence)
            if result is not None:
                logger.info(
                    "[Diagnosis] 确定性检测命中: %s (strategy=%s)",
                    result.reason_code, strategy_id,
                )
                return result

        # ── Phase 1: Flash ──
        flash_result = self._run_flash(evidence, strategy_id)
        if flash_result is None:
            logger.warning("[Diagnosis] Flash 失败 (strategy=%s)", strategy_id)
            return None

        # ── Phase 2: Pro 仲裁 ──
        pro_result = self._run_pro(evidence, strategy_id, flash_result)
        if pro_result is None:
            # Pro 失败 → 回退使用 Flash（DeFi 场景 Flash 已足够保守）
            logger.warning("[Diagnosis] Pro 失败，回退 Flash (strategy=%s)", strategy_id)
            return flash_result

        # Pro agree → 保留 Flash; Pro disagree → 使用 Pro
        if pro_result.get("flash_agreement", True):
            flash_result.pro_final = pro_result
            return flash_result

        # Pro 覆盖 Flash
        logger.info(
            "[Diagnosis] Pro 覆盖 Flash: %s → %s (strategy=%s)",
            flash_result.reason_code,
            pro_result.get("reason_code", "?"),
            strategy_id,
        )
        return self._build_from_llm_output(pro_result, strategy_id, flash_raw=flash_result.to_dict())

    def _run_flash(
        self,
        evidence: dict[str, Any],
        strategy_id: str,
    ) -> RepairDiagnosis | None:
        """Flash 层快速初判"""
        if self._llm is None or self._prompts is None:
            return None

        if not self._prompts.has("diagnosis_flash_system"):
            return None

        try:
            system = self._prompts.get("diagnosis_flash_system").format(
                strategy_id=strategy_id,
            )
            user = self._prompts.get("diagnosis_flash_user").format(
                strategy_id=strategy_id,
                factor_combination=evidence.get("factor_combination", "unknown"),
                trading_pair=evidence.get("trading_pair", "unknown"),
                pool_address=evidence.get("pool_address", "unknown"),
                pnl_usd=evidence.get("pnl_usd", 0),
                gas_cost_usd=evidence.get("gas_cost_usd", 0),
                actual_slippage_pct=evidence.get("actual_slippage_pct", 0),
                mev_detected=evidence.get("mev_detected", False),
                consecutive_failures=evidence.get("consecutive_failures", 0),
                cumulative_loss_usd=evidence.get("cumulative_loss_usd", 0),
                factor_correlation=evidence.get("factor_correlation", 0),
                remaining_budget_usd=evidence.get("remaining_budget_usd", 0),
                pool_tvl_usd=evidence.get("pool_tvl_usd", 0),
                volume_24h_usd=evidence.get("volume_24h_usd", 0),
                price_impact_pct=evidence.get("price_impact_pct", 0),
                evidence_bundle=self._format_evidence(evidence),
            )

            raw = self._llm.generate_json(
                system_prompt=system,
                user_prompt=user,
                model=self._model,
                temperature=0.0,
            )
            return self._build_from_llm_output(raw, strategy_id)
        except Exception:
            logger.exception("[Diagnosis] Flash 异常 (strategy=%s)", strategy_id)
            return None

    def _run_pro(
        self,
        evidence: dict[str, Any],
        strategy_id: str,
        flash_diag: RepairDiagnosis,
    ) -> dict[str, Any] | None:
        """Pro 层仲裁验证"""
        if self._llm is None or self._prompts is None:
            return None

        if not self._prompts.has("diagnosis_pro_system"):
            return None

        try:
            import json
            system = self._prompts.get("diagnosis_pro_system")
            user = self._prompts.get("diagnosis_pro_user").format(
                flash_diagnosis_json=json.dumps(flash_diag.to_dict(), indent=2, ensure_ascii=False),
                full_evidence_bundle=self._format_evidence(evidence),
                diagnosis_history=evidence.get("diagnosis_history", "无历史记录"),
            )

            raw = self._llm.generate_json(
                system_prompt=system,
                user_prompt=user,
                model=self._model,
                temperature=0.0,
            )
            return raw
        except Exception:
            logger.exception("[Diagnosis] Pro 异常 (strategy=%s)", strategy_id)
            return None

    def _build_from_llm_output(
        self,
        raw: dict[str, Any],
        strategy_id: str,
        *,
        flash_raw: dict[str, Any] | None = None,
    ) -> RepairDiagnosis | None:
        """从 LLM 输出构建 RepairDiagnosis"""
        target_step = raw.get("target_step", "")
        reason_code = raw.get("reason_code", "")

        if target_step not in VALID_REPAIR_TARGETS:
            return None
        if reason_code not in DIAGNOSIS_REASON_CODES:
            return None

        retreat_level = raw.get("retreat_level") or REASON_CODE_LEVEL.get(reason_code, "C")

        prompt_hashes: dict[str, str] = {}
        if self._prompts:
            for name in ("diagnosis_flash_system", "diagnosis_pro_system"):
                if self._prompts.has(name):
                    prompt_hashes[name] = self._prompts.get_hash(name)

        return RepairDiagnosis(
            diagnosis_id=make_diagnosis_id(reason_code, strategy_id, target_step),
            target_step=target_step,
            strategy_id=strategy_id,
            reason_code=reason_code,
            retreat_level=retreat_level,
            confidence=raw.get("confidence", 0.5),
            evidence_refs=raw.get("evidence_refs", []),
            why_not_others=raw.get("why_not_others", ""),
            repair_hint=raw.get("repair_hint", ""),
            flash_raw=flash_raw or raw,
            pro_final=raw if flash_raw else {},
            prompt_hashes=prompt_hashes,
        )

    @staticmethod
    def _format_evidence(evidence: dict[str, Any]) -> str:
        """格式化证据包供 LLM 消费"""
        lines: list[str] = []
        for key, val in sorted(evidence.items()):
            if key in ("diagnosis_history",):
                continue
            lines.append(f"- {key}: {val}")
        return "\n".join(lines) if lines else "(无证据)"
