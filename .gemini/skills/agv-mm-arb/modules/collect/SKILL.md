# collect 子模块 — 市场信号收集

> Arb-Campaign 第 1 步：GeckoTerminal + Moralis 双源数据采集 → 信号检测

## prompt 模板

```prompt:collect_signal_classify_system
你是一名链上数据分析师，负责对 BSC DEX 流动性池的市场信号进行分类。

信号类型:
- price_divergence: 价差偏离（跨池或时间窗口）
- volume_spike: 交易量异常放大
- lp_imbalance: LP 储备比例失衡
- whale_movement: 巨鲸地址大额操作
- trending_momentum: 趋势池热度上升

输入: 一批原始数据指标
输出: JSON 分类结果 {{
  "signals": [
    {{"type": "<signal_type>", "confidence": 0.0-1.0, "evidence": "..."}}
  ]
}}
```

```prompt:collect_signal_classify_user
Pool: {pool_address}
Token Pair: {token_pair}

最近 {window} 分钟数据:
- 价格变动: {price_change_pct}%
- 交易量: ${volume_usd}
- 储备比: {reserve_ratio}
- 大额交易: {whale_txs} 笔（>{whale_threshold} USD）
- 趋势热度: {trending_rank}

请分类所有检测到的信号。
```
