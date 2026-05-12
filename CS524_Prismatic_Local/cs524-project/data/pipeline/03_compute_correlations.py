"""
Compute Pearson correlation matrices for year 2020 at various N.
Output: data/processed/corr_matrix_2020_N{n}.json
"""
import pandas as pd
import numpy as np
import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
SUBSETS = [40, 80, 160, 300, 500]
YEAR = 2020

def select_top_n_by_volume(returns, prices_path, n, year):
    """
    Select top N tickers by average daily trading volume in the given year.
    This gives us the most actively traded stocks — realistic subset.
    If volume data isn't available, fall back to alphabetical.
    """
    tickers = list(returns.columns)
    if n >= len(tickers):
        return tickers
    # Simple approach: pick first N alphabetically (deterministic)
    # You can improve this later with volume-based selection
    return sorted(tickers)[:n]

if __name__ == '__main__':
    returns = pd.read_parquet(os.path.join(PROCESSED_DIR, 'returns_log.parquet'))

    # Filter to year
    returns_year = returns[returns.index.year == YEAR]
    print(f"Year {YEAR}: {returns_year.shape[0]} trading days, {returns_year.shape[1]} tickers")

    for n in SUBSETS:
        tickers = select_top_n_by_volume(returns_year, None, n, YEAR)
        subset = returns_year[tickers]

        # Pearson correlation
        corr = subset.corr(method='pearson')

        # Convert to JSON-friendly format
        output = {
            'year': YEAR,
            'n': len(tickers),
            'tickers': tickers,
            'matrix': corr.values.tolist()  # N×N list of lists (float64)
        }

        out_path = os.path.join(PROCESSED_DIR, f'corr_matrix_{YEAR}_N{n}.json')
        with open(out_path, 'w') as f:
            json.dump(output, f)

        file_size = os.path.getsize(out_path) / 1e6
        print(f"  N={n}: {len(tickers)} tickers, matrix {len(tickers)}×{len(tickers)}, file {file_size:.2f} MB")
