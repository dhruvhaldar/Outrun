# Outrun

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Outrun is a Vercel-deployable portfolio reality-check app. It compares a custom equity portfolio against **VOO** using a Next.js frontend and a Python serverless API backed by `pandas`, `numpy`, and `yfinance`.

Use it when you want to answer one blunt question: **is this portfolio beating an investable S&P 500 ETF benchmark, or is VOO quietly doing laps around it?**

> **Disclaimer:** Outrun is for research and personal tracking only. It is not financial, investment, tax, or legal advice. Market data is provided through Yahoo Finance via `yfinance`, which is best suited for personal/research use rather than high-traffic production workloads.

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Response schema](#response-schema)
- [Deployment](#deployment)
- [Self-hosting](#self-hosting)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Portfolio input modes**
  - Target weights for simulated allocations.
  - Actual shares for tracking a real portfolio.
- **VOO benchmark comparison**
  - Uses VOO as an investable S&P 500 ETF proxy rather than a non-investable index level.
- **Strategy support**
  - Buy-and-hold target-weight simulation.
  - Optional six-month rebalancing back to target weights.
  - Actual-share portfolio valuation.
- **Interactive dashboard**
  - Alpha return hero metric.
  - Growth-of-$1 chart with hover tooltips.
  - Performance stats table.
  - Six-month checkpoint timeline with Ahead/Behind status.
- **Serverless Python API**
  - Keeps the finance calculations in Python with `pandas`, `numpy`, and `yfinance`.
  - Returns JSON instead of CSV files or Matplotlib images.
  - Converts NaN/NumPy/pandas values into JSON-safe values.
- **Deployable two ways**
  - Vercel-hosted app.
  - Self-hosted Next.js app with the same Python API files.

## Architecture

Outrun uses a decoupled app structure inside one repository:

```text
Browser
  │
  ▼
Next.js / React UI
  │ POST /api/evaluate
  ▼
Vercel Python Serverless Function
  │
  ├─ yfinance downloads adjusted price data
  ├─ pandas/numpy calculate portfolio curves and statistics
  └─ JSON response feeds charts and tables
```

The frontend is responsible for collecting user inputs and rendering the dashboard. The backend is responsible for market data retrieval, portfolio simulation, benchmark comparison, and JSON serialization.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Charts | Recharts |
| Backend | Vercel Python Serverless Functions |
| Data and math | `pandas`, `numpy`, `yfinance` |
| Deployment | Vercel or self-hosted Node/Python environment |

## Quick start

### Prerequisites

Install the following before running Outrun locally:

- Node.js 20 or newer.
- npm.
- Python 3.12 or newer.
- pip.

### Install dependencies

```bash
npm install
pip install -r requirements.txt
```

### Run the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### Build for production

```bash
npm run build
npm run start
```

## Configuration

The default UI starts with this target-weight portfolio:

| Ticker | Weight |
| --- | ---: |
| PGR | 16% |
| LLY | 16% |
| ORLY | 14% |
| V | 12% |
| TDG | 12% |
| ICE | 10% |
| RACE | 10% |
| CB | 10% |

You can edit these values directly in the browser. If weights do not sum exactly to `1.0`, the API normalizes them before calculating results.

### Target weights mode

Use this mode to simulate putting a starting amount of capital into a chosen allocation.

Relevant fields:

- Initial capital.
- Start date.
- Benchmark ticker.
- Rebalance every six months.
- Ticker/weight rows.

### Actual shares mode

Use this mode after you have bought real shares. Actual-share mode ignores target weights and initial capital for portfolio construction. The benchmark is funded with the portfolio's starting market value so the comparison is apples-to-apples.

Relevant fields:

- Start date.
- Benchmark ticker.
- Ticker/share-count rows.

## API reference

### `POST /api/evaluate`

Evaluates a portfolio against a benchmark and returns JSON data for the dashboard.

#### Request body

```json
{
  "initial_capital": 5000,
  "start_date": "2026-06-14",
  "benchmark": "VOO",
  "rebalance": false,
  "portfolio_weights": {
    "PGR": 0.16,
    "LLY": 0.16,
    "ORLY": 0.14,
    "V": 0.12,
    "TDG": 0.12,
    "ICE": 0.10,
    "RACE": 0.10,
    "CB": 0.10
  },
  "actual_shares": {}
}
```

#### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `initial_capital` | Number | No | Starting cash for target-weight simulations. Defaults to `5000`. Ignored for actual-share construction. |
| `start_date` | String | No | Purchase/start date in `YYYY-MM-DD` format. Defaults to the server date if omitted. |
| `benchmark` | String | No | Benchmark ticker. Defaults to `VOO`. |
| `rebalance` | Boolean | No | If `true`, target-weight portfolios rebalance every six months. Ignored in actual-share mode. |
| `portfolio_weights` | Object | Conditional | Ticker-to-weight map used when `actual_shares` is empty. |
| `actual_shares` | Object | Conditional | Ticker-to-share-count map. If populated, this overrides target-weight portfolio construction. |

#### Example request

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "initial_capital": 1000,
    "start_date": "2024-01-01",
    "benchmark": "VOO",
    "rebalance": false,
    "portfolio_weights": { "AAPL": 1 },
    "actual_shares": {}
  }'
```

## Response schema

The API returns data shaped for the frontend dashboard:

```json
{
  "summary": {
    "strategy": "Target weights, buy and hold",
    "start_date": "2024-01-02",
    "end_date": "2026-06-12",
    "benchmark": "VOO"
  },
  "final_results": {
    "portfolio_value": 1234.56,
    "voo_value": 1111.11,
    "alpha_dollars": 123.45,
    "portfolio_return": 0.2345,
    "voo_return": 0.1111,
    "alpha_return": 0.1234
  },
  "performance_stats": {
    "portfolio": {
      "start_value": 1000,
      "end_value": 1234.56,
      "total_return": 0.2345,
      "cagr": 0.095,
      "annual_volatility": 0.21,
      "max_drawdown": -0.12,
      "sharpe": 0.83
    },
    "voo": {
      "start_value": 1000,
      "end_value": 1111.11,
      "total_return": 0.1111,
      "cagr": 0.045,
      "annual_volatility": 0.17,
      "max_drawdown": -0.08,
      "sharpe": 0.62
    }
  },
  "checkpoints": [
    {
      "date": "2024-07-01",
      "portfolio_value": 1050,
      "voo_value": 1030,
      "portfolio_return": 0.05,
      "voo_return": 0.03,
      "alpha_return": 0.02,
      "status": "Ahead"
    }
  ],
  "daily_curves": [
    { "date": "2024-01-02", "portfolio": 1, "voo": 1 },
    { "date": "2024-01-03", "portfolio": 1.01, "voo": 0.99 }
  ]
}
```

All non-finite numeric values are converted to `null` before the response is serialized.

## Deployment

### Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Create a new Vercel project from the repository.
3. Use the default framework detection for Next.js.
4. Ensure the Python dependencies in `requirements.txt` are installed by Vercel for the `/api` function.
5. Deploy.

### Vercel considerations

- `pandas`, `numpy`, and `yfinance` are heavier than a typical JSON API dependency set. Keep Python dependencies lean.
- Serverless functions can time out when Yahoo Finance is slow or when a request includes many tickers over a long date range.
- `yfinance` is not intended for high-traffic public APIs. If the app becomes public or heavily used, replace it with a market-data provider designed for production use.

## Self-hosting

Outrun can also be hosted on any environment that supports Node.js and Python dependencies.

A simple production flow is:

```bash
npm ci
pip install -r requirements.txt
npm run build
npm run start
```

For containers, start from a Node image that includes or installs Python and pip, install both dependency sets, build the Next.js app, and expose port `3000`.

## Project structure

```text
.
├── api/
│   └── evaluate.py        # Python serverless portfolio evaluator
├── app/
│   ├── layout.tsx         # Root Next.js layout and metadata
│   ├── page.tsx           # Portfolio form and dashboard UI
│   └── styles.css         # Global app styling
├── package.json           # Node scripts and frontend dependencies
├── requirements.txt       # Python API dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md
```

## Development commands

| Command | Description |
| --- | --- |
| `npm install` | Install Node dependencies. |
| `pip install -r requirements.txt` | Install Python dependencies. |
| `npm run dev` | Start the local Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server after building. |
| `python -m py_compile api/evaluate.py` | Syntax-check the Python API module. |

## Troubleshooting

### No price data downloaded

Check that:

- Tickers are valid Yahoo Finance symbols.
- The start date is not in the future.
- The server has internet access.
- Yahoo Finance is responding normally.

### Missing ticker data

The API requires complete adjusted-close data for all requested tickers after forward-filling. If one ticker has no usable data, the request fails with a missing-data message.

### Slow API responses

Try:

- Fewer tickers.
- A more recent start date.
- Re-running the request if Yahoo Finance is temporarily slow.
- Moving to a production market-data provider for shared/public deployments.

### `npm audit` warning for Next/PostCSS

If npm reports a PostCSS advisory through Next.js and suggests a breaking downgrade, review the advisory and the currently available Next.js releases before forcing any automated remediation.

## Roadmap

Potential future improvements:

- Add request-level caching for market data.
- Add CSV export from the browser.
- Add support for custom benchmark labels.
- Add persisted portfolios with local storage.
- Add Dockerfile and compose examples for self-hosting.
- Add automated Python unit tests for the evaluator.

## Contributing

Contributions are welcome. For substantial changes, open an issue first so the implementation approach can be discussed.

Before opening a pull request, run:

```bash
npm run build
python -m py_compile api/evaluate.py
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
