# AGV 私有 adapter 层
# 建立在 nexrur (通用内核) 之上，注入 AGV 做市/套利流水线语义
#
# 本目录不是 shared kernel — 它是 AGV 仓库的私有代码。
# 通用组件请使用 nexrur 包。
#
# 子包:
#   clients/ — GeminiLLMClient (适配 DiagnosisEngine.LLMClient Protocol)
#   cli/     — Arb Campaign CLI (python -m _shared.cli)
#   core/    — outcome + evidence + policy (re-export + AGV 覆盖)
#   engines/ — profiles + ops + campaign + diagnosis
#   prompts/ — prompt 模板
