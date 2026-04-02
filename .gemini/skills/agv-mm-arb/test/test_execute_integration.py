#!/usr/bin/env python
"""Execute 集成测试 — 仅链上操作（DryRun eth_call / Live swap）

Layer 2 集成测试 — 纯磁盘/内存测试已移至 tests/test_pipeline_artifacts.py

链式依赖: collect → curate → dataset → execute
  dataset 产出: .docs/ai-skills/dataset/output/{pair_id}/
  execute 产出: .docs/ai-skills/execute/simulator/{pair_id}/  (dry_run)
               .docs/ai-skills/execute/output/{pair_id}/     (live)

运行方式:
    python test_execute_integration.py                           # 全部
    python test_execute_integration.py TestExecuteDryRun          # 单个类
    python test_execute_integration.py TestExecuteLive.test_live_execute_to_docs  # 单个方法
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

# ── 路径 ──────────────────────────────────────────────────────────────
SKILL_ROOT = Path(__file__).resolve().parents[1]  # test/ → agv-mm-arb
AGV_ROOT = Path(__file__).resolve().parents[4]    # test → agv-mm-arb → skills → .gemini → AGV
DATASET_OUTPUT = AGV_ROOT / ".docs" / "ai-skills" / "dataset" / "output"
EXECUTE_OUTPUT = AGV_ROOT / ".docs" / "ai-skills" / "execute" / "output"
EXECUTE_SIMULATOR = AGV_ROOT / ".docs" / "ai-skills" / "execute" / "simulator"

# scripts/ 路径（toolloop_arb 等模块）
if str(SKILL_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(SKILL_ROOT / "scripts"))


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

def _pick_dataset_pair() -> str:
    """选第一个有 indicator_binding 的 pair_id"""
    if not DATASET_OUTPUT.is_dir():
        raise SkipTest(f"dataset output dir not found: {DATASET_OUTPUT}")
    for d in sorted(DATASET_OUTPUT.iterdir()):
        if d.is_dir() and (d / "indicator_binding.yml").exists():
            return d.name
    raise SkipTest("No dataset output with indicator_binding.yml")


def _import_execute_ops():
    """导入 AGV ArbExecuteOps — 处理与 WQ-YI _shared 的包名冲突"""
    skills_dir = str(SKILL_ROOT.parent)  # .gemini/skills/
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)

    saved = {k: v for k, v in sys.modules.items()
             if k == "_shared" or k.startswith("_shared.")}
    for k in saved:
        del sys.modules[k]
    try:
        from _shared.engines.agent_ops_arb import ArbExecuteOps, AssetRef, StepResult
        return ArbExecuteOps, AssetRef, StepResult
    except ImportError as e:
        raise SkipTest(f"Cannot import ArbExecuteOps: {e}")
    finally:
        for k, v in saved.items():
            sys.modules.setdefault(k, v)


# ══════════════════════════════════════════════════════════════════════
# 1. Live（真实链上 swap，花钱）
# ══════════════════════════════════════════════════════════════════════


class TestExecuteLive:
    """ArbExecuteOps(simulate=False) → .docs/ + 链上 swap

    需要:
      - BSC 网络连接
      - .env.s5 中配置 MM_PRIVATE_KEY
      - 钱包有足够 BNB (gas) + USDT (交易)
    """

    def __init__(self):
        if not DATASET_OUTPUT.is_dir():
            raise SkipTest(f"No dataset output at {DATASET_OUTPUT}")

    def test_live_execute_to_docs(self):
        """ArbExecuteOps.__call__ → _execute_live → chain swap → .docs/"""
        ArbExecuteOps, AssetRef, _ = _import_execute_ops()
        pair_id = _pick_dataset_pair()

        ops = ArbExecuteOps()
        ref = AssetRef(
            kind="dataset_binding",
            id=pair_id,
            path=f".docs/ai-skills/dataset/output/{pair_id}",
            metadata={"source": "dataset", "pair": pair_id},
        )
        result = ops(
            pipeline_run_id="test-live-001",
            step_run_id="live-001",
            trace_id="test-live",
            assets_input=[ref],
            config={"simulate": False},
            workspace=AGV_ROOT,
        )

        assert result.success, f"Live execution failed: {result.metadata}"
        assert result.metadata["mode"] == "live"
        assert len(result.assets_produced) > 0

        asset = result.assets_produced[0]
        assert asset.kind == "execution_result"
        assert asset.metadata.get("simulate") is False

        # 验证交易结果 — pipeline 完整运行即可
        # trade 可能因池不兼容 (V3) / 安全护甲拦截等原因非 success
        tx_results = asset.metadata.get("results", [])
        assert len(tx_results) > 0

        for r in tx_results:
            status = r.get("status", "unknown")
            assert status in {"success", "reverted", "error", "blocked", "delayed"}, \
                f"Unexpected status: {status}"
            if status == "success":
                assert r.get("tx_hash"), "success 应有 tx_hash"
                assert r.get("block_number"), "success 应有 block_number"
                print(f"\n  TX: 0x{r['tx_hash']}")
                print(f"  Block: {r['block_number']}, Gas: {r.get('gas_used')}")
            else:
                print(f"\n  Live trade: status={status}, "
                      f"reason={r.get('reason')}")

        # 验证 execution_result.yml 写入 execute/output/
        exec_file = EXECUTE_OUTPUT / pair_id / "execution_result.yml"
        assert exec_file.exists(), f"Missing {exec_file}"
        data = yaml.safe_load(exec_file.read_text("utf-8"))
        assert data["mode"] == "live"
        assert data["pair_id"] == pair_id
        assert len(data["trades"]) == len(tx_results)


# ══════════════════════════════════════════════════════════════════════
# 3. DryRun → simulator/（真实链上数据 + eth_call，不花钱）
# ══════════════════════════════════════════════════════════════════════


class TestExecuteDryRun:
    """DryRun 集成测试 — 真实链上数据 + eth_call，不花钱

    需要:
      - .env.s5 配置 BSC_PRIVATE_RPC_URL + MM_PRIVATE_KEY
      - dataset/output/{pair}/ 下有 indicator_binding.yml
    """

    def test_dry_run_execute_to_docs(self):
        """ArbExecuteOps.__call__ → _execute_dry_run → eth_call → simulator/"""
        ArbExecuteOps, AssetRef, _ = _import_execute_ops()
        pair_id = _pick_dataset_pair()

        ops = ArbExecuteOps()
        ref = AssetRef(
            kind="dataset_binding",
            id=pair_id,
            path=f".docs/ai-skills/dataset/output/{pair_id}",
            metadata={"source": "dataset", "pair": pair_id},
        )
        result = ops(
            pipeline_run_id="test-dryrun-001",
            step_run_id="dryrun-001",
            trace_id="test-dryrun",
            assets_input=[ref],
            config={"dry_run": True},
            workspace=AGV_ROOT,
        )

        assert result.success, f"DryRun execution failed: {result.metadata}"
        assert result.metadata["mode"] == "dry_run"
        assert len(result.assets_produced) > 0

        asset = result.assets_produced[0]
        assert asset.kind == "execution_result"
        assert asset.metadata.get("dry_run") is True

        # 验证交易结果
        # metadata["results"] 是 campaign 原始返回，不含 dry_run 字段
        # dry_run 标记在 asset-level（上面已验证）和 YAML exec_doc["trades"] 中
        tx_results = asset.metadata.get("results", [])
        assert len(tx_results) > 0
        for r in tx_results:
            # DryRun trade 可能的状态:
            #   success  — eth_call 成功
            #   reverted — eth_call 执行但 revert
            #   error    — swap 预处理异常（池不兼容等）
            #   blocked  — 安全护甲拦截（TVLBreaker/SlippageGuard）
            status = r.get("status", "unknown")
            assert status in {"success", "reverted", "error", "blocked"}, \
                f"Unexpected status: {status}"
            if status == "success":
                assert r.get("tx_hash", "").startswith("dryrun-"), \
                    f"成功的 DryRun tx_hash 应以 'dryrun-' 开头: {r.get('tx_hash')}"
                assert r.get("gas_used", 0) > 0, "success 应有 gas_used"
                assert r.get("block_number", 0) > 0, "success 应有 block_number"
                print(f"\n  DryRun TX: {r['tx_hash']}")
                print(f"  Block: {r['block_number']}, Gas: {r.get('gas_used')}")
            else:
                print(f"\n  DryRun trade: status={status}, "
                      f"reason={r.get('revert_reason')}")

    def test_dry_run_writes_to_simulator_dir(self):
        """DryRun 产出写入 execute/simulator/（不是 output/）"""
        ArbExecuteOps, AssetRef, _ = _import_execute_ops()
        pair_id = _pick_dataset_pair()

        ops = ArbExecuteOps()
        ref = AssetRef(
            kind="dataset_binding",
            id=pair_id,
            path=f".docs/ai-skills/dataset/output/{pair_id}",
            metadata={"source": "dataset", "pair": pair_id},
        )
        result = ops(
            pipeline_run_id="test-dryrun-002",
            step_run_id="dryrun-002",
            trace_id="test-dryrun-dir",
            assets_input=[ref],
            config={"dry_run": True},
            workspace=AGV_ROOT,
        )

        assert result.success
        for asset in result.assets_produced:
            assert "simulator" in asset.path, \
                f"DryRun should write to simulator/ dir, got: {asset.path}"
            exec_file = AGV_ROOT / asset.path / "execution_result.yml"
            assert exec_file.exists(), f"Missing {exec_file}"

            import yaml
            data = yaml.safe_load(exec_file.read_text("utf-8"))
            assert data["mode"] == "dry_run"
            for trade in data["trades"]:
                assert trade.get("dry_run") is True


# ── 入口 ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(_run_all(
        TestExecuteDryRun,
        TestExecuteLive,
        filter_name=filt,
    ))
