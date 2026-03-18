# Agent 架构五方对比：Copilot / AI打工人 / AlphaSpire / 5-Agent / WQ-YI

> **日期**: 2026-03-05（Part 1）/ 2026-03-06（Part 2: 论坛实战数据）  
> **背景**: 在与 Claude Opus 4.6 Coding Agent 深度协作，分析 cnhkmcp AI打工人 + WorldQuant BRAIN 论坛 10 篇核心帖后，对五种 Agent 架构范式进行系统性对比  
> **核心发现**: 五者代表 LLM-centric → Code-centric 光谱上的五个点。区别不在"L3 厚薄"，而在**谁控制决策流**。AlphaSpire 233 万表达式 70% 语法错误——这是量化领域 L2 训练数据为零的直接后果。  
> **数据来源**: MCP Forum Worker（Playwright Chromium）论坛抓取 + `get_user_alphas` Alpha 组合统计 + AIAC 2.0 竞赛数据 + arXiv 调研

---

# Part 1: 三方架构对比（Copilot / AI打工人 / WQ-YI）

## 1. 三个参照系

在量化 Alpha 研究领域，目前存在三种 Agent 架构已经在运行：

| 产品 | 本质 | 决策者 | 已落地 |
|------|------|--------|:---:|
| **VS Code Copilot** | Coding Agent 操控 IDE | LLM（专项训练过代码） | ✅ |
| **AI打工人** | Coding Agent 操控量化平台 | LLM（读 14 个 Skill 文档做量化） | ✅ |
| **WQ-YI** | 领域引擎编排 + LLM 辅助判断 | Python 代码（LLM 仅在嵌入点被调用） | 🔨 建设中 |

**AI打工人的存在证明了一件事：Coding Agent + 好的领域文档 + MCP 工具 = 可以做量化。** 这迫使我们诚实回答：WQ-YI 多出来的东西到底值多少？

---

## 2. Agent Loop 的真相：它不在 LLM 里

在分析 AI打工人"可以换 LLM"这个事实时，发现一个关键误解需要纠正：

**Agent Loop（while 循环 + tool dispatch）不住在 LLM 里面，住在宿主程序里。**

```
┌─────────────────────────────────────────────────────┐
│  宿主程序 (Host)                                     │
│                                                     │
│  while not done:                                    │
│    1. 把用户指令 + 上下文 + 工具列表 → 发给 LLM      │
│    2. LLM 返回：调用工具 X，参数 Y                   │
│    3. Host 执行工具 X(Y) → 拿到结果                  │
│    4. 把结果塞回上下文 → 回到步骤 1                   │
│                                                     │
│  这个 while 循环 = Agent Loop                        │
│  它是 Python/JS 代码，不是 LLM 的一部分               │
└─────────────────────────────────────────────────────┘
```

LLM 提供的不是 Agent Loop，而是 **tool_use 能力**——"告诉宿主下一步该调什么工具"的决策能力。

| 组件 | 住在哪 | 可替换吗 |
|------|--------|---------|
| **while 循环**（Agent Loop 骨架） | 宿主程序（Claude Code CLI / VS Code / 自建） | ✅ 宿主可换 |
| **"下一步调什么工具"的决策** | LLM 的 tool_use 能力 | ✅ LLM 可换 |
| **工具执行** | MCP client → MCP server | ✅ 工具可换 |

**三个都可以换。** 所以 AI打工人换 LLM 完全成立——宿主的 while 循环不变，MCP 43 个工具不变，只有"谁来做决策"换了。

### tool_use 是 LLM 标配，不是 Claude 独有

| LLM | tool_use 能力 | 作为 Agent Loop 决策者 |
|-----|-------------|---------------------|
| Claude Opus/Sonnet | 极强（Anthropic 专项训练） | 极强 |
| GPT-4o | 很强（function calling 成熟） | 很强 |
| Gemini Pro | 好（Google 持续优化） | 好 |
| DeepSeek V3 | 不错（开源最强之一） | 不错 |
| Qwen 2.5 | 不错 | 不错 |
| 英伟达免费模型 | 可用 | 基本可用 |

---

## 3. 修正后的架构分层模型

原来的"四层模型"把 L3 画成铁板一块，无法解释三种产品的差异。修正后拆为五层：

```
┌─────────────────────────────────────────────────────────┐
│  L4: IO 适配层                                           │
│  MCP 工具 / IDE 工具 / 文件系统 / 终端                    │
│  本质：插口                                               │
├─────────────────────────────────────────────────────────┤
│  L3.engine: 领域引擎（Python + LLM 混合代码）             │
│  确定性算法 ~80% + LLM 调用 ~20%                          │
│  状态机 / 候选构建 / 评分 / diversity 强制                 │
│  本质：专用机器                                           │
├─────────────────────────────────────────────────────────┤
│  L3.infra: 底座基础设施（纯 Python 代码）                  │
│  Orchestrator / Checkpoint / Audit / Evidence / Gate      │
│  本质：工厂管理系统                                        │
├─────────────────────────────────────────────────────────┤
│  L3.host: 宿主 Agent Loop（while 循环 + tool dispatch）   │
│  本质：通用调度器（Claude Code CLI / VS Code / 自建）      │
├─────────────────────────────────────────────────────────┤
│  L3.knowledge: 领域知识文档                               │
│  Skill 文档 / SKILL.md prompt 模板 / knowledge/ YAML      │
│  本质：教 LLM 做事的参考资料                               │
├─────────────────────────────────────────────────────────┤
│  L2: 推理引擎（LLM + tool_use 能力）                      │
│  理解意图 → 生成输出 → 决定下一步工具调用                   │
│  本质：可替换的大脑                                        │
├─────────────────────────────────────────────────────────┤
│  L1: Transformer 基座                                    │
│  注意力机制 / context window / next token prediction       │
│  本质：神经元                                             │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 三方逐层对比

### 4.1 全景映射

```
                    Copilot              AI打工人             WQ-YI
                    ━━━━━━━              ━━━━━━━             ━━━━━
L4 (工具)           VS Code 15 tools     MCP 43 tools        MCP 43 tools
                    ✅                   ✅                  ✅

L3.engine           无                   无                  6 Subagents
(领域引擎)          (不需要)              (不需要)             ~12,000 行 Python+LLM
                                                             skill_dataset_explorer 5,475 行
                                                             skill_collect_papers ~2,000 行
                                                             skill_curate_knowledge ~1,500 行
                                                             skill_field_updater ~1,500 行
                                                             skill_evaluate_alphas ~1,000 行

L3.infra            无                   无                  _shared/ ~12,000 行
(底座)              (IDE 自带)            (不需要)             Orchestrator + Checkpoint
                                                             + Audit + Evidence + Gate

L3.host             VS Code Agent Loop   Claude Code CLI     Orchestrator while 循环
(宿主循环)          (Anthropic+MS)        (Anthropic)         (自建)

L3.knowledge        无                   14 Skills 文档       6 SKILL.md + knowledge/
(领域知识)          (代码知识在 L2 训练里)  + brain-consultant   + _semantic.yaml + policy.yml

L2 (LLM)           Claude (固定)         可换                 可换
                    (专项代码训练)         (Claude/GPT/DeepSeek) (Claude/Gemini/DeepSeek)

L1 (基座)           Transformer          Transformer          Transformer
```

### 4.2 控制流归属：核心区别

| | Copilot | AI打工人 | WQ-YI |
|---|---|---|---|
| **谁控制"下一步做什么"** | LLM | LLM | Python 代码 |
| **谁控制"怎么做这一步"** | LLM | LLM | Python 代码（嵌入 LLM 调用点） |
| **LLM 决策占比** | ~100% | ~100% | **~20%** |
| **确定性代码占比** | ~0% | ~0% | **~80%** |
| **架构范式** | LLM-centric | LLM-centric | **Code-centric** |

**这是根本性的架构差异，不是"厚薄"问题，是"谁在开车"的问题。**

### 4.3 类比

```
Copilot     = 给天才程序员一个 IDE，让他自由发挥
AI打工人    = 给实习生一本操作手册 + 全套工具，让他自己干一天
WQ-YI       = 一条生产线上有 6 台专用机器，实习生只在需要判断时被叫来看一眼
```

手册再好，实习生也可能犯错、跳步、忘记。
机器不犯错——它不懂"犯错"这个概念。

---

## 5. AI打工人的架构透视

### 5.1 实际架构

```
用户 → Claude Code CLI (宿主 Agent Loop)
         │
         ├── brain-consultant.md (顾问人格 prompt)
         ├── 14 个 Skills (领域知识文档，纯文本)
         ├── MCP 43 个 BRAIN 工具 (platform_functions.py)
         └── 1 个 Hook (remind_after_singleSim.py)
         
         L2 读文档 → L2 做全部决策 → L2 调工具
         无状态、无持久化、无审计
```

### 5.2 为什么它能工作

AI打工人证明了：**当 L2 足够强 + L3.knowledge 足够好时，不需要 L3.engine 和 L3.infra 也能做出结果。**

14 Skills 文档覆盖了量化研究的核心知识：
- Pyramid 定义、Simulation Settings、Neutralization 枚举
- 数据集探索指南、Alpha 测试通过标准
- 性能优化技巧、下一步分析方法论

Claude 读这些文档后，**靠自身的通用推理能力 + 对工具调用的理解**，即兴编排出一个可用的量化研究流程。

### 5.3 为什么它可以换 LLM

```
AI打工人换 LLM 时，不变的部分：
  L4: MCP 43 工具                        ← 完全不变
  L3.host: Claude Code CLI while 循环     ← 宿主代码不变
  L3.knowledge: 14 Skills + consultant.md ← 纯文本，任何 LLM 都能读

变了的部分：
  L2: Claude → GPT-4o / DeepSeek / 免费模型
  ↑ 只是换了"谁来读文档做判断"
```

### 5.4 换 LLM 后的衰减问题

**14 Skills 是 prompt 文本，LLM 可以选择不遵守。**

```
LLM 质量                对 14 Skills 的遵守率      总体效果
━━━━━━━━                ━━━━━━━━━━━━━━━━          ━━━━━━━━
Claude（极强）           ~95%                      很好
GPT-4o（很强）           ~90%                      好
DeepSeek（不错）         ~85%                      可用
弱模型（基本可用）        ~70%                      ⚠️ 开始出问题
```

那 30% 的"不遵守"会导致：
- Skills 说"所有 datafield 必须来自同一 dataset" → 弱 LLM 忽略 → 生成无效 Alpha
- Skills 说"先搜论坛再写表达式" → 弱 LLM 跳过搜索 → 直接瞎编
- Skills 说"检查 neutralization 设置" → 弱 LLM 忘了 → 用默认值

**prompt 是"建议"，不是"法律"。LLM 越弱，越不听话。没有机制兜底。**

---

## 6. WQ-YI 的架构透视

### 6.1 实际架构

```
Orchestrator v2 (8 步确定性编排)
  │
  ├── collect:   Python 系统搜索 arXiv+论坛+GitHub → [LLM 筛选]
  ├── curate:    Python 骨架提取 + 算子验证 → [LLM 验证]
  ├── L1:        Python 预取能力数据 → [LLM 推荐] → Python Schema 校验
  ├── updater:   Python 从 MCP 拉变体 → [LLM 分类] → Python 增量写入
  ├── L2:        Python 候选构建 → [LLM Flash 选择]
  │              → Python 确定性评分 → Python 确定性 Pro 判定
  │              → [LLM Pro 仲裁](if needed)
  │              → Python diversity 强制 → Python finalize
  ├── evaluate:  Python G0-G4 门禁 → MCP 仿真 → Python 指标提取
  ├── fix:       (Phase C)
  └── submit:    (Phase C)

  底座 _shared/:
    RunContext / StepOutcome / AuditBus / EvidenceStore
    PlatformPolicy / SchemaValidator / AssetRegistry
    Checkpoint (断点续跑) / Manifest (产物清单)
```

**方括号 [LLM ...] 是 LLM 调用点。其余全部是确定性 Python 代码。**

### 6.2 以 L2 字段绑定为例

这是最复杂的 Subagent——`skill_dataset_explorer.py`（5,475 行），详细拆解控制流：

```
L2 字段绑定一次执行中发生的事情：

Python: 从 _slot_pyramid.yml 读取 L1 推荐的 category        ← 确定性
Python: 根据 _semantic.yaml 构建候选字段池                    ← 确定性
Python: VECTOR 过滤 + 语义门控 + 前缀去重                     ← 确定性
Python: 组装 prompt（从 SKILL.md 加载模板 + 填充候选数据）     ← 确定性
[LLM]:  Flash 全局字段选择                                    ← LLM 调用点
Python: score_selection — 计算置信度 + 集中度                  ← 确定性
Python: need_pro_review — if 置信度 < 0.90 or 抽样 or 集中度高 ← 确定性
[LLM]:  Pro 仲裁（仅当 need_pro = true 时）                   ← LLM 调用点（条件触发）
Python: enforce_diversity — 前缀去重 + 品类均衡               ← 确定性
Python: finalize_selection — Schema 校验 + 写文件              ← 确定性
Python: StepOutcome + evidence + audit                        ← 确定性

LLM 调用点: 1-2 处
Python 确定性代码: ~10 处
```

**LLM 不知道自己在一条生产线上。它只看到"这是一堆候选字段，选最好的 6 个"——不知道上游做了什么过滤，也不控制下游的评分和去重。**

### 6.3 换 LLM 后的衰减对比

```
LLM 质量下降时：

AI打工人:                               WQ-YI:
  LLM 忘记单 dataset 规则                  Schema 强制校验 → 100% 拦截
  LLM 选了 VECTOR 字段                     Python VECTOR 过滤 → 100% 拦截
  LLM 跳过搜索直接编                       Orchestrator 强制步骤序列 → 不可能跳步
  LLM 结果格式错误                         Schema 校验 + reason_code → 结构化降级
  LLM 选的字段太集中                       diversity 强制去重 → 代码保证均衡

效果衰减曲线:
  AI打工人  ████████████████  Claude
            ████████████      GPT-4o
            ████████          DeepSeek
            ████              弱模型       ← 急剧衰减（LLM 控制 100%）

  WQ-YI     ████████████████  Claude
            ███████████████   GPT-4o
            ██████████████    DeepSeek
            ████████████      弱模型       ← 缓慢衰减（LLM 只控制 ~20%）
```

**WQ-YI 的效果和 LLM 质量弱相关。这是 Code-centric 架构的核心价值。**

---

## 7. Copilot 为什么在代码领域"无敌"

### 7.1 三层专业化叠加

```
L1 Transformer    基础语言理解     + 代码 token 化优化
        ×
L2 Claude Opus    通用推理         + 几亿行代码训练 + 代码 RLHF + tool use 专项训练
        ×
L3.host           通用 while 循环  + 专为 file/edit/terminal/search 设计的 dispatch
        ×
L4 VS Code        通用文件 IO      + IDE 级语法高亮/诊断/补全/终端集成
        ↓
= 极强的 coding agent
```

### 7.2 为什么 Copilot 不需要 L3.engine

Copilot 的 L2 已经**天生懂代码**（几十亿行训练数据），加上编译器/类型系统做校验兜底。不需要 Python 代码来"教 LLM 什么是函数签名"。

```
Copilot 做编码:                         WQ-YI 做量化:
  LLM 天生懂 for 循环 → 直接写           LLM 不懂 neutralization → 要教
  编译器报错 → LLM 自己修                 无编译器 → 自建 Schema 校验
  类型系统帮忙 → 不容易写错类型            无类型系统 → reason_code 26 个分类
  LLM 置信度高 → 一次就对                 LLM 置信度低 → Flash+Pro 双层审查
```

**Copilot 在代码领域能用 LLM-centric 范式，是因为 L2 在这个领域极强。L3.engine 的功能被 L2 训练吸收了。**

---

## 8. L2 训练数据分布

### 8.1 语言分布（估算）

```
Anthropic 训练 Claude 写代码时：
  Python      ████████████████████████  几十亿行
  JavaScript  ████████████████████████  几十亿行
  TypeScript  ███████████████████████   
  Java/C++    ██████████████████████    
  Rust/Go     ████████████████         
  Solidity    █████████                 几千万行（GitHub + Etherscan）
  ─────────────────────────────────────
  Alpha 表达式  （零）                    WorldQuant BRAIN 是封闭平台
```

### 8.2 三领域对比

| 领域 | L2 训练数据量 | L2 专业度 | 需要 L3.engine 吗 | 校验机制 |
|------|-------------|----------|:---:|---------|
| **Python/JS** | 几十亿行 | 极强 | 不需要 | 编译器/类型系统 |
| **Solidity** | 几千万行 | 强 | 很少 | `forge build` + `forge test` |
| **Alpha 表达式** | ≈ 零 | 极弱 | **必须** | 自建 Schema + 26 个 reason_code |

### 8.3 这决定了架构选择

```
L2 专业度高 → LLM-centric 可行 → Copilot / AI打工人 模式
L2 专业度低 → LLM-centric 不可靠 → 必须 Code-centric → WQ-YI 模式
```

AI打工人用 LLM-centric 做量化能工作，是因为 Claude 的通用推理能力足够强，加上 14 Skills 文档兜底。但这依赖 Claude 保持强大——**换弱模型就崩。**

WQ-YI 用 Code-centric 做量化，是因为不信任任何 LLM 在 Alpha 领域的能力——**代码控制 80%，LLM 只管 20%，换谁都差不多。**

---

## 9. 根本分歧：信任模型

```
Copilot 的隐含假设:
  ✅ 信任 LLM（L2 在代码领域极强，值得信任）

AI打工人的隐含假设:
  ✅ 信任 LLM + 14 Skills 足以约束（LLM 通用推理 + 领域文档 → 够用）

WQ-YI 的隐含假设:
  ❌ 不信任 LLM，用代码强制约束
  （LLM 会幻觉、会忘记、会偷懒 → 代码不会）
```

| | 信任 LLM | 不信任 LLM |
|---|---|---|
| **灵活性** | 高（LLM 即兴发挥） | 低（严格步骤序列） |
| **确定性** | 低（LLM 不可预测） | 高（代码保证） |
| **可审计** | 不可（LLM 黑箱推理） | 可以（lineage + audit + evidence） |
| **换 LLM** | 效果剧烈波动 | 效果缓慢衰减 |
| **适合场景** | 探索、少量、人在环 | 批量、无人值守、需审计 |
| **工程投入** | 低（写文档） | 高（写代码） |
| **落地速度** | 快（1 周） | 慢（几个月） |

**两种都对，取决于你在什么阶段。**

```
探索阶段 → 信任 LLM → AI打工人 → 快速验证想法
生产阶段 → 不信任 LLM → WQ-YI → 规模化可靠执行
```

---

## 10. 三种产品的适用边界

| 场景 | Copilot | AI打工人 | WQ-YI |
|------|:---:|:---:|:---:|
| 写 Python/Solidity | ✅ 极强 | ❌ | ❌ |
| 探索 1 个 Alpha 想法 | ❌ | ✅ | ❌ 过重 |
| 一天做 3-5 个 Alpha | ❌ | ✅ | ⚠️ 可用但过重 |
| 批量生产 100 个 Alpha | ❌ | ❌ 无状态 | ✅ |
| 复盘"第 37 个 Alpha 为什么失败" | ❌ | ❌ 无 audit | ✅ lineage + evidence |
| 进程崩溃后继续 | ❌ | ❌ | ✅ Checkpoint |
| 换便宜 LLM 省成本 | ❌ 锁定 Claude | ⚠️ 效果剧降 | ✅ 效果缓降 |
| 多人协作审计 | ❌ | ❌ | ✅ 结构化产出 |
| 零基础新手上手 | ❌ | ✅ 双击即用 | ❌ 需理解架构 |

---

## 11. WQ-YI 的 L3.engine：不是"更厚"，是不同物种

之前文档说"nexrur 的 L3 必须厚来补偿 L2 缺失"——这个说法不精确。

**AI打工人的 14 Skills 也在补偿 L2 缺失（教 LLM 做量化），但它是文本文档（prompt），只约束 LLM 怎么想。**

**WQ-YI 的 6 Subagents 是 Python+LLM 混合代码，它们直接执行算法，LLM 只在嵌入点被调用做判断。**

```
AI打工人 14 Skills（纯文本，~数千行文档）:
  "你在选择 datafield 时，要确保所有字段来自同一 dataset..."
  → Claude 读了 → Claude 自己决定怎么执行 → 可能遵守，可能忘记

WQ-YI skill_dataset_explorer.py（Python+LLM 混合，5,475 行代码）:
  Python: 从 _semantic.yaml 构建候选池              ← 代码执行
  Python: VECTOR 过滤 + 语义门控                    ← 代码执行
  [LLM]:  Flash 从候选池中选 6 个字段                ← LLM 在约束范围内做判断
  Python: score_selection + need_pro_review          ← 代码执行
  [LLM]:  Pro 仲裁（条件触发）                       ← LLM 在约束范围内做判断
  Python: enforce_diversity + Schema 校验 + 写文件    ← 代码执行
  → LLM 看不到全貌，只在被调用时做局部判断
  → 代码保证流程完整性、数据一致性、输出格式
```

**14 Skills 是"操作手册"——告诉工人怎么做。6 Subagents 是"生产线"——工人只管质检岗。**

| | 14 Skills（文档） | 6 Subagents（代码+LLM） |
|---|---|---|
| 实现介质 | 纯文本 | Python + 嵌入的 LLM 调用 |
| 执行者 | LLM 自己 | Python 解释器 + LLM |
| 强制力 | 零（LLM 可以不听） | 绝对（代码不"忘记"） |
| 对 LLM 的依赖 | 100%（LLM 控制全部） | ~20%（LLM 只管判断点） |
| 换 LLM 的影响 | 整体质量剧烈波动 | 判断点质量波动，流程不变 |
| 可复现性 | 不可（LLM 每次不同） | 高（确定性代码 + 固定 seed） |

---

## 12. 所有权 vs 能力

### 技术能力对比

| | Copilot | AI打工人 | WQ-YI |
|---|---|---|---|
| 单次效果 | 极强（代码域） | 好（量化域） | 好（量化域） |
| 确定性 | 高（代码有编译器兜底） | 低（LLM 不可预测） | 高（代码控制 80%） |
| 持久化 | 对话即丢 | 对话即丢 | outcome + audit + evidence |
| 工程投入 | 0（直接用） | 低（14 文档 + 1 hook） | 高（~24,000 行代码） |
| 落地速度 | 即时 | 1 周 | 几个月 |

### 所有权对比

| | Copilot | AI打工人 | WQ-YI |
|---|---|---|---|
| **归属** | Anthropic+MS | cnhkmcp（开源） | 你 |
| **LLM 锁定** | 只能调 Claude | 可换（衰减大） | 可换（衰减小） |
| **定价权** | Anthropic 说了算 | LLM API 费用 | 你说了算 |
| **白标分发** | 不可能 | 困难 | 完全可以 |
| **知识积累** | 不积累 | 不积累 | evidence RAG 跨会话积累 |

---

## 13. nexrur 的精确定位（修正版）

```
nexrur ≠ 重新造一个 Claude
nexrur ≠ 通用 AI 框架（LangChain/AutoGPT）
nexrur ≠ "更厚的 AI打工人"（差异不在厚薄，在控制权归属）
nexrur = Code-centric 领域引擎 + 可插拔 LLM 辅助判断

具体地说：
  L4 (工具层):       MCP 43 tools + forge + 文件系统
  L3.engine (引擎):  6 Subagents — Python 确定性代码 + 嵌入 LLM 调用点
  L3.infra (底座):   Orchestrator + Checkpoint + Audit + Evidence + Gate
  L3.host (宿主):    自建 Agent Loop（或复用 CLI）
  L3.knowledge:      SKILL.md prompt 模板 + knowledge/ YAML + policy.yml
  L2 (LLM):          可插拔（Claude/Gemini/DeepSeek/本地模型）
```

### 与 AI打工人的战略关系

```
AI打工人 = 先头侦察兵（快速验证，发现路线）
WQ-YI    = 工业化部队（规模执行，可审计）

不是竞争关系，是不同阶段的工具：
  第 1 天: 用 AI打工人 探索想法
  第 1 周: 用 AI打工人 积累实战经验、沉淀领域规则
  第 1 月: 把沉淀出的规则编码进 WQ-YI 的 L3.engine 和 L3.infra
  第 3 月: WQ-YI 批量执行，AI打工人继续探索新方向
```

---

## 14. 总结

```
┌──────────────────────────────────────────────────────────────────┐
│                     核心发现                                      │
│                                                                  │
│  三种产品 = 三种架构范式：                                        │
│                                                                  │
│  Copilot   = LLM-centric  + L2 极强（代码域训练）               │
│  AI打工人  = LLM-centric  + L3.knowledge（14 Skills 文档）      │
│  WQ-YI     = Code-centric + L3.engine（6 Subagents 代码+LLM）  │
│                                                                  │
│  区别不在"L3 厚薄"，在"谁控制决策流"                              │
├──────────────────────────────────────────────────────────────────┤
│                     修正后的核心公式                               │
│                                                                  │
│  Copilot  = L2(极强,固定) × L3.host(专) × L4(IDE)              │
│             LLM 决策 100% → coding 极强                          │
│                                                                  │
│  AI打工人 = L2(可换) × L3.knowledge(14 Skills) × L4(MCP 43)    │
│             LLM 决策 100% → 量化可用，效果随 LLM 质量剧烈波动    │
│                                                                  │
│  WQ-YI    = L2(可换) × L3.engine(6 Subagents) × L3.infra       │
│             × L3.knowledge(SKILL.md) × L4(MCP 43)               │
│             LLM 决策 ~20% → 量化可靠，效果随 LLM 质量缓慢衰减    │
├──────────────────────────────────────────────────────────────────┤
│                    三条路线各自正确                                │
│                                                                  │
│  如果 L2 在目标领域极强 → LLM-centric 就够 → Copilot            │
│  如果 L2 不够但能文档补偿 → LLM + 文档 → AI打工人（快速验证）    │
│  如果 L2 不够且需要可靠/规模化 → Code-centric → WQ-YI（生产线） │
│                                                                  │
│  量化领域 L2 接近零 → AI打工人是探索工具，WQ-YI 是生产工具       │
│  两者不冲突，是同一条路的不同阶段                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

# Part 2: 论坛实战对比 — 五方架构全景

> **日期**: 2026-03-06  
> **数据来源**: WorldQuant BRAIN 论坛 10 篇核心帖子 + 用户 Alpha 组合统计 + AIAC 2.0 竞赛数据 + arXiv 调研  
> **核心发现**: 论坛上的 AI Alpha 系统可归为三种范式——暴力生成（AlphaSpire）、LLM+规则混合漏斗（5-Agent）、Code-centric 生产线（WQ-YI）。加上 Copilot 和 AI打工人，构成从纯 LLM 到纯代码的完整光谱。

---

## 15. AI 打工人实战生态（论坛调研）

### 15.1 数据来源

通过 MCP Forum Worker（`cnhkmcp_fuse.py` 进程隔离 + Playwright Chromium）搜索并读取了 10 篇核心论坛帖子：

| 帖子 | 作者 | 赞数 | 评论 | 核心内容 |
|------|------|:----:|:----:|----------|
| AlphaSpire: 全自动 Alpha 生成 | PZ66162 | 27 | 20 | DeepSeek-chat 批量生成 233 万表达式 |
| MCP 自动找 Alpha | QQ68782 | 68 | 11 | FastMCP 自动挖掘工作流 |
| AI 辅助下的量化实践分享 | QQ68782 | 25 | — | AI 读论文找 Alpha |
| AI 提示词分享 | XX42289 | 32 | — | 直接 prompt 变体生成 |
| [AIAC2] Alpha 生成系统 | JX79797 | 18 | 8 | 5-Agent + Gemini-2.5-Flash |
| Gemini 从 0 到 1 手搓 IND alpha | JX84394 | 43 | 35 | Chrome Gemini 手动迭代 |
| AIAC 2.0 比赛要点 | AL13375 | 25 | 15 | 官方 LLM 标签列表（40+ 模型） |
| 在 Brain APP 中使用自定义大模型 | HW93328 | 73 | 1 | Brain APP 默认 DeepSeek，换 GPT/Gemini/Claude |
| 我的量化之路 | SZ84537 | 7 | 3 | DeepSeek 半自动工作流 |
| 可供使用的 AI 免费资源合集 | WL13229 | 31 | 18 | 20+ 种免费 Token 来源 |

### 15.2 Alpha 组合统计（用户实际数据）

通过 MCP `get_user_alphas` 工具获取（2026-03-05）：

| 指标 | 数值 |
|------|------|
| IS Alpha 总量 | ~10,000 |
| OS Alpha 总量 | 66 |
| IS → OS 通过率 | **0.66%** |
| 总累计收益 | $14.97 |
| IS → OS Sharpe 衰减 | 60-80% |
| 最佳 OS Sharpe | 1.89 |
| OS Sharpe 中位数 | ~1.6 |

### 15.3 LLM 选型生态

#### AIAC 2.0 官方支持模型（截至 2026-03）

比赛要求每个 Alpha 打上使用的 AI 模型标签，官方支持列表（40+ 模型）：

| 厂商 | 模型 |
|------|------|
| **Anthropic** | claude-3.5-haiku, claude-3.5-sonnet, claude-3.7-sonnet, claude-4-opus, claude-4-sonnet, claude-4.1-opus, claude-4.5-haiku, claude-4.5-sonnet |
| **Google** | gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5, gpt-5-codex, gpt-5-mini, gpt-5-nano, o1, o1-mini, o3, o3-mini, o3-pro, o4-mini |
| **DeepSeek** | deepseek-3.1, Deepseek-v3.2, Deepseek-R1 |
| **Alibaba** | qwen3-coder-480b, qwen3-next-80b-instruct, qwen3-next-80b-thinking, Qwen3-max |
| **Meta** | llama-3-3-70b |
| **字节** | Doubao-Seed-1.6(-flash/-lite/-thinking) |
| **智谱** | Glm4.6 |
| **其他** | inclusionAI/Ring-1T, Kimi-K2, LongCat-Flash-Thinking, minimax-m2, mistral-small/medium/large, sonar-deep-research/reasoning/reasoning-pro |

#### 社区实际选用（论坛调研）

| 模型 | 社区定位 | 典型用法 | 成本 |
|------|----------|----------|------|
| **DeepSeek-chat / V3** | **默认首选**，Brain APP 内置 | 批量生成 + 迭代优化 | $0.28/M input, $0.42/M output |
| **Gemini 2.5 Flash** | **AIAC2 竞赛主力**，性价比最高 | 5-Agent 系统、批量回测标签 | 学生认证免费 / Google for Developers $10/月 |
| **Gemini 2.5 Pro** | 高质量仲裁 | Pro 审查层、复杂推理 | 学生优惠或付费 |
| **Claude 3.5/4 Sonnet** | 代码生成强、Skill 开发 | claude-code + MCP 工作流 | 通过 `claude-code-proxy` 白嫖 |
| **GPT-4.1 / GPT-5** | 通用选择 | OpenRouter 转接 | 付费 |
| **Kimi-K2** | 国产替代 | Brain APP 找灵感功能 | 限时免费额度 |
| **GLM 4.6/5** | 国产免费 | 无限额度方案 | 免费（智谱开放平台） |

**社区共识**：
- **入门**用 DeepSeek（便宜、Brain APP 默认集成）
- **竞赛**用 Gemini 2.5 Flash（官方标签支持、学生免费）
- **工作流自动化**用 Claude Code + MCP（Skill 生态最完善）
- **省钱**是核心话题——论坛有专门的「羊毛合集」帖（31 赞），汇总 20+ 种免费 Token 来源

#### 免费 Token 来源（社区整理）

| 来源 | 额度 | 说明 |
|------|------|------|
| Google for Developers | $10/月 | 可调用 Gemini API |
| 学生认证 Gemini 3 Pro | 0 成本，长达 2 年 | 需 .edu 邮箱或学生证 |
| GitHub Copilot Pro | 免费 1-2 年 | 学生认证 |
| 阿里云百炼 | 7000 万 token | 注册赠送 |
| 七牛云 | 300 万 token | 实名认证 |
| OpenRouter 免费模型 | 无限 | pony-alpha(GLM5)等限时模型 |
| iFlow CLI (心流) | 免费 API | 个人用户免费使用 |
| KIMI | 限时 API 额度 | 活动期间 |
| 魔搭 | 每天 2000 次调用 | 免费 |

### 15.4 运行模式分层

论坛中出现了三种自动化层级：

#### 层级 1：手动迭代（多数新手）

- **代表帖**：「Gemini 从 0 到 1 手搓 IND 区 alpha」（43 赞，最高社区认可）
- **工具**：Chrome 内置 Gemini（读网页 tab 页内容）/ Brain APP 找灵感 + DeepSeek
- **周期**：单个 alpha 约 30-60 分钟，人工参与度极高
- **流程**：
  ```
  选数据集 → Gemini 解读字段语义
  → 初始回测（decay=2, truncation=0.08, neutralization=SECTOR）
  → 逐个 FAIL 项询问 AI
  → ts_backfill 填充空值 → group_neutralize 剔除行业偏好
  → 参数微调 → 可提交 alpha
  ```
- **核心洞察**（论坛用户 JX84394）：
  - 原始数据 0-1 范围时不需要 rank/zscore
  - IND 区低频数据三步范式：`ts_backfill(清洗) → group_neutralize(横截面) → ts_decay(时序平滑)`
  - Chrome Gemini 可直接读取操作符网页，无需 MCP
- **产出**：每天 1-3 个可提交 alpha
- **特点**：人的领域知识直接参与每步决策，单 alpha 质量最高

#### 层级 2：半自动工作流（进阶用户）

- **代表帖**：「我的量化之路」（SZ84537）
- **工具**：Brain APP 找灵感 + DeepSeek API
- **周期**：几小时出 1 个 alpha，回测量不大
- **流程**：
  ```
  APP 找灵感给 dataset 模板
  → 字段 id + description 发给 DeepSeek
  → 生成有经济学意义的组合
  → 筛选 Sharpe > 2（后降低到 > 0.6）
  → 针对 FAIL 项（Turnover / Weight）逐步让 AI 修复
  → ts_target_tvr_decay 控制换手率
  → 多重中性化降低 prod corr
  ```
- **核心经验**（论坛用户 SZ84537）：
  - AI 可能有幻觉和错误，需要耐心协作
  - 嵌套二阶容易过拟合（VF 更新时才发现）
  - 七十二变和缘分一道桥等官方 AI 功能"一直不能出货"
  - 出货才是硬道理，不要过度优化框架
- **产出**：每天 1-3 个，多为 PPA（power pool alpha）
- **特点**：AI 担任建议者角色，人做最终判断

#### 层级 3：全自动 Pipeline（竞赛级）

- **代表帖**：「AlphaSpire」（27 赞）、「AIAC2 Alpha 生成系统」（18 赞）
- **两种子范式**：AlphaSpire（暴力生成）和 5-Agent（漏斗筛选）
- **周期**：7×24 持续运行 / 最大 50 cycle
- **详见下方 §16 / §17**

### 15.5 社区整体评价

**正面**：
- "AI 时代希望成为被 AI 需要的人，而不是被 AI 替代的人"（43 赞帖）
- MCP 工作流被认为是最有前景的方向（68 赞帖），可以 7×24 自动挖掘
- AIAC 2.0 竞赛推动了 AI Alpha 生态（40+ LLM 官方标签支持）
- 论坛帖子质量直接影响 AI 输出质量

**痛点**：
- **Token 消耗巨大**（"天天到处找 token 用"）—— 最高频的社区吐槽
- AI 会"卡住或随意输出结果"、幻觉问题
- Notebook 代码可用性不高，模型生成的表达式格式错误多
- **IS → OS 衰减严重**（Sharpe 衰减 60-80%）
- 官方 AI 功能（七十二变、缘分一道桥）"一直不能出货"
- Brain APP 默认 DeepSeek，想换模型需自行修改代码（73 赞帖提供了方案）

**关键洞察**：
- 手动用 Chrome Gemini 读网页 → 逐步修改 alpha 的"手搓"模式，反而获得最高社区认可（43 赞）
- 全自动 Pipeline 技术含量高但实际收益有限
- 人的领域知识仍是瓶颈，不是 LLM 能力
- 免费模型 > 付费模型是社区主旋律

---

## 16. AlphaSpire 架构透视

### 16.1 概览

| 属性 | 值 |
|------|-----|
| **作者** | PZ66162（论坛 27 赞） |
| **模型** | DeepSeek-chat（$0.28/M input, $0.42/M output） |
| **总产出** | 2,334,887 个表达式 |
| **通过率** | ~70% 语法错误；合法表达式 ~0.5% 通过 → **总通过率 ~0.15%** |
| **架构范式** | **LLM-centric 暴力生成器** |

### 16.2 架构

```
┌──────────────────────────────────────────────────┐
│              AlphaSpire 主循环                     │
│                                                  │
│  while True:                                     │
│    1. DeepSeek-chat.generate(prompt)             │
│       → Alpha 表达式字符串                        │
│                                                  │
│    2. if 语法合法:                                │
│         submit_to_BRAIN()  → 回测                 │
│         if pass: 记录                             │
│       else:                                      │
│         丢弃（~70% 走这条路）                      │
│                                                  │
│    3. → 下一个                                    │
│                                                  │
│  无状态、无诊断、无修复、无记忆                     │
│  233 万次尝试中 ~70% 语法错误                      │
│  合法表达式的 0.5% 通过回测                        │
└──────────────────────────────────────────────────┘
```

### 16.3 分层映射

```
                    AlphaSpire
                    ━━━━━━━━━━
L4 (工具)           BRAIN HTTP API（直接调用，非 MCP）

L3.engine           无
(领域引擎)          

L3.infra            无
(底座)              无状态、无持久化

L3.host             简单 while 循环
(宿主循环)          生成 → 检验 → 丢弃/保留

L3.knowledge        论坛帖子质量 → prompt 质量
(领域知识)          无结构化知识文件

L2 (LLM)           DeepSeek-chat（固定）
                    $0.28/M input, $0.42/M output

L1 (基座)           Transformer
```

### 16.4 优劣势

| 优势 | 劣势 |
|------|------|
| 极简——几百行代码即可 | **~99.85% 的计算浪费** |
| 无工程投入 | 70% 表达式有语法错误（LLM 不懂 BRAIN DSL） |
| 持续运行不需要人 | 无法从失败中学习 |
| Token 成本低（短表达式） | BRAIN API 回测成本极高（233 万次） |
| | 无审计——不知道为什么失败 |
| | 换 LLM 效果完全不可预测 |

### 16.5 核心问题

**AlphaSpire 证明了 LLM 在 Alpha 领域的训练数据为零这一事实的后果**：

70% 的表达式有语法错误 = LLM 不知道 `rank()` 只接受 1 个参数，不知道 `ts_decay_linear` 需要 2 个参数。这不是"模型不够好"——这是"训练集里没有这个语言"。

在 Python 领域，LLM 有几十亿行训练数据，语法错误率 < 5%。  
在 Alpha 表达式领域，LLM 有零训练数据，语法错误率 ~70%。

**这是 WQ-YI 选择 Code-centric 范式的最直接证据。**

---

## 17. 5-Agent 系统架构透视

### 17.1 概览

| 属性 | 值 |
|------|-----|
| **作者** | JX79797（论坛 18 赞，8 评论） |
| **模型** | Gemini-2.5-Flash × 3 并发客户端 |
| **架构** | 单 Jupyter Notebook（37 个 cell），同步设计 |
| **API** | OpenRouter API + BRAIN HTTP 直接调用 |
| **目标** | Sharpe ≥ 1.58, Fitness ≥ 1.0 |
| **终止** | ≥ 10 个达标 OR 50 cycle OR 停滞检测 |
| **架构范式** | **LLM + 规则混合漏斗** |

### 17.2 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     5-Agent 系统主循环                               │
│                                                                     │
│  Cycle 1 (初始生成):                                                │
│    3 × Gemini-2.5-Flash 并发 → 每个生成 10 alpha = 30 个           │
│    智能采样: 前 50 高频字段 + 随机采样至 150 个                       │
│    生成后立即规则验证 → 拒绝无效表达式                                │
│                                                                     │
│  ┌──────────────────── 4 阶段漏斗 ────────────────────┐             │
│  │  Stage 1 (1-step): 30 → filter Sharpe ≥ 0.0 → Top 20          │
│  │  Stage 2 (2-step): 20 → filter Sharpe ≥ 0.5 → Top 10          │
│  │  Stage 3 (3-step): 10 → filter Fitness ≥ 1.0 → Top 5          │
│  │  Stage 4 (extra):   5 → filter Sharpe ≥ 1.58 → 候选集          │
│  └─────────────────────────────────────────────────────┘            │
│                                                                     │
│  Cycle 2+ (迭代优化):                                               │
│    50% → 5-Agent 优化最佳 alpha:                                    │
│    ┌─────────────────────────────────────────────────┐              │
│    │  Agent 1: 诊断 (high_turnover? low_fitness?)    │              │
│    │  Agent 2: 策略规划 (Add ts_decay? Change field?)│              │
│    │  Agent 3: 变体生成 (4 库 + 规则校验 → 8 变体)   │              │
│    │  Agent 4: 批量回测 (统一打标签 gemini-2.5-flash) │              │
│    │  Agent 5: 评估 → 是否达标                       │              │
│    └─────────────────────────────────────────────────┘              │
│    50% → Data-Driven 新生成（经济主题驱动）                          │
│                                                                     │
│  终止条件（优先级）:                                                 │
│    1. SUCCESS: ≥ 10 个达标                                          │
│    2. MANUAL STOP: 用户手动停止                                     │
│    3. MAX CYCLES: 达到 50 轮                                        │
│    4. STAGNATION: 10 cycle 内 Sharpe 提升 < 0.1                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.3 5-Agent 详解

| Agent | 职责 | LLM/规则比 |
|-------|------|-----------|
| **Agent 1: 诊断** | 识别症状（P5>P4>P3 优先级）：high_turnover, low_fitness, high_correlation, weight_concentration, low_sharpe | LLM ~100% |
| **Agent 2: 策略规划** | 根据诊断选优化策略（"Add ts_decay_linear", "Change field"），预估改善效果 | LLM ~100% |
| **Agent 3: 变体生成** | 4 个候选库 + 第一定律检查 + 经济窗口验证 + 操作符参数验证 → 8 个变体 | **LLM ~40% + 规则 ~60%** |
| **Agent 4: 执行** | 批量回测，统一打标签 | 纯确定性 |
| **Agent 5: 评估** | 选最佳变体（Sharpe 排名），判断是否达标 | 纯确定性阈值 |

### 17.4 规则引擎部分（与 AlphaSpire 的关键进化）

```python
# 第一定律检查
❌ rank(close) + rank(volume)     # 不同归一化方法的算术运算
❌ zscore(x) * zscore(y)          # zscore 的非线性运算
❌ rank(rank(close))              # 双重归一化
✅ rank(close + volume)           # 先组合后归一化
✅ ts_rank(close, 20) * ts_rank(volume, 20)  # 时间序列 rank 可组合

# 经济窗口验证
✅ [5, 22, 66, 120, 252, 504]    # 1周/1月/1季/半年/1年/2年
❌ [7, 10, 14, 30, 60, 100, 200] # 无经济学意义

# 操作符参数验证（基于 167 个 REGULAR 操作符）
✅ divide(close, volume)          # 2 参数 → 正确
❌ divide(close)                  # 缺参数
❌ rank(close, volume)            # rank 只接受 1 参数
```

### 17.5 分层映射

```
                    5-Agent 系统
                    ━━━━━━━━━━━
L4 (工具)           BRAIN HTTP API（直接调用）+ OpenRouter API

L3.engine           ⚠️ 部分存在
(领域引擎)          167 操作符参数表 + 第一定律检查 + 经济窗口验证
                    4 个候选表达式库（Library A/B/C/D）
                    4 阶段漏斗（确定性阈值筛选）
                    停滞检测（确定性）
                    ≈ 40% 的决策由规则引擎控制

L3.infra            无
(底座)              无 Checkpoint、无 Audit、无 Evidence

L3.host             Jupyter Notebook 主循环
(宿主循环)          37 个 cell，同步执行

L3.knowledge        操作符参数 JSON（operator_params.json）
(领域知识)          字段元数据（type/category/region/delay）
                    DataChecker + DataManager 按需加载

L2 (LLM)           Gemini-2.5-Flash × 3 并发
                    通过 OpenRouter API 调用

L1 (基座)           Transformer
```

### 17.6 与 WQ-YI 的关键对比

| 能力 | 5-Agent 怎么做 | WQ-YI 怎么做 |
|------|---------------|-------------|
| 选什么 category | LLM 即兴决定 | L1 五阶段：预取能力数据 → Flash 高召回 → Pro 骨架级批审 → 硬门控 → 落盘 |
| 选什么字段 | LLM 从 150 个采样字段中选 | L2 状态机：VECTOR 过滤 → 语义门控 → Flash 选择 → 确定性评分 → Pro 仲裁 → diversity 强制 |
| alpha 不通过 | 5-Agent 优化同一表达式（换操作符/改窗口） | DiagnosisEngine 精确定位流水线步骤 → 定向回退 → 修复知识注入 |
| 诊断粒度 | **表达式层面**：high_turnover → Add ts_decay | **步骤层面**：CURATE_SKELETON_INVALID → 回退 curate |
| 跑一半崩了 | 重头来 | Checkpoint 断点续跑 |
| 上次选过什么 | 不知道 | Evidence RAG 跨步骤记忆 |
| 知识更新 | 静态（Notebook 内嵌） | field_updater 自动从 MCP 拉取最新变体数据 |

**类比**：5-Agent 是"同一个病人反复治疗（换药方）"，WQ-YI 是"先确定是哪个科室出了问题，再转科治疗"。

### 17.7 5-Agent 的独到之处

尽管 5-Agent 在治理层面远不如 WQ-YI，但它有两个值得借鉴的设计：

1. **4 个候选表达式库**（Library A/B/C/D）：按症状分类的模板库
   - Library A (Time Series)：用于 high_turnover, low_sharpe
   - Library B (Grouping)：用于 low_fitness, weight_concentration
   - Library C (Advanced)：用于特定问题
   - Library D (Transformation)：通用变换
   
   → WQ-YI 的 curate 阶段可以吸收这种"症状→操作符库"映射

2. **停滞检测**：10 cycle 内 Sharpe 提升 < 0.1 → 自动终止
   
   → WQ-YI 的 CampaignRunner 已有 `no_progress_rounds` 终止条件，但 metric-based 停滞检测可以更精细

---

## 18. 五方架构深度对比

### 18.1 全景映射

```
                Copilot        AI打工人        AlphaSpire      5-Agent         WQ-YI
                ━━━━━━━        ━━━━━━━        ━━━━━━━━━━      ━━━━━━━         ━━━━━
L4 (工具)       VS Code 15     MCP 43          BRAIN HTTP     BRAIN HTTP      MCP 43
                ✅             ✅              直接调用        + OpenRouter    ✅

L3.engine       无             无              无              部分存在        6 Subagents
(领域引擎)                                                     167 操作符表    ~15,000 行
                                                              4 候选库        Python+LLM
                                                              第一定律校验

L3.infra        无             无              无              无              _shared/ ~12,000 行
(底座)          (IDE 自带)                                                     Orchestrator
                                                                              + Campaign
                                                                              + DiagnosisEngine
                                                                              + Audit/Evidence/Gate

L3.host         VS Code Loop   Claude Code     while 循环     Notebook 循环   CampaignRunner
(宿主循环)      (Anthropic+MS)  CLI             (极简)         (37 cell)       (自建双循环)

L3.knowledge    无             14 Skills       论坛帖子质量    operator_params  6 SKILL.md
(领域知识)      (L2 训练含)     + consultant    → prompt 质量   + 字段元数据     + knowledge/
                                                                              + _semantic.yaml
                                                                              + policy.yml

L2 (LLM)       Claude(固定)    可换            DeepSeek(固定)  Gemini ×3       可换
                               效果剧烈波动                    效果中度波动    效果缓慢衰减

L1 (基座)       Transformer    Transformer     Transformer    Transformer     Transformer
```

### 18.2 控制流归属

| | Copilot | AI打工人 | AlphaSpire | 5-Agent | WQ-YI |
|---|---|---|---|---|---|
| **谁控制"下一步做什么"** | LLM | LLM | 代码(while) | LLM+代码 | 代码 |
| **谁控制"怎么做这一步"** | LLM | LLM | LLM | LLM+规则 | 代码(嵌入 LLM) |
| **LLM 决策占比** | ~100% | ~100% | ~95% | **~60%** | **~20%** |
| **确定性代码占比** | ~0% | ~0% | ~5% | **~40%** | **~80%** |
| **架构范式** | LLM-centric | LLM-centric | LLM-centric | **混合** | **Code-centric** |

### 18.3 失败处理能力

| | Copilot | AI打工人 | AlphaSpire | 5-Agent | WQ-YI |
|---|---|---|---|---|---|
| **失败后行为** | 自行修复 | 自行尝试 | **丢弃下一个** | 5-Agent 优化 | **精确诊断+定向回退** |
| **诊断机制** | LLM 自行判断 | LLM 自行判断 | 无 | Agent 1 诊断 5 症状 | DiagnosisEngine Flash+Pro 5 码 |
| **回退粒度** | 无概念 | 无概念 | 无（重头来） | 表达式层面变体 | **流水线步骤层面** |
| **修复知识注入** | 上下文累积 | 上下文累积 | 无 | 4 候选库模板 | `_repair_hint` + RAG |
| **断点续跑** | ❌ | ❌ | ❌ | ❌ | ✅ Checkpoint |
| **跨步骤记忆** | 对话窗口 | 对话窗口 | 无 | 无 | Evidence RAG |

### 18.4 确定性保证矩阵

| 机制 | Copilot | AI打工人 | AlphaSpire | 5-Agent | WQ-YI |
|------|:---:|:---:|:---:|:---:|:---:|
| Schema 校验 | 编译器 | ❌ | ❌ | ❌ | ✅ 8 个 YAML Schema |
| 第一定律检查 | — | ❌ | ❌ | ✅ | ✅ curate + gate |
| 经济窗口验证 | — | ❌ | ❌ | ✅ | ✅ knowledge/ |
| VECTOR 字段过滤 | — | ❌ | ❌ | ❌ | ✅ L2 候选构建 |
| 语义门控 | — | ❌ | ❌ | ❌ | ✅ `_semantic.yaml` |
| 多样性强制 | — | ❌ | ❌ | ❌ | ✅ `enforce_diversity` |
| 断点续跑 | ❌ | ❌ | ❌ | ❌ | ✅ Checkpoint |
| 停滞检测 | — | ❌ | ❌ | ✅ | ✅ `no_progress_rounds` |
| 审计追踪 | ❌ | ❌ | ❌ | 标签 | ✅ audit + evidence + lineage |
| reason_code 分类 | — | ❌ | ❌ | ❌ | ✅ 26 个码 |

### 18.5 类比

```
Copilot     = 给天才程序员一个 IDE，让他自由发挥
AI打工人    = 给实习生一本操作手册 + 全套工具，让他自己干一天
AlphaSpire  = 给猴子一台打字机，无限时间总能打出莎士比亚（但 99.85% 是废纸）
5-Agent     = 5 个实习生组成的车间，有基本质检但没有主管
WQ-YI       = 一条生产线上有 6 台专用机器 + 质检站 + 诊断室 + 仓库管理系统
```

---

## 19. 经济效率与通过率数据

### 19.1 通过率对比

| 来源 | 生成量 | 语法合法率 | IS 通过 | 通过率（总体） | 模型 |
|------|--------|:---:|---------|:---:|------|
| **AlphaSpire** | 2,334,887 表达式 | ~30% | ~3,500（估） | **~0.15%** | DeepSeek-chat |
| **用户实际数据** | ~10,000 IS alpha | 100%（人工筛选） | 66 OS | **0.66%** IS→OS | 混合 |
| **5-Agent** | 30/cycle × N cycles | 较高（规则校验） | 未公开 | 未公开 | Gemini-2.5-Flash |
| **手动+AI** | 少量（几十个） | 100% | 数个 | **较高**（人工筛） | DeepSeek/Kimi |

**关键规律**：
- 纯批量生成通过率极低（0.1-0.7%）
- AI 70% 的输出有语法错误（AlphaSpire 数据）
- **人工参与度越高，单 alpha 质量越高，但产量越低**
- AI 的核心价值不在"生成好 alpha"，而在"迭代修复已有 alpha 的 FAIL 项"

### 19.2 LLM 调用效率

| 系统 | LLM 调用/alpha | BRAIN 回测/alpha | 浪费率 | 适合规模 |
|------|:-:|:-:|:-:|------|
| **AlphaSpire** | 1 次 | 1 次（但 70% 无法回测） | ~99.85% | 不限（暴力） |
| **5-Agent** | 5+ 次/cycle | 4 次（4 stage） | ~80%（漏斗筛选） | 中等（50 cycle） |
| **AI打工人** | N 次（对话轮） | 按需 | ~50%? | 小（人在环） |
| **WQ-YI** | 6-12 次/完整流水线 | 按 pyramid 精确送测 | 目标 <50% | 大（无人值守） |

### 19.3 成本结构

| 系统 | Token 成本 | BRAIN API 成本 | 人工成本 | 总 TCO |
|------|-----------|---------------|---------|--------|
| **AlphaSpire** | 低（短表达式） | **极高**（233 万次回测） | 零 | 高（API 主导） |
| **5-Agent** | 中（5 Agent 多轮） | 中（4 stage × 30） | 零 | 中 |
| **AI打工人** | 中（对话轮） | 低（人工筛选后再测） | **高**（人在环） | 中（人力主导） |
| **WQ-YI** | 中高（Flash+Pro 双层 + 诊断） | **低**（预过滤后候选） | 零 | 中（自动化摊薄） |
| **手动+AI** | 低（Chrome 免费） | 低（手动筛选后） | **极高** | 高（人力主导） |

---

## 20. 信任模型光谱（修正版）

### 20.1 五点光谱

Part 1 中的三方对比现在扩展为五点光谱：

```
信任 LLM 程度 (高 → 低):

AlphaSpire   ████████████████████  100%  LLM 生成一切，无校验
AI打工人      ████████████████████  100%  LLM 读文档做决策，无强制
Copilot      ████████████████████  100%  LLM 极强但有编译器兜底
5-Agent      ████████████████      ~60%  LLM 生成+诊断，规则校验 ~40%
WQ-YI        ████                  ~20%  LLM 只在嵌入点判断，代码控制 ~80%
```

### 20.2 LLM 质量衰减曲线

```
效果保持率 (换弱 LLM 后):

               Claude     GPT-4o    DeepSeek    弱模型
               ━━━━━━     ━━━━━━    ━━━━━━━━    ━━━━━━
AlphaSpire     100%       80%       65%         30%        ← 急剧衰减
AI打工人        100%       90%       85%         70%        ← 显著衰减
5-Agent        100%       92%       85%         60%        ← 中度衰减（规则兜底部分）
WQ-YI          100%       97%       94%         85%        ← 缓慢衰减（代码兜底 80%）

衰减原因：
  AlphaSpire: LLM 生成一切 → 弱 LLM 语法错误率从 70% 升到 90%+
  AI打工人:   14 Skills 是"建议" → 弱 LLM 遵守率从 95% 降到 70%
  5-Agent:   规则引擎不衰减 → LLM 部分（生成+诊断）衰减
  WQ-YI:     代码 80% 不衰减 → LLM 20%（Flash/Pro）衰减
```

### 20.3 适用场景矩阵（五方）

| 场景 | Copilot | AI打工人 | AlphaSpire | 5-Agent | WQ-YI |
|------|:---:|:---:|:---:|:---:|:---:|
| 写 Python/Solidity | ✅ 极强 | ❌ | ❌ | ❌ | ❌ |
| 探索 1 个 Alpha 想法 | ❌ | ✅ | ❌ | ❌ | ❌ 过重 |
| 一天做 3-5 个 Alpha | ❌ | ✅ | ❌ | ✅ | ⚠️ 可用 |
| 暴力覆盖尽可能多表达式 | ❌ | ❌ | ✅ | ❌ | ❌ |
| 竞赛冲榜（AIAC 2.0） | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| 批量生产 100 个 Alpha | ❌ | ❌ 无状态 | ⚠️ 浪费大 | ⚠️ 无断点 | ✅ |
| 复盘"第 37 个为什么失败" | ❌ | ❌ | ❌ | ❌ | ✅ lineage |
| 进程崩溃后继续 | ❌ | ❌ | ❌ | ❌ | ✅ Checkpoint |
| 换便宜 LLM 省成本 | ❌ 锁定 | ⚠️ 效果剧降 | ⚠️ 效果剧降 | ⚠️ 中度降 | ✅ 缓降 |
| 多人协作审计 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 零基础新手上手 | ❌ | ✅ 双击即用 | ✅ 运行即可 | ⚠️ 需 Jupyter | ❌ 需理解架构 |
| 无人值守 7×24 | ❌ | ❌ | ✅ | ✅ | ✅ |

### 20.4 修正后的核心公式（五方）

```
┌──────────────────────────────────────────────────────────────────────┐
│                         核心发现（修正版）                             │
│                                                                      │
│  五种产品 = LLM-centric → Code-centric 光谱上的五个点：              │
│                                                                      │
│  AlphaSpire = L2(固定) × L3.host(极简)                              │
│               LLM 决策 ~100% → 暴力生成，0.15% 通过率                │
│                                                                      │
│  AI打工人   = L2(可换) × L3.knowledge(14 Skills) × L4(MCP 43)      │
│               LLM 决策 ~100% → 可用，效果随 LLM 质量剧烈波动         │
│                                                                      │
│  Copilot    = L2(极强,固定) × L3.host(专) × L4(IDE)                │
│               LLM 决策 ~100% → coding 极强（编译器兜底）              │
│                                                                      │
│  5-Agent    = L2(固定) × L3.engine(部分) × L3.knowledge(操作符表)   │
│               LLM 决策 ~60% + 规则 ~40% → 混合漏斗，效率比暴力高 10x │
│                                                                      │
│  WQ-YI      = L2(可换) × L3.engine(6 Subagents) × L3.infra         │
│               × L3.knowledge(SKILL.md) × L4(MCP 43)                 │
│               LLM 决策 ~20% → 可靠，效果随 LLM 质量缓慢衰减          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✦ AlphaSpire → 5-Agent 的进化：加入规则引擎（第一定律+经济窗口）     │
│    = 通过率提升，浪费减少，但仍无治理层                                │
│                                                                      │
│  ✦ 5-Agent → WQ-YI 的进化：把 LLM 从驾驶座移到副驾驶                │
│    = 确定性 80% + 治理层（审计/证据/门禁/断点/诊断/记忆）             │
│    = 工程投入增加 10 倍，换来 LLM 弱耦合 + 规模化可靠                 │
│                                                                      │
│  ✦ 冷静的事实：                                                       │
│    5-Agent 用 37 个 Jupyter cell 实现了 WQ-YI ~30% 的核心能力         │
│    WQ-YI 多出的 70% 投入在治理层——探索阶段无价值，生产阶段是必需品    │
│                                                                      │
│  ✦ 每种范式各有所长：                                                 │
│    暴力生成（AlphaSpire）→ 覆盖面最大，适合"碰运气"                   │
│    混合漏斗（5-Agent）  → 竞赛冲榜最佳，中等工程投入                  │
│    代码驱动（WQ-YI）    → 规模化生产最佳，需大量工程投入               │
│    手动+AI              → 单 alpha 质量最高，产量最低                  │
│                                                                      │
│  ✦ 量化领域 L2 训练数据接近零 → 越自动化，越需要代码兜底              │
│    这不是信仰问题，是 70% 语法错误率决定的工程必然                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21. 战略路线图

### 21.1 三段论

```
第 1 天:  用 AI打工人/手动+AI 探索想法
第 1 周:  用 5-Agent 模式加速迭代，沉淀领域规则
第 1 月:  把规则编码进 WQ-YI 的 L3.engine + L3.infra
第 3 月:  WQ-YI 批量执行（Phase C fix+submit 联调完成）
第 6 月:  CampaignRunner 7×24 无人值守
          同时 AI打工人/5-Agent 继续探索新方向
```

### 21.2 WQ-YI 下一步

| 优先级 | 任务 | 可借鉴 |
|:---:|------|--------|
| P0 | **Phase C: fix + submit 联调** | 5-Agent 的 Agent 1-2（诊断→策略）映射到 DiagnosisEngine |
| P0 | **Phase D: 单步→全链路真实 subagent 调试** | — |
| P1 | 症状→操作符库映射 | 5-Agent 的 Library A/B/C/D 分类思路 |
| P1 | metric-based 停滞检测细化 | 5-Agent 的"10 cycle Sharpe 提升 < 0.1" |
| P2 | arXiv/论坛自动知识更新 | collect-papers 已有，可增加定期刷新频率 |
| P3 | 免费 LLM 轮换策略 | 社区 OpenRouter/阿里云百炼/七牛云经验 |

---

## 附录 A: 论坛帖子索引

| ID | 标题 | 赞 | 核心数据点 |
|----|------|:---:|-----------|
| — | AlphaSpire 全自动 Alpha 生成工具 | 27 | 233 万表达式，DeepSeek-chat，0.5% 通过率 |
| — | MCP 实现自动找 alpha demo | 68 | FastMCP 43 工具，社区最高赞 |
| — | [AIAC2] Alpha 生成系统 | 18 | 5-Agent，Gemini-2.5-Flash ×3，4 阶段漏斗 |
| — | 利用 Gemini 从 0 到 1 手搓 IND 区 alpha | 43 | Chrome Gemini，手动迭代，IND 三步范式 |
| — | 【大角羊】AIAC2.0 比赛要点 | 25 | 40+ 官方 LLM 标签列表 |
| — | 在 Brain APP 中使用自定义大模型 | 73 | 默认 DeepSeek，换模型教程 |
| — | 我的量化之路 | 7 | DeepSeek 半自动，Sharpe>2 初筛 |
| — | 【"羊毛"合集】AI 免费资源 | 31 | 20+ 种免费 Token 来源 |
| — | AI 辅助下的量化实践分享 | 25 | AI 读论文找 Alpha |
| — | AI 提示词分享 | 32 | 直接 prompt 变体生成 |

## 附录 B: 数据采集方法

| 数据类型 | 工具 | 方法 |
|---------|------|------|
| Alpha 组合统计 | `mcp_cnhk-mcp_get_user_alphas` | 获取全量 IS/OS alpha，统计通过率/Sharpe/收益 |
| 论坛帖子 | `mcp_cnhk-mcp_search_forum_posts` + `read_forum_post` | Playwright Chromium 抓取，含评论 |
| 竞赛数据 | `mcp_cnhk-mcp_get_competition_details` | AIAC 2.0 竞赛规则和参数 |
| 学术调研 | `mcp_cnhk-mcp_search_arxiv` | 搜索 AI+quantitative+alpha 相关论文 |

> **Forum Worker 修复记录**: 初始状态 "failed to start forum worker"。根因：`cnhkmcp_server.py` 通过 `importlib.util.spec_from_file_location` 加载 `cnhkmcp_fuse.py`，但未在 `sys.modules` 注册模块，导致 Windows `multiprocessing.spawn` 模式下子进程无法 unpickle `_worker_process` 函数引用。修复：`sys.modules["cnhkmcp_fuse"] = cnhkmcp_fuse_module` + `sys.path.insert(0, _fuse_dir)`。
