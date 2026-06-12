import asyncio

import pandas as pd
import pytest

from app.ai_service import AIAnalysisError, analyze_stock_with_ai
from app.market_analysis import (
    calculate_trend_probability,
    get_price_data,
    merge_ai_news,
    select_top_news,
    summarize_sentiment,
)
from app.models import (
    AIAnalysisResult,
    AINewsAssessment,
    AIOutlook,
    CorePriceDrivers,
    MarketReport,
    MarketNarrative,
    PriceSummary,
    RawNewsItem,
    RiskAssessment,
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


def sample_price():
    return PriceSummary(
        current=200,
        currency="USD",
        day_change=2,
        day_change_percent=1,
        five_day_change_percent=3,
        month_change_percent=6,
        three_month_change_percent=8,
        year_change_percent=18,
        market_cap=3000000000000,
        trailing_pe=31.2,
        beta=1.1,
        fifty_two_week_high=210,
        fifty_two_week_low=140,
    )


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
                chinese_summary="苹果发布新的 AI 产品，进一步扩展其产品组合。",
                why_important="新产品可能影响未来收入增速与估值预期。",
                impact_path=["产品发布", "采用率预期上升", "收入预期改善"],
                impact_direction="strong_bullish",
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
                chinese_summary="欧洲监管机构对苹果展开新的审查。",
                why_important="监管措施可能影响服务业务利润率。",
                impact_path=["监管审查", "合规成本上升", "利润率承压"],
                impact_direction="bearish",
            ),
        ],
        top_news_ids=[0, 1],
        market_narrative=MarketNarrative(
            summary="市场正在同时交易苹果人工智能产品周期带来的增长机会，以及欧洲监管压力对服务业务利润率的潜在影响，短期定价在增长预期改善与估值约束之间寻找平衡。",
            key_risks=["欧洲监管压力"],
            key_positives=["AI 产品周期"],
        ),
        market_report=MarketReport(
            market_overview="股价当日上涨，近一个月保持正收益，新闻情绪偏多。",
            core_price_drivers=CorePriceDrivers(
                positive_factor="AI 产品周期改善增长预期",
                negative_factor="欧洲监管可能压低服务业务利润率",
                market_focus="新产品采用率与监管进展",
            ),
            market_narrative="投资者正在交易苹果人工智能产品进入商业化阶段的逻辑，期待新功能带动换机与服务收入，同时担心欧洲监管限制商业模式并推高合规成本。市场下一阶段将重点观察产品采用率、开发者反馈和监管执行强度。",
            risk_assessment=RiskAssessment(
                short_term=["产品发布后的市场反馈低于预期"],
                medium_term=["监管要求改变服务业务盈利模式"],
            ),
            potential_catalysts=["季度财报", "开发者大会", "监管裁决"],
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


def test_price_data_returns_ranges_and_professional_metrics(monkeypatch):
    daily = pd.DataFrame(
        {"Close": [100 + index for index in range(300)]},
        index=pd.date_range("2025-04-01", periods=300, freq="B", tz="UTC"),
    )
    intraday = pd.DataFrame(
        {"Close": [399, 400, 401]},
        index=pd.date_range("2026-06-12 14:30", periods=3, freq="5min", tz="UTC"),
    )

    class FakeTicker:
        info = {
            "currency": "USD",
            "marketCap": 3000000000000,
            "trailingPE": 30.5,
            "beta": 1.2,
            "fiftyTwoWeekHigh": 410,
            "fiftyTwoWeekLow": 220,
        }

        def history(self, period, interval, auto_adjust):
            assert auto_adjust is True
            return intraday if interval == "5m" else daily

    monkeypatch.setattr("app.market_analysis.yf.Ticker", lambda _symbol: FakeTicker())

    month_points, ranges, summary = get_price_data("AAPL")

    assert set(ranges) == {"1D", "1W", "1M", "1Y", "MAX"}
    assert month_points == ranges["1M"]
    assert len(ranges["1W"]) == 6
    assert len(ranges["1Y"]) == 253
    assert summary.current == 401
    assert summary.day_change == 3
    assert summary.market_cap == 3000000000000
    assert summary.trailing_pe == 30.5


def test_ai_requires_openai_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(AIAnalysisError, match="OPENAI_API_KEY"):
        asyncio.run(
            analyze_stock_with_ai("AAPL", "Apple Inc.", sample_price(), sample_news())
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
    result, model = asyncio.run(
        analyze_stock_with_ai(
            "AAPL",
            "Apple Inc.",
            sample_price(),
            sample_news(),
            "en",
        )
    )

    assert result == expected
    assert model == "test-model"


def test_ai_news_merge_ranking_and_probability():
    result = sample_ai_result()
    merged = merge_ai_news(sample_news(), result)
    sentiment = summarize_sentiment(merged)
    top_news = select_top_news(merged, result.top_news_ids)
    trend = calculate_trend_probability(
        sample_price(),
        sentiment,
        result.outlook.stance,
    )

    assert merged[0].sentiment == "bullish"
    assert merged[0].ai_reason.startswith("AI product")
    assert merged[0].impact_path[-1] == "收入预期改善"
    assert [item.news_id for item in top_news] == [0, 1]
    assert trend.up + trend.down + trend.sideways == 100


def test_ai_merge_rejects_missing_assessment():
    result = sample_ai_result()
    result.news_assessments.pop()
    with pytest.raises(ValueError, match="不匹配"):
        merge_ai_news(sample_news(), result)
