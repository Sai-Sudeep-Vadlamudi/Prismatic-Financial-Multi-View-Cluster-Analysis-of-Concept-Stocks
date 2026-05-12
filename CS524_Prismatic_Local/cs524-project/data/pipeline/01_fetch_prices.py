"""
Fetch S&P 500 daily adjusted close prices from Yahoo Finance.
Output: data/raw/prices_daily.parquet
"""
import yfinance as yf
import pandas as pd
import json
import os
import time
import requests
from io import StringIO

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'raw')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

def get_sp500_tickers():
    """Scrape current S&P 500 tickers from Wikipedia."""
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    # Use StringIO to wrap the HTML content
    table = pd.read_html(StringIO(response.text))
    df = table[0]
    tickers = df['Symbol'].tolist()
    # Fix tickers with dots (BRK.B -> BRK-B for Yahoo Finance)
    tickers = [t.replace('.', '-') for t in tickers]
    return sorted(tickers)

def fetch_prices(tickers, start='2017-06-01', end='2021-06-30'):
    """
    Fetch adjusted close prices.
    We fetch a wider window than 2020 to have buffer for rolling calculations.
    """
    print(f"Fetching {len(tickers)} tickers from {start} to {end}...")

    # Download in batches to avoid timeout
    batch_size = 50
    all_data = []

    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i+batch_size]
        print(f"  Batch {i//batch_size + 1}: {batch[0]} ... {batch[-1]}")
        try:
            data = yf.download(batch, start=start, end=end,
                              auto_adjust=True, threads=True)
            if isinstance(data.columns, pd.MultiIndex):
                # yfinance return format can vary. Verify structure.
                try:
                    closes = data['Close']
                except KeyError:
                    # Fallback or try different access if structure is different
                    print("  'Close' column not found in MultiIndex, checking structure...")
                    # If 'Close' is not top level, it might be flattened or single level if only 1 ticker in batch?
                    # With auto_adjust=True, it might just return the adjusted close directly if single ticker?
                    # But we are downloading batch.
                    # Recent yfinance might return different structure.
                    # Let's assume standard behavior for now.
                    closes = data
            else:
                closes = data[['Close']]
                closes.columns = batch
            all_data.append(closes)
        except Exception as e:
            print(f"  Error in batch: {e}")
        time.sleep(1)  # Rate limiting

    df = pd.concat(all_data, axis=1)

    # Drop tickers with >10% missing days
    threshold = len(df) * 0.1
    df = df.dropna(axis=1, thresh=len(df) - threshold)

    # Forward fill remaining gaps (weekends/holidays already excluded)
    df = df.ffill().bfill()

    print(f"Final: {df.shape[1]} tickers, {df.shape[0]} trading days")
    return df

if __name__ == '__main__':
    tickers = get_sp500_tickers()

    # Save ticker list
    with open(os.path.join(PROCESSED_DIR, 'sp500_tickers.json'), 'w') as f:
        json.dump(tickers, f)

    prices = fetch_prices(tickers)

    # Save as parquet
    out_path = os.path.join(OUTPUT_DIR, 'prices_daily.parquet')
    prices.to_parquet(out_path)
    print(f"Saved {out_path} ({os.path.getsize(out_path) / 1e6:.1f} MB)")
