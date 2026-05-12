/**
 * Stub SVG Views — DOM load approximation
 *
 * These don't implement real functionality. They generate a representative
 * number of SVG elements to approximate the DOM that Prismatic's
 * Network View (A) and Knowledge Graph (C) contribute to the page.
 *
 * Purpose: prove that the combined DOM, not any single view, causes
 * the N=40 performance degradation reported in the paper.
 */

const Stubs = (function () {
    'use strict';

    /**
     * Financial Correlation Network stub (View A)
     *
     * The real view (Section V-A, Figure 3-A) shows:
     *   - 3-5 year rows, each with distribution plot + sub-network rectangles
     *   - Dots inside rectangles (cluster members)
     *   - Connection lines between years
     *   - Business tag filters at bottom
     *
     * Approximate DOM: ~1,500 - 3,000 elements
     */
    function renderNetwork(containerId, N) {
        const container = document.getElementById(containerId);
        if (!container) return 0;
        container.innerHTML = '';

        const years = [2018, 2019, 2020];
        const rowH = 80;
        const width = 200;
        const totalH = years.length * (rowH + 20) + 60;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', totalH);

        let elCount = 0;

        years.forEach((year, yi) => {
            const yOff = yi * (rowH + 20) + 20;
            const g = svg.append('g').attr('transform', `translate(10, ${yOff})`);

            // Year label
            g.append('text')
                .attr('x', 0).attr('y', -5)
                .attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#0B1D3A')
                .text(year);
            elCount++;

            // Distribution plot (area + line) — ~50 path segments
            const areaW = 60;
            const points = 30;
            let pathD = `M 0 ${rowH}`;
            for (let p = 0; p < points; p++) {
                const x = (p / points) * areaW;
                const y = rowH - Math.random() * rowH * 0.8;
                pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            }
            pathD += ` L ${areaW} ${rowH} Z`;
            g.append('path').attr('d', pathD)
                .attr('fill', 'rgba(11,29,58,0.1)').attr('stroke', '#0B1D3A')
                .attr('stroke-width', 0.5);
            elCount++;

            // Overlay lines (selected stocks' distributions)
            for (let s = 0; s < Math.min(4, N); s++) {
                let lineD = '';
                for (let p = 0; p < points; p++) {
                    const x = (p / points) * areaW;
                    const y = rowH - Math.random() * rowH * 0.7;
                    lineD += (p === 0 ? 'M' : 'L') + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
                }
                g.append('path').attr('d', lineD)
                    .attr('fill', 'none')
                    .attr('stroke', d3.schemeCategory10[s % 10])
                    .attr('stroke-width', 1);
                elCount++;
            }

            // Sub-network: bounding boxes with dots
            const nClusters = 2 + Math.floor(Math.random() * 3);
            let xOff = areaW + 15;
            for (let c = 0; c < nClusters; c++) {
                const clusterN = Math.floor(N * 0.3 + Math.random() * N * 0.4);
                const boxW = Math.max(30, clusterN * 3);
                const boxH = rowH - 10;

                // Bounding box
                g.append('rect')
                    .attr('x', xOff).attr('y', 5)
                    .attr('width', boxW).attr('height', boxH)
                    .attr('fill', 'none').attr('stroke', '#ccc').attr('stroke-width', 0.5);
                elCount++;

                // Dots (cluster members)
                for (let d = 0; d < clusterN; d++) {
                    g.append('circle')
                        .attr('cx', xOff + 5 + Math.random() * (boxW - 10))
                        .attr('cy', 10 + Math.random() * (boxH - 10))
                        .attr('r', 2)
                        .attr('fill', '#0B1D3A')
                        .attr('opacity', 0.6);
                    elCount++;
                }
                xOff += boxW + 8;
            }

            // Connection lines to previous year
            if (yi > 0) {
                const nConn = Math.min(N, 20);
                for (let c = 0; c < nConn; c++) {
                    svg.append('line')
                        .attr('x1', 10 + areaW + 20 + Math.random() * 80)
                        .attr('y1', yOff - 15)
                        .attr('x2', 10 + areaW + 20 + Math.random() * 80)
                        .attr('y2', yOff - 5)
                        .attr('stroke', '#ccc').attr('stroke-width', 0.3);
                    elCount++;
                }
            }
        });

        // Business tag filters at bottom
        const tags = ['Real Estate', 'Chemicals', 'Tech', 'Finance', 'Healthcare',
            'Energy', 'Consumer', 'Industrial', 'Telecom', 'Utilities'];
        const tagG = svg.append('g')
            .attr('transform', `translate(10, ${totalH - 40})`);
        tags.forEach((tag, ti) => {
            tagG.append('rect')
                .attr('x', (ti % 5) * 40).attr('y', Math.floor(ti / 5) * 16)
                .attr('width', 38).attr('height', 14)
                .attr('rx', 2)
                .attr('fill', '#f0f0f0').attr('stroke', '#ccc').attr('stroke-width', 0.5);
            tagG.append('text')
                .attr('x', (ti % 5) * 40 + 19).attr('y', Math.floor(ti / 5) * 16 + 10)
                .attr('text-anchor', 'middle').attr('font-size', '6px').attr('fill', '#555')
                .text(tag);
            elCount += 2;
        });

        return elCount;
    }

    /**
     * Knowledge Graph stub (View C)
     *
     * The real view (Section V-C, Figure 3-C/D) shows:
     *   - Chord diagram: 3 sectors (Human, Location, Business)
     *   - Outer ring segments (knowledge items)
     *   - Inner ring nodes (related stocks)
     *   - Chords connecting through center
     *
     * Approximate DOM: ~500 - 2,000 elements
     */
    function renderKnowledge(containerId, N) {
        const container = document.getElementById(containerId);
        if (!container) return 0;
        container.innerHTML = '';

        const size = 260;
        const cx = size / 2;
        const cy = size / 2;
        const outerR = size / 2 - 10;
        const innerR = outerR - 20;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', size)
            .attr('height', size);

        const g = svg.append('g')
            .attr('transform', `translate(${cx}, ${cy})`);

        let elCount = 0;

        // Three sectors: Human, Location, Business
        const sectors = [
            { name: 'Human', color: '#e57373', items: ['Mgr', 'Investor', 'Board'] },
            { name: 'Location', color: '#81c784', items: ['Province', 'City'] },
            { name: 'Business', color: '#64b5f6', items: ['Industry', 'Concept', 'Subsector'] },
        ];

        const totalItems = sectors.reduce((s, sec) => s + sec.items.length, 0);
        let angleOffset = 0;
        const gap = 0.02; // gap between sectors in radians

        sectors.forEach((sector) => {
            const sectorAngle = (sector.items.length / totalItems) * (2 * Math.PI - gap * sectors.length);

            // Outer ring arc for the sector
            const startA = angleOffset;
            const endA = angleOffset + sectorAngle;

            const arc = d3.arc()
                .innerRadius(innerR)
                .outerRadius(outerR)
                .startAngle(startA)
                .endAngle(endA);

            g.append('path')
                .attr('d', arc())
                .attr('fill', sector.color)
                .attr('opacity', 0.7)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            elCount++;

            // Sector label
            const midA = (startA + endA) / 2 - Math.PI / 2;
            g.append('text')
                .attr('x', (outerR + 8) * Math.cos(midA))
                .attr('y', (outerR + 8) * Math.sin(midA))
                .attr('text-anchor', 'middle')
                .attr('font-size', '8px')
                .attr('font-weight', '600')
                .attr('fill', '#333')
                .text(sector.name);
            elCount++;

            // Individual items as sub-arcs
            const itemAngle = sectorAngle / sector.items.length;
            sector.items.forEach((item, ii) => {
                const iStart = angleOffset + ii * itemAngle;
                const iEnd = iStart + itemAngle - 0.01;
                const itemArc = d3.arc()
                    .innerRadius(innerR - 3)
                    .outerRadius(innerR)
                    .startAngle(iStart)
                    .endAngle(iEnd);
                g.append('path')
                    .attr('d', itemArc())
                    .attr('fill', d3.color(sector.color).darker(0.3))
                    .attr('stroke', 'none');
                elCount++;
            });

            // Inner ring nodes (related stocks)
            const nNodes = Math.min(N, 15);
            for (let ni = 0; ni < nNodes; ni++) {
                const nodeAngle = startA + (ni / nNodes) * sectorAngle - Math.PI / 2;
                const nodeR = innerR - 15 - Math.random() * (innerR * 0.4);
                g.append('circle')
                    .attr('cx', nodeR * Math.cos(nodeAngle))
                    .attr('cy', nodeR * Math.sin(nodeAngle))
                    .attr('r', 2.5)
                    .attr('fill', sector.color)
                    .attr('opacity', 0.5)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.3);
                elCount++;
            }

            // Chords through center (connecting nodes across sectors)
            const nChords = Math.min(N, 10);
            for (let ci = 0; ci < nChords; ci++) {
                const a1 = startA + Math.random() * sectorAngle - Math.PI / 2;
                const r1 = innerR - 15 - Math.random() * (innerR * 0.3);
                // Random target in another sector
                const a2 = Math.random() * 2 * Math.PI;
                const r2 = innerR - 15 - Math.random() * (innerR * 0.3);

                g.append('path')
                    .attr('d', `M ${r1 * Math.cos(a1)} ${r1 * Math.sin(a1)} Q 0 0 ${r2 * Math.cos(a2)} ${r2 * Math.sin(a2)}`)
                    .attr('fill', 'none')
                    .attr('stroke', sector.color)
                    .attr('stroke-width', 0.4)
                    .attr('opacity', 0.25);
                elCount++;
            }

            angleOffset += sectorAngle + gap;
        });

        return elCount;
    }

    return { renderNetwork, renderKnowledge };
})();
