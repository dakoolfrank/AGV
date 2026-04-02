"""collect 子模块单元测试"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# 确保 collect scripts 可导入
COLLECT_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "collect" / "scripts"
sys.path.insert(0, str(COLLECT_SCRIPTS_DIR))

from skill_collect import (
    DataFusion,
    GeckoTerminalClient,
    MoralisClient,
    CollectSkill,
    _TokenBucket,
    _TTLCache,
    _parse_jsonapi_data,
    _parse_jsonapi_single,
    _make_signal,
    _safe_float,
)
from toolloop_mm_collect import SignalBus, CollectLoop


def _run(coro):
    """Helper: run async coroutine synchronously"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ── TokenBucket ──────────────────────────────────────

class TestTokenBucket:
    def test_initial_tokens(self):
        bucket = _TokenBucket(rate=30)
        assert bucket._rate == 30
        assert bucket._tokens == 30.0

    def test_acquire_decrements(self):
        bucket = _TokenBucket(rate=30)
        _run(bucket.acquire())
        assert bucket._tokens < 30.0


# ── TTLCache ─────────────────────────────────────────

class TestTTLCache:
    def test_get_miss(self):
        cache = _TTLCache()
        assert cache.get("nokey") is None

    def test_put_and_get(self):
        cache = _TTLCache()
        cache.put("k1", {"data": 1}, ttl=60.0)
        assert cache.get("k1") == {"data": 1}

    def test_expired_entry(self):
        cache = _TTLCache()
        cache.put("k2", "val", ttl=0.0)  # expires immediately
        assert cache.get("k2") is None


# ── JSON:API Parsing ─────────────────────────────────

class TestJsonApiParsing:
    def test_parse_list(self):
        raw = {"data": [
            {"attributes": {"name": "pool1"}},
            {"attributes": {"name": "pool2"}},
        ]}
        result = _parse_jsonapi_data(raw)
        assert len(result) == 2
        assert result[0]["name"] == "pool1"

    def test_parse_single(self):
        raw = {"data": {"attributes": {"price": "0.005"}}}
        result = _parse_jsonapi_single(raw)
        assert result["price"] == "0.005"

    def test_parse_single_with_dex_relationship(self):
        """Q6: _parse_jsonapi_single 应从 relationships.dex 提取 dex_id"""
        raw = {
            "data": {
                "attributes": {"price": "1.23", "name": "TOKEN/USDT"},
                "relationships": {
                    "dex": {"data": {"id": "pancakeswap_v3", "type": "dex"}},
                    "base_token": {"data": {"id": "bsc_0xabc"}},
                },
            }
        }
        result = _parse_jsonapi_single(raw)
        assert result["price"] == "1.23"
        assert result["dex_id"] == "pancakeswap_v3"

    def test_parse_single_no_dex_relationship(self):
        """Q6: 无 relationships 时 dex_id 不注入"""
        raw = {"data": {"attributes": {"price": "0.5"}}}
        result = _parse_jsonapi_single(raw)
        assert "dex_id" not in result

    def test_parse_pools_with_dex_relationship(self):
        """Q6: _parse_jsonapi_pools 应从 relationships.dex 提取 dex_id（列表）"""
        from skill_collect import _parse_jsonapi_pools
        raw = {"data": [
            {
                "attributes": {"name": "WBNB/USDT"},
                "relationships": {
                    "dex": {"data": {"id": "thena_v1", "type": "dex"}},
                },
            },
            {
                "attributes": {"name": "ETH/USDT"},
                "relationships": {},
            },
        ]}
        result = _parse_jsonapi_pools(raw)
        assert len(result) == 2
        assert result[0]["dex_id"] == "thena_v1"
        assert "dex_id" not in result[1]

    def test_parse_empty(self):
        assert _parse_jsonapi_data({}) == []
        assert _parse_jsonapi_data({"data": None}) == []

    def test_parse_single_no_data(self):
        raw = {"error": "not found"}
        result = _parse_jsonapi_single(raw)
        assert result == raw


# ── Helper Functions ─────────────────────────────────

class TestHelpers:
    def test_safe_float_normal(self):
        assert _safe_float("3.14") == 3.14
        assert _safe_float(42) == 42.0

    def test_safe_float_none(self):
        assert _safe_float(None) == 0.0

    def test_safe_float_invalid(self):
        assert _safe_float("abc") == 0.0

    def test_make_signal(self):
        sig = _make_signal("volume_spike", "0xABC", 1000.0,
                           strength=75.5, source="gecko", details={"x": 1})
        assert sig["type"] == "volume_spike"
        assert sig["pool_address"] == "0xABC"
        assert sig["strength"] == 75.5
        assert sig["source"] == "gecko"


# ── GeckoTerminalClient ─────────────────────────────

class TestGeckoTerminalClient:
    def test_base_url(self):
        client = GeckoTerminalClient()
        assert "geckoterminal" in client.BASE_URL

    def test_rate_limit_default(self):
        client = GeckoTerminalClient()
        assert client.rate_limit == 30

    def test_cache_key_deterministic(self):
        client = GeckoTerminalClient()
        k1 = client._cache_key("ohlcv", "bsc", "0xABC")
        k2 = client._cache_key("ohlcv", "bsc", "0xABC")
        assert k1 == k2
        assert len(k1) == 16

    def test_cache_ttl_values(self):
        assert GeckoTerminalClient.CACHE_TTL_OHLCV == 60
        assert GeckoTerminalClient.CACHE_TTL_POOL_INFO == 300
        assert GeckoTerminalClient.CACHE_TTL_TRENDING == 600

    def test_get_ohlcv_with_mock_session(self):
        """Mock aiohttp session → parse OHLCV bars"""
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={
            "data": {
                "id": "ohlcv",
                "type": "ohlcv",
                "attributes": {
                    "ohlcv_list": [
                        [1710000000, "0.005", "0.0055", "0.0048", "0.0050", "120.5"],
                        [1710000300, "0.0050", "0.0052", "0.0049", "0.0051", "80.3"],
                    ]
                }
            }
        })
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)

        client = GeckoTerminalClient(session=mock_session)
        result = _run(client.get_ohlcv(pool_address="0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"))

        assert len(result) == 2
        assert result[0]["open"] == 0.005
        assert result[0]["close"] == 0.005
        assert result[1]["volume_usd"] == 80.3

    def test_get_pool_info_with_mock(self):
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={
            "data": {
                "attributes": {
                    "name": "pGVT / USDT",
                    "base_token_price_usd": "0.005",
                    "reserve_in_usd": "100.0",
                }
            }
        })
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)

        client = GeckoTerminalClient(session=mock_session)
        result = _run(client.get_pool_info(pool_address="0x5558"))

        assert result["name"] == "pGVT / USDT"
        assert result["base_token_price_usd"] == "0.005"

    def test_get_trades_with_mock(self):
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={
            "data": [
                {"attributes": {"volume_in_usd": "50.0", "kind": "buy"}},
                {"attributes": {"volume_in_usd": "30.0", "kind": "sell"}},
            ]
        })
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)

        client = GeckoTerminalClient(session=mock_session)
        result = _run(client.get_trades(pool_address="0x5558"))
        assert len(result) == 2
        assert result[0]["volume_in_usd"] == "50.0"

    def test_ohlcv_cache_hit(self):
        """Second call should hit cache, not make HTTP request"""
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={
            "data": {"attributes": {"ohlcv_list": [[1, "1", "2", "0.5", "1.5", "100"]]}}
        })
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)

        client = GeckoTerminalClient(session=mock_session)
        _run(client.get_ohlcv(pool_address="0xCACHE"))
        _run(client.get_ohlcv(pool_address="0xCACHE"))
        # session.get called only once (second is cache hit)
        assert mock_session.get.call_count == 1


# ── MoralisClient ────────────────────────────────────

class TestMoralisClient:
    def test_init_no_key(self):
        client = MoralisClient()
        assert client._api_key == ""

    def test_init_with_key(self):
        client = MoralisClient(api_key="test_key")
        assert client._api_key == "test_key"

    def test_base_url(self):
        assert "moralis" in MoralisClient.BASE_URL.lower()

    def test_get_without_key_raises(self):
        client = MoralisClient(api_key="")
        try:
            _run(client.get_transfers(token_address="0xABC"))
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "API key" in str(e)

    def test_get_transfers_with_mock(self):
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={
            "result": [
                {"transaction_hash": "0x1", "value": "1000000"},
                {"transaction_hash": "0x2", "value": "5000000"},
            ]
        })
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)

        client = MoralisClient(api_key="test_key", session=mock_session)
        result = _run(client.get_transfers(token_address="0xABC"))
        assert len(result) == 2


# ── DataFusion ───────────────────────────────────────

class TestDataFusion:
    def test_init_with_none_clients(self):
        fusion = DataFusion(gecko_client=None, moralis_client=None)
        assert fusion.gecko is None
        assert fusion.moralis is None

    def test_stale_threshold_default(self):
        fusion = DataFusion()
        assert fusion.stale_threshold_seconds == 120.0

    def test_custom_stale_threshold(self):
        fusion = DataFusion(stale_threshold_seconds=60.0)
        assert fusion.stale_threshold_seconds == 60.0

    def test_price_divergence_threshold(self):
        assert DataFusion.PRICE_DIVERGENCE_THRESHOLD == 0.01

    def test_fetch_merged_both_sources_down(self):
        """Both sources None → warnings"""
        fusion = DataFusion(gecko_client=None, moralis_client=None)
        result = _run(fusion.fetch_merged(pool_address="0xABC"))
        assert result["source_status"]["gecko"] is False
        assert result["source_status"]["moralis"] is False

    def test_fetch_merged_gecko_only(self):
        """Gecko returns data, Moralis not configured → degraded"""
        mock_gecko = GeckoTerminalClient()
        mock_gecko.get_pool_info = AsyncMock(return_value={"name": "test"})
        mock_gecko.get_ohlcv = AsyncMock(return_value=[{"close": 0.005}])
        mock_gecko.get_trades = AsyncMock(return_value=[{"volume_in_usd": "10"}])

        fusion = DataFusion(gecko_client=mock_gecko, moralis_client=None)
        result = _run(fusion.fetch_merged(pool_address="0x5558"))
        assert result["source_status"]["gecko"] is True
        assert result["source_status"]["moralis"] is False
        assert result["pool_info"]["name"] == "test"

    def test_detect_signals_volume_spike(self):
        """Volume spike detection with mock data"""
        mock_gecko = GeckoTerminalClient()
        mock_gecko.get_pool_info = AsyncMock(return_value={
            "volume_usd": "28800",   # 28800 USD / 24h → 100/5min window
            "base_token_price_usd": "0.005",
        })
        mock_gecko.get_ohlcv = AsyncMock(return_value=[
            {"close": 0.005, "timestamp": 1710000000},
        ])
        # 20 trades with 50 USD each = 1000 total vs 100 avg = 10x spike
        mock_gecko.get_trades = AsyncMock(return_value=[
            {"volume_in_usd": "50"} for _ in range(20)
        ])

        fusion = DataFusion(gecko_client=mock_gecko)
        signals = _run(fusion.detect_signals(pool_address="0x5558"))
        volume_sigs = [s for s in signals if s["type"] == "volume_spike"]
        assert len(volume_sigs) == 1
        assert volume_sigs[0]["strength"] > 5.0


# ── CollectSkill ────────────────────────────────────────

class TestCollectSkill:
    def test_signal_types(self):
        assert "price_divergence" in CollectSkill.SIGNAL_TYPES
        assert "whale_movement" in CollectSkill.SIGNAL_TYPES
        assert len(CollectSkill.SIGNAL_TYPES) == 5

    def test_init_default(self):
        skill = CollectSkill()
        assert skill._ctx is None
        assert skill.config == {}

    def test_known_tokens(self):
        assert "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0" in CollectSkill.KNOWN_TOKENS
        assert "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d" in CollectSkill.KNOWN_TOKENS

    def test_init_creates_gecko_client(self):
        skill = CollectSkill()
        assert isinstance(skill._gecko, GeckoTerminalClient)

    def test_run_delegates_to_fusion(self):
        """CollectSkill.run delegates to DataFusion.detect_signals"""
        mock_fusion = DataFusion()
        mock_fusion.detect_signals = AsyncMock(return_value=[
            {"type": "volume_spike", "strength": 10}
        ])
        skill = CollectSkill()
        skill._fusion = mock_fusion
        result = _run(skill.run("0x5558"))
        assert len(result) == 1
        assert result[0]["type"] == "volume_spike"

    def test_collect_all_pools_aggregates(self):
        """collect_all_pools collects signals from multiple pools"""
        mock_fusion = DataFusion()
        mock_fusion.detect_signals = AsyncMock(return_value=[
            {"type": "lp_imbalance", "strength": 50}
        ])
        mock_gecko = GeckoTerminalClient()
        mock_gecko.get_trending_pools = AsyncMock(return_value=[])

        skill = CollectSkill()
        skill._fusion = mock_fusion
        skill._gecko = mock_gecko
        result = _run(skill.collect_all_pools(["0xAAA", "0xBBB"]))
        # 2 pools × 1 signal each = 2 signals
        assert len(result) == 2


# ── SignalBus ────────────────────────────────────────

class TestSignalBus:
    def test_subscribe_and_no_error(self):
        bus = SignalBus()
        called = []

        async def handler(sig):
            called.append(sig)

        bus.subscribe("price_divergence", handler)
        assert "price_divergence" in bus._subscribers

    def test_multiple_subscribers(self):
        bus = SignalBus()

        async def h1(sig): pass
        async def h2(sig): pass

        bus.subscribe("volume_spike", h1)
        bus.subscribe("volume_spike", h2)
        assert len(bus._subscribers["volume_spike"]) == 2

    def test_publish_and_drain(self):
        bus = SignalBus()
        received = []

        async def handler(sig):
            received.append(sig)

        bus.subscribe("test_type", handler)
        _run(bus.publish({"type": "test_type", "data": 123}))
        assert len(received) == 1
        drained = _run(bus.drain())
        assert len(drained) == 1
        assert drained[0]["data"] == 123


# ── CollectLoop ─────────────────────────────────────────

class TestCollectLoop:
    def test_init_default_interval(self):
        loop = CollectLoop()
        assert loop._interval == 60.0

    def test_init_custom_interval(self):
        loop = CollectLoop(interval_seconds=30.0)
        assert loop._interval == 30.0

    def test_run_once_no_skill_raises(self):
        loop = CollectLoop()
        try:
            _run(loop.run_once([]))
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "collect_skill not configured" in str(e)

    def test_degraded_interval(self):
        loop = CollectLoop(interval_seconds=60.0, degraded_interval=300.0,
                        max_noop_before_degrade=5)
        assert loop.current_interval == 60.0
        loop._noop_count = 5
        assert loop.current_interval == 300.0

    def test_run_once_increments_cycle(self):
        mock_skill = MagicMock()
        mock_skill.collect_all_pools = AsyncMock(return_value=[])
        loop = CollectLoop(collect_skill=mock_skill)
        _run(loop.run_once(["0xABC"]))
        assert loop._cycle_count == 1
        assert loop._noop_count == 1

    def test_run_once_resets_noop_on_signals(self):
        mock_skill = MagicMock()
        mock_skill.collect_all_pools = AsyncMock(return_value=[
            {"type": "volume_spike", "strength": 10}
        ])
        bus = SignalBus()
        loop = CollectLoop(collect_skill=mock_skill, signal_bus=bus)
        loop._noop_count = 10
        _run(loop.run_once(["0xABC"]))
        assert loop._noop_count == 0

    def test_stop_flag(self):
        loop = CollectLoop()
        assert loop._running is False
        loop._running = True
        loop.stop()
        assert loop._running is False
