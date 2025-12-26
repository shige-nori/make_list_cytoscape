/**
 * TablePanel - テーブルデータウインドウ
 * ノード・エッジデータをテーブル形式で表示・操作
 */
class TablePanel {
    constructor() {
        this.panel = null;
        this.currentTab = 'nodes'; // 'nodes' or 'edges'
        this.nodeColumns = [];
        this.edgeColumns = [];
        this.visibleNodeColumns = new Set();
        this.visibleEdgeColumns = new Set();
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filters = {}; // { columnName: filterValue }
        this.isPopout = false;
        this.popoutWindow = null;
        this.resizing = false;
        this.panelHeight = 300;
        this.minPanelHeight = 100;
        this.maxPanelHeight = 800;
        this.showSelectedOnly = false; // ネットワーク図で選択した要素のみ表示
        this.cySelectionInProgress = false; // Cytoscape選択処理中フラグ
        this.columnWidths = {}; // カラム幅を保存
        this.columnResizing = false; // カラムリサイズ中フラグ
        this.resizingColumn = null; // リサイズ中のカラム名
        this.resizeStartX = 0; // リサイズ開始時のX座標
        this.resizeStartWidth = 0; // リサイズ開始時のカラム幅
        
        this.initialize();
    }

    /**
     * 初期化
     */
    initialize() {
        this.createPanel();
        this.setupEventListeners();
        this.setupCytoscapeListeners();
    }

    /**
     * エッジにハイライトスタイルを適用（太さに連動したオーバーレイ）
     */
    applyEdgeHighlight(edge, highlight) {
        if (highlight) {
            // エッジの現在の太さを取得
            const edgeWidth = edge.style('width');
            const width = parseFloat(edgeWidth) || 2;
            // オーバーレイパディングをエッジの太さに合わせる（エッジの太さの半分程度でエッジと同じ幅に見える）
            const overlayPadding = Math.max(1, width * 0.5);
            edge.style('overlay-padding', overlayPadding + 'px');
        } else {
            edge.style('overlay-padding', '0px');
        }
    }

    /**
     * 要素にハイライトを適用
     */
    applyHighlight(el, highlight) {
        if (el.isEdge()) {
            this.applyEdgeHighlight(el, highlight);
        }
    }

    /**
     * パネルを作成
     */
    createPanel() {
        // コンテナを作成
        this.panel = document.createElement('div');
        this.panel.id = 'table-panel';
        this.panel.className = 'table-panel';
        this.panel.innerHTML = `
            <div class="table-panel-resizer" id="table-panel-resizer"></div>
            <div class="table-panel-header">
                <span class="table-panel-title">Table Data</span>
                <div class="table-panel-tabs">
                    <button class="table-tab active" data-tab="nodes">Nodes</button>
                    <button class="table-tab" data-tab="edges">Edges</button>
                </div>
                <div class="table-panel-actions">
                    <button class="table-action-btn" id="table-columns-btn" title="カラム表示設定">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                    <button class="table-action-btn" id="table-clear-filter-btn" title="フィルターをクリア">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            <line x1="4" y1="21" x2="20" y2="5"></line>
                        </svg>
                    </button>
                    <button class="table-action-btn" id="table-popout-btn" title="ポップアウト">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                    <button class="table-action-btn" id="table-collapse-btn" title="折りたたむ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="table-panel-body">
                <div class="table-container">
                    <table class="data-table" id="data-table">
                        <thead id="data-table-head"></thead>
                        <tbody id="data-table-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="table-panel-footer">
                <span id="table-row-count">0 件</span>
                <span id="table-selected-count"></span>
            </div>
        `;
        
        // カラム設定ドロップダウン
        const columnDropdown = document.createElement('div');
        columnDropdown.id = 'column-dropdown';
        columnDropdown.className = 'column-dropdown';
        columnDropdown.innerHTML = `
            <div class="column-dropdown-header">表示カラム</div>
            <div class="column-dropdown-body" id="column-dropdown-body"></div>
            <div class="column-dropdown-footer">
                <button class="btn-small" id="column-select-all">すべて選択</button>
                <button class="btn-small" id="column-select-none">すべて解除</button>
            </div>
        `;
        this.panel.appendChild(columnDropdown);
        
        document.body.appendChild(this.panel);
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // タブ切り替え
        this.panel.querySelectorAll('.table-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // カラム設定ボタン
        document.getElementById('table-columns-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColumnDropdown();
        });

        // フィルタークリアボタン
        document.getElementById('table-clear-filter-btn').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // ポップアウトボタン
        document.getElementById('table-popout-btn').addEventListener('click', () => {
            this.togglePopout();
        });

        // 折りたたみボタン
        document.getElementById('table-collapse-btn').addEventListener('click', () => {
            this.toggleCollapse();
        });

        // カラム全選択/全解除
        document.getElementById('column-select-all').addEventListener('click', () => {
            this.selectAllColumns(true);
        });
        document.getElementById('column-select-none').addEventListener('click', () => {
            this.selectAllColumns(false);
        });

        // カラムドロップダウン外クリックで閉じる
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('column-dropdown');
            const btn = document.getElementById('table-columns-btn');
            if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // リサイズ処理
        const resizer = document.getElementById('table-panel-resizer');
        resizer.addEventListener('mousedown', (e) => {
            this.startResize(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.resizing) {
                this.doResize(e);
            }
        });

        document.addEventListener('mouseup', () => {
            this.stopResize();
        });
    }

    /**
     * Cytoscapeのイベントリスナーを設定
     */
    setupCytoscapeListeners() {
        // networkManagerの準備待ち
        const checkCy = setInterval(() => {
            if (window.networkManager && networkManager.cy) {
                clearInterval(checkCy);
                
                // 空きエリアクリックで選択解除とフィルターも解除
                networkManager.cy.on('tap', (e) => {
                    if (e.target === networkManager.cy) {
                        this.clearSelection();
                        this.showSelectedOnly = false;
                        
                        // フィルターも解除
                        this.filters = {};
                        
                        this.renderTable();
                        
                        // ポップアウトウィンドウも更新
                        if (this.isPopout && this.popoutWindow && !this.popoutWindow.closed) {
                            this.renderPopoutTable(this.popoutWindow.document);
                        }
                    }
                });

                // ノード/エッジ選択時
                networkManager.cy.on('select', 'node, edge', (e) => {
                    if (this.cySelectionInProgress) return;
                    this.handleCySelection();
                });

                // ノード/エッジ選択解除時
                networkManager.cy.on('unselect', 'node, edge', (e) => {
                    if (this.cySelectionInProgress) return;
                    this.handleCySelection();
                });

                // ノード/エッジ追加時にテーブル更新
                networkManager.cy.on('add', () => {
                    this.refresh();
                });

                // ノード/エッジ削除時にテーブル更新
                networkManager.cy.on('remove', () => {
                    this.refresh();
                });
            }
        }, 100);
    }

    /**
     * Cytoscapeでの選択変更を処理
     */
    handleCySelection() {
        if (!window.networkManager || !networkManager.cy) return;

        const selectedNodes = networkManager.cy.nodes(':selected');
        const selectedEdges = networkManager.cy.edges(':selected');

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
            // 選択がある場合
            this.showSelectedOnly = true;

            // 選択されていない要素を薄くする
            networkManager.cy.nodes().forEach(node => {
                if (node.selected()) {
                    node.removeClass('filtered-out').addClass('filtered-in table-highlighted');
                } else {
                    node.removeClass('filtered-in table-highlighted').addClass('filtered-out');
                }
            });
            networkManager.cy.edges().forEach(edge => {
                if (edge.selected()) {
                    edge.removeClass('filtered-out').addClass('filtered-in table-highlighted');
                    this.applyEdgeHighlight(edge, true);
                } else {
                    edge.removeClass('filtered-in table-highlighted').addClass('filtered-out');
                    this.applyEdgeHighlight(edge, false);
                }
            });

            // 選択されたノードがあればノードタブに、エッジがあればエッジタブに切り替え
            if (selectedNodes.length > 0 && this.currentTab !== 'nodes') {
                this.switchTab('nodes');
            } else if (selectedNodes.length === 0 && selectedEdges.length > 0 && this.currentTab !== 'edges') {
                this.switchTab('edges');
            } else {
                this.renderTable();
            }
        } else {
            // 選択がない場合
            this.showSelectedOnly = false;
            networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
            // エッジのオーバーレイをリセット
            networkManager.cy.edges().forEach(edge => {
                this.applyEdgeHighlight(edge, false);
            });
            this.renderTable();
        }

        // テーブルの選択状態も更新
        this.syncTableSelectionFromCy();
    }

    /**
     * Cytoscapeの選択状態をテーブルに同期
     */
    syncTableSelectionFromCy() {
        if (!window.networkManager || !networkManager.cy) return;

        const selectedElements = this.currentTab === 'nodes' 
            ? networkManager.cy.nodes(':selected') 
            : networkManager.cy.edges(':selected');
        
        const selectedIds = new Set();
        selectedElements.forEach(el => selectedIds.add(el.id()));

        document.querySelectorAll('#data-table-body tr').forEach(row => {
            if (selectedIds.has(row.dataset.id)) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });

        // 選択件数を更新
        const selectedCount = selectedIds.size;
        document.getElementById('table-selected-count').textContent = 
            selectedCount > 0 ? `（${selectedCount} 件選択中）` : '';
    }

    /**
     * パネルを表示
     */
    show() {
        this.panel.classList.add('active');
        this.updateCyHeight();
        this.refresh();
    }

    /**
     * パネルを非表示
     */
    hide() {
        this.panel.classList.remove('active');
        this.resetCyHeight();
    }

    /**
     * パネルの表示/非表示を切り替え
     */
    toggle() {
        if (this.panel.classList.contains('active')) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * タブを切り替え
     */
    switchTab(tab) {
        this.currentTab = tab;
        this.panel.querySelectorAll('.table-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.renderTable();
    }

    /**
     * テーブルを更新
     */
    refresh() {
        this.updateColumns();
        this.renderTable();
    }

    /**
     * カラム情報を更新
     */
    updateColumns() {
        if (!window.networkManager || !networkManager.cy) return;

        // ノードカラムを取得
        const nodeColumns = new Set(['id', 'label']);
        networkManager.cy.nodes().forEach(node => {
            Object.keys(node.data()).forEach(key => {
                nodeColumns.add(key);
            });
        });
        const newNodeColumns = Array.from(nodeColumns);
        
        // 新しく追加されたカラムを検出して自動的に表示対象に追加
        newNodeColumns.forEach(col => {
            if (!this.nodeColumns.includes(col)) {
                // 新しいカラムなので表示対象に追加
                this.visibleNodeColumns.add(col);
            }
        });
        this.nodeColumns = newNodeColumns;
        
        // 初回は全カラム表示
        if (this.visibleNodeColumns.size === 0) {
            this.visibleNodeColumns = new Set(this.nodeColumns);
        }

        // エッジカラムを取得
        const edgeColumns = new Set(['id', 'source', 'target']);
        networkManager.cy.edges().forEach(edge => {
            Object.keys(edge.data()).forEach(key => {
                edgeColumns.add(key);
            });
        });
        const newEdgeColumns = Array.from(edgeColumns);
        
        // 新しく追加されたカラムを検出して自動的に表示対象に追加
        newEdgeColumns.forEach(col => {
            if (!this.edgeColumns.includes(col)) {
                // 新しいカラムなので表示対象に追加
                this.visibleEdgeColumns.add(col);
            }
        });
        this.edgeColumns = newEdgeColumns;
        
        // 初回は全カラム表示
        if (this.visibleEdgeColumns.size === 0) {
            this.visibleEdgeColumns = new Set(this.edgeColumns);
        }
    }

    /**
     * テーブルを描画
     */
    renderTable() {
        if (!window.networkManager || !networkManager.cy) return;

        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        const elements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();

        // ヘッダー描画
        const thead = document.getElementById('data-table-head');
        thead.innerHTML = '';
        
        const headerRow = document.createElement('tr');
        
        // フィルター行
        const filterRow = document.createElement('tr');
        filterRow.className = 'filter-row';

        columns.forEach(col => {
            if (!visibleColumns.has(col)) return;

            // ヘッダーセル
            const th = document.createElement('th');
            th.dataset.column = col;
            
            // 保存されたカラム幅があれば適用
            const savedWidth = this.columnWidths[col];
            if (savedWidth) {
                th.style.width = savedWidth + 'px';
                th.style.minWidth = savedWidth + 'px';
            }
            
            th.innerHTML = `
                <div class="th-content">
                    <span class="th-label">${col}</span>
                    <span class="sort-icon">${this.getSortIcon(col)}</span>
                </div>
                <div class="column-resizer" data-column="${col}"></div>
            `;
            
            // ソートはth-contentクリック時のみ
            th.querySelector('.th-content').addEventListener('click', () => this.toggleSort(col));
            
            // リサイズハンドルのイベント
            const resizer = th.querySelector('.column-resizer');
            resizer.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startColumnResize(e, col, th);
            });
            
            headerRow.appendChild(th);

            // フィルターセル
            const filterTd = document.createElement('td');
            filterTd.className = 'filter-cell';
            filterTd.dataset.column = col;
            
            // 保存されたカラム幅があれば適用
            if (savedWidth) {
                filterTd.style.width = savedWidth + 'px';
                filterTd.style.minWidth = savedWidth + 'px';
            }
            
            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.className = 'filter-input';
            filterInput.placeholder = 'フィルター...';
            filterInput.value = this.filters[col] || '';
            filterInput.addEventListener('input', (e) => {
                this.setFilter(col, e.target.value);
            });
            filterTd.appendChild(filterInput);
            filterRow.appendChild(filterTd);
        });

        thead.appendChild(headerRow);
        thead.appendChild(filterRow);

        // データ取得
        let data = elements.map(el => {
            const rowData = { _element: el };
            columns.forEach(col => {
                rowData[col] = el.data(col);
            });
            return rowData;
        });

        // ネットワーク図で選択された要素のみ表示する場合
        if (this.showSelectedOnly) {
            data = data.filter(row => row._element.selected());
        }

        // フィルター適用
        data = this.applyFilters(data, columns);

        // ソート適用
        if (this.sortColumn) {
            data = this.applySorting(data);
        }

        // ボディ描画
        const tbody = document.getElementById('data-table-body');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;
            
            columns.forEach(col => {
                if (!visibleColumns.has(col)) return;
                const td = document.createElement('td');
                td.dataset.column = col;
                
                // 値を取得して表示形式を決定
                const value = row[col];
                let displayText = '';
                
                if (value === undefined || value === null) {
                    displayText = '';
                } else if (Array.isArray(value)) {
                    // 配列の各要素をそのまま改行区切りで表示（要素内のカンマは無視）
                    displayText = value.map(item => String(item).trim()).join('\n');
                    td.style.whiteSpace = 'pre-wrap';
                } else {
                    displayText = String(value);
                }
                
                td.textContent = displayText;
                td.title = displayText;
                
                // 保存されたカラム幅があれば適用
                const savedWidth = this.columnWidths[col];
                if (savedWidth) {
                    td.style.width = savedWidth + 'px';
                    td.style.minWidth = savedWidth + 'px';
                    td.style.maxWidth = savedWidth + 'px';
                }
                
                tr.appendChild(td);
            });

            tr.addEventListener('click', (e) => {
                this.selectRow(tr, row._element, e.ctrlKey || e.metaKey);
            });

            tbody.appendChild(tr);
        });

        // 件数表示
        document.getElementById('table-row-count').textContent = `${data.length} 件`;

        // ネットワーク図でフィルター結果をハイライト
        this.highlightFilteredElements(data);
    }

    /**
     * ソートアイコンを取得
     */
    getSortIcon(column) {
        if (this.sortColumn !== column) return '';
        return this.sortDirection === 'asc' ? '▲' : '▼';
    }

    /**
     * ソートを切り替え
     */
    toggleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.renderTable();
    }

    /**
     * ソートを適用
     */
    applySorting(data) {
        const col = this.sortColumn;
        const dir = this.sortDirection === 'asc' ? 1 : -1;

        return data.sort((a, b) => {
            const valA = a[col];
            const valB = b[col];

            // 数値比較
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return (numA - numB) * dir;
            }

            // 文字列比較
            const strA = String(valA || '').toLowerCase();
            const strB = String(valB || '').toLowerCase();
            return strA.localeCompare(strB) * dir;
        });
    }

    /**
     * フィルターを設定
     */
    setFilter(column, value) {
        if (value) {
            this.filters[column] = value;
        } else {
            delete this.filters[column];
        }
        this.renderTable();
    }

    /**
     * フィルターを適用
     */
    applyFilters(data, columns) {
        return data.filter(row => {
            return Object.entries(this.filters).every(([col, filterValue]) => {
                const cellValue = String(row[col] || '').toLowerCase();
                return cellValue.includes(filterValue.toLowerCase());
            });
        });
    }

    /**
     * 全フィルターをクリア
     */
    clearAllFilters() {
        this.filters = {};
        this.renderTable();
        
        // ネットワーク図の選択も解除
        if (window.networkManager && networkManager.cy) {
            networkManager.cy.elements().unselect();
            networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
            // エッジのオーバーレイをリセット
            networkManager.cy.edges().forEach(edge => this.applyEdgeHighlight(edge, false));
        }
    }

    /**
     * 行を選択
     */
    selectRow(tr, element, isMulti, popoutDoc = null) {
        if (!window.networkManager || !networkManager.cy) return;

        // 対象のドキュメント（ポップアウトかメインか）
        const targetDoc = popoutDoc || document;
        const mainDoc = document;

        // Cytoscape選択イベントのループを防ぐ
        this.cySelectionInProgress = true;

        if (!isMulti) {
            // 単一選択：既存の選択をクリア（両方のドキュメント）
            targetDoc.querySelectorAll('#data-table-body tr.selected').forEach(row => {
                row.classList.remove('selected');
            });
            mainDoc.querySelectorAll('#data-table-body tr.selected').forEach(row => {
                row.classList.remove('selected');
            });
            // ネットワーク図のハイライトをクリア
            networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
            networkManager.cy.edges().forEach(edge => this.applyEdgeHighlight(edge, false));
            networkManager.cy.elements().unselect();
        }

        // 行を選択状態に
        tr.classList.toggle('selected');
        
        // ネットワーク図の要素を選択・ハイライト
        if (tr.classList.contains('selected')) {
            element.select();
            // 他の要素を薄くする
            const selectedRows = targetDoc.querySelectorAll('#data-table-body tr.selected');
            const selectedIds = Array.from(selectedRows).map(row => row.dataset.id);
            
            const allElements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();
            allElements.forEach(el => {
                if (selectedIds.includes(el.id())) {
                    el.removeClass('filtered-out').addClass('filtered-in table-highlighted');
                    if (el.isEdge()) this.applyEdgeHighlight(el, true);
                } else {
                    el.removeClass('filtered-in table-highlighted').addClass('filtered-out');
                    if (el.isEdge()) this.applyEdgeHighlight(el, false);
                }
            });
        } else {
            element.unselect();
            element.removeClass('filtered-in table-highlighted');
            if (element.isEdge()) this.applyEdgeHighlight(element, false);
            
            // 他に選択があるか確認
            const selectedRows = targetDoc.querySelectorAll('#data-table-body tr.selected');
            if (selectedRows.length === 0) {
                // 全選択解除ならハイライトも解除
                networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
                networkManager.cy.edges().forEach(edge => this.applyEdgeHighlight(edge, false));
            } else {
                // まだ選択があるなら再計算
                const selectedIds = Array.from(selectedRows).map(row => row.dataset.id);
                const allElements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();
                allElements.forEach(el => {
                    if (selectedIds.includes(el.id())) {
                        el.removeClass('filtered-out').addClass('filtered-in table-highlighted');
                        if (el.isEdge()) this.applyEdgeHighlight(el, true);
                    } else {
                        el.removeClass('filtered-in table-highlighted').addClass('filtered-out');
                        if (el.isEdge()) this.applyEdgeHighlight(el, false);
                    }
                });
            }
        }

        // 選択件数を更新（両方のドキュメント）
        const selectedCount = targetDoc.querySelectorAll('#data-table-body tr.selected').length;
        const countText = selectedCount > 0 ? `（${selectedCount} 件選択中）` : '';
        
        const targetCountEl = targetDoc.getElementById('table-selected-count');
        if (targetCountEl) targetCountEl.textContent = countText;
        
        const mainCountEl = mainDoc.getElementById('table-selected-count');
        if (mainCountEl) mainCountEl.textContent = countText;

        // フラグをリセット
        setTimeout(() => {
            this.cySelectionInProgress = false;
        }, 10);
    }

    /**
     * 選択を解除
     */
    clearSelection() {
        document.querySelectorAll('#data-table-body tr.selected').forEach(row => {
            row.classList.remove('selected');
        });
        document.getElementById('table-selected-count').textContent = '';
        this.showSelectedOnly = false;
        
        // Cytoscape選択イベントのループを防ぐ
        this.cySelectionInProgress = true;
        
        // ネットワーク図の選択・ハイライトも解除
        if (window.networkManager && networkManager.cy) {
            networkManager.cy.elements().unselect();
            networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
        }

        // フラグをリセット
        setTimeout(() => {
            this.cySelectionInProgress = false;
        }, 10);
    }

    /**
     * フィルター結果をネットワーク図でハイライト
     */
    highlightFilteredElements(filteredData) {
        if (!window.networkManager || !networkManager.cy) return;

        // フィルターがない場合は何もしない
        if (Object.keys(this.filters).length === 0) {
            networkManager.cy.elements().removeClass('filtered-out filtered-in table-highlighted');
            networkManager.cy.edges().forEach(edge => this.applyEdgeHighlight(edge, false));
            return;
        }

        // Cytoscape選択イベントのループを防ぐ
        this.cySelectionInProgress = true;

        const elements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();
        const filteredIds = new Set(filteredData.map(d => d.id));

        // 全要素に対してフィルター結果を適用
        elements.forEach(el => {
            if (filteredIds.has(el.id())) {
                el.removeClass('filtered-out').addClass('filtered-in table-highlighted');
                if (el.isEdge()) this.applyEdgeHighlight(el, true);
                el.select(); // フィルターに合致した要素を選択状態に
            } else {
                el.removeClass('filtered-in table-highlighted').addClass('filtered-out');
                if (el.isEdge()) this.applyEdgeHighlight(el, false);
                el.unselect();
            }
        });

        // フラグをリセット
        setTimeout(() => {
            this.cySelectionInProgress = false;
        }, 10);
    }

    /**
     * カラムドロップダウンを表示/非表示
     */
    toggleColumnDropdown() {
        const dropdown = document.getElementById('column-dropdown');
        dropdown.classList.toggle('active');
        
        if (dropdown.classList.contains('active')) {
            this.renderColumnDropdown();
        }
    }

    /**
     * カラムドロップダウンを描画
     */
    renderColumnDropdown() {
        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        const body = document.getElementById('column-dropdown-body');
        body.innerHTML = '';

        columns.forEach(col => {
            const label = document.createElement('label');
            label.className = 'column-checkbox';
            label.innerHTML = `
                <input type="checkbox" ${visibleColumns.has(col) ? 'checked' : ''} data-column="${col}">
                <span>${col}</span>
            `;
            label.querySelector('input').addEventListener('change', (e) => {
                this.toggleColumnVisibility(col, e.target.checked);
            });
            body.appendChild(label);
        });
    }

    /**
     * カラムの表示/非表示を切り替え
     */
    toggleColumnVisibility(column, visible) {
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        if (visible) {
            visibleColumns.add(column);
        } else {
            visibleColumns.delete(column);
        }
        
        this.renderTable();
    }

    /**
     * 全カラムを選択/解除
     */
    selectAllColumns(select) {
        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        
        visibleColumns.clear();
        if (select) {
            columns.forEach(col => visibleColumns.add(col));
        }
        
        this.renderColumnDropdown();
        this.renderTable();
    }

    /**
     * ポップアウトを切り替え
     */
    togglePopout() {
        if (this.isPopout) {
            this.popIn();
        } else {
            this.popOut();
        }
    }

    /**
     * ポップアウト
     */
    popOut() {
        const width = 800;
        const height = 500;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        this.popoutWindow = window.open('', 'TablePanel', 
            `width=${width},height=${height},left=${left},top=${top},resizable=yes`);
        
        if (!this.popoutWindow) {
            alert('ポップアップがブロックされました。許可してください。');
            return;
        }

        // ポップアウトウィンドウのHTMLを構築
        const doc = this.popoutWindow.document;
        doc.write(`
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>Table Data - Network Visualizer</title>
                <link rel="stylesheet" href="css/style.css">
                <style>
                    body { padding: 0; margin: 0; overflow: hidden; }
                    .table-panel { 
                        position: static; 
                        height: 100vh; 
                        display: flex;
                        flex-direction: column;
                    }
                    .table-panel-resizer { display: none; }
                    #table-popout-btn svg { transform: rotate(180deg); }
                    .table-panel-content {
                        flex: 1;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .table-panel-body {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        min-height: 0;
                    }
                    .table-container {
                        flex: 1;
                        overflow: auto;
                        max-height: none !important;
                        min-height: 0;
                    }
                    /* ポップアウトウィンドウ用のカラムドロップダウン */
                    .column-dropdown {
                        position: absolute;
                        top: 40px;
                        right: 10px;
                        width: 220px;
                        max-height: 350px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                        display: none;
                        flex-direction: column;
                        z-index: 1000;
                    }
                    .column-dropdown.active {
                        display: flex;
                    }
                    .column-dropdown-header {
                        padding: 12px 16px;
                        font-weight: 600;
                        font-size: 13px;
                        border-bottom: 1px solid #e2e8f0;
                        background: #f8fafc;
                        border-radius: 8px 8px 0 0;
                    }
                    .column-dropdown-body {
                        flex: 1;
                        overflow-y: auto;
                        padding: 8px;
                        max-height: 200px;
                    }
                    .column-checkbox {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 6px 8px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-size: 13px;
                    }
                    .column-checkbox:hover {
                        background: #f1f5f9;
                    }
                    .column-checkbox input {
                        margin: 0;
                    }
                    .column-dropdown-footer {
                        display: flex;
                        gap: 8px;
                        padding: 8px;
                        border-top: 1px solid #e2e8f0;
                        background: #f8fafc;
                        border-radius: 0 0 8px 8px;
                    }
                    .btn-small {
                        flex: 1;
                        padding: 6px 12px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-small:hover {
                        background: #f1f5f9;
                    }
                </style>
            </head>
            <body></body>
            </html>
        `);
        doc.close();

        // パネルをポップアウトウィンドウに移動
        const panelClone = this.panel.cloneNode(true);
        panelClone.classList.add('active');
        
        // ポップアウトウィンドウでは折りたたみボタンを非表示
        const collapseBtn = panelClone.querySelector('#table-collapse-btn');
        if (collapseBtn) {
            collapseBtn.style.display = 'none';
        }
        
        doc.body.appendChild(panelClone);

        // イベントリスナーを再設定
        this.setupPopoutEventListeners(doc);

        // 元のパネルを非表示
        this.panel.style.display = 'none';
        this.resetCyHeight();
        this.isPopout = true;

        // ポップアウトウィンドウが閉じられたらTable panelを非表示にする
        this.popoutWindow.addEventListener('beforeunload', () => {
            this.closeFromPopout();
        });
    }

    /**
     * ポップアウトから閉じたときの処理（Table panelを終了）
     */
    closeFromPopout() {
        this.popoutWindow = null;
        this.isPopout = false;
        this.panel.style.display = '';
        this.hide();
    }

    /**
     * ポップアウトウィンドウ用のイベントリスナー
     */
    setupPopoutEventListeners(doc) {
        // タブ切り替え
        doc.querySelectorAll('.table-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.currentTab = tabName;
                
                // タブのアクティブ状態を更新（ポップアウトウィンドウ側）
                doc.querySelectorAll('.table-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.tab === tabName);
                });
                
                // メインウィンドウ側のタブも更新
                document.querySelectorAll('.table-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.tab === tabName);
                });
                
                this.renderPopoutTable(doc);
            });
        });

        // ポップインボタン
        doc.getElementById('table-popout-btn').addEventListener('click', () => {
            this.popIn();
        });

        // フィルタークリアボタン
        const clearFilterBtn = doc.getElementById('table-clear-filter-btn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                this.clearAllFilters();
                this.renderPopoutTable(doc);
            });
        }

        // カラム設定ボタン
        const columnBtn = doc.getElementById('table-columns-btn');
        if (columnBtn) {
            columnBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = doc.getElementById('column-dropdown');
                if (dropdown) {
                    const isVisible = dropdown.classList.contains('active');
                    if (!isVisible) {
                        this.renderPopoutColumnDropdown(doc);
                    }
                    dropdown.classList.toggle('active');
                }
            });
        }

        // ドロップダウン外クリックで閉じる
        doc.addEventListener('click', (e) => {
            const dropdown = doc.getElementById('column-dropdown');
            const columnBtn = doc.getElementById('table-columns-btn');
            if (dropdown && !dropdown.contains(e.target) && e.target !== columnBtn && !columnBtn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // 選択のみ表示ボタン
        const selectedOnlyBtn = doc.getElementById('table-selected-only-btn');
        if (selectedOnlyBtn) {
            selectedOnlyBtn.addEventListener('click', () => {
                this.showSelectedOnly = !this.showSelectedOnly;
                selectedOnlyBtn.classList.toggle('active', this.showSelectedOnly);
                document.getElementById('table-selected-only-btn').classList.toggle('active', this.showSelectedOnly);
                this.renderTable();
                this.renderPopoutTable(doc);
            });
        }

        // 初期テーブル描画
        this.renderPopoutTable(doc);
    }

    /**
     * ポップアウトウィンドウのカラムドロップダウンを描画
     */
    renderPopoutColumnDropdown(doc) {
        let dropdown = doc.getElementById('column-dropdown');
        if (!dropdown) return;
        
        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;

        // ドロップダウンの内容を更新（メインウィンドウと同じ構造）
        const dropdownBody = dropdown.querySelector('#column-dropdown-body') || dropdown.querySelector('.column-dropdown-body');
        if (dropdownBody) {
            dropdownBody.innerHTML = columns.map(col => `
                <label class="column-checkbox">
                    <input type="checkbox" ${visibleColumns.has(col) ? 'checked' : ''} data-column="${col}">
                    <span>${col}</span>
                </label>
            `).join('');

            // 各チェックボックス
            dropdownBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const col = e.target.dataset.column;
                    this.toggleColumnVisibility(col, e.target.checked);
                    this.renderPopoutTable(doc);
                });
            });
        }

        // 全選択/全解除ボタン
        const selectAllBtn = dropdown.querySelector('#column-select-all');
        const selectNoneBtn = dropdown.querySelector('#column-select-none');
        
        if (selectAllBtn) {
            // 既存のリスナーを削除するためクローンで置き換え
            const newSelectAllBtn = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
            newSelectAllBtn.addEventListener('click', () => {
                this.selectAllColumns(true);
                this.renderPopoutColumnDropdown(doc);
                this.renderPopoutTable(doc);
            });
        }
        
        if (selectNoneBtn) {
            const newSelectNoneBtn = selectNoneBtn.cloneNode(true);
            selectNoneBtn.parentNode.replaceChild(newSelectNoneBtn, selectNoneBtn);
            newSelectNoneBtn.addEventListener('click', () => {
                this.selectAllColumns(false);
                this.renderPopoutColumnDropdown(doc);
                this.renderPopoutTable(doc);
            });
        }
    }

    /**
     * ポップアウトウィンドウのテーブルを描画
     */
    renderPopoutTable(doc) {
        if (!window.networkManager || !networkManager.cy) return;

        const columns = this.currentTab === 'nodes' ? this.nodeColumns : this.edgeColumns;
        const visibleColumns = this.currentTab === 'nodes' ? this.visibleNodeColumns : this.visibleEdgeColumns;
        const elements = this.currentTab === 'nodes' ? networkManager.cy.nodes() : networkManager.cy.edges();

        // ヘッダー描画
        const thead = doc.getElementById('data-table-head');
        thead.innerHTML = '';
        
        const headerRow = document.createElement('tr');
        const filterRow = document.createElement('tr');
        filterRow.className = 'filter-row';

        columns.forEach(col => {
            if (!visibleColumns.has(col)) return;

            // ヘッダーセル
            const th = document.createElement('th');
            th.dataset.column = col;
            
            const savedWidth = this.columnWidths[col];
            if (savedWidth) {
                th.style.width = savedWidth + 'px';
                th.style.minWidth = savedWidth + 'px';
            }
            
            th.innerHTML = `
                <div class="th-content">
                    <span class="th-label">${col}</span>
                    <span class="sort-icon">${this.getSortIcon(col)}</span>
                </div>
            `;
            
            th.querySelector('.th-content').addEventListener('click', () => {
                this.toggleSort(col);
                this.renderPopoutTable(doc);
            });
            
            headerRow.appendChild(th);

            // フィルターセル
            const filterTd = document.createElement('td');
            filterTd.className = 'filter-cell';
            filterTd.dataset.column = col;
            
            if (savedWidth) {
                filterTd.style.width = savedWidth + 'px';
                filterTd.style.minWidth = savedWidth + 'px';
            }
            
            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.className = 'filter-input';
            filterInput.placeholder = 'フィルター...';
            filterInput.value = this.filters[col] || '';
            filterInput.addEventListener('input', (e) => {
                this.setFilter(col, e.target.value);
                this.renderPopoutTable(doc);
            });
            filterTd.appendChild(filterInput);
            filterRow.appendChild(filterTd);
        });

        thead.appendChild(headerRow);
        thead.appendChild(filterRow);

        // データ取得
        let data = elements.map(el => {
            const rowData = { _element: el };
            columns.forEach(col => {
                rowData[col] = el.data(col);
            });
            return rowData;
        });

        // ネットワーク図で選択された要素のみ表示する場合
        if (this.showSelectedOnly) {
            data = data.filter(row => row._element.selected());
        }

        // フィルター適用
        data = this.applyFilters(data, columns);

        // ソート適用
        if (this.sortColumn) {
            data = this.applySorting(data);
        }

        // ボディ描画
        const tbody = doc.getElementById('data-table-body');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;
            
            // 選択状態を反映
            if (row._element.selected()) {
                tr.classList.add('selected');
            }
            
            columns.forEach(col => {
                if (!visibleColumns.has(col)) return;
                const td = document.createElement('td');
                td.dataset.column = col;
                
                const value = row[col];
                let displayText = '';
                
                if (value === undefined || value === null) {
                    displayText = '';
                } else if (Array.isArray(value)) {
                    displayText = value.map(item => String(item).trim()).join('\n');
                    td.style.whiteSpace = 'pre-wrap';
                } else {
                    displayText = String(value);
                }
                
                td.textContent = displayText;
                td.title = displayText;
                
                const savedWidth = this.columnWidths[col];
                if (savedWidth) {
                    td.style.width = savedWidth + 'px';
                    td.style.minWidth = savedWidth + 'px';
                    td.style.maxWidth = savedWidth + 'px';
                }
                
                tr.appendChild(td);
            });

            // 行クリックでネットワーク図の要素を選択
            tr.addEventListener('click', (e) => {
                this.selectRow(tr, row._element, e.ctrlKey || e.metaKey, doc);
            });

            tbody.appendChild(tr);
        });

        // 件数表示
        const rowCount = doc.getElementById('table-row-count');
        if (rowCount) {
            rowCount.textContent = `${data.length} 件`;
        }

        // ネットワーク図でフィルター結果をハイライト
        this.highlightFilteredElements(data);
    }

    /**
     * ポップイン（元に戻す）
     */
    popIn() {
        if (this.popoutWindow && !this.popoutWindow.closed) {
            this.popoutWindow.close();
        }
        this.popoutWindow = null;
        this.isPopout = false;
        this.panel.style.display = '';
        this.show();
    }

    /**
     * 折りたたみを切り替え（ヘッダー行を残してパネルを折りたたむ）
     */
    toggleCollapse() {
        const isCollapsed = this.panel.classList.toggle('collapsed');
        const btn = document.getElementById('table-collapse-btn');
        
        if (isCollapsed) {
            // 折りたたみ時：ヘッダー行（36px）だけ残す
            this.panel.style.height = '36px';
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            `;
            btn.title = '展開する';
        } else {
            // 展開時：元の高さに戻す
            this.panel.style.height = this.panelHeight + 'px';
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            btn.title = '折りたたむ';
        }
        this.updateCyHeight();
    }

    /**
     * リサイズ開始
     */
    startResize(e) {
        this.resizing = true;
        this.startY = e.clientY;
        this.startHeight = this.panel.offsetHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }

    /**
     * リサイズ中
     */
    doResize(e) {
        const diff = this.startY - e.clientY;
        let newHeight = this.startHeight + diff;
        newHeight = Math.max(this.minPanelHeight, Math.min(this.maxPanelHeight, newHeight));
        this.panelHeight = newHeight;
        this.panel.style.height = newHeight + 'px';
        this.updateCyHeight();
    }

    /**
     * リサイズ終了
     */
    stopResize() {
        if (this.resizing) {
            this.resizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }

    /**
     * カラムリサイズ開始
     */
    startColumnResize(e, column, th) {
        this.columnResizing = true;
        this.resizingColumn = column;
        this.resizeStartX = e.clientX;
        this.resizeStartWidth = th.offsetWidth;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        // グローバルイベントリスナーを追加
        document.addEventListener('mousemove', this.handleColumnResize);
        document.addEventListener('mouseup', this.handleColumnResizeEnd);
    }

    /**
     * カラムリサイズ中のハンドラ（バインド用）
     */
    handleColumnResize = (e) => {
        if (!this.columnResizing) return;
        
        const diff = e.clientX - this.resizeStartX;
        const newWidth = Math.max(50, this.resizeStartWidth + diff); // 最小幅50px
        
        // カラム幅を保存
        this.columnWidths[this.resizingColumn] = newWidth;
        
        // 全ての該当カラムセルに幅を適用
        const cells = document.querySelectorAll(`[data-column="${this.resizingColumn}"]`);
        cells.forEach(cell => {
            cell.style.width = newWidth + 'px';
            cell.style.minWidth = newWidth + 'px';
            if (cell.tagName === 'TD') {
                cell.style.maxWidth = newWidth + 'px';
            }
        });
    }

    /**
     * カラムリサイズ終了のハンドラ（バインド用）
     */
    handleColumnResizeEnd = () => {
        if (this.columnResizing) {
            this.columnResizing = false;
            this.resizingColumn = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // グローバルイベントリスナーを削除
            document.removeEventListener('mousemove', this.handleColumnResize);
            document.removeEventListener('mouseup', this.handleColumnResizeEnd);
        }
    }

    /**
     * ネットワーク図の高さを更新
     */
    updateCyHeight() {
        const cy = document.getElementById('cy');
        if (this.panel.classList.contains('collapsed')) {
            // 折りたたみ時はヘッダー行の高さ分だけ確保
            cy.style.bottom = '36px';
        } else if (this.panel.classList.contains('active')) {
            cy.style.bottom = this.panelHeight + 'px';
        } else {
            cy.style.bottom = '0';
        }
        
        // Cytoscapeのリサイズ
        if (window.networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
    }

    /**
     * ネットワーク図の高さをリセット
     */
    resetCyHeight() {
        const cy = document.getElementById('cy');
        cy.style.bottom = '0';
        
        if (window.networkManager && networkManager.cy) {
            networkManager.cy.resize();
        }
    }
}

// グローバルインスタンス
const tablePanel = new TablePanel();
window.tablePanel = tablePanel;
