// CS524 canvas working copy: prism renderer
console.log("[CS524] prism-canvas.js loaded");

const PrismCanvas = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';
    const MIN_WINDOW = 5;

    const corrColor = d3.scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdYlGn);

    let returnsData = null;
    let tickerIndex = {};
    const renderStates = new Map();

    async function ensureReturnsLoaded() {
        if (returnsData) return returnsData;

        const resp = await fetch(`${DATA_BASE}returns_all.json`);
        if (!resp.ok) throw new Error(`Failed to load returns_all.json: HTTP ${resp.status}`);
        returnsData = await resp.json();

        tickerIndex = {};
        returnsData.tickers.forEach((t, i) => { tickerIndex[t] = i; });

        console.log(
            `PrismCanvas: Returns loaded: ${returnsData.tickers.length} tickers, years: [${Object.keys(returnsData.years).join(', ')}]`
        );

        return returnsData;
    }

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

    function computePrismGrid(tickerA, tickerB, year) {
        const yearStr = String(year);
        if (!returnsData || !returnsData.years[yearStr]) {
            console.warn(`PrismCanvas: No returns data for year ${year}`);
            return null;
        }

        const idxA = tickerIndex[tickerA];
        const idxB = tickerIndex[tickerB];

        if (idxA === undefined || idxB === undefined) {
            console.warn(`PrismCanvas: Ticker not found: ${tickerA} or ${tickerB}`);
            return null;
        }

        const yearData = returnsData.years[yearStr];
        const rA = yearData.returns[idxA];
        const rB = yearData.returns[idxB];
        const T = yearData.T;

        if (!rA || !rB) return null;

        const t0 = performance.now();
        const cells = [];
        const cellMap = new Map();

        for (let e = MIN_WINDOW; e < T; e++) {
            for (let w = MIN_WINDOW; w <= e; w++) {
                const start = e - w;
                const corr = pearsonCorr(rA, rB, start, e);
                const value = Math.round(corr * 10000) / 10000;
                const cell = { e, w, value };
                cells.push(cell);
                cellMap.set(`${e}|${w}`, cell);
            }
        }

        const computeTime = performance.now() - t0;

        return {
            tickerA,
            tickerB,
            year,
            T,
            cells,
            cellMap,
            computeTime,
            dates: yearData.dates,
            validCells: cells.length,
        };
    }

    function createHiDPICanvas(width, height) {
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.imageSmoothingEnabled = false;

        return { canvas, ctx, ratio };
    }

    function renderStaticBase(state, targetCtx) {
        const {
            totalW, totalH, plotX, plotY, plotW, plotH,
            cells, cellSize, tickerA, tickerB
        } = state;

        targetCtx.clearRect(0, 0, totalW, totalH);
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(0, 0, totalW, totalH);

        for (const d of cells) {
            const x = plotX + d.e * cellSize;
            const y = plotY + d.w * cellSize;
            targetCtx.fillStyle = corrColor(d.value);
            targetCtx.fillRect(x, y, cellSize, cellSize);
        }

        targetCtx.strokeStyle = '#999';
        targetCtx.lineWidth = 0.5;
        targetCtx.strokeRect(plotX + 0.5, plotY + 0.5, plotW, plotH);

        targetCtx.fillStyle = '#888';
        targetCtx.font = '9px sans-serif';
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'top';
        targetCtx.fillText('End day (e) →', plotX + plotW / 2, plotY + plotH + 8);

        targetCtx.save();
        targetCtx.translate(plotX - 24, plotY + plotH / 2);
        targetCtx.rotate(-Math.PI / 2);
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'top';
        targetCtx.fillText('Window (w) ↓', 0, 0);
        targetCtx.restore();

        targetCtx.fillStyle = '#666';
        targetCtx.font = '10px sans-serif';
        targetCtx.textAlign = 'left';
        targetCtx.textBaseline = 'top';
        targetCtx.fillText(`${tickerA} × ${tickerB}`, plotX, 4);
    }

    function drawScene(state) {
        const {
            ctx, totalW, totalH, staticCanvas, ratio,
            plotX, plotY, plotW, plotH, cellSize, T, highlightE
        } = state;

        ctx.clearRect(0, 0, totalW, totalH);
        ctx.drawImage(staticCanvas, 0, 0, staticCanvas.width, staticCanvas.height, 0, 0, totalW, totalH);

        if (highlightE == null) return;

        ctx.save();

        // Dim whole prism plotting area
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(plotX, plotY, plotW, plotH);

        // Restore only the highlighted end-day column slice
        const colX = plotX + highlightE * cellSize;
        ctx.drawImage(
            staticCanvas,
            Math.round(colX * ratio),
            Math.round(plotY * ratio),
            Math.max(1, Math.round(cellSize * ratio)),
            Math.round(plotH * ratio),
            colX,
            plotY,
            cellSize,
            plotH
        );

        ctx.restore();
    }

    function attachCanvasEvents(state) {
        const {
            canvas, tooltip, plotX, plotY, plotW, plotH, cellSize, T,
            cellMap, tickerA, tickerB, dates
        } = state;

        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (
                x >= plotX && x < plotX + plotW &&
                y >= plotY && y < plotY + plotH
            ) {
                const e = Math.floor((x - plotX) / cellSize);
                const w = Math.floor((y - plotY) / cellSize);

                if (e >= MIN_WINDOW && e < T && w >= MIN_WINDOW && w <= e) {
                    const cell = cellMap.get(`${e}|${w}`);
                    if (cell) {
                        const startDay = e - w;
                        tooltip.style.display = 'block';
                        tooltip.style.left = `${event.pageX + 10}px`;
                        tooltip.style.top = `${event.pageY - 20}px`;
                        tooltip.textContent =
                            `${tickerA}×${tickerB} | e=${e} w=${w} | ` +
                            `[${dates[startDay] || '?'} → ${dates[e] || '?'}] | r=${cell.value.toFixed(3)}`;
                        return;
                    }
                }
            }

            tooltip.style.display = 'none';
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    function renderPrism(containerId, prismResult, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !prismResult) return null;

        container.innerHTML = '';

        const tooltip = document.getElementById('tooltip');
        const maxW = options.maxWidth || 380;

        const { cells, cellMap, T, tickerA, tickerB, dates } = prismResult;

        const cellSize = Math.max(1, Math.min(3, Math.floor(maxW / Math.max(1, T))));
        const plotW = T * cellSize;
        const plotH = T * cellSize;
        const margin = { top: 20, right: 10, bottom: 25, left: 35 };
        const totalW = plotW + margin.left + margin.right;
        const totalH = plotH + margin.top + margin.bottom;

        const tRenderStart = performance.now();

        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = `${totalW}px`;
        wrapper.style.height = `${totalH}px`;
        wrapper.style.userSelect = 'none';

        const mainCanvas = createHiDPICanvas(totalW, totalH);
        const staticLayer = createHiDPICanvas(totalW, totalH);

        wrapper.appendChild(mainCanvas.canvas);
        container.appendChild(wrapper);

        const state = {
            containerId,
            container,
            wrapper,
            canvas: mainCanvas.canvas,
            ctx: mainCanvas.ctx,
            ratio: mainCanvas.ratio,
            staticCanvas: staticLayer.canvas,
            staticCtx: staticLayer.ctx,
            tooltip,
            cells,
            cellMap,
            T,
            tickerA,
            tickerB,
            dates,
            cellSize,
            plotX: margin.left,
            plotY: margin.top,
            plotW,
            plotH,
            totalW,
            totalH,
            highlightE: null,
        };

        renderStaticBase(state, state.staticCtx);
        drawScene(state);
        attachCanvasEvents(state);
        renderStates.set(containerId, state);

        const tRenderEnd = performance.now();
        const domElements = container.querySelectorAll('canvas').length;

        return {
            tickerA,
            tickerB,
            T,
            validCells: cells.length,
            computeTime: prismResult.computeTime,
            renderTime: tRenderEnd - tRenderStart,
            domElements,
            canvas: mainCanvas.canvas
        };
    }

    async function computeAndRender(containerId, tickerA, tickerB, year, options) {
        await ensureReturnsLoaded();
        const grid = computePrismGrid(tickerA, tickerB, year);
        if (!grid) return null;
        return renderPrism(containerId, grid, options);
    }

    function measureBrush(containerId, T) {
        return new Promise((resolve) => {
            const state = renderStates.get(containerId);
            if (!state) {
                resolve({ p50: 0, p95: 0, fps: 0 });
                return;
            }

            const samples = Math.min(50, T);
            const latencies = [];
            const stamps = [];
            let i = 0;
            const originalHighlight = state.highlightE;

            function next() {
                if (i >= samples) {
                    state.highlightE = originalHighlight;
                    drawScene(state);

                    latencies.sort((a, b) => a - b);
                    const fps = stamps.length > 1
                        ? 1000 / ((stamps[stamps.length - 1] - stamps[0]) / (stamps.length - 1))
                        : 0;

                    resolve({
                        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
                        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
                        fps: Math.round(fps || 0),
                    });
                    return;
                }

                const eTarget = Math.floor(Math.random() * T);
                const t0 = performance.now();
                state.highlightE = eTarget;
                drawScene(state);

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

window.PrismCanvas = PrismCanvas;
window.PrismDynamic = PrismCanvas;