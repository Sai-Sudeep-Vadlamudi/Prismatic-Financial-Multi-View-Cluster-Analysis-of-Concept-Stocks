/**
 * SVG Baseline — Correlation Matrix Renderer
 *
 * Minimal D3/SVG implementation:
 *   - One <rect> per cell
 *   - Basic hover (tooltip)
 *   - Basic brush highlight (click row/col)
 *
 * This is a THROWAWAY prototype for bottleneck validation only.
 */

const DATA_BASE = '../data/processed/';
const CELL_SIZE = 4;        // Pixels per cell (shrinks at large N)
const MIN_CELL_SIZE = 1;    // Floor
const MARGIN = { top: 30, right: 10, bottom: 10, left: 30 };

// Color scale: brown (negative) — white (zero) — green (positive)
// Matches Prismatic paper's convention
const colorScale = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateRdYlGn);

let currentData = null;
let selectedRow = null;
let selectedCol = null;

// ─── Performance measurement helpers ──────────────────────────

function now() {
    return performance.now();
}

function measureHoverLatency(svg, n) {
    return new Promise((resolve) => {
        const rects = svg.selectAll('rect.cell');
        const total = rects.size();
        if (total === 0) { resolve(0); return; }

        const samples = Math.min(200, total);
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

            // Simulate mouseover
            node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            requestAnimationFrame(() => {
                const t1 = now();
                latencies.push(t1 - t0);

                // Simulate mouseout
                node.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
                i++;
                setTimeout(next, 0);
            });
        }
        next();
    });
}

function measureBrushLatency(svg, n) {
    return new Promise((resolve) => {
        const rects = svg.selectAll('rect.cell');
        const total = rects.size();
        if (total === 0) { resolve(0); return; }

        const samples = Math.min(100, n);
        const nodes = rects.nodes();
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

            const row = i % n;
            const t0 = now();

            // Simulate brush: highlight entire row
            svg.selectAll('rect.cell')
                .attr('opacity', d => d.row === row ? 1 : 0.2);

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

async function loadAndRender(n) {
    const metricsEl = document.getElementById('metrics');
    const container = document.getElementById('chart-container');
    const tooltip = document.getElementById('tooltip');

    metricsEl.textContent = `Loading N=${n}...`;
    container.innerHTML = '';

    // 1. Load data
    const t_load_start = now();
    const url = `${DATA_BASE}corr_matrix_2020_N${n}.json`;
    let data;
    try {
        const resp = await fetch(url);
        data = await resp.json();
    } catch (e) {
        metricsEl.textContent = `ERROR: Could not load ${url}\n${e.message}`;
        return;
    }
    const t_load_end = now();
    currentData = data;

    const matrix = data.matrix;
    const tickers = data.tickers;
    const N = tickers.length;

    // 2. Compute cell size
    const cellSize = Math.max(MIN_CELL_SIZE, Math.min(CELL_SIZE, Math.floor(600 / N)));
    const totalSize = N * cellSize;

    // 3. Create SVG
    const width = totalSize + MARGIN.left + MARGIN.right;
    const height = totalSize + MARGIN.top + MARGIN.bottom;

    const t_render_start = now();

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // 4. Draw cells — ONE RECT PER CELL (this is the bottleneck)
    const cells = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            cells.push({ row: i, col: j, value: matrix[i][j] });
        }
    }

    svg.selectAll('rect.cell')
        .data(cells)
        .enter()
        .append('rect')
        .attr('class', 'cell')
        .attr('x', d => d.col * cellSize)
        .attr('y', d => d.row * cellSize)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')
        .on('mouseover', function (event, d) {
            tooltip.style.display = 'block';
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 20) + 'px';
            tooltip.textContent = `${tickers[d.row]} × ${tickers[d.col]}: ${d.value.toFixed(4)}`;
        })
        .on('mouseout', function () {
            tooltip.style.display = 'none';
        })
        .on('click', function (event, d) {
            // Simple brush: highlight row and column
            selectedRow = d.row;
            selectedCol = d.col;
            svg.selectAll('rect.cell')
                .attr('opacity', c =>
                    (c.row === selectedRow || c.col === selectedCol) ? 1 : 0.2
                );
        });

    const t_render_end = now();

    // 5. Count DOM nodes
    const domCount = container.querySelectorAll('rect').length;

    // 6. Report metrics
    const loadTime = (t_load_end - t_load_start).toFixed(1);
    const ttfv = (t_render_end - t_render_start).toFixed(1);

    metricsEl.textContent =
        `N = ${N}  |  Cells = ${N * N}  |  DOM rects = ${domCount}\n` +
        `Data load:   ${loadTime} ms\n` +
        `TTFV (render): ${ttfv} ms\n` +
        `\nHover/brush latency: click "Run Benchmark" to measure.`;

    return { svg, N, ttfv: parseFloat(ttfv), loadTime: parseFloat(loadTime), domCount };
}

async function runBenchmark() {
    const n = parseInt(document.getElementById('select-n').value);
    const metricsEl = document.getElementById('metrics');

    metricsEl.textContent = `Running benchmark for N=${n}...\n`;

    const renderResult = await loadAndRender(n);
    if (!renderResult) return;

    metricsEl.textContent += `\nMeasuring hover latency (200 samples)...`;
    const hoverStats = await measureHoverLatency(
        d3.select('#chart-container svg g'), renderResult.N
    );

    metricsEl.textContent += `\nMeasuring brush latency (${Math.min(100, renderResult.N)} row sweeps)...`;

    // Reset opacity first
    d3.select('#chart-container svg g').selectAll('rect.cell').attr('opacity', 1);

    const brushStats = await measureBrushLatency(
        d3.select('#chart-container svg g'), renderResult.N
    );

    // Reset opacity
    d3.select('#chart-container svg g').selectAll('rect.cell').attr('opacity', 1);

    const report =
        `═══════════════════════════════════════════\n` +
        `  BENCHMARK RESULTS — Correlation Matrix\n` +
        `═══════════════════════════════════════════\n` +
        `N              = ${renderResult.N}\n` +
        `Cells (N²)     = ${renderResult.N * renderResult.N}\n` +
        `DOM rects      = ${renderResult.domCount}\n` +
        `─────────────────────────────────────────\n` +
        `Data load      = ${renderResult.loadTime.toFixed(1)} ms\n` +
        `TTFV (render)  = ${renderResult.ttfv.toFixed(1)} ms\n` +
        `─────────────────────────────────────────\n` +
        `Hover p50      = ${hoverStats.p50.toFixed(2)} ms\n` +
        `Hover p95      = ${hoverStats.p95.toFixed(2)} ms\n` +
        `─────────────────────────────────────────\n` +
        `Brush p50      = ${brushStats.p50.toFixed(2)} ms\n` +
        `Brush p95      = ${brushStats.p95.toFixed(2)} ms\n` +
        `Brush FPS      ≈ ${brushStats.fps}\n` +
        `═══════════════════════════════════════════\n`;

    metricsEl.textContent = report;

    console.log('BENCHMARK_CSV:', [
        'matrix', n, renderResult.domCount,
        renderResult.loadTime.toFixed(1),
        renderResult.ttfv.toFixed(1),
        hoverStats.p50.toFixed(2), hoverStats.p95.toFixed(2),
        brushStats.p50.toFixed(2), brushStats.p95.toFixed(2),
        brushStats.fps
    ].join(','));
}

// ─── Event handlers ───────────────────────────────────────────

document.getElementById('btn-render').addEventListener('click', () => {
    const n = parseInt(document.getElementById('select-n').value);
    loadAndRender(n);
});

document.getElementById('btn-benchmark').addEventListener('click', runBenchmark);

// Auto-render on load
loadAndRender(parseInt(document.getElementById('select-n').value));
