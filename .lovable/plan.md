# FundScope — Suggested Next Features

Based on the current build (side-by-side comparison, rolling CAGR, risk metrics, drawdown, SIP/lumpsim, scoring, peer avg/med lines, optional start date), here are the highest-impact features worth adding next.

## Phase 1 — Core research gaps (highest impact)

### 1. Benchmark overlay & true Alpha/Beta
**Why:** Rolling returns in isolation are misleading. Investors need to see outperformance vs Nifty 50 / Nifty 100 / Nifty Midcap 150 / Nifty Smallcap 250.
- Add a "Benchmark" selector (Nifty 50 TRI, Nifty 100 TRI, Sensex TRI, etc.).
- Fetch benchmark NAV data from a public source (e.g. NSE/BSE historical CSVs or a compatible index API).
- Overlay benchmark line on Rolling Returns, Growth of ₹100, and Drawdown charts.
- Compute **Alpha** and **Beta** properly (currently Alpha is hardcoded to 0).
- Add **Tracking Error** and **Information Ratio**.

### 2. Correlation matrix & diversification heatmap
**Why:** The platform supports up to 10 funds, but users can't see if they are just buying the same thing twice.
- Compute pairwise correlation of daily/weekly returns across selected funds.
- Render a heatmap (recharts or CSS grid) with values + color intensity.
- Flag pairs with correlation > 0.85 as "high overlap".

### 3. Calendar-year returns table
**Why:** Rolling CAGR hides year-to-year behavior. A year-wise grid shows consistency in bull/bear years.
- Add a new tab "Annual Returns".
- Grid: funds as rows, calendar years as columns, cells colored green/red by performance.
- Show each year's best/worst fund and category average if benchmarked.

## Phase 2 — Investor decision tools

### 4. Portfolio simulator with allocation weights
**Why:** Users compare funds to build a portfolio, not just pick one winner.
- Let users assign % allocation to each selected fund (auto-normalize to 100%).
- Compute weighted portfolio CAGR, volatility, Sharpe, max drawdown, and rolling return series.
- Show portfolio vs benchmark overlay.

### 5. Tax-adjusted returns
**Why:** Post-tax returns are what Indian investors actually keep.
- Apply LTCG (10% above ₹1L for equity) and STCG (15% for <1Y) rules.
- For debt: apply slab-rate / indexation logic per current tax rules.
- Show pre-tax vs post-tax CAGR and XIRR in calculators.

### 6. Goal-based SIP / SWP planner
**Why:** Most Indian investors use MFs for goals, not just returns.
- **Goal planner:** given target corpus, horizon, expected return → required monthly SIP and step-up SIP.
- **SWP planner:** given corpus, monthly withdrawal, horizon → survival probability and depletion year.

## Phase 3 — Convenience & shareability

### 7. Shareable comparison URLs
**Why:** Researchers, advisors, and forum users want to share a specific comparison.
- Encode selected scheme codes + start date + active tab in query params (`?funds=120503,118834&start=2020-01-01`).
- On load, restore selection and scroll to results.

### 8. Saved comparisons / watchlists
**Why:** Users return to the same fund sets repeatedly.
- Persist named watchlists to LocalStorage (or Lovable Cloud if auth is added later).
- Quick-switch between "My Core Portfolio", "ELSS Compare", "Small Cap Watchlist", etc.

### 9. Full PDF research report export
**Why:** Advisors and serious investors want a clean document, not just CSV/PNG.
- Generate a one-page PDF with all charts, tables, and scores.
- Use a lightweight client-side PDF library (e.g. `jspdf` + `html-to-image`).

## Phase 4 — Data enrichment

### 10. Fund metadata panel (AMC, AUM, expense ratio, exit load)
**Why:** MFAPI only gives NAV history. A research terminal needs static fund attributes.
- Source: AMFI master data or scrape AMFI / MoneyControl / Value Research.
- Show in a "Fund Info" modal or expandable row.
- Enable filtering by AMC, category, and expense ratio.

### 11. Fund overlap / common-holdings analyzer
**Why:** Critical for avoiding concentration risk.
- Requires portfolio holdings data (AMFI monthly disclosures or Value Research).
- Show pairwise stock overlap % and top 10 common stocks.

## Recommended order of implementation

1. Benchmark overlay + true Alpha/Beta  
2. Correlation matrix  
3. Calendar-year returns  
4. Portfolio simulator  
5. Shareable URLs  
6. Tax-adjusted returns  
7. Goal/SWP planner  
8. Saved comparisons  
9. PDF report  
10. Fund metadata / overlap

## Technical notes

- Benchmark data: NSE India provides historical index data; a server route can proxy/fetch and cache it.
- Tax rules: implement as configurable constants so 2025/2026 budget changes are easy to update.
- Portfolio simulator: reuse existing `calculateRisk` and `calculateRollingReturns` on a weighted NAV series.
- Shareable URLs: keep state in query params only; no backend needed unless user accounts are added later.

---

Which phase should we build first? I recommend starting with **Phase 1 (Benchmark overlay + Correlation + Calendar-year returns)** because they turn FundScope from a chart viewer into a true research terminal.