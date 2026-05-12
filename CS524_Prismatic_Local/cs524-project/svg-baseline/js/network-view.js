/**
 * Financial Correlation Network View — Interactive Cluster Detection
 *
 * Paper workflow (Section V-A):
 *   1. User enters must-have tickers + correlation threshold
 *   2. For each year, filter the pre-computed full correlation matrix:
 *      a. Keep edges where |Pearson corr| >= threshold
 *      b. Find connected component containing the must-have tickers
 *      c. That connected component is the cluster for that year
 *   3. Display year rows with:
 *      - Left: correlation distribution plot
 *      - Right: cluster rectangles with member dots
 *   4. User clicks a year row → triggers Correlation Matrix for that cluster
 */

const NetworkView = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';

    // ─── State ─────────────────────────────────────────────────────

    let manifest = null;           // { years: [2018,2019,2020], files: {...} }
    let correlationData = {};      // year -> { tickers, matrix, tickerIndex }
    let clusterResults = {};       // year -> { clusterTickers, allComponents }
    let selectedYear = null;

    // ─── Data Loading ──────────────────────────────────────────────

    async function loadManifest() {
        if (manifest) return manifest;
        const resp = await fetch(`${DATA_BASE}correlation_manifest.json`);
        manifest = await resp.json();
        console.log(`Manifest loaded: years = [${manifest.years.join(', ')}]`);
        return manifest;
    }

    async function loadCorrelationForYear(year) {
        if (correlationData[year]) return correlationData[year];

        const info = manifest.files[String(year)];
        if (!info) {
            console.warn(`No correlation data for year ${year}`);
            return null;
        }

        try {
            const resp = await fetch(`${DATA_BASE}${info.filename}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            const data = await resp.json();

            // Build ticker → index lookup
            const tickerIndex = {};
            data.tickers.forEach((t, i) => { tickerIndex[t] = i; });

            correlationData[year] = {
                year: data.year,
                tickers: data.tickers,
                matrix: data.matrix,
                tickerIndex: tickerIndex,
                nTickers: data.n_tickers,
                nDays: data.n_days,
            };

            console.log(`Correlation ${year}: ${data.n_tickers} tickers loaded`);
            return correlationData[year];
        } catch (e) {
            console.error(`Failed to load correlation data for ${year}:`, e);
            return null;
        }
    }

    // ─── Cluster Detection ─────────────────────────────────────────

    /**
     * Find the connected component containing all must-have tickers
     * in the thresholded correlation graph.
     *
     * Algorithm:
     *   1. Build adjacency: edge if |corr(i,j)| >= threshold
     *   2. BFS/DFS from each must-have ticker
     *   3. Return the union of all reachable tickers
     *
     * This is a simplification of the paper's approach (which uses
     * Spearman check first, then Pearson, then betweenness centrality).
     * The principle is the same: threshold → connected component.
     */
    function detectCluster(corrData, mustHaveTickers, threshold) {
        const { tickers, matrix, tickerIndex } = corrData;
        const n = tickers.length;

        // Validate must-have tickers exist in this year's data
        const validMustHave = mustHaveTickers.filter(t => tickerIndex[t] !== undefined);
        if (validMustHave.length === 0) {
            return { clusterTickers: [], components: [], error: 'None of the must-have tickers found in data' };
        }

        // Build adjacency list from thresholded correlation
        const adj = new Array(n).fill(null).map(() => []);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(matrix[i][j]) >= threshold) {
                    adj[i].push(j);
                    adj[j].push(i);
                }
            }
        }

        // BFS from each must-have ticker, collect reachable set
        const reachable = new Set();

        for (const ticker of validMustHave) {
            const startIdx = tickerIndex[ticker];
            if (reachable.has(startIdx)) continue; // Already found in earlier BFS

            const visited = new Set();
            const queue = [startIdx];
            visited.add(startIdx);

            while (queue.length > 0) {
                const current = queue.shift();
                for (const neighbor of adj[current]) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            // Add all nodes in this component to reachable
            for (const idx of visited) {
                reachable.add(idx);
            }
        }

        // Convert indices back to tickers
        const clusterTickers = [];
        for (const idx of reachable) {
            clusterTickers.push(tickers[idx]);
        }
        clusterTickers.sort();

        // Also find all connected components for visualization
        const componentOf = new Array(n).fill(-1);
        let componentId = 0;
        const components = [];

        for (let i = 0; i < n; i++) {
            if (componentOf[i] !== -1) continue;
            // Only consider nodes that have at least one edge
            if (adj[i].length === 0) continue;

            const comp = [];
            const queue = [i];
            componentOf[i] = componentId;

            while (queue.length > 0) {
                const current = queue.shift();
                comp.push(current);
                for (const neighbor of adj[current]) {
                    if (componentOf[neighbor] === -1) {
                        componentOf[neighbor] = componentId;
                        queue.push(neighbor);
                    }
                }
            }

            components.push({
                id: componentId,
                indices: comp,
                tickers: comp.map(idx => tickers[idx]),
                size: comp.length,
                containsMustHave: comp.some(idx => validMustHave.includes(tickers[idx])),
            });
            componentId++;
        }

        // Sort components: must-have-containing first, then by size descending
        components.sort((a, b) => {
            if (a.containsMustHave !== b.containsMustHave) return b.containsMustHave - a.containsMustHave;
            return b.size - a.size;
        });

        return {
            clusterTickers,
            components,
            validMustHave,
            threshold,
            totalNodes: n,
            nodesAboveThreshold: reachable.size,
        };
    }

    // ─── Render Year Rows ──────────────────────────────────────────

    function render(containerId, mustHaveTickers, threshold, callbacks) {
        const container = document.getElementById(containerId);
        if (!container) return { elCount: 0 };
        container.innerHTML = '';

        const years = Object.keys(clusterResults).map(Number).sort();
        if (years.length === 0) {
            container.textContent = 'No cluster results. Click "Generate Clusters".';
            return { elCount: 0 };
        }

        const rowH = 90;
        const plotW = 210;
        const distW = 60;
        const clusterAreaW = plotW - distW - 15;
        const totalH = years.length * (rowH + 30) + 20;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', plotW)
            .attr('height', totalH);

        let elCount = 0;

        years.forEach((year, yi) => {
            const result = clusterResults[year];
            const corrData = correlationData[year];
            if (!result || !corrData) return;

            const yOff = yi * (rowH + 30) + 15;

            // Clickable year row group
            const rowG = svg.append('g')
                .attr('class', 'year-row')
                .attr('transform', `translate(5, ${yOff})`)
                .attr('data-year', year)
                .on('click', function () {
                    // Deselect all, select this one
                    svg.selectAll('.year-row').classed('selected', false);
                    d3.select(this).classed('selected', true);
                    selectedYear = year;
                    if (callbacks && callbacks.onYearSelect) {
                        callbacks.onYearSelect(year, result.clusterTickers);
                    }
                });

            // Background rect for hover effect
            rowG.append('rect')
                .attr('x', -4).attr('y', -15)
                .attr('width', plotW - 2).attr('height', rowH + 20)
                .attr('fill', 'transparent').attr('rx', 4);
            elCount++;

            // Year label + cluster size
            rowG.append('text')
                .attr('x', 0).attr('y', -3)
                .attr('font-size', '12px').attr('font-weight', '700')
                .attr('fill', '#0B1D3A')
                .text(String(year));
            elCount++;

            rowG.append('text')
                .attr('x', distW + 5).attr('y', -3)
                .attr('font-size', '9px').attr('fill', '#888')
                .text(`total: ${result.clusterTickers.length}`);
            elCount++;

            // ── Distribution plot ──
            // Shows distribution of correlations between must-have stocks and all others
            // Shaded area = market-wide distribution; Lines = must-have stocks' distributions

            const nBins = 40;
            const { tickers, matrix, tickerIndex } = corrData;

            // Market-wide correlation distribution (sample: correlations of first ticker with all)
            const marketCorrs = [];
            for (let i = 0; i < Math.min(tickers.length, 200); i++) {
                for (let j = i + 1; j < Math.min(tickers.length, 200); j++) {
                    marketCorrs.push(matrix[i][j]);
                }
            }

            // Bin the distribution
            const binScale = d3.scaleLinear().domain([-1, 1]).range([0, distW]);
            const binWidth = distW / nBins;

            // Compute histogram
            const bins = new Array(nBins).fill(0);
            for (const v of marketCorrs) {
                const idx = Math.min(nBins - 1, Math.max(0, Math.floor((v + 1) / 2 * nBins)));
                bins[idx]++;
            }
            const maxBin = Math.max(...bins, 1);

            // Area path for market distribution
            let areaD = `M 0 ${rowH}`;
            for (let b = 0; b < nBins; b++) {
                const x = b * binWidth + binWidth / 2;
                const y = rowH - (bins[b] / maxBin) * rowH * 0.85;
                areaD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            }
            areaD += ` L ${distW} ${rowH} Z`;

            rowG.append('path').attr('d', areaD)
                .attr('fill', 'rgba(11,29,58,0.08)')
                .attr('stroke', 'rgba(11,29,58,0.25)')
                .attr('stroke-width', 0.5);
            elCount++;

            // Overlay lines for each must-have stock's correlation distribution
            const validMustHave = mustHaveTickers.filter(t => tickerIndex[t] !== undefined);
            validMustHave.forEach((ticker, si) => {
                const tidx = tickerIndex[ticker];
                const stockCorrs = matrix[tidx].filter((_, j) => j !== tidx);

                const stockBins = new Array(nBins).fill(0);
                for (const v of stockCorrs) {
                    const idx = Math.min(nBins - 1, Math.max(0, Math.floor((v + 1) / 2 * nBins)));
                    stockBins[idx]++;
                }
                const stockMax = Math.max(...stockBins, 1);

                let lineD = '';
                for (let b = 0; b < nBins; b++) {
                    const x = b * binWidth + binWidth / 2;
                    const y = rowH - (stockBins[b] / stockMax) * rowH * 0.7;
                    lineD += (b === 0 ? 'M' : ' L') + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
                }

                rowG.append('path').attr('d', lineD)
                    .attr('fill', 'none')
                    .attr('stroke', d3.schemeTableau10[si % 10])
                    .attr('stroke-width', 1.2)
                    .attr('opacity', 0.7);
                elCount++;
            });

            // Threshold line
            const threshX = binScale(threshold);
            rowG.append('line')
                .attr('x1', threshX).attr('x2', threshX)
                .attr('y1', 0).attr('y2', rowH)
                .attr('stroke', '#e53935').attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,2');
            elCount++;

            // ── Cluster rectangles with member dots ──
            const xStart = distW + 10;
            const displayComps = result.components.filter(c => c.size >= 2).slice(0, 5);
            let xOff = xStart;

            displayComps.forEach((comp) => {
                const maxDotsToShow = Math.min(comp.size, 50);
                const cols = Math.ceil(Math.sqrt(maxDotsToShow));
                const rows = Math.ceil(maxDotsToShow / cols);
                const dotSpacing = Math.min(6, Math.floor((rowH - 8) / rows));
                const boxW = cols * dotSpacing + 4;
                const boxH = Math.min(rows * dotSpacing + 4, rowH - 4);

                if (xOff + boxW > plotW - 5) return; // Don't overflow

                rowG.append('rect')
                    .attr('x', xOff).attr('y', 2)
                    .attr('width', boxW).attr('height', boxH)
                    .attr('fill', comp.containsMustHave ? 'rgba(11,29,58,0.03)' : 'none')
                    .attr('stroke', comp.containsMustHave ? '#0B1D3A' : '#ccc')
                    .attr('stroke-width', comp.containsMustHave ? 1 : 0.5)
                    .attr('rx', 2);
                elCount++;

                for (let d = 0; d < maxDotsToShow; d++) {
                    const col = d % cols;
                    const row = Math.floor(d / cols);
                    const ticker = comp.tickers[d];
                    const isMustHave = validMustHave.includes(ticker);

                    rowG.append('circle')
                        .attr('cx', xOff + 4 + col * dotSpacing + dotSpacing / 2)
                        .attr('cy', 5 + row * dotSpacing + dotSpacing / 2)
                        .attr('r', isMustHave ? 3 : 1.5)
                        .attr('fill', isMustHave
                            ? d3.schemeTableau10[validMustHave.indexOf(ticker) % 10]
                            : '#0B1D3A')
                        .attr('opacity', isMustHave ? 1 : 0.35);
                    elCount++;
                }

                xOff += boxW + 5;
            });

            // ── Connection lines between years ──
            if (yi > 0) {
                const prevResult = clusterResults[years[yi - 1]];
                if (prevResult) {
                    // Show lines for tickers that appear in both years
                    const prevSet = new Set(prevResult.clusterTickers);
                    const shared = result.clusterTickers.filter(t => prevSet.has(t));
                    const linesToDraw = Math.min(shared.length, 25);

                    for (let li = 0; li < linesToDraw; li++) {
                        const x1 = distW + 15 + (li / linesToDraw) * (plotW - distW - 30);
                        const x2 = distW + 15 + (li / linesToDraw) * (plotW - distW - 30) + (Math.random() - 0.5) * 10;

                        svg.append('line')
                            .attr('x1', 5 + x1).attr('y1', yOff - 8)
                            .attr('x2', 5 + x2).attr('y2', yOff - 22)
                            .attr('stroke', '#bbb').attr('stroke-width', 0.4);
                        elCount++;
                    }
                }
            }
        });

        return { elCount, selectedYear };
    }

    // ─── High-level: generate clusters for all years ───────────────

    async function generateClusters(mustHaveTickers, threshold, statusCallback) {
        await loadManifest();

        clusterResults = {};

        for (const year of manifest.years) {
            if (statusCallback) statusCallback(`Loading ${year} correlations...`);
            const corrData = await loadCorrelationForYear(year);
            if (!corrData) continue;

            if (statusCallback) statusCallback(`Detecting clusters for ${year}...`);
            const result = detectCluster(corrData, mustHaveTickers, threshold);
            clusterResults[year] = result;

            console.log(`${year}: cluster=${result.clusterTickers.length} tickers, ` +
                `components=${result.components.length}`);
        }

        return clusterResults;
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        loadManifest,
        loadCorrelationForYear,
        generateClusters,
        render,
        getClusterResults: () => clusterResults,
        getCorrelationData: () => correlationData,
        getSelectedYear: () => selectedYear,
    };
})();
