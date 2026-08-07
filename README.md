# FundScope

Build a world-class Mutual Fund Research & Comparison Platform for Indian Mutual Funds using React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts, and IndexedDB.

The application should look like a premium financial analytics platform similar to Morningstar, Portfolio Visualizer, and Value Research, with a clean, modern UI focused on data visualization and investment research.

Use the public MFAPI (https://api.mfapi.in) as the primary data source for scheme information and historical NAV data.

The application should be optimized for performance, mobile responsive, and built with reusable components and clean architecture.

--------------------------------------------------

CORE FEATURES

--------------------------------------------------

Create a powerful Mutual Fund Comparison Tool where users can compare multiple mutual funds side-by-side.

Allow comparison of

• Large Cap

• Large & Mid Cap

• Mid Cap

• Small Cap

• Flexi Cap

• Multi Cap

• ELSS

• Value

• Contra

• Focused

• Index

• Aggressive Hybrid

• Balanced Advantage

• Arbitrage

Users should be able to compare 2–10 mutual funds simultaneously.

--------------------------------------------------

SEARCH

--------------------------------------------------

Provide an intelligent search bar with autocomplete.

Users can search by

• Scheme Name

• AMC Name

• Category

Display selected funds as removable chips.

--------------------------------------------------

NAV DATA

--------------------------------------------------

Use MFAPI historical NAV data.

Cache all NAV history using IndexedDB.

Avoid unnecessary API calls.

Show loading skeletons while fetching data.

--------------------------------------------------

ROLLING RETURNS (MAIN FEATURE)

--------------------------------------------------

This is the primary feature of the application.

Calculate rolling CAGR returns using NAV history.

Support

• 1 Year

• 3 Years

• 5 Years

• 7 Years

• 10 Years

• 12 Years

• 15 Years

For every rolling period calculate every possible rolling window until the latest NAV.

Display an interactive line chart comparing all selected funds.

Features

• Zoom

• Pan

• Hover tooltip

• Legend

• Hide/Show schemes

• Export PNG

• Export CSV

• Smooth animations

--------------------------------------------------

ROLLING RETURN STATISTICS

--------------------------------------------------

For every selected rolling period calculate

• Minimum Return

• Maximum Return

• Average Return

• Median Return

• Standard Deviation

• Variance

• 5th Percentile

• 25th Percentile

• 75th Percentile

• 95th Percentile

• Positive Rolling %

• Negative Rolling %

• Current Rolling Return

• Best Rolling Window

• Worst Rolling Window

• Rolling Return Rank

--------------------------------------------------

RISK ANALYTICS

--------------------------------------------------

Calculate

• Annualized Return

• CAGR

• Annualized Volatility

• Downside Volatility

• Sharpe Ratio

• Sortino Ratio

• Treynor Ratio

• Information Ratio

• Beta

• Alpha

• R-Squared

• Tracking Error

• Calmar Ratio

• Maximum Drawdown

• Average Drawdown

• Recovery Time

• Ulcer Index

• Skewness

• Kurtosis

• Value at Risk

• Conditional VaR

--------------------------------------------------

DRAWDOWN ANALYSIS

--------------------------------------------------

Interactive Drawdown Chart

Show

Maximum Drawdown

Current Drawdown

Average Drawdown

Longest Recovery

Drawdown Duration

Rolling Drawdown

--------------------------------------------------

RETURN COMPARISON

--------------------------------------------------

Compare

1 Month

3 Months

6 Months

1 Year

3 Years

5 Years

7 Years

10 Years

12 Years

15 Years

Since Inception

Display

• Cards

• Table

• Horizontal Bar Chart

--------------------------------------------------

SIP CALCULATOR

--------------------------------------------------

Allow users to input

Monthly SIP

Start Date

End Date

Annual Step-Up %

Calculate

Total Investment

Current Value

Profit

Absolute Return

XIRR

Rolling SIP Returns

Best SIP Start Date

Worst SIP Start Date

--------------------------------------------------

LUMPSUM CALCULATOR

--------------------------------------------------

User inputs

Investment Amount

Investment Date

Calculate

Current Value

Absolute Return

CAGR

Rolling CAGR

--------------------------------------------------

CONSISTENCY ANALYSIS

--------------------------------------------------

Generate a Consistency Score (0-100)

Based on

Rolling Return Stability

Volatility

Maximum Drawdown

Sharpe Ratio

Sortino Ratio

Positive Rolling %

Recovery Time

Display

Consistency Meter

Excellent

Very Good

Good

Average

Poor

--------------------------------------------------

OVERALL FUND SCORE

--------------------------------------------------

Generate an Overall Score (0-100)

Weightage

30% Rolling Returns

20% Consistency

15% Drawdown

10% Sharpe

10% Sortino

10% Volatility

5% Alpha

Display

Overall Rating

★★★★★

★★★★☆

★★★☆☆

--------------------------------------------------

FUND RANKING

--------------------------------------------------

Automatically rank compared funds based on

Highest Return

Lowest Risk

Best Rolling Return

Highest Sharpe

Highest Sortino

Lowest Drawdown

Best Overall Score

--------------------------------------------------

VISUALIZATIONS

--------------------------------------------------

Create interactive charts

Rolling Return Line Chart

NAV Line Chart

Drawdown Chart

Return Distribution Histogram

Radar Chart

Risk vs Return Scatter Plot

Rolling Heatmap

Performance Timeline

Comparison Bar Charts

All charts should be responsive and interactive.

--------------------------------------------------

FILTERS

--------------------------------------------------

Allow users to filter by

AMC

Category

Direct / Regular

Growth / IDCW

Risk Level

Fund Age

--------------------------------------------------

COMPARISON DASHBOARD

--------------------------------------------------

The dashboard should contain

Rolling Return Chart

NAV Chart

Performance Table

Risk Metrics

Rolling Statistics

Drawdown Analysis

Overall Rating

Consistency Score

Fund Ranking

Export Buttons

--------------------------------------------------

EXPORT OPTIONS

--------------------------------------------------

Allow exporting

CSV

Excel

PNG

PDF Report

--------------------------------------------------

UI DESIGN

--------------------------------------------------

Premium finance dashboard

Modern cards

Beautiful typography

Glassmorphism

Dark Mode

Light Mode

Responsive

Smooth animations

Sticky comparison header

Floating filters

Collapsible sections

Professional color palette

Excellent spacing

Fast loading

--------------------------------------------------

ARCHITECTURE

--------------------------------------------------

Use Clean Architecture.

Organize code into

/components

/pages

/hooks

/services

/utils

/calculators

/charts

/workers

/types

--------------------------------------------------

FINANCIAL ENGINE

--------------------------------------------------

Create reusable utility functions

calculateRollingReturns()

calculateCAGR()

calculateXIRR()

calculateSharpe()

calculateSortino()

calculateTreynor()

calculateVolatility()

calculateDrawdown()

calculateBeta()

calculateAlpha()

calculateConsistencyScore()

calculateOverallScore()

calculatePercentiles()

All calculations should be reusable, strongly typed, and unit-test friendly.

--------------------------------------------------

PERFORMANCE

--------------------------------------------------

Use

TanStack Query

Memoization

Web Workers for heavy calculations

IndexedDB caching

Lazy-loaded charts

Virtualized tables

--------------------------------------------------

FUTURE READY

--------------------------------------------------

Design the application so it can easily support future integrations for

Expense Ratio

AUM

Portfolio Holdings

Sector Allocation

Market Cap Allocation

Benchmark Comparison

Nifty 50

Nifty 500

Category Average

Portfolio Builder

Fund Overlap Analysis

Asset Allocation Analysis

--------------------------------------------------

FINAL GOAL

--------------------------------------------------

Build a production-quality Mutual Fund Research Terminal that helps investors identify the best long-term mutual funds using rolling returns, consistency, statistical analysis, and risk-adjusted performance rather than simple point-to-point returns.

The application should feel polished enough to compete with Morningstar, Portfolio Visualizer, Value Research, ET Money, and Groww, while being specifically optimized for Indian Mutual Funds.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mfscope.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/63b08cd1-b1ab-4a5d-9da8-f5ae67a6571e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
