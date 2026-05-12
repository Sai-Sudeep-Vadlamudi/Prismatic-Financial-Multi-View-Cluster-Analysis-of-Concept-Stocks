"""
Compute FULL Pearson correlation matrices for all available tickers, per year.

The paper pre-computes yearly correlations for ALL stocks (Section IV-A).
The browser then slices the relevant sub-matrix based on cluster membership.

Output: data/processed/full_corr_{YEAR}.json per available year
        data/processed/correlation_manifest.json (lists what's available)
"""
import pandas as pd
import numpy as np
import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')

# Minimum trading days required for a year to be usable
MIN_TRADING_DAYS = 200


def compute_yearly_correlations(returns_df):
    """
    For each complete year in the returns dataframe, compute the full
    Pearson correlation matrix across all tickers.
    
    Returns: dict of year -> (tickers, matrix)
    """
    results = {}
    
    # Find which years have enough data
    years_available = sorted(returns_df.index.year.unique())
    
    for year in years_available:
        year_data = returns_df[returns_df.index.year == year]
        
        if len(year_data) < MIN_TRADING_DAYS:
            print(f"  Year {year}: only {len(year_data)} days (need {MIN_TRADING_DAYS}). Skipping.")
            continue
        
        # Drop tickers with too many NaNs in this year
        valid_cols = year_data.columns[year_data.notna().sum() > MIN_TRADING_DAYS]
        year_data = year_data[valid_cols].dropna(axis=1, how='any')
        
        tickers = sorted(year_data.columns.tolist())
        year_data = year_data[tickers]  # Ensure consistent ordering
        
        print(f"  Year {year}: {len(year_data)} days × {len(tickers)} tickers")
        
        # Pearson correlation
        corr_matrix = year_data.corr(method='pearson')
        
        # Replace NaN with 0 (stocks with zero variance)
        corr_matrix = corr_matrix.fillna(0)
        
        # Round to 4 decimal places to reduce JSON size
        matrix_rounded = np.round(corr_matrix.values, 4).tolist()
        
        results[year] = {
            'tickers': tickers,
            'matrix': matrix_rounded,
            'n_tickers': len(tickers),
            'n_days': len(year_data),
        }
    
    return results


if __name__ == '__main__':
    returns = pd.read_parquet(os.path.join(PROCESSED_DIR, 'returns_log.parquet'))
    print(f"Returns loaded: {returns.shape[0]} days × {returns.shape[1]} tickers")
    print(f"Date range: {returns.index.min()} to {returns.index.max()}")
    
    yearly = compute_yearly_correlations(returns)
    
    if not yearly:
        print("ERROR: No years with sufficient data found.")
        exit(1)
    
    # Save each year as a separate file (keeps individual file sizes manageable)
    manifest = {
        'years': [],
        'files': {},
    }
    
    for year, data in sorted(yearly.items()):
        filename = f'full_corr_{year}.json'
        out_path = os.path.join(PROCESSED_DIR, filename)
        
        output = {
            'year': year,
            'tickers': data['tickers'],
            'n_tickers': data['n_tickers'],
            'n_days': data['n_days'],
            'matrix': data['matrix'],
        }
        
        with open(out_path, 'w') as f:
            json.dump(output, f)
        
        file_size = os.path.getsize(out_path) / 1e6
        manifest['years'].append(year)
        manifest['files'][str(year)] = {
            'filename': filename,
            'n_tickers': data['n_tickers'],
            'n_days': data['n_days'],
            'file_size_mb': round(file_size, 2),
        }
        print(f"  Saved {filename}: {data['n_tickers']} tickers, {file_size:.2f} MB")
    
    # Save manifest (browser loads this first to know what's available)
    manifest_path = os.path.join(PROCESSED_DIR, 'correlation_manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest: {manifest_path}")
    print(f"Available years: {manifest['years']}")
