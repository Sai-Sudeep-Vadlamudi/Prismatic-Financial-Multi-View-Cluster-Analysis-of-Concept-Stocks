"""
Export browser-ready JSON data for dynamic Prism computation and Knowledge Graph.

Outputs:
  data/processed/returns_all.json       — log returns for all available years
  data/processed/sp500_metadata.json    — sector, sub-industry, HQ per ticker
"""
import pandas as pd
import numpy as np
import json
import os

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '..', 'processed')
MIN_TRADING_DAYS = 200


def get_sp500_metadata():
    """
    Scrape S&P 500 metadata from Wikipedia.
    Returns dict: ticker -> {sector, subIndustry, hqLocation, hqState}
    """
    tables = pd.read_html('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')
    df = tables[0]

    metadata = {}
    for _, row in df.iterrows():
        ticker = str(row['Symbol']).replace('.', '-')
        hq_full = str(row.get('Headquarters Location', 'Unknown'))
        # Extract state from "City, State" format
        parts = hq_full.split(',')
        hq_state = parts[-1].strip() if len(parts) >= 2 else 'Unknown'

        metadata[ticker] = {
            'name': str(row.get('Security', ticker)),
            'sector': str(row.get('GICS Sector', 'Unknown')),
            'subIndustry': str(row.get('GICS Sub-Industry', 'Unknown')),
            'hqLocation': hq_full,
            'hqState': hq_state,
        }
    return metadata


def build_fallback_metadata(tickers):
    """Generate synthetic metadata when Wikipedia is unreachable."""
    sectors = [
        'Information Technology', 'Health Care', 'Financials',
        'Consumer Discretionary', 'Industrials', 'Energy',
        'Utilities', 'Real Estate', 'Materials',
        'Consumer Staples', 'Communication Services'
    ]
    sub_industries = [
        'Software', 'Pharma', 'Banks', 'Retail', 'Aerospace',
        'Oil & Gas', 'Electric Utilities', 'REITs', 'Chemicals',
        'Food Products', 'Media'
    ]
    states = [
        'California', 'New York', 'Texas', 'Illinois', 'Washington',
        'Massachusetts', 'Georgia', 'Pennsylvania', 'Ohio', 'Virginia'
    ]

    meta = {}
    for i, t in enumerate(tickers):
        meta[t] = {
            'name': t,
            'sector': sectors[i % len(sectors)],
            'subIndustry': sub_industries[i % len(sub_industries)],
            'hqLocation': f'City, {states[i % len(states)]}',
            'hqState': states[i % len(states)],
        }
    return meta


if __name__ == '__main__':
    returns = pd.read_parquet(os.path.join(PROCESSED_DIR, 'returns_log.parquet'))
    all_tickers = sorted(returns.columns.tolist())
    print(f"Returns loaded: {returns.shape[0]} days × {len(all_tickers)} tickers")

    # ── 1. Export returns per year ──
    years_available = sorted(returns.index.year.unique())
    returns_output = {
        'tickers': all_tickers,
        'years': {},
    }

    for year in years_available:
        year_data = returns[returns.index.year == year]
        if len(year_data) < MIN_TRADING_DAYS:
            continue

        dates = year_data.index.strftime('%Y-%m-%d').tolist()

        # Build returns array: returns_matrix[ticker_idx][day_idx]
        returns_matrix = []
        for t in all_tickers:
            if t in year_data.columns:
                vals = year_data[t].values.tolist()
                vals = [0.0 if (v != v) else round(v, 6) for v in vals]
            else:
                vals = [0.0] * len(dates)
            returns_matrix.append(vals)

        returns_output['years'][str(year)] = {
            'dates': dates,
            'T': len(dates),
            'returns': returns_matrix,
        }
        print(f"  Year {year}: {len(dates)} trading days")

    out_path = os.path.join(PROCESSED_DIR, 'returns_all.json')
    with open(out_path, 'w') as f:
        json.dump(returns_output, f)
    file_size = os.path.getsize(out_path) / 1e6
    print(f"Returns saved: {out_path} ({file_size:.1f} MB)")

    # ── 2. Export metadata ──
    print("\nFetching S&P 500 metadata from Wikipedia...")
    try:
        meta = get_sp500_metadata()
        print(f"  Wikipedia: {len(meta)} tickers")
    except Exception as e:
        print(f"  Wikipedia failed: {e}")
        print("  Using fallback metadata...")
        meta = build_fallback_metadata(all_tickers)

    # Ensure every ticker in our returns has metadata
    for t in all_tickers:
        if t not in meta:
            meta[t] = {
                'name': t,
                'sector': 'Unknown',
                'subIndustry': 'Unknown',
                'hqLocation': 'Unknown',
                'hqState': 'Unknown',
            }

    # Build sector/industry/state summary for reference
    sector_counts = {}
    state_counts = {}
    for t in all_tickers:
        s = meta[t]['sector']
        st = meta[t]['hqState']
        sector_counts[s] = sector_counts.get(s, 0) + 1
        state_counts[st] = state_counts.get(st, 0) + 1

    meta_output = {
        'tickers': all_tickers,
        'metadata': {t: meta[t] for t in all_tickers},
        'summary': {
            'sectors': sector_counts,
            'states': state_counts,
        }
    }

    out_path = os.path.join(PROCESSED_DIR, 'sp500_metadata.json')
    with open(out_path, 'w') as f:
        json.dump(meta_output, f)
    file_size = os.path.getsize(out_path) / 1e6
    print(f"Metadata saved: {out_path} ({file_size:.1f} MB)")
    print(f"\nSector distribution:")
    for s, c in sorted(sector_counts.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")
