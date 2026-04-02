"""P0 + P1 集成测试 — 全步骤 simulate 管线 + schema 校验

验证:
  - 4 步管线 (collect→curate→dataset→execute) 全部在 simulate 模式下自动运行
  - 每步产出文件存在且内容合法
  - schema 校验覆盖 5 个步骤（含 fix 存根）
  - SchemaValidator 单例 + external 加载
  - 端到端 AssetRef 流转（上游产出 → 下游消费）
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from _shared.engines._bootstrap_schema import (
    get_agv_validator,
    validate_step_output,
)
from _shared.engines.agent_ops_arb import (
    ArbExecuteOps,
    CollectOps,
    CurateOps,
    DatasetOps,
    FixOps,
    register_arb_ops,
)
from nexrur.engines.orchestrator import AssetRef, StepResult


# ─── Fixtures ───


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def trace_id() -> str:
    return "trace-test-simulate"


@pytest.fixture
def base_config() -> dict:
    return {
        "simulate": True,
        "strategy_id": "arb_external_bsc",
        "max_single_usd": 20.0,
    }


@pytest.fixture
def step_kwargs(workspace: Path, trace_id: str, base_config: dict) -> dict:
    """共用 Ops.__call__ 参数"""
    return {
        "pipeline_run_id": "pipe-test-001",
        "step_run_id": "step-test-001",
        "trace_id": trace_id,
        "assets_input": [],
        "config": base_config,
        "workspace": workspace,
    }


# ═══════════════════════════════════════════
# §1: Schema 基础设施
# ═══════════════════════════════════════════


class TestSchemaInfra:
    """P1: SchemaValidator 正确加载 _shared/schemas/*.yaml"""

    def test_validator_singleton(self):
        v1 = get_agv_validator()
        v2 = get_agv_validator()
        assert v1 is v2

    def test_schemas_dir_exists(self):
        v = get_agv_validator()
        assert v.schemas_dir.exists()
        assert v.schemas_dir.name == "schemas"

    @pytest.mark.parametrize("step", ["collect", "curate", "dataset", "execute", "fix"])
    def test_schema_loads_external(self, step: str):
        v = get_agv_validator()
        schema = v.get_schema(step)
        assert schema.get("type") == "object"
        assert "properties" in schema
        # 确认不是 fallback
        report = v.validate(step, {}, strict=False)
        assert report["schema_source"] == "external"

    def test_collect_schema_required_fields(self):
        v = get_agv_validator()
        schema = v.get_schema("collect")
        required = set(schema.get("required", []))
        assert "pair_id" in required
        assert "pool_address" in required
        assert "price" in required

    def test_curate_schema_requires_templates(self):
        v = get_agv_validator()
        schema = v.get_schema("curate")
        required = set(schema.get("required", []))
        assert "tower_templates" in required
        assert "pair" in required

    def test_dataset_schema_requires_bindings(self):
        v = get_agv_validator()
        schema = v.get_schema("dataset")
        required = set(schema.get("required", []))
        assert "pair_id" in required
        assert "skeleton_id" in required
        assert "bindings" in required

    def test_execute_schema_requires_trades(self):
        v = get_agv_validator()
        schema = v.get_schema("execute")
        required = set(schema.get("required", []))
        assert "pair_id" in required
        assert "strategy_id" in required
        assert "trades" in required
        assert "summary" in required

    def test_validate_step_output_convenience(self):
        report = validate_step_output("collect", {}, strict=False)
        assert not report["valid"]
        assert len(report["errors"]) > 0

    def test_validate_strict_raises(self):
        from nexrur.core.validator import ValidationError
        with pytest.raises(ValidationError):
            validate_step_output("collect", {}, strict=True)


# ═══════════════════════════════════════════
# §2: CollectOps simulate
# ═══════════════════════════════════════════


class TestCollectSimulate:
    def test_produces_market_signals(self, step_kwargs: dict, workspace: Path):
        ops = CollectOps()
        result = ops(**step_kwargs)
        assert result.success
        assert len(result.assets_produced) == 3  # 3 default pools
        for a in result.assets_produced:
            assert a.kind == "market_signal"
            assert a.metadata.get("simulate") is True

    def test_writes_three_files(self, step_kwargs: dict, workspace: Path):
        ops = CollectOps()
        result = ops(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            assert (d / "pool_info.yml").exists()
            assert (d / "signal.yml").exists()
            assert (d / "asset_hints.yml").exists()

    def test_pool_info_passes_schema(self, step_kwargs: dict, workspace: Path):
        ops = CollectOps()
        result = ops(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            pool = yaml.safe_load((d / "pool_info.yml").read_text("utf-8"))
            report = validate_step_output("collect", pool)
            assert report["valid"], f"Schema errors for {a.id}: {report['errors']}"


# ═══════════════════════════════════════════
# §3: CurateOps
# ═══════════════════════════════════════════


class TestCurateOps:
    def _run_collect(self, kwargs: dict) -> StepResult:
        return CollectOps()(**kwargs)

    def test_produces_arb_strategies(self, step_kwargs: dict, workspace: Path):
        collect_result = self._run_collect(step_kwargs)
        step_kwargs["assets_input"] = collect_result.assets_produced
        result = CurateOps()(**step_kwargs)
        assert result.success
        assert len(result.assets_produced) >= 1
        for a in result.assets_produced:
            assert a.kind == "arb_strategy"

    def test_writes_skeletons(self, step_kwargs: dict, workspace: Path):
        collect_result = self._run_collect(step_kwargs)
        step_kwargs["assets_input"] = collect_result.assets_produced
        result = CurateOps()(**step_kwargs)
        for a in result.assets_produced:
            skel = workspace / a.path / "step1_skeletons.yml"
            assert skel.exists()
            data = yaml.safe_load(skel.read_text("utf-8"))
            assert len(data.get("tower_templates") or data.get("strategy_templates", [])) >= 1

    def test_skeletons_pass_schema(self, step_kwargs: dict, workspace: Path):
        collect_result = self._run_collect(step_kwargs)
        step_kwargs["assets_input"] = collect_result.assets_produced
        result = CurateOps()(**step_kwargs)
        for a in result.assets_produced:
            skel_path = workspace / a.path / "step1_skeletons.yml"
            data = yaml.safe_load(skel_path.read_text("utf-8"))
            report = validate_step_output("curate", data)
            assert report["valid"], f"Schema errors for {a.id}: {report['errors']}"


# ═══════════════════════════════════════════
# §4: DatasetOps simulate
# ═══════════════════════════════════════════


class TestDatasetSimulate:
    def _run_through_curate(self, kwargs: dict) -> list[AssetRef]:
        collect = CollectOps()(**kwargs)
        kwargs["assets_input"] = collect.assets_produced
        curate = CurateOps()(**kwargs)
        return curate.assets_produced

    def test_produces_dataset_bindings(self, step_kwargs: dict, workspace: Path):
        curate_assets = self._run_through_curate(step_kwargs)
        step_kwargs["assets_input"] = curate_assets
        result = DatasetOps()(**step_kwargs)
        assert result.success
        assert len(result.assets_produced) >= 1
        for a in result.assets_produced:
            assert a.kind == "dataset_binding"
            assert a.metadata.get("simulate") is True

    def test_writes_binding_files(self, step_kwargs: dict, workspace: Path):
        curate_assets = self._run_through_curate(step_kwargs)
        step_kwargs["assets_input"] = curate_assets
        result = DatasetOps()(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            assert (d / "slot_categories.yml").exists()
            assert (d / "indicator_binding.yml").exists()

    def test_indicator_binding_passes_schema(self, step_kwargs: dict, workspace: Path):
        curate_assets = self._run_through_curate(step_kwargs)
        step_kwargs["assets_input"] = curate_assets
        result = DatasetOps()(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "indicator_binding.yml").read_text("utf-8"))
            report = validate_step_output("dataset", data)
            assert report["valid"], f"Schema errors for {a.id}: {report['errors']}"

    def test_slot_categories_content(self, step_kwargs: dict, workspace: Path):
        curate_assets = self._run_through_curate(step_kwargs)
        step_kwargs["assets_input"] = curate_assets
        DatasetOps()(**step_kwargs)
        # 检查第一个 pair 的 slot_categories
        first_pair = curate_assets[0].id
        cat_path = workspace / DatasetOps.DATASET_OUTPUT / first_pair / "slot_categories.yml"
        data = yaml.safe_load(cat_path.read_text("utf-8"))
        assert "categories" in data
        assert len(data["categories"]) >= 1
        assert data["pair_id"] == first_pair

    def test_binding_has_indicators(self, step_kwargs: dict, workspace: Path):
        curate_assets = self._run_through_curate(step_kwargs)
        step_kwargs["assets_input"] = curate_assets
        result = DatasetOps()(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "indicator_binding.yml").read_text("utf-8"))
            assert len(data.get("bindings", [])) >= 1
            for b in data["bindings"]:
                assert "indicator_name" in b
                assert "category" in b

    def test_no_strategies_returns_failure(self, step_kwargs: dict):
        step_kwargs["assets_input"] = []
        result = DatasetOps()(**step_kwargs)
        assert not result.success

    def test_category_mapping_coverage(self):
        """所有策略类型都有对应的 category 映射"""
        from _shared.engines.agent_ops_arb import DatasetOps
        for strategy in DatasetOps._STRATEGY_CATEGORIES:
            categories = DatasetOps._STRATEGY_CATEGORIES[strategy]
            assert len(categories) >= 1
            for cat in categories:
                assert cat in DatasetOps._CATEGORY_INDICATORS, \
                    f"Category '{cat}' from strategy '{strategy}' not in _CATEGORY_INDICATORS"


# ═══════════════════════════════════════════
# §5: ArbExecuteOps simulate 兼容别名
# ═══════════════════════════════════════════


class TestExecuteSimulate:
    """execute 的 simulate=True 仅作为 dry_run 的兼容别名保留。"""

    def _run_through_dataset(self, kwargs: dict) -> list[AssetRef]:
        collect = CollectOps()(**kwargs)
        kwargs["assets_input"] = collect.assets_produced
        curate = CurateOps()(**kwargs)
        kwargs["assets_input"] = curate.assets_produced
        dataset = DatasetOps()(**kwargs)
        return dataset.assets_produced

    def _mock_dry_run_result(self, workspace: Path, pair_id: str) -> StepResult:
        exec_dir = workspace / ".docs" / "ai-skills" / "execute" / "simulator" / pair_id
        exec_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "pair_id": pair_id,
            "strategy_id": f"{pair_id}_strategy",
            "mode": "dry_run",
            "executed_at": "2026-03-31T00:00:00Z",
            "trades": [{
                "trade_id": f"dryrun_{pair_id}_0",
                "action": "swap",
                "status": "success",
                "tx_hash": "dryrun-0001",
                "gas_used": 123456,
                "block_number": 99999999,
                "amount_in": 100,
                "amount_out": 101,
                "revert_reason": None,
                "dry_run": True,
            }],
            "summary": {
                "total_trades": 1,
                "successful": 1,
                "failed": 0,
                "total_gas": 123456,
            },
        }
        (exec_dir / "execution_result.yml").write_text(yaml.dump(payload), "utf-8")
        return StepResult(
            success=True,
            assets_produced=[AssetRef(
                kind="execution_result",
                id=pair_id,
                path=str(exec_dir.relative_to(workspace)),
                metadata={
                    "dry_run": True,
                    "simulate": False,
                    "source": "execute",
                    "total": 1,
                    "success": 1,
                },
            )],
            metadata={"mode": "dry_run"},
        )

    def test_produces_execution_results(self, step_kwargs: dict, workspace: Path):
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        pair_id = dataset_assets[0].id
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_dry_run_result(workspace, pair_id)):
            result = ops(**step_kwargs)
        assert result.success
        assert len(result.assets_produced) >= 1
        for a in result.assets_produced:
            assert a.kind == "execution_result"
            assert a.metadata.get("dry_run") is True

    def test_writes_execution_result_file(self, step_kwargs: dict, workspace: Path):
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        pair_id = dataset_assets[0].id
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_dry_run_result(workspace, pair_id)):
            result = ops(**step_kwargs)
        for a in result.assets_produced:
            exec_dir = workspace / a.path
            assert (exec_dir / "execution_result.yml").exists()

    def test_execution_result_passes_schema(self, step_kwargs: dict, workspace: Path):
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        pair_id = dataset_assets[0].id
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_dry_run_result(workspace, pair_id)):
            result = ops(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "execution_result.yml").read_text("utf-8"))
            report = validate_step_output("execute", data)
            assert report["valid"], f"Schema errors for {a.id}: {report['errors']}"

    def test_summary_fields(self, step_kwargs: dict, workspace: Path):
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        pair_id = dataset_assets[0].id
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_dry_run_result(workspace, pair_id)):
            result = ops(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "execution_result.yml").read_text("utf-8"))
            summary = data["summary"]
            assert "total_trades" in summary
            assert "successful" in summary
            assert "failed" in summary
            assert "total_gas" in summary
            assert summary["total_trades"] == summary["successful"] + summary["failed"]
            assert data["mode"] == "dry_run"

    def test_no_bindings_returns_failure(self, step_kwargs: dict):
        step_kwargs["assets_input"] = []
        result = ArbExecuteOps()(**step_kwargs)
        assert not result.success

    def test_trades_have_required_fields(self, step_kwargs: dict, workspace: Path):
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        pair_id = dataset_assets[0].id
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_dry_run_result(workspace, pair_id)):
            result = ops(**step_kwargs)
        for a in result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "execution_result.yml").read_text("utf-8"))
            for trade in data["trades"]:
                assert "trade_id" in trade
                assert "action" in trade
                assert "status" in trade
                assert trade["tx_hash"].startswith("dryrun-")
                assert trade["dry_run"] is True


# ═══════════════════════════════════════════
# §5b: ArbExecuteOps dry_run 调度
# ═══════════════════════════════════════════


class TestExecuteDryRunDispatch:
    """dry_run=True 时，dispatcher 路由到 _execute_dry_run（mock 层验证）"""

    def _run_through_dataset(self, kwargs: dict) -> list[AssetRef]:
        collect = CollectOps()(**kwargs)
        kwargs["assets_input"] = collect.assets_produced
        curate = CurateOps()(**kwargs)
        kwargs["assets_input"] = curate.assets_produced
        dataset = DatasetOps()(**kwargs)
        return dataset.assets_produced

    def test_dry_run_routes_correctly(self, step_kwargs: dict, workspace: Path):
        """dry_run=True 优先于 simulate=True"""
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        step_kwargs["config"]["dry_run"] = True
        step_kwargs["config"]["simulate"] = True  # 即使 simulate=True，dry_run 也应优先
        ops = ArbExecuteOps()
        # _execute_dry_run 内部会调 _make_campaign(dry_run=True)
        # 但 mock 环境下没有 web3，应该报错或回退
        # 这里只验证 dispatcher 的路由逻辑——通过 mock _execute_dry_run
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=StepResult(
            success=True,
            assets_produced=[],
            metadata={"mode": "dry_run"},
        )) as m:
            result = ops(**step_kwargs)
            m.assert_called_once()
            assert result.metadata["mode"] == "dry_run"

    def test_simulate_without_dry_run_routes_to_dry_run(
        self, step_kwargs: dict, workspace: Path,
    ):
        """simulate=True, dry_run=False → _execute_dry_run"""
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        step_kwargs["config"]["simulate"] = True
        step_kwargs["config"]["dry_run"] = False
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=StepResult(
            success=True,
            assets_produced=[],
            metadata={"mode": "dry_run"},
        )) as m:
            result = ops(**step_kwargs)
            m.assert_called_once()
            assert result.metadata.get("mode") == "dry_run"

    def test_dry_run_metadata_flag(self, step_kwargs: dict, workspace: Path):
        """dry_run 模式的 metadata 标记"""
        dataset_assets = self._run_through_dataset(step_kwargs)
        step_kwargs["assets_input"] = dataset_assets
        step_kwargs["config"]["dry_run"] = True
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=StepResult(
            success=True,
            assets_produced=[],
            metadata={"mode": "dry_run", "dry_run": True},
        )) as m:
            result = ops(**step_kwargs)
            assert result.metadata.get("dry_run") is True


# ═══════════════════════════════════════════
# §6: FixOps 存根
# ═══════════════════════════════════════════


class TestFixOps:
    def test_fix_returns_success(self, step_kwargs: dict):
        result = FixOps()(**step_kwargs)
        assert result.success

    def test_fix_schema_validates_minimal(self):
        minimal = {"pair_id": "WBNB_USDT", "status": "skipped"}
        report = validate_step_output("fix", minimal)
        assert report["valid"]


# ═══════════════════════════════════════════
# §7: 端到端 4 步管线 (P0 核心验证)
# ═══════════════════════════════════════════


class TestE2ESimulatePipeline:
    """完整 4 步管线 simulate 兼容别名: collect→curate→dataset→execute(dry_run)"""

    def _mock_execute(self, workspace: Path, pair_ids: list[str]) -> StepResult:
        produced: list[AssetRef] = []
        for pair_id in pair_ids:
            exec_dir = workspace / ".docs" / "ai-skills" / "execute" / "simulator" / pair_id
            exec_dir.mkdir(parents=True, exist_ok=True)
            payload = {
                "pair_id": pair_id,
                "strategy_id": f"{pair_id}_strategy",
                "mode": "dry_run",
                "executed_at": "2026-03-31T00:00:00Z",
                "trades": [{
                    "trade_id": f"dryrun_{pair_id}_0",
                    "action": "swap",
                    "status": "success",
                    "tx_hash": "dryrun-0001",
                    "gas_used": 123456,
                    "block_number": 99999999,
                    "amount_in": 100,
                    "amount_out": 101,
                    "revert_reason": None,
                    "dry_run": True,
                }],
                "summary": {
                    "total_trades": 1,
                    "successful": 1,
                    "failed": 0,
                    "total_gas": 123456,
                },
            }
            (exec_dir / "execution_result.yml").write_text(yaml.dump(payload), "utf-8")
            produced.append(AssetRef(
                kind="execution_result",
                id=pair_id,
                path=str(exec_dir.relative_to(workspace)),
                metadata={"dry_run": True, "simulate": False},
            ))
        return StepResult(success=True, assets_produced=produced, metadata={"mode": "dry_run"})

    def test_full_pipeline(self, step_kwargs: dict, workspace: Path):
        """全链路: 4 步产出文件齐全 + schema 校验 + 资产链路完整"""
        # Step 1: collect
        collect_result = CollectOps()(**step_kwargs)
        assert collect_result.success
        assert all(a.kind == "market_signal" for a in collect_result.assets_produced)

        # Step 2: curate
        step_kwargs["assets_input"] = collect_result.assets_produced
        curate_result = CurateOps()(**step_kwargs)
        assert curate_result.success
        assert all(a.kind == "arb_strategy" for a in curate_result.assets_produced)

        # Step 3: dataset (simulate)
        step_kwargs["assets_input"] = curate_result.assets_produced
        dataset_result = DatasetOps()(**step_kwargs)
        assert dataset_result.success
        assert all(a.kind == "dataset_binding" for a in dataset_result.assets_produced)

        # Step 4: execute (simulate alias → dry_run)
        step_kwargs["assets_input"] = dataset_result.assets_produced
        pair_ids = [a.id for a in dataset_result.assets_produced]
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_execute(workspace, pair_ids)):
            execute_result = ops(**step_kwargs)
        assert execute_result.success
        assert all(a.kind == "execution_result" for a in execute_result.assets_produced)

        # 资产流转: 3 pairs × 4 steps = 12 assets
        pairs_collected = {a.id for a in collect_result.assets_produced}
        pairs_curated = {a.id for a in curate_result.assets_produced}
        pairs_bound = {a.id for a in dataset_result.assets_produced}
        pairs_executed = {a.id for a in execute_result.assets_produced}

        # 所有 pair 贯穿全链路
        assert pairs_collected == pairs_curated == pairs_bound == pairs_executed

    def test_full_pipeline_schema_all_pass(self, step_kwargs: dict, workspace: Path):
        """全链路 schema 校验: 每步产出文件都通过对应 schema"""
        # collect
        collect_result = CollectOps()(**step_kwargs)
        for a in collect_result.assets_produced:
            d = workspace / a.path
            pool = yaml.safe_load((d / "pool_info.yml").read_text("utf-8"))
            assert validate_step_output("collect", pool)["valid"]

        # curate
        step_kwargs["assets_input"] = collect_result.assets_produced
        curate_result = CurateOps()(**step_kwargs)
        for a in curate_result.assets_produced:
            data = yaml.safe_load((workspace / a.path / "step1_skeletons.yml").read_text("utf-8"))
            assert validate_step_output("curate", data)["valid"]

        # dataset
        step_kwargs["assets_input"] = curate_result.assets_produced
        dataset_result = DatasetOps()(**step_kwargs)
        for a in dataset_result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "indicator_binding.yml").read_text("utf-8"))
            assert validate_step_output("dataset", data)["valid"]

        # execute (simulate alias → dry_run)
        step_kwargs["assets_input"] = dataset_result.assets_produced
        pair_ids = [a.id for a in dataset_result.assets_produced]
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_execute(workspace, pair_ids)):
            execute_result = ops(**step_kwargs)
        for a in execute_result.assets_produced:
            d = workspace / a.path
            data = yaml.safe_load((d / "execution_result.yml").read_text("utf-8"))
            assert validate_step_output("execute", data)["valid"]

    def test_single_pool_pipeline(self, workspace: Path, trace_id: str):
        """单池管线: 仅 WBNB_USDT"""
        single_config = {
            "simulate": True,
            "target_pools": [
                {
                    "pair_id": "WBNB_USDT",
                    "pool_address": "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE",
                    "base_symbol": "WBNB",
                    "quote_symbol": "USDT",
                    "price": 580.0,
                    "tvl_usd": 45_000_000.0,
                    "volume_24h_usd": 12_000_000.0,
                },
            ],
        }
        kwargs = {
            "pipeline_run_id": "pipe-single",
            "step_run_id": "step-single",
            "trace_id": trace_id,
            "assets_input": [],
            "config": single_config,
            "workspace": workspace,
        }

        collect = CollectOps()(**kwargs)
        assert len(collect.assets_produced) == 1

        kwargs["assets_input"] = collect.assets_produced
        curate = CurateOps()(**kwargs)
        assert len(curate.assets_produced) == 1

        kwargs["assets_input"] = curate.assets_produced
        dataset = DatasetOps()(**kwargs)
        assert len(dataset.assets_produced) == 1

        kwargs["assets_input"] = dataset.assets_produced
        ops = ArbExecuteOps()
        import unittest.mock as mock
        with mock.patch.object(ops, "_execute_dry_run", return_value=self._mock_execute(workspace, ["WBNB_USDT"])):
            execute = ops(**kwargs)
        assert len(execute.assets_produced) == 1
        assert execute.assets_produced[0].id == "WBNB_USDT"


# ═══════════════════════════════════════════
# §8: register_arb_ops
# ═══════════════════════════════════════════


class TestRegisterOps:
    def test_register_all_five(self):
        from nexrur.engines import OpsRegistry
        reg = OpsRegistry()
        register_arb_ops(reg)
        for step in ("collect", "curate", "dataset", "execute", "fix"):
            assert reg.get(step) is not None
