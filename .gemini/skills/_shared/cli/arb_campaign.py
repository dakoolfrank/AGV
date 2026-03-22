"""
AGV Arb Campaign CLI — 对标 WQ-YI alphas_campaign.py

用法::

    # 模拟模式（默认）
    python -m _shared.cli.arb_campaign --simulate

    # 指定 pair
    python -m _shared.cli.arb_campaign --simulate --pair pGVT_USDT

    # 查看状态
    python -m _shared.cli.arb_campaign --status

    # 清理产物
    python -m _shared.cli.arb_campaign --cleanup

    # 从 YAML 配置启动
    python -m _shared.cli.arb_campaign --config campaign.yml
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
import time
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# 产物目录
ARTIFACT_ROOTS = [
    ".docs/ai-skills/collect",
    ".docs/ai-skills/curate",
    ".docs/ai-skills/dataset",
    ".docs/ai-skills/execute",
]


def _find_workspace() -> Path:
    """向上查找 AGV 工作区根目录"""
    cwd = Path.cwd()
    for p in [cwd, *cwd.parents]:
        if (p / "AGENTS.md").exists() and (p / "agvprotocol-contracts-main").exists():
            return p
    return cwd


def _resolve_default_config() -> Path | None:
    """查找同目录的 arb_campaign.yml（对标 WQ-YI _resolve_config_path）"""
    default = Path(__file__).parent / "arb_campaign.yml"
    return default if default.is_file() else None


def _load_yaml(path: Path) -> dict[str, Any]:
    """加载 YAML 配置"""
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def build_configs(raw: dict[str, Any]) -> dict[str, Any]:
    """将 3/5 段 YAML 合并为扁平 config dict.

    arb_campaign.yml 有 goal/campaign/safety/orchestrator/diagnosis 五段。
    本函数将它们合并为一个扁平字典（goal 优先，campaign/safety 等按 key 补充）。
    """
    goal = dict(raw.get("goal", {}) or {})
    campaign = dict(raw.get("campaign", {}) or {})
    safety = dict(raw.get("safety", {}) or {})
    orch = dict(raw.get("orchestrator", {}) or {})
    diag = dict(raw.get("diagnosis", {}) or {})

    merged: dict[str, Any] = {}
    merged.update(campaign)
    merged.update(goal)  # goal 覆盖 campaign 同名 key
    if safety:
        merged["safety"] = safety
    if orch:
        merged["orchestrator"] = orch
    if diag:
        merged["diagnosis"] = diag
    return merged


def _cleanup(workspace: Path) -> int:
    """清理产物目录（保留 abbreviations.yml）"""
    removed = 0
    for root_rel in ARTIFACT_ROOTS:
        root = workspace / root_rel
        if not root.is_dir():
            continue
        for item in root.rglob("*"):
            if item.is_file() and item.name != "abbreviations.yml":
                item.unlink()
                removed += 1
        # 删除空目录
        for d in sorted(root.rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    return removed


def _status(workspace: Path) -> dict[str, Any]:
    """扫描产物目录，返回摘要"""
    info: dict[str, Any] = {}
    for root_rel in ARTIFACT_ROOTS:
        root = workspace / root_rel
        step = root_rel.split("/")[-1]
        if root.is_dir():
            files = list(root.rglob("*"))
            info[step] = {
                "files": len([f for f in files if f.is_file()]),
                "dirs": len([f for f in files if f.is_dir()]),
            }
        else:
            info[step] = {"files": 0, "dirs": 0}
    return info


def _run_campaign(
    workspace: Path,
    config: dict[str, Any],
    simulate: bool = True,
) -> dict[str, Any]:
    """执行 Arb Campaign (collect→execute) — WQ-YI aligned

    架构: CampaignRunner 内部持有 Orchestrator (self.orch)
    """
    from _shared.engines._profiles import S5_ARB_PROFILE
    from _shared.engines.campaign import CampaignRunner, DEFAULT_ARB_CONFIG
    from _shared.engines.diagnosis import DiagnosisEngine, _load_campaign_prompts
    from _shared.clients import GeminiLLMClient

    # LLM 初始化（可选 — 降级为确定性模式）
    llm = GeminiLLMClient.from_settings_or_none()
    prompts = _load_campaign_prompts()

    # DiagnosisEngine
    diagnosis = DiagnosisEngine(
        llm=llm,
        prompts=prompts,
    )

    # Campaign 配置
    campaign_config = {**DEFAULT_ARB_CONFIG, **config}
    campaign_config["simulate"] = simulate

    # 构建 Orchestrator + 注册 Arb Ops
    from _shared.engines.agent_ops_arb import register_arb_ops
    from nexrur.engines import OpsRegistry, create_orchestrator

    ops_reg = OpsRegistry()
    register_arb_ops(ops_reg)

    orch = create_orchestrator(
        workspace=workspace,
        profile=S5_ARB_PROFILE,
        ops_registry=ops_reg,
    )

    # CampaignRunner — 注入 Orchestrator (WQ-YI 对齐)
    runner = CampaignRunner(
        profile=S5_ARB_PROFILE,
        config=campaign_config,
        diagnosis_engine=diagnosis,
        orchestrator=orch,
    )

    logger.info(
        "启动 Arb Campaign: simulate=%s, workspace=%s",
        simulate, workspace,
    )

    result = runner.run(goal_config=campaign_config, workspace=workspace)

    return result.to_dict()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="arb_campaign",
        description="AGV S5-Arb Campaign 管理工具",
    )
    parser.add_argument("--simulate", action="store_true", default=True,
                        help="模拟模式（默认）")
    parser.add_argument("--live", action="store_true",
                        help="实盘模式（覆盖 --simulate）")
    parser.add_argument("--config", type=str,
                        help="YAML 配置文件路径")
    parser.add_argument("--pair", type=str, default="pGVT_USDT",
                        help="交易对（默认 pGVT_USDT）")
    parser.add_argument("--max-cycles", type=int,
                        help="最大循环数")
    parser.add_argument("--cleanup", action="store_true",
                        help="清理产物目录")
    parser.add_argument("--status", action="store_true",
                        help="显示产物状态")
    parser.add_argument("--dry-run", action="store_true",
                        help="仅打印配置，不执行")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="详细日志")

    args = parser.parse_args(argv)

    # 日志
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    workspace = _find_workspace()

    # --cleanup
    if args.cleanup:
        removed = _cleanup(workspace)
        print(f"清理完成: 删除 {removed} 个文件")
        return 0

    # --status
    if args.status:
        info = _status(workspace)
        print(json.dumps(info, indent=2, ensure_ascii=False))
        return 0

    # 加载配置（优先 --config，否则使用同目录 arb_campaign.yml）
    config: dict[str, Any] = {}
    if args.config:
        raw = _load_yaml(Path(args.config))
        config = build_configs(raw) if any(k in raw for k in ("goal", "campaign")) else raw
    else:
        default_path = _resolve_default_config()
        if default_path:
            raw = _load_yaml(default_path)
            config = build_configs(raw)
            logger.info("加载默认配置: %s", default_path)

    if args.pair:
        config["pair"] = args.pair
    if args.max_cycles is not None:
        config["max_cycles"] = args.max_cycles

    simulate = not args.live

    # --dry-run
    if args.dry_run:
        print("=== Dry Run ===")
        print(f"workspace: {workspace}")
        print(f"simulate:  {simulate}")
        print(f"config:    {json.dumps(config, indent=2, ensure_ascii=False)}")
        return 0

    # 执行
    try:
        result = _run_campaign(workspace, config, simulate=simulate)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        logger.error("Campaign 执行失败: %s", exc, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
