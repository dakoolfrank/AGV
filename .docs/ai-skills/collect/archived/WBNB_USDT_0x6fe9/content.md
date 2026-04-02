# WBNB_USDT_0x6fe9

> 发现方式: dexscreener | 网络: bsc | DEX: uniswap

## Pool Overview

| 指标 | 值 |
|------|-----|
| Pool Address | `0x6fe9E9de56356F7eDBfcBB29FAB7cd69471a4869` |
| Base Token | WBNB (`0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`) |
| Quote Token | USDT (`0x55d398326f99059fF775485246999027B3197955`) |
| TVL (USD) | $2,728,117 |
| 24h Volume | $2,787,749 |
| Price (USD) | $0.999050 |
| Fee (bps) | 25 |

## Price Changes

| 时间窗口 | 变化率 |
|----------|--------|
| m5 | -0.00% |
| m15 | -0.01% |
| m30 | -0.10% |
| h1 | -0.07% |
| h6 | -0.12% |
| h24 | -0.06% |

## Top Signals

| Signal | Strength | Source | Details |
|--------|----------|--------|---------|
| lp_imbalance | 99.8 | gecko | reserve_ratio=0.00161221023714502 |

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
| depth_2pct_usd | 27144.76 |

## Decision

- Quality: **moderate** (Score: 57)
- lp_imbalance strength=99.8
- TVL $2.7M sufficient
- Volume $2788K healthy

<details><summary>Raw API Snapshot</summary>

```json
{
  "pool_info": {
    "base_token_price_usd": "0.999049913805644",
    "base_token_price_native_currency": "0.00161221023714502",
    "quote_token_price_usd": "622.53",
    "quote_token_price_native_currency": "1.0",
    "base_token_price_quote_token": "0.001612210237",
    "quote_token_price_base_token": "620.266499344",
    "address": "0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869",
    "name": "USDT / WBNB 0.05%",
    "pool_name": "USDT / WBNB",
    "pool_fee_percentage": "0.05",
    "pool_created_at": "2023-03-16T01:27:59Z",
    "fdv_usd": "8976159506.48433",
    "market_cap_usd": "8976456145.91719",
    "price_change_percentage": {
      "m5": "-0.002",
      "m15": "-0.006",
      "m30": "-0.102",
      "h1": "-0.067",
      "h6": "-0.122",
      "h24": "-0.059"
    },
    "transactions": {
      "m5": {
        "buys": 1,
        "sells": 14,
        "buyers": 1,
        "sellers": 11
      },
      "m15": {
        "buys": 43,
        "sells": 59,
        "buyers": 32,
        "sellers": 36
      },
      "m30": {
        "buys": 88,
        "sells": 128,
        "buyers": 57,
        "sellers": 63
      },
      "h1": {
        "buys": 225,
        "sells": 194,
        "buyers": 130,
        "sellers": 91
      },
      "h6": {
        "buys": 845,
        "sells": 773,
        "buyers": 241,
        "sellers": 232
      },
      "h24": {
        "buys": 2979,
        "sells": 3276,
        "buyers": 815,
        "sellers": 916
      }
    },
    "volume_usd": {
      "m5": "3475.5305879846",
      "m15": "32695.0854343016",
      "m30": "66314.566136052",
      "h1": "146767.342998177",
      "h6": "709464.74780506",
      "h24": "2808148.2756062"
    },
    "reserve_in_usd": "2728116.8297",
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
