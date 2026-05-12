"""
Compute Prism (e,w) correlation grid for a selected pair.
Paper axis convention:
  x = end day (e)
  y = window size (w)
  value = Pearson corr of returns[e-w : e] for ticker_a vs ticker_b
Output: data/processed/prism_pair_{A}_{B}_{YEAR}.json
"""
import pandas as pd
import numpy as np
import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
YEAR = 2020

# Demo pairs — pick 2 well-known S&P 500 stocks
PAIRS = [
    ('AAPL', 'MSFT'),     # Original pair (stock vs stock comparison — D3)
    ('AAPL', 'XOM'),      # Stock vs Energy (Proxy for different sector)
    ('GOOGL', 'AMZN'),    # Second stock pair — simulates D2
    ('JPM', 'BAC'),       # Third stock pair — additional load
]

MIN_WINDOW = 5  # Minimum window size for meaningful correlation

if __name__ == '__main__':
    returns = pd.read_parquet(os.path.join(PROCESSED_DIR, 'returns_log.parquet'))
    returns_year = returns[returns.index.year == YEAR]

    for ticker_a, ticker_b in PAIRS:
        if ticker_a not in returns_year.columns or ticker_b not in returns_year.columns:
            print(f"  Skipping {ticker_a}-{ticker_b}: ticker not found")
            continue

        r_a = returns_year[ticker_a].values
        r_b = returns_year[ticker_b].values
        T = len(r_a)
        dates = returns_year.index.strftime('%Y-%m-%d').tolist()

        print(f"Computing Prism for {ticker_a} vs {ticker_b}, T={T} days...")

        # Build (e, w) grid
        # e = end day index (0..T-1)
        # w = window size (MIN_WINDOW..T-1)
        # valid only if w <= e  (i.e., start = e - w >= 0)
        #
        # Store as list of {e, w, value} for sparse representation
        # (triangle shape — not all (e,w) pairs are valid)

        grid = []
        max_w = T  # Can go up to T-1

        for e in range(MIN_WINDOW, T):
            for w in range(MIN_WINDOW, e + 1):
                start = e - w
                if start < 0:
                    continue
                slice_a = r_a[start:e]
                slice_b = r_b[start:e]

                if len(slice_a) < MIN_WINDOW:
                    continue

                # Pearson correlation
                if np.std(slice_a) == 0 or np.std(slice_b) == 0:
                    corr_val = 0.0
                else:
                    corr_val = float(np.corrcoef(slice_a, slice_b)[0, 1])
                    if np.isnan(corr_val):
                        corr_val = 0.0

                grid.append({
                    'e': int(e),
                    'w': int(w),
                    'v': round(corr_val, 4)
                })

        # Also compute as dense 2D array for faster rendering
        # Dimensions: rows = w (MIN_WINDOW to T-1), cols = e (0 to T-1)
        # Invalid cells = null
        max_e = T
        max_w_dim = T
        dense = []
        for w in range(max_w_dim):
            row = []
            for e in range(max_e):
                if w < MIN_WINDOW or w > e:
                    row.append(None)
                else:
                    start = e - w
                    slice_a = r_a[start:e]
                    slice_b = r_b[start:e]
                    if len(slice_a) < MIN_WINDOW or np.std(slice_a) == 0 or np.std(slice_b) == 0:
                        row.append(None)
                    else:
                        val = float(np.corrcoef(slice_a, slice_b)[0, 1])
                        row.append(round(val, 4) if not np.isnan(val) else None)
            dense.append(row)

        output = {
            'ticker_a': ticker_a,
            'ticker_b': ticker_b,
            'year': YEAR,
            'T': T,
            'min_window': MIN_WINDOW,
            'dates': dates,
            'grid_sparse': grid,       # For reference
            'grid_dense': dense,       # For rendering: dense[w][e]
            'num_valid_cells': len(grid),
        }

        out_path = os.path.join(PROCESSED_DIR, f'prism_pair_{ticker_a}_{ticker_b}_{YEAR}.json')
        with open(out_path, 'w') as f:
            json.dump(output, f)

        file_size = os.path.getsize(out_path) / 1e6
        print(f"  {ticker_a} vs {ticker_b}: {len(grid)} valid cells, T={T}, file {file_size:.2f} MB")
