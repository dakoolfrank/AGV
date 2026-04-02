"""tests/ conftest — 路径设置（Layer 1 mock pytest）"""
from __future__ import annotations

import sys
from pathlib import Path

# ── 路径设置 ──────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "scripts"))
sys.path.insert(0, str(ROOT_DIR.parent / "_shared" / "engines"))
