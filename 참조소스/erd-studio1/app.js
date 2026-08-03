// State Variables
let currentView = '';
let scale = 1;
let panX = 0, panY = 0;
let isPanning = false, startX, startY;
let draggingTable = null;
let dragOffX = 0, dragOffY = 0;
let selectedTableId = null;

// DOM Elements
const canvasLayer = document.getElementById('canvas-layer');
const cardsContainer = document.getElementById('cards-container');
const svgOverlay = document.getElementById('connections-svg');
const workspace = document.getElementById('workspace');
const inspector = document.getElementById('inspector');
const inspectorContent = document.getElementById('inspector-content');
const searchInput = document.getElementById('search-input');

// Theme Switcher
function changeTheme(themeName) {
    document.body.className = themeName;
    localStorage.setItem('erd_theme', themeName);
    updateConnections();
}

// Render Dynamic Tabs
function renderTabs() {
    const tabContainer = document.getElementById('view-tabs');
    tabContainer.innerHTML = '';
    Object.keys(schemaData).forEach((key, idx) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
        btn.id = `tab-btn-${key}`;
        btn.textContent = schemaData[key].name;
        btn.onclick = () => switchView(key, btn);
        tabContainer.appendChild(btn);
    });
    if (!currentView) currentView = Object.keys(schemaData)[0];
}

// Initialize App
function initApp() {
    const savedTheme = localStorage.getItem('erd_theme') || 'theme-cyber-navy';
    document.body.className = savedTheme;
    document.getElementById('theme-select').value = savedTheme;

    renderTabs();
    renderView(currentView);
    setupPanZoom();

    // Center and fit on initial load
    requestAnimationFrame(() => centerAndFit());
}

// Center and Fit All Content to Workspace
function centerAndFit() {
    const cards = document.querySelectorAll('.table-card');
    if (cards.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(card => {
        const left = parseFloat(card.style.left);
        const top = parseFloat(card.style.top);
        const width = card.offsetWidth;
        const height = card.offsetHeight;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, left + width);
        maxY = Math.max(maxY, top + height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;

    // Fit with padding, slightly zoomed out
    const paddingX = 120;
    const paddingY = 160; // more padding at bottom for legend
    const scaleX = (workspaceWidth - paddingX * 2) / contentWidth;
    const scaleY = (workspaceHeight - paddingY * 2) / contentHeight;
    scale = Math.min(scaleX, scaleY, 1);
    scale = Math.max(scale, 0.5);

    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;
    const workspaceCenterX = workspaceWidth / 2;
    const workspaceCenterY = workspaceHeight / 2;

    panX = workspaceCenterX - contentCenterX * scale;
    panY = workspaceCenterY - contentCenterY * scale;

    applyTransform();
    updateConnections();
}

// Render Current View
function renderView(viewKey) {
    currentView = viewKey;
    cardsContainer.innerHTML = '';

    const defs = svgOverlay.querySelector('defs').outerHTML;
    svgOverlay.innerHTML = defs;
    selectedTableId = null;

    const view = schemaData[viewKey];
    if (!view) return;

    const colsPerRow = 3;
    view.tables.forEach((table, idx) => {
        table.id = table.id || table.name;

        if (typeof table.x === 'undefined' || typeof table.y === 'undefined') {
            const col = idx % colsPerRow;
            const row = Math.floor(idx / colsPerRow);
            table.x = 60 + col * 520;
            table.y = 80 + row * 400;
        }

        const card = document.createElement('div');
        card.className = 'table-card';
        card.id = `card-${table.id}`;
        card.style.left = `${table.x}px`;
        card.style.top = `${table.y}px`;

        card.innerHTML = `
            <div class="table-header" onmousedown="startDragCard(event, '${table.id}')">
                <div class="table-title">
                    <span class="table-name">${table.name}</span>
                    <span class="table-desc">${table.desc || ''}</span>
                </div>
                <span class="table-badge">TABLE</span>
            </div>
            <div class="column-list">
                ${table.columns.map(col => `
                    <div class="column-row" id="col-${table.id}-${col.name}">
                        <div class="column-left">
                            <span class="key-badge ${col.pk ? 'key-pk' : (col.fk ? 'key-fk' : 'key-none')}">
                                ${col.pk ? 'PK' : (col.fk ? 'FK' : '')}
                            </span>
                            <span class="col-name">${col.name}</span>
                        </div>
                        <span class="col-type">${col.type}</span>
                    </div>
                `).join('')}
            </div>
        `;

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTable(table);
        });

        cardsContainer.appendChild(card);
    });

    requestAnimationFrame(() => updateConnections());
}

// Smart Connection Line Routing
function updateConnections() {
    const defs = svgOverlay.querySelector('defs').outerHTML;
    svgOverlay.innerHTML = defs;

    const view = schemaData[currentView];
    if (!view || !view.relations) return;

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-blue').trim();

    view.relations.forEach(rel => {
        const firstFromCol = Array.isArray(rel.fromCol) ? rel.fromCol[0] : rel.fromCol;
        const firstToCol = Array.isArray(rel.toCol) ? rel.toCol[0] : rel.toCol;

        const fromColElem = document.getElementById(`col-${rel.from}-${firstFromCol}`);
        const toColElem = document.getElementById(`col-${rel.to}-${firstToCol}`);
        const fromCard = document.getElementById(`card-${rel.from}`);
        const toCard = document.getElementById(`card-${rel.to}`);

        if (!fromColElem || !toColElem || !fromCard || !toCard) return;

        const fromRect = fromColElem.getBoundingClientRect();
        const toRect = toColElem.getBoundingClientRect();
        const fromCardRect = fromCard.getBoundingClientRect();
        const toCardRect = toCard.getBoundingClientRect();
        const canvasRect = canvasLayer.getBoundingClientRect();

        const cardDx = (toCardRect.left + toCardRect.width / 2) - (fromCardRect.left + fromCardRect.width / 2);
        const cardDy = (toCardRect.top + toCardRect.height / 2) - (fromCardRect.top + fromCardRect.height / 2);
        const offset = 8 / scale;

        let x1, y1, x2, y2, pathData, mx, my;

        if (Math.abs(cardDy) > Math.abs(cardDx) * 1.2) {
            // VERTICAL
            x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / scale;
            x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / scale;

            if (cardDy > 0) {
                y1 = (fromRect.bottom - canvasRect.top) / scale + offset;
                y2 = (toRect.top - canvasRect.top) / scale - offset;
            } else {
                y1 = (fromRect.top - canvasRect.top) / scale - offset;
                y2 = (toRect.bottom - canvasRect.top) / scale + offset;
            }

            const distY = Math.abs(y2 - y1);
            const cdy = distY * 0.5;
            const midX = (x1 + x2) / 2;
            const cy1 = y1 + (cardDy > 0 ? cdy : -cdy);
            const cy2 = y2 + (cardDy > 0 ? -cdy : cdy);

            pathData = `M ${x1} ${y1} C ${midX} ${cy1}, ${midX} ${cy2}, ${x2} ${y2}`;

            mx = 0.125 * x1 + 0.375 * midX + 0.375 * midX + 0.125 * x2;
            my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
        } else {
            // HORIZONTAL
            y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / scale;
            y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / scale;

            let rawX1 = (fromRect.right - canvasRect.left) / scale;
            let rawX2 = (toRect.left - canvasRect.left) / scale;

            if (rawX1 < rawX2) {
                x1 = rawX1 + offset;
                x2 = rawX2 - offset;
            } else {
                x1 = (fromRect.left - canvasRect.left) / scale - offset;
                x2 = (toRect.right - canvasRect.left) / scale + offset;
            }

            const distX = Math.abs(x2 - x1);
            const cdx = Math.max(distX * 0.6, 40 / scale);
            const midY = (y1 + y2) / 2;

            const cx1 = x1 + (rawX1 < rawX2 ? cdx : -cdx);
            const cx2 = x2 + (rawX1 < rawX2 ? -cdx : cdx);

            pathData = `M ${x1} ${y1} C ${cx1} ${midY}, ${cx2} ${midY}, ${x2} ${y2}`;

            mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
            my = 0.125 * y1 + 0.375 * midY + 0.375 * midY + 0.125 * y2;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', 'connection-line');
        path.setAttribute('marker-end', 'url(#marker-arrow)');

        if (rel.identifying) {
            path.style.strokeDasharray = 'none';
        } else {
            path.style.strokeDasharray = '8, 5';
        }

        path.id = `line-${rel.from}-${rel.to}`;
        svgOverlay.appendChild(path);

        const cardBase = rel.cardinality || "1 : N";
        const isComposite = Array.isArray(rel.fromCol);
        const badgeLabel = isComposite ? `${rel.fromCol.join(', ')} (${cardBase})` : cardBase;

        const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const badgeWidth = badgeLabel.length * 8.5 + 16;
        const badgeHeight = 18;

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', mx - badgeWidth / 2);
        bgRect.setAttribute('y', my - badgeHeight / 2);
        bgRect.setAttribute('width', badgeWidth);
        bgRect.setAttribute('height', badgeHeight);
        bgRect.setAttribute('rx', 4);
        bgRect.setAttribute('fill', '#090d16');
        bgRect.setAttribute('stroke', accentColor);
        bgRect.setAttribute('stroke-width', '1.2');

        const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badgeText.setAttribute('x', mx);
        badgeText.setAttribute('y', my + 3.5);
        badgeText.setAttribute('fill', accentColor);
        badgeText.setAttribute('font-size', '9.5px');
        badgeText.setAttribute('font-family', "'Fira Code', 'Courier New', monospace");
        badgeText.setAttribute('font-weight', 'bold');
        badgeText.setAttribute('text-anchor', 'middle');
        badgeText.textContent = badgeLabel;

        badgeG.appendChild(bgRect);
        badgeG.appendChild(badgeText);
        svgOverlay.appendChild(badgeG);
    });
}

// Switch View Tabs
function switchView(viewKey, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        const targetBtn = document.getElementById(`tab-btn-${viewKey}`);
        if (targetBtn) targetBtn.classList.add('active');
    }
    renderView(viewKey);
}

// Pan and Zoom Mechanics
function setupPanZoom() {
    workspace.addEventListener('mousedown', (e) => {
        if (e.target === workspace || e.target === canvasLayer || e.target === svgOverlay) {
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
    });

    workspace.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        zoomCanvas(factor);
    }, { passive: false });
}

function zoomCanvas(factor) {
    scale = Math.min(Math.max(0.4, scale * factor), 2.5);
    applyTransform();
    updateConnections();
}

function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
    updateConnections();
}

function applyTransform() {
    canvasLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    document.getElementById('zoom-text').innerText = `${Math.round(scale * 100)}%`;
}

// Drag Table Cards
function startDragCard(e, tableId) {
    e.stopPropagation();
    const view = schemaData[currentView];
    const table = view.tables.find(t => t.id === tableId);
    if (!table) return;

    draggingTable = table;
    dragOffX = (e.clientX - panX) / scale - draggingTable.x;
    dragOffY = (e.clientY - panY) / scale - draggingTable.y;

    function onMouseMove(moveEvent) {
        if (!draggingTable) return;
        draggingTable.x = (moveEvent.clientX - panX) / scale - dragOffX;
        draggingTable.y = (moveEvent.clientY - panY) / scale - dragOffY;

        const card = document.getElementById(`card-${draggingTable.id}`);
        if (card) {
            card.style.left = `${draggingTable.x}px`;
            card.style.top = `${draggingTable.y}px`;
        }
        updateConnections();
    }

    function onMouseUp() {
        draggingTable = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// Select Table & Inspector
function selectTable(table) {
    selectedTableId = table.id;
    document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card-${table.id}`);
    if (card) card.classList.add('selected');

    inspectorContent.innerHTML = `
        <div class="inspector-section">
            <h3><i class="fa-solid fa-table"></i> ${table.name}</h3>
            <p class="inspector-desc">${table.desc || ''}</p>
        </div>
        <div class="inspector-section">
            <h4>Columns</h4>
            ${table.columns.map(col => `
                <div class="inspector-row">
                    <span class="inspector-key ${col.pk ? 'key-pk' : (col.fk ? 'key-fk' : '')}">
                        ${col.pk ? 'PK' : (col.fk ? 'FK' : '·')}
                    </span>
                    <span class="inspector-col">${col.name}</span>
                    <span class="inspector-type">${col.type}</span>
                </div>
            `).join('')}
        </div>
        ${table.indexes ? `
        <div class="inspector-section">
            <h4>Indexes</h4>
            ${table.indexes.map(idx => `
                <div class="inspector-row">
                    <span class="inspector-col">${idx.name}</span>
                    <span class="inspector-type">${idx.columns.join(', ')}</span>
                </div>
            `).join('')}
        </div>` : ''}
    `;
    inspector.classList.add('open');
}

function toggleInspector() {
    inspector.classList.toggle('open');
}

function copyCode() {
    const code = inspectorContent.innerText;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-btn');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = original, 1500);
    });
}

// Search
function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.table-card').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.opacity = text.includes(term) ? '1' : '0.15';
    });
    if (!term) {
        document.querySelectorAll('.table-card').forEach(card => card.style.opacity = '1');
    }
}

// Run App
window.onload = initApp;