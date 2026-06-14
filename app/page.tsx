"use client";

import { FormEvent, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Holding = { ticker: string; value: number };
type ApiResult = {
  summary: { strategy: string; start_date: string; end_date: string; benchmark: string };
  final_results: { portfolio_value: number; voo_value: number; alpha_dollars: number; portfolio_return: number; voo_return: number; alpha_return: number };
  performance_stats: Record<"portfolio" | "voo", Record<string, number | null>>;
  checkpoints: { date: string; portfolio_value: number; voo_value: number; alpha_return: number; status: string }[];
  daily_curves: { date: string; portfolio: number; voo: number }[];
};

const defaultHoldings: Holding[] = [
  { ticker: "PGR", value: 0.16 }, { ticker: "LLY", value: 0.16 }, { ticker: "ORLY", value: 0.14 }, { ticker: "V", value: 0.12 },
  { ticker: "TDG", value: 0.12 }, { ticker: "ICE", value: 0.1 }, { ticker: "RACE", value: 0.1 }, { ticker: "CB", value: 0.1 },
];

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const percent = (value: number | null | undefined) => value == null ? "n/a" : `${(value * 100).toFixed(2)}%`;

export default function Home() {
  const [mode, setMode] = useState<"weights" | "shares">("weights");
  const [initialCapital, setInitialCapital] = useState(5000);
  const [startDate, setStartDate] = useState("2026-06-14");
  const [benchmark, setBenchmark] = useState("VOO");
  const [rebalance, setRebalance] = useState(false);
  const [holdings, setHoldings] = useState(defaultHoldings);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const payloadHoldings = useMemo(() => Object.fromEntries(holdings.filter((h) => h.ticker).map((h) => [h.ticker.toUpperCase(), h.value])), [holdings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial_capital: initialCapital, start_date: startDate, benchmark, rebalance, portfolio_weights: mode === "weights" ? payloadHoldings : {}, actual_shares: mode === "shares" ? payloadHoldings : {} }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) setError(body.error || "The portfolio could not be evaluated.");
    else setResult(body);
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Portfolio reality check</p>
        <h1>Outrun VOO, or find out exactly when VOO outran you.</h1>
        <p>Enter target weights or actual share counts, then compare the portfolio against an investable VOO benchmark with Python serverless calculations and interactive browser charts.</p>
      </section>

      <form className="panel form" onSubmit={submit}>
        <div className="toolbar">
          <button type="button" className={mode === "weights" ? "active" : ""} onClick={() => setMode("weights")}>Target weights</button>
          <button type="button" className={mode === "shares" ? "active" : ""} onClick={() => setMode("shares")}>Actual shares</button>
        </div>
        <div className="grid four">
          <label>Initial capital<input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} /></label>
          <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>Benchmark<input value={benchmark} onChange={(e) => setBenchmark(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={rebalance} onChange={(e) => setRebalance(e.target.checked)} disabled={mode === "shares"} /> Rebalance every 6 months</label>
        </div>
        <div className="holdings">
          {holdings.map((holding, index) => (
            <div className="holding" key={index}>
              <input aria-label="Ticker" value={holding.ticker} onChange={(e) => setHoldings(holdings.map((h, i) => i === index ? { ...h, ticker: e.target.value } : h))} />
              <input aria-label={mode === "weights" ? "Weight" : "Shares"} type="number" step="any" value={holding.value} onChange={(e) => setHoldings(holdings.map((h, i) => i === index ? { ...h, value: Number(e.target.value) } : h))} />
              <button type="button" onClick={() => setHoldings(holdings.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="actions"><button type="button" onClick={() => setHoldings([...holdings, { ticker: "", value: 0 }])}>Add ticker</button><button type="submit" disabled={loading}>{loading ? "Evaluating..." : "Evaluate portfolio"}</button></div>
        {error && <p className="error">{error}</p>}
      </form>

      {result && <Dashboard result={result} />}
    </main>
  );
}

function Dashboard({ result }: { result: ApiResult }) {
  const alphaPositive = result.final_results.alpha_return >= 0;
  const statRows = ["total_return", "cagr", "annual_volatility", "max_drawdown", "sharpe"];
  return <section className="dashboard">
    <div className={`alpha ${alphaPositive ? "good" : "bad"}`}><span>Alpha return</span><strong>{percent(result.final_results.alpha_return)}</strong><small>{money(result.final_results.alpha_dollars)} vs {result.summary.benchmark}</small></div>
    <div className="panel"><h2>Growth of $1</h2><ResponsiveContainer width="100%" height={360}><LineChart data={result.daily_curves}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={40} /><YAxis domain={["auto", "auto"]} /><Tooltip formatter={(value) => Number(value).toFixed(3)} /><Line type="monotone" dataKey="portfolio" stroke="#34d399" dot={false} /><Line type="monotone" dataKey="voo" stroke="#60a5fa" dot={false} /></LineChart></ResponsiveContainer></div>
    <div className="panel"><h2>Performance stats</h2><table><tbody>{statRows.map((row) => <tr key={row}><th>{row.replaceAll("_", " ")}</th><td>{row === "sharpe" ? result.performance_stats.portfolio[row]?.toFixed(2) : percent(result.performance_stats.portfolio[row])}</td><td>{row === "sharpe" ? result.performance_stats.voo[row]?.toFixed(2) : percent(result.performance_stats.voo[row])}</td></tr>)}</tbody></table></div>
    <div className="panel"><h2>6-month checkpoints</h2><table><thead><tr><th>Date</th><th>Portfolio</th><th>VOO</th><th>Alpha</th><th>Status</th></tr></thead><tbody>{result.checkpoints.map((point) => <tr key={point.date}><td>{point.date}</td><td>{money(point.portfolio_value)}</td><td>{money(point.voo_value)}</td><td>{percent(point.alpha_return)}</td><td><span className={point.status === "Ahead" ? "pill good" : "pill bad"}>{point.status}</span></td></tr>)}</tbody></table></div>
  </section>;
}
