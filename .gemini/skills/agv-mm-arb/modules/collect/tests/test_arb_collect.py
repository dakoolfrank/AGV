"""ArbCollectSkill 单元测试"""
from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# 确保 collect scripts 可导入
COLLECT_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(COLLECT_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(COLLECT_SCRIPTS_DIR))

from toolloop_arb_collect import (
    ArbPoolRegistry,
    ArbCollectSkill,
    PoolAsset,
    PoolHints,
    CollectOutcome,
    CollectLLMJudge,
    SignalPacket,
    _build_execution_hints,
    _build_reasons,
    _format_all_indicators,
    _format_indicators,
    _safe_int,
    _suggest_strategy,
    _summarize_ohlcv,
    _utcnow,
)
from skill_collect import (
    CollectSkill,
    compute_onchain_factors,
    compute_lp_dynamics,
    compute_liquidity_depth,
)


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ── pair_id / pair_name 解析 ─────────────────────────

class TestPairIdGeneration:
    def test_normal_pair(self):
        pid = ArbCollectSkill._generate_pair_id("WBNB", "USDT", "0x58F8abc123")
        assert pid == "WBNB_USDT_0x58F8"

    def test_empty_base(self):
        pid = ArbCollectSkill._generate_pair_id("", "USDT", "0xABCDEF")
        assert pid == "UNK_USDT_0xABCD"

    def test_long_symbol_truncated(self):
        pid = ArbCollectSkill._generate_pair_id("VERYLONGSYMBOLNAME", "Q", "0x1234")
        assert pid.startswith("VERYLONGSY_Q_")  # truncated to 10

    def test_empty_address(self):
        pid = ArbCollectSkill._generate_pair_id("A", "B", "")
        assert pid == "A_B_000000"


class TestParsePairName:
    def test_slash_separator(self):
        assert ArbCollectSkill._parse_pair_name("WBNB / USDT") == ("WBNB", "USDT")

    def test_no_space_slash(self):
        assert ArbCollectSkill._parse_pair_name("CAKE/BNB") == ("CAKE", "BNB")

    def test_dash_separator(self):
        assert ArbCollectSkill._parse_pair_name("ETH - USDC") == ("ETH", "USDC")

    def test_single_token(self):
        assert ArbCollectSkill._parse_pair_name("WBNB") == ("WBNB", "UNK")

    def test_empty(self):
        assert ArbCollectSkill._parse_pair_name("") == ("UNK", "UNK")


# ── 质量评分 ─────────────────────────────────────────

class TestQualityScoring:
    def _make_skill(self):
        with patch("toolloop_arb_collect.GeckoTerminalClient"), \
             patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            return ArbCollectSkill(config={"output_root": "/tmp/test_scan"})

    def test_strong_quality(self):
        skill = self._make_skill()
        signals = [
            {"type": "price_divergence", "strength": 80},
            {"type": "volume_spike", "strength": 60},
            {"type": "lp_imbalance", "strength": 50},
        ]
        # With factors to reach strong threshold
        q, s = skill._score_quality(
            signals, None, 1_500_000, 600_000,
            onchain={"unique_wallets": 10, "tx_count": 15},
            lp_dyn={"net_flow_direction": "inflow"},
            liq_depth={"depth_2pct_usd": 1000, "reserve_ratio": 0.9},
        )
        assert q == "strong"
        assert s >= 70

    def test_moderate_quality(self):
        skill = self._make_skill()
        signals = [
            {"type": "volume_spike", "strength": 70},
            {"type": "lp_imbalance", "strength": 40},
        ]
        q, s = skill._score_quality(signals, None, 200_000, 60_000)
        assert q == "moderate"
        assert s >= 40

    def test_none_quality(self):
        skill = self._make_skill()
        q, s = skill._score_quality([], None, 1000, 500)
        assert q == "none"
        assert s < 40

    def test_weak_with_one_low_signal(self):
        skill = self._make_skill()
        signals = [{"type": "x", "strength": 5}]
        q, s = skill._score_quality(signals, None, 1000, 500)
        assert q == "weak"


# ── ArbPoolRegistry ──────────────────────────────────

class TestArbPoolRegistry:
    def test_empty_registry(self, tmp_path):
        r = ArbPoolRegistry(tmp_path / "reg.yml")
        assert r.pending_count == 0
        assert r.list_pending() == []

    def test_register_and_get(self, tmp_path):
        r = ArbPoolRegistry(tmp_path / "reg.yml")
        asset = PoolAsset(pair_id="A_B_0x1234", pool_address="0x1234abcd")
        r.register(asset)
        r.save()
        assert r.exists("A_B_0x1234")
        entry = r.get("A_B_0x1234")
        assert entry["pool_address"] == "0x1234abcd"

    def test_list_pending(self, tmp_path):
        r = ArbPoolRegistry(tmp_path / "reg.yml")
        a1 = PoolAsset(pair_id="P1", pool_address="0x1", status="pending")
        a2 = PoolAsset(pair_id="P2", pool_address="0x2", status="archived")
        r.register(a1)
        r.register(a2)
        assert r.list_pending() == ["P1"]

    def test_is_terminal(self, tmp_path):
        r = ArbPoolRegistry(tmp_path / "reg.yml")
        a = PoolAsset(pair_id="T1", pool_address="0xT", lifecycle_state="terminal_exhausted")
        r.register(a)
        assert r.is_terminal("T1") is True
        assert r.is_terminal("NONEXIST") is False

    def test_roundtrip_persistence(self, tmp_path):
        path = tmp_path / "reg.yml"
        r1 = ArbPoolRegistry(path)
        r1.register(PoolAsset(pair_id="RT", pool_address="0xRT"))
        r1.save()

        # 重新加载
        r2 = ArbPoolRegistry(path)
        assert r2.exists("RT")
        assert r2.get("RT")["pool_address"] == "0xRT"


# ── Persist ──────────────────────────────────────────

class TestPersistence:
    def _make_skill(self, output_root):
        with patch("toolloop_arb_collect.GeckoTerminalClient"), \
             patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            return ArbCollectSkill(config={"output_root": str(output_root)})

    def test_persist_creates_files(self, tmp_path):
        skill = self._make_skill(tmp_path)
        asset = PoolAsset(
            pair_id="WBNB_USDT_0x58F8",
            pool_address="0x58F8abc",
            dex="pancakeswap_v2",
            base_token="WBNB",
            quote_token="USDT",
            signal_quality="strong",
            discovered_at="2026-01-01T00:00:00Z",
        )
        packet = SignalPacket(
            pair_id="WBNB_USDT_0x58F8",
            signals=[{"signal_type": "price_divergence", "strength": 80,
                       "source": "gecko", "details": {}}],
            market_data={"tvl_usd": 100000, "volume_24h_usd": 50000},
        )
        raw = {"test": "snapshot"}

        result = skill.persist_asset(asset, packet, raw_snapshot=raw)

        # 目录创建
        assert result.exists()
        assert (result / "idea_packet.yml").exists()
        assert (result / "asset_hints.yml").exists()
        assert (result / "content.md").exists()

        # 注册表更新
        assert skill.registry.exists("WBNB_USDT_0x58F8")

    def test_persist_without_raw_snapshot(self, tmp_path):
        skill = self._make_skill(tmp_path)
        asset = PoolAsset(pair_id="A_B_0x0000", pool_address="0x0000")
        packet = SignalPacket(pair_id="A_B_0x0000")

        result = skill.persist_asset(asset, packet)
        assert (result / "idea_packet.yml").exists()
        assert (result / "asset_hints.yml").exists()
        assert not (result / "content.md").exists()

    def test_signal_packet_content(self, tmp_path):
        import yaml
        skill = self._make_skill(tmp_path)
        asset = PoolAsset(pair_id="X_Y_0xABCD", pool_address="0xABCD")
        packet = SignalPacket(
            pair_id="X_Y_0xABCD",
            source_evidence={"dex": "pancake", "pool_address": "0xABCD"},
            decision={"quality": "strong", "score": 85, "reasons": ["good"]},
        )
        skill.persist_asset(asset, packet)

        with open(tmp_path / "pending" / "X_Y_0xABCD" / "idea_packet.yml") as f:
            data = yaml.safe_load(f)
        assert data["pair_id"] == "X_Y_0xABCD"
        assert data["decision"]["quality"] == "strong"


# ── Discovery ────────────────────────────────────────

def _dxs_noop():
    """返回一个不执行任何 API 调用的 DexScreenerClient mock"""
    m = MagicMock(spec=DexScreenerClient)
    m.get_token_pairs = AsyncMock(return_value=[])
    m.get_top_boosted = AsyncMock(return_value=[])
    m.search_pairs = AsyncMock(return_value=[])
    m.normalize_pair_to_pool = MagicMock(side_effect=DexScreenerClient.normalize_pair_to_pool)
    m.normalize_pair_to_pool_info = MagicMock(side_effect=DexScreenerClient.normalize_pair_to_pool_info)
    return m


class TestDiscovery:
    def _make_skill(self, tmp_path):
        gecko_mock = MagicMock()
        _USDT = "0x55d398326f99059fF775485246999027B3197955"
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xAAA1aaa1aaa1aaa1", "name": "TOKEN_A / USDT", "dex_id": "pancake",
             "quote_token_address": _USDT},
            {"address": "0xBBB2bbb2bbb2bbb2", "name": "TOKEN_B / BNB", "dex_id": "biswap"},
        ])
        gecko_mock.get_pools_by_volume = AsyncMock(return_value=[])
        gecko_mock._get = AsyncMock(return_value={"data": [
            {"attributes": {"address": "0xCCC3ccc3ccc3ccc3", "name": "NEW / USDT",
                            "quote_token_address": _USDT}},
        ]})
        with patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "dexscreener_client": _dxs_noop(),
                "output_root": str(tmp_path),
            })
        return skill

    def test_discover_trending(self, tmp_path):
        skill = self._make_skill(tmp_path)
        pools = _run(skill.discover_pools())
        # 2 trending + 1 new = 3
        assert len(pools) >= 2
        assert all(isinstance(p, PoolAsset) for p in pools)
        assert any(p.discovery_method == "trending" for p in pools)

    def test_discover_dedup_by_address(self, tmp_path):
        gecko_mock = MagicMock()
        # 同一地址出现在 trending 和 new
        _USDT = "0x55d398326f99059fF775485246999027B3197955"
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xSAMEsameSAMEsame", "name": "DUP / USDT",
             "quote_token_address": _USDT},
        ])
        gecko_mock.get_pools_by_volume = AsyncMock(return_value=[])
        gecko_mock._get = AsyncMock(return_value={"data": [
            {"attributes": {"address": "0xSAMEsameSAMEsame", "name": "DUP / USDT",
                            "quote_token_address": _USDT}},
        ]})
        with patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "dexscreener_client": _dxs_noop(),
                "output_root": str(tmp_path),
            })
        pools = _run(skill.discover_pools())
        addrs = [p.pool_address for p in pools]
        assert addrs.count("0xSAMEsameSAMEsame") == 1  # deduped

    def test_skip_terminal_pools(self, tmp_path):
        gecko_mock = MagicMock()
        _USDT = "0x55d398326f99059fF775485246999027B3197955"
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xTERMtermTERMterm", "name": "DEAD / USDT",
             "quote_token_address": _USDT},
        ])
        gecko_mock.get_pools_by_volume = AsyncMock(return_value=[])
        gecko_mock._get = AsyncMock(return_value={"data": []})
        with patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "dexscreener_client": _dxs_noop(),
                "output_root": str(tmp_path),
            })
        # 先注册为终态
        asset = PoolAsset(pair_id="DEAD_USDT_0xTERM", pool_address="0xTERMtermTERMterm",
                          lifecycle_state="terminal_exhausted")
        skill.registry.register(asset)
        pools = _run(skill.discover_pools())
        assert len(pools) == 0  # terminal 被跳过


# ── Enrichment ───────────────────────────────────────

class TestEnrichment:
    def _make_skill(self, tmp_path, merged_data=None):
        fusion_mock = MagicMock()
        default_merged = {
            "pool_info": {
                "reserve_in_usd": "50000",
                "volume_usd_24h": "20000",
                "base_token_price_usd": "1.23",
            },
            "ohlcv": [
                {"open": 1.0, "high": 1.1, "low": 0.9, "close": 1.05, "volume": 100, "timestamp": 1000 + i * 300}
                for i in range(30)
            ],
            "source_status": {"gecko": True, "moralis": False},
            "warnings": [],
        }
        if merged_data:
            default_merged.update(merged_data)
        fusion_mock.fetch_merged = AsyncMock(return_value=default_merged)
        fusion_mock.detect_signals = AsyncMock(return_value=[
            {"type": "volume_spike", "strength": 60, "source": "gecko"},
            {"type": "price_divergence", "strength": 75, "source": "gecko"},
        ])

        gecko_mock = MagicMock()
        with patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "moralis_client": MagicMock(),
                "output_root": str(tmp_path),
            })
            skill._fusion = fusion_mock
        return skill

    def test_enrich_returns_packet(self, tmp_path):
        skill = self._make_skill(tmp_path)
        asset = PoolAsset(pair_id="TEST_USDT_0x1234", pool_address="0x1234")
        packet = _run(skill.enrich_pool(asset))
        assert packet is not None
        assert isinstance(packet, SignalPacket)
        assert len(packet.signals) == 2

    def test_enrich_skip_low_tvl(self, tmp_path):
        skill = self._make_skill(tmp_path, {
            "pool_info": {"reserve_in_usd": "100", "volume_usd_24h": "50"},
        })
        asset = PoolAsset(pair_id="LOW_TVL_0xLOW", pool_address="0xLOW")
        packet = _run(skill.enrich_pool(asset))
        assert packet is None

    def test_enrich_skip_low_volume(self, tmp_path):
        skill = self._make_skill(tmp_path, {
            "pool_info": {"reserve_in_usd": "50000", "volume_usd_24h": "100"},
        })
        # volume 不足但 TVL 足够 → 还要看信号
        asset = PoolAsset(pair_id="LOW_VOL_0xLOV", pool_address="0xLOV")
        packet = _run(skill.enrich_pool(asset))
        assert packet is None  # volume 低于 min_volume (5000)


# ── Full Pipeline ────────────────────────────────────

class TestFullPipeline:
    def test_run_empty_discovery(self, tmp_path):
        gecko_mock = MagicMock()
        gecko_mock.get_trending_pools = AsyncMock(return_value=[])
        gecko_mock.get_pools_by_volume = AsyncMock(return_value=[])
        gecko_mock._get = AsyncMock(return_value={"data": []})
        with patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "dexscreener_client": _dxs_noop(),
                "output_root": str(tmp_path),
            })
        outcome = _run(skill.run())
        assert outcome.status == "partial"
        assert outcome.reason_code == "no_candidates"

    def test_run_with_quality_pools(self, tmp_path):
        gecko_mock = MagicMock()
        _USDT = "0x55d398326f99059fF775485246999027B3197955"
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xQUALqualQUALqual", "name": "GOOD / USDT", "dex_id": "pancake",
             "quote_token_address": _USDT},
        ])
        gecko_mock.get_pools_by_volume = AsyncMock(return_value=[])
        gecko_mock._get = AsyncMock(return_value={"data": []})

        fusion_mock = MagicMock()
        fusion_mock.fetch_merged = AsyncMock(return_value={
            "pool_info": {
                "reserve_in_usd": "500000",
                "volume_usd_24h": "100000",
                "base_token_price_usd": "5.0",
            },
            "ohlcv": [
                {"open": 5, "high": 5.1, "low": 4.9, "close": 5.05,
                 "volume": 1000, "timestamp": 1000 + i * 300}
                for i in range(30)
            ],
            "source_status": {"gecko": True, "moralis": True},
            "warnings": [],
        })
        fusion_mock.detect_signals = AsyncMock(return_value=[
            {"type": "price_divergence", "strength": 80, "source": "gecko"},
            {"type": "volume_spike", "strength": 70, "source": "gecko"},
        ])

        with patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            skill = ArbCollectSkill(config={
                "gecko_client": gecko_mock,
                "dexscreener_client": _dxs_noop(),
                "output_root": str(tmp_path),
            })
            skill._fusion = fusion_mock

        outcome = _run(skill.run())
        assert outcome.status == "success"
        assert outcome.pools_discovered == 1
        assert outcome.pools_persisted == 1
        assert skill.registry.pending_count == 1

        # 验证文件
        pair_ids = skill.registry.list_pending()
        assert len(pair_ids) == 1
        pending = tmp_path / "pending" / pair_ids[0]
        assert (pending / "idea_packet.yml").exists()
        assert (pending / "asset_hints.yml").exists()


# ── Utility Functions ────────────────────────────────

class TestUtilityFunctions:
    def test_safe_int_normal(self):
        assert _safe_int("42") == 42

    def test_safe_int_none(self):
        assert _safe_int(None, 25) == 25

    def test_safe_int_garbage(self):
        assert _safe_int("abc", 10) == 10

    def test_utcnow_format(self):
        ts = _utcnow()
        assert ts.endswith("Z")
        assert "T" in ts

    def test_summarize_ohlcv_empty(self):
        assert _summarize_ohlcv([]) == {}

    def test_summarize_ohlcv_normal(self):
        bars = [{"close": 1.0, "high": 1.1, "low": 0.8}, {"close": 1.2, "high": 1.3, "low": 0.9}]
        s = _summarize_ohlcv(bars)
        assert s["high"] == 1.3
        assert s["low"] == 0.8
        assert s["bar_count"] == 2

    def test_summarize_ohlcv_price_change_fallback(self):
        """Q5: OHLCV 为空时从 price_change_percentage 构建摘要"""
        pool_info = {"price_change_percentage": {"m5": 1.2, "h1": -0.5, "h6": 2.0, "h24": -3.1}}
        s = _summarize_ohlcv([], pool_info=pool_info)
        assert s["period"] == "price_change_fallback"
        assert s["price_change_m5"] == 1.2
        assert s["price_change_h24"] == -3.1

    def test_summarize_ohlcv_volume_window_fallback(self):
        """Q5: 无 price_change 但有 volume_usd 时间窗"""
        pool_info = {"volume_usd": {"m5": 100, "h1": 2000, "h6": 0, "h24": 50000}}
        s = _summarize_ohlcv([], pool_info=pool_info)
        assert s["period"] == "volume_window_fallback"
        assert s["volume_h1"] == 2000

    def test_summarize_ohlcv_single_field_fallback(self):
        """Q5: 最后兜底 — 只有 price / tvl"""
        pool_info = {"base_token_price_usd": "1.5", "reserve_in_usd": "10000"}
        s = _summarize_ohlcv([], pool_info=pool_info)
        assert s["period"] == "single_field_fallback"
        assert s["price_usd"] == 1.5
        assert s["tvl_usd"] == 10000

    def test_summarize_ohlcv_empty_pcp_skipped(self):
        """Q5: price_change_percentage 全零时跳到下一层"""
        pool_info = {"price_change_percentage": {"m5": 0, "h1": 0, "h6": 0, "h24": 0},
                     "base_token_price_usd": "2.0"}
        s = _summarize_ohlcv([], pool_info=pool_info)
        # 全零 → 跳过 pcp → 进 single_field_fallback
        assert s["period"] == "single_field_fallback"

    def test_format_indicators_none(self):
        assert _format_indicators(None) == {}

    def test_suggest_strategy_price_divergence(self):
        assert _suggest_strategy([{"type": "price_divergence"}]) == "cross_pool_arbitrage"

    def test_suggest_strategy_volume(self):
        assert _suggest_strategy([{"type": "volume_spike"}]) == "volume_momentum"

    def test_suggest_strategy_empty(self):
        assert _suggest_strategy([]) == "unknown"

    def test_build_reasons(self):
        signals = [{"type": "x", "strength": 50.0}]
        reasons = _build_reasons(signals, 2_000_000, 200_000)
        assert any("x" in r for r in reasons)
        assert any("TVL" in r for r in reasons)


# ── PoolAsset / SignalPacket dataclasses ─────────────

class TestDataclasses:
    def test_pool_asset_defaults(self):
        a = PoolAsset(pair_id="T", pool_address="0x")
        assert a.lifecycle_state == "pending"
        assert a.scan_count == 0

    def test_signal_packet_round_trip(self):
        p = SignalPacket(pair_id="P1", signals=[{"signal_type": "x", "strength": 1}])
        d = asdict(p)
        assert d["pair_id"] == "P1"
        assert len(d["signals"]) == 1

    def test_pool_hints_defaults(self):
        h = PoolHints(pair_id="H1")
        assert h.network == "bsc"
        assert h.signal_quality == "none"

    def test_scan_outcome_defaults(self):
        o = CollectOutcome()
        assert o.status == "success"
        assert o.pools_discovered == 0


# ══════════════════════════════════════════════════════
# Step 2: Factor Computation Tests
# ══════════════════════════════════════════════════════


class TestComputeOnchainFactors:
    """compute_onchain_factors — 链上活动因子"""

    def test_empty_transfers(self):
        r = compute_onchain_factors([])
        assert r["tx_count"] == 0
        assert r["unique_wallets"] == 0
        assert r["avg_trade_size_usd"] == 0.0

    def test_basic_transfers(self):
        transfers = [
            {"from_address": "0xAA", "to_address": "0xBB", "value_usd": 100},
            {"from_address": "0xAA", "to_address": "0xCC", "value_usd": 200},
            {"from_address": "0xDD", "to_address": "0xBB", "value_usd": 300},
        ]
        r = compute_onchain_factors(transfers)
        assert r["tx_count"] == 3
        assert r["unique_wallets"] == 4  # AA, BB, CC, DD
        assert r["avg_trade_size_usd"] == 200.0
        assert r["total_volume_usd"] == 600.0

    def test_fallback_to_value_decimal_times_price(self):
        transfers = [
            {"from_address": "0x1", "to_address": "0x2", "value_decimal": 1000},
        ]
        r = compute_onchain_factors(transfers, base_price=0.5)
        assert r["total_volume_usd"] == 500.0

    def test_dedup_wallets_case_insensitive(self):
        transfers = [
            {"from_address": "0xAA", "to_address": "0xaa"},  # same wallet different case
        ]
        r = compute_onchain_factors(transfers)
        assert r["unique_wallets"] == 1  # deduped


class TestComputeLpDynamics:
    """compute_lp_dynamics — LP 动态因子"""

    def test_empty_events(self):
        r = compute_lp_dynamics([])
        assert r["add_count"] == 0
        assert r["net_flow_direction"] == "neutral"

    def test_add_events(self):
        events = [
            {"type": "add", "total_value_usd": 5000},
            {"type": "add", "total_value_usd": 3000},
        ]
        r = compute_lp_dynamics(events)
        assert r["add_count"] == 2
        assert r["remove_count"] == 0
        assert r["net_flow_usd"] == 8000.0
        assert r["net_flow_direction"] == "inflow"

    def test_remove_events(self):
        events = [
            {"type": "remove", "total_value_usd": 10000},
        ]
        r = compute_lp_dynamics(events)
        assert r["remove_count"] == 1
        assert r["net_flow_usd"] == -10000.0
        assert r["net_flow_direction"] == "outflow"

    def test_mixed_events(self):
        events = [
            {"type": "add", "total_value_usd": 3000},
            {"type": "remove", "total_value_usd": 5000},
        ]
        r = compute_lp_dynamics(events)
        assert r["add_count"] == 1
        assert r["remove_count"] == 1
        assert r["net_flow_usd"] == -2000.0
        assert r["net_flow_direction"] == "outflow"

    def test_mint_burn_aliases(self):
        events = [
            {"type": "mint", "total_value_usd": 1000},
            {"event_type": "burn", "total_value_usd": 500},
        ]
        r = compute_lp_dynamics(events)
        assert r["add_count"] == 1
        assert r["remove_count"] == 1
        assert r["net_flow_usd"] == 500.0

    def test_fallback_token_values(self):
        events = [
            {"type": "add", "token0_value_usd": 200, "token1_value_usd": 200},
        ]
        r = compute_lp_dynamics(events)
        assert r["net_flow_usd"] == 400.0


class TestComputeLiquidityDepth:
    """compute_liquidity_depth — 流动性深度因子"""

    def test_empty_pool_info(self):
        r = compute_liquidity_depth({})
        assert r["reserve_ratio"] == 1.0
        assert r["depth_2pct_usd"] == 0.0

    def test_normal_pool(self):
        r = compute_liquidity_depth({"reserve_in_usd": "100000"})
        assert r["reserve_usd_total"] == 100000.0
        # depth_2pct ≈ 100000 * 0.00995 ≈ 995
        assert 990 <= r["depth_2pct_usd"] <= 1000

    def test_imbalanced_reserves(self):
        r = compute_liquidity_depth({
            "reserve_in_usd": "50000",
            "base_token_price_native_currency": "0.1",
            "quote_token_price_native_currency": "1.0",
        })
        assert r["reserve_ratio"] == 0.1  # 0.1/1.0


class TestFormatAllIndicators:
    """_format_all_indicators — 技术指标 + 因子合并"""

    def test_none_indicators_with_factors(self):
        r = _format_all_indicators(
            None,
            onchain={"tx_count": 50, "unique_wallets": 12, "avg_trade_size_usd": 88.5},
            lp_dyn={"add_count": 3, "remove_count": 1, "net_flow_usd": 2000.0, "net_flow_direction": "inflow"},
            liq_depth={"reserve_ratio": 0.95, "depth_2pct_usd": 500.0},
        )
        assert r["onchain_tx_count"] == 50
        assert r["onchain_unique_wallets"] == 12
        assert r["lp_net_flow_usd"] == 2000.0
        assert r["reserve_ratio"] == 0.95
        assert r["depth_2pct_usd"] == 500.0

    def test_backward_compat_no_factors(self):
        r = _format_all_indicators(None)
        assert r == {}


class TestDetectFactorSignals:
    """_detect_factor_signals — 因子驱动信号"""

    def _make_skill(self):
        with patch("toolloop_arb_collect.GeckoTerminalClient"), \
             patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={
                 "onchain_activity_min_tx": 10,
                 "onchain_activity_min_wallets": 5,
                 "lp_outflow_threshold_usd": 1000.0,
             }):
            return ArbCollectSkill(config={"output_root": "/tmp/test_scan"})

    def test_high_onchain_activity(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 20, "unique_wallets": 8, "avg_trade_size_usd": 100},
            {"net_flow_direction": "neutral", "net_flow_usd": 0},
            {"depth_2pct_usd": 1000, "reserve_ratio": 0.9, "reserve_usd_total": 50000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "high_onchain_activity" in types

    def test_no_signal_below_threshold(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 3, "unique_wallets": 2},
            {"net_flow_direction": "neutral", "net_flow_usd": 0},
            {"depth_2pct_usd": 1000, "reserve_ratio": 0.9, "reserve_usd_total": 50000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "high_onchain_activity" not in types

    def test_lp_outflow_signal(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 0, "unique_wallets": 0},
            {"net_flow_direction": "outflow", "net_flow_usd": -5000, "add_count": 1, "remove_count": 3},
            {"depth_2pct_usd": 1000, "reserve_ratio": 0.9, "reserve_usd_total": 50000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "lp_outflow" in types
        outflow_sig = [s for s in sigs if s["type"] == "lp_outflow"][0]
        assert outflow_sig["strength"] > 0

    def test_no_outflow_when_inflow(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 0, "unique_wallets": 0},
            {"net_flow_direction": "inflow", "net_flow_usd": 5000},
            {"depth_2pct_usd": 1000, "reserve_ratio": 0.9, "reserve_usd_total": 50000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "lp_outflow" not in types

    def test_shallow_depth_signal(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 0, "unique_wallets": 0},
            {"net_flow_direction": "neutral", "net_flow_usd": 0},
            {"depth_2pct_usd": 50, "reserve_ratio": 0.3, "reserve_usd_total": 5000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "shallow_depth" in types

    def test_no_shallow_depth_for_deep_pool(self):
        skill = self._make_skill()
        sigs = skill._detect_factor_signals(
            {"tx_count": 0, "unique_wallets": 0},
            {"net_flow_direction": "neutral", "net_flow_usd": 0},
            {"depth_2pct_usd": 5000, "reserve_ratio": 0.95, "reserve_usd_total": 500000},
            "0xPOOL",
        )
        types = [s["type"] for s in sigs]
        assert "shallow_depth" not in types


# ── Q7: Whale Top-N Truncation ───────────────────────

class TestWhaleTopNTruncation:
    """Q7: whale_movement 信号应被截断为 top-N"""

    def _make_fusion(self):
        from skill_collect import DataFusion
        return DataFusion(gecko_client=MagicMock(), moralis_client=MagicMock())

    def test_whale_truncated_to_top_n(self):
        """50 笔鲸鱼交易 → 只保留 top 20 信号"""
        transfers = [
            {"transaction_hash": f"0x{i:040x}", "value_usd": float((i + 1) * 100)}
            for i in range(50)
        ]
        merged = {
            "pool_info": {"base_token_price_usd": "1.0"},
            "transfers": transfers,
            "trades": [],
        }
        fusion = self._make_fusion()

        async def _go():
            return await fusion.detect_signals(
                pool_address="0xPOOL", merged=merged,
                thresholds={"whale_threshold_usd": 500, "whale_top_n": 20,
                            "volume_spike_ratio": 999},
            )
        signals = _run(_go())
        whale_sigs = [s for s in signals if s["type"] == "whale_movement"]
        assert len(whale_sigs) <= 20
        # top-20: values 5000,4900,...,3100
        values = sorted([s["details"]["value_usd"] for s in whale_sigs], reverse=True)
        assert values[0] == 5000.0
        assert len(values) == 20

    def test_whale_custom_top_n_5(self):
        """自定义 whale_top_n=5"""
        transfers = [
            {"transaction_hash": f"0x{i:040x}", "value_usd": float((i + 1) * 1000)}
            for i in range(30)
        ]
        merged = {
            "pool_info": {"base_token_price_usd": "1.0"},
            "transfers": transfers,
            "trades": [],
        }
        fusion = self._make_fusion()

        async def _go():
            return await fusion.detect_signals(
                pool_address="0xPOOL", merged=merged,
                thresholds={"whale_threshold_usd": 500, "whale_top_n": 5,
                            "volume_spike_ratio": 999},
            )
        signals = _run(_go())
        whale_sigs = [s for s in signals if s["type"] == "whale_movement"]
        assert len(whale_sigs) <= 5

    def test_whale_under_limit_unchanged(self):
        """3 笔鲸鱼交易 < 20 → 全部保留"""
        transfers = [
            {"transaction_hash": f"0xhash{i}", "value_usd": float(2000 + i * 500)}
            for i in range(3)
        ]
        merged = {
            "pool_info": {"base_token_price_usd": "1.0"},
            "transfers": transfers,
            "trades": [],
        }
        fusion = self._make_fusion()

        async def _go():
            return await fusion.detect_signals(
                pool_address="0xPOOL", merged=merged,
                thresholds={"whale_threshold_usd": 500, "whale_top_n": 20,
                            "volume_spike_ratio": 999},
            )
        signals = _run(_go())
        whale_sigs = [s for s in signals if s["type"] == "whale_movement"]
        assert len(whale_sigs) == 3


class TestQualityScoringV2:
    """Updated _score_quality with factor dimensions"""

    def _make_skill(self):
        with patch("toolloop_arb_collect.GeckoTerminalClient"), \
             patch("toolloop_arb_collect.DataFusion"), \
             patch("toolloop_arb_collect._load_default_thresholds", return_value={}):
            return ArbCollectSkill(config={"output_root": "/tmp/test_scan"})

    def test_factors_boost_score(self):
        skill = self._make_skill()
        signals = [{"type": "volume_spike", "strength": 60}]
        # Without factors
        _, s1 = skill._score_quality(signals, None, 50_000, 50_000)
        # With strong factors
        _, s2 = skill._score_quality(
            signals, None, 50_000, 50_000,
            onchain={"unique_wallets": 10, "tx_count": 20},
            lp_dyn={"net_flow_direction": "inflow"},
            liq_depth={"depth_2pct_usd": 600, "reserve_ratio": 0.4},
        )
        assert s2 > s1

    def test_outflow_penalty(self):
        skill = self._make_skill()
        signals = [{"type": "x", "strength": 50}]
        _, s_neutral = skill._score_quality(
            signals, None, 50_000, 50_000,
            lp_dyn={"net_flow_direction": "neutral"},
        )
        _, s_outflow = skill._score_quality(
            signals, None, 50_000, 50_000,
            lp_dyn={"net_flow_direction": "outflow"},
        )
        # outflow has -2 penalty, but floor at 0 means factor_bonus won't go negative
        assert s_outflow <= s_neutral

    def test_backward_compat_no_factors(self):
        """Calling without factor kwargs still works"""
        skill = self._make_skill()
        signals = [
            {"type": "price_divergence", "strength": 80},
            {"type": "volume_spike", "strength": 60},
        ]
        q, s = skill._score_quality(signals, None, 500_000, 200_000)
        assert q in ("strong", "moderate")
        assert s > 0


# ── Flash+Pro LLM 判断层测试 ──────────────────────────────


def _make_pool_asset(**kw) -> PoolAsset:
    defaults = {
        "pair_id": "TEST_USDT_0x1234",
        "pool_address": "0x1234567890abcdef",
        "dex": "pancakeswap_v2",
        "base_token": "TEST",
        "quote_token": "USDT",
        "base_token_address": "0xaaa",
        "quote_token_address": "0xbbb",
        "discovery_method": "volume_ranked",
        "discovered_at": "2026-03-20T12:00:00Z",
    }
    defaults.update(kw)
    return PoolAsset(**defaults)


def _make_mock_llm(response: dict) -> MagicMock:
    """创建返回固定 JSON 的 LLMClient mock"""
    mock = MagicMock()
    mock.generate_json.return_value = response
    return mock


def _make_mock_prompts(available: set[str] | None = None) -> MagicMock:
    """创建 PromptStore mock，所有 scan_ 开头的 prompt 都可用"""
    if available is None:
        available = {
            "scan_flash_classify_system",
            "scan_flash_classify_user",
            "scan_pro_arbitrate_system",
            "scan_pro_arbitrate_user",
        }
    mock = MagicMock()
    mock.has.side_effect = lambda name: name in available
    mock.get.return_value = "mock prompt {pair_id} {dex} {base_token} {base_token_address} " \
        "{quote_token} {quote_token_address} {discovery_method} {price_usd} {tvl_usd} " \
        "{volume_24h_usd} {fee_bps} {ohlcv_summary} {signals_json} {indicators_json}"
    mock.get_hash.return_value = "abcdef123456"
    return mock


def _make_mock_pro_prompts() -> MagicMock:
    """Pro prompt 需要不同的占位符"""
    available = {
        "scan_flash_classify_system",
        "scan_flash_classify_user",
        "scan_pro_arbitrate_system",
        "scan_pro_arbitrate_user",
    }
    mock = MagicMock()
    mock.has.side_effect = lambda name: name in available

    def _get(name: str) -> str:
        if "pro" in name and "user" in name:
            return ("mock pro {pair_id} {dex} {tvl_usd} {volume_24h_usd} "
                    "{flash_result_json} {signals_json} {indicators_json} "
                    "{price_valid} {ohlcv_valid} {dual_source}")
        if "flash" in name and "user" in name:
            return ("mock flash {pair_id} {dex} {base_token} {base_token_address} "
                    "{quote_token} {quote_token_address} {discovery_method} "
                    "{price_usd} {tvl_usd} {volume_24h_usd} {fee_bps} "
                    "{ohlcv_summary} {signals_json} {indicators_json}")
        return "system prompt"

    mock.get.side_effect = _get
    return mock


_FLASH_RESPONSE = {
    "pool_classification": {
        "asset_class": "blue_chip",
        "amm_type": "constant_product_v2",
        "liquidity_profile": "deep",
        "activity_profile": "high_frequency",
    },
    "strategy_candidates": [
        {
            "strategy_type": "cross_pool_arbitrage",
            "confidence": 0.85,
            "reasoning": "价格偏差 + 高链上活跃度",
            "trigger_signals": ["price_divergence", "high_onchain_activity"],
        },
        {
            "strategy_type": "volume_momentum",
            "confidence": 0.6,
            "reasoning": "24h 交易量持续放大",
            "trigger_signals": ["volume_spike"],
        },
    ],
    "risk_flags": ["reserve_imbalance"],
    "flash_score": 75,
    "flash_verdict": "strong",
}

_PRO_RESPONSE = {
    "agree_classification": True,
    "revised_classification": None,
    "strategy_verdict": [
        {
            "strategy_type": "cross_pool_arbitrage",
            "pro_confidence": 0.90,
            "viable": True,
            "reasoning": "PancakeSwap V2 与 V3 同对跨池价差一致",
            "parameter_hints": {
                "entry_threshold_pct": 0.5,
                "max_position_usd": 500,
                "max_slippage_bps": 30,
                "hold_blocks_max": 2,
            },
        },
    ],
    "pro_score": 82,
    "pro_verdict": "strong",
    "override_reason": "",
}


class TestCollectLLMJudgeAvailability:
    def test_not_available_without_llm(self):
        judge = CollectLLMJudge(llm_client=None, prompt_store=_make_mock_prompts())
        assert not judge.available

    def test_not_available_without_prompts(self):
        judge = CollectLLMJudge(llm_client=_make_mock_llm({}), prompt_store=None)
        assert not judge.available

    def test_available_with_both(self):
        judge = CollectLLMJudge(
            llm_client=_make_mock_llm({}),
            prompt_store=_make_mock_prompts(),
        )
        assert judge.available

    def test_unavailable_returns_deterministic_fallback(self):
        judge = CollectLLMJudge(llm_client=None, prompt_store=None)
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[],
            market_data={},
            indicators={},
            deterministic_quality="moderate",
            deterministic_score=55,
        )
        # LLM 不可用时返回确定性分类（非空）
        assert result["llm_verdict"] == "moderate"
        assert result["llm_score"] == 55
        assert result["llm_classification"]["asset_class"] != ""
        assert result["llm_classification"]["liquidity_profile"] != ""


class TestCollectLLMJudgeFlash:
    def test_flash_only_no_pro(self):
        """Flash score < threshold → 不触发 Pro"""
        flash = {**_FLASH_RESPONSE, "flash_score": 40, "flash_verdict": "moderate"}
        judge = CollectLLMJudge(
            llm_client=_make_mock_llm(flash),
            prompt_store=_make_mock_prompts(),
            enable_pro=True,
        )
        # 设置 call_count 不在抽检周期
        judge._call_count = 1
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[{"signal_type": "x", "strength": 50}],
            market_data={"price_usd": 1.0, "tvl_usd": 100000, "volume_24h_usd": 50000,
                         "fee_bps": 25, "ohlcv_summary": {}},
            indicators={"rsi_14": 50},
            deterministic_quality="moderate",
            deterministic_score=50,
        )
        assert result["llm_verdict"] == "moderate"
        assert result["llm_score"] == 40
        assert result["llm_classification"]["asset_class"] == "blue_chip"
        assert len(result["llm_strategies"]) == 2
        assert result["llm_pro_final"] == {}  # Pro 未触发

    def test_flash_failure_returns_empty(self):
        llm = MagicMock()
        llm.generate_json.side_effect = RuntimeError("LLM timeout")
        judge = CollectLLMJudge(
            llm_client=llm,
            prompt_store=_make_mock_prompts(),
        )
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[],
            market_data={},
            indicators={},
            deterministic_quality="moderate",
            deterministic_score=55,
        )
        assert result["llm_verdict"] == ""

    def test_flash_invalid_response_returns_empty(self):
        """Flash 返回无 flash_verdict → 无效"""
        llm = _make_mock_llm({"something_else": 1})
        judge = CollectLLMJudge(
            llm_client=llm,
            prompt_store=_make_mock_prompts(),
        )
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[],
            market_data={},
            indicators={},
            deterministic_quality="moderate",
            deterministic_score=55,
        )
        assert result["llm_verdict"] == ""


class TestCollectLLMJudgePro:
    def _make_judge_with_pro(self):
        """Flash + Pro 都返回正常结果"""
        call_count = [0]
        flash_resp = _FLASH_RESPONSE.copy()
        pro_resp = _PRO_RESPONSE.copy()

        def gen_json(**kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return flash_resp
            return pro_resp

        llm = MagicMock()
        llm.generate_json.side_effect = gen_json
        return CollectLLMJudge(
            llm_client=llm,
            prompt_store=_make_mock_pro_prompts(),
            enable_pro=True,
        )

    def test_pro_triggered_by_high_flash_score(self):
        judge = self._make_judge_with_pro()
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[{"signal_type": "price_divergence", "strength": 80}],
            market_data={"price_usd": 1.5, "tvl_usd": 500000, "volume_24h_usd": 100000,
                         "fee_bps": 25, "ohlcv_summary": {"bar_count": 10}},
            indicators={"rsi_14": 65},
            deterministic_quality="strong",
            deterministic_score=75,
        )
        # Pro 覆盖了 strategies 和 verdict
        assert result["llm_verdict"] == "strong"
        assert result["llm_score"] == 82  # Pro score
        assert len(result["llm_strategies"]) == 1
        assert result["llm_strategies"][0]["pro_confidence"] == 0.90
        assert result["llm_pro_final"] != {}

    def test_pro_override_classification(self):
        """Pro 不同意分类 → 覆盖"""
        flash = {**_FLASH_RESPONSE}
        pro = {
            **_PRO_RESPONSE,
            "agree_classification": False,
            "revised_classification": {
                "asset_class": "micro_cap",
                "amm_type": "concentrated_v3",
                "liquidity_profile": "shallow",
                "activity_profile": "normal",
            },
        }
        call_count = [0]
        def gen_json(**kw):
            call_count[0] += 1
            return flash if call_count[0] == 1 else pro

        llm = MagicMock()
        llm.generate_json.side_effect = gen_json
        judge = CollectLLMJudge(
            llm_client=llm,
            prompt_store=_make_mock_pro_prompts(),
        )
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[{"signal_type": "x", "strength": 80}],
            market_data={"price_usd": 1.0, "tvl_usd": 50000, "volume_24h_usd": 20000,
                         "fee_bps": 25, "ohlcv_summary": {}},
            indicators={},
            deterministic_quality="moderate",
            deterministic_score=55,
        )
        assert result["llm_classification"]["asset_class"] == "micro_cap"

    def test_pro_disabled(self):
        """enable_pro=False → 即使 Flash score 高也不触发 Pro"""
        llm = _make_mock_llm(_FLASH_RESPONSE)
        judge = CollectLLMJudge(
            llm_client=llm,
            prompt_store=_make_mock_prompts(),
            enable_pro=False,
        )
        result = judge.evaluate(
            asset=_make_pool_asset(),
            signals=[{"signal_type": "x", "strength": 80}],
            market_data={"price_usd": 1.0, "tvl_usd": 500000, "volume_24h_usd": 100000,
                         "fee_bps": 25, "ohlcv_summary": {}},
            indicators={},
            deterministic_quality="strong",
            deterministic_score=80,
        )
        assert result["llm_pro_final"] == {}
        assert result["llm_verdict"] == "strong"  # Flash verdict
        assert llm.generate_json.call_count == 1   # Flash only


class TestProTriggerRules:
    def test_trigger_by_score_threshold(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        judge._call_count = 1  # 避免抽样干扰
        assert judge._should_trigger_pro(60, "moderate", 50)
        assert not judge._should_trigger_pro(40, "moderate", 50)

    def test_trigger_by_strong_verdict(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        assert judge._should_trigger_pro(30, "strong", 50)

    def test_trigger_by_divergence(self):
        """确定性 score 高但 Flash score 低 → 分歧仲裁"""
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        assert judge._should_trigger_pro(30, "weak", 70)

    def test_trigger_by_sampling(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        judge._call_count = 3  # 被 3 整除
        assert judge._should_trigger_pro(20, "weak", 30)

    def test_no_trigger_low_everything(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        judge._call_count = 1
        assert not judge._should_trigger_pro(30, "weak", 40)


class TestBuildExecutionHints:
    def test_deterministic_only(self):
        signals = [{"type": "price_divergence", "strength": 80}]
        hints = _build_execution_hints(signals, "strong", {})
        assert hints["suggested_strategy"] == "cross_pool_arbitrage"
        assert hints["strategy_source"] == "deterministic"
        assert hints["urgency"] == "high"

    def test_llm_override_high_confidence(self):
        signals = [{"type": "volume_spike", "strength": 60}]
        llm_result = {
            "llm_strategies": [
                {"strategy_type": "mean_reversion", "confidence": 0.8},
            ],
        }
        hints = _build_execution_hints(signals, "moderate", llm_result)
        assert hints["suggested_strategy"] == "mean_reversion"
        assert hints["strategy_source"] == "llm_flash"

    def test_llm_no_override_low_confidence(self):
        signals = [{"type": "volume_spike", "strength": 60}]
        llm_result = {
            "llm_strategies": [
                {"strategy_type": "mean_reversion", "confidence": 0.3},
            ],
        }
        hints = _build_execution_hints(signals, "moderate", llm_result)
        assert hints["suggested_strategy"] == "volume_momentum"  # deterministic wins

    def test_pro_parameter_hints(self):
        signals = [{"type": "x", "strength": 50}]
        llm_result = {
            "llm_strategies": [
                {
                    "strategy_type": "cross_pool_arbitrage",
                    "pro_confidence": 0.9,
                    "parameter_hints": {"entry_threshold_pct": 0.5},
                },
            ],
        }
        hints = _build_execution_hints(signals, "strong", llm_result)
        assert hints["suggested_strategy"] == "cross_pool_arbitrage"
        assert hints["strategy_source"] == "llm_pro"
        assert hints["parameter_hints"]["entry_threshold_pct"] == 0.5


class TestSignalPacketLLMFields:
    def test_new_fields_default_empty(self):
        pkt = SignalPacket(pair_id="X")
        assert pkt.llm_classification == {}
        assert pkt.llm_strategies == []
        assert pkt.llm_risk_flags == []
        assert pkt.llm_flash_raw == {}
        assert pkt.llm_pro_final == {}
        assert pkt.llm_verdict == ""
        assert pkt.llm_score == 0

    def test_round_trip_with_llm_fields(self):
        pkt = SignalPacket(
            pair_id="TEST_USDT_0x1234",
            llm_classification={"asset_class": "blue_chip"},
            llm_strategies=[{"strategy_type": "arb", "confidence": 0.9}],
            llm_risk_flags=["reserve_imbalance"],
            llm_verdict="strong",
            llm_score=85,
        )
        d = asdict(pkt)
        assert d["llm_classification"]["asset_class"] == "blue_chip"
        assert d["llm_score"] == 85
        assert d["llm_verdict"] == "strong"
        assert len(d["llm_strategies"]) == 1


class TestPoolHintsLLMFields:
    def test_new_fields_default_empty(self):
        h = PoolHints(pair_id="X")
        assert h.asset_class == ""
        assert h.liquidity_profile == ""
        assert h.strategy_type == ""
        assert h.strategy_confidence == 0.0
        assert h.llm_verdict == ""
        assert h.llm_score == 0

    def test_round_trip_with_llm_fields(self):
        h = PoolHints(
            pair_id="TEST_USDT_0x1234",
            asset_class="stablecoin_pair",
            liquidity_profile="deep",
            strategy_type="mean_reversion",
            strategy_confidence=0.88,
            llm_verdict="strong",
            llm_score=90,
        )
        d = asdict(h)
        assert d["asset_class"] == "stablecoin_pair"
        assert d["strategy_type"] == "mean_reversion"
        assert d["llm_score"] == 90


class TestMergeResults:
    def test_flash_only(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        merged = judge._merge_results(_FLASH_RESPONSE, None)
        assert merged["llm_verdict"] == "strong"
        assert merged["llm_score"] == 75
        assert merged["llm_pro_final"] == {}
        assert merged["llm_classification"]["asset_class"] == "blue_chip"

    def test_pro_overrides_verdict_and_score(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        merged = judge._merge_results(_FLASH_RESPONSE, _PRO_RESPONSE)
        assert merged["llm_verdict"] == "strong"
        assert merged["llm_score"] == 82  # Pro score overrides Flash 75
        assert len(merged["llm_strategies"]) == 1  # Pro strategies override

    def test_pro_disagree_replaces_classification(self):
        judge = CollectLLMJudge(llm_client=MagicMock(), prompt_store=MagicMock())
        pro = {
            **_PRO_RESPONSE,
            "agree_classification": False,
            "revised_classification": {"asset_class": "meme"},
        }
        merged = judge._merge_results(_FLASH_RESPONSE, pro)
        assert merged["llm_classification"]["asset_class"] == "meme"

    def test_empty_result_structure(self):
        result = CollectLLMJudge._empty_result()
        assert set(result.keys()) == {
            "llm_classification", "llm_strategies", "llm_risk_flags",
            "llm_flash_raw", "llm_pro_final", "llm_verdict", "llm_score",
        }


# ── DexScreener 集成测试 ──────────────────────────────

from skill_collect import DexScreenerClient, DataFusion

_SAMPLE_DEXSCREENER_PAIR = {
    "chainId": "bsc",
    "dexId": "pancakeswap",
    "pairAddress": "0xABC123def456",
    "baseToken": {"address": "0xBASE", "symbol": "WBNB", "name": "Wrapped BNB"},
    "quoteToken": {"address": "0xQUOTE", "symbol": "USDT", "name": "Tether"},
    "priceUsd": "612.34",
    "liquidity": {"usd": 500_000},
    "volume": {"h24": 1_200_000, "h6": 300_000},
    "txns": {"h24": {"buys": 450, "sells": 380}},
    "priceChange": {"h24": -2.5},
}


class TestDexScreenerNormalize:
    """DexScreener 归一化 → GeckoTerminal 格式"""

    def test_normalize_pair_to_pool(self):
        pool = DexScreenerClient.normalize_pair_to_pool(_SAMPLE_DEXSCREENER_PAIR)
        assert pool["address"] == "0xABC123def456"
        assert pool["name"] == "WBNB / USDT"
        assert pool["dex_id"] == "pancakeswap"
        assert pool["reserve_in_usd"] == 500_000
        assert pool["volume_usd"]["h24"] == 1_200_000
        assert pool["base_token_address"] == "0xBASE"
        assert pool["quote_token_address"] == "0xQUOTE"

    def test_normalize_pair_to_pool_info(self):
        info = DexScreenerClient.normalize_pair_to_pool_info(_SAMPLE_DEXSCREENER_PAIR)
        assert info["base_token_price_usd"] == "612.34"
        assert info["reserve_in_usd"] == 500_000
        assert info["volume_usd_24h"] == 1_200_000
        assert info["txns_24h_buys"] == 450
        assert info["txns_24h_sells"] == 380
        assert info["price_change_h24"] == -2.5
        # Q5: price_change_percentage 供 _summarize_ohlcv fallback
        pcp = info["price_change_percentage"]
        assert pcp["h24"] == -2.5
        assert pcp["m5"] == 0  # sample fixture 无 m5 字段
        # Q6: dex_id 直传
        assert info["dex_id"] == "pancakeswap"

    def test_normalize_missing_fields(self):
        """空 pair 不崩溃"""
        pool = DexScreenerClient.normalize_pair_to_pool({})
        assert pool["address"] == ""
        assert pool["name"] == "? / ?"
        assert pool["reserve_in_usd"] == 0

    def test_pool_to_asset_from_dexscreener(self):
        """归一化后的 pool 可被 _pool_to_asset 消费"""
        pool = DexScreenerClient.normalize_pair_to_pool(_SAMPLE_DEXSCREENER_PAIR)
        skill = ArbCollectSkill(config={"gecko_client": MagicMock()})
        asset = skill._pool_to_asset(pool, "dexscreener", "2026-01-01T00:00:00Z")
        assert asset is not None
        assert asset.base_token == "WBNB"
        assert asset.quote_token == "USDT"
        assert asset.discovery_method == "dexscreener"
        assert asset.tvl_usd == 500_000
        assert asset.volume_24h_usd == 1_200_000


class TestDexScreenerClient:
    """DexScreener HTTP 调用（mock）"""

    def test_get_pair(self):
        client = DexScreenerClient()
        mock_resp = {"pairs": [_SAMPLE_DEXSCREENER_PAIR]}

        async def _go():
            with patch.object(client, "_get", new_callable=AsyncMock, return_value=mock_resp):
                pair = await client.get_pair(pair_address="0xABC123def456")
                assert pair["pairAddress"] == "0xABC123def456"
        _run(_go())

    def test_get_pair_empty(self):
        client = DexScreenerClient()

        async def _go():
            with patch.object(client, "_get", new_callable=AsyncMock, return_value={"pairs": []}):
                pair = await client.get_pair(pair_address="0xNONE")
                assert pair == {}
        _run(_go())

    def test_search_pairs(self):
        client = DexScreenerClient()
        mock_resp = {"pairs": [_SAMPLE_DEXSCREENER_PAIR, {**_SAMPLE_DEXSCREENER_PAIR, "chainId": "ethereum"}]}

        async def _go():
            with patch.object(client, "_get", new_callable=AsyncMock, return_value=mock_resp):
                pairs = await client.search_pairs("USDT")
                # 只返回 BSC 链
                assert len(pairs) == 1
                assert pairs[0]["chainId"] == "bsc"
        _run(_go())

    def test_get_token_pairs(self):
        client = DexScreenerClient()
        mock_resp = {"pairs": [_SAMPLE_DEXSCREENER_PAIR]}

        async def _go():
            with patch.object(client, "_get", new_callable=AsyncMock, return_value=mock_resp):
                pairs = await client.get_token_pairs(token_address="0xBASE")
                assert len(pairs) == 1
        _run(_go())

    def test_get_top_boosted(self):
        client = DexScreenerClient()
        boosted = [
            {"chainId": "bsc", "tokenAddress": "0x1"},
            {"chainId": "ethereum", "tokenAddress": "0x2"},
        ]

        async def _go():
            with patch.object(client, "_get", new_callable=AsyncMock, return_value=boosted):
                result = await client.get_top_boosted()
                assert len(result) == 1
                assert result[0]["chainId"] == "bsc"
        _run(_go())

    def test_cache_hit(self):
        client = DexScreenerClient()
        call_count = 0
        original_get = AsyncMock(return_value={"pairs": [_SAMPLE_DEXSCREENER_PAIR]})

        async def _go():
            with patch.object(client, "_get", original_get):
                p1 = await client.get_pair(pair_address="0xABC123def456")
                p2 = await client.get_pair(pair_address="0xABC123def456")
                # 第二次应命中缓存，_get 只调用一次
                assert original_get.call_count == 1
                assert p1 == p2
        _run(_go())


class TestDataFusionDexScreenerFallback:
    """DataFusion — GeckoTerminal 失败时 DexScreener 兜底"""

    def test_dexscreener_fallback_when_gecko_fails(self):
        gecko = MagicMock()
        dxs = MagicMock(spec=DexScreenerClient)
        fusion = DataFusion(gecko_client=gecko, dexscreener_client=dxs)

        # Gecko 全部失败
        gecko.get_pool_info = AsyncMock(side_effect=Exception("429 Too Many Requests"))
        gecko.get_ohlcv = AsyncMock(side_effect=Exception("429"))
        gecko.get_trades = AsyncMock(side_effect=Exception("429"))

        # DexScreener 兜底
        dxs.get_pair = AsyncMock(return_value=_SAMPLE_DEXSCREENER_PAIR)
        dxs.normalize_pair_to_pool_info = MagicMock(
            return_value=DexScreenerClient.normalize_pair_to_pool_info(_SAMPLE_DEXSCREENER_PAIR)
        )

        async def _go():
            result = await fusion.fetch_merged(pool_address="0xABC")
            assert result["source_status"]["dexscreener"] is True
            assert result["source_status"]["gecko"] is False
            assert result["pool_info"]["volume_usd_24h"] == 1_200_000
        _run(_go())

    def test_no_fallback_when_gecko_succeeds(self):
        gecko = MagicMock()
        dxs = MagicMock(spec=DexScreenerClient)
        fusion = DataFusion(gecko_client=gecko, dexscreener_client=dxs)

        # Gecko 成功
        gecko.get_pool_info = AsyncMock(return_value={"reserve_in_usd": "100000"})
        gecko.get_ohlcv = AsyncMock(return_value=[])
        gecko.get_trades = AsyncMock(return_value=[])

        async def _go():
            result = await fusion.fetch_merged(pool_address="0xABC")
            assert result["source_status"]["gecko"] is True
            # DexScreener 不应被调用
            dxs.get_pair.assert_not_called()
        _run(_go())

    def test_both_fail(self):
        gecko = MagicMock()
        dxs = MagicMock(spec=DexScreenerClient)
        fusion = DataFusion(gecko_client=gecko, dexscreener_client=dxs)

        gecko.get_pool_info = AsyncMock(side_effect=Exception("429"))
        gecko.get_ohlcv = AsyncMock(side_effect=Exception("429"))
        gecko.get_trades = AsyncMock(side_effect=Exception("429"))
        dxs.get_pair = AsyncMock(side_effect=Exception("timeout"))

        async def _go():
            result = await fusion.fetch_merged(pool_address="0xABC")
            assert result["source_status"]["gecko"] is False
            assert result["source_status"]["dexscreener"] is False
            assert any("CRITICAL" in w or "unavailable" in w for w in result["warnings"])
        _run(_go())

    def test_source_status_includes_dexscreener(self):
        fusion = DataFusion()

        async def _go():
            result = await fusion.fetch_merged(pool_address="0xABC")
            assert "dexscreener" in result["source_status"]
        _run(_go())


class TestDiscoverDexScreener:
    """ArbCollectSkill DexScreener discovery strategy"""

    def test_dexscreener_discovery(self):
        gecko = MagicMock()
        dxs = MagicMock(spec=DexScreenerClient)
        skill = ArbCollectSkill(config={
            "gecko_client": gecko,
            "dexscreener_client": dxs,
        })

        # get_token_pairs 返回 BSC 池
        dxs.get_token_pairs = AsyncMock(return_value=[
            _SAMPLE_DEXSCREENER_PAIR,
            {**_SAMPLE_DEXSCREENER_PAIR, "pairAddress": "0xDEF789"},
        ])
        dxs.normalize_pair_to_pool = MagicMock(side_effect=DexScreenerClient.normalize_pair_to_pool)
        dxs.get_top_boosted = AsyncMock(return_value=[])

        async def _go():
            assets = await skill._discover_dexscreener(limit=10, now="2026-01-01T00:00:00Z")
            assert len(assets) == 2
            assert assets[0].discovery_method == "dexscreener"
        _run(_go())

    def test_dexscreener_strategy_in_discover(self):
        """discover_pools 包含 dexscreener 策略"""
        gecko = MagicMock()
        dxs = MagicMock(spec=DexScreenerClient)
        skill = ArbCollectSkill(config={
            "gecko_client": gecko,
            "dexscreener_client": dxs,
        })

        # 所有发现策略都返回空（只测 dexscreener 集成是否被调用）
        gecko.get_pools_by_volume = AsyncMock(return_value=[])
        gecko.get_trending_pools = AsyncMock(return_value=[])
        gecko._get = AsyncMock(return_value={"data": []})
        dxs.get_token_pairs = AsyncMock(return_value=[_SAMPLE_DEXSCREENER_PAIR])
        dxs.normalize_pair_to_pool = MagicMock(side_effect=DexScreenerClient.normalize_pair_to_pool)
        dxs.get_top_boosted = AsyncMock(return_value=[])

        async def _go():
            assets = await skill.discover_pools()
            # dexscreener.get_token_pairs 应该被调用
            dxs.get_token_pairs.assert_called()
        _run(_go())
