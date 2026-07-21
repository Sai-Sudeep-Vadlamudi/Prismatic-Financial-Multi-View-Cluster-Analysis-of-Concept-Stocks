

# Prismatic Financial Multi-View Cluster Analysis of Concept Stocks
![Finance](https://img.shields.io/badge/Domain-Financial%20Analytics-purple)
![Visualization](https://img.shields.io/badge/Visualization-SVG%20%2B%20Canvas-green)
![JavaScript](https://img.shields.io/badge/JavaScript-D3.js-yellow)
![Python](https://img.shields.io/badge/Python-Data%20Pipeline-blue)
![Status](https://img.shields.io/badge/Status-Research%20Prototype-orange)

## Overview

**Prismatic Financial Multi-View Cluster Analysis of Concept Stocks** is an interactive financial visual analytics system designed to help users discover, explore, and validate groups of stocks that move together over time.

The project is inspired by the research paper **“Prismatic: Interactive Multi-View Cluster Analysis of Concept Stocks”** and adapts its core idea into a practical browser-based analytics tool for U.S. equity-market data.


In real-world investing and portfolio research, stocks are not always understood only through fixed sector labels such as Technology, Healthcare, Finance, or Energy. Analysts often reason through broader market themes such as AI infrastructure, semiconductor supply chains, cloud computing, electric vehicles, banking stress, healthcare shocks, or event-driven market behavior. These theme-based groups are commonly understood as **concept-stock clusters**.

The challenge is that these relationships are difficult to validate. Two companies may appear related because they belong to the same industry, but their stock behavior may be very different. Similarly, two companies from different sectors may temporarily move together because of a shared market event. A single correlation number or static dashboard is not enough to explain these relationships.

This project turns raw historical stock data into an interactive visual reasoning workflow for equity research. Instead of relying on static sector labels or single correlation values, users can generate stock clusters, inspect internal relationships, validate pairwise behavior across time windows, and connect market movement with business context. It solves that problem by combining **financial correlation analysis, interactive visualization, business-context exploration, and multi-scale time-series validation** into one coordinated workflow.

📄 **Read the original paper here:**  
[Prismatic: Interactive Multi-View Cluster Analysis of Concept Stocks](./Prismatic_Interactive_Multi-View_Cluster_Analysis_of_Concept_Stocks%20(5).pdf)

## Problem Statement

Basic financial dashboards are good at showing what happened to a stock, but they often fail to explain how stock clusters behave together and whether those qualitative & quantitative relationships are meaningful.
A financial analyst, portfolio researcher, or data-driven investor may need to answer questions such as:

- Which stocks moved together during a specific market period?
- Is a stock cluster truly meaningful or only temporarily correlated?
- Are multiple stocks in a portfolio creating hidden concentration risk?
- Did two stocks remain correlated throughout the year, or only during a short market event?
- Which companies are weak or noisy members of a cluster?
- Does the relationship between stocks make sense from a business perspective?
- Can users build their own concept-stock groups instead of relying only on predefined sectors?

This project addresses those questions by turning raw stock-price data into an interactive reasoning system for financial cluster analysis.

<img width="1004" height="327" alt="{2767FC8A-1733-41C5-9BD2-D5C6FD97EF00}" src="https://github.com/user-attachments/assets/c16faf14-9125-46d8-81cc-2ba65729e4bd" />


Here is a simplified example illustrating different financial clusters. Sectors and industries are related hierarchically, while concept stocks can be constructed arbitrarily to label specific business relational knowledge.

---

## Solution

The system allows users to start with a few stocks of interest, generate a correlation-based cluster around them, inspect the relationships visually, explore business context, and validate whether those relationships are stable across time.

Instead of simply displaying stock prices, the tool supports a full analytical workflow:

```text
Select stocks of interest
        ↓
Generate a correlation-based cluster
        ↓
Explore relationships inside the cluster
        ↓
Add business context through metadata
        ↓
Validate stock pairs across multiple time windows
        ↓
Refine the cluster into a more meaningful concept group
```

This creates a more realistic financial analysis process where the user is not just looking at charts, but actively investigating whether a group of stocks represents a meaningful market theme.

---

## Key Features

## 1. Interactive Concept-Stock Discovery

Users can enter one or more important tickers and generate a group of stocks that moved similarly during a selected period.

For example, a user can start with:

```text
AAPL, MSFT, NVDA
```

The system then helps identify other stocks that may belong to the same market theme or correlation group.

This is useful for discovering possible clusters around themes such as technology momentum, AI infrastructure, semiconductor exposure, healthcare events, or broader sector movement.

---

## 2. Correlation-Based Cluster Exploration

The application uses historical stock-return correlations to identify relationships between companies.

Instead of manually checking hundreds of tickers, users can visually narrow the stock universe into a smaller, more meaningful group of candidates.

This helps analysts understand:

- which companies move together,
- which companies form subgroups,
- which companies are outliers,
- and whether the cluster behaves as one coherent theme.



---

## 3. Correlation Matrix View

The correlation matrix provides a compact visual summary of relationships inside a selected stock cluster.

It helps users quickly identify:

- strong stock-to-stock relationships,
- weak relationships,
- possible sub-clusters,
- noisy members,
- and stocks that may not belong in the final group.
<img width="933" height="439" alt="{F7F86698-96F2-4408-960B-D78B01FCE7B9}" src="https://github.com/user-attachments/assets/df5f2adb-ae91-43ad-84e4-7549e2e9ee3e" />

This view is useful for validating whether a generated cluster is internally consistent or whether it contains unrelated companies.

---

## 4. Prism Time-Series Validation

A single yearly correlation value can be misleading. Two stocks may have a high overall correlation, but that relationship may only exist during a short market event.

The Prism time-series view solves this by showing how the relationship between two stocks changes across many different time windows.

This helps identify:

- stable long-term correlation,
- short-term event-driven correlation,
- sudden market shocks,
- long-term divergence,
- temporary co-movement,
- and periods where two stocks stop behaving similarly.
<img width="944" height="209" alt="{7F9D67F1-8A73-4540-BFA5-FFB54F811056}" src="https://github.com/user-attachments/assets/452c6a71-e069-4562-bf98-2a7d0c18e211" />

This feature makes the tool more analytical than a normal stock dashboard because it helps users validate the quality and stability of relationships over time.

---

## 5. Business Context Exploration

The system does not rely only on numerical correlation. It also provides business metadata such as sector and industry to help users interpret why companies may be related.

This helps answer questions such as:

- Are these companies from the same industry?
- Do they belong to a similar business category?
- Is the correlation explainable from a business perspective?
- Is the relationship surprising and worth deeper investigation?
- Does the cluster represent a real market theme or only temporary market movement?
<img width="202" height="342" alt="{AB512E2A-56E6-41A3-807A-F02C43119B6D}" src="https://github.com/user-attachments/assets/7b9e3fc6-4936-4f24-b2d4-bb8836cc83e7" />
<img width="200" height="342" alt="{687C3FC6-C464-4EE6-9EE9-76286915B94E}" src="https://github.com/user-attachments/assets/a41139ef-22fd-4834-98ea-a4d9f39de67d" />
<img width="200" height="342" alt="{C48606DC-525D-4A75-B9F3-EDDEF122AC7C}" src="https://github.com/user-attachments/assets/4cf40c04-e092-47fc-98e2-63bd06373c78" />
<img width="200" height="342" alt="{4AA0F813-E4A5-461A-9538-076655227CA5}" src="https://github.com/user-attachments/assets/ce66d728-ed93-4445-807b-b5771911777b" />


By combining quantitative behavior with business context, the tool supports more defensible financial reasoning.

---

## 6. SVG and Canvas Rendering Versions

The repository includes both an SVG-based baseline and a Canvas-optimized version.

The SVG version is useful for clear visual structure and easier inspection. The Canvas version is designed for better scalability when rendering dense matrix and time-series views.

This comparison demonstrates an important real-world engineering tradeoff:

| Rendering Approach | Strength | Limitation |
|---|---|---|
| SVG / D3 | Easy to inspect, debug, and map to visual elements | Can become slow when thousands of elements are rendered |
| Canvas | Better for dense and scalable visual analytics | Requires custom interaction and hit-testing logic |

The Canvas implementation improves the system’s ability to handle larger and more complex financial visualizations.


---

## Example Use Case

Imagine an analyst wants to study a technology-related market theme.

They begin with a few familiar tickers:

```text
AAPL, MSFT, NVDA
```

The system generates a candidate cluster of stocks that moved similarly during the selected year.

The analyst then uses the correlation matrix to identify which companies are strongly connected and which are weak members of the group.

Next, the analyst selects a pair such as:

```text
NVDA and AMD
```

The Prism time-series view shows whether the relationship was stable across the full year or only strong during a specific market event.

Finally, the metadata view helps interpret whether the relationship makes sense from a business perspective.

Through this workflow, the analyst can build a more defensible understanding of a stock cluster instead of relying only on a watchlist, sector label, or single correlation number.

---

## Real-World Value

This project is designed around a practical financial analytics problem: understanding relationships between stocks is difficult when the user must reason across many companies, time windows, and business contexts.

Potential real-world applications include:

- **Investment research**: discovering groups of stocks with similar market behavior.
- **Portfolio risk analysis**: identifying hidden concentration risk among correlated holdings.
- **Thematic investing**: building and validating concept-stock groups around market themes.
- **Market event analysis**: understanding how major events affect relationships between companies.
- **Equity research**: combining numerical behavior with business context.
- **Financial education**: helping users visually understand correlation, co-movement, and diversification.

The purpose of the tool is not to predict stock prices. Its value is in helping users reason more clearly about how stocks are connected and whether those connections are meaningful.

---

## Skills Demonstrated

This project demonstrates a combination of financial analytics, data engineering, visualization, and software development skills.

### Financial Analytics

- Stock correlation analysis
- Concept-stock discovery
- Market co-movement analysis
- Portfolio concentration risk awareness
- Event-driven relationship exploration
- Time-series interpretation

### Data Analytics

- Historical stock-price processing
- Return calculation
- Correlation-matrix generation
- Data cleaning and transformation
- Browser-ready data preparation
- Analytical workflow design

### Data Visualization

- Multi-view visual analytics
- Interactive correlation matrix design
- Time-window-based correlation visualization
- Coordinated visual exploration
- Dense data rendering
- Human-in-the-loop analysis workflow

### Software Engineering

- Python data pipeline development
- JavaScript front-end development
- D3.js visualization
- SVG rendering
- Canvas-based rendering
- Local browser deployment
- Performance-aware visualization design

### Research Translation

- Studied an advanced visual analytics research paper
- Recreated the core analytical workflow independently
- Adapted the idea to U.S. equity-market data
- Extended the implementation with scalable rendering
- Converted an academic concept into a working interactive prototype

---

## Technology Stack

| Area | Tools / Technologies |
|---|---|
| Data Collection | Python, yfinance |
| Data Processing | pandas, NumPy |
| Data Storage | JSON, Parquet |
| Front End | HTML, CSS, JavaScript |
| Visualization | D3.js, SVG, Canvas |
| Domain | Financial time series, equity correlations, concept-stock analysis |
| Evaluation | Browser-based interaction benchmarking |

---

## Project Structure

```text
CS524_Prismatic_Local/
└── cs524-project/
    ├── data/
    │   ├── pipeline/
    │   └── processed/
    ├── results/
    ├── svg-baseline/
    └── svg-canvas/
```

| Folder | Description |
|---|---|
| `data/pipeline/` | Python scripts used to collect, process, and prepare financial data. |
| `data/processed/` | Processed financial data used by the browser application. |
| `svg-baseline/` | SVG/D3-based version of the visual analytics system. |
| `svg-canvas/` | Canvas-optimized version of the system. |
| `results/` | Benchmark outputs and performance comparison results. |

---

## How to Run the Project

Clone the repository:

```bash
git clone https://github.com/Sai-Sudeep-Vadlamudi/Prismatic-Financial-Multi-View-Cluster-Analysis-of-Concept-Stocks.git
cd Prismatic-Financial-Multi-View-Cluster-Analysis-of-Concept-Stocks/CS524_Prismatic_Local/cs524-project
```

Start a local server:

```bash
python -m http.server 8000
```

Open the Canvas-based version:

```text
http://localhost:8000/svg-canvas/combined-canvas.html
```

Open the SVG baseline version:

```text
http://localhost:8000/svg-baseline/combined.html
```

---

## Recommended Demo Flow

To understand the project quickly:

1. Open the Canvas version.
2. Enter a few familiar stock tickers.
3. Generate a correlation-based stock cluster.
4. Inspect the correlation matrix.
5. Click a stock pair to open the Prism time-series view.
6. Use the metadata view to interpret business context.
7. Compare the Canvas version with the SVG baseline.

This demonstrates the full purpose of the system: discovering, exploring, and validating financial clusters interactively.

---

## Current Limitations

This project is a research and portfolio prototype, not a production-grade financial platform.

Current limitations include:

- The available processed data focuses on the included historical dataset.
- The business-context view uses available metadata rather than a full financial knowledge graph.
- The system does not currently include live prices, earnings events, news, institutional ownership, or supply-chain data.
- Correlation does not imply causation.
- The tool does not generate buy, sell, or hold recommendations.
- Larger-scale deployment would require backend infrastructure, caching, and potentially WebGL-based rendering.

---

## Future Improvements

Potential improvements include:

- Add real-time or regularly refreshed market data.
- Add more years of historical data.
- Add user-created watchlists and portfolio upload support.
- Add richer business relationships such as supply chains, institutional ownership, and executive networks.
- Add news-event overlays to explain sudden correlation changes.
- Add portfolio-level diversification and risk analysis.
- Add AI-generated natural-language explanations for discovered clusters.
- Add WebGL rendering for larger stock universes.
- Add a hosted online demo.
- Add exportable analyst reports.

---

## Disclaimer

This project is for educational, research, and portfolio demonstration purposes only.

It does not provide financial advice, trading recommendations, investment recommendations, or portfolio allocation guidance. Any financial decision should be made with independent research and professional judgment.

---

## Acknowledgement

This project is inspired by the research paper:

**Prismatic: Interactive Multi-View Cluster Analysis of Concept Stocks**  
Wong Kam-Kwai, Yan Luo, Xuanwu Yue, Wei Chen, and Huamin Qu  
IEEE Transactions on Visualization and Computer Graphics, 2025

This repository is an independent implementation and adaptation of the paper’s core visual analytics workflow.

---

## Author

**Sai Sudeep Vadlamudi**

GitHub: [Sai-Sudeep-Vadlamudi](https://github.com/Sai-Sudeep-Vadlamudi)

---

## License

This project is released under the MIT License.
