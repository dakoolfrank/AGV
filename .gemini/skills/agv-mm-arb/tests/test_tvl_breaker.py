"""TVLBreaker 单元测试"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.toolloop_common import TVLBreaker, TVLState


class TestTVLBreaker:
    def setup_method(self):
        self.breaker = TVLBreaker(
            min_tvl_usd=30.0,
            warn_tvl_usd=80.0,
            recover_tvl_usd=100.0,
            critical_reserve_ratio=0.10,
        )

    def test_normal_state(self):
        state = self.breaker.evaluate(tvl_usd=150.0, reserve_a=500, reserve_b=500)
        assert state == TVLState.NORMAL
        assert self.breaker.allows_mm()
        assert self.breaker.allows_arb()
        assert self.breaker.allows_trade()

    def test_reduce_activity(self):
        state = self.breaker.evaluate(tvl_usd=50.0, reserve_a=500, reserve_b=500)
        assert state == TVLState.REDUCE_ACTIVITY
        assert self.breaker.allows_mm()
        assert not self.breaker.allows_arb()
        assert self.breaker.allows_trade()

    def test_halt_all_low_tvl(self):
        state = self.breaker.evaluate(tvl_usd=20.0, reserve_a=500, reserve_b=500)
        assert state == TVLState.HALT_ALL
        assert not self.breaker.allows_mm()  # monitor_only
        assert not self.breaker.allows_arb()
        assert not self.breaker.allows_trade()

    def test_halt_all_critical_reserve(self):
        # 单侧 reserve < 10%
        state = self.breaker.evaluate(tvl_usd=200.0, reserve_a=5, reserve_b=95)
        assert state == TVLState.HALT_ALL
        assert self.breaker.halt_reason is not None
        assert "reserve ratio" in self.breaker.halt_reason

    def test_recover_needs_higher_threshold(self):
        # 先降级
        self.breaker.evaluate(tvl_usd=50.0, reserve_a=500, reserve_b=500)
        assert self.breaker.state == TVLState.REDUCE_ACTIVITY

        # TVL 回到 90（> warn 但 < recover）→ 保持 REDUCE
        self.breaker.evaluate(tvl_usd=90.0, reserve_a=500, reserve_b=500)
        assert self.breaker.state == TVLState.REDUCE_ACTIVITY

        # TVL 回到 110（> recover）→ 恢复 NORMAL
        self.breaker.evaluate(tvl_usd=110.0, reserve_a=500, reserve_b=500)
        assert self.breaker.state == TVLState.NORMAL

    def test_zero_reserves(self):
        # 两侧 reserve 都是 0 → 不触发 reserve_ratio check（除零保护）
        state = self.breaker.evaluate(tvl_usd=200.0, reserve_a=0, reserve_b=0)
        assert state == TVLState.NORMAL
