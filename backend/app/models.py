from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


AISentiment = Literal["bullish", "bearish", "neutral"]
ImpactDirection = Literal[
    "strong_bullish",
    "bullish",
    "neutral",
    "bearish",
    "strong_bearish",
]


class PricePoint(BaseModel):
    date: str
    close: float


class PriceSummary(BaseModel):
    current: float
    currency: str = "USD"
    day_change: float
    day_change_percent: float
    five_day_change_percent: float
    month_change_percent: float
    three_month_change_percent: float
    year_change_percent: float
    market_cap: Optional[float] = None
    trailing_pe: Optional[float] = None
    beta: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None


class RawNewsItem(BaseModel):
    news_id: int
    symbol: str
    related_symbols: List[str] = Field(default_factory=list)
    title: str
    summary: str
    published_at: str
    source: str
    url: Optional[str] = None


class AINewsAssessment(BaseModel):
    news_id: int
    sentiment: AISentiment
    confidence: float = Field(ge=0, le=1)
    reason: str
    sentiment_strength: float = Field(ge=0, le=1)
    source_credibility: float = Field(ge=0, le=1)
    recency: float = Field(ge=0, le=1)
    company_relevance: float = Field(ge=0, le=1)
    impact_score: float = Field(ge=0, le=100)
    chinese_summary: str
    why_important: str
    impact_path: List[str] = Field(min_length=2, max_length=5)
    impact_direction: ImpactDirection


class AnalyzedNewsItem(RawNewsItem):
    sentiment: AISentiment
    confidence: float = Field(ge=0, le=1)
    ai_reason: str
    sentiment_strength: float = Field(ge=0, le=1)
    source_credibility: float = Field(ge=0, le=1)
    recency: float = Field(ge=0, le=1)
    company_relevance: float = Field(ge=0, le=1)
    impact_score: float = Field(ge=0, le=100)
    chinese_summary: str
    why_important: str
    impact_path: List[str]
    impact_direction: ImpactDirection


class SentimentSummary(BaseModel):
    bullish: int
    bearish: int
    neutral: int
    overall: AISentiment


class TrendProbability(BaseModel):
    up: int
    down: int
    sideways: int


class MarketNarrative(BaseModel):
    summary: str = Field(min_length=20, max_length=500)
    key_risks: List[str]
    key_positives: List[str]


class CorePriceDrivers(BaseModel):
    positive_factor: str
    negative_factor: str
    market_focus: str


class RiskAssessment(BaseModel):
    short_term: List[str]
    medium_term: List[str]


class MarketReport(BaseModel):
    market_overview: str
    core_price_drivers: CorePriceDrivers
    market_narrative: str = Field(min_length=80, max_length=500)
    risk_assessment: RiskAssessment
    potential_catalysts: List[str]


class AIOutlook(BaseModel):
    stance: AISentiment
    reasons: List[str]
    key_drivers: List[str]


class AIAnalysisResult(BaseModel):
    news_assessments: List[AINewsAssessment]
    top_news_ids: List[int] = Field(min_length=1, max_length=3)
    market_narrative: MarketNarrative
    market_report: MarketReport
    why_stock_moved: str
    outlook: AIOutlook


class AnalysisResponse(BaseModel):
    symbol: str
    company_name: str
    generated_at: str
    data_mode: Literal["live"]
    news_data_source: Literal["Finnhub"]
    ai_data_source: Literal["OpenAI"]
    ai_model: str
    price_summary: PriceSummary
    price_history: List[PricePoint]
    price_history_ranges: Dict[str, List[PricePoint]]
    news: List[AnalyzedNewsItem]
    top_influential_news: List[AnalyzedNewsItem]
    sentiment_summary: SentimentSummary
    market_narrative: MarketNarrative
    market_report: MarketReport
    why_stock_moved: str
    ai_outlook: AIOutlook
    trend_probability: TrendProbability
    risk_notice: str
