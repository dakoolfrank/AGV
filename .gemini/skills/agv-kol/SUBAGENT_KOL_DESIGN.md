# SUBAGENT_KOL_DESIGN.md — S8 KOL Subagent 详细设计

> **版本**: v1.0  
> **日期**: 2026-03-12  
> **定位**: S8 KOL Subagent 的完整技术设计，补充 DESIGN.md §S8 的高层设计  
> **架构决策**: S8 是 **Subagent**（单一 Skill），类似 WQ-YI 的 `collect-papers`，而非独立 Campaign

---

## 目录

1. [架构定位](#1-架构定位)
2. [平台现状与凭据](#2-平台现状与凭据)
3. [内容管线（Content Pipeline）](#3-内容管线content-pipeline)
4. [6 步执行流程实现](#4-6-步执行流程实现)
5. [API 集成规格](#5-api-集成规格)
6. [数据模型](#6-数据模型)
7. [跨平台内容策略](#7-跨平台内容策略)
8. [安全与门禁](#8-安全与门禁)
9. [文件结构](#9-文件结构)
10. [实施路线图](#10-实施路线图)

---

## 1. 架构定位

### S8 不是独立 Agent，是 Subagent

```
Master Agent (Orchestrator)
├── S1 DevOps Agent        ← 合约审计
├── S3 Reconciliation      ← 链上对账
├── ...
└── S8 KOL Subagent        ← 社区运营（本文档）
    ├── scout()            ← Step 1: KOL 发现
    ├── outreach()         ← Step 2: 外联
    ├── review()           ← Step 3: 内容审核
    ├── publish()          ← Step 3.5: 内容发布（新增）
    ├── track()            ← Step 4: 追踪
    ├── settle()           ← Step 5: 结算
    └── archive()          ← Step 6: RAG 归档
```

**类比 WQ-YI**：

| 概念 | WQ-YI | AGV S8 |
|------|-------|--------|
| 底座 | `_shared/` | `nexrur` |
| Orchestrator | `orchestrator.py` | Master Agent |
| Subagent | `skill_collect_papers.py` | `kol_subagent.py` |
| StepOutcome | `outcome.json` | `outcome.json` |
| 产物目录 | `docs/ai-runs/collect-papers/` | `docs/ai-runs/kol/{campaign_id}/` |

### 与 Orchestrator 的接口

```python
class KOLOps:
    """AgentOps 桥接层 — S8 KOL Subagent"""
    
    def __call__(
        self,
        *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        """
        config 支持的 action:
          - "publish"   → 跨平台内容发布（最常用）
          - "scout"     → KOL 发现
          - "outreach"  → 外联
          - "track"     → 效果追踪
          - "settle"    → 结算（需门禁）
          - "daily"     → 日常内容发布（自动模式）
        """
```

---

## 2. 平台现状与凭据

### 三平台已部署状态

| 平台 | 账号 | 状态 | 邀请链接 |
|------|------|:---:|----------|
| **Twitter** | @agvnexrur | ✅ | https://x.com/agvnexrur |
| **Discord** | AGV Nexrur (Guild) | ✅ | https://discord.gg/mJKTyqWtKe |
| **Telegram** | @agvnexrur_bot | ✅ | https://t.me/agvnexrur_bot |

### Twitter (@agvnexrur)

- **User ID**: `1630201139198304257`
- **API Tier**: Basic (v2 POST/DELETE tweets ✅, v1.1 media upload ✅, v1.1 statuses ❌)
- **Profile**: AGV Nexrur / RWA Protocol on BSC / agvnexrur.ai
- **Avatar**: pGVT logo (pGVT_512.png)
- **Following**: BNB Chain, PancakeSwap + 13 others
- **Launch Tweet**: `status/2032010944461537691`（带农光互补照片）

**API 能力矩阵**：

| 操作 | API | 方法 | 限制 |
|------|-----|------|------|
| 发推（文字） | v2 `POST /2/tweets` | OAuth 1.0a | 1500/月 (Basic) |
| 发推（带图） | v1.1 `media/upload` → v2 `POST /2/tweets` | OAuth 1.0a multipart → JSON | 图片 ≤ 5MB |
| 删推 | v2 `DELETE /2/tweets/:id` | OAuth 1.0a | — |
| 关注 | v2 `POST /2/users/:id/following` | OAuth 1.0a | — |
| 查用户 | v2 `GET /2/users/by/username/:name` | Bearer Token | — |
| 查推文 | v2 `GET /2/users/:id/tweets` | Bearer Token | — |
| 更新 Profile | v1.1 `POST /account/update_profile` | OAuth 1.0a | — |
| 上传头像 | v1.1 `POST /account/update_profile_image` | OAuth 1.0a multipart | — |
| ❌ 置顶推文 | 无 API | — | 需手动 |
| ❌ 创建 Thread | v2 `POST /2/tweets` + `reply.in_reply_to_tweet_id` | OAuth 1.0a | 需链式调用 |

**OAuth 1.0a 签名**：HMAC-SHA1，v2 JSON body 不参与签名基字符串。

### Discord (AGV Nexrur)

- **Guild ID**: `1481516148054036597`
- **Bot**: agvnexrur projects (`1481291634556538921`)
- **Bot Permissions**: Administrator (`9007199254740991`)
- **API**: v10, **必须用 `curl` subprocess**（Cloudflare 1010 拒绝 Python urllib）

**频道结构**：

```
「 Welcome 」
  ├── 📢-announcements (read-only)    → 欢迎消息 ✅
  ├── 📜-rules (read-only)           → 7 条规则 ✅
  └── 🎫-verify
「 General 」
  ├── 💬-general-chat                → 永久邀请链接来源
  ├── 🖼-memes
  └── 📊-price-talk
「 Project 」
  ├── 🔗-contracts (read-only)       → 官方合约地址 ✅
  ├── ⚡-rwa-updates
  └── 💡-feature-requests
「 Token 」
  ├── 🪙-pgvt-sgvt
  ├── 🎁-airdrop
  └── 🔒-staking
「 Support 」
  ├── 🆘-help
  ├── 🐛-bug-reports
  └── 📋-feedback
「 Voice 」
  ├── 🔊 General Voice
  └── 🎧 AMA
```

**5 自定义角色**：Team (红/Admin), KOL (金), Verified (绿), Investor (蓝), Community (灰)

**关键频道 ID**：

| 频道 | ID | 用途 |
|------|-----|------|
| 📢-announcements | `1481560858625839208` | Bot 发公告 |
| 🔗-contracts | `1481559985505701938` | 合约地址更新 |
| ⚡-rwa-updates | `1481559994544685108` | RWA 进展推送 |
| 🪙-pgvt-sgvt | `1481560001570013306` | Token 动态 |
| 🎁-airdrop | `1481560004132868178` | 空投通知 |

### Telegram (@agvnexrur_bot)

- **Bot ID**: `8409879429`
- **Name**: AGV Nexrur
- **Commands**: start, price, contracts, airdrop, website, help
- **Menu Button**: 🌐 Website → agvnexrur.ai
- **Description**: AGV Protocol — Real World Asset (RWA) Tokenization on BSC

**API 能力**：

| 操作 | 方法 | 说明 |
|------|------|------|
| 发消息 | `sendMessage` | 支持 Markdown / HTML |
| 发图片 | `sendPhoto` | 文件或 URL |
| 编辑消息 | `editMessageText` | 已发消息修改 |
| 设命令 | `setMyCommands` | 菜单命令列表 |
| Inline Keyboard | `sendMessage` + `reply_markup` | 行内按钮 |
| Webhook | `setWebhook` | 事件推送（可选） |

**限制**：Bot 不能主动发消息给用户（需用户先 /start），但可以在 Group/Channel 中发消息。

---

## 3. 内容管线（Content Pipeline）

### 核心流程

```
[内容触发源]          [内容生成]              [审核]            [发布]
                                                              
链上事件 ──┐                                                   ├→ Twitter (tweet)
RWA 进展 ──┼→ LLM 生成内容 → 格式适配 ×3 → Auto-Review → Gate → ├→ Discord (#announcements embed)
定时计划 ──┤   (Gemini/Claude)   │            │                 └→ Telegram (message + keyboard)
手动触发 ──┘                     │            │
                                 │            │
                          content_draft.json  review_result
                                              pass / revise / reject
```

### 内容触发源（5 类）

| 触发源 | 频率 | 示例 |
|--------|------|------|
| **链上事件** | 实时 | 大额转账、LP 变动、新 LP pair |
| **RWA 进展** | 每周 | 新站点接入、发电量里程碑、合规更新 |
| **项目更新** | 不定期 | 新合约部署、前端更新、合作公告 |
| **定时内容** | 每日/每周 | #DailyAlpha、周报、月报 |
| **手动触发** | 按需 | 紧急公告、AMA 预告 |

### 内容模板类型

| 模板 | Twitter | Discord | Telegram | 频率 |
|------|---------|---------|----------|------|
| `launch_announcement` | 带图推文 | Embed (green) | Photo + Inline KB | 一次性 |
| `token_update` | 文字推文 | Embed (blue) → #pgvt-sgvt | Message | 每周 |
| `rwa_milestone` | 带图推文 + Thread | Embed (gold) → #rwa-updates | Photo + 链接 | 不定期 |
| `airdrop_alert` | 文字推文 | Embed (purple) → #airdrop | Message + Button | 不定期 |
| `weekly_recap` | Thread (3-5 条) | Embed (gray) → #announcements | Long message | 每周 |
| `ama_promo` | 文字推文 | @everyone → #announcements | Pinned message | 不定期 |
| `contract_deploy` | 文字推文 | Embed (red) → #contracts | Message + 地址 | 不定期 |
| `daily_alpha` | 文字推文 | — | — | 每日（可选） |

---

## 4. 6 步执行流程实现

### Step 1: Scout（KOL 发现）

```python
def scout(config: dict) -> list[KOLCandidate]:
    """
    数据源优先级:
    1. Twitter v2 search (Bearer Token) — 关键词: #RWA #BSC #SolarEnergy #DeFi
    2. Discord 成员分析 — 活跃度 / 发言质量
    3. 手动名单 — config.explicit_kols
    
    输出: kol_candidates.yml
    """
```

**评分维度**：

| 维度 | 权重 | 数据源 | 计算 |
|------|------|--------|------|
| 粉丝量 | 20% | Twitter `public_metrics.followers_count` | log10 归一化 |
| 互动率 | 30% | (likes + retweets + replies) / followers | 最近 20 条推文平均 |
| 行业相关性 | 30% | LLM 对 bio + 最近内容的语义评分 | 0-1 |
| 地域匹配 | 10% | Profile location | 中国/东南亚优先 |
| 历史合作 | 10% | RAG 检索 evidence.jsonl | 0-1 |

**Twitter Search API 限制（Basic Tier）**：

| 端点 | 限制 | 说明 |
|------|------|------|
| `GET /2/tweets/search/recent` | 1 req/sec, 60 req/15min | 仅最近 7 天 |
| `GET /2/users/:id/tweets` | 1 req/sec, 900 req/15min | 用户时间线 |

### Step 2: Outreach（外联）

```python
def outreach(kols: list[KOLCandidate], config: dict) -> OutreachLog:
    """
    渠道优先级:
    1. Twitter DM (如果 KOL 开放 DM) — 需 Pro tier，当前不可用
    2. Discord DM (如果 KOL 在 Guild 中)
    3. Brevo 邮件 (如果有邮箱)
    4. Telegram (如果有 username)
    
    门禁: 单次 ≤ 10 条自动，> 10 条需人工确认
    """
```

**当前可用渠道**：

| 渠道 | API | 可用 | 限制 |
|------|-----|:---:|------|
| Twitter DM | v2 `POST /dm_conversations` | ❌ | 需 Pro tier ($5000/月) |
| Discord DM | `POST /users/@me/channels` → `POST /channels/:id/messages` | ✅ | Bot 只能 DM 已互动用户 |
| Brevo 邮件 | REST API | ✅ | 300 封/天 (免费), BREVO_API_KEY 已配置 |
| Telegram | `sendMessage` | ✅ | 用户需先 /start |

### Step 3: Review（内容审核）

```python
def review(content: ContentDraft) -> ReviewResult:
    """
    自动审核清单:
    1. 品牌一致性: 项目名称正确 (AGV Nexrur / AGV Protocol)
    2. 合约地址正确: 与 contracts.yml 对比
    3. 价格数据: 如提及价格，验证 ≤ 1 小时内
    4. 合规声明: "NFA" / "DYOR" 存在 (如涉及投资建议)
    5. 链接有效: URL 可达 (http 200)
    6. 无敏感词: 禁止 "guarantee" / "100% return" / "risk-free"
    
    输出: pass / revision_needed / reject
    """
```

### Step 3.5: Publish（内容发布 — 最常用入口）

```python
def publish(content: ContentDraft, platforms: list[str] = None) -> PublishResult:
    """
    跨平台发布:
    1. 按平台适配格式
    2. Twitter: 上传图片(可选) → 发推
    3. Discord: 构建 Embed → 发到指定频道
    4. Telegram: 构建消息 + Inline Keyboard → 发送
    
    默认: platforms=["twitter", "discord", "telegram"]
    """
```

**发布流程详细**：

```
ContentDraft
  │
  ├─ adapt_twitter(draft) → TweetPayload
  │   ├── text ≤ 280 chars (含 hashtags)
  │   ├── media_ids (如有图片)
  │   └── v2 POST /2/tweets
  │
  ├─ adapt_discord(draft) → DiscordEmbed
  │   ├── title, description, color, fields
  │   ├── thumbnail (可选)
  │   └── POST /channels/{channel_id}/messages
  │
  └─ adapt_telegram(draft) → TelegramMessage
      ├── text (Markdown), parse_mode="MarkdownV2"
      ├── reply_markup (InlineKeyboardMarkup)
      └── POST /bot{token}/sendMessage
```

### Step 4: Track（效果追踪）

```python
def track(campaign_id: str) -> PerformanceMetrics:
    """
    数据源:
    1. Twitter: public_metrics (impressions, likes, retweets, replies)
    2. Discord: message reaction count + guild member growth
    3. Telegram: message views (仅 channel)
    4. UTM: Vercel Analytics / Bitly API (如启用)
    """
```

**Twitter 指标获取**：

```python
# v2 GET /2/tweets/:id?tweet.fields=public_metrics
# → impression_count, like_count, retweet_count, reply_count, quote_count
```

### Step 5: Settle（结算）

**强制人工确认**，Agent 仅生成支付清单。

```python
def settle(campaign_id: str) -> SettlementProposal:
    """
    1. 从 performance_metrics 计算 KOL 报酬
    2. 生成 settlement_proposal.json
    3. 输出到 stdout + 写文件 → 等待人工确认
    4. 人工确认后调用 cast send 执行转账
    
    ⚠️ Agent 禁止自主执行链上转账
    """
```

### Step 6: Archive（RAG 归档）

```python
def archive(campaign_id: str) -> None:
    """
    1. 所有 campaign 产物写入 evidence.jsonl
    2. RAG 自动索引 (如启用)
    3. outcome.json finalize
    """
```

---

## 5. API 集成规格

### Twitter API 调用封装

```python
class TwitterClient:
    """Twitter API v2 + v1.1 混合客户端"""
    
    def __init__(self, api_key, api_secret, access_token, access_secret, bearer):
        self._keys = (api_key, api_secret, access_token, access_secret)
        self._bearer = bearer
    
    def post_tweet(self, text: str, media_ids: list[str] = None) -> dict:
        """v2 POST /2/tweets (OAuth 1.0a)"""
        
    def upload_media(self, file_path: str) -> str:
        """v1.1 POST upload.twitter.com/1.1/media/upload.json → media_id_string"""
        
    def delete_tweet(self, tweet_id: str) -> bool:
        """v2 DELETE /2/tweets/:id"""
        
    def get_user_tweets(self, user_id: str, max_results: int = 10) -> list:
        """v2 GET /2/users/:id/tweets (Bearer Token)"""
        
    def search_recent(self, query: str, max_results: int = 10) -> list:
        """v2 GET /2/tweets/search/recent (Bearer Token)"""
    
    def follow_user(self, target_user_id: str) -> bool:
        """v2 POST /2/users/:id/following"""
    
    def _oauth_sign(self, method: str, url: str, params: dict) -> str:
        """OAuth 1.0a HMAC-SHA1 签名"""
```

**关键实现细节**：
- v2 JSON body **不**参与 OAuth 签名基字符串
- v1.1 multipart form **不**参与签名（使用空 params）
- Bearer Token 用于只读操作（search、get）
- OAuth 1.0a 用于写操作（tweet、delete、follow、media upload）

### Discord API 调用封装

```python
class DiscordClient:
    """Discord Bot API v10 — 使用 curl subprocess（绕过 Cloudflare 1010）"""
    
    def __init__(self, bot_token: str, guild_id: str):
        self._token = bot_token
        self._guild_id = guild_id
    
    def send_message(self, channel_id: str, content: str = None, 
                     embeds: list[dict] = None) -> dict:
        """POST /channels/{channel_id}/messages"""
        
    def send_embed(self, channel_id: str, title: str, description: str,
                   color: int = 0x2ECC71, **kwargs) -> dict:
        """便捷方法: 发送单个 Embed"""
    
    def get_guild_members(self, limit: int = 100) -> list:
        """GET /guilds/{guild_id}/members"""
    
    def create_invite(self, channel_id: str, max_age: int = 0) -> str:
        """POST /channels/{channel_id}/invites → discord.gg/{code}"""
    
    def _api(self, method: str, path: str, json_body: dict = None) -> dict:
        """curl subprocess 封装 — Cloudflare 兼容"""
```

**⚠️ 强制约束**：所有 Discord API 调用必须通过 `subprocess.run(['curl', ...])` 执行，Python 标准库的 `urllib`/`requests` 被 Cloudflare 1010 拒绝。

### Telegram API 调用封装

```python
class TelegramClient:
    """Telegram Bot API"""
    
    def __init__(self, bot_token: str):
        self._token = bot_token
        self._base = f'https://api.telegram.org/bot{bot_token}'
    
    def send_message(self, chat_id: str, text: str, 
                     parse_mode: str = 'MarkdownV2',
                     reply_markup: dict = None) -> dict:
        """POST /sendMessage"""
        
    def send_photo(self, chat_id: str, photo: str, 
                   caption: str = None) -> dict:
        """POST /sendPhoto (photo = file_id 或 URL)"""
    
    def edit_message(self, chat_id: str, message_id: int,
                     text: str) -> dict:
        """POST /editMessageText"""
    
    def _api(self, method: str, params: dict = None) -> dict:
        """curl subprocess 封装"""
```

---

## 6. 数据模型

### ContentDraft（内容草稿）

```yaml
# content_draft.yml
id: "cd-2026-03-12-001"
type: "rwa_milestone"          # 对应内容模板类型
trigger: "manual"              # chain_event | rwa_progress | scheduled | manual
status: "draft"                # draft | reviewed | published | failed

content:
  title: "AGV Nexrur — 首批光伏站点接入 BSC"
  body: |
    首批 10MW 光伏电站已完成链上登记。
    发电数据将通过 AGVOracle 实时上链，为 RWA Token 提供透明收益锚定。
  hashtags: ["#RWA", "#BSC", "#SolarEnergy", "#DeFi"]
  image_path: "tokencontracts-main/assets/icons/agv.jpg"  # 可选
  links:
    website: "https://agvnexrur.ai"
    bscscan: "https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9"

platform_adapts:
  twitter:
    text: "☀️ AGV Nexrur — 首批光伏站点接入 BSC\n\n10MW 发电数据 → AGVOracle → 链上\npGVT & sGVT 收益锚定\n\n🌐 agvnexrur.ai\n\n#RWA #BSC #SolarEnergy #DeFi"
    media_ids: []              # 发布后回填
  discord:
    channel_id: "1481559994544685108"  # ⚡-rwa-updates
    embed:
      title: "☀️ 首批光伏站点接入 BSC"
      description: "10MW 光伏电站已完成链上登记..."
      color: 0xF1C40F          # Gold
  telegram:
    text: "☀️ *AGV Nexrur — 首批光伏站点接入 BSC*\n\n..."
    reply_markup:
      inline_keyboard:
        - [{ text: "🌐 Website", url: "https://agvnexrur.ai" }]
        - [{ text: "📊 BscScan", url: "https://bscscan.com/token/0x8F9EC8..." }]

publish_results:
  twitter: { tweet_id: null, published_at: null }
  discord: { message_id: null, published_at: null }
  telegram: { message_id: null, published_at: null }
```

### KOLCandidate（KOL 候选人）

```yaml
# kol_candidates.yml
- id: "kol-001"
  platform: "twitter"
  username: "example_kol"
  user_id: "123456789"
  display_name: "Example KOL"
  metrics:
    followers: 50000
    engagement_rate: 0.035
    relevance_score: 0.82
    geo_match: 0.9
  total_score: 0.73
  tags: ["RWA", "solar", "BSC"]
  status: "discovered"           # discovered | contacted | active | paused | rejected
  contact_history: []
```

### CampaignRecord（活动记录）

```yaml
# campaign_record.yml
campaign_id: "camp-2026-03-weekly-01"
type: "weekly_recap"
created_at: "2026-03-12T10:00:00Z"
status: "completed"              # draft | active | completed | failed

content_ids: ["cd-2026-03-12-001", "cd-2026-03-12-002"]
kol_ids: []                      # 如涉及 KOL 推广

metrics:
  twitter:
    impressions: 1234
    likes: 56
    retweets: 12
    replies: 3
  discord:
    reactions: 45
    new_members: 8
  telegram:
    views: 0                     # Bot 无法统计私聊 views

settlement: null                 # 或 settlement_record.json 路径
```

---

## 7. 跨平台内容策略

### 平台特性适配

| 维度 | Twitter | Discord | Telegram |
|------|---------|---------|----------|
| **字符限制** | 280 | 4096 (embed desc) | 4096 |
| **格式** | 纯文本 + 链接 + 图片 | Rich Embed (标题/描述/字段/颜色) | Markdown / HTML |
| **图片** | 1-4 张 (media_ids) | Embed thumbnail/image | sendPhoto |
| **互动** | Like/RT/Reply | Reaction + Thread | Inline Keyboard + Reply |
| **受众** | 公开（全球） | 封闭（Guild 成员） | 半封闭（Bot 用户） |
| **SEO** | Hashtags 关键 | 无 | 无 |
| **最佳发布时间** | UTC 14:00-16:00 (亚洲晚) | 随时 | 随时 |

### 内容分层策略

```
L1 核心信息 ← 三平台共享（事实/数据/链接）
  │
  ├─ L2 Twitter 适配
  │   ├── 280 字符压缩
  │   ├── 添加 hashtags
  │   ├── 图片优先（提升传播）
  │   └── Thread 用于长内容
  │
  ├─ L2 Discord 适配
  │   ├── Rich Embed 完整展示
  │   ├── 颜色编码按类型
  │   ├── @role mention (重大公告)
  │   └── 详细数据在 fields 中
  │
  └─ L2 Telegram 适配
      ├── Markdown 格式
      ├── Inline Keyboard 按钮
      ├── 中英双语可选
      └── 长内容不需压缩
```

### 颜色编码规范（Discord Embed）

| 类型 | 颜色 | Hex | 用途 |
|------|------|-----|------|
| 公告 | 🟢 Green | `0x2ECC71` | 一般公告、欢迎 |
| Token | 🔵 Blue | `0x3498DB` | pGVT/sGVT 动态 |
| RWA | 🟡 Gold | `0xF1C40F` | RWA 里程碑 |
| 空投 | 🟣 Purple | `0x9B59B6` | 空投活动 |
| 合约 | 🔴 Red | `0xE74C3C` | 合约部署/升级 |
| 周报 | ⚪ Gray | `0x95A5A6` | 定期汇总 |
| 紧急 | 🟠 Orange | `0xE67E22` | 安全警报 |

### 发布频率建议

| 内容类型 | 频率 | Twitter | Discord | Telegram |
|----------|------|:---:|:---:|:---:|
| 项目公告 | 不定期 | ✅ | ✅ | ✅ |
| Token 更新 | 每周 | ✅ | ✅ | ✅ |
| RWA 里程碑 | 不定期 | ✅ | ✅ | ✅ |
| 周报 | 每周 | ✅ (Thread) | ✅ | ✅ |
| Daily Alpha | 每日（可选） | ✅ | — | — |
| 互动帖 | 2-3 次/周 | ✅ | ✅ | — |
| AMA 预告 | 不定期 | ✅ | ✅ | ✅ |

---

## 8. 安全与门禁

### 分级权限

| 操作 | Agent 权限 | 门禁级别 | 说明 |
|------|-----------|---------|------|
| 内容生成 | ✅ 完全自主 | — | LLM 生成 + 自动审核 |
| 内容发布（Twitter） | ✅ 自主 | P0 Outcome | 单条自动，Thread 自动 |
| 内容发布（Discord） | ✅ 自主 | P0 Outcome | Bot 权限已配置 |
| 内容发布（Telegram） | ✅ 自主 | P0 Outcome | Bot 权限已配置 |
| KOL 发现 | ✅ 完全自主 | — | 只读 API |
| 外联发送 | ⚠️ 有限自主 | 单次 ≤ 10 | > 10 需人工确认 |
| Token 结算 | ❌ 禁止自主 | **强制人工** | Agent 只生成 proposal |
| 角色分配 | ⚠️ 有限自主 | 仅 Verified/Community | Team/KOL 需人工 |

### 凭据管理

```
.env.local (不入库)
├── TWITTER_API_KEY
├── TWITTER_API_KEY_SECRET
├── TWITTER_ACCESS_TOKEN
├── TWITTER_ACCESS_TOKEN_SECRET
├── TWITTER_BEARER_TOKEN
├── DISCORD_BOT_TOKEN
├── DISCORD_GUILD_ID
├── TELEGRAM_BOT_TOKEN
└── BREVO_API_KEY
```

**凭据加载**：从 `.env.local` → `settings.py` 统一加载，禁止硬编码。

### Rate Limit 防护

| 平台 | 限制 | 策略 |
|------|------|------|
| Twitter v2 | 1500 tweets/月 (Basic) | 计数器 + 月初重置 |
| Twitter v2 | 1 req/sec | 每次调用后 sleep(1.1) |
| Discord | 50 req/sec (global) | 读取 `X-RateLimit-*` headers |
| Telegram | 1 msg/sec per chat, 30 msg/sec global | 批量发送加延时 |
| Brevo 免费 | 300 封/天 | 计数器 + 日重置 |

### 内容安全检查清单

```python
CONTENT_BLOCKLIST = [
    "guarantee",        # 禁止: 保证收益
    "100% return",      # 禁止: 确定性回报
    "risk-free",        # 禁止: 无风险
    "guaranteed profit", # 禁止
    "moonshot",         # 避免: 过度炒作
    "WAGMI",            # 避免: meme 文化
    "pump",             # 避免
]

CONTENT_REQUIRED = {
    "investment_mention": ["NFA", "DYOR", "Not Financial Advice"],
    # 如内容提及投资/收益，必须包含免责声明
}
```

---

## 9. 文件结构

### 代码位置（待建）

```
AGV/
├── agv_agents/                      # Agent 框架（待建）
│   ├── __init__.py
│   ├── config/
│   │   ├── kol_platforms.yml        # 平台配置（频道映射、模板、限制）
│   │   └── content_templates.yml    # 内容模板库
│   ├── clients/
│   │   ├── twitter_client.py        # Twitter API v2 + v1.1
│   │   ├── discord_client.py        # Discord Bot API v10 (curl)
│   │   └── telegram_client.py       # Telegram Bot API
│   └── L3/
│       └── kol_subagent.py          # S8 KOL Subagent 主文件
├── docs/
│   └── ai-runs/
│       └── kol/                     # KOL 运行产物
│           └── {campaign_id}/
│               ├── content_drafts/  # 内容草稿
│               ├── kol_candidates.yml
│               ├── outreach_log.jsonl
│               ├── performance_metrics.jsonl
│               ├── outcome.json     # P0
│               ├── audit.jsonl      # P1
│               └── evidence.jsonl   # P2
└── SUBAGENT_KOL_DESIGN.md          # 本文件
```

### 配置文件

```yaml
# agv_agents/config/kol_platforms.yml
twitter:
  user_id: "1630201139198304257"
  username: "agvnexrur"
  api_tier: "basic"
  monthly_tweet_limit: 1500
  default_hashtags: ["#RWA", "#BSC", "#DeFi", "#SolarEnergy", "#Web3"]

discord:
  guild_id: "1481516148054036597"
  bot_id: "1481291634556538921"
  invite_url: "https://discord.gg/mJKTyqWtKe"
  channels:
    announcements: "1481560858625839208"
    contracts: "1481559985505701938"
    rwa_updates: "1481559994544685108"
    pgvt_sgvt: "1481560001570013306"
    airdrop: "1481560004132868178"
    general_chat: "1481559976995459125"
  roles:
    team: "1481559941138485299"
    kol: "1481559944313704510"
    verified: "1481559947530469428"
    investor: "1481559950344982639"
    community: "1481559953310351411"

telegram:
  bot_id: "8409879429"
  bot_username: "agvnexrur_bot"
  # chat_id: 需用户/群组先与 Bot 互动后获取
```

---

## 10. 实施路线图

### Phase 0: 基础设施（当前已完成）

| 任务 | 状态 | 说明 |
|------|:---:|------|
| Twitter 账号配置 | ✅ | Profile, avatar, launch tweet |
| Discord 服务器搭建 | ✅ | 6 categories, 17 channels, 5 roles, welcome messages |
| Telegram Bot 配置 | ✅ | Commands, description, menu button |
| 永久邀请链接 | ✅ | discord.gg/mJKTyqWtKe |
| API 凭据验证 | ✅ | 三平台全部通过 |

### Phase 1: API Client 层

| 任务 | 优先级 | 说明 |
|------|:---:|------|
| `twitter_client.py` | P0 | OAuth 1.0a 签名 + v2/v1.1 混合调用 |
| `discord_client.py` | P0 | curl subprocess 封装 + Embed 构建器 |
| `telegram_client.py` | P0 | 标准 HTTP 调用 + Markdown 格式 |
| 单元测试 | P0 | Mock API 响应 |

### Phase 2: Content Pipeline

| 任务 | 优先级 | 说明 |
|------|:---:|------|
| ContentDraft 数据模型 | P0 | YAML 序列化 + Schema 校验 |
| 跨平台适配器 | P0 | adapt_twitter / adapt_discord / adapt_telegram |
| 内容模板库 | P1 | 8 种模板 YAML 化 |
| LLM 内容生成 | P1 | Gemini/Claude 接入 |
| Auto-Review | P1 | 品牌/合约/合规自动检查 |

### Phase 3: KOL 全生命周期

| 任务 | 优先级 | 说明 |
|------|:---:|------|
| Scout 评分引擎 | P2 | Twitter search + LLM 评分 |
| Outreach 自动外联 | P2 | Brevo 邮件 + Discord DM |
| Track 效果追踪 | P2 | Twitter metrics + Discord growth |
| Settle 结算提案 | P3 | 支付清单生成（只生成，不执行） |
| RAG 知识归档 | P3 | evidence.jsonl → FAISS 索引 |

### Phase 4: 与 Master Agent 集成

| 任务 | 优先级 | 说明 |
|------|:---:|------|
| `KOLOps` 桥接类 | P2 | 实现 AgentOps 协议 |
| nexrur StepOutcome 集成 | P2 | P0/P1/P2 治理接入 |
| Master Agent 编排 | P3 | 跨 Agent 协调 |

---

## 附录: 已发布内容记录

| 平台 | ID | 类型 | 日期 | 备注 |
|------|-----|------|------|------|
| Twitter | `2032010944461537691` | launch_announcement | 2026-03-12 | 带农光互补照片 |
| Discord | (announcements) | welcome | 2026-03-12 | 欢迎 Embed |
| Discord | (rules) | rules | 2026-03-12 | 7 条规则 |
| Discord | (contracts) | contract_info | 2026-03-12 | pGVT/sGVT/Badge 地址 |
| Telegram | — | bot_config | 2026-03-12 | 6 commands + description |

---

> **维护者**: S8 KOL Subagent (待实现) / 人工  
> **前置依赖**: nexrur pip 包 (Phase 0) → agv_agents 骨架 (Phase 1)  
> **参考实现**: WQ-YI `skill_collect_papers.py` (Subagent 模式范本)
