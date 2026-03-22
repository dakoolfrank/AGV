"""Phase 4 — 通知系统测试（TelegramNotifier / DiscordNotifier / NotifyRouter）"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ── path setup ──
SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from toolloop_mm import (
    TelegramNotifier,
    DiscordNotifier,
    NotifyRouter,
    _http_post_json,
)

# ════════════════════════════════════════════════════════
#  Helper
# ════════════════════════════════════════════════════════

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _mock_urlopen(response_json: dict = None, *, side_effect=None):
    """Mock urllib.request.urlopen returning a context manager."""
    resp_data = json.dumps(response_json or {"ok": True}).encode()
    mock_resp = MagicMock()
    mock_resp.read.return_value = resp_data
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)
    return patch(
        "toolloop_mm.urllib.request.urlopen",
        return_value=mock_resp,
        side_effect=side_effect,
    )


# ════════════════════════════════════════════════════════
#  _http_post_json
# ════════════════════════════════════════════════════════

class TestHttpPostJson:
    def test_sends_json_body(self):
        with _mock_urlopen({"ok": True}) as mock_open:
            result = _http_post_json("https://example.com/api", {"key": "val"})
        assert result == {"ok": True}
        call_args = mock_open.call_args
        req = call_args[0][0]
        assert req.get_method() == "POST"
        assert req.get_header("Content-type") == "application/json"
        assert json.loads(req.data) == {"key": "val"}

    def test_raises_on_network_error(self):
        import urllib.error
        with _mock_urlopen(side_effect=urllib.error.URLError("timeout")):
            with pytest.raises(urllib.error.URLError):
                _http_post_json("https://example.com/api", {})


# ════════════════════════════════════════════════════════
#  TelegramNotifier
# ════════════════════════════════════════════════════════

class TestTelegramNotifier:
    def test_skip_when_unconfigured(self):
        tg = TelegramNotifier()
        ok = _run(tg.send(title="test", body="hello"))
        assert ok is False

    def test_skip_when_no_token(self):
        tg = TelegramNotifier(chat_id="123")
        assert _run(tg.send(title="t", body="b")) is False

    def test_skip_when_no_chat_id(self):
        tg = TelegramNotifier(bot_token="tok")
        assert _run(tg.send(title="t", body="b")) is False

    def test_sends_html_message(self):
        tg = TelegramNotifier(bot_token="BOT_TOK", chat_id="CHAT_ID")
        with _mock_urlopen({"ok": True}) as mock_open:
            ok = _run(tg.send(title="Alert", body="Price dropped"))
        assert ok is True
        req = mock_open.call_args[0][0]
        assert "/botBOT_TOK/sendMessage" in req.full_url
        payload = json.loads(req.data)
        assert payload["chat_id"] == "CHAT_ID"
        assert payload["parse_mode"] == "HTML"
        assert "<b>Alert</b>" in payload["text"]
        assert "Price dropped" in payload["text"]

    def test_includes_data_as_pre_block(self):
        tg = TelegramNotifier(bot_token="tok", chat_id="cid")
        with _mock_urlopen({"ok": True}) as mock_open:
            _run(tg.send(title="T", body="B", data={"key": "val"}))
        payload = json.loads(mock_open.call_args[0][0].data)
        assert "<pre>" in payload["text"]
        assert "key: val" in payload["text"]

    def test_returns_false_on_network_error(self):
        import urllib.error
        tg = TelegramNotifier(bot_token="tok", chat_id="cid")
        with _mock_urlopen(side_effect=urllib.error.URLError("fail")):
            ok = _run(tg.send(title="T", body="B"))
        assert ok is False

    def test_format_no_data(self):
        tg = TelegramNotifier(bot_token="t", chat_id="c")
        text = tg._format("Title", "Body", None)
        assert text == "<b>Title</b>\nBody"


# ════════════════════════════════════════════════════════
#  DiscordNotifier
# ════════════════════════════════════════════════════════

class TestDiscordNotifier:
    def test_skip_when_unconfigured(self):
        dc = DiscordNotifier()
        ok = _run(dc.send(title="t", body="b"))
        assert ok is False

    def test_sends_embed(self):
        dc = DiscordNotifier(webhook_url="https://discord.com/api/webhooks/X/Y")
        with _mock_urlopen({"ok": True}) as mock_open:
            ok = _run(dc.send(title="Trade OK", body="USDT→pGVT"))
        assert ok is True
        payload = json.loads(mock_open.call_args[0][0].data)
        embed = payload["embeds"][0]
        assert embed["title"] == "Trade OK"
        assert embed["description"] == "USDT→pGVT"
        assert embed["color"] == 0x3498DB  # INFO default

    def test_embed_color_by_level(self):
        dc = DiscordNotifier(webhook_url="https://hook.example")
        with _mock_urlopen():
            _run(dc.send(title="T", body="B", level="CRITICAL"))
        with _mock_urlopen() as mock_open:
            _run(dc.send(title="T", body="B", level="WARNING"))
        payload = json.loads(mock_open.call_args[0][0].data)
        assert payload["embeds"][0]["color"] == 0xFFA500  # WARNING = orange

    def test_embed_fields_from_data(self):
        dc = DiscordNotifier(webhook_url="https://hook.example")
        with _mock_urlopen() as mock_open:
            _run(dc.send(title="T", body="B", data={"gas": "0.01", "pool": "0x123"}))
        embed = json.loads(mock_open.call_args[0][0].data)["embeds"][0]
        assert len(embed["fields"]) == 2
        assert embed["fields"][0]["name"] == "gas"
        assert embed["fields"][0]["inline"] is True

    def test_returns_false_on_network_error(self):
        import urllib.error
        dc = DiscordNotifier(webhook_url="https://hook.example")
        with _mock_urlopen(side_effect=urllib.error.URLError("boom")):
            ok = _run(dc.send(title="T", body="B"))
        assert ok is False

    def test_data_fields_capped_at_25(self):
        dc = DiscordNotifier(webhook_url="https://hook.example")
        big_data = {f"k{i}": f"v{i}" for i in range(30)}
        with _mock_urlopen() as mock_open:
            _run(dc.send(title="T", body="B", data=big_data))
        embed = json.loads(mock_open.call_args[0][0].data)["embeds"][0]
        assert len(embed["fields"]) == 25


# ════════════════════════════════════════════════════════
#  NotifyRouter
# ════════════════════════════════════════════════════════

class TestNotifyRouter:
    def _make(self, *, tg_ok=True, dc_ok=True):
        tg = TelegramNotifier(bot_token="tok", chat_id="cid") if tg_ok else None
        dc = DiscordNotifier(webhook_url="https://hook") if dc_ok else None
        return NotifyRouter(telegram=tg, discord=dc)

    @staticmethod
    async def _true(**kw):
        return True

    def test_critical_sends_both(self):
        router = self._make()
        with patch.object(TelegramNotifier, "send", side_effect=self._true) as tg_send, \
             patch.object(DiscordNotifier, "send", side_effect=self._true) as dc_send:
            _run(router.send(level="CRITICAL", title="T", body="B"))
        tg_send.assert_called_once()
        dc_send.assert_called_once()

    def test_warning_sends_telegram_only(self):
        router = self._make()
        with patch.object(TelegramNotifier, "send", side_effect=self._true) as tg_send, \
             patch.object(DiscordNotifier, "send", side_effect=self._true) as dc_send:
            _run(router.send(level="WARNING", title="T", body="B"))
        tg_send.assert_called_once()
        dc_send.assert_not_called()

    def test_info_sends_discord_only(self):
        router = self._make()
        with patch.object(TelegramNotifier, "send", side_effect=self._true) as tg_send, \
             patch.object(DiscordNotifier, "send", side_effect=self._true) as dc_send:
            _run(router.send(level="INFO", title="T", body="B"))
        tg_send.assert_not_called()
        dc_send.assert_called_once()

    def test_no_channels_configured(self):
        router = NotifyRouter()
        # Should not raise
        _run(router.send(level="CRITICAL", title="T", body="B"))

    def test_telegram_only_router(self):
        router = self._make(dc_ok=False)
        with patch.object(TelegramNotifier, "send", side_effect=self._true) as tg_send:
            _run(router.send(level="INFO", title="T", body="B"))
        # INFO goes to Discord which is None → no call to Telegram
        tg_send.assert_not_called()


# ════════════════════════════════════════════════════════
#  Integration: Arb notify wiring
# ════════════════════════════════════════════════════════

class TestArbNotifyWiring:
    """Verify ArbCampaignLoop calls notify at key points."""

    def _make_loop(self, notify_router):
        from toolloop_arb import ArbCampaignLoop
        return ArbCampaignLoop(notify=notify_router)

    def test_step_error_sends_warning(self):
        sent = []
        async def mock_send(**kw):
            sent.append(kw)
        router = MagicMock()
        router.send = mock_send

        loop = self._make_loop(router)
        # Make collect raise
        async def bad_collect():
            raise RuntimeError("collect boom")
        loop._step_collect = bad_collect

        result = _run(loop.run_cycle())
        assert result["outcome"] == "step_error"
        assert len(sent) == 1
        assert sent[0]["level"] == "WARNING"
        assert "collect" in sent[0]["body"]

    def test_execute_success_sends_info(self):
        sent = []
        async def mock_send(**kw):
            sent.append(kw)
        router = MagicMock()
        router.send = mock_send

        loop = self._make_loop(router)

        # Stub steps to go through execute
        from toolloop_arb import SignalRef, StrategyRef
        async def fake_collect():
            return [SignalRef(sig_id="s1", signal_type="price_divergence",
                            source="test", pool_address="0x1",
                            strength=0.9, timestamp=0)]
        async def fake_curate(sigs):
            return [{"skeleton_id": "sk1", "signals": sigs}]
        async def fake_dataset(skels):
            return [StrategyRef(
                strategy_id="st1",
                strategy_type="cross_pool_arbitrage",
                entry={"pool_address": "0x1", "token_in": "0xA",
                       "token_out": "0xB", "amount_in_wei": 100},
            )]
        async def fake_execute(strats):
            return [{"status": "success", "strategy_id": "st1"}]
        async def fake_fix(results):
            return None

        loop._step_collect = fake_collect
        loop._step_curate = fake_curate
        loop._step_dataset = fake_dataset
        loop._step_execute = fake_execute
        loop._step_fix = fake_fix

        result = _run(loop.run_cycle())
        assert result["outcome"] == "completed"
        # Should have INFO notification for execute success
        info_msgs = [s for s in sent if s.get("level") == "INFO"]
        assert len(info_msgs) >= 1
        assert "trades" in info_msgs[0]["title"].lower()


class TestBuildNotifyRouter:
    """Verify skill_mm_arb._build_notify_router wires credentials."""

    def test_builds_with_env_vars(self):
        # Ensure skill_mm_arb is importable
        if str(SCRIPTS) not in sys.path:
            sys.path.insert(0, str(SCRIPTS))

        import skill_mm_arb
        # Truthy sentinel prevents _load_s5_env from reading real .env.s5
        skill_mm_arb._S5_ENV = {"_loaded": "1"}
        with patch.dict("os.environ", {
            "TELEGRAM_BOT_TOKEN": "test_token",
            "TELEGRAM_CHAT_ID": "test_chat",
            "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/1/2",
        }):
            router = skill_mm_arb._build_notify_router()
        assert router._telegram._bot_token == "test_token"
        assert router._telegram._chat_id == "test_chat"
        assert router._discord._webhook_url == "https://discord.com/api/webhooks/1/2"

    def test_builds_empty_when_no_env(self):
        import skill_mm_arb
        # Truthy sentinel prevents _load_s5_env from reading real .env.s5
        skill_mm_arb._S5_ENV = {"_loaded": "1"}
        with patch.dict("os.environ", {}, clear=True):
            router = skill_mm_arb._build_notify_router()
        # Notifiers exist but are unconfigured → send() returns False
        assert not router._telegram._configured()
        assert not router._discord._configured()
