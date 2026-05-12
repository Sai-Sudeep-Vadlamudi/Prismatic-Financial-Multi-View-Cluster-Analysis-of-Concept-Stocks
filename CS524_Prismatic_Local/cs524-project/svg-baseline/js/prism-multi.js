/**
 * Multi-Prism Renderer
 *
 * Identical rendering logic to your original prism.js, but packaged as
 * a reusable function that can be called multiple times on different
 * containers with different data files.
 */

const PrismMulti = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';

    const corrColor = d3.scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdYlGn);

    async function render(containerId, tickerA, tickerB, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        container.innerHTML = '';

        const tooltip = document.getElementById('tooltip');
        const maxW = options.maxWidth || 380;

        const url = `${DATA_BASE}prism_pair_${tickerA}_${tickerB}_2020.json`;

        const t_load_start = performance.now();
        let data;
        try {
            const resp = await fetch(url);
            data = await resp.json();
        } catch (e) {
            container.textContent = `Error: ${tickerA}_${tickerB} not found`;
            return null;
        }
        const t_load_end = performance.now();

        const T = data.T;
        const minW = data.min_window;
        const dense = data.grid_dense;
        const dates = data.dates;

        const cellSize = Math.max(1, Math.min(3, Math.floor(maxW / T)));
        const plotW = T * cellSize;
        const plotH = T * cellSize;
        const margin = { top: 20, right: 10, bottom: 25, left: 35 };

        // Build cells
        const cells = [];
        for (let w = minW; w < T; w++) {
            for (let e = w; e < T; e++) {
                const val = dense[w] && dense[w][e];
                if (val !== null && val !== undefined) {
                    cells.push({ e, w, value: val });
                }
            }
        }

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
                    `${tickerA}×${tickerB} | e=${d.e} w=${d.w} | [${dates[startDay] || '?'} → ${dates[d.e] || '?'}] | r=${d.value.toFixed(3)}`;
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
            tickerA, tickerB,
            T, validCells: cells.length,
            loadTime: t_load_end - t_load_start,
            renderTime: t_render_end - t_render_start,
            svgElements: svgElCount
        };
    }

    // Brush benchmark for a single prism container
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

    return { render, measureBrush };
})();
