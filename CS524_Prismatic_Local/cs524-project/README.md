# Prismatic: Interactive Multi-View SVG Baseline

A financial visualization project simulating the "Prismatic" paper interactions using standard HTML/JS/D3 (SVG).

## 🚀 Current Status (Week 2 Baseline)
*   **Fully Functional Views**:
    *   **A. Network View**: Interactive clustering with "Must-have" tickers and Correlation Threshold slider.
    *   **B. Correlation Matrix**: "Green Heatmap" with dynamic cell interactions.
    *   **C. Knowledge Graph**: Chord diagram showing Business/Location/Human relationships (Click a cell to trigger).
    *   **D. Prism View**: Time-series correlations (Window vs End-Date) for selected pairs.
*   **Data**: Uses real 2020 S&P 500 data (Prices, Returns, Correlations).
*   **Pipeline**: Python scripts in `data/pipeline/` to fetch and process data.

## 🛠️ How to Run
Since this is a client-side visualization, you just need a local static web server.

### 1. Prerequisites
*   Python 3 installed.

### 2. Start the Server
Open a terminal in the project folder (`cs524-project`) and run:

```bash
python -m http.server 8000
```

### 3. Open in Browser
Go to:
[http://localhost:8000/svg-baseline/combined.html](http://localhost:8000/svg-baseline/combined.html)

*(Note: Depending on your folder structure, you might need to navigate to `svg-baseline/combined.html` from the root).*

## 📂 Project Structure
*   `svg-baseline/`: The web application (HTML/JS/CSS).
*   `data/`:
    *   `raw/`: Parquet files (Prices).
    *   `processed/`: JSON files for the web app (`corr_matrix`, `returns_all`, `metadata`).
    *   `pipeline/`: Python scripts to generate the data.
