# Re-export from nexrur kernel — keeps relative imports working
from nexrur.core.policy import *  # noqa: F401,F403
from nexrur.core.policy import PlatformPolicy as _KernelPlatformPolicy  # noqa: F401
from pathlib import Path
from typing import Any

_AGV_POLICY_YML = Path(__file__).resolve().parent / "policy.yml"


class PlatformPolicy(_KernelPlatformPolicy):
    """AGV adapter: default to consumer's policy.yml, preserve extra sections."""

    def __init__(self, policy_path: Path | None = None):
        super().__init__(policy_path or _AGV_POLICY_YML)

    def _load(self) -> dict[str, Any]:
        """Load config preserving AGV-specific top-level sections (safety, gate, outcome_reason_codes)."""
        base = super()._load()
        # Re-read raw YAML to pick up sections the kernel drops
        if self.policy_path and self.policy_path.exists():
            try:
                import yaml
                raw = yaml.safe_load(self.policy_path.read_text(encoding="utf-8")) or {}
                for key in ("safety", "gate", "outcome_reason_codes"):
                    if key in raw:
                        base[key] = raw[key]
            except Exception:
                pass
        return base
