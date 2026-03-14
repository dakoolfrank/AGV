"""MM-Campaign 确定性规则测试"""
from __future__ import annotations

import yaml
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


class TestMMRules:
    """验证 mm_rules.yml 结构完整性"""

    def setup_method(self):
        with open(KNOWLEDGE_DIR / "mm_rules.yml") as f:
            self.rules = yaml.safe_load(f)

    def test_price_deviation_thresholds_ordered(self):
        pd = self.rules["price_deviation"]
        assert pd["warn"] < pd["act"] < pd["emergency"]

    def test_whale_trade_thresholds_ordered(self):
        wt = self.rules["whale_trade"]
        assert wt["warn_pct"] < wt["emergency_pct"]

    def test_rebalance_max_amount_positive(self):
        assert self.rules["rebalance"]["max_amount_usd"] > 0

    def test_heartbeat_degraded_slower_than_normal(self):
        hb = self.rules["heartbeat"]
        assert hb["degraded_interval_seconds"] > hb["normal_interval_seconds"]

    def test_daily_limits_all_positive(self):
        dl = self.rules["daily_limits"]
        assert dl["max_gas_usd"] > 0
        assert dl["max_trades"] > 0
        assert dl["max_rebalance_usd"] > 0

    def test_state_transitions_contains_emergency(self):
        transitions = self.rules["state_transitions"]
        to_states = [t["to"] for t in transitions]
        assert "EMERGENCY" in to_states

    def test_state_transitions_all_have_trigger(self):
        for t in self.rules["state_transitions"]:
            assert "trigger" in t, f"Missing trigger in {t}"
