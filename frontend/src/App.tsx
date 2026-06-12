import { FormEvent, useEffect, useState } from "react";
import type { AISentiment, Analysis, NewsItem } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const quickSymbols = ["AAPL", "TSLA", "NVDA", "MSFT"];

const sentimentText: Record<AISentiment, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

function ChangeValue({ value }: { value: number }) {
  const className = value > 0 ? "bullish" : value < 0 ? "bearish" : "neutral";
  return <strong className={className}>{value > 0 ? "+" : ""}{value.toFixed(2)}%</strong>;
}

function PriceChart({ points }: { points: Analysis["price_history"] }) {
  const width = 760;
  const height = 260;
  const padding = 18;
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((point.close - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const rising = values.at(-1)! >= values[0];

  return (
    <div className="chart-wrap">
      <div className="chart-scale"><span>${max.toFixed(2)}</span><span>${min.toFixed(2)}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近一个月价格走势图">
        <defs>
          <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rising ? "#25c58a" : "#ff6b6b"} stopOpacity=".32" />
            <stop offset="100%" stopColor={rising ? "#25c58a" : "#ff6b6b"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="grid-line" />
        <polygon points={area} fill="url(#priceArea)" />
        <polyline points={line} className={rising ? "chart-line up" : "chart-line down"} />
        {coordinates.map((point, index) => (
          <circle key={point.date} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 5 : 0}>
            <title>{point.date}: ${point.close.toFixed(2)}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-dates"><span>{points[0]?.date.slice(5)}</span><span>{points.at(-1)?.date.slice(5)}</span></div>
    </div>
  );
}

function TrendBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="trend-row">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="trend-track"><i className={tone} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function NewsCard({ item, rank }: { item: NewsItem; rank?: number }) {
  return (
    <article className={`news-card ${rank ? "ranked" : ""}`}>
      <div className={`sentiment-mark ${item.sentiment}`}>
        {rank ? rank : item.sentiment === "bullish" ? "↗" : item.sentiment === "bearish" ? "↘" : "→"}
      </div>
      <div className="news-body">
        <div className="news-meta">
          <span>{item.source}</span>
          <span className="news-symbol">${item.symbol}</span>
          <time>{new Date(item.published_at).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </div>
        <h4>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> : item.title}</h4>
        {item.summary && <p className="news-summary">{item.summary}</p>}
        <p className="ai-reason"><strong>AI Logic</strong>{item.ai_reason}</p>
      </div>
      <div className="news-score">
        <span className={`sentiment-pill ${item.sentiment}`}>{sentimentText[item.sentiment]}</span>
        <small>{Math.round(item.confidence * 100)}% confidence</small>
        <b>{Math.round(item.impact_score)}</b>
        <small>impact</small>
      </div>
    </article>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalysis(nextSymbol: string) {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "AI 分析请求失败");
      }
      setAnalysis(await response.json());
      setSymbol(normalized);
    } catch (requestError) {
      setAnalysis(null);
      setError(requestError instanceof Error ? requestError.message : "无法连接 AI 分析服务");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalysis("AAPL");
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    loadAnalysis(symbol);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span>SS</span>StockScope <small>V2</small></a>
        <div className="status"><i /> Finnhub + OpenAI analysis pipeline</div>
      </header>

      <section className="hero">
        <div className="eyebrow">AI NEWS-DRIVEN MARKET INTELLIGENCE</div>
        <h1>理解新闻如何驱动<span>股票价格</span></h1>
        <p>融合真实行情、Finnhub 财经新闻与 OpenAI 推理，解释价格变化背后的市场逻辑。</p>
        <form className="search" onSubmit={submit}>
          <div className="search-input">
            <span>$</span>
            <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="输入股票代码，例如 AAPL" aria-label="股票代码" />
          </div>
          <button disabled={loading}>{loading ? "AI 分析中..." : "运行 AI Agent"}</button>
        </form>
        <div className="quick-list">
          <small>热门：</small>
          {quickSymbols.map((item) => <button key={item} onClick={() => loadAnalysis(item)}>{item}</button>)}
        </div>
        {error && <div className="error"><strong>数据获取失败</strong><span>{error}</span></div>}
      </section>

      {loading && !analysis && <div className="loading-card"><i />正在关联价格与新闻，并生成 AI 市场叙事...</div>}

      {analysis && (
        <section className={`dashboard ${loading ? "is-loading" : ""}`}>
          <div className="stock-heading">
            <div>
              <div className="symbol-line">
                <h2>{analysis.symbol}</h2>
                <span className="mode live">Real Market Data</span>
                <span className="real-news">Real News · Finnhub</span>
                <span className="ai-badge">AI · {analysis.ai_model}</span>
              </div>
              <p>{analysis.company_name}</p>
            </div>
            <div className="current-price"><span>${analysis.price_summary.current.toFixed(2)}</span><ChangeValue value={analysis.price_summary.day_change_percent} /></div>
          </div>

          <div className="metrics">
            <article><span>今日涨跌</span><ChangeValue value={analysis.price_summary.day_change_percent} /></article>
            <article><span>近 5 日</span><ChangeValue value={analysis.price_summary.five_day_change_percent} /></article>
            <article><span>近 1 月</span><ChangeValue value={analysis.price_summary.month_change_percent} /></article>
            <article><span>AI 新闻情绪</span><strong className={analysis.sentiment_summary.overall}>{sentimentText[analysis.sentiment_summary.overall]}</strong></article>
          </div>

          <article className="card ai-summary-card">
            <div className="section-label">AI SUMMARY · MARKET NARRATIVE</div>
            <h3>{analysis.market_narrative.summary}</h3>
            <div className="narrative-grid">
              <div><strong className="bullish">关键利好</strong>{analysis.market_narrative.key_positives.map((item) => <span key={item}>+ {item}</span>)}</div>
              <div><strong className="bearish">关键风险</strong>{analysis.market_narrative.key_risks.map((item) => <span key={item}>− {item}</span>)}</div>
            </div>
          </article>

          <div className="main-grid">
            <article className="card chart-card">
              <div className="card-title"><div><small>PRICE ACTION</small><h3>近一个月价格走势</h3></div><span>1M</span></div>
              <PriceChart points={analysis.price_history} />
            </article>
            <article className="card forecast-card">
              <div className="card-title"><div><small>PROBABILITY MODEL</small><h3>短期趋势概率</h3></div></div>
              <TrendBar label="上涨" value={analysis.trend_probability.up} tone="up" />
              <TrendBar label="下跌" value={analysis.trend_probability.down} tone="down" />
              <TrendBar label="震荡" value={analysis.trend_probability.sideways} tone="sideways" />
              <p>价格动量 + AI 新闻情绪 + AI Outlook</p>
            </article>
          </div>

          <div className="analysis-grid">
            <article className="card analysis-card">
              <div className="section-label">WHY THE STOCK MOVED</div>
              <h3>价格变化原因分析</h3>
              <p>{analysis.why_stock_moved}</p>
            </article>
            <article className={`card outlook-card ${analysis.ai_outlook.stance}`}>
              <div className="section-label">AI OUTLOOK</div>
              <div className="outlook-title"><h3>{sentimentText[analysis.ai_outlook.stance]}</h3><span>{analysis.ai_outlook.stance === "bullish" ? "↗" : analysis.ai_outlook.stance === "bearish" ? "↘" : "→"}</span></div>
              <ul>{analysis.ai_outlook.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="driver-list">{analysis.ai_outlook.key_drivers.map((driver) => <span key={driver}>{driver}</span>)}</div>
            </article>
          </div>

          <div className="news-heading top-news-heading">
            <div><small>IMPACT RANKING</small><h3>今日最重要新闻</h3></div>
            <span>Top {analysis.top_influential_news.length}</span>
          </div>
          <div className="top-news-list">
            {analysis.top_influential_news.map((item, index) => <NewsCard item={item} rank={index + 1} key={item.news_id} />)}
          </div>

          <div className="news-heading">
            <div><small>REAL NEWS + OPENAI ANALYSIS</small><h3>全部新闻详情</h3></div>
            <div className="sentiment-counts">
              <span className="bullish">Bullish {analysis.sentiment_summary.bullish}</span>
              <span className="bearish">Bearish {analysis.sentiment_summary.bearish}</span>
              <span className="neutral">Neutral {analysis.sentiment_summary.neutral}</span>
            </div>
          </div>
          <div className="news-list">{analysis.news.map((item) => <NewsCard item={item} key={item.news_id} />)}</div>

          <footer><strong>风险提示</strong><p>{analysis.risk_notice}</p><span>更新于 {new Date(analysis.generated_at).toLocaleString("zh-CN")}</span></footer>
        </section>
      )}
    </main>
  );
}
