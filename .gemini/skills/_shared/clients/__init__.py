# AGV adapter: clients 子包
# GeminiLLMClient 适配 DiagnosisEngine.LLMClient Protocol
# 底层复用 nexrur.clients.gemini.GeminiClient (requests-only, 零 SDK 依赖)

from .clients import GeminiLLMClient, LLMError

__all__ = [
    "GeminiLLMClient",
    "LLMError",
]
