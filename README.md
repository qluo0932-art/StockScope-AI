# StockScope V2

AI News-Driven Stock Analysis Agent。输入股票代码后，系统会组合真实价格、真实财经新闻和 OpenAI 结构化分析，解释股票为什么变化、哪些新闻最重要，以及短期走势的主要驱动因素。

## 核心能力

- `yfinance`：近 1 个月真实价格与日、5 日、月度收益率。
- Finnhub Company News：真实标题、摘要、来源、发布时间和关联股票。
- OpenAI Structured Outputs：逐条新闻情绪、置信度、影响逻辑和重要性评分。
- Top 3 Influential News：按情绪强度、来源可信度、时效性和相关性排序。
- Market Narrative：市场简述、关键风险和关键利好。
- Why The Stock Moved：关联价格收益与新闻，生成价格变化原因分析。
- AI Outlook：Bullish、Neutral 或 Bearish，并给出原因和关键驱动因素。

所有关键数据源均采用严格失败策略。Finnhub、yfinance 或 OpenAI 不可用时，API 返回明确的 `503`，不生成 mock 数据。

## 项目结构

```text
stock analyze web/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 路由与服务编排
│   │   ├── models.py           # API 与 AI 结构化输出模型
│   │   ├── news_service.py     # Finnhub 真实新闻
│   │   ├── ai_service.py       # OpenAI AI 分析 Agent
│   │   └── market_analysis.py  # yfinance、新闻合并、概率模型
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── styles.css
│   │   └── types.ts
│   ├── .env.example
│   └── package.json
└── README.md
```

这种边界允许未来分别替换：

- `ai_service.py`：FinBERT、RAG、向量数据库或其他模型。
- `market_analysis.py`：LSTM、回测模型或更完整的因子模型。
- `news_service.py`：更多新闻供应商或新闻聚合层。

## 环境变量

复制配置模板：

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env`：

```dotenv
FINNHUB_API_KEY=你的_finnhub_api_key
OPENAI_API_KEY=你的_openai_api_key
OPENAI_MODEL=gpt-5.5
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

- Finnhub Key：[finnhub.io](https://finnhub.io/)
- OpenAI Key：[API keys](https://platform.openai.com/api-keys)
- `OPENAI_MODEL` 可按账户权限更改。默认使用当前官方推荐的新项目模型。

## 启动后端

需要 Python 3.9 或更高版本。

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API 文档：`http://localhost:8000/docs`

## 启动前端

需要 Node.js 20 或更高版本及 npm。

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

浏览器打开 `http://localhost:5173`。

前端 API 地址可在 `frontend/.env` 修改：

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

## API

```text
GET /api/health
GET /api/analyze/{symbol}
```

示例：

```bash
curl http://localhost:8000/api/analyze/AAPL
```

一次分析请求依次执行：

1. Finnhub 获取最近 30 天公司新闻。
2. yfinance 获取最近 1 个月价格。
3. OpenAI 一次性分析所有新闻及价格收益。
4. Pydantic 校验结构化输出并关联回原始新闻。
5. 返回 AI 摘要、Top 3、价格归因、Outlook 和趋势概率。

## 错误行为

- 缺少 `FINNHUB_API_KEY`：返回真实新闻配置错误。
- 缺少 `OPENAI_API_KEY`：返回 AI 配置错误。
- Finnhub、yfinance 或 OpenAI 请求失败：返回 `503`。
- OpenAI 结构化结果与新闻不匹配：拒绝响应并返回 `503`。
- 不使用 mock 新闻、mock AI 分析或 mock 价格。

## 测试与构建

```bash
cd backend
.venv/bin/pytest -q

cd ../frontend
npm run build
```

> 风险提示：本项目输出仅用于信息参考，不构成投资建议。
