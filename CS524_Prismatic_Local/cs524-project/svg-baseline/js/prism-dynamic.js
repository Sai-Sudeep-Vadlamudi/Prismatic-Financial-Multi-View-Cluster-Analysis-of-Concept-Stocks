/**
 * Dynamic Prism Renderer — On-the-fly computation
 *
 * Instead of loading pre-computed JSON, this computes the Prism (e,w)
 * correlation grid from raw returns data in the browser.
 *
 * Workflow:
 *   1. Browser loads returns_all.json once at startup
 *   2. User clicks cell (i,j) in the matrix
 *   3. This module computes Pearson corr for every sub-interval
 *   4. Renders the result as SVG
 */

const PrismDynamic = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';
    const MIN_WINDOW = 5;

    const corrColor = d3.scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdYlGn);

    // ─── Shared returns data (loaded once) ─────────────────────────

    let returnsData = null;   // { tickers, years: { "2020": { dates, T, returns } } }
    let tickerIndex = {};     // ticker → index in returns array

    async function ensureReturnsLoaded() {
        if (returnsData) return returnsData;

        console.log('PrismDynamic: Fetching returns_all.json...');
        const resp = await fetch(`${DATA_BASE}returns_all.json`);
        returnsData = await resp.json();

        tickerIndex = {};
        returnsData.tickers.forEach((t, i) => { tickerIndex[t] = i; });

        console.log(`PrismDynamic: Returns loaded: ${returnsData.tickers.length} tickers, ` +
            `years: [${Object.keys(returnsData.years).join(', ')}]`);
        return returnsData;
    }

    // ─── Pearson correlation (optimized, no allocation) ────────────

    function pearsonCorr(arrA, arrB, start, end) {
        const n = end - start;
        if (n < MIN_WINDOW) return 0;

        let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
        for (let i = start; i < end; i++) {
            const a = arrA[i];
            const b = arrB[i];
            sumA += a;
            sumB += b;
            sumAB += a * b;
            sumA2 += a * a;
            sumB2 += b * b;
        }

        const meanA = sumA / n;
        const meanB = sumB / n;
        const varA = sumA2 / n - meanA * meanA;
        const varB = sumB2 / n - meanB * meanB;

        if (varA < 1e-12 || varB < 1e-12) return 0;

        const cov = sumAB / n - meanA * meanB;
        const r = cov / Math.sqrt(varA * varB);

        return (r !== r) ? 0 : Math.max(-1, Math.min(1, r));
    }

    // ─── Compute full Prism grid ───────────────────────────────────

    function computePrismGrid(tickerA, tickerB, year) {
        console.log(`PrismDynamic.computePrismGrid: ${tickerA} vs ${tickerB} (${year})`);
        const yearStr = String(year);
        if (!returnsData || !returnsData.years[yearStr]) {
            console.warn(`PrismDynamic: No returns data for year ${year}. Available: ${returnsData ? Object.keys(returnsData.years) : 'none'}`);
            return null;
        }

        const idxA = tickerIndex[tickerA];
        const idxB = tickerIndex[tickerB];
        console.log(`PrismDynamic: Indices -> ${tickerA}:${idxA}, ${tickerB}:${idxB}`);

        if (idxA === undefined || idxB === undefined) {
            console.warn(`PrismDynamic: Ticker not found: ${tickerA} (${idxA}) or ${tickerB} (${idxB})`);
            return null;
        }

        const yearData = returnsData.years[yearStr];
        const rA = yearData.returns[idxA];
        const rB = yearData.returns[idxB];
        const T = yearData.T;
        console.log(`PrismDynamic: Retrieved arrays. Lengths: A=${rA ? rA.length : 'N/A'}, B=${rB ? rB.length : 'N/A'}, T=${T}`);

        if (!rA || !rB) {
            console.error(`PrismDynamic: Missing return arrays for indices ${idxA} or ${idxB}`);
            return null;
        }

        const t0 = performance.now();
        const cells = [];

        for (let e = MIN_WINDOW; e < T; e++) {
            for (let w = MIN_WINDOW; w <= e; w++) {
                const start = e - w;
                const corr = pearsonCorr(rA, rB, start, e);
                cells.push({ e, w, value: Math.round(corr * 10000) / 10000 });
            }
        }

        const computeTime = performance.now() - t0;
        console.log(`Prism ${tickerA}×${tickerB} (${year}): ${cells.length} cells in ${computeTime.toFixed(0)}ms`);

        return {
            tickerA, tickerB, year, T, cells, computeTime,
            dates: yearData.dates,
            validCells: cells.length,
        };
    }

    // ─── Render Prism SVG ──────────────────────────────────────────

    function renderPrism(containerId, prismResult, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !prismResult) return null;
        container.innerHTML = '';

        const tooltip = document.getElementById('tooltip');
        const maxW = options.maxWidth || 380;
        const { cells, T, tickerA, tickerB, dates } = prismResult;

        const cellSize = Math.max(1, Math.min(3, Math.floor(maxW / T)));
        const plotW = T * cellSize;
        const plotH = T * cellSize;
        const margin = { top: 20, right: 10, bottom: 25, left: 35 };

        const t_render_start = performance.now();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', plotW + margin.left + margin.right)
            .attr('height', plotH + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        svg.selectAll('rect.prism-cell')
            .data(cells)
            .enter()
            .append('rect')
            .attr('class', 'prism-cell')
            .attr('x', d => d.e * cellSize)
            .attr('y', d => d.w * cellSize)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', d => corrColor(d.value))
            .attr('stroke', 'none')
            .on('mouseover', function (event, d) {
                tooltip.style.display = 'block';
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 20) + 'px';
                const startDay = d.e - d.w;
                tooltip.textContent =
                    `${tickerA}×${tickerB} | e=${d.e} w=${d.w} | ` +
                    `[${dates[startDay] || '?'} → ${dates[d.e] || '?'}] | r=${d.value.toFixed(3)}`;
            })
            .on('mouseout', () => { tooltip.style.display = 'none'; });

        // Axis labels
        svg.append('text')
            .attr('x', plotW / 2).attr('y', plotH + 18)
            .attr('text-anchor', 'middle').attr('font-size', '9px').attr('fill', '#888')
            .text('End day (e) →');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -plotH / 2).attr('y', -22)
            .attr('text-anchor', 'middle').attr('font-size', '9px').attr('fill', '#888')
            .text('Window (w) ↓');

        const t_render_end = performance.now();
        const svgElCount = container.querySelectorAll('rect, text').length;

        return {
            tickerA, tickerB, T,
            validCells: cells.length,
            computeTime: prismResult.computeTime,
            renderTime: t_render_end - t_render_start,
            svgElements: svgElCount,
        };
    }

    // ─── High-level: compute + render ──────────────────────────────

    async function computeAndRender(containerId, tickerA, tickerB, year, options) {
        console.log(`PrismDynamic.computeAndRender: called for ${containerId}, ${tickerA}x${tickerB}, ${year}`);
        await ensureReturnsLoaded();
        const grid = computePrismGrid(tickerA, tickerB, year);
        if (!grid) {
            console.warn(`PrismDynamic: computePrismGrid returned null for ${tickerA}x${tickerB}`);
            return null;
        }
        return renderPrism(containerId, grid, options);
    }

    // ─── Brush benchmark ──────────────────────────────────────────

    function measureBrush(containerId, T) {
        return new Promise((resolve) => {
            const rects = d3.select(`#${containerId} svg g`).selectAll('rect.prism-cell');
            if (rects.size() === 0) { resolve({ p50: 0, p95: 0, fps: 0 }); return; }

            const samples = Math.min(50, T);
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
                const eTarget = Math.floor(Math.random() * T);
                const t0 = performance.now();
                rects.attr('opacity', d => d.e === eTarget ? 1 : 0.15);
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

    // ─── Public API ────────────────────────────────────────────────

    return {
        ensureReturnsLoaded,
        computePrismGrid,
        renderPrism,
        computeAndRender,
        measureBrush,
        getTickerIndex: () => tickerIndex,
        getReturnsData: () => returnsData,
    };
})();
