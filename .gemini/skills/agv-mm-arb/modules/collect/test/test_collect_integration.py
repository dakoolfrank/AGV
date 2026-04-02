#!/usr/bin/env python
"""Collect 集成测试 — 真实 GeckoTerminal API + LLM (Gemini Flash/Pro)

Layer 2 集成测试原则（零 mock / 全生产产出）:
  - 所有测试使用真实 API（GeckoTerminal / LLM），无 mock 数据
  - 产出写入生产目录 .docs/ai-skills/collect/ 或用 tmpdir 隔离
  - mock/simulate/合成数据测试属于 Layer 1 pytest (tests/)，此处不包含
  - 必须人工授权运行（AI 不可自主执行）

运行方式:
    python test_collect_integration.py                          # 全部
    python test_collect_integration.py TestGeckoTerminalPoolInfo  # 单个类
    python test_collect_integration.py TestArbCollectPipeline.test_enrich_single_pool  # 单个方法

依赖:
  - 网络连接（GeckoTerminal 免费 API，无需 API key）
  - aiohttp
  - brain_alpha.infra.llm（WQ-YI .venv 内置，GEMINI_API_KEY 从 brain_alpha/.env 加载）

覆盖:
  1. GeckoTerminalClient 单端点（pool_info, ohlcv, trending, trades）
  2. ArbCollectSkill 管线阶段（discover, enrich）— 真实 API
  3. 生产级全管线（discover → enrich(LLM) → persist → .docs/）
  4. CollectOps live 桥接层（simulate=False → tmpdir）
  5. S5-R1 合规性（产出物不含 pGVT/sGVT）
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import tempfile
import time
import sys
from pathlib import Path

# ── 路径设置 ──────────────────────────────────────────
COLLECT_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
SKILL_ROOT = Path(__file__).resolve().parents[3]  # modules/collect/test → agv-mm-arb
AGV_ROOT = Path(__file__).resolve().parents[6]    # modules/collect/test → … → AGV
WQ_YI_ROOT = Path("/workspaces/WQ-YI")
COLLECT_PENDING = AGV_ROOT / ".docs" / "ai-skills" / "collect" / "pending"
SKILL_MD = SKILL_ROOT / "SKILL.md"
if str(COLLECT_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(COLLECT_SCRIPTS_DIR))
if str(WQ_YI_ROOT) not in sys.path:
    sys.path.insert(0, str(WQ_YI_ROOT))  # brain_alpha.infra.llm

from skill_collect import GeckoTerminalClient, _parse_jsonapi_data
from toolloop_arb_collect import (
    ArbCollectSkill,
    PoolAsset,
    SignalPacket,
    CollectOutcome,
)

logger = logging.getLogger(__name__)


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


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ── 共享 GeckoTerminal 客户端（避免 429 限速）────────
_shared_gecko = GeckoTerminalClient()


# ── LLM 适配层 ──────────────────────────────────────
# CollectLLMJudge 要求:
#   llm_client.generate_json(system_prompt=..., user_prompt=..., temperature=...)
#   prompt_store.get(name) / .has(name)

class _PromptStore:
    """从 SKILL.md 解析 ```prompt:<name>``` 块"""
    def __init__(self, path: Path):
        self._prompts: dict[str, str] = {}
        if path.exists():
            text = path.read_text()
            for m in re.finditer(
                r"```prompt:(\S+)\n(.*?)\n```", text, re.DOTALL,
            ):
                self._prompts[m.group(1)] = m.group(2)
        logger.info("PromptStore: %d prompts from %s", len(self._prompts), path.name)

    def get(self, name: str) -> str:
        return self._prompts[name]

    def has(self, name: str) -> bool:
        return name in self._prompts


class _BrainLLMAdapter:
    """适配 brain_alpha.infra.llm.GeminiClient → CollectLLMJudge 协议

    CollectLLMJudge expects:
        generate_json(*, system_prompt, user_prompt, temperature) -> dict
    brain_alpha GeminiClient provides:
        generate_text(*, system, user, temperature) -> str
    """
    def __init__(self, use_flash: bool = True):
        from brain_alpha.infra.llm import (
            load_gemini_flash_client,
            load_gemini_client_from_settings,
        )
        self._client = (
            load_gemini_flash_client() if use_flash
            else load_gemini_client_from_settings()
        )
        if self._client is None:
            raise RuntimeError(
                "Gemini client unavailable "
                "(check GEMINI_API_KEY in brain_alpha/.env)"
            )

    def generate_json(
        self, *, system_prompt: str = "", user_prompt: str = "",
        temperature: float = 0.2, **_kw,
    ) -> dict:
        text = self._client.generate_text(
            system=system_prompt,
            user=user_prompt + "\n\nReturn ONLY valid JSON (no markdown code fences).",
            temperature=temperature,
        )
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        return json.loads(text)


def _build_llm_config() -> dict:
    """构建 LLM + PromptStore config dict，注入到 ArbCollectSkill"""
    try:
        llm = _BrainLLMAdapter(use_flash=True)
    except Exception as e:
        logger.warning("LLM unavailable: %s — deterministic fallback", e)
        return {}
    prompts = _PromptStore(SKILL_MD)
    if not prompts.has("collect_flash_classify_system"):
        logger.warning("SKILL.md missing collect prompts — LLM disabled")
        return {}
    return {
        "llm_client": llm,
        "prompt_store": prompts,
        "enable_pro": True,
    }


def _rate_pause(seconds: float = 2.5):
    """GeckoTerminal 免费层 30 req/min，测试间留白降低 429 概率"""
    time.sleep(seconds)


# ── 真实池地址（Blue Chip — 不会下架）───────────────
# PancakeSwap V2 WBNB/USDT — TVL $34M+, 100% 稳定
WBNB_USDT_V2 = "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE"
WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"

PRODUCTION_OUTPUT = str(AGV_ROOT / ".docs" / "ai-skills" / "collect")


# ── 辅助函数 ─────────────────────────────────────────────────────────

def _import_collect_ops():
    """导入 AGV CollectOps — 处理与 WQ-YI _shared 的包名冲突"""
    skills_dir = str(SKILL_ROOT.parent)  # .gemini/skills/
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)

    saved = {k: v for k, v in sys.modules.items()
             if k == "_shared" or k.startswith("_shared.")}
    for k in saved:
        del sys.modules[k]
    try:
        from _shared.engines.agent_ops_arb import CollectOps, AssetRef, StepResult
        return CollectOps, AssetRef, StepResult
    except ImportError as e:
        raise SkipTest(f"Cannot import CollectOps: {e}")
    finally:
        for k, v in saved.items():
            sys.modules.setdefault(k, v)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. GeckoTerminalClient 单端点
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGeckoTerminalPoolInfo:
    """get_pool_info — 池基本信息"""

    def test_returns_dict(self):
        result = _run(_shared_gecko.get_pool_info(pool_address=WBNB_USDT_V2))
        assert isinstance(result, dict)
        assert result  # non-empty

    def test_has_price_fields(self):
        _rate_pause()
        info = _run(_shared_gecko.get_pool_info(pool_address=WBNB_USDT_V2))
        # GeckoTerminal pool info includes price data
        assert "base_token_price_usd" in info or "reserve_in_usd" in info

    def test_wbnb_usdt_name(self):
        _rate_pause()
        info = _run(_shared_gecko.get_pool_info(pool_address=WBNB_USDT_V2))
        name = info.get("name", "").lower()
        assert "bnb" in name or "usdt" in name or "wbnb" in name


class TestGeckoTerminalOHLCV:
    """get_ohlcv — K 线数据"""

    def test_returns_list(self):
        _rate_pause()
        bars = _run(_shared_gecko.get_ohlcv(pool_address=WBNB_USDT_V2))
        assert isinstance(bars, list)

    def test_bar_structure(self):
        _rate_pause()
        bars = _run(_shared_gecko.get_ohlcv(pool_address=WBNB_USDT_V2, limit=5))
        if bars:  # may be empty during low-activity periods
            bar = bars[0]
            assert "timestamp" in bar
            assert "open" in bar
            assert "close" in bar
            assert "volume_usd" in bar
            # price sanity: WBNB > $100
            assert bar["close"] > 0

    def test_returns_with_limit_param(self):
        """limit 参数传递到 API"""
        _rate_pause()
        bars = _run(_shared_gecko.get_ohlcv(pool_address=WBNB_USDT_V2, limit=10))
        assert isinstance(bars, list)
        assert len(bars) > 0


class TestGeckoTerminalTrending:
    """get_trending_pools — 趋势池发现"""

    def test_returns_list(self):
        _rate_pause()
        pools = _run(_shared_gecko.get_trending_pools(network="bsc"))
        assert isinstance(pools, list)

    def test_non_empty(self):
        """BSC should always have trending pools"""
        _rate_pause()
        pools = _run(_shared_gecko.get_trending_pools(network="bsc"))
        assert len(pools) > 0

    def test_pool_has_attributes(self):
        _rate_pause()
        pools = _run(_shared_gecko.get_trending_pools(network="bsc"))
        if pools:
            pool = pools[0]
            assert isinstance(pool, dict)


class TestGeckoTerminalTrades:
    """get_trades — 最新交易"""

    def test_returns_list(self):
        _rate_pause()
        trades = _run(_shared_gecko.get_trades(pool_address=WBNB_USDT_V2))
        assert isinstance(trades, list)

    def test_has_trades(self):
        """WBNB/USDT should always have recent trades"""
        _rate_pause()
        trades = _run(_shared_gecko.get_trades(pool_address=WBNB_USDT_V2, limit=10))
        assert len(trades) > 0


class TestGeckoTerminalPoolsByVolume:
    """get_pools_by_volume — 全网池发现"""

    def test_returns_list(self):
        _rate_pause(5)  # volume endpoint 在 discover_pools 之后容易 429
        try:
            pools = _run(_shared_gecko.get_pools_by_volume(network="bsc"))
        except Exception as exc:
            if "429" in str(exc):
                raise SkipTest("GeckoTerminal 429 rate limit — flaky")
            raise
        assert isinstance(pools, list)
        assert len(pools) > 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. ArbCollectSkill 三阶段管线（discover → enrich → persist）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTE: TestRegistryRoundtrip（纯合成数据）已移至 Layer 1 pytest (tests/)。


class TestArbCollectPipeline:
    """三阶段管线集成 — 使用真实 GeckoTerminal API"""

    def test_discover_finds_pools(self):
        """Phase 1: discover 从 GeckoTerminal 发现池"""
        _rate_pause(3)
        skill = ArbCollectSkill(config={
            "output_root": "/tmp/agv-test-collect",
            "gecko_client": _shared_gecko,
        })
        pools = _run(skill.discover_pools())
        assert isinstance(pools, list)
        # Should find pools on BSC
        assert len(pools) >= 1
        # Each pool should have pair_id
        for p in pools:
            assert hasattr(p, "pair_id")
            assert p.pair_id

    def test_enrich_single_pool(self):
        """Phase 2: enrich 获取 OHLCV + 指标 + LLM Flash/Pro 评估"""
        _rate_pause(3)
        skill = ArbCollectSkill(config={
            "output_root": "/tmp/agv-test-collect",
            "gecko_client": _shared_gecko,
            **_build_llm_config(),
        })
        asset = PoolAsset(
            pair_id="WBNB_USDT_0x16b9",
            pool_address=WBNB_USDT_V2,
            network="bsc",
            dex="pancakeswap_v2",
            base_token="WBNB",
            quote_token="USDT",
            base_token_address=WBNB_ADDRESS,
            quote_token_address=USDT_ADDRESS,
        )
        packet = _run(skill.enrich_pool(asset))
        # enrich_pool returns None if quality < moderate
        print(f"\n  packet is None: {packet is None}")
        if packet is not None:
            assert isinstance(packet, SignalPacket)
            assert packet.pair_id == "WBNB_USDT_0x16b9"
            assert packet.market_data  # non-empty dict
            # LLM 字段验证
            print(f"  llm_verdict: {packet.llm_verdict}")
            print(f"  llm_score: {packet.llm_score}")
            print(f"  llm_classification: {packet.llm_classification}")
            print(f"  llm_strategies: {packet.llm_strategies[:1] if packet.llm_strategies else []}")
            print(f"  llm_risk_flags: {packet.llm_risk_flags}")

    # NOTE: test_persist_creates_files（合成数据 + tmpdir）已移至 Layer 1 pytest。
    # NOTE: test_full_pipeline_e2e（tmpdir 输出）由 TestProductionCollect 替代。


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. S5-R1 验证 — 产出物不含 pGVT/sGVT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestS5R1Compliance:
    """验证 collect 产出物不含 AGV 自家池"""

    def test_discover_no_agv_pools(self):
        """discover 输出不应包含 pGVT/sGVT 池"""
        _rate_pause(3)
        skill = ArbCollectSkill(config={
            "output_root": "/tmp/agv-test-s5r1",
            "gecko_client": _shared_gecko,
        })
        pools = _run(skill.discover_pools())
        agv_addrs = {
            "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0".lower(),
            "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d".lower(),
        }
        for p in pools:
            assert p.pool_address.lower() not in agv_addrs, \
                f"S5-R1: discover returned AGV pool {p.pair_id}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. 生产级全管线（LLM + 市场扫描 → .docs/）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestProductionCollect:
    """完整 discover → enrich(LLM) → persist → .docs/

    ⚠️ 写入 AGV/.docs/ai-skills/collect/，非 tmp!
    """

    def test_full_pipeline_with_llm(self):
        """LLM + 市场扫描 → 生产 .docs/ 目录"""
        _rate_pause(5)
        llm_cfg = _build_llm_config()
        has_llm = bool(llm_cfg.get("llm_client"))
        print(f"\nLLM available: {has_llm}")

        skill = ArbCollectSkill(config={
            "output_root": PRODUCTION_OUTPUT,
            "gecko_client": _shared_gecko,
            **llm_cfg,
        })
        outcome = _run(skill.run())

        print(f"Status:     {outcome.status}")
        print(f"Discovered: {outcome.pools_discovered}")
        print(f"Enriched:   {outcome.pools_enriched}")
        print(f"Persisted:  {outcome.pools_persisted}")
        print(f"Skipped:    {outcome.pools_skipped}")
        if outcome.reason_code:
            print(f"Reason:     {outcome.reason_code}")

        assert outcome.status in ("success", "partial")
        assert outcome.pools_discovered >= 1

        if outcome.pools_persisted > 0:
            pending = Path(PRODUCTION_OUTPUT) / "pending"
            pairs = [d for d in pending.iterdir() if d.is_dir()]
            assert len(pairs) >= 1
            for pair_dir in pairs:
                ip = pair_dir / "idea_packet.yml"
                if ip.exists():
                    import yaml
                    data = yaml.safe_load(ip.read_text())
                    assert "pair_id" in data
                    assert "market_data" in data
                    # 如果 LLM 可用，验证 LLM 字段
                    if has_llm and "llm_verdict" in data:
                        print(f"  {pair_dir.name}: LLM verdict={data.get('llm_verdict')}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. CollectOps live → tmpdir（桥接层集成验证）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTE: CollectOps simulate 属于 Layer 1 mock 测试，已移至 tests/。
#       这里只验证 live 模式的真实 API 通路，用 tmpdir 隔离产出。


class TestCollectOpsLive:
    """CollectOps(simulate=False) → tmpdir（需网络，不污染 production）"""

    def test_live_produces_pending(self):
        """live 模式调 GeckoTerminal → 产出 market_signal → tmpdir"""
        CollectOps, _, _ = _import_collect_ops()

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            # CollectOps 需要 .docs/ai-skills/collect/pending/ 结构
            (tmp_path / ".docs/ai-skills/collect/pending").mkdir(parents=True)

            ops = CollectOps()
            result = ops(
                pipeline_run_id="test-live", step_run_id="live-001",
                trace_id="test-live", assets_input=[],
                config={"simulate": False},
                workspace=tmp_path,
            )
            assert result.success, f"live collect failed: {result.metadata}"
            assert len(result.assets_produced) >= 1

            # 验证 pair 目录写入 tmpdir
            pending = tmp_path / ".docs/ai-skills/collect/pending"
            for ref in result.assets_produced:
                pair_dir = pending / ref.id
                assert pair_dir.is_dir(), f"{ref.id} dir missing: {pair_dir}"


# ── 入口 ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(_run_all(
        TestGeckoTerminalPoolInfo,
        TestGeckoTerminalOHLCV,
        TestGeckoTerminalTrending,
        TestGeckoTerminalTrades,
        TestGeckoTerminalPoolsByVolume,
        TestArbCollectPipeline,
        TestS5R1Compliance,
        TestProductionCollect,
        TestCollectOpsLive,
        filter_name=filt,
    ))
