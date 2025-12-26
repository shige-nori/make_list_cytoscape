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
     * ネットワークをJSON形式でエクスポート
     * @returns {Object} - エクスポートデータ
     */
    exportToJSON() {
        if (!this.cy) return null;

        const elements = this.cy.elements().jsons();
        
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
        
        const exportData = {
            version: '1.1',
            exportDate: new Date().toISOString(),
            nodes: Array.from(this.nodes.entries()),
            edges: this.edges,
            nodeAttributes: Array.from(this.nodeAttributes.entries()),
            edgeAttributes: this.edgeAttributes,
            cytoscapeElements: elements,
            styleSettings: styleSettings,
            edgeBendsSettings: edgeBendsSettings
        };
        
        console.log('Full export data:', exportData);
        return exportData;
    }

    /**
     * JSON形式からネットワークをインポート
     * @param {Object} data - インポートデータ
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
                // 空状態メッセージを削除
                this.hideEmptyState();
                
                this.cy.add(data.cytoscapeElements);
                this.fitWithZoomLimit();
            }

            // Style設定を復元
            console.log('Importing styleSettings:', data.styleSettings);
            if (data.styleSettings && window.StylePanel) {
                // 深いコピーで復元
                if (data.styleSettings.node) {
                    StylePanel.savedSettings.node = JSON.parse(JSON.stringify(data.styleSettings.node));
                }
                if (data.styleSettings.edge) {
                    StylePanel.savedSettings.edge = JSON.parse(JSON.stringify(data.styleSettings.edge));
                }
                console.log('StylePanel.savedSettings restored:', StylePanel.savedSettings);
                
                // 復元したスタイルをグラフに適用（静的メソッドを使用）
                try {
                    StylePanel.applyAllStyles();
                    console.log('Styles applied to graph');
                } catch (styleError) {
                    console.error('Error applying styles:', styleError);
                }
            }

            // Edge Bends設定を復元
            console.log('Importing edgeBendsSettings:', data.edgeBendsSettings);
            if (data.edgeBendsSettings && window.edgeBends) {
                edgeBends.currentBendStrength = data.edgeBendsSettings.bendStrength || 40;
                const slider = document.getElementById('bend-strength-slider');
                const valueDisplay = document.getElementById('bend-strength-value');
                if (slider) slider.value = edgeBends.currentBendStrength;
                if (valueDisplay) valueDisplay.textContent = edgeBends.currentBendStrength;
                // エッジのカーブを適用
                edgeBends.applyEdgeBends();
            }

            return true;
        } catch (error) {
            console.error('Import error:', error);
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
}

// グローバルインスタンス
const networkManager = new NetworkManager();
window.networkManager = networkManager;
