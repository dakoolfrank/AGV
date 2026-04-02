"""
AGV clients — GeminiLLMClient

适配 DiagnosisEngine.LLMClient Protocol，底层复用 nexrur.clients.gemini。

设计:
- nexrur.clients.gemini.GeminiClient 是纯 requests HTTP 客户端（零 SDK）
- 本模块做签名适配: diagnosis.py Protocol → GeminiClient.generate_text
- JSON 提取/校验从 nexrur PlatformLLMClient 精简移植
- 凭据从 brain_alpha.infra.settings 加载（PYTHONPATH 需包含 WQ-YI）

使用::

    from _shared.clients import GeminiLLMClient

    llm = GeminiLLMClient.from_settings()
    result = llm.generate_json(
        system_prompt="你是 DeFi 分析师",
        user_prompt="分析这个滑点: ...",
        temperature=0.0,
    )
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """LLM 调用失败"""
    pass


def _extract_json_robust(raw: str) -> dict[str, Any]:
    """从 LLM 输出中提取 JSON（三级兜底）

    1. 直接 parse
    2. 提取 ```json ... ``` 代码块
    3. 平衡花括号提取
    """
    text = raw.strip()

    # 1) 直接 parse
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass

    # 2) fenced block
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(1).strip())
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass

    # 3) balanced brackets
    start = text.find("{")
    if start >= 0:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start : i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except (json.JSONDecodeError, ValueError):
                        pass
                    break

    raise LLMError(f"无法从 LLM 输出提取 JSON: {text[:200]}")


class GeminiLLMClient:
    """适配 DiagnosisEngine.LLMClient Protocol

    底层: nexrur.clients.gemini.GeminiClient (requests HTTP)
    签名: generate_json(system_prompt, user_prompt, ...) → dict
    """

    def __init__(self, client: Any, flash_client: Any | None = None):
        """
        Args:
            client: nexrur.clients.gemini.GeminiClient (Pro)
            flash_client: GeminiClient (Flash, 可选 — 用于快速初判)
        """
        self._client = client
        self._flash = flash_client

    @classmethod
    def from_settings(cls) -> "GeminiLLMClient":
        """从 nexrur credentials 加载（读 .env + 环境变量）"""
        try:
            from nexrur.clients import create_client, NexrurCredentials
        except ImportError as exc:
            raise LLMError(
                "nexrur.clients 不可用 — "
                "请确保 nexrur 已安装 (pip install -e nexrur)"
            ) from exc

        creds = NexrurCredentials()
        pro = create_client(creds, flash=False)
        if pro is None:
            raise LLMError(
                "GeminiClient 初始化失败 — "
                "检查 GEMINI_API_KEY / GEMINI_MODEL / AI_ENABLE"
            )
        flash = create_client(creds, flash=True)
        return cls(client=pro, flash_client=flash)

    @classmethod
    def from_settings_or_none(cls) -> "GeminiLLMClient | None":
        """安全版 — 失败返回 None（Campaign 降级为确定性模式）"""
        try:
            return cls.from_settings()
        except Exception as exc:
            logger.warning("LLM 初始化失败，降级为确定性模式: %s", exc)
            return None

    # ── Protocol 实现 ──

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str = "",
        temperature: float = 0.0,
        schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """生成 JSON — 适配 DiagnosisEngine.LLMClient Protocol"""
        client = self._select_client(model)
        raw = client.generate_text(
            system=system_prompt,
            user=user_prompt,
            temperature=temperature,
        )
        result = _extract_json_robust(raw)

        # schema 校验（轻量级 — 只检查必需键）
        if schema and "required" in schema:
            missing = [k for k in schema["required"] if k not in result]
            if missing:
                logger.warning("JSON 缺少必需键: %s", missing)

        return result

    def generate_text(
        self,
        *,
        system: str | None = None,
        user: str,
        temperature: float = 0.2,
        use_flash: bool = False,
    ) -> str:
        """生成文本（非 Protocol 方法 — 通用工具）"""
        client = self._flash if (use_flash and self._flash) else self._client
        return client.generate_text(
            system=system,
            user=user,
            temperature=temperature,
        )

    def _select_client(self, model: str) -> Any:
        """根据 model hint 选择 Flash/Pro"""
        if model and "flash" in model.lower() and self._flash:
            return self._flash
        return self._client

    @property
    def available(self) -> bool:
        return self._client is not None
