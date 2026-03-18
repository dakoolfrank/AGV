# Trust Wallet 提交操作指南

> 生成日期: 2026-03-15 | 状态: 待审核执行

## 待提交资产

| Token | 合约地址 | logo | info.json | 文件大小 |
|-------|---------|------|-----------|---------|
| pGVT | `0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9` | 256×256 PNG, 82KB ✅ | ✅ | < 100KB |
| sGVT | `0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3` | 256×256 PNG, 69KB ✅ | ✅ | < 100KB |

## 本地预置文件

```
tokencontracts-main/assets/trustwallet/
├── 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/
│   ├── info.json    (pGVT 元数据)
│   └── logo.png     (256×256 PNG)
└── 0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/
    ├── info.json    (sGVT 元数据)
    └── logo.png     (256×256 PNG)
```

## 执行步骤

### Step 1: Fork trustwallet/assets

浏览器打开 https://github.com/trustwallet/assets → 右上角 Fork → Fork 到 dakoolfrank 账号

### Step 2: Clone 并创建分支

```bash
git clone https://github.com/dakoolfrank/assets.git trustwallet-assets
cd trustwallet-assets
git checkout -b add-pgvt-sgvt-bsc
```

### Step 3: 复制文件到正确位置

Trust Wallet 的目录结构是 `blockchains/smartchain/assets/{checksummed_address}/`：

```bash
# pGVT
mkdir -p blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9
cp /workspaces/AGV/tokencontracts-main/assets/trustwallet/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/logo.png \
   blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/logo.png
cp /workspaces/AGV/tokencontracts-main/assets/trustwallet/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/info.json \
   blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/info.json

# sGVT
mkdir -p blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3
cp /workspaces/AGV/tokencontracts-main/assets/trustwallet/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/logo.png \
   blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/logo.png
cp /workspaces/AGV/tokencontracts-main/assets/trustwallet/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/info.json \
   blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/info.json
```

### Step 4: 验证文件完整性

```bash
# 必须通过 Trust Wallet 的验证脚本
# logo: PNG 格式, 256×256, < 100KB
file blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/logo.png
file blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/logo.png

# info.json: 合法 JSON
python3 -c "import json; json.load(open('blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/info.json'))"
python3 -c "import json; json.load(open('blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/info.json'))"
```

### Step 5: Commit & Push & PR

```bash
git add blockchains/smartchain/assets/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9/
git add blockchains/smartchain/assets/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3/
git commit -m "Add pGVT and sGVT tokens on BNB Smart Chain"
git push origin add-pgvt-sgvt-bsc
```

然后在 GitHub 上打开 PR：
- **Title**: `Add pGVT (PreGVT) and sGVT (Staked GVT) on BNB Smart Chain`
- **Body**:
  ```
  ## Token Details
  
  ### pGVT (PreGVT)
  - Contract: 0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9
  - BscScan: https://bscscan.com/token/0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9
  - GeckoTerminal: https://www.geckoterminal.com/bsc/tokens/0x8f9ec8107c126e94f5c4df26350fb7354e0c8af9
  - PancakeSwap LP pair active since 2026-03-10
  
  ### sGVT (Staked GVT)
  - Contract: 0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3
  - BscScan: https://bscscan.com/token/0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3
  - GeckoTerminal: https://www.geckoterminal.com/bsc/tokens/0x53e599211bf49aa2336c3f839ad57e20de3662a3
  - PancakeSwap LP pair active since 2026-03-10
  
  Both tokens are verified on BscScan and indexed by GeckoTerminal with Regular Pass.
  Website: https://agvnexrur.ai
  Twitter: https://x.com/agvnexrur
  GitHub: https://github.com/dakoolfrank/AGV
  ```

## 注意事项

1. **地址必须是 EIP-55 checksummed** — 以上地址已确认正确
2. **logo.png 必须 PNG 格式, 256×256** — 已确认
3. **文件大小 < 100KB** — pGVT 82KB ✅, sGVT 69KB ✅
4. Trust Wallet 自动化审核通常 1-3 天合并
5. 合并后 Trust Wallet app 内即可显示 token logo + 价格（来自 CoinGecko/GeckoTerminal）
