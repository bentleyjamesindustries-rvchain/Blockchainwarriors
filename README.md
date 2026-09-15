# Blockchain Warriors Paper Desk

Educational paper desk for **Bitcoin** and **Dogecoin**. Live quotes. No live orders.

This repository is independent of RV-CHAIN. It is a separate paper-trading desk.

## What it does

- Two coins: Bitcoin and Dogecoin
- Three lanes each: **Long**, **Short**, **Diamond hand** (accumulate on dip buy-targets only)
- Three ranked ideas per lane, each with a possible Elliott Wave read, a stop, and a first target
- Paper fills only. A score is setup quality (8–92), not a win-rate

## Risk (paper)

- Bitcoin: **1%** of paper equity to the stop
- Dogecoin: **0.75%**
- Skip unless first target is at least **2R**

## Run

```bash
npm install
npm run dev
```

Open the URL the script prints (usually `http://127.0.0.1:8080`).

## Disclaimer

This application is for education and simulation only. It is not financial, investment, tax, or trading advice. Blockchain Warriors does not execute live orders, does not act as a broker or adviser, and does not guarantee any outcome. Market data may be delayed, incomplete, or wrong. Paper results are not live results. You are solely responsible for any decision you make. Use at your own risk.
