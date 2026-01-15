/**
 * NetworkManager - Cytoscape.jsネットワークの管理
 */
class NetworkManager {
    constructor() {
        this.cy = null;
        this.nodes = new Map();
        this.edges = [];
        this.nodeAttributes = new Map();
        this.edgeAttributes = [];
    }

    /**
     * Cytoscapeを初期化
     */
    initialize() {
        // Dagre拡張を登録
        if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
            cytoscape.use(cytoscapeDagre);
        }

        this.cy = cytoscape({
            container: document.getElementById('cy'),
            elements: [],
            style: this.getDefaultStyle(),
            layout: { name: 'preset' },
            minZoom: 0.01,
            maxZoom: 10,
            wheelSensitivity: 0.1
        });

        this.setupHoverHighlight();
        this.showEmptyState();
    }

    /**
     * デフォルトスタイルを取得
     * @returns {Array}
     */
    getDefaultStyle() {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': '#2563eb',
                    'label': 'data(label)',
                    'color': '#1e293b',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'font-weight': '500',
                    'text-margin-y': 8,
                    'width': 40,
                    'height': 40,
                    'border-width': 3,
                    'border-color': '#1d4ed8',
                    'text-wrap': 'wrap',
                    'text-max-width': '100px',
                    'overlay-opacity': 0,
                    'overlay-shape': 'ellipse'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'background-color': '#fed7aa',
                    'border-color': '#ea580c',
                    'border-width': 3,
                    'overlay-color': '#f97316',
                    'overlay-padding': 8,
                    'overlay-opacity': 0.4
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#94a3b8',
                    'target-arrow-color': '#64748b',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.2,
                    'overlay-opacity': 0
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'line-color': '#ea580c',
                    'target-arrow-color': '#c2410c',
                    'overlay-color': '#f97316',
                    'overlay-padding': 2,
                    'overlay-opacity': 0.5
                }
            },
            // テーブルからのハイライト（ノード）
            {
                selector: 'node.table-highlighted, node.filtered-in',
                style: {
                    'overlay-color': '#f97316',
                    'overlay-padding': 10,
                    'overlay-opacity': 0.4
                }
            },
            // テーブルからのハイライト（エッジ）- エッジの太さに連動（tablePanel.jsで動的に設定）
            {
                selector: 'edge.table-highlighted, edge.filtered-in',
                style: {
                    'line-color': '#ea580c',
                    'target-arrow-color': '#c2410c',
                    'overlay-color': '#f97316',
                    'overlay-opacity': 0.5
                }
            },
            // ホバーハイライト用スタイル
            {
                selector: 'node.hover-highlighted',
                style: {
                    'background-color': '#ff1493',
                    'border-color': '#ff1493',
                    'opacity': 1
                }
            },
            {
                selector: 'edge.hover-highlighted',
                style: {
                    'line-color': '#ff1493',
                    'target-arrow-color': '#ff1493',
                    'opacity': 1
                }
            },
            // ホバー時の非ハイライト要素（透明度50%）
            {
                selector: 'node.hover-dimmed',
                style: {
                    'opacity': 0.5
                }
            },
            {
                selector: 'edge.hover-dimmed',
                style: {
                    'opacity': 0.5
                }
            }
        ];
    }

    /**
     * 空の状態を表示
     */
    showEmptyState() {
        const existingEmpty = document.querySelector('.empty-state');
        if (existingEmpty) {
            existingEmpty.remove();
        }

        if (this.cy.elements().length === 0) {
            const container = document.getElementById('cy');
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-text">No Network Data</div>
                <div class="empty-state-hint">File → Import → Network File to get started</div>
            `;
            container.appendChild(emptyState);
        }
    }

    /**
     * 空の状態を非表示
     */
    hideEmptyState() {
        const existingEmpty = document.querySelector('.empty-state');
        if (existingEmpty) {
            existingEmpty.remove();
        }
    }

    /**
     * ネットワークデータをインポート
     * @param {Object} params
     * @param {any[][]} params.data - データ行
     * @param {Object} params.columnSettings - カラム設定
     */
    importNetworkData({ data, columnSettings }) {
        const sourceCol = columnSettings.source;
        const targetCol = columnSettings.target;
        const attributes = columnSettings.attributes;

        data.forEach((row, rowIndex) => {
            const sourceId = row[sourceCol.index];
            const targetId = row[targetCol.index];

            if (!sourceId || !targetId) return;

            // ノードを追加
            if (!this.nodes.has(sourceId)) {
                this.nodes.set(sourceId, { id: sourceId, label: sourceId });
            }
            if (!this.nodes.has(targetId)) {
                this.nodes.set(targetId, { id: targetId, label: targetId });
            }

            // エッジを追加
            const edgeData = {
                id: `e${rowIndex}_${sourceId}_${targetId}`,
                source: sourceId,
                target: targetId
            };

            // 属性を追加
            attributes.forEach(attr => {
                const value = row[attr.index];
                const converted = fileHandler.convertValue(value, attr.dataType, attr.delimiter);
                edgeData[attr.name] = converted;
            });

            this.edges.push(edgeData);
        });

        this.updateCytoscape();
    }

    /**
     * テーブルデータ（ノード属性）をインポート
     * @param {Object} params
     * @param {any[][]} params.data - データ行
     * @param {Object} params.columnSettings - カラム設定
     */
    importTableData({ data, columnSettings }) {
        const nodeCol = columnSettings.node;
        const attributes = columnSettings.attributes;

        // 既存ノード位置を保存
        const nodePositions = new Map();
        if (this.cy) {
            this.cy.nodes().forEach(node => {
                nodePositions.set(node.id(), { x: node.position('x'), y: node.position('y') });
            });
        }

        data.forEach(row => {
            const nodeId = row[nodeCol.index];
            if (!nodeId) return;

            // ノードが存在する場合のみ属性を追加
            if (this.nodes.has(nodeId)) {
                const nodeData = this.nodes.get(nodeId);
                attributes.forEach(attr => {
                    const value = row[attr.index];
                    const converted = fileHandler.convertValue(value, attr.dataType, attr.delimiter);
                    nodeData[attr.name] = converted;
                });
                this.nodes.set(nodeId, nodeData);
            } else {
                // ノードが存在しない場合は新規作成
                const nodeData = { id: nodeId, label: nodeId };
                attributes.forEach(attr => {
                    const value = row[attr.index];
                    const converted = fileHandler.convertValue(value, attr.dataType, attr.delimiter);
                    nodeData[attr.name] = converted;
                });
                this.nodes.set(nodeId, nodeData);
            }
        });

        this.updateCytoscape(nodePositions);
    }

    /**
     * Cytoscapeを更新
     */
    updateCytoscape(nodePositions) {
        this.hideEmptyState();

        // 要素を構築
        const elements = [];

        // ノード
        this.nodes.forEach((data, id) => {
            const ele = {
                data: { ...data, id: id, label: data.label || id }
            };
            // 位置情報があれば付与
            if (nodePositions && nodePositions.has(id)) {
                ele.position = { ...nodePositions.get(id) };
            }
            elements.push(ele);
        });

        // エッジ
        this.edges.forEach(edgeData => {
            elements.push({
                data: edgeData
            });
        });

        // Cytoscapeに要素を設定
        this.cy.elements().remove();
        this.cy.add(elements);

        // Table Fileインポート時はレイアウトを再適用しない（位置維持）
        if (!nodePositions) {
            this.applyLayout('dagre');
        }
    }

    /**
     * レイアウトを適用
     * @param {string} layoutName - レイアウト名
     */
    applyLayout(layoutName = 'dagre') {
        const layoutOptions = {
            dagre: {
                name: 'dagre',
                rankDir: 'TB',
                nodeSep: 50,
                edgeSep: 10,
                rankSep: 80,
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50
            },
            circle: {
                name: 'circle',
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50
            },
            grid: {
                name: 'grid',
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50
            },
            concentric: {
                name: 'concentric',
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50
            },
            breadthfirst: {
                name: 'breadthfirst',
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50
            },
            cose: {
                name: 'cose',
                animate: true,
                animationDuration: 500,
                fit: false,
                padding: 50,
                nodeRepulsion: 400000,
                idealEdgeLength: 100
            }
        };

        const options = layoutOptions[layoutName] || layoutOptions.dagre;
        const layout = this.cy.layout(options);
        
        // レイアウト完了後に手動でfit（maxZoom制限付き）
        layout.on('layoutstop', () => {
            this.fitWithZoomLimit();
        });
        
        layout.run();
    }

    /**
     * ネットワークをクリア
     */
    clear() {
        this.nodes.clear();
        this.edges = [];
        this.nodeAttributes.clear();
        this.edgeAttributes = [];
        
        if (this.cy) {
            this.cy.elements().remove();
            this.showEmptyState();
        }
    }

    /**
     * ビューをフィット（maxZoom制限付き）
     */
    fit() {
        this.fitWithZoomLimit();
    }
    
    /**
     * ズーム制限付きでフィット
     * 小さいネットワークでもさらにズームインできる余地を残す
     * 大きいネットワークでもさらにズームアウトできる余地を残す
     */
    fitWithZoomLimit() {
        if (!this.cy || this.cy.elements().length === 0) return;
        
        // まず通常のfitを行う
        this.cy.fit(50);
        
        // 現在のズームレベルを取得
        const currentZoom = this.cy.zoom();
        const minZoom = this.cy.minZoom();
        const maxZoom = this.cy.maxZoom();
        
        // fit時のズーム上限1.5に制限（さらにズームインできる余地を残す）
        const fitMaxZoom = 1.5;
        // fit時のズーム下限を0.05に制限（さらにズームアウトできる余地を残す）
        const fitMinZoom = 0.05;
        
        let appliedZoom = currentZoom;
        
        if (currentZoom > fitMaxZoom) {
            appliedZoom = fitMaxZoom;
        } else if (currentZoom < fitMinZoom) {
            appliedZoom = fitMinZoom;
        }
        
        if (appliedZoom !== currentZoom) {
            this.cy.zoom(appliedZoom);
            this.cy.center();
        }
        
        console.log('fitWithZoomLimit: currentZoom=' + currentZoom.toFixed(3) + ', applied=' + this.cy.zoom().toFixed(3) + ', minZoom=' + minZoom + ', maxZoom=' + maxZoom);
    }

    /**
     * ネットワーク統計を取得
     * @returns {Object}
     */
    getStats() {
        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.length
        };
    }

    /**
     * ネットワークをJSON形式でエクスポート（Cytoscape Desktop互換）
     * @returns {Object} - エクスポートデータ
     */
    exportToJSON() {
        if (!this.cy) return null;

        // Cytoscape Desktop互換形式で要素を構築
        const nodes = [];
        const edges = [];

        // ノードデータを構築
        this.cy.nodes().forEach(node => {
            const nodeData = { ...node.data() };
            // 位置情報を追加
            const pos = node.position();
            nodes.push({
                data: nodeData,
                position: { x: pos.x, y: pos.y }
            });
        });

        // エッジデータを構築
        this.cy.edges().forEach(edge => {
            edges.push({
                data: { ...edge.data() }
            });
        });
        
        // Style設定を深いコピーで取得
        let styleSettings = null;
        try {
            if (typeof StylePanel !== 'undefined' && StylePanel.savedSettings) {
                styleSettings = JSON.parse(JSON.stringify(StylePanel.savedSettings));
                console.log('StylePanel.savedSettings found:', styleSettings);
            } else {
                console.warn('StylePanel or savedSettings not available');
            }
        } catch (e) {
            console.error('Error getting styleSettings:', e);
        }
        
        // Edge Bends設定を取得
        let edgeBendsSettings = null;
        try {
            if (typeof edgeBends !== 'undefined' && edgeBends.currentBendStrength !== undefined) {
                edgeBendsSettings = {
                    bendStrength: edgeBends.currentBendStrength
                };
                console.log('edgeBends settings found:', edgeBendsSettings);
            } else {
                console.warn('edgeBends not available');
            }
        } catch (e) {
            console.error('Error getting edgeBendsSettings:', e);
        }
        
        // Cytoscape Desktop互換形式 + 本アプリ拡張データ
        const exportData = {
            format_version: "1.0",
            generated_by: "cytoscape-js-app",
            target_cytoscapejs_version: "~3.28",
            data: {
                name: "Network"
            },
            elements: {
                nodes: nodes,
                edges: edges
            },
            // 本アプリ独自の拡張データ（Cytoscape Desktopでは無視される）
            appExtensions: {
                version: '1.2',
                exportDate: new Date().toISOString(),
                styleSettings: styleSettings,
                edgeBendsSettings: edgeBendsSettings
            }
        };
        
        console.log('Full export data:', exportData);
        return exportData;
    }

    /**
     * JSON形式からネットワークをインポート（CX2/Cytoscape Desktop互換 + レガシー形式対応）
     * @param {Object|Array} data - インポートデータ
     * @returns {boolean} - 成功したかどうか
     */
    importFromJSON(data) {
        if (!this.cy || !data) return false;

        try {
            // 既存データをクリア
            this.clear();

            // 古い形式の配列データを変換するヘルパー関数
            const convertLegacyArrays = (obj) => {
                if (obj === null || obj === undefined) return obj;
                if (Array.isArray(obj)) {
                    // 配列の各要素をチェック
                    // もし1要素の配列で、その要素が「| 」を含む文字列なら分割
                    if (obj.length === 1 && typeof obj[0] === 'string' && obj[0].includes('| ')) {
                        return obj[0].split('| ').map(s => s.trim()).filter(s => s !== '');
                    }
                    return obj.map(item => convertLegacyArrays(item));
                }
                if (typeof obj === 'object') {
                    const converted = {};
                    for (const key in obj) {
                        converted[key] = convertLegacyArrays(obj[key]);
                    }
                    return converted;
                }
                return obj;
            };

            // CX2形式かどうか判定（配列で、最初の要素にCXVersionがある）
            const isCX2Format = Array.isArray(data) && data.length > 0 && data[0].CXVersion;

            // Cytoscape Desktop形式かどうか判定
            const isCytoscapeDesktopFormat = !Array.isArray(data) && data.elements && 
                (Array.isArray(data.elements.nodes) || Array.isArray(data.elements.edges));
            
            // レガシー形式（本アプリ旧形式）かどうか判定
            const isLegacyFormat = !Array.isArray(data) && data.cytoscapeElements && Array.isArray(data.cytoscapeElements);

            if (isCX2Format) {
                // CX2形式を読み込み
                console.log('Loading CX2 format');
                return this.importFromCX2(data, convertLegacyArrays);

            } else if (isCytoscapeDesktopFormat) {
                // Cytoscape Desktop互換形式を読み込み
                console.log('Loading Cytoscape Desktop compatible format');
                
                const nodesArray = data.elements.nodes || [];
                const edgesArray = data.elements.edges || [];

                // ノードデータを復元
                nodesArray.forEach(node => {
                    const nodeData = convertLegacyArrays(node.data);
                    const id = nodeData.id;
                    if (id) {
                        this.nodes.set(id, nodeData);
                    }
                });

                // エッジデータを復元
                edgesArray.forEach(edge => {
                    const edgeData = convertLegacyArrays(edge.data);
                    this.edges.push(edgeData);
                });

                // 空状態メッセージを削除
                this.hideEmptyState();

                // Cytoscape要素を追加（位置情報付き）
                const cytoscapeElements = [];
                nodesArray.forEach(node => {
                    const ele = {
                        group: 'nodes',
                        data: convertLegacyArrays(node.data)
                    };
                    if (node.position) {
                        ele.position = { x: node.position.x, y: node.position.y };
                    }
                    cytoscapeElements.push(ele);
                });
                edgesArray.forEach(edge => {
                    cytoscapeElements.push({
                        group: 'edges',
                        data: convertLegacyArrays(edge.data)
                    });
                });

                this.cy.add(cytoscapeElements);
                this.fitWithZoomLimit();

                // 本アプリ拡張データがある場合は復元
                if (data.appExtensions) {
                    const ext = data.appExtensions;
                    
                    // Style設定を復元
                    if (ext.styleSettings && window.StylePanel) {
                        if (ext.styleSettings.node) {
                            StylePanel.savedSettings.node = JSON.parse(JSON.stringify(ext.styleSettings.node));
                        }
                        if (ext.styleSettings.edge) {
                            StylePanel.savedSettings.edge = JSON.parse(JSON.stringify(ext.styleSettings.edge));
                        }
                        try {
                            StylePanel.applyAllStyles();
                            console.log('Styles applied from appExtensions');
                        } catch (styleError) {
                            console.error('Error applying styles:', styleError);
                        }
                    }

                    // Edge Bends設定を復元
                    if (ext.edgeBendsSettings && window.edgeBends) {
                        edgeBends.currentBendStrength = ext.edgeBendsSettings.bendStrength || 40;
                        const slider = document.getElementById('bend-strength-slider');
                        const valueDisplay = document.getElementById('bend-strength-value');
                        if (slider) slider.value = edgeBends.currentBendStrength;
                        if (valueDisplay) valueDisplay.textContent = edgeBends.currentBendStrength;
                        edgeBends.applyEdgeBends();
                    }
                }

            } else if (isLegacyFormat) {
                // レガシー形式（本アプリ旧形式）を読み込み
                console.log('Loading legacy format');

                // ノードデータを変換して復元
                const convertedNodes = (data.nodes || []).map(([id, nodeData]) => {
                    return [id, convertLegacyArrays(nodeData)];
                });
                this.nodes = new Map(convertedNodes);

                // エッジデータを変換して復元
                this.edges = (data.edges || []).map(edge => convertLegacyArrays(edge));

                // ノード属性を変換して復元
                const convertedNodeAttrs = (data.nodeAttributes || []).map(([id, attrs]) => {
                    return [id, convertLegacyArrays(attrs)];
                });
                this.nodeAttributes = new Map(convertedNodeAttrs);

                // エッジ属性を変換して復元
                this.edgeAttributes = (data.edgeAttributes || []).map(attr => convertLegacyArrays(attr));

                // Cytoscape要素を復元
                if (data.cytoscapeElements && data.cytoscapeElements.length > 0) {
                    this.hideEmptyState();
                    this.cy.add(data.cytoscapeElements);
                    this.fitWithZoomLimit();
                }

                // Style設定を復元
                if (data.styleSettings && window.StylePanel) {
                    if (data.styleSettings.node) {
                        StylePanel.savedSettings.node = JSON.parse(JSON.stringify(data.styleSettings.node));
                    }
                    if (data.styleSettings.edge) {
                        StylePanel.savedSettings.edge = JSON.parse(JSON.stringify(data.styleSettings.edge));
                    }
                    try {
                        StylePanel.applyAllStyles();
                        console.log('Styles applied from legacy format');
                    } catch (styleError) {
                        console.error('Error applying styles:', styleError);
                    }
                }

                // Edge Bends設定を復元
                if (data.edgeBendsSettings && window.edgeBends) {
                    edgeBends.currentBendStrength = data.edgeBendsSettings.bendStrength || 40;
                    const slider = document.getElementById('bend-strength-slider');
                    const valueDisplay = document.getElementById('bend-strength-value');
                    if (slider) slider.value = edgeBends.currentBendStrength;
                    if (valueDisplay) valueDisplay.textContent = edgeBends.currentBendStrength;
                    edgeBends.applyEdgeBends();
                }

            } else {
                console.error('Unknown file format');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    /**
     * CX2形式からネットワークをインポート
     * @param {Array} cx2Data - CX2形式のデータ（配列）
     * @param {Function} convertLegacyArrays - 配列変換関数
     * @returns {boolean} - 成功したかどうか
     */
    importFromCX2(cx2Data, convertLegacyArrays) {
        try {
            // CX2形式から各セクションを抽出
            let nodesSection = null;
            let edgesSection = null;
            let attributeDeclarations = null;

            cx2Data.forEach(section => {
                if (section.nodes) {
                    nodesSection = section.nodes;
                }
                if (section.edges) {
                    edgesSection = section.edges;
                }
                if (section.attributeDeclarations) {
                    attributeDeclarations = section.attributeDeclarations;
                }
            });

            console.log('CX2 nodes:', nodesSection?.length || 0);
            console.log('CX2 edges:', edgesSection?.length || 0);

            const cytoscapeElements = [];

            // ノードを処理
            if (nodesSection && Array.isArray(nodesSection)) {
                nodesSection.forEach(node => {
                    // CX2形式: { id: number, x: number, y: number, v: { name: "...", ... } }
                    const nodeId = node.v?.name || String(node.id);
                    const nodeData = {
                        id: nodeId,
                        label: nodeId,
                        ...convertLegacyArrays(node.v || {})
                    };

                    // 内部データに保存
                    this.nodes.set(nodeId, nodeData);

                    // Cytoscape要素を構築
                    const ele = {
                        group: 'nodes',
                        data: nodeData
                    };
                    
                    // 位置情報があれば追加
                    if (node.x !== undefined && node.y !== undefined) {
                        ele.position = { x: node.x, y: node.y };
                    }
                    
                    cytoscapeElements.push(ele);
                });
            }

            // IDからノード名へのマッピングを作成
            const idToName = new Map();
            if (nodesSection) {
                nodesSection.forEach(node => {
                    const nodeId = node.v?.name || String(node.id);
                    idToName.set(node.id, nodeId);
                });
            }

            // エッジを処理
            if (edgesSection && Array.isArray(edgesSection)) {
                edgesSection.forEach((edge, index) => {
                    // CX2形式: { id: number, s: number, t: number, v: { ... } }
                    const sourceId = idToName.get(edge.s) || String(edge.s);
                    const targetId = idToName.get(edge.t) || String(edge.t);
                    
                    const edgeData = {
                        id: `e${edge.id || index}`,
                        source: sourceId,
                        target: targetId,
                        ...convertLegacyArrays(edge.v || {})
                    };

                    // 内部データに保存
                    this.edges.push(edgeData);

                    // Cytoscape要素を構築
                    cytoscapeElements.push({
                        group: 'edges',
                        data: edgeData
                    });
                });
            }

            // 空状態メッセージを削除
            this.hideEmptyState();

            // Cytoscapeに要素を追加
            this.cy.add(cytoscapeElements);
            
            // 位置情報がない場合はレイアウトを適用
            const hasPositions = nodesSection && nodesSection.some(n => n.x !== undefined && n.y !== undefined);
            if (!hasPositions) {
                this.applyLayout('dagre');
            } else {
                this.fitWithZoomLimit();
            }

            console.log(`CX2 import complete: ${this.nodes.size} nodes, ${this.edges.length} edges`);
            return true;

        } catch (error) {
            console.error('CX2 import error:', error);
            return false;
        }
    }

    /**
     * 空状態メッセージを非表示
     */
    hideEmptyState() {
        const container = document.getElementById('cy');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }

    /**
     * ホバーハイライト機能をセットアップ
     */
    setupHoverHighlight() {
        if (!this.cy) return;

        this.cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            
            // 大規模ネットワーク（2000要素以上）ではパフォーマンスのため無効化
            if (this.cy.elements().length > 2000) {
                return;
            }

            // 上流・下流パスを取得
            const predecessors = node.predecessors();
            const successors = node.successors();
            
            // ハイライトする要素（ホバーしたノード + 上流・下流パス）
            const highlighted = node.union(predecessors).union(successors);
            
            // 全要素をdimmed状態に
            this.cy.elements().addClass('hover-dimmed');
            
            // ハイライト要素をdimmedから除外し、highlightedクラスを追加
            highlighted.removeClass('hover-dimmed').addClass('hover-highlighted');
            
            // スタイルを再適用（個別スタイルがクラスベースのスタイルより優先されるため）
            if (typeof StylePanel !== 'undefined' && StylePanel.applyAllStyles) {
                StylePanel.applyAllStyles();
            }
        });

        this.cy.on('mouseout', 'node', (evt) => {
            // 大規模ネットワークではパフォーマンスのため無効化
            if (this.cy.elements().length > 2000) {
                return;
            }

            // 全てのホバークラスを削除
            this.cy.elements().removeClass('hover-highlighted hover-dimmed');
            
            // スタイルを再適用（通常のスタイルに戻す）
            if (typeof StylePanel !== 'undefined' && StylePanel.applyAllStyles) {
                StylePanel.applyAllStyles();
            }
        });
    }
}

// グローバルインスタンス
const networkManager = new NetworkManager();
window.networkManager = networkManager;
