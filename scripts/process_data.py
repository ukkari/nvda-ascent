#!/usr/bin/env python3
"""Convert a raw TradingView OHLCV dump into the compact columnar JSON the game loads.

Input : data/raw/tradingview_NASDAQ_NVDA_1W.json  (as returned by the TradingView
        `get-ohlcv` endpoint: {symbol, interval, bars:[{t,o,h,l,c,v}], ...})
Output: public/data/nvda_weekly.json

Prices are split-adjusted (TradingView default). Values are rounded to 6
significant digits to keep the payload small (~60 KB) without visible loss.
"""
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data/raw/tradingview_NASDAQ_NVDA_1W.json"
DST = ROOT / "public/data/nvda_weekly.json"


def sig(x: float, n: int = 6) -> float:
    if x == 0:
        return 0.0
    return round(x, -int(math.floor(math.log10(abs(x)))) + (n - 1))


def main() -> None:
    raw = json.loads(SRC.read_text())
    bars = sorted(raw["bars"], key=lambda b: b["t"])
    # Drop any malformed bars (TradingView occasionally returns zero-volume stubs)
    bars = [b for b in bars if min(b["o"], b["h"], b["l"], b["c"]) > 0]

    out = {
        "symbol": raw.get("symbol", "NASDAQ:NVDA"),
        "interval": raw.get("interval", "1W"),
        "source": "TradingView",
        "adjusted": "split-adjusted",
        "t": [int(b["t"]) for b in bars],
        "o": [sig(b["o"]) for b in bars],
        "h": [sig(b["h"]) for b in bars],
        "l": [sig(b["l"]) for b in bars],
        "c": [sig(b["c"]) for b in bars],
        "v": [int(b["v"]) for b in bars],
    }
    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(json.dumps(out, separators=(",", ":")))
    lo = min(out["l"]); hi = max(out["h"])
    print(f"{len(bars)} bars -> {DST.relative_to(ROOT)} | low {lo} high {hi} | "
          f"{DST.stat().st_size/1024:.1f} KB")


if __name__ == "__main__":
    sys.exit(main())
