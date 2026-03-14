"""SlippageGuard 单元测试"""
from __future__ import annotations

import asyncio

import sys
from pathlib import Path

# 确保 modules 可导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.toolloop_mm import SlippageGuard


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestSlippageGuard:
    def setup_method(self):
        self.guard = SlippageGuard(max_slippage_pct=0.02)

    def test_pass_within_threshold(self):
        result = _run(self.guard.check(
            amount_in=1000, expected_out=985, ideal_out=1000,
        ))
        assert result["passed"] is True
        assert result["actual_slippage"] < 0.02

    def test_fail_over_threshold(self):
        result = _run(self.guard.check(
            amount_in=1000, expected_out=970, ideal_out=1000,
        ))
        assert result["passed"] is False
        assert "slippage" in result["reason"]

    def test_fail_ideal_zero(self):
        result = _run(self.guard.check(
            amount_in=1000, expected_out=980, ideal_out=0,
        ))
        assert result["passed"] is False

    def test_just_under_threshold_passes(self):
        # Slightly under 2% → passes (floating-point safe)
        result = _run(self.guard.check(
            amount_in=1000, expected_out=981, ideal_out=1000,
        ))
        assert result["passed"] is True
        assert result["actual_slippage"] < 0.02

    def test_min_amount_out_calculated(self):
        result = _run(self.guard.check(
            amount_in=1000, expected_out=990, ideal_out=1000,
        ))
        assert result["passed"] is True
        assert "min_amount_out" in result
        assert result["min_amount_out"] > 0
