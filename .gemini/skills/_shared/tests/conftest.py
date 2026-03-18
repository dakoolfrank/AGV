"""AGV _shared 测试 conftest — 注册 AGV 域配置"""
import sys
from pathlib import Path

# 确保 _shared 可被 import
_skills_dir = Path(__file__).resolve().parents[2]  # .gemini/skills/
if str(_skills_dir) not in sys.path:
    sys.path.insert(0, str(_skills_dir))

# 注册 AGV outcome reason codes（幂等：outcome.py 模块级已执行一次）
try:
    import _shared.core.outcome  # noqa: F401
except ImportError:
    pass
