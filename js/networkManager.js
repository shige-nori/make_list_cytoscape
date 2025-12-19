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
            minZoom: 0.1,
            maxZoom: 5,
            wheelSensitivity: 0.3
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
                    'text-max-width': '100px'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'background-color': '#f59e0b',
                    'border-color': '#d97706',
                    'border-width': 4
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
                    'arrow-scale': 1.2
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'width': 3,
                    'line-color': '#f59e0b',
                    'target-arrow-color': '#d97706'
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
                fit: true,
                padding: 50
            },
            circle: {
                name: 'circle',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 50
            },
            grid: {
                name: 'grid',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 50
            },
            concentric: {
                name: 'concentric',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 50
            },
            breadthfirst: {
                name: 'breadthfirst',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 50
            },
            cose: {
                name: 'cose',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 50,
                nodeRepulsion: 400000,
                idealEdgeLength: 100
            }
        };

        const options = layoutOptions[layoutName] || layoutOptions.dagre;
        const layout = this.cy.layout(options);
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
     * ビューをフィット
     */
    fit() {
        if (this.cy && this.cy.elements().length > 0) {
            this.cy.fit(50);
        }
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
        
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            nodes: Array.from(this.nodes.entries()),
            edges: this.edges,
            nodeAttributes: Array.from(this.nodeAttributes.entries()),
            edgeAttributes: this.edgeAttributes,
            cytoscapeElements: elements
        };
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

            // データを復元
            this.nodes = new Map(data.nodes || []);
            this.edges = data.edges || [];
            this.nodeAttributes = new Map(data.nodeAttributes || []);
            this.edgeAttributes = data.edgeAttributes || [];

            // Cytoscape要素を復元
            if (data.cytoscapeElements && data.cytoscapeElements.length > 0) {
                // 空状態メッセージを削除
                this.hideEmptyState();
                
                this.cy.add(data.cytoscapeElements);
                this.cy.fit(50);
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
