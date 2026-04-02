# AGV adapter: core 子包
# outcome, policy, evidence 均通过 re-export + 注入 覆盖 nexrur 内核

from .registry import (  # noqa: F401
    campaign_finalize,
    pre_campaign_cleanup,
    revive_pairs,
    _hard_archive_asset,
    _hard_unarchive_asset,
)
