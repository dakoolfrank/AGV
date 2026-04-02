"""
AGV schema 注册

两层 schema：
  1. SchemaValidator（步骤产出校验）— schemas/ 目录下 5 个 YAML
  2. ToolLoop schema（工具规格）— engines/tool_loop.yml（待建）

调用时机：
  - conftest.py（测试）: import _shared.engines._bootstrap_schema
  - 各 Ops.__call__() 内部: get_agv_validator().validate(step, data)

幂等：重复导入安全。
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nexrur.core.validator import SchemaValidator

# ─── 路径 ───
_SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas"
_AGV_SCHEMA = Path(__file__).resolve().parent / "tool_loop.yml"

# ─── 单例 ───
_validator: SchemaValidator | None = None
_registered = False


def get_agv_validator() -> SchemaValidator:
    """获取 AGV 步骤产出 SchemaValidator 单例。

    指向 _shared/schemas/ 目录，包含 collect/curate/dataset/execute/fix 五个 YAML。
    """
    global _validator
    if _validator is None:
        from nexrur.core.validator import SchemaValidator
        _validator = SchemaValidator(schemas_dir=_SCHEMAS_DIR)
    return _validator


def validate_step_output(step: str, data: dict, *, strict: bool = False) -> dict:
    """便捷函数 — 校验步骤产出数据。

    Args:
        step: 步骤名（collect/curate/dataset/execute/fix）
        data: 待校验的 dict
        strict: True 抛 ValidationError, False 返回 report

    Returns:
        {"valid": bool, "errors": [...], "schema_source": "external"|"fallback"}
    """
    return get_agv_validator().validate(step, data, strict=strict)


def ensure_registered() -> None:
    """幂等注册 AGV 的 tool_loop.yml（ToolLoop 层 — 待建）。"""
    global _registered
    if _registered:
        return
    try:
        from nexrur.engines.tool_loop import (
            register_schema_file,
            register_step_name_map,  # noqa: F401 — 未来使用
        )
        if _AGV_SCHEMA.exists():
            register_schema_file(_AGV_SCHEMA)
        _registered = True
    except ImportError:
        pass


# 模块导入时自动注册
ensure_registered()
