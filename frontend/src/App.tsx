import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Analysis,
  NewsItem,
  NewsRange,
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

function languageCode(language: string) {
  return language.startsWith("zh") ? "zh-CN" : "en";
}

function apiLanguage(language: string) {
  return language.startsWith("zh") ? "zh" : "en";
}

function formatNumber(value: number | undefined, locale: string, digits = 2) {
  return value == null
    ? "—"
    : value.toLocaleString(locale, { maximumFractionDigits: digits });
}

function formatMarketCap(value: number | undefined, locale: string) {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toLocaleString(locale, { maximumFractionDigits: 2 })}T`;
  if (value >= 1e9) return `$${(value / 1e9).toLocaleString(locale, { maximumFractionDigits: 2 })}B`;
  return `$${(value / 1e6).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
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
  const { i18n } = useTranslation();
  if (!active || !payload?.length) return null;
  const close = Number(payload[0].value);
  const change = startPrice ? ((close / startPrice) - 1) * 100 : 0;
  return (
    <div className="chart-tooltip">
      <span>{label ? new Date(label).toLocaleString(languageCode(i18n.language)) : ""}</span>
      <strong>${close.toFixed(2)}</strong>
      <ChangeValue value={change} />
    </div>
  );
}

function PriceChart({ ranges }: { ranges: Analysis["price_history_ranges"] }) {
  const { t, i18n } = useTranslation();
  const locale = languageCode(i18n.language);
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
        <div><small>{t("chart.label")}</small><h3>{t("chart.title")}</h3></div>
        <div className="range-tabs">
          {priceRanges.map((item) => (
            <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="chart-stats">
        <span>{t("chart.high")} <b>${highPoint.close.toFixed(2)}</b></span>
        <span>{t("chart.low")} <b>${lowPoint.close.toFixed(2)}</b></span>
        <span>{t("chart.performance")} <ChangeValue value={startPrice ? ((endPrice / startPrice) - 1) * 100 : 0} /></span>
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
            <XAxis
              dataKey="date"
              tickFormatter={(value) => range === "1D"
                ? new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
                : new Date(value).toLocaleDateString(locale, {
                  year: range === "MAX" ? "2-digit" : undefined,
                  month: "2-digit",
                  day: "2-digit",
                })}
              minTickGap={42}
              tick={{ fill: "#61706c", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
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
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const related = Array.from(new Set([item.symbol, ...item.related_symbols])).slice(0, 5);
  return (
    <article className={`news-card ${rank ? "ranked" : ""}`}>
      <div className={`sentiment-mark ${item.sentiment}`}>{rank || (item.sentiment === "bullish" ? "↗" : item.sentiment === "bearish" ? "↘" : "→")}</div>
      <div className="news-body">
        <div className="news-meta">
          <span>{item.source}</span>
          <time>{new Date(item.published_at).toLocaleString(languageCode(i18n.language), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
          {related.map((ticker) => <span className="news-symbol" key={ticker}>${ticker}</span>)}
        </div>
        <h4>{item.title}</h4>
        <p className="news-summary">{item.chinese_summary}</p>
        <button className="expand-news" onClick={() => setExpanded((value) => !value)}>{t(expanded ? "news.collapse" : "news.expand")}</button>
        {expanded && (
          <div className="news-details">
            <div><strong>{t("news.whyImportant")}</strong><p>{item.why_important}</p></div>
            <div><strong>{t("news.interpretation")}</strong><p>{item.ai_reason}</p></div>
            <div className="impact-path">
              <strong>{t("news.impactPath")}</strong>
              <div>{item.impact_path.map((step, index) => <span key={`${step}-${index}`}>{step}{index < item.impact_path.length - 1 && <i>↓</i>}</span>)}</div>
            </div>
            {item.summary && <div><strong>{t("news.originalSummary")}</strong><p>{item.summary}</p></div>}
            {item.url && <a className="source-link" href={item.url} target="_blank" rel="noreferrer">{t("news.originalLink")}</a>}
          </div>
        )}
      </div>
      <div className="news-score">
        <span className={`impact-pill ${item.impact_direction}`}>{t(`impact.${item.impact_direction}`)}</span>
        <b>{Math.round(item.impact_score)}</b>
        <small>{t("news.impactScore")}</small>
      </div>
    </article>
  );
}

function LoadingReport() {
  const { t } = useTranslation();
  return (
    <section className="loading-report">
      <div className="progress-line"><i /></div>
      <div className="loading-copy"><strong>{t("loading.title")}</strong><span>{t("loading.steps")}</span></div>
      <div className="skeleton-grid"><i /><i /><i /><i /></div>
    </section>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();
  const locale = languageCode(i18n.language);
  const [symbol, setSymbol] = useState("AAPL");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState("");
  const [newsRange, setNewsRange] = useState<NewsRange>("month");

  async function loadAnalysis(nextSymbol: string, targetLanguage = i18n.language) {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) return;
    setSymbol(normalized);
    setLoading(true);
    setErrorKey("");
    try {
      const response = await fetch(
        `${API_BASE}/api/analyze/${encodeURIComponent(normalized)}?language=${apiLanguage(targetLanguage)}`,
      );
      if (!response.ok) {
        throw new Error("request");
      }
      setAnalysis(await response.json());
      setNewsRange("month");
    } catch (requestError) {
      setAnalysis(null);
      setErrorKey(requestError instanceof TypeError ? "errors.connection" : "errors.request");
    } finally {
      setLoading(false);
    }
  }

  async function changeLanguage(nextLanguage: "zh-CN" | "en") {
    if (nextLanguage === languageCode(i18n.language)) return;
    await i18n.changeLanguage(nextLanguage);
    if (analysis) {
      await loadAnalysis(analysis.symbol, nextLanguage);
    }
  }

  useEffect(() => {
    const activeLanguage = languageCode(i18n.language);
    document.documentElement.lang = activeLanguage;
    document.title = analysis
      ? t("seo.stockTitle", { symbol: analysis.symbol })
      : t("seo.homeTitle");
    const description = analysis
      ? t("seo.stockDescription", { symbol: analysis.symbol })
      : t("seo.homeDescription");
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [analysis, i18n.language, t]);

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
    void loadAnalysis(symbol);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span>SS</span>StockScope <small>V3</small></a>
        <div className="nav-actions">
          <div className="status"><i /> {t("nav.status")}</div>
          <div className="language-switcher" aria-label={t("common.language")}>
            <button className={locale === "zh-CN" ? "active" : ""} onClick={() => void changeLanguage("zh-CN")}>{t("common.chinese")}</button>
            <button className={locale === "en" ? "active" : ""} onClick={() => void changeLanguage("en")}>{t("common.english")}</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">{t("hero.eyebrow")}</div>
        <h1>{t("hero.titlePrefix")}<span>{t("hero.titleHighlight")}</span></h1>
        <p>{t("hero.subtitle")}</p>
        <form className="search" onSubmit={submit}>
          <div className="search-input">
            <span>$</span>
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder={t("hero.placeholder")}
              aria-label={t("hero.tickerLabel")}
            />
          </div>
          <button disabled={loading}>{t(loading ? "hero.analyzing" : "hero.analyze")}</button>
        </form>
        <div className="quick-list">
          <small>{t("hero.popular")}</small>
          {quickSymbols.map((item) => (
            <button key={item.symbol} type="button" onClick={() => void loadAnalysis(item.symbol)}>
              <b>{item.symbol}</b><span>{item.company}</span>
            </button>
          ))}
        </div>
        {errorKey && <div className="error"><strong>{t("errors.title")}</strong><span>{t(errorKey)}</span></div>}
      </section>

      {loading && !analysis && <LoadingReport />}

      {analysis && (
        <section className={`dashboard ${loading ? "is-loading" : ""}`}>
          <div className="stock-heading">
            <div>
              <div className="symbol-line">
                <h2>{analysis.symbol}</h2>
                <span className="mode live">{t("common.live")}</span>
                <span className="real-news">{t("stock.newsSource")}</span>
              </div>
              <p>{analysis.company_name}</p>
            </div>
            <div className="price-block">
              <div className="current-price">
                <span>${analysis.price_summary.current.toFixed(2)}</span>
                <ChangeValue value={analysis.price_summary.day_change} suffix="" />
                <ChangeValue value={analysis.price_summary.day_change_percent} />
              </div>
              <small>{t("stock.updatedAt", {
                date: new Date(analysis.generated_at).toLocaleString(locale, { timeZone: "UTC", hour12: false }),
              })}</small>
            </div>
          </div>

          <div className="market-data-grid">
            <div className="performance-strip">
              <article><span>{t("stock.fiveDay")}</span><ChangeValue value={analysis.price_summary.five_day_change_percent} /></article>
              <article><span>{t("stock.oneMonth")}</span><ChangeValue value={analysis.price_summary.month_change_percent} /></article>
              <article><span>{t("stock.threeMonth")}</span><ChangeValue value={analysis.price_summary.three_month_change_percent} /></article>
              <article><span>{t("stock.oneYear")}</span><ChangeValue value={analysis.price_summary.year_change_percent} /></article>
            </div>
            <div className="fundamental-strip">
              <article><span>{t("stock.marketCap")}</span><strong>{formatMarketCap(analysis.price_summary.market_cap, locale)}</strong></article>
              <article><span>{t("stock.pe")}</span><strong>{formatNumber(analysis.price_summary.trailing_pe, locale)}</strong></article>
              <article><span>{t("stock.beta")}</span><strong>{formatNumber(analysis.price_summary.beta, locale)}</strong></article>
              <article><span>{t("stock.weekRange")}</span><strong>${formatNumber(analysis.price_summary.fifty_two_week_low, locale)} – ${formatNumber(analysis.price_summary.fifty_two_week_high, locale)}</strong></article>
            </div>
          </div>

          <PriceChart ranges={analysis.price_history_ranges} />

          <div className="report-grid">
            <article className="card report-card overview-card">
              <div className="section-label">{t("report.overviewLabel")}</div>
              <h3>{t("report.overviewTitle")}</h3>
              <p>{analysis.market_report.market_overview}</p>
              <div className="tone-row">
                <span>{t("report.sentiment")}</span>
                <strong className={analysis.sentiment_summary.overall}>{t(`sentiment.${analysis.sentiment_summary.overall}`)}</strong>
              </div>
            </article>
            <article className="card forecast-card">
              <div className="card-title"><div><small>{t("report.trendLabel")}</small><h3>{t("report.trendTitle")}</h3></div></div>
              <TrendBar label={t("report.up")} value={analysis.trend_probability.up} tone="up" />
              <TrendBar label={t("report.down")} value={analysis.trend_probability.down} tone="down" />
              <TrendBar label={t("report.sideways")} value={analysis.trend_probability.sideways} tone="sideways" />
            </article>
          </div>

          <article className="card drivers-card">
            <div className="section-label">{t("report.driversLabel")}</div>
            <h3>{t("report.driversTitle")}</h3>
            <div className="driver-columns">
              <div className="positive-driver"><b>01</b><strong>{t("report.bullishFactor")}</strong><p>{analysis.market_report.core_price_drivers.positive_factor}</p></div>
              <div className="negative-driver"><b>02</b><strong>{t("report.bearishFactor")}</strong><p>{analysis.market_report.core_price_drivers.negative_factor}</p></div>
              <div className="focus-driver"><b>03</b><strong>{t("report.marketFocus")}</strong><p>{analysis.market_report.core_price_drivers.market_focus}</p></div>
            </div>
          </article>

          <div className="analysis-grid">
            <article className="card narrative-card">
              <div className="section-label">{t("report.narrativeLabel")}</div>
              <h3>{t("report.narrativeTitle")}</h3>
              <p>{analysis.market_report.market_narrative}</p>
            </article>
            <article className={`card outlook-card ${analysis.ai_outlook.stance}`}>
              <div className="section-label">{t("report.outlookLabel")}</div>
              <div className="outlook-title">
                <h3>{t("report.outlookTitle", { sentiment: t(`sentiment.${analysis.ai_outlook.stance}`) })}</h3>
                <span>{analysis.ai_outlook.stance === "bullish" ? "↗" : analysis.ai_outlook.stance === "bearish" ? "↘" : "→"}</span>
              </div>
              <ul>{analysis.ai_outlook.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="driver-list">{analysis.ai_outlook.key_drivers.map((driver) => <span key={driver}>{driver}</span>)}</div>
            </article>
          </div>

          <div className="risk-catalyst-grid">
            <article className="card">
              <div className="section-label">{t("report.riskLabel")}</div><h3>{t("report.riskTitle")}</h3>
              <div className="risk-columns">
                <div><strong>{t("report.shortRisk")}</strong>{analysis.market_report.risk_assessment.short_term.map((risk) => <p key={risk}>• {risk}</p>)}</div>
                <div><strong>{t("report.mediumRisk")}</strong>{analysis.market_report.risk_assessment.medium_term.map((risk) => <p key={risk}>• {risk}</p>)}</div>
              </div>
            </article>
            <article className="card">
              <div className="section-label">{t("report.catalystsLabel")}</div><h3>{t("report.catalystsTitle")}</h3>
              <div className="catalyst-list">{analysis.market_report.potential_catalysts.map((item, index) => <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>)}</div>
            </article>
          </div>

          <article className="card moved-card">
            <div className="section-label">{t("report.attributionLabel")}</div>
            <h3>{t("report.attributionTitle")}</h3>
            <p>{analysis.why_stock_moved}</p>
          </article>

          <div className="news-heading top-news-heading">
            <div><small>{t("news.keyEventsLabel")}</small><h3>{t("news.keyEventsTitle")}</h3></div>
            <span>{t("common.top", { count: analysis.top_influential_news.length })}</span>
          </div>
          <div className="top-news-list">{analysis.top_influential_news.map((item, index) => <NewsCard item={item} rank={index + 1} key={item.news_id} />)}</div>

          <div className="news-heading">
            <div><small>{t("news.relatedLabel")}</small><h3>{t("news.relatedTitle")}</h3></div>
            <div className="news-filters">
              <button className={newsRange === "today" ? "active" : ""} onClick={() => setNewsRange("today")}>{t("news.today")}</button>
              <button className={newsRange === "week" ? "active" : ""} onClick={() => setNewsRange("week")}>{t("news.week")}</button>
              <button className={newsRange === "month" ? "active" : ""} onClick={() => setNewsRange("month")}>{t("news.month")}</button>
            </div>
          </div>
          <div className="news-list">
            {filteredNews.length
              ? filteredNews.map((item) => <NewsCard item={item} key={item.news_id} />)
              : <div className="empty-news">{t("news.empty")}</div>}
          </div>

          <footer><strong>{t("footer.riskTitle")}</strong><p>{t("footer.riskText")}</p><span>{t("footer.sources")}</span></footer>
        </section>
      )}
    </main>
  );
}
