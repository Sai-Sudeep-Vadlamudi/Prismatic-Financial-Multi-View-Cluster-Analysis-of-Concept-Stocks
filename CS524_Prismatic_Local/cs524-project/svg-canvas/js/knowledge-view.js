/**
 * Knowledge Graph View — Real S&P 500 metadata
 *
 * Paper workflow (Section V-C):
 *   User clicks a stock label in the matrix
 *   → System searches multi-layer network for related stocks
 *   → Chord diagram shows 3 layers: Business, Location, Human
 *   → Inner ring nodes = stocks sharing attributes
 *   → Chords connect through center
 *
 * Our data layers (from S&P 500 metadata):
 *   Business: GICS Sector + GICS Sub-Industry
 *   Location: HQ State
 *   Human: simulated — stocks sharing both sector AND state (proxy for
 *          the paper's "shared investor/management" layer)
 */

const KnowledgeView = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';
    let metadataCache = null;

    async function ensureMetadataLoaded() {
        if (metadataCache) return metadataCache;
        const resp = await fetch(`${DATA_BASE}sp500_metadata.json`);
        metadataCache = await resp.json();
        console.log(`Metadata loaded: ${metadataCache.tickers.length} tickers`);
        return metadataCache;
    }

    /**
     * Render the chord diagram for a selected stock.
     *
     * @param containerId  DOM container ID
     * @param selectedTicker  The stock the user clicked
     * @param clusterTickers  Current cluster (highlighted in the diagram)
     */
    function render(containerId, selectedTicker, clusterTickers) {
        const container = document.getElementById(containerId);
        if (!container) return { elCount: 0 };
        container.innerHTML = '';

        console.log(`KnowledgeView.render: selected=${selectedTicker}, cluster size=${clusterTickers ? clusterTickers.length : 0}`);

        if (!metadataCache || !metadataCache.metadata) {
            container.textContent = 'Metadata not loaded.';
            return { elCount: 0 };
        }

        const meta = metadataCache.metadata;
        const selectedMeta = meta[selectedTicker];
        if (!selectedMeta) {
            container.textContent = `No metadata for ${selectedTicker}`;
            return { elCount: 0 };
        }

        // ── Find related stocks per layer ──

        const clusterSet = new Set(clusterTickers || []);

        // Business layer: same sector, same sub-industry
        const sameSector = [];
        const sameSubIndustry = [];
        for (const [t, m] of Object.entries(meta)) {
            if (t === selectedTicker) continue;
            if (m.sector === selectedMeta.sector) sameSector.push(t);
            if (m.subIndustry === selectedMeta.subIndustry) sameSubIndustry.push(t);
        }

        // Location layer: same state
        const sameState = [];
        for (const [t, m] of Object.entries(meta)) {
            if (t === selectedTicker) continue;
            if (m.hqState === selectedMeta.hqState && m.hqState !== 'Unknown') {
                sameState.push(t);
            }
        }

        // Human layer (proxy): shares BOTH sector AND state
        const sharedHuman = [];
        for (const [t, m] of Object.entries(meta)) {
            if (t === selectedTicker) continue;
            if (m.sector === selectedMeta.sector &&
                m.hqState === selectedMeta.hqState &&
                m.hqState !== 'Unknown') {
                sharedHuman.push(t);
            }
        }

        // ── Build layer structure ──

        const layers = [
            {
                name: 'Business',
                color: '#64b5f6',
                items: [
                    { label: selectedMeta.sector, tickers: sameSector.slice(0, 40) },
                    { label: selectedMeta.subIndustry.substring(0, 22), tickers: sameSubIndustry.slice(0, 25) },
                ],
            },
            {
                name: 'Location',
                color: '#81c784',
                items: [
                    { label: selectedMeta.hqState, tickers: sameState.slice(0, 35) },
                ],
            },
            {
                name: 'Human',
                color: '#e57373',
                items: [
                    { label: 'Shared Relations', tickers: sharedHuman.slice(0, 20) },
                ],
            },
        ];

        // ── Render chord diagram ──

        const size = 270;
        const cx = size / 2;
        const cy = size / 2;
        const outerR = size / 2 - 15;
        const innerR = outerR - 18;
        const midR = innerR - 5;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', size)
            .attr('height', size + 30);

        const g = svg.append('g')
            .attr('transform', `translate(${cx}, ${cy + 10})`);

        let elCount = 0;

        // Title
        svg.append('text')
            .attr('x', cx).attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px').attr('font-weight', '600').attr('fill', '#333')
            .text(`Knowledge: ${selectedTicker} (${selectedMeta.sector})`);
        elCount++;

        // Draw each layer
        const totalItems = layers.reduce((s, l) => s + l.items.length, 0);
        const sectorGap = 0.06;
        let angleOffset = 0;

        layers.forEach((layer, li) => {
            const layerAngle = (layer.items.length / totalItems) * (2 * Math.PI - sectorGap * layers.length);
            const startA = angleOffset;
            const endA = angleOffset + layerAngle;

            // Outer arc
            const arc = d3.arc().innerRadius(innerR).outerRadius(outerR)
                .startAngle(startA).endAngle(endA);
            g.append('path').attr('d', arc())
                .attr('fill', layer.color).attr('opacity', 0.6)
                .attr('stroke', '#fff').attr('stroke-width', 1.5);
            elCount++;

            // Layer label
            const midA = (startA + endA) / 2 - Math.PI / 2;
            g.append('text')
                .attr('x', (outerR + 10) * Math.cos(midA))
                .attr('y', (outerR + 10) * Math.sin(midA))
                .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
                .attr('font-size', '7px').attr('font-weight', '700')
                .attr('fill', d3.color(layer.color).darker(1))
                .text(layer.name);
            elCount++;

            // Items + nodes + chords
            const itemAngle = layerAngle / layer.items.length;

            layer.items.forEach((item, ii) => {
                const iStart = startA + ii * itemAngle + 0.01;
                const iEnd = iStart + itemAngle - 0.02;

                // Sub-arc
                const subArc = d3.arc().innerRadius(innerR - 4).outerRadius(innerR - 1)
                    .startAngle(iStart).endAngle(iEnd);
                g.append('path').attr('d', subArc())
                    .attr('fill', d3.color(layer.color).darker(0.5)).attr('stroke', 'none');
                elCount++;

                // Item label
                const labelA = (iStart + iEnd) / 2 - Math.PI / 2;
                g.append('text')
                    .attr('x', (innerR - 10) * Math.cos(labelA))
                    .attr('y', (innerR - 10) * Math.sin(labelA))
                    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
                    .attr('font-size', '5px').attr('fill', '#555')
                    .text(item.label.substring(0, 18));
                elCount++;

                // Nodes (related stocks)
                const nodeTickers = item.tickers;
                nodeTickers.forEach((ticker, ni) => {
                    const isInCluster = clusterSet.has(ticker);
                    const baseR = isInCluster
                        ? midR * 0.25 + Math.random() * midR * 0.15
                        : midR * 0.45 + Math.random() * midR * 0.35;
                    const nodeAngle = iStart + (ni / Math.max(1, nodeTickers.length - 1)) * (iEnd - iStart) - Math.PI / 2;

                    g.append('circle')
                        .attr('cx', baseR * Math.cos(nodeAngle))
                        .attr('cy', baseR * Math.sin(nodeAngle))
                        .attr('r', isInCluster ? 3 : 2)
                        .attr('fill', isInCluster ? layer.color : d3.color(layer.color).brighter(0.5))
                        .attr('stroke', isInCluster ? '#333' : 'none')
                        .attr('stroke-width', isInCluster ? 0.5 : 0)
                        .attr('opacity', isInCluster ? 0.9 : 0.4);
                    elCount++;

                    // Chord through center
                    const itemMidA = (iStart + iEnd) / 2 - Math.PI / 2;
                    const chordEndR = innerR - 3;
                    g.append('path')
                        .attr('d', `M ${baseR * Math.cos(nodeAngle)} ${baseR * Math.sin(nodeAngle)} ` +
                            `Q 0 0 ${chordEndR * Math.cos(itemMidA)} ${chordEndR * Math.sin(itemMidA)}`)
                        .attr('fill', 'none')
                        .attr('stroke', layer.color)
                        .attr('stroke-width', isInCluster ? 0.6 : 0.2)
                        .attr('opacity', isInCluster ? 0.5 : 0.1);
                    elCount++;

                    // Label for cluster members
                    if (isInCluster && nodeTickers.length <= 15) {
                        g.append('text')
                            .attr('x', (baseR + 8) * Math.cos(nodeAngle))
                            .attr('y', (baseR + 8) * Math.sin(nodeAngle))
                            .attr('text-anchor', 'middle').attr('font-size', '4px').attr('fill', '#333')
                            .text(ticker);
                        elCount++;
                    }
                });
            });

            angleOffset += layerAngle + sectorGap;
        });

        // Center node (selected stock)
        g.append('circle')
            .attr('cx', 0).attr('cy', 0).attr('r', 5)
            .attr('fill', '#0B1D3A').attr('stroke', '#fff').attr('stroke-width', 1);
        g.append('text')
            .attr('x', 0).attr('y', -9)
            .attr('text-anchor', 'middle').attr('font-size', '6px')
            .attr('font-weight', '700').attr('fill', '#0B1D3A')
            .text(selectedTicker);
        elCount += 2;

        // Legend
        layers.forEach((l, i) => {
            svg.append('rect')
                .attr('x', 10 + i * 85).attr('y', size + 15)
                .attr('width', 8).attr('height', 8)
                .attr('fill', l.color).attr('rx', 1);
            svg.append('text')
                .attr('x', 22 + i * 85).attr('y', size + 22)
                .attr('font-size', '7px').attr('fill', '#555')
                .text(l.name);
            elCount += 2;
        });

        return { elCount };
    }

    return { ensureMetadataLoaded, render };
})();
