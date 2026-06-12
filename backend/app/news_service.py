import os
from datetime import datetime, timedelta, timezone
from typing import List

import httpx

from .models import RawNewsItem


class NewsDataError(Exception):
    """Raised when Finnhub cannot provide usable real news data."""


def _parse_related_symbols(value: object) -> List[str]:
    if not isinstance(value, str):
        return []
    return [item.strip().upper() for item in value.split(",") if item.strip()]


async def get_company_news(symbol: str) -> List[RawNewsItem]:
    api_key = os.getenv("FINNHUB_API_KEY")
    if not api_key:
        raise NewsDataError("未配置 FINNHUB_API_KEY，无法获取真实新闻数据")

    today = datetime.now(timezone.utc).date()
    params = {
        "symbol": symbol,
        "from": (today - timedelta(days=30)).isoformat(),
        "to": today.isoformat(),
        "token": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://finnhub.io/api/v1/company-news",
                params=params,
            )
            response.raise_for_status()
            articles = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise NewsDataError("Finnhub 新闻数据获取失败，请稍后重试") from exc

    if not isinstance(articles, list):
        raise NewsDataError("Finnhub 返回了无效的新闻数据")

    news: List[RawNewsItem] = []
    for article in articles:
        if not isinstance(article, dict):
            continue
        title = article.get("headline")
        published_timestamp = article.get("datetime")
        source = article.get("source")
        if not title or not published_timestamp or not source:
            continue
        try:
            published_at = datetime.fromtimestamp(
                int(published_timestamp),
                tz=timezone.utc,
            ).isoformat()
        except (TypeError, ValueError, OSError):
            continue

        news.append(
            RawNewsItem(
                news_id=len(news),
                symbol=symbol,
                related_symbols=_parse_related_symbols(article.get("related")),
                title=title,
                summary=(article.get("summary") or "").strip(),
                published_at=published_at,
                source=source,
                url=article.get("url"),
            )
        )
        if len(news) == 10:
            break

    if not news:
        raise NewsDataError(f"Finnhub 未返回 {symbol} 的可用新闻")

    return news
