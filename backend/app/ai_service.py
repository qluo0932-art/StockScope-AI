import json
import os
from typing import List

from openai import AsyncOpenAI, OpenAIError

from .models import AIAnalysisResult, PriceSummary, RawNewsItem


class AIAnalysisError(Exception):
    """Raised when OpenAI cannot produce a validated stock analysis."""


SYSTEM_PROMPT = """
You are a cautious financial news analysis agent. Analyze only the supplied
market data and news. Do not invent events, prices, sources, or causality.
Distinguish evidence from plausible interpretation.

For every news item:
- classify sentiment as bullish, bearish, or neutral;
- provide confidence and a concise causal reason;
- score sentiment strength, source credibility, recency, company relevance;
- calculate impact_score from 0 to 100 using those dimensions.

Then rank up to three most influential news IDs, write a Chinese market
narrative of about 100 Chinese characters, explain why the stock moved using
both returns and news, and provide a short-term AI outlook with reasons and key
drivers. If news does not explain the price move, say so explicitly. Output
Chinese analysis except enum values. This is analysis, not investment advice.
""".strip()


async def analyze_stock_with_ai(
    symbol: str,
    company_name: str,
    price: PriceSummary,
    news: List[RawNewsItem],
) -> tuple[AIAnalysisResult, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIAnalysisError("未配置 OPENAI_API_KEY，无法运行 AI 分析")

    model = os.getenv("OPENAI_MODEL", "gpt-5.5")
    payload = {
        "symbol": symbol,
        "company_name": company_name,
        "price_returns": {
            "day_percent": price.day_change_percent,
            "five_day_percent": price.five_day_change_percent,
            "month_percent": price.month_change_percent,
        },
        "news": [
            {
                "news_id": item.news_id,
                "title": item.title,
                "summary": item.summary,
                "source": item.source,
                "published_at": item.published_at,
                "symbol": item.symbol,
                "related_symbols": item.related_symbols,
            }
            for item in news
        ],
    }

    try:
        client = AsyncOpenAI(api_key=api_key, timeout=45)
        response = await client.responses.parse(
            model=model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
            text_format=AIAnalysisResult,
        )
        result = response.output_parsed
    except (OpenAIError, ValueError, TypeError) as exc:
        raise AIAnalysisError("OpenAI AI 分析失败，请稍后重试") from exc

    if result is None:
        raise AIAnalysisError("OpenAI 未返回可用的结构化分析结果")

    return result, model
