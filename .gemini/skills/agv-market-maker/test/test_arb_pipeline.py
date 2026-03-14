"""Arb-Campaign 管线结构测试"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.toolloop_arb import ArbCampaignLoop, RETREAT_LEVELS

# scan 子模块
SCAN_SCRIPTS_DIR = ROOT_DIR / "modules" / "scan" / "scripts"
sys.path.insert(0, str(SCAN_SCRIPTS_DIR))

from skill_scan import ScanSkill


class TestArbPipelineStructure:
    """验证 5 步管线的结构完整性"""

    def test_steps_ordered(self):
        assert ArbCampaignLoop.STEPS == ["scan", "curate", "dataset", "execute", "fix"]

    def test_scan_skill_signal_types(self):
        assert "price_divergence" in ScanSkill.SIGNAL_TYPES
        assert "whale_movement" in ScanSkill.SIGNAL_TYPES

    def test_scan_skill_init(self):
        skill = ScanSkill()
        assert skill._ctx is None
        assert len(ScanSkill.SIGNAL_TYPES) == 5

    def test_retreat_levels(self):
        assert "A" in RETREAT_LEVELS
        assert "B" in RETREAT_LEVELS
        assert "C" in RETREAT_LEVELS
        assert RETREAT_LEVELS["A"]["target_step"] == "execute"
        assert RETREAT_LEVELS["B"]["target_step"] == "curate"
        assert RETREAT_LEVELS["C"]["target_step"] == "scan"
        # A 级无 LLM
        assert RETREAT_LEVELS["A"]["llm"] is False

    def test_arb_loop_init(self):
        loop = ArbCampaignLoop()
        assert loop.config == {}

    def test_arb_loop_has_run_cycle(self):
        loop = ArbCampaignLoop()
        assert hasattr(loop, "run_cycle")
        assert hasattr(loop, "run_campaign")
        assert hasattr(loop, "pre_flight")
