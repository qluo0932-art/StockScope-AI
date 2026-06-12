from typing import List, Tuple

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


def get_price_data(symbol: str) -> Tuple[List[PricePoint], PriceSummary]:
    try:
        history = yf.Ticker(symbol).history(
            period="1mo",
            interval="1d",
            auto_adjust=True,
        )
        if history.empty or len(history) < 6:
            raise ValueError("Not enough market data")
    except Exception as exc:
        raise MarketDataError(
            f"无法获取 {symbol} 的真实价格数据，请稍后重试"
        ) from exc

    points = [
        PricePoint(date=index.date().isoformat(), close=round(float(row["Close"]), 2))
        for index, row in history.iterrows()
    ]
    closes = [point.close for point in points]
    summary = PriceSummary(
        current=closes[-1],
        day_change_percent=_percent_change(closes[-1], closes[-2]),
        five_day_change_percent=_percent_change(closes[-1], closes[-6]),
        month_change_percent=_percent_change(closes[-1], closes[0]),
    )
    return points, summary


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
