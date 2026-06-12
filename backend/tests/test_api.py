from fastapi.testclient import TestClient

from app.ai_service import AIAnalysisError
from app.main import app
from app.models import PricePoint, PriceSummary, RawNewsItem
from app.news_service import NewsDataError


VERCEL_ORIGIN = "https://stock-scope-ai-livid.vercel.app"


def fake_news():
    return [
        RawNewsItem(
            news_id=0,
            symbol="AAPL",
            title="Apple news",
            summary="A real summary",
            published_at="2026-06-12T12:00:00+00:00",
            source="Reuters",
        )
    ]


def test_analysis_returns_503_when_finnhub_fails(monkeypatch):
    async def failed_news(_symbol):
        raise NewsDataError("Finnhub 新闻数据获取失败，请稍后重试")

    monkeypatch.setattr("app.main.get_company_news", failed_news)

    response = TestClient(app).get(
        "/api/analyze/AAPL",
        headers={"Origin": VERCEL_ORIGIN},
    )

    assert response.status_code == 503
    assert response.json()["detail"].startswith("Finnhub")
    assert response.headers["access-control-allow-origin"] == VERCEL_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_analysis_returns_503_when_openai_fails(monkeypatch):
    async def loaded_news(_symbol):
        return fake_news()

    def loaded_price(_symbol):
        return (
            [
                PricePoint(date=f"2026-06-{day:02d}", close=100 + day)
                for day in range(1, 7)
            ],
            {
                "1D": [PricePoint(date="2026-06-06T15:00:00+00:00", close=106)],
                "1W": [
                    PricePoint(date=f"2026-06-{day:02d}", close=100 + day)
                    for day in range(1, 7)
                ],
                "1M": [
                    PricePoint(date=f"2026-06-{day:02d}", close=100 + day)
                    for day in range(1, 7)
                ],
                "1Y": [
                    PricePoint(date=f"2026-06-{day:02d}", close=100 + day)
                    for day in range(1, 7)
                ],
                "MAX": [
                    PricePoint(date=f"2026-06-{day:02d}", close=100 + day)
                    for day in range(1, 7)
                ],
            },
            PriceSummary(
                current=106,
                day_change=1,
                day_change_percent=1,
                five_day_change_percent=5,
                month_change_percent=5,
                three_month_change_percent=8,
                year_change_percent=12,
            ),
        )

    async def failed_ai(*_args):
        raise AIAnalysisError("OpenAI AI 分析失败，请稍后重试")

    monkeypatch.setattr("app.main.get_company_news", loaded_news)
    monkeypatch.setattr("app.main.get_price_data", loaded_price)
    monkeypatch.setattr("app.main.analyze_stock_with_ai", failed_ai)

    response = TestClient(app).get("/api/analyze/AAPL")

    assert response.status_code == 503
    assert response.json() == {"detail": "OpenAI AI 分析失败，请稍后重试"}


def test_cors_preflight_allows_vercel_frontend():
    response = TestClient(app).options(
        "/api/analyze/AAPL",
        headers={
            "Origin": VERCEL_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == VERCEL_ORIGIN
    assert "GET" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in response.headers
