#!/usr/bin/env python
"""AGV Curate 集成测试 — 仅真实 LLM 调用（Layer 2）

链式依赖: collect → curate
  collect 产出: .docs/ai-skills/collect/pending/{pair_id}/
  curate 产出:  .docs/ai-skills/curate/staged/{pair_id}/

运行方式:
    python test_curate_integration.py                          # 全部
    python test_curate_integration.py TestCurateOpsBridge       # 单个类
    python test_curate_integration.py TestCurateOpsBridge.test_live_produces_strategy  # 单个方法
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

# ── 路径 ──────────────────────────────────────────────────────────────
SKILL_ROOT = Path(__file__).resolve().parents[3]  # modules/curate/test → agv-mm-arb
AGV_ROOT = Path(__file__).resolve().parents[6]    # modules/curate/test → … → AGV
COLLECT_PENDING = AGV_ROOT / ".docs" / "ai-skills" / "collect" / "pending"
CURATE_STAGED = AGV_ROOT / ".docs" / "ai-skills" / "curate" / "staged"


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

# 缓存首次导入结果（避免 sys.modules 冲突）
_curate_ops_cache: tuple | None = None


def _import_curate_ops():
    """导入 AGV CurateOps — 处理与 WQ-YI _shared 的包名冲突"""
    global _curate_ops_cache
    if _curate_ops_cache is not None:
        return _curate_ops_cache

    skills_dir = str(SKILL_ROOT.parent)  # .gemini/skills/
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)

    saved = {k: v for k, v in sys.modules.items()
             if k == "_shared" or k.startswith("_shared.")}
    for k in saved:
        del sys.modules[k]
    try:
        from _shared.engines.agent_ops_arb import CurateOps, AssetRef
        _curate_ops_cache = (CurateOps, AssetRef)
        return _curate_ops_cache
    except ImportError as e:
        raise SkipTest(f"Cannot import CurateOps: {e}")
    finally:
        for k, v in saved.items():
            sys.modules.setdefault(k, v)


def _pick_pending_pair() -> str:
    """选第一个有 pool_info 或 idea_packet 的 pair_id"""
    if not COLLECT_PENDING.is_dir():
        raise SkipTest(f"collect pending dir missing: {COLLECT_PENDING}")
    for d in sorted(COLLECT_PENDING.iterdir()):
        if d.is_dir() and (
            (d / "pool_info.yml").exists() or (d / "idea_packet.yml").exists()
        ):
            return d.name
    raise SkipTest("No collect pending pairs")


# ══════════════════════════════════════════════════════════════════════
# 1. Live → .docs/（调真实 LLM）
# ══════════════════════════════════════════════════════════════════════

class TestCurateOpsBridge:
    """CurateOps(simulate=False) → .docs/（需 WQ-YI LLM）"""

    def __init__(self):
        if not COLLECT_PENDING.is_dir() or not list(COLLECT_PENDING.iterdir()):
            raise SkipTest("No collect pending data")

    def test_live_produces_strategy(self):
        """live 模式产出 arb_strategy AssetRef → .docs/"""
        CurateOps, AssetRef = _import_curate_ops()
        pair_id = _pick_pending_pair()

        ops = CurateOps()
        signal = AssetRef(
            kind="market_signal", id=pair_id,
            path=f".docs/ai-skills/collect/pending/{pair_id}",
        )
        result = ops(
            pipeline_run_id="test-live", step_run_id="live-001",
            trace_id="test-live", assets_input=[signal],
            config={"simulate": False},
            workspace=AGV_ROOT,
        )
        assert result.success, f"CurateOps live failed: {result.metadata}"
        assert len(result.assets_produced) >= 1
        assert result.assets_produced[0].kind == "arb_strategy"
        assert result.assets_produced[0].id == pair_id

    def test_live_skeleton_on_disk(self):
        """live 模式写出骨架到 .docs/"""
        CurateOps, AssetRef = _import_curate_ops()
        pair_id = _pick_pending_pair()

        ops = CurateOps()
        signal = AssetRef(
            kind="market_signal", id=pair_id,
            path=f".docs/ai-skills/collect/pending/{pair_id}",
        )
        ops(
            pipeline_run_id="test-live-disk", step_run_id="live-002",
            trace_id="test-live-disk", assets_input=[signal],
            config={"simulate": False},
            workspace=AGV_ROOT,
        )

        staged_dir = CURATE_STAGED / pair_id
        skel_file = staged_dir / "step1_skeletons.yml"
        assert skel_file.exists(), f"skeleton not on disk at {skel_file}"

        data = yaml.safe_load(skel_file.read_text("utf-8"))
        assert isinstance(data, dict)
        assert "tower_templates" in data or "yi_templates" in data


# ── 入口 ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(_run_all(
        TestCurateOpsBridge,
        filter_name=filt,
    ))
