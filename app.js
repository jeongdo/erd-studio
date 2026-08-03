// State Variables
        let currentView = '';
        let scale = 1;
        let panX = 0, panY = 0;
        let isPanning = false;
        let startX, startY;
        let selectedTableId = null;

        const workspace = document.getElementById('workspace');
        const canvasLayer = document.getElementById('canvas-layer');
        const cardsContainer = document.getElementById('cards-container');
        const svgOverlay = document.getElementById('connections-svg');

        // Render Dynamic Header Tabs with Optional Metadata (tabName, icon) Support
        function renderTabs() {
            const tabsContainer = document.getElementById('tabs-container');
            if (!tabsContainer || typeof schemaData === 'undefined') return;

            tabsContainer.innerHTML = '';
            const schemaKeys = Object.keys(schemaData);
            if (schemaKeys.length === 0) return;

            schemaKeys.forEach((key, index) => {
                const viewData = schemaData[key];
                const btn = document.createElement('button');
                btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
                btn.id = `tab-btn-${key}`;
                
                // Select Icon: Optional metadata icon || Smart Key Auto Detection
                let iconClass = viewData.icon;
                if (!iconClass) {
                    if (key.includes('hr') || key.includes('user') || key.includes('emp')) {
                        iconClass = 'fa-solid fa-users';
                    } else if (key.includes('pipe') || key.includes('spool')) {
                        iconClass = 'fa-solid fa-diagram-next';
                    } else if (key.includes('support') || key.includes('system')) {
                        iconClass = 'fa-solid fa-cubes';
                    } else {
                        iconClass = 'fa-solid fa-database';
                    }
                }

                // Title Selection: Optional tabName || Clean Extracted Title
                const rawTitle = viewData.tabName || viewData.title || key;
                const cleanTitle = rawTitle.includes('(') ? rawTitle.split('(')[0].trim() : rawTitle;

                btn.innerHTML = `<i class="${iconClass}"></i> ${cleanTitle}`;
                btn.onclick = (e) => switchView(key, btn);

                tabsContainer.appendChild(btn);
            });

            // Set default initial view key
            if (!currentView || !schemaData[currentView]) {
                currentView = schemaKeys[0];
            }
        }

        // Theme Switcher Function
        function changeTheme(themeName) {
            document.body.className = themeName;
            localStorage.setItem('erd_theme', themeName);
            
            // Update SVG Marker Arrow Color dynamically
            const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-blue').trim();
            const arrowPath = document.getElementById('arrow-path');
            if (arrowPath) {
                arrowPath.setAttribute('fill', accentColor);
                arrowPath.setAttribute('stroke', accentColor);
            }
            
            updateConnections();
        }

        // Initialize App
        function initApp() {
            // Restore Saved Theme
            const savedTheme = localStorage.getItem('erd_theme') || 'theme-cyber-navy';
            document.body.className = savedTheme;
            document.getElementById('theme-select').value = savedTheme;

            // 1. Render Dynamic Tabs first
            renderTabs();

            // 2. Render Canvas View
            renderView(currentView);
            setupPanZoom();
        }

        // Render Current View (With Auto Layout & Optional Table ID Fallback)
        function renderView(viewKey) {
            currentView = viewKey;
            cardsContainer.innerHTML = '';

            // Keep SVG Defs
            const defs = svgOverlay.querySelector('defs').outerHTML;
            svgOverlay.innerHTML = defs;
            selectedTableId = null;

            const view = schemaData[viewKey];
            if (!view) return;

            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            // Render Table Cards (Auto Grid Layout if x, y missing)
            const colsPerRow = 3;
            view.tables.forEach((table, idx) => {
                // Guaranteed Fallback for table.id
                table.id = table.id || table.name;

                // Auto Layout Computation if x, y missing
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

                // Track bounding box for centering
                minX = Math.min(minX, table.x);
                minY = Math.min(minY, table.y);
                // Approximate card width 360px, height based on columns (~40px per column + 50px header)
                const approxHeight = 50 + (table.columns.length * 36);
                maxX = Math.max(maxX, table.x + 360);
                maxY = Math.max(maxY, table.y + approxHeight);

                cardsContainer.appendChild(card);
            });

            // Auto Center Camera
            if (minX !== Infinity) {
                const erdCenterX = (minX + maxX) / 2;
                const erdCenterY = (minY + maxY) / 2;
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Set pan to center the ERD block
                panX = (viewportWidth / 2) - erdCenterX;
                panY = (viewportHeight / 2) - erdCenterY;
                scale = 1;
                
                canvasLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                document.getElementById('zoom-text').innerText = `${Math.round(scale * 100)}%`;
            }

            // Draw Connection Lines
            requestAnimationFrame(() => updateConnections());
        }

        // Smart Connection Line Routing (With Composite Key & Optional Cardinality Fallback)
        function updateConnections() {
            try {
                // Safely clear old paths/badges without destroying <defs>
                const children = Array.from(svgOverlay.children);
                children.forEach(child => {
                    if (child.tagName.toLowerCase() !== 'defs') {
                        svgOverlay.removeChild(child);
                    }
                });

            const view = schemaData[currentView];
            if (!view || !view.relations) return;

            const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-blue').trim();

            view.relations.forEach(rel => {
                // Support Composite Keys (Array or String)
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
                const offset = 8 / scale;  // FIX: scale-aware offset

                let x1, y1, x2, y2, pathData, mx, my;

                // Determine if connection is primarily vertical or horizontal
                if (Math.abs(cardDy) > Math.abs(cardDx) * 1.2) {
                    // ===== VERTICAL CONNECTION =====
                    x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / scale;
                    x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / scale;

                    if (cardDy > 0) {
                        // from is above to (use Card bounds to prevent piercing)
                        y1 = (fromCardRect.bottom - canvasRect.top) / scale + offset;
                        y2 = (toCardRect.top - canvasRect.top) / scale - offset;
                    } else {
                        // from is below to
                        y1 = (fromCardRect.top - canvasRect.top) / scale - offset;
                        y2 = (toCardRect.bottom - canvasRect.top) / scale + offset;
                    }

                    const distY = Math.abs(y2 - y1);
                    const cdy = distY * 0.5;

                    // FIX: smoother curve via midX control points
                    const midX = (x1 + x2) / 2;
                    const cy1 = y1 + (cardDy > 0 ? cdy : -cdy);
                    const cy2 = y2 + (cardDy > 0 ? -cdy : cdy);

                    pathData = `M ${x1} ${y1} C ${midX} ${cy1}, ${midX} ${cy2}, ${x2} ${y2}`;

                    mx = 0.125 * x1 + 0.375 * midX + 0.375 * midX + 0.125 * x2;
                    my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
                } else {
                    // ===== HORIZONTAL CONNECTION =====
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
                    // FIX: longer control arms for smoother S-curve
                    const cdx = Math.max(distX * 0.6, 40 / scale);
                    const midY = (y1 + y2) / 2;

                    const cx1 = x1 + (rawX1 < rawX2 ? cdx : -cdx);
                    const cx2 = x2 + (rawX1 < rawX2 ? -cdx : cdx);

                    // FIX: use midY for elegant S-curve
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

                // Render Floating Cardinality & Composite Key Badge
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
            } catch (err) {
                console.error("Error in updateConnections:", err);
            }
        }
        // // Smart Connection Line Routing (With Composite Key & Optional Cardinality Fallback)
        // function updateConnections() {
        //     const defs = svgOverlay.querySelector('defs').outerHTML;
        //     svgOverlay.innerHTML = defs;
        //
        //     const view = schemaData[currentView];
        //     if (!view || !view.relations) return;
        //
        //     const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-blue').trim();
        //
        //     view.relations.forEach(rel => {
        //         // Support Composite Keys (Array or String)
        //         const firstFromCol = Array.isArray(rel.fromCol) ? rel.fromCol[0] : rel.fromCol;
        //         const firstToCol = Array.isArray(rel.toCol) ? rel.toCol[0] : rel.toCol;
        //
        //         const fromColElem = document.getElementById(`col-${rel.from}-${firstFromCol}`);
        //         const toColElem = document.getElementById(`col-${rel.to}-${firstToCol}`);
        //         const fromCard = document.getElementById(`card-${rel.from}`);
        //         const toCard = document.getElementById(`card-${rel.to}`);
        //
        //         if (!fromColElem || !toColElem || !fromCard || !toCard) return;
        //
        //         const fromRect = fromColElem.getBoundingClientRect();
        //         const toRect = toColElem.getBoundingClientRect();
        //         const fromCardRect = fromCard.getBoundingClientRect();
        //         const toCardRect = toCard.getBoundingClientRect();
        //         const canvasRect = canvasLayer.getBoundingClientRect();
        //
        //         const dx = (toCardRect.left + toCardRect.width / 2) - (fromCardRect.left + fromCardRect.width / 2);
        //         const dy = (toCardRect.top + toCardRect.height / 2) - (fromCardRect.top + fromCardRect.height / 2);
        //         const offset = 8;
        //
        //         let x1, y1, x2, y2, pathData, mx, my;
        //
        //         if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        //             x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / scale;
        //             x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / scale;
        //
        //             if (dy > 0) {
        //                 y1 = (fromCardRect.bottom - canvasRect.top) / scale + offset;
        //                 y2 = (toCardRect.top - canvasRect.top) / scale - offset;
        //             } else {
        //                 y1 = (fromCardRect.top - canvasRect.top) / scale - offset;
        //                 y2 = (toCardRect.bottom - canvasRect.top) / scale + offset;
        //             }
        //
        //             const cdy = Math.abs(y2 - y1) * 0.5;
        //             const cy1 = y1 + (dy > 0 ? cdy : -cdy);
        //             const cy2 = y2 + (dy > 0 ? -cdy : cdy);
        //             pathData = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;
        //
        //             mx = 0.125 * x1 + 0.375 * x1 + 0.375 * x2 + 0.125 * x2;
        //             my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
        //         } else {
        //             let rawX1 = (fromRect.right - canvasRect.left) / scale;
        //             y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / scale;
        //             let rawX2 = (toRect.left - canvasRect.left) / scale;
        //             y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / scale;
        //
        //             if (rawX1 < rawX2) {
        //                 x1 = rawX1 + offset;
        //                 x2 = rawX2 - offset;
        //             } else {
        //                 x1 = (fromRect.left - canvasRect.left) / scale - offset;
        //                 x2 = (toRect.right - canvasRect.left) / scale + offset;
        //             }
        //
        //             const cdx = Math.abs(x2 - x1) * 0.5;
        //             const cx1 = x1 + (rawX1 < rawX2 ? cdx : -cdx);
        //             const cx2 = x2 + (rawX1 < rawX2 ? -cdx : cdx);
        //             pathData = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
        //
        //             mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
        //             my = 0.125 * y1 + 0.375 * y1 + 0.375 * y2 + 0.125 * y2;
        //         }
        //
        //         const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        //         path.setAttribute('d', pathData);
        //         path.setAttribute('class', 'connection-line');
        //         path.setAttribute('marker-end', 'url(#marker-arrow)');
        //
        //         if (rel.identifying) {
        //             path.style.strokeDasharray = 'none';
        //         } else {
        //             path.style.strokeDasharray = '8, 5';
        //         }
        //
        //         path.id = `line-${rel.from}-${rel.to}`;
        //         svgOverlay.appendChild(path);
        //
        //         // Render Floating Cardinality & Composite Key Badge (Fallback cardinality: "1 : N")
        //         const cardBase = rel.cardinality || "1 : N";
        //         const isComposite = Array.isArray(rel.fromCol);
        //         const badgeLabel = isComposite ? `${rel.fromCol.join(', ')} (${cardBase})` : cardBase;
        //
        //         const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        //         const badgeWidth = badgeLabel.length * 8.5 + 16;
        //         const badgeHeight = 18;
        //
        //         const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        //         bgRect.setAttribute('x', mx - badgeWidth / 2);
        //         bgRect.setAttribute('y', my - badgeHeight / 2);
        //         bgRect.setAttribute('width', badgeWidth);
        //         bgRect.setAttribute('height', badgeHeight);
        //         bgRect.setAttribute('rx', 4);
        //         bgRect.setAttribute('fill', '#090d16');
        //         bgRect.setAttribute('stroke', accentColor);
        //         bgRect.setAttribute('stroke-width', '1.2');
        //
        //         const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        //         badgeText.setAttribute('x', mx);
        //         badgeText.setAttribute('y', my + 3.5);
        //         badgeText.setAttribute('fill', accentColor);
        //         badgeText.setAttribute('font-size', '9.5px');
        //         badgeText.setAttribute('font-family', "'Fira Code', 'Courier New', monospace");
        //         badgeText.setAttribute('font-weight', 'bold');
        //         badgeText.setAttribute('text-anchor', 'middle');
        //         badgeText.textContent = badgeLabel;
        //
        //         badgeG.appendChild(bgRect);
        //         badgeG.appendChild(badgeText);
        //         svgOverlay.appendChild(badgeG);
        //     });
        // }

        // Switch View Tabs with Active Highlight Toggle
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

            window.addEventListener('mouseup', () => { isPanning = false; });

            workspace.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                zoomCanvas(zoomFactor);
            });
        }

        function zoomCanvas(factor) {
            scale = Math.min(Math.max(0.4, scale * factor), 2.5);
            applyTransform();
        }

        function resetZoom() {
            scale = 1;
            panX = 0;
            panY = 0;
            applyTransform();
        }

        function applyTransform() {
            canvasLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
            document.getElementById('zoom-text').innerText = `${Math.round(scale * 100)}%`;
            updateConnections();
        }

        // Drag Table Cards
        let draggingTable = null;
        let dragOffX = 0, dragOffY = 0;

        function startDragCard(e, tableId) {
            e.stopPropagation();
            draggingTable = schemaData[currentView].tables.find(t => (t.id || t.name) === tableId);
            const card = document.getElementById(`card-${tableId}`);
            
            dragOffX = (e.clientX - panX) / scale - draggingTable.x;
            dragOffY = (e.clientY - panY) / scale - draggingTable.y;

            const onMouseMove = (moveEvent) => {
                if (!draggingTable) return;
                draggingTable.x = (moveEvent.clientX - panX) / scale - dragOffX;
                draggingTable.y = (moveEvent.clientY - panY) / scale - dragOffY;
                card.style.left = `${draggingTable.x}px`;
                card.style.top = `${draggingTable.y}px`;

                // --- Magnetic Repulsion (Cascading) Logic ---
                const MIN_GAP = 60;
                const MAX_ITERATIONS = 5;
                let resolved = false;
                const tables = schemaData[currentView].tables;
                
                for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
                    resolved = true;
                    for (let i = 0; i < tables.length; i++) {
                        for (let j = i + 1; j < tables.length; j++) {
                            const t1 = tables[i];
                            const t2 = tables[j];

                            const card1 = document.getElementById(`card-${t1.id || t1.name}`);
                            const card2 = document.getElementById(`card-${t2.id || t2.name}`);
                            if (!card1 || !card2) continue;

                            const w1 = card1.offsetWidth;
                            const h1 = card1.offsetHeight;
                            const w2 = card2.offsetWidth;
                            const h2 = card2.offsetHeight;

                            const c1x = t1.x + w1 / 2;
                            const c1y = t1.y + h1 / 2;
                            const c2x = t2.x + w2 / 2;
                            const c2y = t2.y + h2 / 2;

                            const dx = c2x - c1x;
                            const dy = c2y - c1y;
                            
                            const overlapX = (w1 / 2 + w2 / 2 + MIN_GAP) - Math.abs(dx);
                            const overlapY = (h1 / 2 + h2 / 2 + MIN_GAP) - Math.abs(dy);

                            if (overlapX > 0 && overlapY > 0) {
                                resolved = false;
                                
                                let push1 = 0, push2 = 0;
                                if (t1 === draggingTable) push2 = 1;
                                else if (t2 === draggingTable) push1 = 1;
                                else { push1 = 0.5; push2 = 0.5; }

                                const signX = dx === 0 ? 1 : Math.sign(dx);
                                const signY = dy === 0 ? 1 : Math.sign(dy);

                                if (overlapX < overlapY) {
                                    t1.x -= signX * overlapX * push1;
                                    t2.x += signX * overlapX * push2;
                                } else {
                                    t1.y -= signY * overlapY * push1;
                                    t2.y += signY * overlapY * push2;
                                }
                            }
                        }
                    }
                    if (resolved) break;
                }

                // Apply updated positions to DOM
                tables.forEach(t => {
                    if (t !== draggingTable) {
                        const c = document.getElementById(`card-${t.id || t.name}`);
                        if (c) {
                            c.style.left = `${t.x}px`;
                            c.style.top = `${t.y}px`;
                        }
                    }
                });
                // --------------------------------

                updateConnections();
            };

            const onMouseUp = () => {
                draggingTable = null;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }

        // Select Table & Inspector Drawer with Guaranteed Monospace Alignment
        function selectTable(table) {
            selectedTableId = table.id || table.name;
            document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
            document.getElementById(`card-${selectedTableId}`).classList.add('selected');

            document.getElementById('drawer-table-name').innerText = table.name;
            document.getElementById('drawer-table-desc').innerText = table.desc || '';

            const maxColLen = Math.max(...table.columns.map(c => c.name.length), 22);

            let ddl = `CREATE TABLE ${table.name} (\n`;
            table.columns.forEach((c, idx) => {
                const isLast = idx === table.columns.length - 1;
                const paddedName = c.name.padEnd(maxColLen + 4, ' ');
                const pkClause = c.pk ? ' PRIMARY KEY' : '';
                ddl += `    ${paddedName}${c.type}${pkClause}${isLast ? '' : ','}\n`;
            });
            ddl += `);`;
            document.getElementById('ddl-text').innerText = ddl;

            let mock = `INSERT INTO ${table.name} (\n`;
            table.columns.forEach((c, idx) => {
                const isLast = idx === table.columns.length - 1;
                mock += `    ${c.name}${isLast ? '' : ','}\n`;
            });
            mock += `) VALUES (\n`;
            table.columns.forEach((c, idx) => {
                const isLast = idx === table.columns.length - 1;
                const val = c.type.includes('VARCHAR') ? `'STD_VALUE'` : (c.type === 'DATE' ? 'SYSDATE' : '100');
                mock += `    ${val}${isLast ? '' : ','}\n`;
            });
            mock += `);`;
            document.getElementById('mock-text').innerText = mock;

            document.getElementById('inspector').classList.add('open');
        }

        function toggleInspector() {
            document.getElementById('inspector').classList.toggle('open');
        }

        // Copy Code Helper
        function copyCode(elementId) {
            const text = document.getElementById(elementId).innerText;
            navigator.clipboard.writeText(text).then(() => {
                alert('코드가 클립보드에 복사되었습니다!');
            });
        }

        // Search Filter
        function handleSearch() {
            const query = document.getElementById('search-input').value.toLowerCase().trim();
            const view = schemaData[currentView];
            if (!view) return;

            view.tables.forEach(table => {
                const tableId = table.id || table.name;
                const card = document.getElementById(`card-${tableId}`);
                const matches = table.name.toLowerCase().includes(query) || 
                                (table.desc && table.desc.toLowerCase().includes(query)) ||
                                table.columns.some(c => c.name.toLowerCase().includes(query));

                if (query === '' || matches) {
                    card.classList.remove('dimmed');
                } else {
                    card.classList.add('dimmed');
                }
            });
        }

        // Run App
        window.onload = initApp;
