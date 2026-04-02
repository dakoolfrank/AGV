#!/usr/bin/env python
"""AGV Dataset 集成测试 — 仅真实 LLM 调用（Layer 2）

链式依赖: collect → curate → dataset
  curate 产出: .docs/ai-skills/curate/staged/{pair_id}/
  dataset 产出: .docs/ai-skills/dataset/output/{pair_id}/

运行方式:
    python test_dataset_integration.py                           # 全部
    python test_dataset_integration.py TestDatasetLiveBridge      # 单个类
    python test_dataset_integration.py TestDatasetLiveBridge.test_live_produces_binding  # 单个方法
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

# ── 路径 ──────────────────────────────────────────────────────────────
SKILL_ROOT = Path(__file__).resolve().parents[3]  # modules/dataset/test → agv-mm-arb
AGV_ROOT = Path(__file__).resolve().parents[6]    # modules/dataset/test → … → AGV
CURATE_STAGED = AGV_ROOT / ".docs" / "ai-skills" / "curate" / "staged"
DATASET_OUTPUT = AGV_ROOT / ".docs" / "ai-skills" / "dataset" / "output"


# ── 测试基础设施 ─────────────────────────────────────────────────────

class SkipTest(Exception):
    """跳过测试"""


def _run_all(*classes, filter_name: str | None = None) -> int:
    """轻量测试运行器。filter_name: 'ClassName' 或 'ClassName.method_name'"""
    passed = failed = skipped = 0
    for cls in classes:
        if filter_name and "." not in filter_name and cls.__name__ != filter_name:
            continue
        try:
            obj = cls()
        except SkipTest as e:
            for m in sorted(dir(cls)):
                if m.startswith("test_"):
                    skipped += 1
                    print(f"  ⊘  {cls.__name__}.{m}: {e}")
            continue
        for name in sorted(dir(obj)):
            if not name.startswith("test_"):
                continue
            if filter_name and "." in filter_name:
                if name != filter_name.split(".", 1)[1]:
                    continue
            label = f"{cls.__name__}.{name}"
            try:
                getattr(obj, name)()
                passed += 1
                print(f"  ✓  {label}")
            except SkipTest as e:
                skipped += 1
                print(f"  ⊘  {label}: {e}")
            except AssertionError as e:
                failed += 1
                print(f"  ✗  {label}: {e}")
            except Exception as e:
                failed += 1
                print(f"  ✗  {label}: {type(e).__name__}: {e}")
    print(f"\n{'='*60}")
    print(f"  {passed} passed, {failed} failed, {skipped} skipped")
    return 1 if failed else 0


# ── 辅助函数 ─────────────────────────────────────────────────────────

def _import_dataset_ops():
    """导入 AGV DatasetOps — 处理与 WQ-YI _shared 的包名冲突"""
    skills_dir = str(SKILL_ROOT.parent)  # .gemini/skills/
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)

    saved = {k: v for k, v in sys.modules.items()
             if k == "_shared" or k.startswith("_shared.")}
    for k in saved:
        del sys.modules[k]
    try:
        from _shared.engines.agent_ops_arb import DatasetOps, AssetRef, StepResult
        return DatasetOps, AssetRef, StepResult
    except ImportError as e:
        raise SkipTest(f"Cannot import DatasetOps: {e}")
    finally:
        for k, v in saved.items():
            sys.modules.setdefault(k, v)


def _pick_staged_pair() -> str:
    """选第一个有骨架的 pair_id"""
    if not CURATE_STAGED.is_dir():
        raise SkipTest(f"curate staged dir missing: {CURATE_STAGED}")
    for d in sorted(CURATE_STAGED.iterdir()):
        if d.is_dir() and (d / "step1_skeletons.yml").exists():
            return d.name
    raise SkipTest("No curate staged skeletons")


# ══════════════════════════════════════════════════════════════════════
# 1. Live → .docs/（调真实 LLM）
# ══════════════════════════════════════════════════════════════════════

class TestDatasetLiveBridge:
    """DatasetOps(simulate=False) → .docs/（需 WQ-YI LLM）"""

    def __init__(self):
        if not CURATE_STAGED.is_dir():
            raise SkipTest("No curate staged data")

    def test_live_produces_binding(self):
        """live 模式对单个 pair 产出 dataset_binding → .docs/"""
        DatasetOps, AssetRef, _ = _import_dataset_ops()
        pair_id = _pick_staged_pair()

        ops = DatasetOps()
        strat = AssetRef(
            kind="arb_strategy", id=pair_id,
            path=f".docs/ai-skills/curate/staged/{pair_id}",
        )
        result = ops(
            pipeline_run_id="test-live", step_run_id="live-001",
            trace_id="test-live", assets_input=[strat],
            config={"simulate": False},
            workspace=AGV_ROOT,
        )
        assert result.success, f"live failed: {result.metadata}"
        assert len(result.assets_produced) >= 1
        assert result.assets_produced[0].kind == "dataset_binding"

    def test_live_writes_both_files(self):
        """live 模式写出 slot_categories.yml + indicator_binding.yml 到 .docs/"""
        DatasetOps, AssetRef, _ = _import_dataset_ops()
        pair_id = _pick_staged_pair()

        ops = DatasetOps()
        strat = AssetRef(
            kind="arb_strategy", id=pair_id,
            path=f".docs/ai-skills/curate/staged/{pair_id}",
        )
        ops(
            pipeline_run_id="test-live-disk", step_run_id="live-002",
            trace_id="test-live-disk", assets_input=[strat],
            config={"simulate": False},
            workspace=AGV_ROOT,
        )

        output_dir = DATASET_OUTPUT / pair_id
        assert (output_dir / "slot_categories.yml").exists(), "L1 file missing"
        assert (output_dir / "indicator_binding.yml").exists(), "L2 file missing"


# ── 入口 ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(_run_all(
        TestDatasetLiveBridge,
        filter_name=filt,
    ))
