import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai_service import AIAnalysisError, analyze_stock_with_ai
from .market_analysis import (
    COMPANY_NAMES,
    MarketDataError,
    calculate_trend_probability,
    get_price_data,
    merge_ai_news,
    select_top_news,
    summarize_sentiment,
)
from .models import AnalysisResponse
from .news_service import NewsDataError, get_company_news


load_dotenv()

app = FastAPI(
    title="StockScope V2 API",
    description="AI news-driven stock analysis agent",
    version="2.0.0",
)

required_origins = {
    "https://stock-scope-ai-livid.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
extra_origins = {
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(required_origins | extra_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/analyze/{symbol}", response_model=AnalysisResponse)
async def analyze_stock(symbol: str) -> AnalysisResponse:
    normalized = symbol.strip().upper()
    if not normalized or len(normalized) > 10 or not normalized.replace(".", "").isalnum():
        raise HTTPException(status_code=400, detail="请输入有效的股票代码")

    company_name = COMPANY_NAMES.get(normalized, normalized)
    try:
        news = await get_company_news(normalized)
        price_history, price_summary = get_price_data(normalized)
        ai_result, ai_model = await analyze_stock_with_ai(
            normalized,
            company_name,
            price_summary,
            news,
        )
        analyzed_news = merge_ai_news(news, ai_result)
    except (NewsDataError, MarketDataError, AIAnalysisError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="OpenAI 返回的数据无法与新闻匹配，请稍后重试",
        ) from exc

    sentiment = summarize_sentiment(analyzed_news)
    trend = calculate_trend_probability(
        price_summary,
        sentiment,
        ai_result.outlook.stance,
    )

    return AnalysisResponse(
        symbol=normalized,
        company_name=company_name,
        generated_at=datetime.now(timezone.utc).isoformat(),
        data_mode="live",
        news_data_source="Finnhub",
        ai_data_source="OpenAI",
        ai_model=ai_model,
        price_summary=price_summary,
        price_history=price_history,
        news=analyzed_news,
        top_influential_news=select_top_news(
            analyzed_news,
            ai_result.top_news_ids,
        ),
        sentiment_summary=sentiment,
        market_narrative=ai_result.market_narrative,
        why_stock_moved=ai_result.why_stock_moved,
        ai_outlook=ai_result.outlook,
        trend_probability=trend,
        risk_notice="本页面 AI 分析仅用于信息参考，不构成任何投资建议。",
    )
