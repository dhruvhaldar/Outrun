# Outrun

Outrun is a Vercel-deployable portfolio reality-check app. It compares a custom equity portfolio against VOO using a Next.js frontend and a Python serverless API backed by `pandas`, `numpy`, and `yfinance`.

## Features

- Toggle between target-weight simulation and actual-share tracking.
- Optional six-month rebalancing for target-weight portfolios.
- JSON API at `POST /api/evaluate`.
- Interactive Recharts growth-of-$1 chart.
- Alpha return hero metric, performance stats, and six-month checkpoints.

## Local development

```bash
npm install
pip install -r requirements.txt
npm run dev
```

Then open `http://localhost:3000`.
