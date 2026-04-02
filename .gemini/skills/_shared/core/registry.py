"""
AGV AssetRegistry + 物理归档 — 对标 WQ-YI registry.py

设计对齐:
- WQ-YI 用 abbreviation (AGAP) 做 key，AGV 用 pair_id (WBNB_USDT) 做 key
- WQ-YI 有 5 段归档链 (collect/curate/dataset×2/evaluate×2)
- AGV 有 4 段归档链 (collect/curate/dataset/execute)
- 归档方向: working_dir/{PAIR}/ → archived/{PAIR}/
- 反向操作: archived/{PAIR}/ → working_dir/{PAIR}/（revive）

4 段归档链::

    collect/pending/{PAIR}/   → collect/archived/{PAIR}/
    curate/staged/{PAIR}/     → curate/archived/{PAIR}/
    dataset/output/{PAIR}/    → dataset/archived/{PAIR}/
    execute/output/{PAIR}/    → execute/archived/{PAIR}/
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# ── 目录布局 ──────────────────────────────────────────────
# (working_subdir, archived_subdir) — 相对于 .docs/ai-skills/{step}/
_ARCHIVE_SEGMENTS: list[tuple[str, str, str]] = [
    # (step_dir,  working_subdir, archived_subdir)
    ("collect",  "pending",  "archived"),
    ("curate",   "staged",   "archived"),
    ("dataset",  "output",   "archived"),
    ("execute",  "output",   "archived"),
]

AI_SKILLS_ROOT = Path(".docs/ai-skills")

# ── 终态枚举 ──────────────────────────────────────────────
TERMINAL_STATES = frozenset({
    "terminal_pass",
    "terminal_exhausted",
    "terminal_interrupt",
})


# ============================================================
# 辅助: 安全移动
# ============================================================

def _safe_move_dir(src: Path, dst: Path) -> None:
    """移动目录，目标存在则先删除"""
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


# ============================================================
# 物理归档 — 4 段链
# ============================================================

def _hard_archive_asset(
    pair_id: str,
    asset_root: Path,
) -> list[str]:
    """将一个 pair 的全部 4 段产物从 working 移到 archived/

    Returns:
        移动记录列表 (用于日志/审计)
    """
    moved: list[str] = []

    for step_dir, working_sub, archived_sub in _ARCHIVE_SEGMENTS:
        src = asset_root / AI_SKILLS_ROOT / step_dir / working_sub / pair_id
        dst = asset_root / AI_SKILLS_ROOT / step_dir / archived_sub / pair_id

        if not src.is_dir():
            continue
        try:
            _safe_move_dir(src, dst)
            moved.append(f"{step_dir}/{working_sub}/{pair_id} → {archived_sub}/{pair_id}")
            logger.info("[archive] %s/%s/%s → %s/%s",
                        step_dir, working_sub, pair_id, archived_sub, pair_id)
        except Exception as exc:
            logger.warning("[archive] 移动失败 %s/%s/%s: %s",
                           step_dir, working_sub, pair_id, exc)

    return moved


# ============================================================
# 物理恢复 (revive) — 4 段反向
# ============================================================

def _hard_unarchive_asset(
    pair_id: str,
    asset_root: Path,
) -> list[str]:
    """从 archived/ 恢复一个 pair 到 working 目录

    Returns:
        恢复记录列表
    """
    restored: list[str] = []

    for step_dir, working_sub, archived_sub in _ARCHIVE_SEGMENTS:
        src = asset_root / AI_SKILLS_ROOT / step_dir / archived_sub / pair_id
        dst = asset_root / AI_SKILLS_ROOT / step_dir / working_sub / pair_id

        if not src.is_dir():
            continue
        if dst.is_dir():
            logger.warning("[unarchive] 目标已存在，跳过: %s/%s/%s",
                           step_dir, working_sub, pair_id)
            continue
        try:
            _safe_move_dir(src, dst)
            restored.append(f"{step_dir}/{archived_sub}/{pair_id} → {working_sub}/{pair_id}")
            logger.info("[unarchive] %s/%s/%s → %s/%s",
                        step_dir, archived_sub, pair_id, working_sub, pair_id)
        except Exception as exc:
            logger.warning("[unarchive] 恢复失败 %s/%s/%s: %s",
                           step_dir, archived_sub, pair_id, exc)

    return restored


# ============================================================
# Campaign 级 finalize — 批量归档
# ============================================================

def campaign_finalize(
    asset_root: Path,
    campaign_status: str,
    *,
    all_pairs: list[str] | None = None,
    qualified_pairs: list[str] | None = None,
    trace_id: str | None = None,
) -> dict[str, Any]:
    """Campaign 结束后批量归档

    对标 WQ-YI ``campaign_finalize()``::

        completed → 达标的 → terminal_pass (不归档，留给 submit/fix)
                  → 未达标  → terminal_exhausted (归档)
        halted / budget_exhausted → 全部 terminal_exhausted (归档)

    Args:
        asset_root: 消费者根 (AGV)
        campaign_status: "completed" | "halted" | "budget_exhausted"
        all_pairs: 本次 campaign 涉及的全部 pair_id
        qualified_pairs: 达标的 pair_id（仅 completed 时有效）
        trace_id: 关联 trace

    Returns:
        归档摘要 dict
    """
    all_pairs = all_pairs or []
    qualified_pairs = set(qualified_pairs or [])

    summary: dict[str, Any] = {
        "terminal_pass": [],
        "terminal_exhausted": [],
        "archived": [],
        "trace_id": trace_id,
        "campaign_status": campaign_status,
    }

    for pair_id in all_pairs:
        if campaign_status == "completed" and pair_id in qualified_pairs:
            # 达标 — 不归档，留给 submit/fix
            summary["terminal_pass"].append(pair_id)
            logger.info("[finalize] %s → terminal_pass (不归档)", pair_id)
        else:
            # 未达标 / halted / budget_exhausted → 归档
            summary["terminal_exhausted"].append(pair_id)
            paths = _hard_archive_asset(pair_id, asset_root)
            if paths:
                summary["archived"].append({
                    "pair_id": pair_id,
                    "paths": paths,
                })
            logger.info("[finalize] %s → terminal_exhausted (已归档 %d 段)",
                        pair_id, len(paths))

    return summary


# ============================================================
# Pre-campaign 清理
# ============================================================

def pre_campaign_cleanup(
    asset_root: Path,
    *,
    keep_archived: bool = True,
) -> int:
    """新 Campaign 前清理 working 目录下的遗留文件

    对标 WQ-YI ``pre_campaign_cleanup()``。

    Args:
        asset_root: 消费者根 (AGV)
        keep_archived: 保留 archived/ 目录（默认 True）

    Returns:
        删除的文件数
    """
    removed = 0

    for step_dir, working_sub, _ in _ARCHIVE_SEGMENTS:
        working_root = asset_root / AI_SKILLS_ROOT / step_dir / working_sub
        if not working_root.is_dir():
            continue

        for item in list(working_root.rglob("*")):
            if item.is_file():
                item.unlink()
                removed += 1

        # 删空目录
        for d in sorted(working_root.rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()

    logger.info("[cleanup] 清理 %d 个遗留文件", removed)
    return removed


# ============================================================
# CLI: revive
# ============================================================

def revive_pairs(
    asset_root: Path,
    pairs: list[str],
) -> dict[str, list[str]]:
    """复活已归档的 pairs（archived → working）

    Args:
        asset_root: 消费者根 (AGV)
        pairs: 要复活的 pair_id 列表；["ALL"] 复活全部

    Returns:
        {pair_id: [恢复记录]}
    """
    result: dict[str, list[str]] = {}

    if pairs == ["ALL"]:
        # 扫描所有 archived/ 下的 pair 目录
        seen: set[str] = set()
        for step_dir, _, archived_sub in _ARCHIVE_SEGMENTS:
            arch_root = asset_root / AI_SKILLS_ROOT / step_dir / archived_sub
            if arch_root.is_dir():
                for child in arch_root.iterdir():
                    if child.is_dir():
                        seen.add(child.name)
        pairs = sorted(seen)

    for pair_id in pairs:
        paths = _hard_unarchive_asset(pair_id, asset_root)
        if paths:
            result[pair_id] = paths
            logger.info("[revive] %s: 恢复 %d 段", pair_id, len(paths))
        else:
            logger.info("[revive] %s: 无归档文件", pair_id)

    return result
