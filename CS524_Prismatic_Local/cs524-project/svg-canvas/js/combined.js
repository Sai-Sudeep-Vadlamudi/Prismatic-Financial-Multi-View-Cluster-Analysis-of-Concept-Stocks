/**
 * Combined Orchestrator — Prismatic Workflow
 *
 * State machine:
 *   INIT → [load data] → READY
 *   READY → [user enters tickers + threshold, clicks Generate] → CLUSTERS_SHOWN
 *   CLUSTERS_SHOWN → [user clicks year row] → MATRIX_SHOWN
 *   MATRIX_SHOWN → [user clicks cell (i,j)] → PRISM_SHOWN
 *   MATRIX_SHOWN → [user clicks stock label] → KNOWLEDGE_SHOWN
 */

(function () {
    'use strict';

    // ─── Application State ─────────────────────────────────────────

    const state = {
        phase: 'INIT',                // Current workflow phase
        selectedYear: null,           // Year selected in Network View
        clusterTickers: [],           // Tickers in the selected cluster
        matrixResult: null,           // Result from matrix rendering
        selectedCellPair: null,       // [tickerI, tickerJ] from matrix click
        selectedLabelTicker: null,    // Ticker from label click
    };

    // ─── DOM References ────────────────────────────────────────────

    const els = {
        status: () => document.getElementById('status-bar'),
        domCounter: () => document.getElementById('dom-counter'),
        metrics: () => document.getElementById('metrics'),
        matrixStatus: () => document.getElementById('matrix-status'),
        knowledgeStatus: () => document.getElementById('knowledge-status'),
        prismStatus: () => document.getElementById('prism-status'),
        btnGenerate: () => document.getElementById('btn-generate'),
        btnBenchmark: () => document.getElementById('btn-benchmark'),
        inputTickers: () => document.getElementById('input-tickers'),
        inputThreshold: () => document.getElementById('input-threshold'),
        thresholdValue: () => document.getElementById('threshold-value'),
    };

    function setStatus(msg) {
        const el = els.status();
        if (el) el.textContent = msg;
    }

    function updateDOMCounter() {
        const count = document.querySelectorAll(
            'svg rect, svg circle, svg path, svg line, svg text, svg g'
        ).length;
        const el = els.domCounter();
        if (el) el.textContent = `SVG DOM: ${count.toLocaleString()}`;
        return count;
    }

    function appendMetrics(text) {
        const el = els.metrics();
        if (el) el.textContent += text;
    }

    // ─── Parse must-have tickers from input ────────────────────────

    function parseMustHaveTickers() {
        const raw = els.inputTickers().value;
        return raw.split(/[,;\s]+/)
            .map(t => t.trim().toUpperCase())
            .filter(t => t.length > 0);
    }

    // ─── Find market proxy and sector peer ─────────────────────────

    function findMarketProxy(clusterTickers, allTickers) {
        // SPY is ideal but it's an ETF, not in S&P 500 returns
        // Use the most common large-cap as proxy — pick one NOT in the cluster
        const candidates = ['SPY', 'VOO', 'IVV', 'XLK', 'QQQ'];
        for (const c of candidates) {
            if (allTickers.includes(c) && !clusterTickers.includes(c)) return c;
        }
        // Fallback: pick any ticker not in cluster
        for (const t of allTickers) {
            if (!clusterTickers.includes(t)) return t;
        }
        return allTickers[0];
    }

    function findSectorPeer(ticker, clusterTickers) {
        // Use metadata to find a stock in the same sector but NOT the same ticker
        const returnsData = PrismDynamic.getReturnsData();
        const metaData = KnowledgeView._metadataCache || null;

        if (!returnsData) return clusterTickers.find(t => t !== ticker) || ticker;

        // If we don't have metadata yet, just pick a different cluster member
        if (!metaData || !metaData.metadata || !metaData.metadata[ticker]) {
            return clusterTickers.find(t => t !== ticker) || ticker;
        }

        const selectedSector = metaData.metadata[ticker].sector;

        // First try: same sector, in cluster, different ticker
        for (const t of clusterTickers) {
            if (t !== ticker && metaData.metadata[t] &&
                metaData.metadata[t].sector === selectedSector) {
                return t;
            }
        }

        // Second try: same sector, any ticker with returns data
        for (const t of returnsData.tickers) {
            if (t !== ticker && metaData.metadata[t] &&
                metaData.metadata[t].sector === selectedSector) {
                return t;
            }
        }

        // Last resort
        return clusterTickers.find(t => t !== ticker) || ticker;
    }

    // ─── Workflow: Step 1 — Generate Clusters ──────────────────────

    async function onGenerateClusters() {
        try {
            const mustHave = parseMustHaveTickers();
            const threshold = parseFloat(els.inputThreshold().value);

            if (mustHave.length === 0) {
                setStatus('Enter at least one ticker.');
                return;
            }

            setStatus(`Generating clusters for [${mustHave.join(', ')}] @ threshold ${threshold}...`);
            els.metrics().textContent = '';

            // Clear downstream views
            const matrixContainer = document.getElementById('matrix-container');
            const knowledgeContainer = document.getElementById('knowledge-container');
            if (matrixContainer) matrixContainer.innerHTML = '';
            if (knowledgeContainer) knowledgeContainer.innerHTML = '';
            ['prism-d1', 'prism-d2', 'prism-d3'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });

            if (els.matrixStatus()) els.matrixStatus().textContent = 'Select a year row in the Network View →';
            if (els.knowledgeStatus()) els.knowledgeStatus().textContent = 'Click a stock label in the Matrix →';
            if (els.prismStatus()) els.prismStatus().textContent = 'Click a cell (i, j) in the Matrix →';

            state.phase = 'GENERATING';
            state.selectedYear = null;
            state.clusterTickers = [];

            // Generate clusters across all available years
            console.log('Calling NetworkView.generateClusters...');
            const results = await NetworkView.generateClusters(mustHave, threshold, setStatus);
            console.log('Clusters generated:', results);

            // Render the Network View
            setStatus('Rendering Network View...');
            const networkResult = NetworkView.render('network-container', mustHave, threshold, {
                onYearSelect: onYearSelected,
            });

            state.phase = 'CLUSTERS_SHOWN';
            updateDOMCounter();
            setStatus(`Clusters generated. Click a year row to see the correlation matrix.`);
            if (els.btnBenchmark()) els.btnBenchmark().disabled = false;

            // Log results
            let report = '═══ CLUSTER GENERATION ═══\n';
            report += `Must-have: [${mustHave.join(', ')}]\n`;
            report += `Threshold: ${threshold}\n`;
            for (const [year, result] of Object.entries(results)) {
                if (result.error) {
                    report += `  ${year}: ERROR - ${result.error}\n`;
                } else {
                    report += `  ${year}: ${result.clusterTickers.length} stocks in cluster, ` +
                        `${result.components.length} components\n`;
                }
            }
            report += `Network View: ${networkResult.elCount} SVG elements\n`;
            appendMetrics(report);
        } catch (e) {
            console.error('Error in onGenerateClusters:', e);
            setStatus(`Error: ${e.message}`);
            appendMetrics(`\nERROR: ${e.message}\n${e.stack}`);
        }
    }

    // ─── Workflow: Step 2 — Year Selected → Correlation Matrix ─────

    async function onYearSelected(year, clusterTickers) {
        state.selectedYear = year;
        state.clusterTickers = clusterTickers;

        if (clusterTickers.length === 0) {
            els.matrixStatus().textContent = `No cluster found for ${year}.`;
            return;
        }

        if (clusterTickers.length > 500) {
            els.matrixStatus().textContent = `Cluster too large (${clusterTickers.length}). Increase threshold.`;
            return;
        }

        setStatus(`Rendering ${clusterTickers.length}×${clusterTickers.length} matrix for ${year}...`);
        els.matrixStatus().textContent = `Loading ${year} cluster (${clusterTickers.length} stocks)...`;

        // Get the full correlation data for this year
        const allCorrData = NetworkView.getCorrelationData();
        const corrData = allCorrData[year];

        console.log(`onYearSelected: year=${year} (${typeof year})`);
        console.log('correlationData keys:', Object.keys(allCorrData));
        console.log('corrData found:', !!corrData);
        if (corrData) {
            console.log('corrData.matrix size:', corrData.matrix.length);
        }

        // Render the matrix with dynamic data
        state.matrixResult = await MatrixEnriched.render('matrix-container', clusterTickers.length, {
            clusterTickers: clusterTickers,
            fullCorrData: corrData,
            maxWidth: 500,
            onCellClick: onMatrixCellClick,
            onLabelClick: onMatrixLabelClick,
        });

        state.phase = 'MATRIX_SHOWN';
        updateDOMCounter();

        const n = state.matrixResult ? state.matrixResult.n : 0;
        setStatus(`Matrix: ${n} stocks for ${year}. Click a cell for Prism, click a label for Knowledge Graph.`);
        els.matrixStatus().textContent = `${year}: ${n} stocks (${state.matrixResult.svgElements} SVG elements)`;

        appendMetrics(`\n═══ MATRIX (${year}) ═══\n`);
        appendMetrics(`Cluster: ${n} stocks\n`);
        appendMetrics(`Tickers: [${state.matrixResult.tickers.slice(0, 10).join(', ')}${n > 10 ? '...' : ''}]\n`);
        appendMetrics(`Load: ${state.matrixResult.loadTime.toFixed(0)}ms, Render: ${state.matrixResult.renderTime.toFixed(0)}ms\n`);
        appendMetrics(`SVG elements: ${state.matrixResult.svgElements}\n`);
    }

    // ─── Workflow: Step 3a — Cell Click → Prism Computation ────────

    async function onMatrixCellClick(tickerI, tickerJ) {
        state.selectedCellPair = [tickerI, tickerJ];
        const year = state.selectedYear;

        setStatus(`Computing Prism: ${tickerI} × ${tickerJ} (${year})...`);
        els.prismStatus().textContent = `Computing correlations for ${tickerI} × ${tickerJ}...`;

        // Also trigger Knowledge Graph for the row ticker (improves discovery)
        onMatrixLabelClick(tickerI);

        await PrismDynamic.ensureReturnsLoaded();
        const returnsData = PrismDynamic.getReturnsData();
        const allTickers = returnsData.tickers;

        const marketProxy = findMarketProxy(state.clusterTickers, allTickers);
        const sectorPeer = findSectorPeer(tickerI, state.clusterTickers);

        // Define prism configs — driven by the user's click, not hardcoded
        const prismConfigs = [
            { id: 'prism-d1', labelId: 'prism-label-d1', a: tickerI, b: marketProxy, desc: 'vs Market' },
            { id: 'prism-d2', labelId: 'prism-label-d2', a: tickerI, b: sectorPeer, desc: 'vs Sector Peer' },
            { id: 'prism-d3', labelId: 'prism-label-d3', a: tickerI, b: tickerJ, desc: 'Pairwise' },
        ];

        appendMetrics(`\n═══ PRISM (${tickerI} × ${tickerJ}) ═══\n`);

        const prismResults = [];
        for (const cfg of prismConfigs) {
            // Update label
            document.getElementById(cfg.labelId).textContent =
                `${cfg.desc}: ${cfg.a} × ${cfg.b}`;

            setStatus(`Computing ${cfg.a} × ${cfg.b}...`);
            await new Promise(r => setTimeout(r, 10)); // Let UI update

            const result = await PrismDynamic.computeAndRender(
                cfg.id, cfg.a, cfg.b, year, { maxWidth: 380 }
            );

            if (result) {
                prismResults.push(result);
                appendMetrics(`  ${cfg.a}×${cfg.b}: compute=${result.computeTime.toFixed(0)}ms ` +
                    `render=${result.renderTime.toFixed(0)}ms cells=${result.validCells}\n`);
            }
        }

        state.phase = 'PRISM_SHOWN';
        updateDOMCounter();

        const totalCompute = prismResults.reduce((s, p) => s + p.computeTime, 0);
        const totalRender = prismResults.reduce((s, p) => s + p.renderTime, 0);
        setStatus(`Prism done. Compute: ${totalCompute.toFixed(0)}ms, Render: ${totalRender.toFixed(0)}ms`);
        els.prismStatus().textContent = `${tickerI} × ${tickerJ}: ${prismResults.length} prisms rendered`;
    }

    // ─── Workflow: Step 3b — Label Click → Knowledge Graph ─────────

    async function onMatrixLabelClick(ticker) {
        state.selectedLabelTicker = ticker;

        setStatus(`Loading Knowledge Graph for ${ticker}...`);
        els.knowledgeStatus().textContent = `Loading ${ticker}...`;

        await KnowledgeView.ensureMetadataLoaded();

        // Store metadata reference for sector peer lookup
        KnowledgeView._metadataCache = await KnowledgeView.ensureMetadataLoaded();

        const result = KnowledgeView.render(
            'knowledge-container', ticker, state.clusterTickers
        );

        updateDOMCounter();
        setStatus(`Knowledge Graph: ${ticker} — ${result.elCount} SVG elements`);
        els.knowledgeStatus().textContent = `${ticker}: ${result.elCount} elements`;

        appendMetrics(`\n═══ KNOWLEDGE (${ticker}) ═══\n`);
        appendMetrics(`SVG elements: ${result.elCount}\n`);
    }

    // ─── Combined Benchmark ────────────────────────────────────────

    async function runCombinedBenchmark() {
        if (!state.matrixResult) {
            setStatus('Generate clusters and select a year first.');
            return;
        }

        setStatus('Running combined benchmark...');
        const n = state.matrixResult.n;
        const totalDOM = updateDOMCounter();

        appendMetrics(`\n═══════════════════════════════════════════════════\n`);
        appendMetrics(`  COMBINED BENCHMARK\n`);
        appendMetrics(`═══════════════════════════════════════════════════\n`);
        appendMetrics(`Matrix N           = ${n}\n`);
        appendMetrics(`Total SVG DOM      = ${totalDOM.toLocaleString()}\n`);

        // Matrix brush benchmark
        setStatus('Benchmarking matrix brush...');
        const matrixBrush = await MatrixEnriched.measureBrush('matrix-container', n);

        appendMetrics(`─────────────────────────────────────────────────\n`);
        appendMetrics(`MATRIX brush:\n`);
        appendMetrics(`  p50 = ${matrixBrush.p50.toFixed(2)} ms\n`);
        appendMetrics(`  p95 = ${matrixBrush.p95.toFixed(2)} ms\n`);
        appendMetrics(`  FPS ≈ ${matrixBrush.fps}\n`);

        // Prism brush benchmark (if prisms are rendered)
        let prismBrush = { p50: 0, p95: 0, fps: 0 };
        const prismContainer = document.querySelector('#prism-d3 svg g');
        if (prismContainer) {
            setStatus('Benchmarking prism brush...');
            const yearData = PrismDynamic.getReturnsData()?.years[String(state.selectedYear)];
            const T = yearData ? yearData.T : 253;
            prismBrush = await PrismDynamic.measureBrush('prism-d3', T);
        }

        appendMetrics(`PRISM brush:\n`);
        appendMetrics(`  p50 = ${prismBrush.p50.toFixed(2)} ms\n`);
        appendMetrics(`  p95 = ${prismBrush.p95.toFixed(2)} ms\n`);
        appendMetrics(`  FPS ≈ ${prismBrush.fps}\n`);
        appendMetrics(`═══════════════════════════════════════════════════\n`);

        // Reset opacities
        d3.selectAll('rect.cell').attr('opacity', 1);
        d3.selectAll('rect.prism-cell').attr('opacity', 1);

        setStatus(`Benchmark done. Matrix: ${matrixBrush.fps} FPS, Prism: ${prismBrush.fps} FPS`);

        // CSV for easy copy
        console.log('COMBINED_BENCHMARK_CSV:',
            [n, totalDOM,
                matrixBrush.p50.toFixed(2), matrixBrush.p95.toFixed(2), matrixBrush.fps,
                prismBrush.p50.toFixed(2), prismBrush.p95.toFixed(2), prismBrush.fps,
            ].join(',')
        );
    }

    // ─── Initialization ────────────────────────────────────────────

    async function init() {
        setStatus('Loading data...');

        try {
            // Load manifest and metadata in parallel
            await Promise.all([
                NetworkView.loadManifest(),
                KnowledgeView.ensureMetadataLoaded(),
                PrismDynamic.ensureReturnsLoaded(),
            ]);

            KnowledgeView._metadataCache = await KnowledgeView.ensureMetadataLoaded();

            state.phase = 'READY';
            setStatus('Ready. Enter tickers and click "Generate Clusters".');
        } catch (e) {
            setStatus(`Error loading data: ${e.message}`);
            console.error(e);
        }
    }

    // ─── Wire up events ────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        els.btnGenerate().addEventListener('click', onGenerateClusters);
        els.btnBenchmark().addEventListener('click', runCombinedBenchmark);

        // Threshold slider → update display
        els.inputThreshold().addEventListener('input', function () {
            els.thresholdValue().textContent = parseFloat(this.value).toFixed(2);
        });

        // Start initialization
        init();
    });

})();
