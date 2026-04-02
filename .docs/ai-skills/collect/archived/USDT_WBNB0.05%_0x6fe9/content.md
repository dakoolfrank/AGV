# USDT_WBNB0.05%_0x6fe9

> 发现方式: volume_ranked | 网络: bsc | DEX: uniswap-bsc

## Pool Overview

| 指标 | 值 |
|------|-----|
| Pool Address | `0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869` |
| Base Token | USDT (`0x55d398326f99059ff775485246999027b3197955`) |
| Quote Token | WBNB 0.05% (`0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`) |
| TVL (USD) | $2,725,971 |
| 24h Volume | $2,805,439 |
| Price (USD) | $0.999103 |
| Fee (bps) | 25 |

## Price Changes

| 时间窗口 | 变化率 |
|----------|--------|
| m5 | +0.10% |
| m15 | +0.10% |
| m30 | +0.00% |
| h1 | +0.04% |
| h6 | -0.02% |
| h24 | +0.04% |

## Top Signals

| Signal | Strength | Source | Details |
|--------|----------|--------|---------|
| lp_imbalance | 99.8 | gecko | reserve_ratio=0.00160419795048704 |

## Hypotheses

- **lp_imbalance_arb** (confidence: 70%)
  LP 储备失衡 — 单边流动性偏移可能带来套利机会

## Indicators

| Indicator | Value |
|-----------|-------|
| onchain_tx_count | 0 |
| onchain_unique_wallets | 0 |
| onchain_avg_trade_size_usd | 0.0 |
| lp_add_count | 0 |
| lp_remove_count | 0 |
| lp_net_flow_usd | 0.0 |
| lp_net_flow_direction | neutral |
| reserve_ratio | 0.0016 |
| depth_2pct_usd | 27123.41 |

## Decision

- Quality: **moderate** (Score: 57)
- lp_imbalance strength=99.8
- TVL $2.7M sufficient
- Volume $2805K healthy

<details><summary>Raw API Snapshot</summary>

```json
{
  "pool_info": {
    "base_token_price_usd": "0.99910335875914",
    "base_token_price_native_currency": "0.00160419795048704",
    "quote_token_price_usd": "622.53",
    "quote_token_price_native_currency": "1.0",
    "base_token_price_quote_token": "0.00160419795",
    "quote_token_price_base_token": "623.364466771",
    "address": "0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869",
    "name": "USDT / WBNB 0.05%",
    "pool_name": "USDT / WBNB",
    "pool_fee_percentage": "0.05",
    "pool_created_at": "2023-03-16T01:27:59Z",
    "fdv_usd": "8985476780.6223",
    "market_cap_usd": "8985773727.96758",
    "price_change_percentage": {
      "m5": "0.102",
      "m15": "0.098",
      "m30": "0.001",
      "h1": "0.037",
      "h6": "-0.019",
      "h24": "0.045"
    },
    "transactions": {
      "m5": {
        "buys": 1,
        "sells": 10,
        "buyers": 1,
        "sellers": 9
      },
      "m15": {
        "buys": 43,
        "sells": 55,
        "buyers": 32,
        "sellers": 35
      },
      "m30": {
        "buys": 88,
        "sells": 124,
        "buyers": 57,
        "sellers": 62
      },
      "h1": {
        "buys": 225,
        "sells": 190,
        "buyers": 130,
        "sellers": 90
      },
      "h6": {
        "buys": 845,
        "sells": 769,
        "buyers": 241,
        "sellers": 231
      },
      "h24": {
        "buys": 2979,
        "sells": 3272,
        "buyers": 815,
        "sellers": 915
      }
    },
    "volume_usd": {
      "m5": "3123.661747457",
      "m15": "32343.216593774",
      "m30": "65962.6972955244",
      "h1": "146415.474157649",
      "h6": "709112.878964532",
      "h24": "2807796.40676567"
    },
    "reserve_in_usd": "2725970.703",
    "locked_liquidity_percentage": null,
    "dex_id": "uniswap-bsc"
  },
  "ohlcv": [],
  "trades": [],
  "transfers": [],
  "pair_events": [],
  "source_status": {
    "gecko": true,
    "dexscreener": false,
    "moralis": true
  },
  "warnings": []
}
```
</details>
