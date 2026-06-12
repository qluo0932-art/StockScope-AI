import { FormEvent, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AISentiment,
  Analysis,
  ImpactDirection,
  NewsItem,
  NewsRange,
  PricePoint,
  PriceRange,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const quickSymbols = [
  { symbol: "AAPL", company: "Apple" },
  { symbol: "NVDA", company: "NVIDIA" },
  { symbol: "MSFT", company: "Microsoft" },
  { symbol: "AMZN", company: "Amazon" },
  { symbol: "TSLA", company: "Tesla" },
];
const priceRanges: PriceRange[] = ["1D", "1W", "1M", "1Y", "MAX"];

const sentimentText: Record<AISentiment, string> = {
  bullish: "偏多",
  bearish: "偏空",
  neutral: "中性",
};
const impactText: Record<ImpactDirection, string> = {
  strong_bullish: "强烈利好",
  bullish: "利好",
  neutral: "中性",
  bearish: "利空",
  strong_bearish: "强烈利空",
};

function formatNumber(value?: number, digits = 2) {
  return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatMarketCap(value?: number) {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  return `$${(value / 1e6).toFixed(2)}M`;
}

function ChangeValue({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const className = value > 0 ? "bullish" : value < 0 ? "bearish" : "neutral";
  return <strong className={className}>{value > 0 ? "+" : ""}{value.toFixed(2)}{suffix}</strong>;
}

function ChartTooltip({ active, payload, label, startPrice }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  startPrice: number;
}) {
  if (!active || !payload?.length) return null;
  const close = Number(payload[0].value);
  const change = startPrice ? ((close / startPrice) - 1) * 100 : 0;
  return (
    <div className="chart-tooltip">
      <span>{label ? new Date(label).toLocaleString("zh-CN") : ""}</span>
      <strong>${close.toFixed(2)}</strong>
      <ChangeValue value={change} />
    </div>
  );
}

function PriceChart({ ranges }: { ranges: Analysis["price_history_ranges"] }) {
  const [range, setRange] = useState<PriceRange>("1M");
  const points = ranges[range] || [];
  const startPrice = points[0]?.close || 0;
  const endPrice = points.at(-1)?.close || 0;
  const highPoint = points.reduce((best, item) => item.close > best.close ? item : best, points[0] || { date: "", close: 0 });
  const lowPoint = points.reduce((best, item) => item.close < best.close ? item : best, points[0] || { date: "", close: 0 });
  const rising = endPrice >= startPrice;

  return (
    <article className="card chart-card terminal-card">
      <div className="card-title chart-header">
        <div><small>PRICE ACTION</small><h3>价格走势</h3></div>
        <div className="range-tabs">
          {priceRanges.map((item) => (
            <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="chart-stats">
        <span>区间高点 <b>${highPoint.close.toFixed(2)}</b></span>
        <span>区间低点 <b>${lowPoint.close.toFixed(2)}</b></span>
        <span>区间表现 <ChangeValue value={startPrice ? ((endPrice / startPrice) - 1) * 100 : 0} /></span>
      </div>
      <div className="recharts-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={rising ? "#31d49a" : "#ff7474"} stopOpacity={0.3} />
                <stop offset="100%" stopColor={rising ? "#31d49a" : "#ff7474"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(160,189,180,.08)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => range === "1D" ? new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : new Date(value).toLocaleDateString("zh-CN", { year: range === "MAX" ? "2-digit" : undefined, month: "2-digit", day: "2-digit" })} minTickGap={42} tick={{ fill: "#61706c", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} orientation="right" tick={{ fill: "#61706c", fontSize: 9 }} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTooltip startPrice={startPrice} />} />
            <ReferenceLine y={highPoint.close} stroke="rgba(49,212,154,.25)" strokeDasharray="4 4" />
            <ReferenceLine y={lowPoint.close} stroke="rgba(255,116,116,.2)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="close" stroke={rising ? "#31d49a" : "#ff7474"} strokeWidth={2} fill="url(#marketArea)" isAnimationActive={false} />
            {points.length > 0 && <ReferenceDot x={points.at(-1)!.date} y={endPrice} r={4} fill={rising ? "#31d49a" : "#ff7474"} stroke="#07100f" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
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
  const [expanded, setExpanded] = useState(false);
  const related = Array.from(new Set([item.symbol, ...item.related_symbols])).slice(0, 5);
  return (
    <article className={`news-card ${rank ? "ranked" : ""}`}>
      <div className={`sentiment-mark ${item.sentiment}`}>{rank || (item.sentiment === "bullish" ? "↗" : item.sentiment === "bearish" ? "↘" : "→")}</div>
      <div className="news-body">
        <div className="news-meta">
          <span>{item.source}</span>
          <time>{new Date(item.published_at).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
          {related.map((symbol) => <span className="news-symbol" key={symbol}>${symbol}</span>)}
        </div>
        <h4>{item.title}</h4>
        <p className="news-summary">{item.chinese_summary}</p>
        <button className="expand-news" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起详情" : "展开分析"}</button>
        {expanded && (
          <div className="news-details">
            <div><strong>为什么重要</strong><p>{item.why_important}</p></div>
            <div><strong>新闻解读</strong><p>{item.ai_reason}</p></div>
            <div className="impact-path"><strong>对股价影响路径</strong><div>{item.impact_path.map((step, index) => <span key={`${step}-${index}`}>{step}{index < item.impact_path.length - 1 && <i>↓</i>}</span>)}</div></div>
            {item.summary && <div><strong>原始摘要</strong><p>{item.summary}</p></div>}
            {item.url && <a className="source-link" href={item.url} target="_blank" rel="noreferrer">查看原始新闻 ↗</a>}
          </div>
        )}
      </div>
      <div className="news-score">
        <span className={`impact-pill ${item.impact_direction}`}>{impactText[item.impact_direction]}</span>
        <b>{Math.round(item.impact_score)}</b>
        <small>影响评分</small>
      </div>
    </article>
  );
}

function LoadingReport() {
  return (
    <section className="loading-report">
      <div className="progress-line"><i /></div>
      <div className="loading-copy"><strong>正在生成市场分析</strong><span>获取行情 → 关联新闻 → 评估影响 → 生成报告</span></div>
      <div className="skeleton-grid">
        <i /><i /><i /><i />
      </div>
    </section>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newsRange, setNewsRange] = useState<NewsRange>("month");

  async function loadAnalysis(nextSymbol: string) {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) return;
    setSymbol(normalized);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "市场分析请求失败");
      }
      setAnalysis(await response.json());
      setNewsRange("month");
    } catch (requestError) {
      setAnalysis(null);
      setError(requestError instanceof Error ? requestError.message : "无法连接市场分析服务");
    } finally {
      setLoading(false);
    }
  }

  const filteredNews = useMemo(() => {
    if (!analysis) return [];
    const now = new Date(analysis.generated_at).getTime();
    const generatedDate = new Date(analysis.generated_at).toISOString().slice(0, 10);
    if (newsRange === "today") {
      return analysis.news.filter(
        (item) => new Date(item.published_at).toISOString().slice(0, 10) === generatedDate,
      );
    }
    const maxAge = newsRange === "week" ? 24 * 7 : 24 * 31;
    return analysis.news.filter(
      (item) => now - new Date(item.published_at).getTime() <= maxAge * 60 * 60 * 1000,
    );
  }, [analysis, newsRange]);

  function submit(event: FormEvent) {
    event.preventDefault();
    loadAnalysis(symbol);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span>SS</span>StockScope <small>V3</small></a>
        <div className="status"><i /> Real-time market intelligence</div>
      </header>

      <section className="hero">
        <div className="eyebrow">NEWS-DRIVEN EQUITY INTELLIGENCE</div>
        <h1>新闻驱动的<span>股票价格分析平台</span></h1>
        <p>结合实时行情、财经新闻与大模型推理，帮助投资者理解价格波动背后的市场逻辑。</p>
        <form className="search" onSubmit={submit}>
          <div className="search-input"><span>$</span><input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="输入股票代码，例如 AAPL" aria-label="股票代码" /></div>
          <button disabled={loading}>{loading ? "分析中..." : "运行市场分析"}</button>
        </form>
        <div className="quick-list">
          <small>热门股票</small>
          {quickSymbols.map((item) => <button key={item.symbol} type="button" onClick={() => loadAnalysis(item.symbol)}><b>{item.symbol}</b><span>{item.company}</span></button>)}
        </div>
        {error && <div className="error"><strong>数据获取失败</strong><span>{error}</span></div>}
      </section>

      {loading && !analysis && <LoadingReport />}

      {analysis && (
        <section className={`dashboard ${loading ? "is-loading" : ""}`}>
          <div className="stock-heading">
            <div>
              <div className="symbol-line"><h2>{analysis.symbol}</h2><span className="mode live">LIVE</span><span className="real-news">Finnhub News</span></div>
              <p>{analysis.company_name}</p>
            </div>
            <div className="price-block">
              <div className="current-price"><span>${analysis.price_summary.current.toFixed(2)}</span><ChangeValue value={analysis.price_summary.day_change} suffix="" /><ChangeValue value={analysis.price_summary.day_change_percent} /></div>
              <small>数据更新时间 {new Date(analysis.generated_at).toLocaleString("zh-CN", { timeZone: "UTC", hour12: false })} UTC</small>
            </div>
          </div>

          <div className="market-data-grid">
            <div className="performance-strip">
              <article><span>5 日表现</span><ChangeValue value={analysis.price_summary.five_day_change_percent} /></article>
              <article><span>1 月表现</span><ChangeValue value={analysis.price_summary.month_change_percent} /></article>
              <article><span>3 月表现</span><ChangeValue value={analysis.price_summary.three_month_change_percent} /></article>
              <article><span>1 年表现</span><ChangeValue value={analysis.price_summary.year_change_percent} /></article>
            </div>
            <div className="fundamental-strip">
              <article><span>市值</span><strong>{formatMarketCap(analysis.price_summary.market_cap)}</strong></article>
              <article><span>市盈率 PE</span><strong>{formatNumber(analysis.price_summary.trailing_pe)}</strong></article>
              <article><span>Beta</span><strong>{formatNumber(analysis.price_summary.beta)}</strong></article>
              <article><span>52 周区间</span><strong>${formatNumber(analysis.price_summary.fifty_two_week_low)} – ${formatNumber(analysis.price_summary.fifty_two_week_high)}</strong></article>
            </div>
          </div>

          <PriceChart ranges={analysis.price_history_ranges} />

          <div className="report-grid">
            <article className="card report-card overview-card">
              <div className="section-label">MARKET OVERVIEW</div><h3>市场概览</h3><p>{analysis.market_report.market_overview}</p>
              <div className="tone-row"><span>整体新闻情绪</span><strong className={analysis.sentiment_summary.overall}>{sentimentText[analysis.sentiment_summary.overall]}</strong></div>
            </article>
            <article className="card forecast-card">
              <div className="card-title"><div><small>TREND ASSESSMENT</small><h3>价格趋势评估</h3></div></div>
              <TrendBar label="上涨" value={analysis.trend_probability.up} tone="up" />
              <TrendBar label="下跌" value={analysis.trend_probability.down} tone="down" />
              <TrendBar label="震荡" value={analysis.trend_probability.sideways} tone="sideways" />
            </article>
          </div>

          <article className="card drivers-card">
            <div className="section-label">CORE PRICE DRIVERS</div><h3>价格波动核心原因</h3>
            <div className="driver-columns">
              <div className="positive-driver"><b>01</b><strong>最重要利好因素</strong><p>{analysis.market_report.core_price_drivers.positive_factor}</p></div>
              <div className="negative-driver"><b>02</b><strong>最重要利空因素</strong><p>{analysis.market_report.core_price_drivers.negative_factor}</p></div>
              <div className="focus-driver"><b>03</b><strong>当前市场关注焦点</strong><p>{analysis.market_report.core_price_drivers.market_focus}</p></div>
            </div>
          </article>

          <div className="analysis-grid">
            <article className="card narrative-card"><div className="section-label">AI MARKET NARRATIVE</div><h3>市场叙事</h3><p>{analysis.market_report.market_narrative}</p></article>
            <article className={`card outlook-card ${analysis.ai_outlook.stance}`}><div className="section-label">MARKET VIEW</div><div className="outlook-title"><h3>市场观点 · {sentimentText[analysis.ai_outlook.stance]}</h3><span>{analysis.ai_outlook.stance === "bullish" ? "↗" : analysis.ai_outlook.stance === "bearish" ? "↘" : "→"}</span></div><ul>{analysis.ai_outlook.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><div className="driver-list">{analysis.ai_outlook.key_drivers.map((driver) => <span key={driver}>{driver}</span>)}</div></article>
          </div>

          <div className="risk-catalyst-grid">
            <article className="card"><div className="section-label">RISK ASSESSMENT</div><h3>风险因素</h3><div className="risk-columns"><div><strong>短期风险</strong>{analysis.market_report.risk_assessment.short_term.map((risk) => <p key={risk}>• {risk}</p>)}</div><div><strong>中期风险</strong>{analysis.market_report.risk_assessment.medium_term.map((risk) => <p key={risk}>• {risk}</p>)}</div></div></article>
            <article className="card"><div className="section-label">POTENTIAL CATALYSTS</div><h3>潜在催化剂</h3><div className="catalyst-list">{analysis.market_report.potential_catalysts.map((item, index) => <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>)}</div></article>
          </div>

          <article className="card moved-card"><div className="section-label">PRICE MOVE ATTRIBUTION</div><h3>价格变化原因分析</h3><p>{analysis.why_stock_moved}</p></article>

          <div className="news-heading top-news-heading"><div><small>PRICE-MOVING EVENTS</small><h3>影响价格的关键事件</h3></div><span>Top {analysis.top_influential_news.length}</span></div>
          <div className="top-news-list">{analysis.top_influential_news.map((item, index) => <NewsCard item={item} rank={index + 1} key={item.news_id} />)}</div>

          <div className="news-heading">
            <div><small>NEWS DRIVERS</small><h3>新闻驱动因素分析</h3></div>
            <div className="news-filters">
              <button className={newsRange === "today" ? "active" : ""} onClick={() => setNewsRange("today")}>今日新闻</button>
              <button className={newsRange === "week" ? "active" : ""} onClick={() => setNewsRange("week")}>最近一周</button>
              <button className={newsRange === "month" ? "active" : ""} onClick={() => setNewsRange("month")}>最近一个月</button>
            </div>
          </div>
          <div className="news-list">
            {filteredNews.length ? filteredNews.map((item) => <NewsCard item={item} key={item.news_id} />) : <div className="empty-news">该时间范围内暂无相关新闻</div>}
          </div>

          <footer><strong>风险提示</strong><p>{analysis.risk_notice}</p><span>数据来源：yfinance · Finnhub · OpenAI</span></footer>
        </section>
      )}
    </main>
  );
}
