export type AISentiment = "bullish" | "bearish" | "neutral";
export type ImpactDirection =
  | "strong_bullish"
  | "bullish"
  | "neutral"
  | "bearish"
  | "strong_bearish";
export type PriceRange = "1D" | "1W" | "1M" | "1Y" | "MAX";
export type NewsRange = "today" | "week" | "month";

export interface PricePoint {
  date: string;
  close: number;
}

export interface NewsItem {
  news_id: number;
  symbol: string;
  related_symbols: string[];
  title: string;
  summary: string;
  published_at: string;
  source: string;
  url?: string;
  sentiment: AISentiment;
  confidence: number;
  ai_reason: string;
  sentiment_strength: number;
  source_credibility: number;
  recency: number;
  company_relevance: number;
  impact_score: number;
  chinese_summary: string;
  why_important: string;
  impact_path: string[];
  impact_direction: ImpactDirection;
}

export interface Analysis {
  symbol: string;
  company_name: string;
  generated_at: string;
  data_mode: "live";
  news_data_source: "Finnhub";
  ai_data_source: "OpenAI";
  ai_model: string;
  price_summary: {
    current: number;
    currency: string;
    day_change: number;
    day_change_percent: number;
    five_day_change_percent: number;
    month_change_percent: number;
    three_month_change_percent: number;
    year_change_percent: number;
    market_cap?: number;
    trailing_pe?: number;
    beta?: number;
    fifty_two_week_high?: number;
    fifty_two_week_low?: number;
  };
  price_history: PricePoint[];
  price_history_ranges: Record<PriceRange, PricePoint[]>;
  news: NewsItem[];
  top_influential_news: NewsItem[];
  sentiment_summary: {
    bullish: number;
    bearish: number;
    neutral: number;
    overall: AISentiment;
  };
  market_narrative: {
    summary: string;
    key_risks: string[];
    key_positives: string[];
  };
  market_report: {
    market_overview: string;
    core_price_drivers: {
      positive_factor: string;
      negative_factor: string;
      market_focus: string;
    };
    market_narrative: string;
    risk_assessment: {
      short_term: string[];
      medium_term: string[];
    };
    potential_catalysts: string[];
  };
  why_stock_moved: string;
  ai_outlook: {
    stance: AISentiment;
    reasons: string[];
    key_drivers: string[];
  };
  trend_probability: {
    up: number;
    down: number;
    sideways: number;
  };
  risk_notice: string;
}
