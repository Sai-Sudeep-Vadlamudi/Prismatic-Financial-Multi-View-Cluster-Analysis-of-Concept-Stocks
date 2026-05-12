// CS524 canvas working copy: matrix renderer
console.log("[CS524] matrix-canvas.js FIXED v6 loaded");

const MatrixCanvas = (function () {
    'use strict';

    const DATA_BASE = '../data/processed/';
    const MARGIN = { top: 30, right: 100, bottom: 14, left: 72 };
    const BAR_W = 42;
    const UPSET_W = 72;
    const GAP = 8;
    const DETAIL_SIZE = 320;
    const DETAIL_WINDOW = 24;

    const corrColor = d3.scaleDiverging()
        .domain([-1, 0, 1])
        .interpolator(d3.interpolateRdYlGn);

    const renderStates = new Map();

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function fakeMarketCorr(i) {
        const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        return (x - Math.floor(x)) * 1.6 - 0.8;
    }

    function fakeReturn(i) {
        const x = Math.sin(i * 269.5 + 183.3) * 43758.5453;
        return (x - Math.floor(x)) * 0.6 - 0.3;
    }

    function computeAccessoryLayout(n, cellSize) {
        const nCats = 5;

        const barW = n <= 40 ? clamp(cellSize * 0.72, 28, 54) : BAR_W;
        const rowPad = clamp(cellSize * 0.14, 0.5, 4);
        const barH = Math.max(1, cellSize - rowPad * 2);

        const desiredDotR = clamp(cellSize * 0.18, 1.5, 8);
        const catSpacing = Math.max(12, desiredDotR * 2 + 4);
        const upsetW = Math.max(UPSET_W, catSpacing * (nCats + 1));
        const dotR = Math.min(desiredDotR, (catSpacing - 2) / 2);

        return {
            nCats,
            barW,
            rowPad,
            barH,
            catSpacing,
            upsetW,
            dotR
        };
    }

    function subsetMatrix(fullData, subsetTickers) {
        const { matrix, tickerIndex } = fullData;
        const indices = subsetTickers.map(t => {
            const idx = tickerIndex[t];
            if (idx === undefined) console.warn(`Ticker ${t} not found in full matrix`);
            return idx !== undefined ? idx : 0;
        });

        const newMatrix = indices.map(rowIdx =>
            indices.map(colIdx => matrix[rowIdx][colIdx])
        );

        return {
            tickers: subsetTickers,
            matrix: newMatrix
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

    function drawTriangle(ctx, x, y, cellSize, corner, fill) {
        const inset = cellSize * 0.24;
        ctx.beginPath();
        if (corner === 'tr') {
            ctx.moveTo(x + cellSize - inset, y);
            ctx.lineTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + inset);
        } else {
            ctx.moveTo(x, y + cellSize - inset);
            ctx.lineTo(x, y + cellSize);
            ctx.lineTo(x + inset, y + cellSize);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }

    function drawDonutArc(ctx, cx, cy, r, value) {
        const absVal = Math.min(Math.abs(value), 1);
        const angle = absVal * 2 * Math.PI;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + angle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle, false);
        ctx.closePath();
        ctx.fillStyle = value >= 0 ? '#4caf50' : '#a1887f';
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function getFocusCell(state) {
        return state.selectedCell || state.hoverCell || null;
    }

    function drawMajorGrid(ctx, state) {
        const { n, cellSize, matrixX, matrixY, matrixSize } = state;
        if (n < 120 || cellSize > 3.2) return;

        const step = n > 300 ? 50 : 25;
        ctx.save();
        ctx.strokeStyle = 'rgba(11,29,58,0.12)';
        ctx.lineWidth = 0.75;

        for (let k = step; k < n; k += step) {
            const x = matrixX + k * cellSize;
            const y = matrixY + k * cellSize;

            ctx.beginPath();
            ctx.moveTo(x, matrixY);
            ctx.lineTo(x, matrixY + matrixSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(matrixX, y);
            ctx.lineTo(matrixX + matrixSize, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    function renderStaticBase(state, targetCtx) {
        const {
            totalW, totalH, matrix, n, cellSize, matrixSize,
            barX, matrixX, matrixY, upsetX,
            barW, rowPad, barH,
            nCats, catSpacing, dotR
        } = state;

        targetCtx.clearRect(0, 0, totalW, totalH);
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(0, 0, totalW, totalH);

        const barScale = d3.scaleLinear().domain([-0.3, 0.3]).range([0, barW]);

        for (let i = 0; i < n; i++) {
            const ret = fakeReturn(i);
            const x0 = barX + (ret >= 0 ? barScale(0) : barScale(ret));
            const w = Math.abs(barScale(ret) - barScale(0));
            const y = matrixY + i * cellSize + rowPad;

            targetCtx.fillStyle = ret >= 0 ? '#6bc06f' : '#b69a8a';
            targetCtx.fillRect(x0, y, Math.max(1, w), Math.max(1, barH));
        }

        targetCtx.strokeStyle = '#9aa5b1';
        targetCtx.lineWidth = 0.5;
        targetCtx.beginPath();
        targetCtx.moveTo(barX + barScale(0), matrixY);
        targetCtx.lineTo(barX + barScale(0), matrixY + matrixSize);
        targetCtx.stroke();

        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                const value = matrix[row][col];
                const x = matrixX + col * cellSize;
                const y = matrixY + row * cellSize;

                targetCtx.fillStyle = corrColor(value);
                targetCtx.fillRect(x, y, cellSize, cellSize);

                if (cellSize >= 4 && col > row) {
                    const darker = d3.color(corrColor(value)).darker(0.4).formatHex();
                    drawTriangle(targetCtx, x, y, cellSize, 'tr', darker);
                }
                if (cellSize >= 4 && col < row) {
                    const darker = d3.color(corrColor(value)).darker(0.4).formatHex();
                    drawTriangle(targetCtx, x, y, cellSize, 'bl', darker);
                }
            }
        }

        if (cellSize >= 5) {
            for (let i = 0; i < n; i++) {
                const cx = matrixX + i * cellSize + cellSize / 2;
                const cy = matrixY + i * cellSize + cellSize / 2;
                const r = cellSize / 2 - 0.55;
                const marketCorr = fakeMarketCorr(i);

                targetCtx.beginPath();
                targetCtx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
                targetCtx.fillStyle = '#fff';
                targetCtx.fill();
                targetCtx.strokeStyle = '#cfcfcf';
                targetCtx.lineWidth = 0.3;
                targetCtx.stroke();

                drawDonutArc(targetCtx, cx, cy, Math.max(0.5, r - 0.7), marketCorr);
            }
        }

        drawMajorGrid(targetCtx, state);

        targetCtx.save();
        targetCtx.strokeStyle = 'rgba(80,120,80,0.24)';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(matrixX, matrixY);
        targetCtx.lineTo(matrixX + matrixSize, matrixY + matrixSize);
        targetCtx.stroke();
        targetCtx.restore();

        targetCtx.strokeStyle = '#99a8a0';
        targetCtx.lineWidth = 0.65;
        targetCtx.strokeRect(matrixX + 0.5, matrixY + 0.5, matrixSize, matrixSize);

        const catLabels = ['Loc', 'Inv', 'Ind', 'Con', 'Mgr'];

        targetCtx.fillStyle = '#7a7f86';
        targetCtx.font = '7px sans-serif';
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'alphabetic';

        if (cellSize >= 3) {
            catLabels.forEach((label, c) => {
                targetCtx.fillText(label, upsetX + (c + 1) * catSpacing, matrixY - 5);
            });
        }

        for (let i = 0; i < n; i++) {
            const cy = matrixY + i * cellSize + cellSize / 2;
            const activeCats = [];

            for (let c = 0; c < nCats; c++) {
                const hash = Math.sin(i * 127.1 + c * 311.7) * 43758.5453;
                const belongs = (hash - Math.floor(hash)) > 0.5;
                const cx = upsetX + (c + 1) * catSpacing;

                if (belongs) activeCats.push(c);

                targetCtx.beginPath();
                targetCtx.arc(cx, cy, dotR, 0, Math.PI * 2);
                targetCtx.fillStyle = belongs ? '#47545f' : '#d9dee2';
                targetCtx.fill();
            }

            if (cellSize >= 3 && i % 3 === 0 && activeCats.length >= 2) {
                targetCtx.beginPath();
                targetCtx.moveTo(upsetX + (activeCats[0] + 1) * catSpacing, cy);
                targetCtx.lineTo(upsetX + (activeCats[activeCats.length - 1] + 1) * catSpacing, cy);
                targetCtx.strokeStyle = '#59656f';
                targetCtx.lineWidth = 0.5;
                targetCtx.stroke();
            }
        }

        targetCtx.fillStyle = '#666';
        targetCtx.font = '10px sans-serif';
        targetCtx.textAlign = 'left';
        targetCtx.textBaseline = 'top';
        targetCtx.fillText(`${n} stocks`, matrixX + 2, 10);
    }

    function drawScene(state) {
        const {
            ctx, totalW, totalH, staticCanvas, ratio,
            matrixX, matrixY, matrixSize, cellSize, selectedCell, benchmarkRow, hoverCell
        } = state;

        ctx.clearRect(0, 0, totalW, totalH);
        ctx.drawImage(staticCanvas, 0, 0, staticCanvas.width, staticCanvas.height, 0, 0, totalW, totalH);

        const focusCell = selectedCell || hoverCell;

        if (benchmarkRow == null && !focusCell) return;

        ctx.save();
        ctx.fillStyle = benchmarkRow != null ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.58)';
        ctx.fillRect(matrixX, matrixY, matrixSize, matrixSize);

        if (benchmarkRow != null) {
            const y = matrixY + benchmarkRow * cellSize;
            ctx.drawImage(
                staticCanvas,
                Math.round(matrixX * ratio),
                Math.round(y * ratio),
                Math.round(matrixSize * ratio),
                Math.max(1, Math.round(cellSize * ratio)),
                matrixX,
                y,
                matrixSize,
                cellSize
            );
        }

        if (focusCell) {
            const rowY = matrixY + focusCell.row * cellSize;
            const colX = matrixX + focusCell.col * cellSize;

            ctx.drawImage(
                staticCanvas,
                Math.round(matrixX * ratio),
                Math.round(rowY * ratio),
                Math.round(matrixSize * ratio),
                Math.max(1, Math.round(cellSize * ratio)),
                matrixX,
                rowY,
                matrixSize,
                cellSize
            );

            ctx.drawImage(
                staticCanvas,
                Math.round(colX * ratio),
                Math.round(matrixY * ratio),
                Math.max(1, Math.round(cellSize * ratio)),
                Math.round(matrixSize * ratio),
                colX,
                matrixY,
                cellSize,
                matrixSize
            );

            ctx.strokeStyle = selectedCell ? '#0B1D3A' : '#425d88';
            ctx.lineWidth = selectedCell ? 1.8 : 1.1;
            ctx.strokeRect(
                colX + 0.5,
                rowY + 0.5,
                Math.max(0.5, cellSize - 1),
                Math.max(0.5, cellSize - 1)
            );
        }

        ctx.restore();
    }

    function setupOverlayLabels(state) {
        const { wrapper, totalW, totalH, tickers, n, cellSize, matrixX, matrixY, onLabelClick } = state;

        if (!(cellSize >= 4.8 && n <= 80)) return;

        const svg = d3.select(wrapper)
            .append('svg')
            .attr('width', totalW)
            .attr('height', totalH)
            .style('position', 'absolute')
            .style('left', '0px')
            .style('top', '0px')
            .style('overflow', 'visible')
            .style('pointer-events', 'none');

        svg.selectAll('text.tick-left')
            .data(tickers)
            .enter()
            .append('text')
            .attr('class', 'tick-left')
            .attr('x', matrixX - 3)
            .attr('y', (d, i) => matrixY + i * cellSize + cellSize / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', Math.min(11, cellSize * 0.28) + 'px')
            .attr('fill', '#555')
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .text(d => d)
            .on('click', (event, d) => {
                if (onLabelClick) onLabelClick(d);
            });

        svg.selectAll('text.tick-top')
            .data(tickers)
            .enter()
            .append('text')
            .attr('class', 'tick-top')
            .attr('x', (d, i) => matrixX + i * cellSize + cellSize / 2)
            .attr('y', matrixY - 4)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', Math.min(11, cellSize * 0.28) + 'px')
            .attr('fill', '#555')
            .attr('transform', (d, i) => `rotate(-45, ${matrixX + i * cellSize + cellSize / 2}, ${matrixY - 4})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .text(d => d)
            .on('click', (event, d) => {
                if (onLabelClick) onLabelClick(d);
            });
    }

    function renderDetail(state) {
        const {
            detailCtx,
            detailTitleEl, detailMetaEl, detailHelpEl,
            matrix, tickers, n
        } = state;

        const focus = getFocusCell(state);
        const w = DETAIL_SIZE;
        const h = DETAIL_SIZE;

        detailCtx.clearRect(0, 0, w, h);
        detailCtx.fillStyle = '#fff';
        detailCtx.fillRect(0, 0, w, h);

        if (!focus) {
            detailTitleEl.textContent = 'Detail view';
            detailMetaEl.innerHTML = '<strong>Hover or click</strong> a cell in the overview matrix.';
            detailHelpEl.textContent = `The full ${n}×${n} matrix is the overview. This panel shows a readable local neighborhood.`;
            detailCtx.strokeStyle = '#e2e6ea';
            detailCtx.strokeRect(0.5, 0.5, w - 1, h - 1);

            detailCtx.fillStyle = '#97a1a9';
            detailCtx.font = '13px sans-serif';
            detailCtx.textAlign = 'center';
            detailCtx.textBaseline = 'middle';
            detailCtx.fillText('No focus cell selected', w / 2, h / 2 - 10);
            detailCtx.font = '11px sans-serif';
            detailCtx.fillText('Hover for preview • Click to pin', w / 2, h / 2 + 14);
            return;
        }

        const win = Math.min(DETAIL_WINDOW, n);
        const half = Math.floor(win / 2);

        const startRow = clamp(focus.row - half, 0, Math.max(0, n - win));
        const startCol = clamp(focus.col - half, 0, Math.max(0, n - win));
        const endRow = startRow + win - 1;
        const endCol = startCol + win - 1;

        const pad = { top: 28, right: 18, bottom: 38, left: 58 };
        const innerW = w - pad.left - pad.right;
        const innerH = h - pad.top - pad.bottom;
        const cell = Math.min(innerW / win, innerH / win);
        const drawW = win * cell;
        const drawH = win * cell;

        detailCtx.strokeStyle = '#d8dfe5';
        detailCtx.strokeRect(pad.left + 0.5, pad.top + 0.5, drawW, drawH);

        for (let i = 0; i < win; i++) {
            for (let j = 0; j < win; j++) {
                const row = startRow + i;
                const col = startCol + j;
                const value = matrix[row][col];
                const x = pad.left + j * cell;
                const y = pad.top + i * cell;

                detailCtx.fillStyle = corrColor(value);
                detailCtx.fillRect(x, y, cell, cell);

                if (cell >= 10) {
                    detailCtx.strokeStyle = 'rgba(255,255,255,0.22)';
                    detailCtx.lineWidth = 0.5;
                    detailCtx.strokeRect(x + 0.25, y + 0.25, cell - 0.5, cell - 0.5);
                }
            }
        }

        const localRow = focus.row - startRow;
        const localCol = focus.col - startCol;

        const hx = pad.left + localCol * cell;
        const hy = pad.top + localRow * cell;

        detailCtx.strokeStyle = '#0B1D3A';
        detailCtx.lineWidth = 2;
        detailCtx.strokeRect(hx + 0.5, hy + 0.5, Math.max(0.5, cell - 1), Math.max(0.5, cell - 1));

        detailCtx.save();
        detailCtx.strokeStyle = 'rgba(11,29,58,0.22)';
        detailCtx.lineWidth = 1;
        detailCtx.beginPath();
        detailCtx.moveTo(pad.left, hy + cell / 2);
        detailCtx.lineTo(pad.left + drawW, hy + cell / 2);
        detailCtx.stroke();

        detailCtx.beginPath();
        detailCtx.moveTo(hx + cell / 2, pad.top);
        detailCtx.lineTo(hx + cell / 2, pad.top + drawH);
        detailCtx.stroke();
        detailCtx.restore();

        const step = win <= 12 ? 1 : 4;
        detailCtx.fillStyle = '#6f7a84';
        detailCtx.font = '10px sans-serif';
        detailCtx.textBaseline = 'middle';

        for (let i = 0; i < win; i += step) {
            const row = startRow + i;
            const y = pad.top + i * cell + cell / 2;
            detailCtx.textAlign = 'right';
            detailCtx.fillText(tickers[row], pad.left - 6, y);
        }

        for (let j = 0; j < win; j += step) {
            const col = startCol + j;
            const x = pad.left + j * cell + cell / 2;
            detailCtx.save();
            detailCtx.translate(x, pad.top - 6);
            detailCtx.rotate(-Math.PI / 4);
            detailCtx.textAlign = 'left';
            detailCtx.textBaseline = 'middle';
            detailCtx.fillText(tickers[col], 0, 0);
            detailCtx.restore();
        }

        const value = matrix[focus.row][focus.col];

        detailTitleEl.textContent = state.selectedCell ? 'Pinned detail view' : 'Hover detail view';
        detailMetaEl.innerHTML =
            `<strong>${tickers[focus.row]} × ${tickers[focus.col]}</strong> = ${value.toFixed(4)}<br>` +
            `Rows: ${tickers[startRow]} … ${tickers[endRow]}<br>` +
            `Cols: ${tickers[startCol]} … ${tickers[endCol]}`;
        detailHelpEl.textContent =
            'Overview stays dense for scale. This panel gives readable local structure around the hovered or selected cell.';
    }

    function attachCanvasEvents(state) {
        const { canvas, tooltip, tickers, matrix, n, cellSize, matrixX, matrixY, matrixSize, onCellClick } = state;

        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (
                x >= matrixX && x < matrixX + matrixSize &&
                y >= matrixY && y < matrixY + matrixSize
            ) {
                const col = Math.floor((x - matrixX) / cellSize);
                const row = Math.floor((y - matrixY) / cellSize);

                if (row >= 0 && row < n && col >= 0 && col < n) {
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${event.pageX + 10}px`;
                    tooltip.style.top = `${event.pageY - 20}px`;
                    tooltip.textContent = `${tickers[row]} × ${tickers[col]}: ${matrix[row][col].toFixed(4)}`;

                    const changed = !state.hoverCell || state.hoverCell.row !== row || state.hoverCell.col !== col;
                    if (changed) {
                        state.hoverCell = { row, col };
                        drawScene(state);
                        renderDetail(state);
                    }
                    return;
                }
            }

            tooltip.style.display = 'none';
            if (state.hoverCell) {
                state.hoverCell = null;
                drawScene(state);
                renderDetail(state);
            }
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            if (state.hoverCell) {
                state.hoverCell = null;
                drawScene(state);
                renderDetail(state);
            }
        });

        canvas.addEventListener('click', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (
                x >= matrixX && x < matrixX + matrixSize &&
                y >= matrixY && y < matrixY + matrixSize
            ) {
                const col = Math.floor((x - matrixX) / cellSize);
                const row = Math.floor((y - matrixY) / cellSize);

                if (row >= 0 && row < n && col >= 0 && col < n) {
                    state.selectedCell = { row, col };
                    state.hoverCell = { row, col };
                    state.benchmarkRow = null;
                    drawScene(state);
                    renderDetail(state);
                    if (onCellClick) onCellClick(tickers[row], tickers[col]);
                }
            }
        });

        canvas.addEventListener('dblclick', () => {
            state.selectedCell = null;
            drawScene(state);
            renderDetail(state);
        });
    }

    async function render(containerId, N, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        container.innerHTML = '';

        const tooltip = document.getElementById('tooltip');

        let data;
        const tLoadStart = performance.now();

        if (options.fullCorrData && options.clusterTickers) {
            try {
                data = subsetMatrix(options.fullCorrData, options.clusterTickers);
            } catch (e) {
                container.textContent = `Error subsetting matrix: ${e.message}`;
                return null;
            }
        } else {
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

        const tLoadEnd = performance.now();

        const matrix = data.matrix;
        const tickers = data.tickers;
        const n = tickers.length;

        const panelWidth = container.clientWidth || 980;
        const desiredMatrixWidth = Math.min(920, Math.max(760, panelWidth - 26));

        let cellSize;
        if (n <= 6) {
            cellSize = 64;
        } else if (n <= 10) {
            cellSize = 50;
        } else if (n <= 16) {
            cellSize = 38;
        } else if (n <= 24) {
            cellSize = 28;
        } else if (n <= 40) {
            cellSize = 20;
        } else if (n <= 80) {
            cellSize = 12;
        } else {
            cellSize = Math.max(1.5, Math.min(7, desiredMatrixWidth / Math.max(1, n)));
        }

        if (Number.isFinite(options.maxWidth) && options.maxWidth > 0) {
            cellSize = Math.min(cellSize, options.maxWidth / Math.max(1, n));
            cellSize = Math.max(1.5, cellSize);
        }

        const accessory = computeAccessoryLayout(n, cellSize);

        console.log("[CS524] matrix layout", {
            n,
            cellSize,
            barW: accessory.barW,
            upsetW: accessory.upsetW,
            catSpacing: accessory.catSpacing,
            dotR: accessory.dotR
        });

        const matrixSize = n * cellSize;
        const totalW = MARGIN.left + accessory.barW + GAP + matrixSize + GAP + accessory.upsetW + MARGIN.right;
        const totalH = MARGIN.top + matrixSize + MARGIN.bottom;

        const tRenderStart = performance.now();

        const workspace = document.createElement('div');
        workspace.className = 'matrix-workspace';

        const mainSection = document.createElement('div');
        mainSection.className = 'matrix-main';
        mainSection.style.display = 'flex';
        mainSection.style.justifyContent = 'center';
        mainSection.style.alignItems = 'center';
        mainSection.style.minHeight = `${Math.max(totalH + 20, 260)}px`;

        const wrapper = document.createElement('div');
        wrapper.className = 'matrix-main-inner';
        wrapper.style.width = `${totalW}px`;
        wrapper.style.height = `${totalH}px`;

        const detailSection = document.createElement('div');
        detailSection.className = 'matrix-detail';

        const detailLeft = document.createElement('div');
        detailLeft.className = 'matrix-detail-left';

        const detailTitle = document.createElement('h4');
        detailTitle.textContent = 'Detail view';

        const detailMeta = document.createElement('div');
        detailMeta.className = 'detail-meta';

        const detailHelp = document.createElement('div');
        detailHelp.className = 'detail-help';

        const legendRow = document.createElement('div');
        legendRow.className = 'matrix-legend-row';
        legendRow.innerHTML = `
            <span class="matrix-chip"><i class="chip-green"></i> positive correlation</span>
            <span class="matrix-chip"><i class="chip-red"></i> negative correlation</span>
            <span class="matrix-chip"><i class="chip-gray"></i> detail neighborhood</span>
        `;

        const detailCanvasPack = document.createElement('div');
        const detailCanvasObj = createHiDPICanvas(DETAIL_SIZE, DETAIL_SIZE);
        detailCanvasPack.appendChild(detailCanvasObj.canvas);

        detailLeft.appendChild(detailTitle);
        detailLeft.appendChild(detailMeta);
        detailLeft.appendChild(detailHelp);
        detailLeft.appendChild(legendRow);

        detailSection.appendChild(detailCanvasPack);
        detailSection.appendChild(detailLeft);

        const mainCanvas = createHiDPICanvas(totalW, totalH);
        const staticLayer = createHiDPICanvas(totalW, totalH);

        wrapper.appendChild(mainCanvas.canvas);
        mainSection.appendChild(wrapper);
        workspace.appendChild(mainSection);
        workspace.appendChild(detailSection);
        container.appendChild(workspace);

        const state = {
            containerId,
            container,
            workspace,
            wrapper,
            canvas: mainCanvas.canvas,
            ctx: mainCanvas.ctx,
            ratio: mainCanvas.ratio,
            staticCanvas: staticLayer.canvas,
            staticCtx: staticLayer.ctx,
            tooltip,
            matrix,
            tickers,
            n,
            cellSize,
            matrixSize,
            totalW,
            totalH,
            barX: MARGIN.left,
            barW: accessory.barW,
            rowPad: accessory.rowPad,
            barH: accessory.barH,
            matrixX: MARGIN.left + accessory.barW + GAP,
            matrixY: MARGIN.top,
            upsetX: MARGIN.left + accessory.barW + GAP + matrixSize + GAP,
            upsetW: accessory.upsetW,
            nCats: accessory.nCats,
            catSpacing: accessory.catSpacing,
            dotR: accessory.dotR,
            selectedCell: null,
            hoverCell: null,
            benchmarkRow: null,
            onCellClick: options.onCellClick || null,
            onLabelClick: options.onLabelClick || null,
            detailCanvas: detailCanvasObj.canvas,
            detailCtx: detailCanvasObj.ctx,
            detailTitleEl: detailTitle,
            detailMetaEl: detailMeta,
            detailHelpEl: detailHelp,
        };

        renderStaticBase(state, state.staticCtx);
        drawScene(state);
        setupOverlayLabels(state);
        attachCanvasEvents(state);
        renderDetail(state);

        renderStates.set(containerId, state);

        const tRenderEnd = performance.now();
        const domElements = container.querySelectorAll('canvas, svg, text, .matrix-detail').length;

        return {
            n,
            tickers,
            loadTime: tLoadEnd - tLoadStart,
            renderTime: tRenderEnd - tRenderStart,
            domElements,
            canvas: mainCanvas.canvas
        };
    }

    function measureBrush(containerId, n) {
        return new Promise((resolve) => {
            const state = renderStates.get(containerId);
            if (!state) {
                resolve({ p50: 0, p95: 0, fps: 0 });
                return;
            }

            const samples = Math.min(60, n);
            const latencies = [];
            const stamps = [];
            let i = 0;

            const originalSelected = state.selectedCell;
            const originalHover = state.hoverCell;
            const originalBenchmark = state.benchmarkRow;

            function next() {
                if (i >= samples) {
                    state.selectedCell = originalSelected;
                    state.hoverCell = originalHover;
                    state.benchmarkRow = originalBenchmark;
                    drawScene(state);
                    renderDetail(state);

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

                const row = i % n;
                const t0 = performance.now();
                state.selectedCell = null;
                state.hoverCell = null;
                state.benchmarkRow = row;
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

    return { render, measureBrush };
})();

window.MatrixCanvas = MatrixCanvas;
window.MatrixEnriched = MatrixCanvas;