import asyncio

import pytest

from app.ai_service import AIAnalysisError, analyze_stock_with_ai
from app.market_analysis import (
    calculate_trend_probability,
    merge_ai_news,
    select_top_news,
    summarize_sentiment,
)
from app.models import (
    AIAnalysisResult,
    AINewsAssessment,
    AIOutlook,
    MarketNarrative,
    PriceSummary,
    RawNewsItem,
)
from app.news_service import NewsDataError, get_company_news


class FakeFinnhubResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return [
            {
                "datetime": 1781265600,
                "headline": "Apple launches a new product",
                "summary": "The product expands Apple's AI portfolio.",
                "related": "AAPL,MSFT",
                "source": "Reuters",
                "url": "https://example.com/apple-news",
            }
        ]


class FakeAsyncClient:
    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, _url, params):
        assert params["symbol"] == "AAPL"
        assert params["token"] == "test-key"
        return FakeFinnhubResponse()


def sample_news():
    return [
        RawNewsItem(
            news_id=0,
            symbol="AAPL",
            title="Apple launches AI product",
            summary="New product expands the company's AI portfolio.",
            published_at="2026-06-12T12:00:00+00:00",
            source="Reuters",
        ),
        RawNewsItem(
            news_id=1,
            symbol="AAPL",
            title="Apple faces regulatory review",
            summary="European regulators opened a new review.",
            published_at="2026-06-11T12:00:00+00:00",
            source="Bloomberg",
        ),
    ]


def sample_ai_result():
    return AIAnalysisResult(
        news_assessments=[
            AINewsAssessment(
                news_id=0,
                sentiment="bullish",
                confidence=0.9,
                reason="AI product expansion may support future revenue growth.",
                sentiment_strength=0.8,
                source_credibility=0.95,
                recency=1,
                company_relevance=1,
                impact_score=91,
            ),
            AINewsAssessment(
                news_id=1,
                sentiment="bearish",
                confidence=0.75,
                reason="Regulation may increase costs and pressure margins.",
                sentiment_strength=0.7,
                source_credibility=0.9,
                recency=0.8,
                company_relevance=0.95,
                impact_score=78,
            ),
        ],
        top_news_ids=[0, 1],
        market_narrative=MarketNarrative(
            summary="市场同时关注 AI 产品机会与监管风险。",
            key_risks=["欧洲监管压力"],
            key_positives=["AI 产品周期"],
        ),
        why_stock_moved="价格上涨与 AI 产品预期改善相关，但监管风险限制了涨幅。",
        outlook=AIOutlook(
            stance="bullish",
            reasons=["产品周期改善"],
            key_drivers=["AI 产品采用率", "监管进展"],
        ),
    )


def test_news_requires_finnhub_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    with pytest.raises(NewsDataError, match="FINNHUB_API_KEY"):
        asyncio.run(get_company_news("AAPL"))


def test_news_maps_finnhub_summary_and_metadata(monkeypatch):
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr("app.news_service.httpx.AsyncClient", FakeAsyncClient)

    news = asyncio.run(get_company_news("AAPL"))

    assert news[0].news_id == 0
    assert news[0].summary == "The product expands Apple's AI portfolio."
    assert news[0].related_symbols == ["AAPL", "MSFT"]
    assert news[0].published_at == "2026-06-12T12:00:00+00:00"


def test_ai_requires_openai_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    price = PriceSummary(
        current=200,
        day_change_percent=1,
        five_day_change_percent=3,
        month_change_percent=6,
    )
    with pytest.raises(AIAnalysisError, match="OPENAI_API_KEY"):
        asyncio.run(
            analyze_stock_with_ai("AAPL", "Apple Inc.", price, sample_news())
        )


def test_ai_uses_structured_openai_response(monkeypatch):
    expected = sample_ai_result()

    class FakeResponses:
        async def parse(self, **kwargs):
            assert kwargs["model"] == "test-model"
            assert kwargs["text_format"] is AIAnalysisResult
            assert "Apple launches AI product" in kwargs["input"][1]["content"]
            return type("FakeResponse", (), {"output_parsed": expected})()

    class FakeOpenAIClient:
        def __init__(self, **kwargs):
            assert kwargs["api_key"] == "test-openai-key"
            self.responses = FakeResponses()

    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setattr("app.ai_service.AsyncOpenAI", FakeOpenAIClient)
    price = PriceSummary(
        current=200,
        day_change_percent=1,
        five_day_change_percent=3,
        month_change_percent=6,
    )

    result, model = asyncio.run(
        analyze_stock_with_ai("AAPL", "Apple Inc.", price, sample_news())
    )

    assert result == expected
    assert model == "test-model"


def test_ai_news_merge_ranking_and_probability():
    result = sample_ai_result()
    merged = merge_ai_news(sample_news(), result)
    sentiment = summarize_sentiment(merged)
    top_news = select_top_news(merged, result.top_news_ids)
    trend = calculate_trend_probability(
        PriceSummary(
            current=200,
            day_change_percent=1,
            five_day_change_percent=3,
            month_change_percent=6,
        ),
        sentiment,
        result.outlook.stance,
    )

    assert merged[0].sentiment == "bullish"
    assert merged[0].ai_reason.startswith("AI product")
    assert [item.news_id for item in top_news] == [0, 1]
    assert trend.up + trend.down + trend.sideways == 100


def test_ai_merge_rejects_missing_assessment():
    result = sample_ai_result()
    result.news_assessments.pop()
    with pytest.raises(ValueError, match="不匹配"):
        merge_ai_news(sample_news(), result)
