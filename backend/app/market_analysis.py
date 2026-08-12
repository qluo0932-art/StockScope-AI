from typing import Dict, List, Optional, Tuple

import yfinance as yf

from .models import (
    AIAnalysisResult,
    AnalyzedNewsItem,
    PricePoint,
    PriceSummary,
    RawNewsItem,
    SentimentSummary,
    TrendProbability,
)


COMPANY_NAMES = {
    "AAPL": "Apple Inc.",
    "TSLA": "Tesla, Inc.",
    "NVDA": "NVIDIA Corporation",
    "MSFT": "Microsoft Corporation",
    "AMZN": "Amazon.com, Inc.",
    "META": "Meta Platforms, Inc.",
    "GOOGL": "Alphabet Inc.",
}


class MarketDataError(Exception):
    """Raised when real market data cannot be loaded."""


def _percent_change(new: float, old: float) -> float:
    if not old:
        return 0.0
    return round((new / old - 1) * 100, 2)


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _lookup(mapping: object, *keys: str) -> object:
    """Read yfinance dict-like objects without assuming a stable shape."""
    for key in keys:
        try:
            if isinstance(mapping, dict) and key in mapping:
                return mapping[key]
            if hasattr(mapping, "get"):
                value = mapping.get(key)  # type: ignore[attr-defined]
                if value is not None:
                    return value
            value = getattr(mapping, key, None)
            if value is not None:
                return value
        except Exception:
            continue
    return None


def _series_extreme(history, column: str, highest: bool) -> Optional[float]:
    if column not in history:
        return None
    values = history[column].tail(252).dropna()
    if values.empty:
        return None
    extreme = values.max() if highest else values.min()
    return _safe_float(extreme)


def _history_to_points(history) -> List[PricePoint]:
    return [
        PricePoint(
            date=index.isoformat(),
            close=round(float(row["Close"]), 2),
        )
        for index, row in history.iterrows()
    ]


def _downsample(points: List[PricePoint], max_points: int = 420) -> List[PricePoint]:
    if len(points) <= max_points:
        return points
    step = max(1, len(points) // max_points)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def _period_change(closes: List[float], sessions: int) -> float:
    if len(closes) <= sessions:
        return _percent_change(closes[-1], closes[0])
    return _percent_change(closes[-1], closes[-(sessions + 1)])


def get_price_data(
    symbol: str,
) -> Tuple[List[PricePoint], Dict[str, List[PricePoint]], PriceSummary]:
    try:
        ticker = yf.Ticker(symbol)
        daily_history = ticker.history(
            period="max",
            interval="1d",
            auto_adjust=True,
        )
        intraday_history = ticker.history(
            period="1d",
            interval="5m",
            auto_adjust=True,
        )
        if daily_history.empty or len(daily_history) < 22:
            raise ValueError("Not enough market data")
    except Exception as exc:
        raise MarketDataError(
            f"无法获取 {symbol} 的真实价格数据，请稍后重试"
        ) from exc

    daily_points = _history_to_points(daily_history)
    intraday_points = (
        _history_to_points(intraday_history)
        if not intraday_history.empty
        else daily_points[-1:]
    )
    closes = [point.close for point in daily_points]
    current = intraday_points[-1].close if intraday_points else closes[-1]
    previous_close = closes[-2]

    try:
        info = ticker.info
    except Exception:
        info = {}
    try:
        fast_info = ticker.fast_info
    except Exception:
        fast_info = {}

    currency = _lookup(info, "currency") or _lookup(fast_info, "currency") or "USD"
    fifty_two_week_high = (
        _safe_float(_lookup(info, "fiftyTwoWeekHigh", "fifty_two_week_high"))
        or _safe_float(_lookup(fast_info, "yearHigh", "year_high", "fiftyTwoWeekHigh"))
        or _series_extreme(daily_history, "High", highest=True)
        or _series_extreme(daily_history, "Close", highest=True)
    )
    fifty_two_week_low = (
        _safe_float(_lookup(info, "fiftyTwoWeekLow", "fifty_two_week_low"))
        or _safe_float(_lookup(fast_info, "yearLow", "year_low", "fiftyTwoWeekLow"))
        or _series_extreme(daily_history, "Low", highest=False)
        or _series_extreme(daily_history, "Close", highest=False)
    )

    summary = PriceSummary(
        current=current,
        currency=str(currency),
        day_change=round(current - previous_close, 2),
        day_change_percent=_percent_change(current, previous_close),
        five_day_change_percent=_period_change(closes, 5),
        month_change_percent=_period_change(closes, 21),
        three_month_change_percent=_period_change(closes, 63),
        year_change_percent=_period_change(closes, 252),
        market_cap=_safe_float(_lookup(info, "marketCap", "market_cap"))
        or _safe_float(_lookup(fast_info, "marketCap", "market_cap")),
        trailing_pe=_safe_float(_lookup(info, "trailingPE", "trailing_pe")),
        beta=_safe_float(_lookup(info, "beta")),
        fifty_two_week_high=fifty_two_week_high,
        fifty_two_week_low=fifty_two_week_low,
    )
    ranges = {
        "1D": intraday_points,
        "1W": daily_points[-6:],
        "1M": daily_points[-23:],
        "1Y": daily_points[-253:],
        "MAX": _downsample(daily_points),
    }
    return ranges["1M"], ranges, summary


def merge_ai_news(
    news: List[RawNewsItem],
    ai_result: AIAnalysisResult,
) -> List[AnalyzedNewsItem]:
    assessments = {item.news_id: item for item in ai_result.news_assessments}
    expected_ids = {item.news_id for item in news}
    if set(assessments) != expected_ids:
        raise ValueError("OpenAI 新闻分析结果与输入新闻不匹配")

    return [
        AnalyzedNewsItem(
            **item.model_dump(),
            sentiment=assessments[item.news_id].sentiment,
            confidence=assessments[item.news_id].confidence,
            ai_reason=assessments[item.news_id].reason,
            sentiment_strength=assessments[item.news_id].sentiment_strength,
            source_credibility=assessments[item.news_id].source_credibility,
            recency=assessments[item.news_id].recency,
            company_relevance=assessments[item.news_id].company_relevance,
            impact_score=assessments[item.news_id].impact_score,
            chinese_summary=assessments[item.news_id].chinese_summary,
            why_important=assessments[item.news_id].why_important,
            impact_path=assessments[item.news_id].impact_path,
            impact_direction=assessments[item.news_id].impact_direction,
        )
        for item in news
    ]


def select_top_news(
    analyzed_news: List[AnalyzedNewsItem],
    top_news_ids: List[int],
) -> List[AnalyzedNewsItem]:
    by_id = {item.news_id: item for item in analyzed_news}
    selected = [by_id[news_id] for news_id in top_news_ids if news_id in by_id]
    if not selected:
        selected = sorted(
            analyzed_news,
            key=lambda item: item.impact_score,
            reverse=True,
        )[:3]
    return selected[:3]


def summarize_sentiment(news: List[AnalyzedNewsItem]) -> SentimentSummary:
    counts = {
        "bullish": sum(item.sentiment == "bullish" for item in news),
        "bearish": sum(item.sentiment == "bearish" for item in news),
        "neutral": sum(item.sentiment == "neutral" for item in news),
    }
    weighted_score = sum(
        item.confidence
        * item.impact_score
        * (1 if item.sentiment == "bullish" else -1 if item.sentiment == "bearish" else 0)
        for item in news
    )
    if weighted_score > 10:
        overall = "bullish"
    elif weighted_score < -10:
        overall = "bearish"
    else:
        overall = "neutral"
    return SentimentSummary(**counts, overall=overall)


def calculate_trend_probability(
    price: PriceSummary,
    sentiment: SentimentSummary,
    outlook: str,
) -> TrendProbability:
    sentiment_edge = sentiment.bullish - sentiment.bearish
    outlook_edge = 5 if outlook == "bullish" else -5 if outlook == "bearish" else 0
    signal = (
        price.five_day_change_percent * 1.2
        + price.month_change_percent * 0.45
        + sentiment_edge * 2
        + outlook_edge
    )
    signal = max(-20, min(20, signal))

    up = max(10, min(75, round(35 + signal)))
    down = max(10, min(75, round(35 - signal)))
    sideways = 100 - up - down
    if sideways < 15:
        adjustment = 15 - sideways
        if up >= down:
            up -= adjustment
        else:
            down -= adjustment
        sideways = 15
    return TrendProbability(up=up, down=down, sideways=sideways)
