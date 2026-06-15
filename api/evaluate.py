from __future__ import annotations

import json
import math
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from http.server import BaseHTTPRequestHandler

DEFAULT_WEIGHTS = {"PGR": .16, "LLY": .16, "ORLY": .14, "V": .12, "TDG": .12, "ICE": .10, "RACE": .10, "CB": .10}


def _clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean(v) for v in value]
    if isinstance(value, (np.floating, float)):
        return None if not math.isfinite(float(value)) else float(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (pd.Timestamp, date)):
        return value.isoformat()[:10]
    if pd.isna(value):
        return None
    return value


def validate_weights(weights: dict[str, float]) -> pd.Series:
    if not weights:
        raise ValueError("portfolio_weights is required when actual_shares is empty.")
    weights_series = pd.Series(weights, dtype=float)
    if (weights_series < 0).any():
        raise ValueError("Portfolio weights cannot be negative.")
    total = float(weights_series.sum())
    if total <= 0:
        raise ValueError("Portfolio weights must sum to more than zero.")
    return weights_series / total if not math.isclose(total, 1.0, rel_tol=1e-5) else weights_series


def download_adjusted_close(tickers: list[str], start_date: str) -> pd.DataFrame:
    raw = yf.download(tickers=tickers, start=start_date, auto_adjust=True, progress=False, threads=True)
    if raw.empty:
        raise RuntimeError("No price data downloaded. Check tickers, dates, or internet access.")
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"].copy() if "Close" in raw.columns.get_level_values(0) else raw.xs("Close", level=1, axis=1).copy()
    else:
        close = raw["Close"].to_frame(name=tickers[0])
    close.columns = [str(c) for c in close.columns]
    close = close.reindex(columns=tickers)
    missing = [ticker for ticker in tickers if ticker not in close.columns or close[ticker].dropna().empty]
    if missing:
        raise RuntimeError(f"Missing price data for: {missing}")
    close = close.ffill().dropna(how="any")
    if close.empty:
        raise RuntimeError("Price data exists but has no complete rows after cleaning.")
    return close


def make_six_month_dates(index: pd.DatetimeIndex) -> pd.DatetimeIndex:
    index = pd.DatetimeIndex(index).sort_values()
    selected_dates = []
    n = 0
    while True:
        target = index[0] + pd.DateOffset(months=6 * n)
        if target > index[-1]:
            break
        position = index.searchsorted(target, side="right") - 1
        if position >= 0:
            selected_dates.append(index[position])
        n += 1
    if index[-1] not in selected_dates:
        selected_dates.append(index[-1])
    return pd.DatetimeIndex(sorted(set(selected_dates)))


def performance_stats(series: pd.Series) -> dict[str, float]:
    series = series.dropna()
    daily_returns = series.pct_change().dropna()
    start_value = float(series.iloc[0])
    end_value = float(series.iloc[-1])
    years = (series.index[-1] - series.index[0]).days / 365.25
    annual_volatility = float(daily_returns.std() * np.sqrt(252)) if len(daily_returns) > 1 else np.nan
    sharpe = float((daily_returns.mean() * 252) / annual_volatility) if annual_volatility and annual_volatility > 0 else np.nan
    drawdown = series / series.cummax() - 1
    return {"start_value": start_value, "end_value": end_value, "total_return": end_value / start_value - 1, "cagr": (end_value / start_value) ** (1 / years) - 1 if years > 0 else np.nan, "annual_volatility": annual_volatility, "max_drawdown": float(drawdown.min()), "sharpe": sharpe}


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    benchmark = str(payload.get("benchmark") or "VOO").upper().strip()
    start_date = str(payload.get("start_date") or date.today().isoformat())
    initial_capital = float(payload.get("initial_capital") or 5000)
    actual_shares = {k.upper().strip(): float(v) for k, v in (payload.get("actual_shares") or {}).items() if float(v) > 0}
    weights = validate_weights({k.upper().strip(): float(v) for k, v in (payload.get("portfolio_weights") or DEFAULT_WEIGHTS).items()})
    portfolio_tickers = list(actual_shares.keys() or weights.index)
    prices = download_adjusted_close(list(dict.fromkeys(portfolio_tickers + [benchmark])), start_date)
    six_month_dates = make_six_month_dates(prices.index)

    if actual_shares:
        shares = pd.Series(actual_shares, dtype=float)
        portfolio_value = prices[shares.index].mul(shares, axis=1).sum(axis=1).rename("Portfolio")
        starting_value = float(portfolio_value.iloc[0])
        strategy = "Actual shares"
    else:
        first_prices = prices.loc[prices.index[0], weights.index]
        shares = (initial_capital * weights) / first_prices
        if payload.get("rebalance"):
            values = []
            rebalance_dates = set(six_month_dates)
            for current_date, row in prices[weights.index].iterrows():
                if current_date in rebalance_dates and values:
                    shares = (float((shares * row).sum()) * weights) / row
                values.append(float((shares * row).sum()))
            portfolio_value = pd.Series(values, index=prices.index, name="Portfolio")
            strategy = "Target weights, rebalanced every 6 months"
        else:
            portfolio_value = prices[weights.index].mul(shares, axis=1).sum(axis=1).rename("Portfolio")
            strategy = "Target weights, buy and hold"
        starting_value = initial_capital

    benchmark_value = (prices[benchmark] / prices[benchmark].iloc[0] * starting_value).rename("VOO Benchmark")
    curves = pd.concat([portfolio_value, benchmark_value], axis=1).dropna()
    curves["Alpha Dollars"] = curves["Portfolio"] - curves["VOO Benchmark"]
    curves["Portfolio Return"] = curves["Portfolio"] / curves["Portfolio"].iloc[0] - 1
    curves["VOO Return"] = curves["VOO Benchmark"] / curves["VOO Benchmark"].iloc[0] - 1
    curves["Alpha Return"] = curves["Portfolio Return"] - curves["VOO Return"]
    checkpoints = curves.loc[six_month_dates.intersection(curves.index)].copy()
    checkpoints["Status"] = np.where(checkpoints["Alpha Return"] >= 0, "Ahead", "Behind")
    final = curves.iloc[-1]
    return _clean({
        "summary": {"strategy": strategy, "start_date": curves.index[0], "end_date": curves.index[-1], "benchmark": benchmark},
        "final_results": {"portfolio_value": final["Portfolio"], "voo_value": final["VOO Benchmark"], "alpha_dollars": final["Alpha Dollars"], "portfolio_return": final["Portfolio Return"], "voo_return": final["VOO Return"], "alpha_return": final["Alpha Return"]},
        "performance_stats": {"portfolio": performance_stats(curves["Portfolio"]), "voo": performance_stats(curves["VOO Benchmark"])},
        "checkpoints": [{"date": idx, "portfolio_value": row["Portfolio"], "voo_value": row["VOO Benchmark"], "portfolio_return": row["Portfolio Return"], "voo_return": row["VOO Return"], "alpha_return": row["Alpha Return"], "status": row["Status"]} for idx, row in checkpoints.iterrows()],
        "daily_curves": [{"date": idx, "portfolio": row["Portfolio"] / curves["Portfolio"].iloc[0], "voo": row["VOO Benchmark"] / curves["VOO Benchmark"].iloc[0]} for idx, row in curves.iterrows()],
    })


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._send(200, evaluate(payload))
        except Exception as exc:
            self._send(400, {"error": str(exc)})

    def do_OPTIONS(self):
        self._send(204, {})

    def _send(self, status: int, body: dict[str, Any]):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if status != 204:
            self.wfile.write(json.dumps(body, allow_nan=False).encode("utf-8"))


if __name__ == "__main__":
    import sys
    try:
        input_data = sys.stdin.read()
        payload = json.loads(input_data or "{}")
        result = evaluate(payload)
        print(json.dumps(result, allow_nan=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

