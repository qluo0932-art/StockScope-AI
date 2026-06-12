# StockScope V3

新闻驱动的股票价格分析平台。输入股票代码后，系统会组合真实价格、
真实财经新闻和 OpenAI 结构化分析，解释股票为什么变化、市场正在交易
什么逻辑，以及短期风险与潜在催化剂。

## 核心能力

- `yfinance`：1D、1W、1M、1Y、MAX 多周期真实价格走势。
- 专业行情指标：涨跌额、5 日/1 月/3 月/1 年表现、市值、PE、Beta 和
  52 周价格区间。
- Finnhub Company News：真实标题、摘要、来源、发布时间和关联股票。
- OpenAI Structured Outputs：按请求语言生成新闻摘要、五档影响方向、影响路径和评分。
- 影响价格的关键事件：按情绪强度、来源、时效性和相关性排序。
- 完整市场报告：市场概览、价格驱动因素、市场叙事、风险和催化剂。
- 价格趋势评估：综合价格动量、新闻情绪和市场观点。
- 新闻筛选：今日、最近一周和最近一个月。
- 中英文国际化：浏览器语言自动检测、无刷新切换、偏好持久化和动态 SEO。

所有关键数据源均采用严格失败策略。Finnhub、yfinance 或 OpenAI 不可用时，API 返回明确的 `503`，不生成 mock 数据。

## 项目结构

```text
stock analyze web/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 路由与服务编排
│   │   ├── models.py           # API 与 AI 结构化输出模型
│   │   ├── news_service.py     # Finnhub 真实新闻
│   │   ├── ai_service.py       # OpenAI 结构化市场分析
│   │   └── market_analysis.py  # yfinance、新闻合并、概率模型
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── i18n.ts             # 语言检测、持久化与 react-i18next 配置
│   │   ├── locales/
│   │   │   ├── en.ts
│   │   │   └── zh-CN.ts
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
ALLOWED_ORIGINS=
```

- Finnhub Key：[finnhub.io](https://finnhub.io/)
- OpenAI Key：[API keys](https://platform.openai.com/api-keys)
- `OPENAI_MODEL` 可按账户权限更改。默认使用当前官方推荐的新项目模型。
- CORS 默认允许 Vercel 正式站点及两个本地 Vite 地址；`ALLOWED_ORIGINS`
  仅用于添加其他逗号分隔域名。

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
GET /api/analyze/{symbol}?language=zh|en
```

示例：

```bash
curl "http://localhost:8000/api/analyze/AAPL?language=en"
```

一次分析请求依次执行：

1. Finnhub 获取最近 30 天公司新闻。
2. yfinance 获取最近 1 个月价格。
3. OpenAI 一次性分析所有新闻、专业指标及价格收益。
4. Pydantic 校验结构化输出并关联回原始新闻。
5. 返回市场报告、关键事件、价格归因、市场观点和趋势概率。

`language` 默认值为 `zh`，用于控制 OpenAI 生成内容的语言。前端会根据
当前界面语言自动传递 `zh` 或 `en`，原有不带参数的 API 调用仍然兼容。

## 国际化

前端使用 `react-i18next` 和 `i18next-browser-languagedetector`：

- 首次访问根据浏览器语言选择简体中文或 English。
- 用户选择保存在 `localStorage` 的 `stockscope-language` 中。
- 切换语言时界面、日期数字格式、分析内容、页面标题和 Meta Description
  同步更新，无需刷新页面。
- 新增语言时，在 `frontend/src/locales/` 添加语言文件，并在
  `frontend/src/i18n.ts` 的 `resources` 与 `supportedLngs` 中注册。

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
