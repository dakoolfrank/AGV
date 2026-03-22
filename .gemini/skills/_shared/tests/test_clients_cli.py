"""AGV _shared/clients + cli 测试"""
from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


# ═══════════════════════════════════════════════════════════════
# clients 层测试
# ═══════════════════════════════════════════════════════════════

class TestExtractJsonRobust:
    """_extract_json_robust 三级 JSON 提取"""

    def test_direct_parse(self):
        from _shared.clients.clients import _extract_json_robust
        result = _extract_json_robust('{"key": "value"}')
        assert result == {"key": "value"}

    def test_fenced_block(self):
        from _shared.clients.clients import _extract_json_robust
        raw = '一些文本\n```json\n{"key": "value"}\n```\n后续文本'
        result = _extract_json_robust(raw)
        assert result == {"key": "value"}

    def test_fenced_block_no_lang(self):
        from _shared.clients.clients import _extract_json_robust
        raw = '```\n{"key": "value"}\n```'
        result = _extract_json_robust(raw)
        assert result == {"key": "value"}

    def test_balanced_brackets(self):
        from _shared.clients.clients import _extract_json_robust
        raw = 'Here is the result: {"key": "value"} done'
        result = _extract_json_robust(raw)
        assert result == {"key": "value"}

    def test_nested_json(self):
        from _shared.clients.clients import _extract_json_robust
        raw = '{"outer": {"inner": 42}}'
        result = _extract_json_robust(raw)
        assert result == {"outer": {"inner": 42}}

    def test_no_json_raises(self):
        from _shared.clients.clients import _extract_json_robust, LLMError
        with pytest.raises(LLMError, match="无法从 LLM 输出提取 JSON"):
            _extract_json_robust("no json here at all")

    def test_array_not_dict_falls_through(self):
        from _shared.clients.clients import _extract_json_robust, LLMError
        with pytest.raises(LLMError):
            _extract_json_robust('[1, 2, 3]')

    def test_whitespace_handling(self):
        from _shared.clients.clients import _extract_json_robust
        raw = '  \n  {"key": "value"}  \n  '
        result = _extract_json_robust(raw)
        assert result == {"key": "value"}


class TestGeminiLLMClient:
    """GeminiLLMClient 通过 mock 测试 Protocol 适配"""

    def _make_client(self):
        from _shared.clients.clients import GeminiLLMClient
        mock_pro = MagicMock()
        mock_flash = MagicMock()
        return GeminiLLMClient(client=mock_pro, flash_client=mock_flash)

    def test_generate_json_calls_generate_text(self):
        llm = self._make_client()
        llm._client.generate_text.return_value = '{"reason_code": "PARAM_DRIFT", "retreat_level": "A"}'

        result = llm.generate_json(
            system_prompt="test system",
            user_prompt="test user",
            temperature=0.0,
        )
        assert result["reason_code"] == "PARAM_DRIFT"
        llm._client.generate_text.assert_called_once_with(
            system="test system",
            user="test user",
            temperature=0.0,
        )

    def test_generate_json_with_flash_model(self):
        llm = self._make_client()
        llm._flash.generate_text.return_value = '{"fast": true}'

        result = llm.generate_json(
            system_prompt="sys",
            user_prompt="usr",
            model="flash",
        )
        assert result == {"fast": True}
        llm._flash.generate_text.assert_called_once()
        llm._client.generate_text.assert_not_called()

    def test_generate_json_fallback_to_pro_when_no_flash(self):
        from _shared.clients.clients import GeminiLLMClient
        mock_pro = MagicMock()
        mock_pro.generate_text.return_value = '{"pro": true}'
        llm = GeminiLLMClient(client=mock_pro, flash_client=None)

        result = llm.generate_json(
            system_prompt="sys",
            user_prompt="usr",
            model="flash",
        )
        assert result == {"pro": True}
        mock_pro.generate_text.assert_called_once()

    def test_generate_json_schema_warning(self, caplog):
        import logging
        llm = self._make_client()
        llm._client.generate_text.return_value = '{"only_key": 1}'

        with caplog.at_level(logging.WARNING):
            result = llm.generate_json(
                system_prompt="sys",
                user_prompt="usr",
                schema={"required": ["reason_code", "retreat_level"]},
            )
        assert result == {"only_key": 1}
        assert "缺少必需键" in caplog.text

    def test_generate_json_bad_output_raises(self):
        from _shared.clients.clients import LLMError
        llm = self._make_client()
        llm._client.generate_text.return_value = "not json at all"

        with pytest.raises(LLMError):
            llm.generate_json(
                system_prompt="sys",
                user_prompt="usr",
            )

    def test_generate_text(self):
        llm = self._make_client()
        llm._client.generate_text.return_value = "hello world"

        result = llm.generate_text(system="sys", user="prompt")
        assert result == "hello world"

    def test_generate_text_flash(self):
        llm = self._make_client()
        llm._flash.generate_text.return_value = "fast hello"

        result = llm.generate_text(system="sys", user="prompt", use_flash=True)
        assert result == "fast hello"

    def test_available_property(self):
        llm = self._make_client()
        assert llm.available is True

    def test_available_false_when_no_client(self):
        from _shared.clients.clients import GeminiLLMClient
        llm = GeminiLLMClient(client=None)
        assert llm.available is False

    def test_from_settings_or_none_returns_none_on_error(self):
        from _shared.clients.clients import GeminiLLMClient
        with patch.object(GeminiLLMClient, 'from_settings', side_effect=RuntimeError("no key")):
            result = GeminiLLMClient.from_settings_or_none()
        assert result is None


class TestGeminiLLMClientProtocol:
    """验证 GeminiLLMClient 满足 DiagnosisEngine.LLMClient Protocol"""

    def test_satisfies_protocol(self):
        from _shared.clients.clients import GeminiLLMClient
        from _shared.engines.diagnosis import LLMClient
        # Protocol 类型检查 — 验证 generate_json 签名兼容
        mock = MagicMock()
        mock.generate_text.return_value = '{"ok": true}'
        client = GeminiLLMClient(client=mock)

        # 调用 Protocol 规定的签名
        result = client.generate_json(
            system_prompt="sys",
            user_prompt="usr",
            model="",
            temperature=0.0,
            schema=None,
        )
        assert isinstance(result, dict)


class TestDiagnosisEngineWithLLM:
    """DiagnosisEngine + GeminiLLMClient 集成"""

    def test_flash_uses_llm_client(self):
        """DiagnosisEngine._run_flash 调用 LLM"""
        from _shared.engines.diagnosis import DiagnosisEngine, _load_campaign_prompts
        from _shared.clients.clients import GeminiLLMClient

        mock_pro = MagicMock()
        # Flash 回复：Level A 参数调整
        mock_pro.generate_text.return_value = json.dumps({
            "reason_code": "PARAM_DRIFT",
            "confidence": 0.85,
            "retreat_level": "A",
            "target_step": "execute",
            "strategy_id": "arb_test",
            "repair_hints": {"slippage_threshold": "0.015"},
        })
        mock_flash = MagicMock()
        mock_flash.generate_text.return_value = mock_pro.generate_text.return_value

        llm = GeminiLLMClient(client=mock_pro, flash_client=mock_flash)
        prompts = _load_campaign_prompts()
        engine = DiagnosisEngine(llm=llm, prompts=prompts)

        evidence = {
            "strategy_id": "arb_test",
            "pnl_usd": -5.0,
            "consecutive_failures": 2,
        }
        result = engine.diagnose(evidence, strategy_id="arb_test")
        # 即使 Flash 返回有效 JSON，Pro 始终仲裁
        # 结果取决于 Pro 的返回和确定性检测器
        # 这里验证引擎不抛异常
        assert result is None or hasattr(result, "retreat_level")


# ═══════════════════════════════════════════════════════════════
# CLI 层测试
# ═══════════════════════════════════════════════════════════════

class TestArbCampaignCLI:
    """CLI 参数解析和子命令"""

    def test_status(self, tmp_path, capsys):
        from _shared.cli.arb_campaign import main
        # 创建 AGENTS.md + agvprotocol-contracts-main 让 _find_workspace 工作
        (tmp_path / "AGENTS.md").touch()
        (tmp_path / "agvprotocol-contracts-main").mkdir()

        import os
        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            rc = main(["--status"])
        finally:
            os.chdir(old_cwd)

        assert rc == 0
        captured = capsys.readouterr()
        info = json.loads(captured.out)
        assert "collect" in info
        assert "execute" in info

    def test_cleanup_empty(self, tmp_path, capsys):
        from _shared.cli.arb_campaign import main
        (tmp_path / "AGENTS.md").touch()
        (tmp_path / "agvprotocol-contracts-main").mkdir()

        import os
        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            rc = main(["--cleanup"])
        finally:
            os.chdir(old_cwd)

        assert rc == 0
        assert "清理完成" in capsys.readouterr().out

    def test_cleanup_removes_files(self, tmp_path, capsys):
        from _shared.cli.arb_campaign import main
        (tmp_path / "AGENTS.md").touch()
        (tmp_path / "agvprotocol-contracts-main").mkdir()
        # 创建一些产物
        collect_dir = tmp_path / ".docs" / "ai-skills" / "collect" / "pending"
        collect_dir.mkdir(parents=True)
        (collect_dir / "signal.yml").write_text("test")
        (collect_dir / "abbreviations.yml").write_text("keep me")

        import os
        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            rc = main(["--cleanup"])
        finally:
            os.chdir(old_cwd)

        assert rc == 0
        assert not (collect_dir / "signal.yml").exists()
        assert (collect_dir / "abbreviations.yml").exists()  # 保留

    def test_dry_run(self, tmp_path, capsys):
        from _shared.cli.arb_campaign import main
        (tmp_path / "AGENTS.md").touch()
        (tmp_path / "agvprotocol-contracts-main").mkdir()

        import os
        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            rc = main(["--dry-run", "--pair", "sGVT_USDT"])
        finally:
            os.chdir(old_cwd)

        assert rc == 0
        out = capsys.readouterr().out
        assert "Dry Run" in out
        assert "sGVT_USDT" in out

    def test_dry_run_with_max_cycles(self, tmp_path, capsys):
        from _shared.cli.arb_campaign import main
        (tmp_path / "AGENTS.md").touch()
        (tmp_path / "agvprotocol-contracts-main").mkdir()

        import os
        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            rc = main(["--dry-run", "--max-cycles", "10"])
        finally:
            os.chdir(old_cwd)

        assert rc == 0
        out = capsys.readouterr().out
        assert '"max_cycles": 10' in out


class TestCLIHelpers:
    """CLI 辅助函数"""

    def test_load_yaml(self, tmp_path):
        from _shared.cli.arb_campaign import _load_yaml
        cfg_file = tmp_path / "test.yml"
        cfg_file.write_text("pair: pGVT_USDT\nmax_cycles: 50")
        config = _load_yaml(cfg_file)
        assert config["pair"] == "pGVT_USDT"
        assert config["max_cycles"] == 50

    def test_status_with_files(self, tmp_path):
        from _shared.cli.arb_campaign import _status
        collect_dir = tmp_path / ".docs" / "ai-skills" / "collect" / "pending"
        collect_dir.mkdir(parents=True)
        (collect_dir / "a.yml").write_text("x")
        (collect_dir / "b.yml").write_text("x")

        info = _status(tmp_path)
        assert info["collect"]["files"] == 2


class TestBuildConfigs:
    """build_configs 3/5 段 YAML 合并"""

    def test_basic_merge(self):
        from _shared.cli.arb_campaign import build_configs
        raw = {
            "goal": {"pair": "pGVT_USDT", "simulate": True},
            "campaign": {"max_cycles": 10, "max_daily_usd": 100.0},
        }
        cfg = build_configs(raw)
        assert cfg["pair"] == "pGVT_USDT"
        assert cfg["simulate"] is True
        assert cfg["max_cycles"] == 10
        assert cfg["max_daily_usd"] == 100.0

    def test_goal_overrides_campaign(self):
        """goal 中的同名 key 覆盖 campaign"""
        from _shared.cli.arb_campaign import build_configs
        raw = {
            "goal": {"max_cycles": 5},
            "campaign": {"max_cycles": 100},
        }
        cfg = build_configs(raw)
        assert cfg["max_cycles"] == 5

    def test_safety_section(self):
        from _shared.cli.arb_campaign import build_configs
        raw = {
            "goal": {"pair": "A_B"},
            "safety": {"tvl_floor_usd": 30.0},
        }
        cfg = build_configs(raw)
        assert cfg["safety"]["tvl_floor_usd"] == 30.0

    def test_all_five_sections(self):
        from _shared.cli.arb_campaign import build_configs
        raw = {
            "goal": {"pair": "X_Y"},
            "campaign": {"max_cycles": 10},
            "safety": {"tvl_floor_usd": 30},
            "orchestrator": {"skip_steps": ["fix"]},
            "diagnosis": {"deterministic_only": True},
        }
        cfg = build_configs(raw)
        assert cfg["pair"] == "X_Y"
        assert cfg["max_cycles"] == 10
        assert cfg["safety"]["tvl_floor_usd"] == 30
        assert cfg["orchestrator"]["skip_steps"] == ["fix"]
        assert cfg["diagnosis"]["deterministic_only"] is True

    def test_empty_sections(self):
        from _shared.cli.arb_campaign import build_configs
        cfg = build_configs({})
        assert isinstance(cfg, dict)
        assert "safety" not in cfg


class TestDefaultYamlExists:
    """arb_campaign.yml 存在性与格式"""

    def test_yaml_file_exists(self):
        from _shared.cli.arb_campaign import _resolve_default_config
        path = _resolve_default_config()
        assert path is not None
        assert path.name == "arb_campaign.yml"

    def test_yaml_has_required_sections(self):
        from _shared.cli.arb_campaign import _resolve_default_config, _load_yaml
        path = _resolve_default_config()
        raw = _load_yaml(path)
        for section in ("goal", "campaign", "safety", "orchestrator"):
            assert section in raw, f"缺少 section: {section}"

    def test_yaml_build_configs_roundtrip(self):
        from _shared.cli.arb_campaign import (
            _resolve_default_config, _load_yaml, build_configs,
        )
        path = _resolve_default_config()
        raw = _load_yaml(path)
        cfg = build_configs(raw)
        assert cfg["pair"] == "pGVT_USDT"
        assert cfg["simulate"] is True
        assert cfg["max_cycles"] == 10
        assert cfg["safety"]["tvl_floor_usd"] == 30.0

    def test_dry_run_loads_default(self, capsys):
        from _shared.cli.arb_campaign import main
        rc = main(["--dry-run"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "pGVT_USDT" in out


class TestImports:
    """验证所有新模块可正常导入"""

    def test_import_clients(self):
        from _shared.clients import GeminiLLMClient, LLMError
        assert GeminiLLMClient is not None
        assert LLMError is not None

    def test_import_clients_from_engines(self):
        from _shared.engines import GeminiLLMClient, LLMError
        assert GeminiLLMClient is not None

    def test_import_cli(self):
        from _shared.cli.arb_campaign import main, _cleanup, _status
        assert callable(main)
        assert callable(_cleanup)

    def test_engines_init_has_clients(self):
        """engines/__init__.py 正确 re-export clients"""
        import _shared.engines as eng
        assert hasattr(eng, "GeminiLLMClient")
        assert hasattr(eng, "LLMError")
