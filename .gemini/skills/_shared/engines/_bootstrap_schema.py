"""
AGV schema 注册 — 将 nexrur ToolLoop 的 schema 指向消费者的 tool_loop.yml

调用时机：
  - conftest.py（测试）: import _shared.engines._bootstrap_schema
  - 各 toolloop_*.py（生产）: 在首次调用 get_tool_specs_from_schema() 前

幂等：重复导入安全。

TODO: AGV 引入 ToolLoop 后，取消下方注释并创建 tool_loop.yml
"""
from __future__ import annotations

from pathlib import Path

_AGV_SCHEMA = Path(__file__).resolve().parent / "tool_loop.yml"
_registered = False


def ensure_registered() -> None:
    """幂等注册 AGV 的 tool_loop.yml 和步骤名映射。

    当前为空壳 — tool_loop.yml 尚未创建，注册会静默跳过。
    AGV 引入 ToolLoop 后：
      1. 在 engines/ 下创建 tool_loop.yml（定义各步可用工具规格）
      2. 按需添加 register_step_name_map() 映射
    """
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
            # 示例：如果 AGV 步骤名与 schema key 不同，在此映射
            # register_step_name_map({
            #     "execute": "mm_execute",
            # })
        _registered = True
    except ImportError:
        pass


# 模块导入时自动注册
ensure_registered()
