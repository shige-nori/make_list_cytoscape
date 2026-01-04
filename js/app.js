/**
 * App - メインアプリケーション
 */
class App {
    constructor() {
        this.networkFileData = null;
        this.tableFileData = null;
        this.currentFileHandle = null; // 現在開いている/保存したファイルのハンドル
        this.dataTypes = [
            { value: 'string', label: 'String' },
            { value: 'number', label: 'Integer' },
            { value: 'float', label: 'Float' },
            { value: 'boolean', label: 'Y/N (Boolean)' },
            { value: 'string[]', label: 'String Array' },
            { value: 'number[]', label: 'Integer Array' },
            { value: 'float[]', label: 'Float Array' },
            { value: 'boolean[]', label: 'Boolean Array' }
        ];
    }

    /**
     * カラムの値が全て整数かどうかを判定
     * @param {any[][]} data - データ行
     * @param {number} columnIndex - カラムインデックス
     * @returns {boolean}
     */
    isColumnAllIntegers(data, columnIndex) {
        for (const row of data) {
            const value = row[columnIndex];
            if (value === undefined || value === null || value === '') {
                continue; // 空の値はスキップ
            }
            const strValue = String(value).trim();
            if (strValue === '') continue;
            
            // 整数かどうかをチェック（小数点なし、数値のみ）
            if (!/^-?\d+$/.test(strValue)) {
                return false;
            }
        }
        return true;
    }

    /**
     * カラムのデータ型を自動判定
     * @param {any[][]} data - データ行
     * @param {number} columnIndex - カラムインデックス
     * @returns {string} - データ型
     */
    detectColumnDataType(data, columnIndex) {
        // 「| 」区切りのデータがあれば配列型として検出
        const hasArrayDelimiter = data.some(row => {
            const value = row[columnIndex];
            return value && typeof value === 'string' && value.includes('| ');
        });
        
        if (hasArrayDelimiter) {
            return 'string[]';
        }
        
        if (this.isColumnAllIntegers(data, columnIndex)) {
            return 'number';
        }
        return 'string';
    }

    /**
     * アプリケーションを初期化
     */
    initialize() {
        // NetworkManager初期化
        networkManager.initialize();

        // LayoutTools初期化
        layoutTools.initialize();

        // EdgeBends初期化
        edgeBends.initialize();

        // イベントリスナーを設定
        this.setupEventListeners();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // メニュー: Style
        document.getElementById('menu-style').addEventListener('click', () => {
            StylePanel.show();
        });

        // メニュー: View - Table Panel
        document.getElementById('menu-view-table').addEventListener('click', () => {
            if (window.tablePanel) {
                tablePanel.toggle();
            }
        });

                // メニュー: Close
                document.getElementById('menu-close').addEventListener('click', (e) => {
                    const menuItem = document.getElementById('menu-close');
                    if (menuItem.classList.contains('disabled')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    // ネットワーク図が存在する場合のみクリア
                    if (networkManager.cy && networkManager.cy.nodes().length > 0) {
                        networkManager.clear();
                        // ファイルハンドルをクリア
                        this.currentFileHandle = null;
                        // Save/Save As/Table File/Closeメニューを無効化
                        document.getElementById('menu-save').classList.add('disabled');
                        document.getElementById('menu-save-as').classList.add('disabled');
                        document.getElementById('menu-table-file').classList.add('disabled');
                        document.getElementById('menu-close').classList.add('disabled');
                        // テーブルパネルを非表示
                        if (window.tablePanel) {
                            tablePanel.hide();
                        }
                    }
                });
        // メニュー: Network File
        document.getElementById('menu-network-file').addEventListener('click', () => {
            // ネットワーク図がすでに存在する場合は確認モーダルを表示
            if (networkManager.cy && networkManager.cy.nodes().length > 0) {
                this.showConfirmModal(
                    '現在のネットワーク図は失われます。<br>新しいネットワーク図を読み込みますか？',
                    () => {
                        // 既存のネットワークをクリア
                        networkManager.clear();
                        // Table Fileメニューを無効化
                        document.getElementById('menu-table-file').classList.add('disabled');
                        // Save/Save As/Closeメニューを無効化
                        document.getElementById('menu-save').classList.add('disabled');
                        document.getElementById('menu-save-as').classList.add('disabled');
                        document.getElementById('menu-close').classList.add('disabled');
                        document.getElementById('network-file-input').click();
                    }
                );
                return;
            }
            document.getElementById('network-file-input').click();
        });

        // メニュー: Table File
        document.getElementById('menu-table-file').addEventListener('click', (e) => {
            const menuItem = document.getElementById('menu-table-file');
            if (menuItem.classList.contains('disabled')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            document.getElementById('table-file-input').click();
        });

        // メニュー: Save（上書き保存）
        document.getElementById('menu-save').addEventListener('click', (e) => {
            const menuItem = document.getElementById('menu-save');
            if (menuItem.classList.contains('disabled')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            this.saveNetwork();
        });

        // メニュー: Save As（名前を付けて保存）
        document.getElementById('menu-save-as').addEventListener('click', (e) => {
            const menuItem = document.getElementById('menu-save-as');
            if (menuItem.classList.contains('disabled')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            this.saveNetworkAs();
        });

        // メニュー: Open
        document.getElementById('menu-open').addEventListener('click', () => {
            // ネットワーク図がすでに存在する場合は確認モーダルを表示
            if (networkManager.cy && networkManager.cy.nodes().length > 0) {
                this.showConfirmModal(
                    '現在のネットワーク図は失われます。<br>保存したネットワーク図を開きますか？',
                    () => {
                        // 既存のネットワークをクリア
                        networkManager.clear();
                        // ファイルハンドルをクリア
                        this.currentFileHandle = null;
                        // Table Fileメニューを無効化
                        document.getElementById('menu-table-file').classList.add('disabled');
                        // Saveメニューを無効化
                        document.getElementById('menu-save').classList.add('disabled');
                        // Save Asメニューを無効化
                        document.getElementById('menu-save-as').classList.add('disabled');
                        // Closeメニューを無効化
                        document.getElementById('menu-close').classList.add('disabled');
                        this.openNetworkWithPicker();
                    }
                );
                return;
            }
            this.openNetworkWithPicker();
        });

        // ファイル入力: Open File（フォールバック用）
        document.getElementById('open-file-input').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await this.openNetwork(e.target.files[0], null);
                e.target.value = ''; // リセット
            }
        });

        // ファイル入力: Network File
        document.getElementById('network-file-input').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await this.handleNetworkFile(e.target.files[0]);
                e.target.value = ''; // リセット
            }
        });

        // ファイル入力: Table File
        document.getElementById('table-file-input').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await this.handleTableFile(e.target.files[0]);
                e.target.value = ''; // リセット
            }
        });

        // Network Modal
        document.getElementById('network-modal-close').addEventListener('click', () => {
            this.closeModal('network-modal');
        });
        document.getElementById('network-cancel').addEventListener('click', () => {
            this.closeModal('network-modal');
        });
        document.getElementById('network-import').addEventListener('click', () => {
            this.importNetworkData();
        });

        // Table Modal
        document.getElementById('table-modal-close').addEventListener('click', () => {
            this.closeModal('table-modal');
        });
        document.getElementById('table-cancel').addEventListener('click', () => {
            this.closeModal('table-modal');
        });
        document.getElementById('table-import').addEventListener('click', () => {
            this.importTableData();
        });

        // モーダル背景クリックで閉じる
        document.getElementById('network-modal').addEventListener('click', (e) => {
            if (e.target.id === 'network-modal') {
                this.closeModal('network-modal');
            }
        });
        document.getElementById('table-modal').addEventListener('click', (e) => {
            if (e.target.id === 'table-modal') {
                this.closeModal('table-modal');
            }
        });

        // ESCキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal('network-modal');
                this.closeModal('table-modal');
            }
        });
    }

    /**
     * Network Fileの処理
     * @param {File} file 
     */
    async handleNetworkFile(file) {
        try {
            this.networkFileData = await fileHandler.readFile(file);
            this.networkFileData.fileName = file.name;
            this.showNetworkModal();
            // Closeメニューを有効化
            document.getElementById('menu-close').classList.remove('disabled');
        } catch (error) {
            alert(`Error reading file: ${error.message}`);
        }
    }

    /**
     * Table Fileの処理
     * @param {File} file 
     */
    async handleTableFile(file) {
        try {
            this.tableFileData = await fileHandler.readFile(file);
            this.tableFileData.fileName = file.name;
            this.showTableModal();
            // Closeメニューを有効化
            document.getElementById('menu-close').classList.remove('disabled');
        } catch (error) {
            alert(`Error reading file: ${error.message}`);
        }
    }

    /**
     * Network Fileモーダルを表示
     */
    showNetworkModal() {
        const { headers, data, fileName } = this.networkFileData;

        // ファイル名を表示
        document.getElementById('network-file-name').textContent = `📁 ${fileName} (${data.length} rows)`;

        // カラム設定を作成
        this.createNetworkColumnSettings(headers, data);

        // ローディング状態をリセット
        this.setLoadingState('network', false);

        // モーダルを表示
        this.openModal('network-modal');
    }

    /**
     * Table Fileモーダルを表示
     */
    showTableModal() {
        const { headers, data, fileName } = this.tableFileData;

        // ファイル名を表示
        document.getElementById('table-file-name').textContent = `📁 ${fileName} (${data.length} rows)`;

        // カラム設定を作成
        this.createTableColumnSettings(headers, data);

        // ローディング状態をリセット
        this.setLoadingState('table', false);

        // モーダルを表示
        this.openModal('table-modal');
    }

    /**
     * ローディング状態を設定
     * @param {string} type - 'network' or 'table'
     * @param {boolean} isLoading - ローディング中かどうか
     */
    setLoadingState(type, isLoading) {
        const importBtn = document.getElementById(`${type}-import`);
        const cancelBtn = document.getElementById(`${type}-cancel`);
        const loadingMsg = document.getElementById(`${type}-loading-message`);

        if (isLoading) {
            importBtn.classList.add('loading');
            importBtn.disabled = true;
            cancelBtn.disabled = true;
            loadingMsg.classList.add('active');
        } else {
            importBtn.classList.remove('loading');
            importBtn.disabled = false;
            cancelBtn.disabled = false;
            loadingMsg.classList.remove('active');
        }
    }

    /**
     * Network Fileのカラム設定UIを作成（テーブル形式）
     * @param {string[]} headers 
     * @param {any[][]} data
     */
    createNetworkColumnSettings(headers, data) {
        const table = document.getElementById('network-column-settings');
        
        let html = `
            <thead>
                <tr>
                    <th>Column Name</th>
                    <th>Role</th>
                    <th>Data Type</th>
                    <th>Delimiter</th>
                </tr>
            </thead>
            <tbody>
        `;

        headers.forEach((header, index) => {
            const defaultRole = index === 0 ? 'source' : (index === 1 ? 'target' : 'attribute');
            const isAttribute = defaultRole === 'attribute';
            const detectedType = isAttribute ? this.detectColumnDataType(data, index) : 'string';
            
            const isArrayType = detectedType.endsWith('[]');
            const showDelimiter = isAttribute && isArrayType;
            
            html += `
                <tr data-index="${index}">
                    <td class="column-name" title="${this.escapeHtml(header)}">${this.escapeHtml(header)}</td>
                    <td>
                        <select class="role-select" data-index="${index}">
                            <option value="source" ${defaultRole === 'source' ? 'selected' : ''}>Source</option>
                            <option value="target" ${defaultRole === 'target' ? 'selected' : ''}>Target</option>
                            <option value="attribute" ${defaultRole === 'attribute' ? 'selected' : ''}>Attribute</option>
                            <option value="ignore">Ignore</option>
                        </select>
                    </td>
                    <td class="datatype-cell ${!isAttribute ? 'hidden-cell' : ''}">
                        <select class="datatype-select" data-index="${index}">
                            ${this.dataTypes.map(dt => `<option value="${dt.value}" ${dt.value === detectedType ? 'selected' : ''}>${dt.label}</option>`).join('')}
                        </select>
                    </td>
                    <td class="delimiter-cell ${!showDelimiter ? 'hidden-cell' : ''}">
                        <input type="text" class="delimiter-input" data-index="${index}" value="|" placeholder="|">
                    </td>
                </tr>
            `;
        });

        html += '</tbody>';
        table.innerHTML = html;

        // Role変更時のイベント
        table.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleNetworkRoleChange(e.target);
            });
        });

        // Data Type変更時のイベント
        table.querySelectorAll('.datatype-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleDataTypeChange(e.target);
            });
        });
    }

    /**
     * Data Type変更ハンドラ（配列型のときのみDelimiterを表示）
     * @param {HTMLSelectElement} select 
     */
    handleDataTypeChange(select) {
        const dataType = select.value;
        const row = select.closest('tr');
        const delimiterCell = row.querySelector('.delimiter-cell');
        const isArrayType = dataType.endsWith('[]');

        if (isArrayType) {
            delimiterCell.classList.remove('hidden-cell');
        } else {
            delimiterCell.classList.add('hidden-cell');
        }
    }

    /**
     * Network FileのRole変更ハンドラ
     * @param {HTMLSelectElement} select 
     */
    handleNetworkRoleChange(select) {
        const role = select.value;
        const row = select.closest('tr');
        const dataTypeCell = row.querySelector('.datatype-cell');
        const delimiterCell = row.querySelector('.delimiter-cell');
        const dataTypeSelect = row.querySelector('.datatype-select');
        const isArrayType = dataTypeSelect.value.endsWith('[]');

        if (role === 'attribute') {
            dataTypeCell.classList.remove('hidden-cell');
            // 配列型のときのみDelimiterを表示
            if (isArrayType) {
                delimiterCell.classList.remove('hidden-cell');
            } else {
                delimiterCell.classList.add('hidden-cell');
            }
        } else {
            dataTypeCell.classList.add('hidden-cell');
            delimiterCell.classList.add('hidden-cell');
        }

        // Source/Targetは1つずつしか選択できないように
        if (role === 'source' || role === 'target') {
            const allSelects = document.querySelectorAll('#network-column-settings .role-select');
            allSelects.forEach(otherSelect => {
                if (otherSelect !== select && otherSelect.value === role) {
                    otherSelect.value = 'attribute';
                    this.handleNetworkRoleChange(otherSelect);
                }
            });
        }
    }

    /**
     * Table Fileのカラム設定UIを作成（テーブル形式）
     * @param {string[]} headers 
     * @param {any[][]} data
     */
    createTableColumnSettings(headers, data) {
        const table = document.getElementById('table-column-settings');
        
        let html = `
            <thead>
                <tr>
                    <th>Column Name</th>
                    <th>Role</th>
                    <th>Data Type</th>
                    <th>Delimiter</th>
                </tr>
            </thead>
            <tbody>
        `;

        headers.forEach((header, index) => {
            const defaultRole = index === 0 ? 'node' : 'attribute';
            const isAttribute = defaultRole === 'attribute';
            const detectedType = isAttribute ? this.detectColumnDataType(data, index) : 'string';
            
            const isArrayType = detectedType.endsWith('[]');
            const showDelimiter = isAttribute && isArrayType;
            
            html += `
                <tr data-index="${index}">
                    <td class="column-name" title="${this.escapeHtml(header)}">${this.escapeHtml(header)}</td>
                    <td>
                        <select class="role-select" data-index="${index}">
                            <option value="node" ${defaultRole === 'node' ? 'selected' : ''}>Node</option>
                            <option value="attribute" ${defaultRole === 'attribute' ? 'selected' : ''}>Attribute</option>
                            <option value="ignore">Ignore</option>
                        </select>
                    </td>
                    <td class="datatype-cell ${!isAttribute ? 'hidden-cell' : ''}">
                        <select class="datatype-select" data-index="${index}">
                            ${this.dataTypes.map(dt => `<option value="${dt.value}" ${dt.value === detectedType ? 'selected' : ''}>${dt.label}</option>`).join('')}
                        </select>
                    </td>
                    <td class="delimiter-cell ${!showDelimiter ? 'hidden-cell' : ''}">
                        <input type="text" class="delimiter-input" data-index="${index}" value="|" placeholder="|">
                    </td>
                </tr>
            `;
        });

        html += '</tbody>';
        table.innerHTML = html;

        // Role変更時のイベント
        table.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleTableRoleChange(e.target);
            });
        });

        // Data Type変更時のイベント
        table.querySelectorAll('.datatype-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleDataTypeChange(e.target);
            });
        });
    }

    /**
     * Table FileのRole変更ハンドラ
     * @param {HTMLSelectElement} select 
     */
    handleTableRoleChange(select) {
        const role = select.value;
        const row = select.closest('tr');
        const dataTypeCell = row.querySelector('.datatype-cell');
        const delimiterCell = row.querySelector('.delimiter-cell');
        const dataTypeSelect = row.querySelector('.datatype-select');
        const isArrayType = dataTypeSelect.value.endsWith('[]');

        if (role === 'attribute') {
            dataTypeCell.classList.remove('hidden-cell');
            // 配列型のときのみDelimiterを表示
            if (isArrayType) {
                delimiterCell.classList.remove('hidden-cell');
            } else {
                delimiterCell.classList.add('hidden-cell');
            }
        } else {
            dataTypeCell.classList.add('hidden-cell');
            delimiterCell.classList.add('hidden-cell');
        }

        // Nodeは1つしか選択できないように
        if (role === 'node') {
            const allSelects = document.querySelectorAll('#table-column-settings .role-select');
            allSelects.forEach(otherSelect => {
                if (otherSelect !== select && otherSelect.value === 'node') {
                    otherSelect.value = 'attribute';
                    this.handleTableRoleChange(otherSelect);
                }
            });
        }
    }

    /**
     * Network Dataをインポート
     */
    async importNetworkData() {
        const table = document.getElementById('network-column-settings');
        const rows = table.querySelectorAll('tbody tr');
        const { headers, data } = this.networkFileData;

        let sourceCol = null;
        let targetCol = null;
        const attributes = [];

        rows.forEach(row => {
            const index = parseInt(row.dataset.index);
            const role = row.querySelector('.role-select').value;
            const dataType = row.querySelector('.datatype-select').value;
            const delimiter = row.querySelector('.delimiter-input').value || '|';

            if (role === 'source') {
                sourceCol = { index, name: headers[index] };
            } else if (role === 'target') {
                targetCol = { index, name: headers[index] };
            } else if (role === 'attribute') {
                attributes.push({
                    index,
                    name: headers[index],
                    dataType,
                    delimiter
                });
            }
        });

        if (!sourceCol || !targetCol) {
            alert('Please select Source and Target columns.');
            return;
        }

        // ローディング状態を開始
        this.setLoadingState('network', true);

        // 非同期処理でUIを更新させる
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // NetworkManagerにデータをインポート
            networkManager.importNetworkData({
                data,
                columnSettings: {
                    source: sourceCol,
                    target: targetCol,
                    attributes
                }
            });

            this.closeModal('network-modal');

            // Table Fileメニューを有効化
            document.getElementById('menu-table-file').classList.remove('disabled');
            // Save Asメニューを有効化（新規インポートなのでSaveは無効のまま）
            document.getElementById('menu-save-as').classList.remove('disabled');
            // ファイルハンドルをクリア
            this.currentFileHandle = null;

            // テーブルパネルを表示
            if (window.tablePanel) {
                tablePanel.show();
            }

            // 統計を表示
            const stats = networkManager.getStats();
            console.log(`Imported: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
        } finally {
            this.setLoadingState('network', false);
        }
    }

    /**
     * Table Dataをインポート
     */
    async importTableData() {
        const table = document.getElementById('table-column-settings');
        const rows = table.querySelectorAll('tbody tr');
        const { headers, data } = this.tableFileData;

        let nodeCol = null;
        const attributes = [];

        rows.forEach(row => {
            const index = parseInt(row.dataset.index);
            const role = row.querySelector('.role-select').value;
            const dataType = row.querySelector('.datatype-select').value;
            const delimiter = row.querySelector('.delimiter-input').value || '|';

            if (role === 'node') {
                nodeCol = { index, name: headers[index] };
            } else if (role === 'attribute') {
                attributes.push({
                    index,
                    name: headers[index],
                    dataType,
                    delimiter
                });
            }
        });

        if (!nodeCol) {
            alert('Please select a Node column.');
            return;
        }

        // ローディング状態を開始
        this.setLoadingState('table', true);

        // 非同期処理でUIを更新させる
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // NetworkManagerにデータをインポート
            networkManager.importTableData({
                data,
                columnSettings: {
                    node: nodeCol,
                    attributes
                }
            });

            this.closeModal('table-modal');

            // 統計を表示
            const stats = networkManager.getStats();
            console.log(`Updated: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
        } finally {
            this.setLoadingState('table', false);
        }
    }

    /**
     * モーダルを開く
     * @param {string} modalId 
     */
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    /**
     * モーダルを閉じる
     * @param {string} modalId 
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    /**
     * 確認モーダルを表示
     * @param {string} message - 表示するメッセージ
     * @param {Function} onConfirm - OKクリック時のコールバック
     */
    showConfirmModal(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('confirm-modal-message');
        const okBtn = document.getElementById('confirm-modal-ok');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        messageEl.innerHTML = message;
        modal.classList.add('active');

        // 既存のイベントリスナーを削除（重複防止）
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // OKボタン
        newOkBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            if (onConfirm) {
                onConfirm();
            }
        });

        // キャンセルボタン
        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    /**
     * HTMLエスケープ
     * @param {string} str 
     * @returns {string}
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * ネットワークを上書き保存
     */
    async saveNetwork() {
        if (!this.currentFileHandle) {
            // ファイルハンドルがない場合は何もしない（メニューが無効化されているはず）
            return;
        }

        const data = networkManager.exportToJSON();
        if (!data) {
            alert('保存するネットワークがありません。');
            return;
        }

        try {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const writable = await this.currentFileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (err) {
            console.error('Save error:', err);
            alert('保存に失敗しました。\n' + err.message);
        }
    }

    /**
     * ネットワークを名前を付けて保存
     */
    async saveNetworkAs() {
        const data = networkManager.exportToJSON();
        if (!data) {
            alert('保存するネットワークがありません。');
            return;
        }

        // デバッグ: 保存データの確認
        console.log('=== Save As Debug ===');
        console.log('data.styleSettings:', data.styleSettings);
        console.log('data.edgeBendsSettings:', data.edgeBendsSettings);

        const json = JSON.stringify(data, null, 2);
        console.log('JSON length:', json.length);
        const blob = new Blob([json], { type: 'application/json' });

        // File System Access API をサポートしているかチェック
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'network.cx2',
                    types: [{
                        description: 'Cytoscape Network File',
                        accept: { 'application/json': ['.cx2'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                // ファイルハンドルを保存（上書き保存用）
                this.currentFileHandle = handle;
                // Saveメニューを有効化
                document.getElementById('menu-save').classList.remove('disabled');
                return;
            } catch (err) {
                // ユーザーがキャンセルした場合
                if (err.name === 'AbortError') {
                    return;
                }
                console.error('Save error:', err);
            }
        }

        // フォールバック: 従来のダウンロード方式（上書き保存は不可）
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'network.cx2';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * ファイルピッカーを使ってネットワークファイルを開く
     */
    async openNetworkWithPicker() {
        // File System Access API をサポートしているかチェック
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Cytoscape Network File',
                        accept: { 'application/json': ['.cx2'] }
                    }]
                });
                const file = await handle.getFile();
                await this.openNetwork(file, handle);
                return;
            } catch (err) {
                // ユーザーがキャンセルした場合
                if (err.name === 'AbortError') {
                    return;
                }
                console.error('Open error:', err);
            }
        }

        // フォールバック: 従来のファイル入力
        document.getElementById('open-file-input').click();
    }

    /**
     * ネットワークファイルを開く
     * @param {File} file - 開くファイル
     * @param {FileSystemFileHandle|null} handle - ファイルハンドル
     */
    async openNetwork(file, handle = null) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const success = networkManager.importFromJSON(data);
            if (success) {
                // Table Fileメニューを有効化
                document.getElementById('menu-table-file').classList.remove('disabled');
                // Save Asメニューを有効化
                document.getElementById('menu-save-as').classList.remove('disabled');
                // Closeメニューを有効化
                document.getElementById('menu-close').classList.remove('disabled');

                // ファイルハンドルがある場合はSaveも有効化
                if (handle) {
                    this.currentFileHandle = handle;
                    document.getElementById('menu-save').classList.remove('disabled');
                }

                // テーブルパネルを表示
                if (window.tablePanel) {
                    tablePanel.show();
                }

                const stats = networkManager.getStats();
                console.log(`Opened: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
            } else {
                alert('ファイルの読み込みに失敗しました。');
            }
        } catch (error) {
            console.error('Open error:', error);
            alert('ファイルの読み込みに失敗しました。\n' + error.message);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});
