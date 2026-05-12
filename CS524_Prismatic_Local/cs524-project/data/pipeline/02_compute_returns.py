"""
Compute log returns from daily prices.
Output: data/processed/returns_log.parquet
"""
import pandas as pd
import numpy as np
import os

RAW_DIR = os.path.join(os.path.dirname(__file__), '..', 'raw')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

if __name__ == '__main__':
    prices = pd.read_parquet(os.path.join(RAW_DIR, 'prices_daily.parquet'))

    # Log returns: ln(P_t / P_{t-1})
    returns = np.log(prices / prices.shift(1))
    returns = returns.iloc[1:]  # Drop first NaN row

    out_path = os.path.join(PROCESSED_DIR, 'returns_log.parquet')
    returns.to_parquet(out_path)
    print(f"Log returns: {returns.shape[0]} days × {returns.shape[1]} tickers")
    print(f"Saved {out_path}")
