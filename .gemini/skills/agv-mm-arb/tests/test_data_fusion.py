"""DataFusion & SignalBus 结构测试（委托到 modules/collect/ 子模块）"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# 导入 collect 子模块
COLLECT_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "modules" / "collect" / "scripts"
sys.path.insert(0, str(COLLECT_SCRIPTS_DIR))

from skill_collect import DataFusion, GeckoTerminalClient, _safe_float
from toolloop_mm_collect import SignalBus


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class TestDataFusion:
    def test_init_with_none_clients(self):
        """DataFusion 可以在无客户端时初始化（降级模式）"""
        fusion = DataFusion(gecko_client=None, moralis_client=None)
        assert fusion.gecko is None
        assert fusion.moralis is None

    def test_stale_threshold_default(self):
        fusion = DataFusion()
        assert fusion.stale_threshold_seconds == 120.0

    def test_custom_stale_threshold(self):
        fusion = DataFusion(stale_threshold_seconds=60.0)
        assert fusion.stale_threshold_seconds == 60.0

    def test_fetch_merged_no_sources(self):
        """Both None → critical warning"""
        fusion = DataFusion()
        result = _run(fusion.fetch_merged(pool_address="0xABC"))
        assert any("CRITICAL" in w for w in result["warnings"])

    def test_detect_signals_returns_list(self):
        """Signals always returns a list"""
        mock_gecko = GeckoTerminalClient()
        mock_gecko.get_pool_info = AsyncMock(return_value={})
        mock_gecko.get_ohlcv = AsyncMock(return_value=[])
        mock_gecko.get_trades = AsyncMock(return_value=[])
        fusion = DataFusion(gecko_client=mock_gecko)
        signals = _run(fusion.detect_signals(pool_address="0x5558"))
        assert isinstance(signals, list)


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

    def test_publish_invokes_handler(self):
        bus = SignalBus()
        received = []

        async def handler(sig):
            received.append(sig["data"])

        bus.subscribe("test", handler)
        _run(bus.publish({"type": "test", "data": 42}))
        assert received == [42]


class TestSafeFloat:
    def test_normal(self):
        assert _safe_float("3.14") == 3.14

    def test_none(self):
        assert _safe_float(None) == 0.0

    def test_invalid(self):
        assert _safe_float("abc") == 0.0
