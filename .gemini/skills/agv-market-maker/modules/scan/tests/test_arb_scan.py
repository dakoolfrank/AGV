"""ArbScanSkill 单元测试"""
from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# 确保 scan scripts 可导入
SCAN_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCAN_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCAN_SCRIPTS_DIR))

from toolloop_arb_scan import (
    ArbPoolRegistry,
    ArbScanSkill,
    PoolAsset,
    PoolHints,
    ScanOutcome,
    SignalPacket,
    _build_reasons,
    _format_indicators,
    _safe_int,
    _suggest_strategy,
    _summarize_ohlcv,
    _utcnow,
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
        pid = ArbScanSkill._generate_pair_id("WBNB", "USDT", "0x58F8abc123")
        assert pid == "WBNB_USDT_0x58F8"

    def test_empty_base(self):
        pid = ArbScanSkill._generate_pair_id("", "USDT", "0xABCDEF")
        assert pid == "UNK_USDT_0xABCD"

    def test_long_symbol_truncated(self):
        pid = ArbScanSkill._generate_pair_id("VERYLONGSYMBOLNAME", "Q", "0x1234")
        assert pid.startswith("VERYLONGSY_Q_")  # truncated to 10

    def test_empty_address(self):
        pid = ArbScanSkill._generate_pair_id("A", "B", "")
        assert pid == "A_B_000000"


class TestParsePairName:
    def test_slash_separator(self):
        assert ArbScanSkill._parse_pair_name("WBNB / USDT") == ("WBNB", "USDT")

    def test_no_space_slash(self):
        assert ArbScanSkill._parse_pair_name("CAKE/BNB") == ("CAKE", "BNB")

    def test_dash_separator(self):
        assert ArbScanSkill._parse_pair_name("ETH - USDC") == ("ETH", "USDC")

    def test_single_token(self):
        assert ArbScanSkill._parse_pair_name("WBNB") == ("WBNB", "UNK")

    def test_empty(self):
        assert ArbScanSkill._parse_pair_name("") == ("UNK", "UNK")


# ── 质量评分 ─────────────────────────────────────────

class TestQualityScoring:
    def _make_skill(self):
        with patch("toolloop_arb_scan.GeckoTerminalClient"), \
             patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            return ArbScanSkill(config={"output_root": "/tmp/test_scan"})

    def test_strong_quality(self):
        skill = self._make_skill()
        signals = [
            {"type": "price_divergence", "strength": 80},
            {"type": "volume_spike", "strength": 60},
            {"type": "lp_imbalance", "strength": 50},
        ]
        q, s = skill._score_quality(signals, None, 1_500_000, 600_000)
        assert q == "strong"
        assert s >= 70

    def test_moderate_quality(self):
        skill = self._make_skill()
        signals = [{"type": "volume_spike", "strength": 70}]
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
        with patch("toolloop_arb_scan.GeckoTerminalClient"), \
             patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            return ArbScanSkill(config={"output_root": str(output_root)})

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
        assert (result / "signal_packet.yml").exists()
        assert (result / "pool_hints.yml").exists()
        assert (result / "raw_snapshot.json").exists()

        # 注册表更新
        assert skill.registry.exists("WBNB_USDT_0x58F8")

    def test_persist_without_raw_snapshot(self, tmp_path):
        skill = self._make_skill(tmp_path)
        asset = PoolAsset(pair_id="A_B_0x0000", pool_address="0x0000")
        packet = SignalPacket(pair_id="A_B_0x0000")

        result = skill.persist_asset(asset, packet)
        assert (result / "signal_packet.yml").exists()
        assert (result / "pool_hints.yml").exists()
        assert not (result / "raw_snapshot.json").exists()

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

        with open(tmp_path / "pending" / "X_Y_0xABCD" / "signal_packet.yml") as f:
            data = yaml.safe_load(f)
        assert data["pair_id"] == "X_Y_0xABCD"
        assert data["decision"]["quality"] == "strong"


# ── Discovery ────────────────────────────────────────

class TestDiscovery:
    def _make_skill(self, tmp_path):
        gecko_mock = MagicMock()
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xAAA1aaa1aaa1aaa1", "name": "TOKEN_A / USDT", "dex_id": "pancake"},
            {"address": "0xBBB2bbb2bbb2bbb2", "name": "TOKEN_B / BNB", "dex_id": "biswap"},
        ])
        gecko_mock._get = AsyncMock(return_value={"data": [
            {"attributes": {"address": "0xCCC3ccc3ccc3ccc3", "name": "NEW / USDC"}},
        ]})
        with patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
                "gecko_client": gecko_mock,
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
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xSAMEsameSAMEsame", "name": "DUP / USDT"},
        ])
        gecko_mock._get = AsyncMock(return_value={"data": [
            {"attributes": {"address": "0xSAMEsameSAMEsame", "name": "DUP / USDT"}},
        ]})
        with patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
                "gecko_client": gecko_mock,
                "output_root": str(tmp_path),
            })
        pools = _run(skill.discover_pools())
        addrs = [p.pool_address for p in pools]
        assert addrs.count("0xSAMEsameSAMEsame") == 1  # deduped

    def test_skip_terminal_pools(self, tmp_path):
        gecko_mock = MagicMock()
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xTERMtermTERMterm", "name": "DEAD / USDT"},
        ])
        gecko_mock._get = AsyncMock(return_value={"data": []})
        with patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
                "gecko_client": gecko_mock,
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
        with patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
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
        gecko_mock._get = AsyncMock(return_value={"data": []})
        with patch("toolloop_arb_scan.DataFusion"), \
             patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
                "gecko_client": gecko_mock,
                "output_root": str(tmp_path),
            })
        outcome = _run(skill.run())
        assert outcome.status == "partial"
        assert outcome.reason_code == "no_candidates"

    def test_run_with_quality_pools(self, tmp_path):
        gecko_mock = MagicMock()
        gecko_mock.get_trending_pools = AsyncMock(return_value=[
            {"address": "0xQUALqualQUALqual", "name": "GOOD / USDT", "dex_id": "pancake"},
        ])
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

        with patch("toolloop_arb_scan._load_default_thresholds", return_value={}):
            skill = ArbScanSkill(config={
                "gecko_client": gecko_mock,
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
        assert (pending / "signal_packet.yml").exists()
        assert (pending / "pool_hints.yml").exists()


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
        o = ScanOutcome()
        assert o.status == "success"
        assert o.pools_discovered == 0
