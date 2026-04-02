"""Layer 1 — 管线产出物磁盘验证（纯文件读取，零网络/LLM/链上）

从 3 个 Layer 2 集成测试中剥离：
  - test_execute_integration.py → TestDatasetArtifacts (3) + TestStrategyConstruction (2)
  - test_curate_integration.py  → TestCurateOutput (2)
  - test_dataset_integration.py → TestExistingDatasetOutput (2)
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

# ── 路径 ──────────────────────────────────────────────────────────────
AGV_ROOT = Path(__file__).resolve().parents[4]  # tests → agv-mm-arb → skills → .gemini → AGV
CURATE_STAGED = AGV_ROOT / ".docs" / "ai-skills" / "curate" / "staged"
DATASET_OUTPUT = AGV_ROOT / ".docs" / "ai-skills" / "dataset" / "output"

# ── fixtures ─────────────────────────────────────────────────────────

_curate_available = CURATE_STAGED.is_dir() and any(
    (d / "step1_skeletons.yml").exists()
    for d in CURATE_STAGED.iterdir()
    if d.is_dir()
) if CURATE_STAGED.is_dir() else False

_dataset_available = DATASET_OUTPUT.is_dir() and any(
    (d / "indicator_binding.yml").exists()
    for d in DATASET_OUTPUT.iterdir()
    if d.is_dir()
) if DATASET_OUTPUT.is_dir() else False

skip_no_curate = pytest.mark.skipif(
    not _curate_available, reason="No curate staged data on disk"
)
skip_no_dataset = pytest.mark.skipif(
    not _dataset_available, reason="No dataset output on disk"
)


def _pick_dataset_pair() -> str:
    for d in sorted(DATASET_OUTPUT.iterdir()):
        if d.is_dir() and (d / "indicator_binding.yml").exists():
            return d.name
    pytest.skip("No dataset output with indicator_binding.yml")


# ══════════════════════════════════════════════════════════════════════
# curate 产出物（原 TestCurateOutput）
# ══════════════════════════════════════════════════════════════════════

@skip_no_curate
class TestCurateArtifacts:
    """验证 .docs/ 上已有的 curate 产出物"""

    def test_at_least_one_staged(self):
        count = sum(1 for d in CURATE_STAGED.iterdir()
                    if d.is_dir() and (d / "step1_skeletons.yml").exists())
        assert count >= 1, f"Expected ≥1 staged skeletons, got {count}"

    def test_skeleton_schema(self):
        for d in CURATE_STAGED.iterdir():
            skel = d / "step1_skeletons.yml"
            if not skel.exists():
                continue
            data = yaml.safe_load(skel.read_text("utf-8"))
            assert isinstance(data, dict), f"{d.name}: not a dict"
            has_templates = ("tower_templates" in data) or ("yi_templates" in data)
            assert has_templates, f"{d.name}: missing templates"


# ══════════════════════════════════════════════════════════════════════
# dataset 产出物（原 TestExistingDatasetOutput + TestDatasetArtifacts）
# ══════════════════════════════════════════════════════════════════════

@skip_no_dataset
class TestDatasetArtifacts:
    """验证 .docs/ 上已有的 dataset 产出物"""

    def test_at_least_one_pair_has_output(self):
        count = sum(1 for d in DATASET_OUTPUT.iterdir()
                    if d.is_dir() and (d / "indicator_binding.yml").exists())
        assert count >= 1, f"Expected ≥1 dataset output, got {count}"

    def test_output_schema(self):
        for d in DATASET_OUTPUT.iterdir():
            yml = d / "indicator_binding.yml"
            if not yml.exists():
                continue
            data = yaml.safe_load(yml.read_text("utf-8"))
            assert isinstance(data, dict), f"{d.name}: not a dict"
            has_bindings = ("indicator_bindings" in data or
                           "bindings" in data or
                           "category" in data)
            assert has_bindings, f"{d.name}: missing bindings key, got {list(data.keys())}"

    def test_indicator_binding_exists(self):
        pair_id = _pick_dataset_pair()
        assert (DATASET_OUTPUT / pair_id / "indicator_binding.yml").exists()

    def test_slot_categories_exists(self):
        pair_id = _pick_dataset_pair()
        assert (DATASET_OUTPUT / pair_id / "slot_categories.yml").exists()

    def test_indicator_binding_has_bindings(self):
        pair_id = _pick_dataset_pair()
        data = yaml.safe_load(
            (DATASET_OUTPUT / pair_id / "indicator_binding.yml").read_text()
        )
        bindings = data.get("indicator_bindings") or data.get("bindings", [])
        assert len(bindings) > 0, f"no bindings, keys: {list(data.keys())}"


# ══════════════════════════════════════════════════════════════════════
# 策略构建（原 TestStrategyConstruction）
# ══════════════════════════════════════════════════════════════════════

@skip_no_dataset
class TestStrategyConstruction:
    """验证 dataset → StrategyRef 纯内存转换"""

    def test_build_strategies(self):
        from toolloop_arb import build_strategies_from_binding, _resolve_pool_info
        pair_id = _pick_dataset_pair()
        ind = DATASET_OUTPUT / pair_id / "indicator_binding.yml"
        cat = DATASET_OUTPUT / pair_id / "slot_categories.yml"
        pool = _resolve_pool_info(pair_id, AGV_ROOT)
        strategies = build_strategies_from_binding(ind, cat, pool)
        assert len(strategies) >= 1
        s = strategies[0]
        assert s.strategy_id, "missing strategy_id"
        assert s.entry["pool_address"], "missing pool_address"
        assert s.entry["token_in"], "missing token_in"
        assert s.entry["token_out"], "missing token_out"

    def test_pool_resolution(self):
        from toolloop_arb import _resolve_pool_info
        pair_id = _pick_dataset_pair()
        pool = _resolve_pool_info(pair_id, AGV_ROOT)
        assert pool["pool_address"]
        assert pool["token_in"]
        assert pool["token_out"]
