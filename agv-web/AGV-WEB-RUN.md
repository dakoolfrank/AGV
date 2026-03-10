# AGV Web 部署指南

> **版本**: v1.0 (2026-03-10)  
> **域名**: `agvnexrur.ai` (主) / `.com` / `.io` / `.org`  
> **平台**: Vercel + Cloudflare DNS  
> **仓库**: `dakoolfrank/AGV`（monorepo，Root 在 `agv-web/`）

---

## 目录

1. [域名 → 项目映射](#1-域名--项目映射)
2. [架构全景图](#2-架构全景图)
3. [DNS 配置（Cloudflare）](#3-dns-配置cloudflare)
4. [Vercel 项目创建（7 个）](#4-vercel-项目创建7-个)
5. [环境变量配置](#5-环境变量配置)
6. [Build Command 配置](#6-build-command-配置)
7. [301 跳转配置](#7-301-跳转配置)
8. [部署顺序与排障](#8-部署顺序与排障)
9. [已知问题与踩坑记录](#9-已知问题与踩坑记录)
10. [各项目技术栈矩阵](#10-各项目技术栈矩阵)

---

## 1. 域名 → 项目映射

```
agvnexrur.ai (主品牌)
├── agvnexrur.ai             → agv-protocol-app     (主 DApp: NFT + rGGP + PowerToMint)
├── invest.agvnexrur.ai      → investor-portal       (投资者仪表盘)
├── buy.agvnexrur.ai         → buy-page              (NFT 购买页)
├── fund.agvnexrur.ai        → G3-Funding            (GVT 融资/Staking)
├── assets.agvnexrur.ai      → asset                 (资产地理展示)
├── docs.agvnexrur.ai        → architecture          (架构文档站)
└── api.agvnexrur.ai         → agv-taskon-verification (Serverless API)

agvnexrur.com  → 301 redirect → agvnexrur.ai
agvnexrur.io   → 301 redirect → agvnexrur.ai
agvnexrur.org  → 301 redirect → agvnexrur.ai
```

**为什么子域名而非多 TLD 分发**：
- SSL 证书统一管理（Vercel 自动签发 `*.agvnexrur.ai`）
- Cookie/Session 可共享 `.agvnexrur.ai`（Firebase Auth 跨 App SSO）
- SEO 权重集中在一个主域
- 用户认知一致

---

## 2. 架构全景图

```
┌─── 用户访问 ───────────────────────────────────────────────────┐
│                                                                 │
│  agvnexrur.ai             → 主 DApp (NFT/rGGP/PowerToMint)    │
│  invest.agvnexrur.ai      → 投资者仪表盘                       │
│  buy.agvnexrur.ai         → NFT 购买入口                       │
│  fund.agvnexrur.ai        → GVT 融资/Staking                  │
│  assets.agvnexrur.ai      → 资产地理展示                       │
│  docs.agvnexrur.ai        → 架构文档站                         │
│  api.agvnexrur.ai         → TaskOn 验证 API                    │
│                                                                 │
│  agvnexrur.com ─┐                                              │
│  agvnexrur.io  ─┼──→ 301 → agvnexrur.ai                      │
│  agvnexrur.org ─┘                                              │
│                                                                 │
├─── Cloudflare (DNS + CDN + DDoS) ──────────────────────────────┤
│                                                                 │
├─── Vercel (Hosting × 7 项目) ──────────────────────────────────┤
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │protocol  │ │investor  │ │buy-page  │ │G3-Fund   │          │
│  │-app      │ │-portal   │ │          │ │-ing      │          │
│  │Next 15   │ │Next 15   │ │Next 15   │ │Next 14   │          │
│  │React 18  │ │React 19  │ │React 19  │ │React 18  │          │
│  │ethers.js │ │—         │ │viem      │ │thirdweb  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐                      │
│  │asset     │ │architec- │ │taskon-api │                      │
│  │Next 15   │ │ture      │ │Serverless │                      │
│  │React 19  │ │Next 15   │ │Node.js    │                      │
│  │Maps API  │ │React 19  │ │Notion API │                      │
│  └──────────┘ └──────────┘ └───────────┘                      │
│                                                                 │
├─── 链上交互 ───────────────────────────────────────────────────┤
│  BSC Mainnet (Chain 56)                                         │
│  ├── pGVT   0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9        │
│  ├── sGVT   0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3        │
│  └── NFT Pass Contracts (SeedPass/TreePass/SolarPass/Compute)  │
│                                                                 │
├─── 后端服务 ───────────────────────────────────────────────────┤
│  Firebase (Auth + Firestore + Storage)                          │
│  Upstash Redis (缓存/会话)                                      │
│  Brevo (邮件通知)                                               │
│  Moralis (链上数据索引)                                          │
│  Notion (TaskOn 验证)                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DNS 配置（Cloudflare）

> **推荐用 Cloudflare 做 DNS**：免费、CDN 加速、DDoS 防护、Page Rules 301 跳转一步搞定。

### agvnexrur.ai（主域名）

| 类型 | 名称 | 值 | 代理 |
|------|------|-----|------|
| `A` | `@` | `76.76.21.21` | ✅ 开启 |
| `CNAME` | `www` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `invest` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `buy` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `fund` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `assets` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `docs` | `cname.vercel-dns.com` | ✅ |
| `CNAME` | `api` | `cname.vercel-dns.com` | ✅ |

### agvnexrur.com / .io / .org（301 跳转）

| 类型 | 名称 | 值 | 代理 |
|------|------|-----|------|
| `A` | `@` | `76.76.21.21` | ✅ |
| `CNAME` | `www` | `cname.vercel-dns.com` | ✅ |

301 跳转通过 Cloudflare Page Rules 或 Vercel redirects 实现（见 §7）。

---

## 4. Vercel 项目创建（7 个）

所有项目共用同一个 GitHub 仓库 `dakoolfrank/AGV`，通过不同 Root Directory 区分。

| # | Vercel 项目名 | Root Directory | 自定义域名 | Framework |
|---|---------------|----------------|-----------|-----------|
| 1 | `agv-protocol-app` | `agv-web/agv-protocol-app` | `agvnexrur.ai` + `www.agvnexrur.ai` | Next.js |
| 2 | `agv-investor-portal` | `agv-web/investor-portal` | `invest.agvnexrur.ai` | Next.js |
| 3 | `agv-buy-page` | `agv-web/buy-page` | `buy.agvnexrur.ai` | Next.js |
| 4 | `agv-g3-funding` | `agv-web/G3-Funding` | `fund.agvnexrur.ai` | Next.js |
| 5 | `agv-asset` | `agv-web/asset` | `assets.agvnexrur.ai` | Next.js |
| 6 | `agv-architecture` | `agv-web/architecture` | `docs.agvnexrur.ai` | Next.js |
| 7 | `agv-taskon-api` | `agv-web/public/agv-taskon-verification` | `api.agvnexrur.ai` | Other |

### 创建步骤

1. Vercel Dashboard → **Add New → Project**
2. Import Git Repository → 选择 `dakoolfrank/AGV`
3. **Root Directory** → 填对应路径（如 `agv-web/agv-protocol-app`）
4. **Framework Preset** → Next.js（taskon-api 选 Other）
5. 配置环境变量（见 §5）
6. 配置 Build Command（见 §6）
7. Deploy

---

## 5. 环境变量配置

### 5.1 Firebase Admin SDK（服务端，3 个 — 构建必需）

> ⚠️ **不配这 3 个，build 必崩**（`firebaseAdmin.ts` 的 `must()` 函数在 SSR 阶段强制校验）

| Key | 来源 | 示例值 |
|-----|------|--------|
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → General | `agv-web-b0baa` |
| `FIREBASE_CLIENT_EMAIL` | Service Account JSON → `client_email` | `firebase-adminsdk-xxxxx@agv-web-b0baa.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Service Account JSON → `private_key` | 见下方格式说明 |

**需要的项目**: agv-protocol-app, investor-portal, buy-page, G3-Funding, asset

**不需要**: architecture, taskon-api

#### FIREBASE_PRIVATE_KEY 格式（⚠️ 关键）

Vercel 里必须粘贴 **单行 `\n` 转义格式**（直接从 JSON 文件中 `private_key` 字段复制的原始值）：

```
-----BEGIN PRIVATE KEY-----\nMIIEvg...（中间内容）...\n-----END PRIVATE KEY-----\n
```

**不要**粘贴多行真实换行格式，否则会报 `Error: Invalid PEM formatted message`。

代码中 `firebaseAdmin.ts` 的 `normalizePrivateKey()` 会自动把 `\n` 转为真实换行：
```typescript
function normalizePrivateKey(raw: string) {
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}
```

#### 获取 Service Account JSON

1. Firebase Console → **Project Settings → Service Accounts**
2. 点 **Generate new private key** → 下载 JSON
3. 从 JSON 中提取 `project_id`、`client_email`、`private_key` 三个字段
4. JSON 文件 **不要放进仓库**，保存在本地安全位置

### 5.2 Firebase 客户端（6 个 — 页面功能必需）

| Key | Firebase Config 字段 |
|-----|---------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

**获取**: Firebase Console → Project Settings → General → Your apps → Web app → `firebaseConfig` 对象

**需要的项目**: agv-protocol-app, investor-portal, buy-page, G3-Funding, asset

### 5.3 Thirdweb

| Key | 来源 |
|-----|------|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Thirdweb Dashboard → API Keys → Client ID |

**需要的项目**: agv-protocol-app, buy-page, G3-Funding, architecture

### 5.4 其他服务

| Key | 来源 | 需要的项目 |
|-----|------|-----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Console | agv-protocol-app, G3-Funding |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console | agv-protocol-app, G3-Funding |
| `MORALIS_API_KEY` | Moralis Dashboard | agv-protocol-app |
| `NEXT_PUBLIC_SITE_URL` | 各项目域名 | 全部 |
| `NOTION_TOKEN` | Notion Integrations | taskon-api |
| `NOTION_DATABASE_ID` | Notion Database URL | taskon-api |

### 5.5 环境变量 × 项目矩阵

| 变量 | protocol-app | investor-portal | buy-page | G3-Funding | asset | architecture | taskon-api |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `FIREBASE_PROJECT_ID` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `FIREBASE_CLIENT_EMAIL` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `FIREBASE_PRIVATE_KEY` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `NEXT_PUBLIC_FIREBASE_*` (6个) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | ✅ | — | ✅ | ✅ | — | ✅ | — |
| `UPSTASH_REDIS_*` (2个) | ✅ | — | — | ✅ | — | — | — |
| `MORALIS_API_KEY` | ✅ | — | — | — | — | — | — |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `NOTION_*` (2个) | — | — | — | — | — | — | ✅ |

### 5.6 Vercel Scope

所有变量建议勾选 **Production + Preview + Development** 三个环境。

---

## 6. Build Command 配置

> ⚠️ Vercel 默认用 `npm run build`，monorepo 必须改为 `pnpm`！

每个 Vercel 项目 → **Settings → General → Build & Development Settings**：

| 设置 | 值 |
|------|-----|
| **Framework Preset** | Next.js（taskon-api 选 Other） |
| **Build Command** | `pnpm build` |
| **Install Command** | `pnpm install` |
| **Output Directory** | `.next`（Next.js 默认，留空即可） |
| **Node.js Version** | `20.x` |

### 特殊项目

| 项目 | Build 特殊说明 |
|------|---------------|
| `investor-portal` | 使用 `--turbopack`（已写在 package.json scripts 中，不需要额外配置） |
| `asset` | 使用 `--turbopack` |
| `G3-Funding` | Thirdweb v4+v5 共存，编译较慢 |
| `taskon-api` | 无需 build（Vercel Serverless 自动处理） |

---

## 7. 301 跳转配置

### 方式 A — Cloudflare Page Rules（推荐）

在 `agvnexrur.com`、`agvnexrur.io`、`agvnexrur.org` 各自的 Cloudflare 站点中：

**Rules → Page Rules → Create Rule**：

```
URL: *agvnexrur.com/*
Setting: Forwarding URL (301)
Destination: https://agvnexrur.ai/$2
```

对 `.io` 和 `.org` 重复同样操作。

### 方式 B — Vercel redirects

在 `agv-protocol-app` 中添加 Vercel 配置，同时在 Vercel Dashboard 中为该项目添加 `.com`、`.io`、`.org` 三个自定义域，然后在 `vercel.json` 中配置：

```json
{
  "redirects": [
    {
      "source": "/:path(.*)",
      "has": [{ "type": "host", "value": "agvnexrur.com" }],
      "destination": "https://agvnexrur.ai/:path",
      "permanent": true
    },
    {
      "source": "/:path(.*)",
      "has": [{ "type": "host", "value": "agvnexrur.io" }],
      "destination": "https://agvnexrur.ai/:path",
      "permanent": true
    },
    {
      "source": "/:path(.*)",
      "has": [{ "type": "host", "value": "agvnexrur.org" }],
      "destination": "https://agvnexrur.ai/:path",
      "permanent": true
    }
  ]
}
```

---

## 8. 部署顺序与排障

### 推荐部署顺序

| 顺序 | 项目 | 原因 |
|------|------|------|
| **① architecture** | 零 Firebase 依赖，最简单，用于验证 Vercel + pnpm monorepo 管道 |
| **② agv-protocol-app** | 主 DApp，环境变量最多，验证 Firebase Admin SDK 配置 |
| **③ buy-page** | 有 `vercel.json` cron job，验证 viem 集成 |
| **④ investor-portal** | Turbopack 构建，验证 React 19 兼容性 |
| **⑤ asset** | Turbopack + Zod 4 + Google Maps |
| **⑥ G3-Funding** | Thirdweb v4+v5 共存，可能遇到最多兼容问题 |
| **⑦ taskon-api** | Serverless，独立于 pnpm workspace |

### 分步验证

每部署一个项目后：

1. 检查 Build Logs 是否成功
2. 访问 Vercel 分配的 `.vercel.app` 临时域名
3. 确认页面加载正常
4. 绑定自定义域名
5. 确认 HTTPS 证书自动签发

---

## 9. 已知问题与踩坑记录

### 踩坑 1: Build Command 必须是 pnpm

```
❌ 错误: Error: Command "npm run build" exited with 1
✅ 修复: Settings → Build Command → pnpm build
```

**原因**: Vercel 默认用 npm，但本项目是 pnpm workspace monorepo，npm 无法正确解析 workspace 依赖。

### 踩坑 2: FIREBASE_PRIVATE_KEY 格式

```
❌ 错误: Error: Failed to parse private key: Error: Invalid PEM formatted message.
✅ 修复: 使用单行 \n 转义格式（从 JSON 原文中直接复制 private_key 值）
```

**原因**: Vercel 环境变量输入多行换行时，换行符可能被丢失或转换。必须使用 JSON 原始格式（`\n` 是文字），代码中的 `normalizePrivateKey()` 会自动转换。

### 踩坑 3: Missing server env: FIREBASE_PROJECT_ID

```
❌ 错误: Error: Missing server env: FIREBASE_PROJECT_ID
✅ 修复: 在 Vercel Environment Variables 中添加 3 个 Firebase Admin SDK 变量
```

**原因**: `firebaseAdmin.ts` 在 SSR 构建（Collecting page data）阶段执行，如果缺少 `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` 任一，直接 throw 导致 build 失败。

### 潜在问题: Codespace OOM

`investor-portal` 和 `G3-Funding` 在低内存环境（Codespace 4C/8G）可能 SSR 阶段 OOM。Vercel 服务器内存充足，通常不会有此问题。如遇到：

```
Settings → Functions → Function Max Duration → 增大
Settings → General → Node.js Version → 确保 20.x
```

### 安全提醒

- **私钥泄露**: 如果 Service Account JSON 或 private key 曾在聊天/PR/日志中暴露，必须 **立即轮换**：
  - Firebase Console → Project Settings → Service Accounts → 管理服务账号密钥
  - 删除旧 key → Generate new private key → 更新 Vercel 环境变量
- **JSON 文件不入库**: Service Account JSON 保存在本地安全位置，不放进项目目录
- **`.env.local` 已 gitignore**: 本地开发用，不会被提交

---

## 10. 各项目技术栈矩阵

| 项目 | Next.js | React | Tailwind | Firebase | Web3 库 | Zod | Turbopack |
|------|---------|-------|----------|----------|---------|-----|-----------|
| **agv-protocol-app** | 15.5.7 | 18 | v3 | 10 | ethers 6 + thirdweb 5 | 3 | ❌ |
| **investor-portal** | 15.5.7 | **19** | **v4** | 10 | — | — | ✅ |
| **G3-Funding** | **14.2.33** | 18 | v3 | **12** | thirdweb **v4+v5** | 3 | ❌ |
| **buy-page** | 15.2.3 | **19** | **v4** | 10 | viem 2 + thirdweb 5 | — | ❌ |
| **asset** | 15.5.7 | **19** | **v4** | **12** | — | **4** | ✅ |
| **architecture** | 15.2.3 | **19** | **v4** | — | thirdweb 5 | — | ❌ |
| **template** | **14.2.33** | 18 | v3 | — | — | — | ❌ |
| **taskon-api** | — | — | — | — | — | — | — |

### 已有的 vercel.json

| 项目 | 有 vercel.json | 内容 |
|------|:-:|------|
| buy-page | ✅ | cron: `/api/cron/export-referrals` 每周一 00:00 |
| architecture | ✅ | cron: `/api/cron/export-referrals` 每周一 00:00 |
| taskon-api | ✅ | builds: `@vercel/node`，routes: `/api/*` |
| 其余 4 个 | ❌ | — |

### 费用估算

| 项目 | 费用 | 说明 |
|------|------|------|
| 4 个域名 | ~$50-120/年 | .ai 较贵（~$70/年），.com/.io/.org 各 ~$10-15/年 |
| Cloudflare DNS | 免费 | Free plan 足够 |
| Vercel Hosting | $0 (Hobby) / $20/月 (Pro) | Hobby 足够启动，Pro 加 analytics + 多人协作 |
| Firebase | $0 (Spark) | 免费额度：10GB 存储 + 50K 读取/天 |
| **总计** | **~$50-120/年** | 域名费为主要成本 |
