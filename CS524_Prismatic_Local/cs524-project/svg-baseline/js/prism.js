/**
 * SVG Baseline — Prism (e,w) Time Series Renderer
 *
 * Paper-faithful axes:
 *   x-axis = end day (e)
 *   y-axis = window size (w), increasing downward
 *
 * One <rect> per valid (e,w) cell.
 * Triangle shape: valid when w <= e and w >= MIN_WINDOW.
 */

const DATA_BASE = '../data/processed/';
const CELL_SIZE = 3;
const MIN_CELL_SIZE = 1;
const MARGIN = { top: 40, right: 20, bottom: 40, left: 60 };

const colorScale = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateRdYlGn);

function now() {
    return performance.now();
}

// ─── Hover latency measurement ────────────────────────────────

function measurePrismHoverLatency(svg) {
    return new Promise((resolve) => {
        const rects = svg.selectAll('rect.prism-cell');
        const total = rects.size();
        if (total === 0) { resolve({ p50: 0, p95: 0 }); return; }

        const samples = Math.min(300, total);
        const nodes = rects.nodes();
        const latencies = [];

        let i = 0;
        function next() {
            if (i >= samples) {
                latencies.sort((a, b) => a - b);
                resolve({
                    p50: latencies[Math.floor(latencies.length * 0.5)],
                    p95: latencies[Math.floor(latencies.length * 0.95)],
                });
                return;
            }

            const idx = Math.floor(Math.random() * total);
            const node = nodes[idx];
            const t0 = now();
            node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            requestAnimationFrame(() => {
                const t1 = now();
                latencies.push(t1 - t0);
                node.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
                i++;
                setTimeout(next, 0);
            });
        }
        next();
    });
}

// ─── Brush: simulate vertical sweep across e values ───────────

function measurePrismBrushLatency(svg, T) {
    return new Promise((resolve) => {
        const rects = svg.selectAll('rect.prism-cell');
        if (rects.size() === 0) { resolve({ p50: 0, p95: 0, fps: 0 }); return; }

        const samples = Math.min(100, T);
        const latencies = [];
        const frameTimestamps = [];

        let i = 0;
        function next() {
            if (i >= samples) {
                latencies.sort((a, b) => a - b);
                const fps = frameTimestamps.length > 1
                    ? 1000 / ((frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0]) / (frameTimestamps.length - 1))
                    : 0;
                resolve({
                    p50: latencies[Math.floor(latencies.length * 0.5)],
                    p95: latencies[Math.floor(latencies.length * 0.95)],
                    fps: Math.round(fps),
                });
                return;
            }

            const eTarget = Math.floor(Math.random() * T);
            const t0 = now();

            // Highlight column (all cells at this e value)
            rects.attr('opacity', d => d.e === eTarget ? 1 : 0.15);

            requestAnimationFrame(() => {
                const t1 = now();
                latencies.push(t1 - t0);
                frameTimestamps.push(t1);
                i++;
                setTimeout(next, 0);
            });
        }
        next();
    });
}

// ─── Rendering ────────────────────────────────────────────────

async function loadAndRender(pair) {
    const metricsEl = document.getElementById('metrics');
    const container = document.getElementById('chart-container');
    const tooltip = document.getElementById('tooltip');

    const [tickerA, tickerB] = pair.split('_');
    metricsEl.textContent = `Loading Prism for ${tickerA} vs ${tickerB}...`;
    container.innerHTML = '';

    // 1. Load
    const t_load_start = now();
    const url = `${DATA_BASE}prism_pair_${tickerA}_${tickerB}_2020.json`;
    let data;
    try {
        const resp = await fetch(url);
        data = await resp.json();
    } catch (e) {
        metricsEl.textContent = `ERROR: Could not load ${url}\n${e.message}`;
        return;
    }
    const t_load_end = now();

    const T = data.T;
    const minW = data.min_window;
    const dense = data.grid_dense;   // dense[w][e], null for invalid
    const dates = data.dates;
    const validCells = data.num_valid_cells;

    // 2. Cell size
    const cellSize = Math.max(MIN_CELL_SIZE, Math.min(CELL_SIZE, Math.floor(800 / T)));

    // 3. Build cell array
    const cells = [];
    for (let w = minW; w < T; w++) {
        for (let e = w; e < T; e++) {
            const val = dense[w] && dense[w][e];
            if (val !== null && val !== undefined) {
                cells.push({ e, w, value: val });
            }
        }
    }

    // 4. SVG
    const plotW = T * cellSize;
    const plotH = T * cellSize;
    const width = plotW + MARGIN.left + MARGIN.right;
    const height = plotH + MARGIN.top + MARGIN.bottom;

    const t_render_start = now();

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // 5. Draw cells
    svg.selectAll('rect.prism-cell')
        .data(cells)
        .enter()
        .append('rect')
        .attr('class', 'prism-cell')
        .attr('x', d => d.e * cellSize)
        .attr('y', d => d.w * cellSize)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')
        .on('mouseover', function (event, d) {
            tooltip.style.display = 'block';
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 20) + 'px';
            const startDay = d.e - d.w;
            const startDate = dates[startDay] || '?';
            const endDate = dates[d.e] || '?';
            tooltip.textContent =
                `e=${d.e} w=${d.w} | [${startDate} → ${endDate}] | corr=${d.value.toFixed(4)}`;
        })
        .on('mouseout', function () {
            tooltip.style.display = 'none';
        });

    // 6. Axes labels
    svg.append('text')
        .attr('x', plotW / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text(`Prism: ${tickerA} vs ${tickerB} (2020)  —  x=end day, y=window size`);

    svg.append('text')
        .attr('x', plotW / 2)
        .attr('y', plotH + 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .text('End day (e) →');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -plotH / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .text('Window size (w) ↓');

    const t_render_end = now();

    const domCount = container.querySelectorAll('rect').length;
    const loadTime = t_load_end - t_load_start;
    const ttfv = t_render_end - t_render_start;

    metricsEl.textContent =
        `T = ${T} trading days  |  Valid cells = ${cells.length}  |  DOM rects = ${domCount}\n` +
        `Data load:     ${loadTime.toFixed(1)} ms\n` +
        `TTFV (render): ${ttfv.toFixed(1)} ms\n` +
        `\nClick "Run Benchmark" for hover/brush latency.`;

    return { svg, T, ttfv, loadTime, domCount, validCells: cells.length };
}

async function runBenchmark() {
    const pair = document.getElementById('select-pair').value;
    const metricsEl = document.getElementById('metrics');

    metricsEl.textContent = `Running Prism benchmark...\n`;

    const result = await loadAndRender(pair);
    if (!result) return;

    metricsEl.textContent += `\nMeasuring hover latency...`;
    const hoverStats = await measurePrismHoverLatency(
        d3.select('#chart-container svg g')
    );

    d3.select('#chart-container svg g').selectAll('rect.prism-cell').attr('opacity', 1);
    metricsEl.textContent += `\nMeasuring brush latency...`;
    const brushStats = await measurePrismBrushLatency(
        d3.select('#chart-container svg g'), result.T
    );
    d3.select('#chart-container svg g').selectAll('rect.prism-cell').attr('opacity', 1);

    const report =
        `═══════════════════════════════════════════\n` +
        `  BENCHMARK RESULTS — Prism Time Series\n` +
        `═══════════════════════════════════════════\n` +
        `T (trading days) = ${result.T}\n` +
        `Valid cells      = ${result.validCells}\n` +
        `DOM rects        = ${result.domCount}\n` +
        `─────────────────────────────────────────\n` +
        `Data load        = ${result.loadTime.toFixed(1)} ms\n` +
        `TTFV (render)    = ${result.ttfv.toFixed(1)} ms\n` +
        `─────────────────────────────────────────\n` +
        `Hover p50        = ${hoverStats.p50.toFixed(2)} ms\n` +
        `Hover p95        = ${hoverStats.p95.toFixed(2)} ms\n` +
        `─────────────────────────────────────────\n` +
        `Brush p50        = ${brushStats.p50.toFixed(2)} ms\n` +
        `Brush p95        = ${brushStats.p95.toFixed(2)} ms\n` +
        `Brush FPS        ≈ ${brushStats.fps}\n` +
        `═══════════════════════════════════════════\n`;

    metricsEl.textContent = report;
}

// ─── Event handlers ───────────────────────────────────────────

document.getElementById('btn-render').addEventListener('click', () => {
    loadAndRender(document.getElementById('select-pair').value);
});

document.getElementById('btn-benchmark').addEventListener('click', runBenchmark);

loadAndRender(document.getElementById('select-pair').value);
