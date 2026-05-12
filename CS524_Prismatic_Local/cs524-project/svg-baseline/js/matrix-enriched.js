/**
 * Enriched Correlation Matrix — Paper-faithful SVG rendering
 *
 * Adds to the basic rect-per-cell:
 *   - Cornered border triangles (Section V-B: "reminiscent of photo frames")
 *   - Diagonal donut charts (market index correlation on diagonal)
 *   - Left bar chart (stock returns)
 *   - Right UpSet-style dots (simplified business knowledge)
 *
 * This is INTENTIONALLY heavy to reproduce the paper's actual DOM load.
 */

const MatrixEnriched = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';
    const MARGIN = { top: 40, right: 120, bottom: 10, left: 80 };

    const corrColor = d3.scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdYlGn);

    // Simulated market correlation per stock (random, seeded by index)
    function fakeMarketCorr(i, N) {
        // Deterministic pseudo-random based on index
        const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        return (x - Math.floor(x)) * 1.6 - 0.8;  // range ~ [-0.8, 0.8]
    }

    // Simulated stock returns
    function fakeReturn(i) {
        const x = Math.sin(i * 269.5 + 183.3) * 43758.5453;
        return (x - Math.floor(x)) * 0.6 - 0.3;  // range ~ [-0.3, 0.3]
    }

    // ─── Donut arc generator for diagonal cells ───────────────────

    function donutArc(cx, cy, r, value) {
        // value in [-1, 1] → angle in [0, 2π]
        const absVal = Math.min(Math.abs(value), 1);
        const angle = absVal * 2 * Math.PI;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + angle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;

        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    // ─── Corner border triangle path ─────────────────────────────

    function cornerTriangle(x, y, size, corner) {
        // corner: 'tr' (top-right, price) or 'bl' (bottom-left, volume)
        const s = size;
        const inset = s * 0.25;
        if (corner === 'tr') {
            return `M ${x + s - inset} ${y} L ${x + s} ${y} L ${x + s} ${y + inset} Z`;
        } else {
            return `M ${x} ${y + s - inset} L ${x} ${y + s} L ${x + inset} ${y + s} Z`;
        }
    }

    // ─── Subset full matrix for specific tickers ──────────────────
    function subsetMatrix(fullData, subsetTickers) {
        const { matrix, tickerIndex } = fullData;
        // Map tickers to their indices in the full matrix
        const indices = subsetTickers.map(t => {
            const idx = tickerIndex[t];
            if (idx === undefined) console.warn(`Ticker ${t} not found in full matrix`);
            return idx !== undefined ? idx : 0; // Fallback to 0 if not found (shouldn't happen)
        });

        // Create sub-matrix
        const newMatrix = indices.map(rowIdx =>
            indices.map(colIdx => matrix[rowIdx][colIdx])
        );

        return {
            tickers: subsetTickers,
            matrix: newMatrix
        };
    }

    // ─── Main render function ─────────────────────────────────────

    async function render(containerId, N, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        container.innerHTML = '';

        const tooltip = document.getElementById('tooltip');

        console.log(`MatrixEnriched.render N=${N}`);
        console.log('Options keys:', Object.keys(options));
        console.log('Has fullCorrData:', !!options.fullCorrData);
        if (options.fullCorrData) {
            console.log('fullCorrData keys:', Object.keys(options.fullCorrData));
        }

        let data;
        const t_load_start = performance.now();

        // Mode 1: Dynamic subsetting (Preferred for interactive clusters)
        if (options.fullCorrData && options.clusterTickers) {
            console.log('Using dynamic subsetting mode');
            try {
                data = subsetMatrix(options.fullCorrData, options.clusterTickers);
            } catch (e) {
                container.textContent = `Error subsetting matrix: ${e.message}`;
                return null;
            }
        }
        // Mode 2: Static fetch (Benchmark fallback for fixed N)
        else {
            const url = `${DATA_BASE}corr_matrix_2020_N${N}.json`;
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                data = await resp.json();
            } catch (e) {
                container.textContent = `Error loading N=${N}: ${e.message}`;
                return null;
            }
        }
        const t_load_end = performance.now();

        const matrix = data.matrix;
        const tickers = data.tickers;
        const n = tickers.length;

        // Cell sizing — adaptive
        const maxPlotWidth = options.maxWidth || 500;
        const cellSize = Math.max(1, Math.min(6, Math.floor(maxPlotWidth / n)));
        const matrixSize = n * cellSize;

        // Bar chart width + UpSet width
        const barW = 50;
        const upsetW = 80;
        const totalW = MARGIN.left + barW + 8 + matrixSize + 8 + upsetW + MARGIN.right;
        const totalH = MARGIN.top + matrixSize + MARGIN.bottom;

        const t_render_start = performance.now();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', totalW)
            .attr('height', totalH);

        const g = svg.append('g')
            .attr('transform', `translate(${MARGIN.left + barW + 8}, ${MARGIN.top})`);

        // ──────────────────────────────────────
        // 1) MATRIX CELLS — one rect per cell
        // ──────────────────────────────────────
        const cellData = [];
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                cellData.push({ row: i, col: j, value: matrix[i][j] });
            }
        }

        g.selectAll('rect.cell')
            .data(cellData)
            .enter()
            .append('rect')
            .attr('class', 'cell')
            .attr('x', d => d.col * cellSize)
            .attr('y', d => d.row * cellSize)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', d => corrColor(d.value))
            .attr('stroke', 'none')
            .on('mouseover', function (event, d) {
                tooltip.style.display = 'block';
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 20) + 'px';
                tooltip.textContent = `${tickers[d.row]} × ${tickers[d.col]}: ${d.value.toFixed(4)}`;
            })
            .on('mouseout', () => { tooltip.style.display = 'none'; })
            .on('click', function (event, d) {
                // 1. Visual feedback
                g.selectAll('rect.cell')
                    .attr('opacity', c => (c.row === d.row || c.col === d.col) ? 1 : 0.2);

                // 2. Invoke callback if present
                console.log(`MatrixEnriched: Clicked cell ${d.row},${d.col} -> ${tickers[d.row]} x ${tickers[d.col]}`);
                if (options.onCellClick) {
                    options.onCellClick(tickers[d.row], tickers[d.col]);
                }
            });

        // ──────────────────────────────────────
        // 2) CORNERED BORDERS — 2 triangles per cell (upper-right + lower-left)
        //    Section V-B: "cornered border reminiscent of photo frames"
        //    These serve as embedded legends indicating price vs volume regions
        // ──────────────────────────────────────
        if (cellSize >= 3) {
            // Upper-right triangles (price indicator — upper triangle of matrix)
            g.selectAll('path.corner-tr')
                .data(cellData.filter(d => d.col > d.row))  // upper triangle only
                .enter()
                .append('path')
                .attr('class', 'corner-tr')
                .attr('d', d => cornerTriangle(d.col * cellSize, d.row * cellSize, cellSize, 'tr'))
                .attr('fill', d => {
                    const ref = corrColor(d.value);
                    return d3.color(ref).darker(0.4);
                })
                .attr('stroke', 'none')
                .attr('pointer-events', 'none');

            // Bottom-left triangles (volume indicator — lower triangle of matrix)
            g.selectAll('path.corner-bl')
                .data(cellData.filter(d => d.col < d.row))  // lower triangle only
                .enter()
                .append('path')
                .attr('class', 'corner-bl')
                .attr('d', d => cornerTriangle(d.col * cellSize, d.row * cellSize, cellSize, 'bl'))
                .attr('fill', d => {
                    const ref = corrColor(d.value);
                    return d3.color(ref).darker(0.4);
                })
                .attr('stroke', 'none')
                .attr('pointer-events', 'none');
        }

        // ──────────────────────────────────────
        // 3) DIAGONAL DONUT CHARTS — market index correlation
        //    Section V-B: "diagonal shows each stock's correlation with
        //    the market index... within the colored segment of the donut chart"
        // ──────────────────────────────────────
        if (cellSize >= 3) {
            const diagData = [];
            for (let i = 0; i < n; i++) {
                diagData.push({
                    idx: i,
                    marketCorr: fakeMarketCorr(i, n)
                });
            }

            // White circle background to distinguish from cells
            g.selectAll('circle.donut-bg')
                .data(diagData)
                .enter()
                .append('circle')
                .attr('cx', d => d.idx * cellSize + cellSize / 2)
                .attr('cy', d => d.idx * cellSize + cellSize / 2)
                .attr('r', cellSize / 2 - 0.5)
                .attr('fill', '#fff')
                .attr('stroke', '#ccc')
                .attr('stroke-width', 0.3)
                .attr('pointer-events', 'none');

            // Colored arc showing market correlation magnitude
            g.selectAll('path.donut-arc')
                .data(diagData)
                .enter()
                .append('path')
                .attr('class', 'donut-arc')
                .attr('d', d => donutArc(
                    d.idx * cellSize + cellSize / 2,
                    d.idx * cellSize + cellSize / 2,
                    cellSize / 2 - 1,
                    d.marketCorr
                ))
                .attr('fill', d => d.marketCorr >= 0 ? '#4caf50' : '#a1887f')
                .attr('opacity', 0.8)
                .attr('pointer-events', 'none');
        }

        // ──────────────────────────────────────
        // 4) LEFT BAR CHART — stock returns
        //    Section V-B: "right-aligned bar chart for stock return to the left"
        // ──────────────────────────────────────
        const barG = svg.append('g')
            .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);

        const returns = [];
        for (let i = 0; i < n; i++) {
            returns.push({ idx: i, ret: fakeReturn(i) });
        }

        const barScale = d3.scaleLinear()
            .domain([-0.3, 0.3])
            .range([0, barW]);

        barG.selectAll('rect.bar')
            .data(returns)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => d.ret >= 0 ? barScale(0) : barScale(d.ret))
            .attr('y', d => d.idx * cellSize)
            .attr('width', d => Math.abs(barScale(d.ret) - barScale(0)))
            .attr('height', Math.max(1, cellSize - 0.5))
            .attr('fill', d => d.ret >= 0 ? '#4caf50' : '#a1887f');

        // Zero line
        barG.append('line')
            .attr('x1', barScale(0)).attr('x2', barScale(0))
            .attr('y1', 0).attr('y2', matrixSize)
            .attr('stroke', '#999').attr('stroke-width', 0.5);

        // ──────────────────────────────────────
        // 5) RIGHT UPSET-STYLE DOTS — simplified business knowledge
        //    Section V-B: "UpSet plot to the right that depicts set-based
        //    business relational knowledge"
        // ──────────────────────────────────────
        const upsetG = svg.append('g')
            .attr('transform', `translate(${MARGIN.left + barW + 8 + matrixSize + 8}, ${MARGIN.top})`);

        // Simulate 5 knowledge categories
        const nCats = 5;
        const dotR = Math.max(1, cellSize * 0.3);
        const catSpacing = upsetW / (nCats + 1);

        // Category headers
        const catLabels = ['Loc', 'Inv', 'Ind', 'Con', 'Mgr'];
        if (cellSize >= 3) {
            catLabels.forEach((label, c) => {
                upsetG.append('text')
                    .attr('x', (c + 1) * catSpacing)
                    .attr('y', -5)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '7px')
                    .attr('fill', '#888')
                    .text(label);
            });
        }

        // Dots: each stock has random membership in each category
        for (let i = 0; i < n; i++) {
            for (let c = 0; c < nCats; c++) {
                // Deterministic pseudo-random: stock i belongs to category c?
                const hash = Math.sin(i * 127.1 + c * 311.7) * 43758.5453;
                const belongs = (hash - Math.floor(hash)) > 0.5;

                upsetG.append('circle')
                    .attr('class', 'upset-dot')
                    .attr('cx', (c + 1) * catSpacing)
                    .attr('cy', i * cellSize + cellSize / 2)
                    .attr('r', dotR)
                    .attr('fill', belongs ? '#333' : '#ddd')
                    .attr('pointer-events', 'none');
            }
        }

        // Connecting lines for shared memberships (every 3rd stock)
        if (cellSize >= 3) {
            for (let i = 0; i < n; i += 3) {
                const activeCats = [];
                for (let c = 0; c < nCats; c++) {
                    const hash = Math.sin(i * 127.1 + c * 311.7) * 43758.5453;
                    if ((hash - Math.floor(hash)) > 0.5) activeCats.push(c);
                }
                if (activeCats.length >= 2) {
                    upsetG.append('line')
                        .attr('class', 'upset-line')
                        .attr('x1', (activeCats[0] + 1) * catSpacing)
                        .attr('x2', (activeCats[activeCats.length - 1] + 1) * catSpacing)
                        .attr('y1', i * cellSize + cellSize / 2)
                        .attr('y2', i * cellSize + cellSize / 2)
                        .attr('stroke', '#333')
                        .attr('stroke-width', 0.5)
                        .attr('pointer-events', 'none');
                }
            }
        }

        // ──────────────────────────────────────
        // 6) TICK LABELS (if space allows)
        // ──────────────────────────────────────
        if (cellSize >= 4 && n <= 80) {
            g.selectAll('text.tick-left')
                .data(tickers)
                .enter()
                .append('text')
                .attr('class', 'tick-left')
                .attr('x', -3)
                .attr('y', (d, i) => i * cellSize + cellSize / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', Math.min(9, cellSize) + 'px')
                .attr('fill', '#555')
                .text(d => d)
                .on('click', (event, d) => {
                    console.log(`MatrixEnriched: Clicked label ${d}`);
                    if (options.onLabelClick) options.onLabelClick(d);
                });

            g.selectAll('text.tick-top')
                .data(tickers)
                .enter()
                .append('text')
                .attr('class', 'tick-top')
                .attr('x', (d, i) => i * cellSize + cellSize / 2)
                .attr('y', -3)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', Math.min(9, cellSize) + 'px')
                .attr('fill', '#555')
                .attr('transform', (d, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, -3)`)
                .text(d => d)
                .on('click', (event, d) => {
                    console.log(`MatrixEnriched: Clicked label ${d}`);
                    if (options.onLabelClick) options.onLabelClick(d);
                });
        }

        const t_render_end = performance.now();

        // Count all SVG elements created
        const svgElCount = container.querySelectorAll('rect, circle, path, line, text').length;

        return {
            n: n,
            tickers: tickers,
            loadTime: t_load_end - t_load_start,
            renderTime: t_render_end - t_render_start,
            svgElements: svgElCount,
            svg: g
        };
    }

    // ─── Brush benchmark (reuses the existing logic) ──────────────

    function measureBrush(containerId, n) {
        return new Promise((resolve) => {
            const svg = d3.select(`#${containerId} svg g`);
            const rects = svg.selectAll('rect.cell');
            const total = rects.size();
            if (total === 0) { resolve({ p50: 0, p95: 0, fps: 0 }); return; }

            const samples = Math.min(60, n);
            const latencies = [];
            const stamps = [];
            let i = 0;

            function next() {
                if (i >= samples) {
                    latencies.sort((a, b) => a - b);
                    const fps = stamps.length > 1
                        ? 1000 / ((stamps[stamps.length - 1] - stamps[0]) / (stamps.length - 1))
                        : 0;
                    resolve({
                        p50: latencies[Math.floor(latencies.length * 0.5)],
                        p95: latencies[Math.floor(latencies.length * 0.95)],
                        fps: Math.round(fps),
                    });
                    return;
                }
                const row = i % n;
                const t0 = performance.now();
                rects.attr('opacity', d => d.row === row ? 1 : 0.2);
                requestAnimationFrame(() => {
                    const t1 = performance.now();
                    latencies.push(t1 - t0);
                    stamps.push(t1);
                    i++;
                    setTimeout(next, 0);
                });
            }
            next();
        });
    }

    return { render, measureBrush };
})();
