export type AISentiment = "bullish" | "bearish" | "neutral";

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
    day_change_percent: number;
    five_day_change_percent: number;
    month_change_percent: number;
  };
  price_history: Array<{ date: string; close: number }>;
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
