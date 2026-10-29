# SmartBlinks UI Preview

A standalone, public, mobile-first interface prototype for evaluating the proposed SmartBlinks trading terminal. This repository is independent of the main SmartBlinks application.

## Included screens

- **Overview:** simulated account summary, price chart, monitoring status, open positions, activity stream, and risk-check presentation.
- **Markets:** three-symbol watchlist, sample quotes, market selection, and chart controls.
- **Brain:** a transparent example of how strategy context and decision reasoning could be presented. It does not generate real signals.
- **Audit trail:** timestamped local UI events, filters, and CSV export.
- **Risk controls:** illustrative exposure summary and a visual-only risk threshold control.
- **Preferences:** local sound and notification preferences, simulation controls, and reset.

## What works in this preview

- Responsive desktop and mobile layouts.
- Navigation between dedicated screens.
- Animated, browser-generated sample price chart with symbol and timeframe controls.
- Start/pause simulation controls.
- Open and close local test positions; account balance, equity, and illustrative P&L update in the browser.
- Local activity history, audit filters, and CSV export.
- Optional subtle interface sounds and accessible focus states.

## What is intentionally simulated

All prices, changes, balances, P&L, positions, activity events, and risk indicators are illustrative. The Brain screen is a UI concept, not an AI connection. Nothing connects to cTrader, a broker, an API, or a backend, and no real orders are sent. The preview does not implement or validate real trading or risk controls.

## Deploy

This is plain HTML, CSS, and JavaScript. **No environment variables, Docker, package installation, build command, or start command are required.**

### Render
Create a **Static Site** from this repository:
- Branch: `main`
- Build command: leave empty
- Publish directory: `.`

### GitHub Pages
A deployment workflow is included at `.github/workflows/deploy-pages.yml`. In the repository's **Settings → Pages**, select **GitHub Actions** as the deployment source. The workflow deploys the repository root when changes are pushed to `main`, or when manually run from the Actions tab.

## Browser data

Test positions and event history are held in memory and reset when the page is refreshed. Export the audit trail before refreshing if you want to keep a copy of the session events.

## Scope

This is a UI evaluation prototype, not trading software. Do not use it to infer live market conditions, account status, trading performance, or real risk enforcement.
