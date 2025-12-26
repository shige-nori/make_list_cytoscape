/**
 * StylePanel - ノード/エッジスタイル設定パネル
 */
class StylePanel {
    // 静的インスタンス保持用
    static instances = {
        node: null,
        edge: null
    };

    // 設定値を保持する静的プロパティ
    static savedSettings = {
        node: {
            labelFontSize: '12',
            labelColor: '#1e293b',
            fillColor: '#2563eb',
            shape: 'ellipse',
            size: '40',
            // Mapping設定
            mappings: {
                labelFontSize: { active: false, column: '', type: 'individual', values: {}, continuousRange: null },
                labelColor: { active: false, column: '', type: 'individual', values: {}, gradientColors: null },
                fillColor: { active: false, column: '', type: 'individual', values: {}, gradientColors: null },
                shape: { active: false, column: '', values: {} },
                size: { active: false, column: '', type: 'individual', values: {}, continuousRange: null }
            }
        },
        edge: {
            lineType: 'solid',
            arrowShape: 'triangle',
            width: '2',
            lineColor: '#94a3b8',
            // Mapping設定
            mappings: {
                lineType: { active: false, column: '', values: {} },
                arrowShape: { active: false, column: '', values: {} },
                width: { active: false, column: '', type: 'individual', values: {}, continuousRange: null },
                lineColor: { active: false, column: '', type: 'individual', values: {}, gradientColors: null }
            }
        }
    };

    /**
     * 保存された設定からスタイルを適用（静的メソッド）
     * ファイル読み込み時など、パネルがない状態でもスタイルを適用可能
     */
    static applyAllStyles() {
        if (!window.networkManager || !networkManager.cy) {
            console.log('networkManager or cy not available for applyAllStyles');
            return;
        }

        const nodeSettings = StylePanel.savedSettings.node;
        const edgeSettings = StylePanel.savedSettings.edge;

        // ノードスタイルを適用
        networkManager.cy.nodes().forEach(node => {
            const nodeStyles = {};
            
            // Label Font Size
            nodeStyles['font-size'] = StylePanel.getStaticMappedValue(node, 'labelFontSize', nodeSettings.labelFontSize, nodeSettings.mappings, 'node') + 'px';
            
            // Label Color
            nodeStyles['color'] = StylePanel.getStaticMappedColorValue(node, 'labelColor', nodeSettings.labelColor, nodeSettings.mappings, 'node');
            
            // Fill Color
            nodeStyles['background-color'] = StylePanel.getStaticMappedColorValue(node, 'fillColor', nodeSettings.fillColor, nodeSettings.mappings, 'node');
            
            // Shape
            nodeStyles['shape'] = StylePanel.getStaticMappedValue(node, 'shape', nodeSettings.shape, nodeSettings.mappings, 'node');
            
            // Size
            const nodeSize = StylePanel.getStaticMappedValue(node, 'size', nodeSettings.size, nodeSettings.mappings, 'node');
            nodeStyles['width'] = nodeSize + 'px';
            nodeStyles['height'] = nodeSize + 'px';
            
            node.style(nodeStyles);
        });

        // エッジスタイルを適用
        networkManager.cy.edges().forEach(edge => {
            const edgeStyles = {};
            
            // Line Type
            const lineType = StylePanel.getStaticMappedValue(edge, 'lineType', edgeSettings.lineType, edgeSettings.mappings, 'edge');
            edgeStyles['line-style'] = lineType;
            
            // Arrow Shape
            const arrowShape = StylePanel.getStaticMappedValue(edge, 'arrowShape', edgeSettings.arrowShape, edgeSettings.mappings, 'edge');
            edgeStyles['target-arrow-shape'] = arrowShape;
            edgeStyles['arrow-scale'] = 1.2;
            
            // Width
            const width = StylePanel.getStaticMappedValue(edge, 'width', edgeSettings.width, edgeSettings.mappings, 'edge');
            edgeStyles['width'] = width + 'px';
            
            // Line Color
            const lineColor = StylePanel.getStaticMappedColorValue(edge, 'lineColor', edgeSettings.lineColor, edgeSettings.mappings, 'edge');
            edgeStyles['line-color'] = lineColor;
            edgeStyles['target-arrow-color'] = lineColor;
            
            edge.style(edgeStyles);
        });

        console.log('All styles applied via static method');
    }

    /**
     * 静的マッピング値取得（数値・Shape用）
     */
    static getStaticMappedValue(element, property, defaultValue, mappings, elementType) {
        const mapping = mappings[property];
        if (!mapping || !mapping.column) {
            return defaultValue;
        }

        const value = element.data(mapping.column);

        // Continuousマッピングの場合
        if (mapping.type === 'continuous' && mapping.continuousRange) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const { min, max } = StylePanel.getStaticNumericRange(mapping.column, elementType);
                const ratio = (max !== min) ? (numValue - min) / (max - min) : 0;
                const { minSize, maxSize } = mapping.continuousRange;
                const calculatedSize = minSize + (maxSize - minSize) * ratio;
                if (property === 'labelFontSize') {
                    return Math.round(calculatedSize);
                } else {
                    return Math.round(calculatedSize * 10) / 10;
                }
            }
            return defaultValue;
        }

        // Individualマッピングの場合
        const strValue = String(value || '');
        const mappedValue = mapping.values[strValue];
        
        return mappedValue !== undefined ? mappedValue : defaultValue;
    }

    /**
     * 静的マッピング色取得（Color用 - Gradient対応）
     */
    static getStaticMappedColorValue(element, property, defaultColor, mappings, elementType) {
        const mapping = mappings[property];
        if (!mapping || !mapping.column) {
            return defaultColor;
        }

        const value = element.data(mapping.column);

        if (mapping.type === 'gradient' && mapping.gradientColors) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const { min, max } = StylePanel.getStaticNumericRange(mapping.column, elementType);
                const ratio = (numValue - min) / (max - min);
                return StylePanel.interpolateColorStatic(mapping.gradientColors.min, mapping.gradientColors.max, ratio);
            }
            return defaultColor;
        } else {
            const mappedColor = mapping.values[String(value || '')];
            return mappedColor !== undefined ? mappedColor : defaultColor;
        }
    }

    /**
     * 静的数値範囲取得
     */
    static getStaticNumericRange(column, elementType) {
        if (!window.networkManager || !networkManager.cy) return { min: 0, max: 1 };

        let min = Infinity;
        let max = -Infinity;

        const elements = elementType === 'node' ? networkManager.cy.nodes() : networkManager.cy.edges();
        elements.forEach(el => {
            const value = el.data(column);
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                min = Math.min(min, numValue);
                max = Math.max(max, numValue);
            }
        });

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 1;
        if (min === max) max = min + 1;

        return { min, max };
    }

    /**
     * 静的色補間
     */
    static interpolateColorStatic(color1, color2, ratio) {
        const hex2rgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 0, b: 0 };
        };

        const rgb2hex = (r, g, b) => {
            return '#' + [r, g, b].map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        };

        const c1 = hex2rgb(color1);
        const c2 = hex2rgb(color2);

        const r = c1.r + (c2.r - c1.r) * ratio;
        const g = c1.g + (c2.g - c1.g) * ratio;
        const b = c1.b + (c2.b - c1.b) * ratio;

        return rgb2hex(r, g, b);
    }

    /**
     * パネルを表示（シングルトン的に管理）
     */
    static show(type) {
        // 既存のパネルがあれば表示
        const existingPanel = document.getElementById(`style-panel-${type}`);
        if (existingPanel) {
            existingPanel.classList.add('active');
            return;
        }

        // 新しいインスタンスを作成
        const panel = new StylePanel(type);
        panel.initialize();
        StylePanel.instances[type] = panel;
    }

    constructor(type) {
        this.type = type; // 'node' or 'edge'
        this.panel = null;
    }

    /**
     * パネルを初期化
     */
    initialize() {
        this.createPanel();
        this.restoreSavedSettings();
        this.setupEventListeners();
    }

    /**
     * 保存された設定値を復元
     */
    restoreSavedSettings() {
        if (this.type === 'node') {
            const settings = StylePanel.savedSettings.node;
            
            // 基本設定を復元
            const fontSizeInput = document.getElementById('node-label-font-size');
            const labelColorInput = document.getElementById('node-label-color');
            const fillColorInput = document.getElementById('node-fill-color');
            const shapeSelect = document.getElementById('node-shape');
            const sizeInput = document.getElementById('node-size');
            
            if (fontSizeInput) fontSizeInput.value = settings.labelFontSize;
            if (labelColorInput) labelColorInput.value = settings.labelColor;
            if (fillColorInput) fillColorInput.value = settings.fillColor;
            if (shapeSelect) shapeSelect.value = settings.shape;
            if (sizeInput) sizeInput.value = settings.size;
            
            // 各プロパティのマッピング設定を復元
            const properties = ['labelFontSize', 'labelColor', 'fillColor', 'shape', 'size'];
            properties.forEach(prop => {
                const mapping = settings.mappings[prop];
                if (mapping && mapping.active) {
                    const mappingPanel = document.getElementById(`${prop}-mapping-panel`);
                    const mappingBtn = document.getElementById(`${prop}-mapping-btn`);
                    
                    if (mappingPanel) {
                        mappingPanel.style.display = 'block';
                        if (mappingBtn) mappingBtn.classList.add('active');
                        
                        // カラム選択肢を設定
                        this.populateMappingColumnOptions(prop);
                        
                        const columnSelect = document.getElementById(`${prop}-mapping-column`);
                        const typeSelect = document.getElementById(`${prop}-mapping-type`);
                        
                        if (columnSelect && mapping.column) {
                            columnSelect.value = mapping.column;
                        }
                        if (typeSelect && mapping.type) {
                            typeSelect.value = mapping.type;
                        }
                        
                        // マッピング値を更新
                        this.updateMappingValuesForProperty(prop);
                    }
                }
            });
        } else {
            const settings = StylePanel.savedSettings.edge;
            
            const lineTypeSelect = document.getElementById('edge-line-type');
            const arrowShapeSelect = document.getElementById('edge-arrow-shape');
            const widthInput = document.getElementById('edge-width');
            
            if (lineTypeSelect) lineTypeSelect.value = settings.lineType;
            if (arrowShapeSelect) arrowShapeSelect.value = settings.arrowShape;
            if (widthInput) widthInput.value = settings.width;
        }
    }

    /**
     * パネルを作成
     */
    createPanel() {
        // 既存パネルがあれば削除
        const old = document.getElementById(`style-panel-${this.type}`);
        if (old) old.remove();

        // パネル本体
        const panel = document.createElement('div');
        panel.className = 'tools-panel style-panel';
        panel.id = `style-panel-${this.type}`;
        panel.innerHTML = `
            <div class="tools-panel-header">
                <h3>Style: ${this.type === 'node' ? 'Node' : 'Edge'}</h3>
                <span class="tools-panel-close" id="style-panel-close-${this.type}">&times;</span>
            </div>
            <div class="tools-panel-body">
                <div class="tool-section">
                    <div class="tool-section-header">
                        <span class="tool-section-title">設定項目</span>
                    </div>
                    <div class="tool-section-body">
                        ${this.type === 'node' ? this.createNodeSettings() : this.createEdgeSettings()}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        panel.classList.add('active');
        
        // 位置を既定位置にセット
        panel.style.top = '50px';
        panel.style.right = '10px';
        
        this.panel = panel;
    }

    /**
     * ノード設定UIを作成
     */
    createNodeSettings() {
        return `
            ${this.createMappingSection('labelFontSize', 'Label Font Size', 
                '<input type="number" id="node-label-font-size" value="12" min="8" max="72" style="width: 100%;">', 
                'number')}
            ${this.createMappingSection('labelColor', 'Label Color', 
                '<input type="color" id="node-label-color" value="#1e293b" style="width: 100%;">', 
                'color')}
            ${this.createMappingSection('fillColor', 'Fill Color', 
                '<input type="color" id="node-fill-color" value="#2563eb" style="width: 100%;">', 
                'color')}
            ${this.createMappingSection('shape', 'Shape', 
                `<select id="node-shape" style="width: 100%;">
                    <option value="ellipse">○ (Ellipse)</option>
                    <option value="rectangle">□ (Rectangle)</option>
                    <option value="diamond">◇ (Diamond)</option>
                    <option value="triangle">△ (Triangle)</option>
                </select>`, 
                'shape')}
            ${this.createMappingSection('size', 'Size', 
                '<input type="number" id="node-size" value="40" min="10" max="200" style="width: 100%;">', 
                'number')}
        `;
    }

    /**
     * Mapping機能付きの設定セクションを作成
     */
    createMappingSection(property, label, inputHtml, valueType) {
        const mappingId = `${property}-mapping`;
        const showMappingType = valueType === 'color' || valueType === 'number';
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label>${label}:</label>
                    <button type="button" id="${mappingId}-btn" class="mapping-btn" data-property="${property}">Mapping</button>
                </div>
                ${inputHtml}
                <div id="${mappingId}-panel" class="mapping-panel" style="display: none;" data-property="${property}" data-value-type="${valueType}">
                    <div class="mapping-row">
                        <label>Column:</label>
                        <select id="${mappingId}-column" style="width: 100%;"></select>
                    </div>
                    ${showMappingType ? `
                    <div class="mapping-row">
                        <label>Mapping Type:</label>
                        <select id="${mappingId}-type" style="width: 100%;">
                            <option value="individual">Individual</option>
                            ${valueType === 'color' ? '<option value="gradient">Gradient</option>' : ''}
                            <option value="continuous">Continuous</option>
                        </select>
                    </div>
                    ` : ''}
                    <div id="${mappingId}-values" class="mapping-values"></div>
                </div>
            </div>
        `;
    }

    /**
     * エッジ設定UIを作成
     */
    createEdgeSettings() {
        return `
            ${this.createEdgeMappingSection('lineType', 'Line Type', 
                `<select id="edge-line-type" style="width: 100%;">
                    <option value="solid">ノーマル</option>
                    <option value="dashed">点線</option>
                </select>`, 
                'lineType')}
            ${this.createEdgeMappingSection('arrowShape', 'Arrow Shape', 
                `<select id="edge-arrow-shape" style="width: 100%;">
                    <option value="triangle">矢印</option>
                    <option value="none">ノーマル</option>
                </select>`, 
                'arrowShape')}
            ${this.createEdgeMappingSection('width', 'Width', 
                '<input type="number" id="edge-width" value="2" min="1" max="20" style="width: 100%;">', 
                'number')}
            ${this.createEdgeMappingSection('lineColor', 'Line Color', 
                '<input type="color" id="edge-line-color" value="#94a3b8" style="width: 100%;">', 
                'color')}
        `;
    }

    /**
     * Edge用Mapping機能付きの設定セクションを作成
     */
    createEdgeMappingSection(property, label, inputHtml, valueType) {
        const mappingId = `edge-${property}-mapping`;
        const showMappingType = valueType === 'color' || valueType === 'number';
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label>${label}:</label>
                    <button type="button" id="${mappingId}-btn" class="mapping-btn" data-property="${property}">Mapping</button>
                </div>
                ${inputHtml}
                <div id="${mappingId}-panel" class="mapping-panel" style="display: none;" data-property="${property}" data-value-type="${valueType}">
                    <div class="mapping-row">
                        <label>Column:</label>
                        <select id="${mappingId}-column" style="width: 100%;"></select>
                    </div>
                    ${showMappingType ? `
                    <div class="mapping-row">
                        <label>Mapping Type:</label>
                        <select id="${mappingId}-type" style="width: 100%;">
                            <option value="individual">Individual</option>
                            ${valueType === 'color' ? '<option value="gradient">Gradient</option>' : ''}
                            <option value="continuous">Continuous</option>
                        </select>
                    </div>
                    ` : ''}
                    <div id="${mappingId}-values" class="mapping-values"></div>
                </div>
            </div>
        `;
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // パネルを閉じる
        this.panel.querySelector('.tools-panel-close').addEventListener('click', () => {
            this.panel.remove();
        });

        // 各設定項目の変更時にリアルタイムで適用
        if (this.type === 'node') {
            // 基本入力の変更時
            const basicInputs = {
                'node-label-font-size': 'labelFontSize',
                'node-label-color': 'labelColor',
                'node-fill-color': 'fillColor',
                'node-shape': 'shape',
                'node-size': 'size'
            };
            
            Object.entries(basicInputs).forEach(([id, prop]) => {
                const element = document.getElementById(id);
                if (element) {
                    const handler = () => {
                        // マッピング値をクリア
                        const mapping = StylePanel.savedSettings.node.mappings[prop];
                        if (mapping) {
                            mapping.values = {};
                            mapping.gradientColors = null;
                        }
                        this.applyNodeStyle();
                    };
                    element.addEventListener('input', handler);
                    element.addEventListener('change', handler);
                }
            });

            // 各プロパティのMappingイベント設定
            const properties = ['labelFontSize', 'labelColor', 'fillColor', 'shape', 'size'];
            properties.forEach(prop => {
                this.setupMappingEvents(prop);
            });
        } else {
            // Edgeの基本入力の変更時
            const basicInputs = {
                'edge-line-type': 'lineType',
                'edge-arrow-shape': 'arrowShape',
                'edge-width': 'width',
                'edge-line-color': 'lineColor'
            };
            
            Object.entries(basicInputs).forEach(([id, prop]) => {
                const element = document.getElementById(id);
                if (element) {
                    const handler = () => {
                        // マッピング値をクリア
                        const mapping = StylePanel.savedSettings.edge.mappings[prop];
                        if (mapping) {
                            mapping.values = {};
                            mapping.gradientColors = null;
                        }
                        this.applyEdgeStyle();
                    };
                    element.addEventListener('input', handler);
                    element.addEventListener('change', handler);
                }
            });

            // 各プロパティのMappingイベント設定
            const properties = ['lineType', 'arrowShape', 'width', 'lineColor'];
            properties.forEach(prop => {
                this.setupEdgeMappingEvents(prop);
            });
        }
    }

    /**
     * 各プロパティのMappingイベントを設定
     */
    setupMappingEvents(property) {
        const mappingBtn = document.getElementById(`${property}-mapping-btn`);
        const mappingPanel = document.getElementById(`${property}-mapping-panel`);
        const columnSelect = document.getElementById(`${property}-mapping-column`);
        const typeSelect = document.getElementById(`${property}-mapping-type`);

        if (!mappingBtn || !mappingPanel) return;

        const mapping = StylePanel.savedSettings.node.mappings[property];

        // Mappingボタンクリックでパネル表示/非表示
        mappingBtn.addEventListener('click', () => {
            mapping.active = !mapping.active;
            mappingPanel.style.display = mapping.active ? 'block' : 'none';
            mappingBtn.classList.toggle('active', mapping.active);

            if (mapping.active) {
                this.populateMappingColumnOptions(property);
                
                // 保存されたカラム設定を復元
                if (mapping.column) {
                    columnSelect.value = mapping.column;
                    if (typeSelect && mapping.type) {
                        typeSelect.value = mapping.type;
                    }
                    this.updateMappingValuesForProperty(property);
                }
            }
        });

        // Column選択変更時
        columnSelect.addEventListener('change', () => {
            mapping.column = columnSelect.value;
            mapping.values = {};
            mapping.gradientColors = null;
            mapping.continuousRange = null;
            
            // Mapping Typeを更新
            if (typeSelect) {
                this.updateMappingTypeForProperty(property);
            }
            this.updateMappingValuesForProperty(property);
            this.applyNodeStyle();
        });

        // Mapping Type変更時
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                mapping.type = typeSelect.value;
                mapping.values = {};
                mapping.gradientColors = null;
                mapping.continuousRange = null;
                
                this.updateMappingValuesForProperty(property);
                this.applyNodeStyle();
            });
        }
    }

    /**
     * Edge用のMappingイベントを設定
     */
    setupEdgeMappingEvents(property) {
        const mappingBtn = document.getElementById(`edge-${property}-mapping-btn`);
        const mappingPanel = document.getElementById(`edge-${property}-mapping-panel`);
        const columnSelect = document.getElementById(`edge-${property}-mapping-column`);
        const typeSelect = document.getElementById(`edge-${property}-mapping-type`);

        if (!mappingBtn || !mappingPanel) return;

        const mapping = StylePanel.savedSettings.edge.mappings[property];

        // Mappingボタンクリックでパネル表示/非表示
        mappingBtn.addEventListener('click', () => {
            mapping.active = !mapping.active;
            mappingPanel.style.display = mapping.active ? 'block' : 'none';
            mappingBtn.classList.toggle('active', mapping.active);

            if (mapping.active) {
                this.populateEdgeMappingColumnOptions(property);
                
                // 保存されたカラム設定を復元
                if (mapping.column) {
                    columnSelect.value = mapping.column;
                    if (typeSelect && mapping.type) {
                        typeSelect.value = mapping.type;
                    }
                    this.updateEdgeMappingValuesForProperty(property);
                }
            }
        });

        // Column選択変更時
        columnSelect.addEventListener('change', () => {
            mapping.column = columnSelect.value;
            mapping.values = {};
            mapping.gradientColors = null;
            mapping.continuousRange = null;
            
            // Mapping Typeを更新
            if (typeSelect) {
                this.updateEdgeMappingTypeForProperty(property);
            }
            this.updateEdgeMappingValuesForProperty(property);
            this.applyEdgeStyle();
        });

        // Mapping Type変更時
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                mapping.type = typeSelect.value;
                mapping.values = {};
                mapping.gradientColors = null;
                mapping.continuousRange = null;
                
                this.updateEdgeMappingValuesForProperty(property);
                this.applyEdgeStyle();
            });
        }
    }

    /**
     * Edge用のカラム選択肢を設定
     */
    populateEdgeMappingColumnOptions(property) {
        const columnSelect = document.getElementById(`edge-${property}-mapping-column`);
        if (!columnSelect || !window.networkManager || !networkManager.cy) return;

        columnSelect.innerHTML = '<option value="">-- Select Column --</option>';

        const columns = this.getEdgeAttributeColumns();
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            columnSelect.appendChild(option);
        });
    }

    /**
     * エッジの属性カラムを取得
     */
    getEdgeAttributeColumns() {
        if (!window.networkManager || !networkManager.cy) return [];

        const columns = new Set();
        networkManager.cy.edges().forEach(edge => {
            const data = edge.data();
            Object.keys(data).forEach(key => {
                // id, source, targetは除外
                if (key !== 'id' && key !== 'source' && key !== 'target') {
                    columns.add(key);
                }
            });
        });

        return Array.from(columns).sort();
    }

    /**
     * Edge用のMapping Typeを更新
     */
    updateEdgeMappingTypeForProperty(property) {
        const columnSelect = document.getElementById(`edge-${property}-mapping-column`);
        const typeSelect = document.getElementById(`edge-${property}-mapping-type`);
        const mappingPanel = document.getElementById(`edge-${property}-mapping-panel`);
        if (!columnSelect || !typeSelect) return;

        const column = columnSelect.value;
        if (!column) return;

        const dataType = this.getEdgeColumnDataType(column);
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'text';
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        
        if (dataType === 'numeric') {
            if (valueType === 'color') {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                    <option value="gradient">Gradient</option>
                    <option value="continuous">Continuous</option>
                `;
                typeSelect.value = 'gradient';
                mapping.type = 'gradient';
            } else if (valueType === 'number') {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                    <option value="continuous">Continuous</option>
                `;
                typeSelect.value = 'continuous';
                mapping.type = 'continuous';
            } else {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                `;
                typeSelect.value = 'individual';
                mapping.type = 'individual';
            }
        } else {
            typeSelect.innerHTML = `
                <option value="individual">Individual</option>
            `;
            typeSelect.value = 'individual';
            mapping.type = 'individual';
        }
    }

    /**
     * エッジカラムのデータ型を判定
     */
    getEdgeColumnDataType(column) {
        if (!window.networkManager || !networkManager.cy) return 'string';

        let hasNumeric = false;
        let hasString = false;

        networkManager.cy.edges().forEach(edge => {
            const value = edge.data(column);
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
                    hasNumeric = true;
                } else {
                    hasString = true;
                }
            }
        });

        if (hasNumeric && !hasString) {
            return 'numeric';
        }
        return 'string';
    }

    /**
     * Edge用のMapping値UIを更新
     */
    updateEdgeMappingValuesForProperty(property) {
        const columnSelect = document.getElementById(`edge-${property}-mapping-column`);
        const typeSelect = document.getElementById(`edge-${property}-mapping-type`);
        const valuesContainer = document.getElementById(`edge-${property}-mapping-values`);
        const mappingPanel = document.getElementById(`edge-${property}-mapping-panel`);

        if (!columnSelect || !valuesContainer) return;

        const column = columnSelect.value;
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'text';
        const mappingType = typeSelect ? typeSelect.value : 'individual';

        if (!column) {
            valuesContainer.innerHTML = '';
            return;
        }

        if (valueType === 'color') {
            if (mappingType === 'individual') {
                this.createEdgeIndividualColorMappingUI(property, column, valuesContainer);
            } else if (mappingType === 'gradient') {
                this.createEdgeGradientMappingUI(property, column, valuesContainer);
            } else if (mappingType === 'continuous') {
                this.createEdgeContinuousMappingUI(property, column, valuesContainer);
            }
        } else if (valueType === 'number') {
            if (mappingType === 'continuous') {
                this.createEdgeContinuousMappingUI(property, column, valuesContainer);
            } else {
                this.createEdgeNumberMappingUI(property, column, valuesContainer);
            }
        } else if (valueType === 'lineType') {
            this.createEdgeLineTypeMappingUI(property, column, valuesContainer);
        } else if (valueType === 'arrowShape') {
            this.createEdgeArrowShapeMappingUI(property, column, valuesContainer);
        }
    }

    /**
     * Edge用Individual Color Mapping UIを作成
     */
    createEdgeIndividualColorMappingUI(property, column, container) {
        const uniqueValues = this.getEdgeUniqueValues(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        const savedValues = mapping.values || {};
        const defaultColor = StylePanel.savedSettings.edge.lineColor || '#94a3b8';

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedColor = savedValues[strValue];
            const colorValue = savedColor !== undefined ? savedColor : defaultColor;
            mapping.values[strValue] = colorValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <input type="color" class="mapping-value-input edge-mapping-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" value="${colorValue}">
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        this.setupEdgeMappingValueEvents(property);
        this.applyEdgeStyle();
    }

    /**
     * Edge用Number Mapping UIを作成
     */
    createEdgeNumberMappingUI(property, column, container) {
        const uniqueValues = this.getEdgeUniqueValues(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        const savedValues = mapping.values || {};
        const defaultValue = StylePanel.savedSettings.edge.width || '2';

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedVal = savedValues[strValue];
            const numValue = savedVal !== undefined ? savedVal : defaultValue;
            mapping.values[strValue] = numValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <input type="number" class="mapping-value-input edge-mapping-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" value="${numValue}" min="1" max="20" style="width: 60px;">
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        this.setupEdgeMappingValueEvents(property);
        this.applyEdgeStyle();
    }

    /**
     * Edge用Line Type Mapping UIを作成
     */
    createEdgeLineTypeMappingUI(property, column, container) {
        const uniqueValues = this.getEdgeUniqueValues(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        const savedValues = mapping.values || {};
        const defaultValue = StylePanel.savedSettings.edge.lineType || 'solid';

        const options = [
            { value: 'solid', label: 'ノーマル' },
            { value: 'dashed', label: '点線' }
        ];

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedVal = savedValues[strValue];
            const lineTypeValue = savedVal !== undefined ? savedVal : defaultValue;
            mapping.values[strValue] = lineTypeValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <select class="mapping-value-input edge-mapping-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" style="width: 100px;">
                        ${options.map(opt => `<option value="${opt.value}" ${opt.value === lineTypeValue ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        this.setupEdgeMappingValueEvents(property);
        this.applyEdgeStyle();
    }

    /**
     * Edge用Arrow Shape Mapping UIを作成
     */
    createEdgeArrowShapeMappingUI(property, column, container) {
        const uniqueValues = this.getEdgeUniqueValues(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        const savedValues = mapping.values || {};
        const defaultValue = StylePanel.savedSettings.edge.arrowShape || 'triangle';

        const options = [
            { value: 'triangle', label: '矢印' },
            { value: 'none', label: 'ノーマル' }
        ];

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedVal = savedValues[strValue];
            const arrowValue = savedVal !== undefined ? savedVal : defaultValue;
            mapping.values[strValue] = arrowValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <select class="mapping-value-input edge-mapping-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" style="width: 100px;">
                        ${options.map(opt => `<option value="${opt.value}" ${opt.value === arrowValue ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        this.setupEdgeMappingValueEvents(property);
        this.applyEdgeStyle();
    }

    /**
     * Edge用Gradient Mapping UIを作成
     */
    createEdgeGradientMappingUI(property, column, container) {
        const { min, max } = this.getEdgeNumericRange(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        
        const savedGradient = mapping.gradientColors;
        const minColorValue = savedGradient ? savedGradient.min : '#ffff00';
        const maxColorValue = savedGradient ? savedGradient.max : '#000080';
        
        if (!savedGradient) {
            mapping.gradientColors = { min: minColorValue, max: maxColorValue };
        }

        container.innerHTML = `
            <div class="gradient-mapping">
                <div class="gradient-preview" id="edge-${property}-gradient-preview"></div>
                <div class="gradient-range">
                    <span>Min: ${min.toFixed(2)}</span>
                    <span>Max: ${max.toFixed(2)}</span>
                </div>
                <div class="gradient-colors">
                    <div class="gradient-color-item">
                        <label>Min Color:</label>
                        <input type="color" id="edge-${property}-gradient-min-color" value="${minColorValue}">
                    </div>
                    <div class="gradient-color-item">
                        <label>Max Color:</label>
                        <input type="color" id="edge-${property}-gradient-max-color" value="${maxColorValue}">
                    </div>
                </div>
            </div>
        `;

        this.updateEdgeGradientPreview(property);
        this.setupEdgeGradientColorEvents(property);
        this.applyEdgeStyle();
    }

    /**
     * Edge用Gradientカラーのイベントを設定
     */
    setupEdgeGradientColorEvents(property) {
        const minColorInput = document.getElementById(`edge-${property}-gradient-min-color`);
        const maxColorInput = document.getElementById(`edge-${property}-gradient-max-color`);
        const mapping = StylePanel.savedSettings.edge.mappings[property];

        const updateGradient = () => {
            this.updateEdgeGradientPreview(property);
            mapping.gradientColors = {
                min: minColorInput.value,
                max: maxColorInput.value
            };
            this.applyEdgeStyle();
        };

        if (minColorInput) {
            minColorInput.addEventListener('input', updateGradient);
            minColorInput.addEventListener('change', updateGradient);
        }

        if (maxColorInput) {
            maxColorInput.addEventListener('input', updateGradient);
            maxColorInput.addEventListener('change', updateGradient);
        }
    }

    /**
     * Edge用グラデーションプレビューを更新
     */
    updateEdgeGradientPreview(property) {
        const preview = document.getElementById(`edge-${property}-gradient-preview`);
        const minColor = document.getElementById(`edge-${property}-gradient-min-color`);
        const maxColor = document.getElementById(`edge-${property}-gradient-max-color`);

        if (preview && minColor && maxColor) {
            preview.style.background = `linear-gradient(to right, ${minColor.value}, ${maxColor.value})`;
        }
    }

    /**
     * Edge用Continuous Mapping UIを作成
     */
    createEdgeContinuousMappingUI(property, column, container) {
        const { min, max } = this.getEdgeNumericRange(column);
        const mapping = StylePanel.savedSettings.edge.mappings[property];
        const mappingPanel = document.getElementById(`edge-${property}-mapping-panel`);
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'number';
        
        // プロパティに応じたデフォルト値と刻み
        let defaultMinSize, defaultMaxSize, step;
        if (property === 'width') {
            defaultMinSize = 1;
            defaultMaxSize = 10;
            step = 0.1;
        } else {
            defaultMinSize = 1;
            defaultMaxSize = 20;
            step = 0.1;
        }

        // 保存された設定を取得
        const savedRange = mapping.continuousRange;
        const minSizeValue = savedRange ? savedRange.minSize : defaultMinSize;
        const maxSizeValue = savedRange ? savedRange.maxSize : defaultMaxSize;
        
        // デフォルト設定を保存
        if (!savedRange) {
            mapping.continuousRange = {
                minSize: minSizeValue,
                maxSize: maxSizeValue
            };
        }

        container.innerHTML = `
            <div class="continuous-mapping">
                <div class="continuous-data-range">
                    <span>Data Range:</span>
                    <span class="data-range-values">Min: ${min.toFixed(2)} ～ Max: ${max.toFixed(2)}</span>
                </div>
                <div class="continuous-size-range">
                    <div class="continuous-size-item">
                        <label>Data Min → Size:</label>
                        <input type="number" id="edge-${property}-continuous-min-size" value="${minSizeValue}" step="${step}" min="0.1" style="width: 80px;">
                    </div>
                    <div class="continuous-size-item">
                        <label>Data Max → Size:</label>
                        <input type="number" id="edge-${property}-continuous-max-size" value="${maxSizeValue}" step="${step}" min="0.1" style="width: 80px;">
                    </div>
                </div>
            </div>
        `;

        // イベントリスナーを設定
        this.setupEdgeContinuousMappingEvents(property);
        
        // 即時にスタイルを適用
        this.applyEdgeStyle();
    }

    /**
     * Edge用Continuousマッピングのイベントを設定
     */
    setupEdgeContinuousMappingEvents(property) {
        const minSizeInput = document.getElementById(`edge-${property}-continuous-min-size`);
        const maxSizeInput = document.getElementById(`edge-${property}-continuous-max-size`);
        const mapping = StylePanel.savedSettings.edge.mappings[property];

        const updateContinuous = () => {
            mapping.continuousRange = {
                minSize: parseFloat(minSizeInput.value) || 0.1,
                maxSize: parseFloat(maxSizeInput.value) || 0.1
            };
            this.applyEdgeStyle();
        };

        if (minSizeInput) {
            minSizeInput.addEventListener('input', updateContinuous);
            minSizeInput.addEventListener('change', updateContinuous);
        }

        if (maxSizeInput) {
            maxSizeInput.addEventListener('input', updateContinuous);
            maxSizeInput.addEventListener('change', updateContinuous);
        }
    }

    /**
     * Edge用Mapping値のイベントを設定
     */
    setupEdgeMappingValueEvents(property) {
        const inputs = document.querySelectorAll(`.edge-mapping-input[data-property="${property}"]`);
        const mapping = StylePanel.savedSettings.edge.mappings[property];

        inputs.forEach(input => {
            const handler = (e) => {
                const value = e.target.dataset.value;
                mapping.values[value] = e.target.value;
                this.applyEdgeStyle();
            };
            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });
    }

    /**
     * エッジの一意な値を取得
     */
    getEdgeUniqueValues(column) {
        if (!window.networkManager || !networkManager.cy) return [];

        const values = new Set();
        networkManager.cy.edges().forEach(edge => {
            const value = edge.data(column);
            if (value !== undefined && value !== null && value !== '') {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a - b;
            }
            return String(a).localeCompare(String(b));
        });
    }

    /**
     * エッジの数値範囲を取得
     */
    getEdgeNumericRange(column) {
        if (!window.networkManager || !networkManager.cy) return { min: 0, max: 1 };

        let min = Infinity;
        let max = -Infinity;

        networkManager.cy.edges().forEach(edge => {
            const value = edge.data(column);
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                min = Math.min(min, numValue);
                max = Math.max(max, numValue);
            }
        });

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 1;
        if (min === max) max = min + 1;

        return { min, max };
    }

    /**
     * プロパティ用のカラム選択肢を設定
     */
    populateMappingColumnOptions(property) {
        const columnSelect = document.getElementById(`${property}-mapping-column`);
        if (!columnSelect || !window.networkManager || !networkManager.cy) return;

        columnSelect.innerHTML = '<option value="">-- Select Column --</option>';

        const columns = this.getNodeAttributeColumns();
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            columnSelect.appendChild(option);
        });
    }

    /**
     * ノードの属性カラムを取得
     */
    getNodeAttributeColumns() {
        if (!window.networkManager || !networkManager.cy) return [];

        const columns = new Set();
        networkManager.cy.nodes().forEach(node => {
            const data = node.data();
            Object.keys(data).forEach(key => {
                // id, labelは除外
                if (key !== 'id' && key !== 'label') {
                    columns.add(key);
                }
            });
        });

        return Array.from(columns).sort();
    }

    /**
     * プロパティのMapping Typeを更新
     */
    updateMappingTypeForProperty(property) {
        const columnSelect = document.getElementById(`${property}-mapping-column`);
        const typeSelect = document.getElementById(`${property}-mapping-type`);
        const mappingPanel = document.getElementById(`${property}-mapping-panel`);
        if (!columnSelect || !typeSelect) return;

        const column = columnSelect.value;
        if (!column) return;

        const dataType = this.getColumnDataType(column);
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'text';
        const mapping = StylePanel.savedSettings.node.mappings[property];
        
        // データ型に応じてプルダウンオプションを更新
        if (dataType === 'numeric') {
            if (valueType === 'color') {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                    <option value="gradient">Gradient</option>
                    <option value="continuous">Continuous</option>
                `;
                typeSelect.value = 'gradient';
                mapping.type = 'gradient';
            } else if (valueType === 'number') {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                    <option value="continuous">Continuous</option>
                `;
                typeSelect.value = 'continuous';
                mapping.type = 'continuous';
            } else {
                typeSelect.innerHTML = `
                    <option value="individual">Individual</option>
                `;
                typeSelect.value = 'individual';
                mapping.type = 'individual';
            }
        } else {
            typeSelect.innerHTML = `
                <option value="individual">Individual</option>
            `;
            typeSelect.value = 'individual';
            mapping.type = 'individual';
        }
    }

    /**
     * カラムのデータ型を判定
     */
    getColumnDataType(column) {
        if (!window.networkManager || !networkManager.cy) return 'string';

        let hasNumeric = false;
        let hasString = false;

        networkManager.cy.nodes().forEach(node => {
            const value = node.data(column);
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
                    hasNumeric = true;
                } else {
                    hasString = true;
                }
            }
        });

        if (hasNumeric && !hasString) {
            return 'numeric';
        }
        return 'string';
    }

    /**
     * プロパティのMapping値UIを更新
     */
    updateMappingValuesForProperty(property) {
        const columnSelect = document.getElementById(`${property}-mapping-column`);
        const typeSelect = document.getElementById(`${property}-mapping-type`);
        const valuesContainer = document.getElementById(`${property}-mapping-values`);
        const mappingPanel = document.getElementById(`${property}-mapping-panel`);

        if (!columnSelect || !valuesContainer) return;

        const column = columnSelect.value;
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'text';
        const mappingType = typeSelect ? typeSelect.value : 'individual';

        if (!column) {
            valuesContainer.innerHTML = '';
            return;
        }

        if (valueType === 'color') {
            if (mappingType === 'individual') {
                this.createIndividualColorMappingUI(property, column, valuesContainer);
            } else if (mappingType === 'gradient') {
                this.createGradientMappingUI(property, column, valuesContainer);
            } else if (mappingType === 'continuous') {
                this.createContinuousMappingUI(property, column, valuesContainer);
            }
        } else if (valueType === 'number') {
            if (mappingType === 'continuous') {
                this.createContinuousMappingUI(property, column, valuesContainer);
            } else {
                this.createNumberMappingUI(property, column, valuesContainer);
            }
        } else if (valueType === 'shape') {
            this.createShapeMappingUI(property, column, valuesContainer);
        }
    }

    /**
     * Individual Color Mapping UIを作成
     */
    createIndividualColorMappingUI(property, column, container) {
        const uniqueValues = this.getUniqueValues(column);
        const mapping = StylePanel.savedSettings.node.mappings[property];
        const savedValues = mapping.values || {};
        
        // デフォルト色を取得
        let defaultColor = '#2563eb';
        if (property === 'fillColor') {
            defaultColor = StylePanel.savedSettings.node.fillColor;
        } else if (property === 'labelColor') {
            defaultColor = StylePanel.savedSettings.node.labelColor;
        }

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedColor = savedValues[strValue];
            const colorValue = savedColor !== undefined ? savedColor : defaultColor;
            // mapping.valuesに値を保存
            mapping.values[strValue] = colorValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <input type="color" class="mapping-value-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" value="${colorValue}">
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // イベントリスナーを設定
        this.setupMappingValueEvents(property);
        
        // 即時適用
        this.applyNodeStyle();
    }

    /**
     * Number Mapping UIを作成（フォントサイズ、ノードサイズ用）
     */
    createNumberMappingUI(property, column, container) {
        const uniqueValues = this.getUniqueValues(column);
        const mapping = StylePanel.savedSettings.node.mappings[property];
        const savedValues = mapping.values || {};
        
        // デフォルト値を取得
        let defaultValue = '12';
        let minVal = 8, maxVal = 72;
        if (property === 'size') {
            defaultValue = StylePanel.savedSettings.node.size;
            minVal = 10;
            maxVal = 200;
        } else if (property === 'labelFontSize') {
            defaultValue = StylePanel.savedSettings.node.labelFontSize;
        }

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedVal = savedValues[strValue];
            const numValue = savedVal !== undefined ? savedVal : defaultValue;
            // mapping.valuesに値を保存
            mapping.values[strValue] = numValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <input type="number" class="mapping-value-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" value="${numValue}" min="${minVal}" max="${maxVal}" style="width: 60px;">
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // イベントリスナーを設定
        this.setupMappingValueEvents(property);
        
        // 即時適用
        this.applyNodeStyle();
    }

    /**
     * Shape Mapping UIを作成
     */
    createShapeMappingUI(property, column, container) {
        const uniqueValues = this.getUniqueValues(column);
        const mapping = StylePanel.savedSettings.node.mappings[property];
        const savedValues = mapping.values || {};
        const defaultShape = StylePanel.savedSettings.node.shape;

        const shapeOptions = [
            { value: 'ellipse', label: '○ (Ellipse)' },
            { value: 'rectangle', label: '□ (Rectangle)' },
            { value: 'diamond', label: '◇ (Diamond)' },
            { value: 'triangle', label: '△ (Triangle)' }
        ];

        let html = '<div class="mapping-value-list">';
        uniqueValues.forEach((value) => {
            const strValue = String(value);
            const savedVal = savedValues[strValue];
            const shapeValue = savedVal !== undefined ? savedVal : defaultShape;
            // mapping.valuesに値を保存
            mapping.values[strValue] = shapeValue;
            html += `
                <div class="mapping-value-item">
                    <span class="mapping-value-label" title="${value}">${value}</span>
                    <select class="mapping-value-input" data-property="${property}" data-value="${this.escapeHtml(strValue)}" style="width: 120px;">
                        ${shapeOptions.map(opt => `<option value="${opt.value}" ${opt.value === shapeValue ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // イベントリスナーを設定
        this.setupMappingValueEvents(property);
        
        // 即時適用
        this.applyNodeStyle();
    }

    /**
     * Mapping値のイベントを設定
     */
    setupMappingValueEvents(property) {
        const inputs = document.querySelectorAll(`.mapping-value-input[data-property="${property}"]`);
        const mapping = StylePanel.savedSettings.node.mappings[property];

        inputs.forEach(input => {
            const handler = (e) => {
                const value = e.target.dataset.value;
                mapping.values[value] = e.target.value;
                this.applyNodeStyle();
            };
            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });
    }

    /**
     * Gradient Mapping UIを作成
     */
    createGradientMappingUI(property, column, container) {
        const { min, max } = this.getNumericRange(column);
        const mapping = StylePanel.savedSettings.node.mappings[property];
        
        // 保存された色設定を取得、なければデフォルト（黄色→紺色）
        const savedGradient = mapping.gradientColors;
        const minColorValue = savedGradient ? savedGradient.min : '#ffff00';
        const maxColorValue = savedGradient ? savedGradient.max : '#000080';
        
        // デフォルト色を保存
        if (!savedGradient) {
            mapping.gradientColors = {
                min: minColorValue,
                max: maxColorValue
            };
        }

        container.innerHTML = `
            <div class="gradient-mapping">
                <div class="gradient-preview" id="${property}-gradient-preview"></div>
                <div class="gradient-range">
                    <span>Min: ${min.toFixed(2)}</span>
                    <span>Max: ${max.toFixed(2)}</span>
                </div>
                <div class="gradient-colors">
                    <div class="gradient-color-item">
                        <label>Min Color:</label>
                        <input type="color" id="${property}-gradient-min-color" value="${minColorValue}">
                    </div>
                    <div class="gradient-color-item">
                        <label>Max Color:</label>
                        <input type="color" id="${property}-gradient-max-color" value="${maxColorValue}">
                    </div>
                </div>
            </div>
        `;

        // グラデーションプレビューを更新
        this.updateGradientPreviewForProperty(property);

        // イベントリスナーを設定
        this.setupGradientColorEvents(property);
        
        // 即時にスタイルを適用
        this.applyNodeStyle();
    }

    /**
     * Gradientカラーのイベントを設定
     */
    setupGradientColorEvents(property) {
        const minColorInput = document.getElementById(`${property}-gradient-min-color`);
        const maxColorInput = document.getElementById(`${property}-gradient-max-color`);
        const mapping = StylePanel.savedSettings.node.mappings[property];

        const updateGradient = () => {
            this.updateGradientPreviewForProperty(property);
            mapping.gradientColors = {
                min: minColorInput.value,
                max: maxColorInput.value
            };
            this.applyNodeStyle();
        };

        if (minColorInput) {
            minColorInput.addEventListener('input', updateGradient);
            minColorInput.addEventListener('change', updateGradient);
        }

        if (maxColorInput) {
            maxColorInput.addEventListener('input', updateGradient);
            maxColorInput.addEventListener('change', updateGradient);
        }
    }

    /**
     * グラデーションプレビューを更新
     */
    updateGradientPreviewForProperty(property) {
        const preview = document.getElementById(`${property}-gradient-preview`);
        const minColor = document.getElementById(`${property}-gradient-min-color`);
        const maxColor = document.getElementById(`${property}-gradient-max-color`);

        if (preview && minColor && maxColor) {
            preview.style.background = `linear-gradient(to right, ${minColor.value}, ${maxColor.value})`;
        }
    }

    /**
     * Node用Continuous Mapping UIを作成
     */
    createContinuousMappingUI(property, column, container) {
        const { min, max } = this.getNumericRange(column);
        const mapping = StylePanel.savedSettings.node.mappings[property];
        const mappingPanel = document.getElementById(`${property}-mapping-panel`);
        const valueType = mappingPanel ? mappingPanel.dataset.valueType : 'number';
        
        // プロパティに応じたデフォルト値と刻み
        let defaultMinSize, defaultMaxSize, step;
        if (property === 'labelFontSize') {
            defaultMinSize = 8;
            defaultMaxSize = 24;
            step = 1;
        } else if (property === 'size') {
            defaultMinSize = 10;
            defaultMaxSize = 80;
            step = 0.1;
        } else {
            defaultMinSize = 1;
            defaultMaxSize = 20;
            step = 0.1;
        }

        // 保存された設定を取得
        const savedRange = mapping.continuousRange;
        const minSizeValue = savedRange ? savedRange.minSize : defaultMinSize;
        const maxSizeValue = savedRange ? savedRange.maxSize : defaultMaxSize;
        
        // デフォルト設定を保存
        if (!savedRange) {
            mapping.continuousRange = {
                minSize: minSizeValue,
                maxSize: maxSizeValue
            };
        }

        container.innerHTML = `
            <div class="continuous-mapping">
                <div class="continuous-data-range">
                    <span>Data Range:</span>
                    <span class="data-range-values">Min: ${min.toFixed(2)} ～ Max: ${max.toFixed(2)}</span>
                </div>
                <div class="continuous-size-range">
                    <div class="continuous-size-item">
                        <label>Data Min → Size:</label>
                        <input type="number" id="${property}-continuous-min-size" value="${minSizeValue}" step="${step}" min="1" style="width: 80px;">
                    </div>
                    <div class="continuous-size-item">
                        <label>Data Max → Size:</label>
                        <input type="number" id="${property}-continuous-max-size" value="${maxSizeValue}" step="${step}" min="1" style="width: 80px;">
                    </div>
                </div>
            </div>
        `;

        // イベントリスナーを設定
        this.setupContinuousMappingEvents(property);
        
        // 即時にスタイルを適用
        this.applyNodeStyle();
    }

    /**
     * Node用Continuousマッピングのイベントを設定
     */
    setupContinuousMappingEvents(property) {
        const minSizeInput = document.getElementById(`${property}-continuous-min-size`);
        const maxSizeInput = document.getElementById(`${property}-continuous-max-size`);
        const mapping = StylePanel.savedSettings.node.mappings[property];

        const updateContinuous = () => {
            mapping.continuousRange = {
                minSize: parseFloat(minSizeInput.value) || 1,
                maxSize: parseFloat(maxSizeInput.value) || 1
            };
            this.applyNodeStyle();
        };

        if (minSizeInput) {
            minSizeInput.addEventListener('input', updateContinuous);
            minSizeInput.addEventListener('change', updateContinuous);
        }

        if (maxSizeInput) {
            maxSizeInput.addEventListener('input', updateContinuous);
            maxSizeInput.addEventListener('change', updateContinuous);
        }
    }

    /**
     * カラムの一意な値を取得
     */
    getUniqueValues(column) {
        if (!window.networkManager || !networkManager.cy) return [];

        const values = new Set();
        networkManager.cy.nodes().forEach(node => {
            const value = node.data(column);
            if (value !== undefined && value !== null && value !== '') {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a - b;
            }
            return String(a).localeCompare(String(b));
        });
    }

    /**
     * 数値カラムの範囲を取得
     */
    getNumericRange(column) {
        if (!window.networkManager || !networkManager.cy) return { min: 0, max: 1 };

        let min = Infinity;
        let max = -Infinity;

        networkManager.cy.nodes().forEach(node => {
            const value = node.data(column);
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                min = Math.min(min, numValue);
                max = Math.max(max, numValue);
            }
        });

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 1;
        if (min === max) max = min + 1;

        return { min, max };
    }

    /**
     * 区別しやすい色を生成
     */
    generateDistinctColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 360 / count) % 360;
            colors.push(this.hslToHex(hue, 70, 50));
        }
        return colors;
    }

    /**
     * HSLをHEXに変換
     */
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 色を補間
     */
    interpolateColor(color1, color2, ratio) {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');

        const r1 = parseInt(hex1.substring(0, 2), 16);
        const g1 = parseInt(hex1.substring(2, 4), 16);
        const b1 = parseInt(hex1.substring(4, 6), 16);

        const r2 = parseInt(hex2.substring(0, 2), 16);
        const g2 = parseInt(hex2.substring(2, 4), 16);
        const b2 = parseInt(hex2.substring(4, 6), 16);

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * スタイルを適用
     */
    applyStyle() {
        if (!window.networkManager || !networkManager.cy) {
            alert('ネットワークが読み込まれていません。');
            return;
        }

        if (this.type === 'node') {
            this.applyNodeStyle();
        } else {
            this.applyEdgeStyle();
        }
    }

    /**
     * ノードスタイルを適用
     */
    applyNodeStyle() {
        if (!window.networkManager || !networkManager.cy) {
            console.log('networkManager or cy not available');
            return;
        }

        const fontSizeEl = document.getElementById('node-label-font-size');
        const labelColorEl = document.getElementById('node-label-color');
        const fillColorEl = document.getElementById('node-fill-color');
        const shapeEl = document.getElementById('node-shape');
        const sizeEl = document.getElementById('node-size');

        const fontSize = fontSizeEl ? fontSizeEl.value : StylePanel.savedSettings.node.labelFontSize;
        const labelColor = labelColorEl ? labelColorEl.value : StylePanel.savedSettings.node.labelColor;
        const fillColor = fillColorEl ? fillColorEl.value : StylePanel.savedSettings.node.fillColor;
        const shape = shapeEl ? shapeEl.value : StylePanel.savedSettings.node.shape;
        const size = sizeEl ? sizeEl.value : StylePanel.savedSettings.node.size;

        // 設定値を保存
        StylePanel.savedSettings.node.labelFontSize = fontSize;
        StylePanel.savedSettings.node.labelColor = labelColor;
        StylePanel.savedSettings.node.fillColor = fillColor;
        StylePanel.savedSettings.node.shape = shape;
        StylePanel.savedSettings.node.size = size;

        const mappings = StylePanel.savedSettings.node.mappings;

        // 各ノードにスタイルを適用
        networkManager.cy.nodes().forEach(node => {
            const nodeStyles = {};
            
            // Label Font Size
            nodeStyles['font-size'] = this.getMappedValue(node, 'labelFontSize', fontSize, mappings) + 'px';
            
            // Label Color
            nodeStyles['color'] = this.getMappedColorValue(node, 'labelColor', labelColor, mappings);
            
            // Fill Color
            nodeStyles['background-color'] = this.getMappedColorValue(node, 'fillColor', fillColor, mappings);
            
            // Shape
            const nodeShape = this.getMappedValue(node, 'shape', shape, mappings);
            nodeStyles['shape'] = nodeShape;
            
            // overlay-shape をノードのshapeに合わせる
            // Cytoscape.js の overlay-shape は 'ellipse' と 'round-rectangle' のみサポート
            if (nodeShape === 'ellipse') {
                nodeStyles['overlay-shape'] = 'ellipse';
            } else {
                nodeStyles['overlay-shape'] = 'round-rectangle';
            }
            
            // Size
            const nodeSize = this.getMappedValue(node, 'size', size, mappings);
            nodeStyles['width'] = nodeSize + 'px';
            nodeStyles['height'] = nodeSize + 'px';
            
            node.style(nodeStyles);
        });

        console.log('Node style applied to', networkManager.cy.nodes().length, 'nodes');
    }

    /**
     * マッピングされた値を取得（数値・Shape用）
     */
    getMappedValue(node, property, defaultValue, mappings) {
        const mapping = mappings[property];
        // columnが設定されていればマッピングを適用（パネルが閉じていても）
        if (!mapping || !mapping.column) {
            return defaultValue;
        }

        const nodeValue = node.data(mapping.column);

        // Continuousマッピングの場合
        if (mapping.type === 'continuous' && mapping.continuousRange) {
            const numValue = parseFloat(nodeValue);
            if (!isNaN(numValue)) {
                const { min, max } = this.getNumericRange(mapping.column);
                const ratio = (max !== min) ? (numValue - min) / (max - min) : 0;
                const { minSize, maxSize } = mapping.continuousRange;
                const calculatedSize = minSize + (maxSize - minSize) * ratio;
                // プロパティに応じた丸め処理
                if (property === 'labelFontSize') {
                    return Math.round(calculatedSize); // 1刻み
                } else {
                    return Math.round(calculatedSize * 10) / 10; // 0.1刻み
                }
            }
            return defaultValue;
        }

        // Individualマッピングの場合
        const strValue = String(nodeValue || '');
        const mappedValue = mapping.values[strValue];
        
        return mappedValue !== undefined ? mappedValue : defaultValue;
    }

    /**
     * マッピングされた色を取得（Color用 - Gradient対応）
     */
    getMappedColorValue(node, property, defaultColor, mappings) {
        const mapping = mappings[property];
        // columnが設定されていればマッピングを適用（パネルが閉じていても）
        if (!mapping || !mapping.column) {
            return defaultColor;
        }

        const nodeValue = node.data(mapping.column);

        if (mapping.type === 'gradient' && mapping.gradientColors) {
            const numValue = parseFloat(nodeValue);
            if (!isNaN(numValue)) {
                const { min, max } = this.getNumericRange(mapping.column);
                const ratio = (numValue - min) / (max - min);
                return this.interpolateColor(mapping.gradientColors.min, mapping.gradientColors.max, ratio);
            }
            return defaultColor;
        } else {
            // Individual mapping
            const mappedColor = mapping.values[String(nodeValue || '')];
            return mappedColor !== undefined ? mappedColor : defaultColor;
        }
    }

    /**
     * エッジスタイルを適用
     */
    applyEdgeStyle() {
        if (!window.networkManager || !networkManager.cy) {
            console.log('networkManager or cy not available');
            return;
        }

        const lineTypeEl = document.getElementById('edge-line-type');
        const arrowShapeEl = document.getElementById('edge-arrow-shape');
        const widthEl = document.getElementById('edge-width');
        const lineColorEl = document.getElementById('edge-line-color');

        const lineType = lineTypeEl ? lineTypeEl.value : StylePanel.savedSettings.edge.lineType;
        const arrowShape = arrowShapeEl ? arrowShapeEl.value : StylePanel.savedSettings.edge.arrowShape;
        const width = widthEl ? widthEl.value : StylePanel.savedSettings.edge.width;
        const lineColor = lineColorEl ? lineColorEl.value : StylePanel.savedSettings.edge.lineColor;

        // 設定値を保存
        StylePanel.savedSettings.edge.lineType = lineType;
        StylePanel.savedSettings.edge.arrowShape = arrowShape;
        StylePanel.savedSettings.edge.width = width;
        StylePanel.savedSettings.edge.lineColor = lineColor;

        const mappings = StylePanel.savedSettings.edge.mappings;

        // 各エッジにスタイルを適用
        networkManager.cy.edges().forEach(edge => {
            const edgeStyles = {};
            
            // Line Type
            const mappedLineType = this.getEdgeMappedValue(edge, 'lineType', lineType, mappings);
            edgeStyles['line-style'] = mappedLineType === 'dashed' ? 'dashed' : 'solid';
            
            // Arrow Shape
            edgeStyles['target-arrow-shape'] = this.getEdgeMappedValue(edge, 'arrowShape', arrowShape, mappings);
            
            // Width
            edgeStyles['width'] = this.getEdgeMappedValue(edge, 'width', width, mappings) + 'px';
            
            // Line Color
            const mappedColor = this.getEdgeMappedColorValue(edge, 'lineColor', lineColor, mappings);
            edgeStyles['line-color'] = mappedColor;
            edgeStyles['target-arrow-color'] = mappedColor;
            
            edge.style(edgeStyles);
        });

        console.log('Edge style applied to', networkManager.cy.edges().length, 'edges');
    }

    /**
     * エッジのマッピングされた値を取得
     */
    getEdgeMappedValue(edge, property, defaultValue, mappings) {
        const mapping = mappings[property];
        if (!mapping || !mapping.column) {
            return defaultValue;
        }

        const edgeValue = edge.data(mapping.column);

        // Continuousマッピングの場合
        if (mapping.type === 'continuous' && mapping.continuousRange) {
            const numValue = parseFloat(edgeValue);
            if (!isNaN(numValue)) {
                const { min, max } = this.getEdgeNumericRange(mapping.column);
                const ratio = (max !== min) ? (numValue - min) / (max - min) : 0;
                const { minSize, maxSize } = mapping.continuousRange;
                const calculatedSize = minSize + (maxSize - minSize) * ratio;
                return Math.round(calculatedSize * 10) / 10; // 0.1刻み
            }
            return defaultValue;
        }

        // Individualマッピングの場合
        const strValue = String(edgeValue || '');
        const mappedValue = mapping.values[strValue];
        
        return mappedValue !== undefined ? mappedValue : defaultValue;
    }

    /**
     * エッジのマッピングされた色を取得
     */
    getEdgeMappedColorValue(edge, property, defaultColor, mappings) {
        const mapping = mappings[property];
        if (!mapping || !mapping.column) {
            return defaultColor;
        }

        const edgeValue = edge.data(mapping.column);

        if (mapping.type === 'gradient' && mapping.gradientColors) {
            const numValue = parseFloat(edgeValue);
            if (!isNaN(numValue)) {
                const { min, max } = this.getEdgeNumericRange(mapping.column);
                const ratio = (numValue - min) / (max - min);
                return this.interpolateColor(mapping.gradientColors.min, mapping.gradientColors.max, ratio);
            }
            return defaultColor;
        } else {
            const mappedColor = mapping.values[String(edgeValue || '')];
            return mappedColor !== undefined ? mappedColor : defaultColor;
        }
    }
}

// グローバル参照用
window.StylePanel = StylePanel;
