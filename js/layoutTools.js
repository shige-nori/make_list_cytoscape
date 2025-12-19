/**
 * LayoutTools - レイアウト調整ツール
 */
class LayoutTools {
    constructor() {
        this.panel = null;
        this.scaleSlider = null;
        this.rotateSlider = null;
        this.originalPositions = new Map();
        this.originalCenter = { x: 0, y: 0 };
        this.currentScale = 1;
        this.currentScaleAxis = 'width'; // 'width', 'height', 'selected'
        this.currentRotation = 0;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    /**
     * 初期化
     */
    initialize() {
        this.panel = document.getElementById('layout-tools-panel');
        this.scaleSlider = document.getElementById('scale-slider');
        this.rotateSlider = document.getElementById('rotate-slider');

        this.setupEventListeners();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // パネルを開く
        document.getElementById('menu-layout-tools').addEventListener('click', () => {
            this.openPanel();
        });

        // パネルを閉じる
        document.getElementById('layout-tools-close').addEventListener('click', () => {
            this.closePanel();
        });

        // スケールスライダー（連続値）
        this.scaleSlider.addEventListener('input', (e) => {
            this.handleScaleChange(parseFloat(e.target.value));
        });

        // 回転スライダー（連続値）
        this.rotateSlider.addEventListener('input', (e) => {
            this.handleRotateChange(parseFloat(e.target.value));
        });

        // スケール軸の選択（ラジオボタン）
        document.querySelectorAll('input[name="scale-axis"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleScaleAxisChange(e.target.value);
            });
        });

        // パネルのドラッグ機能
        this.setupDraggable();
    }

    /**
     * パネルをドラッグ可能にする
     */
    setupDraggable() {
        const header = this.panel.querySelector('.tools-panel-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('tools-panel-close')) return;
            
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            this.panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;

            // 画面内に収める
            const maxX = window.innerWidth - this.panel.offsetWidth;
            const maxY = window.innerHeight - this.panel.offsetHeight;

            this.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.panel.style.top = Math.max(40, Math.min(y, maxY)) + 'px';
            this.panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.panel.style.transition = '';
        });
    }

    /**
     * パネルを開く
     */
    openPanel() {
        this.panel.classList.add('active');
        this.storeOriginalPositions();
        this.resetSliders();
    }

    /**
     * パネルを閉じる
     */
    closePanel() {
        this.panel.classList.remove('active');
    }

    /**
     * スライダーをリセット
     */
    resetSliders() {
        this.scaleSlider.value = 0;  // 対数値0 = スケール1
        this.rotateSlider.value = 0;
        this.currentScale = 1;
        this.currentRotation = 0;
        document.getElementById('scale-value').textContent = '1.00';
        document.getElementById('rotate-value').textContent = '0';
        // Widthをデフォルト選択
        document.getElementById('scale-width').checked = true;
        this.currentScaleAxis = 'width';
    }

    /**
     * 元の位置を保存
     */
    storeOriginalPositions() {
        this.originalPositions.clear();
        if (!networkManager.cy) return;

        const nodes = networkManager.cy.nodes();
        nodes.forEach(node => {
            const pos = node.position();
            this.originalPositions.set(node.id(), { x: pos.x, y: pos.y });
        });

        // 元の中心点を計算して保存
        if (nodes.length > 0) {
            const bb = nodes.boundingBox();
            this.originalCenter = {
                x: (bb.x1 + bb.x2) / 2,
                y: (bb.y1 + bb.y2) / 2
            };
        }
    }

    /**
     * スケール軸変更ハンドラ
     * @param {string} axis - 'width', 'height', 'selected'
     */
    handleScaleAxisChange(axis) {
        this.currentScaleAxis = axis;
        // スライダーを1（対数値0）にリセット
        this.scaleSlider.value = 0;
        this.currentScale = 1;
        document.getElementById('scale-value').textContent = '1.00';
        // 元の位置を保存し直す（現在の状態から新しく開始）
        this.storeOriginalPositions();
        this.currentRotation = 0;
        this.rotateSlider.value = 0;
        document.getElementById('rotate-value').textContent = '0';
    }

    /**
     * スケール変更ハンドラ（対数スケール）
     * @param {number} logValue - スライダー値（-3〜3、対数値）
     */
    handleScaleChange(logValue) {
        // 対数値から実際のスケール値に変換（2^x）
        const scale = Math.pow(2, logValue);
        
        // 表示値を更新
        let displayValue = scale.toFixed(2);
        document.getElementById('scale-value').textContent = displayValue;

        // 現在のスケール値を更新
        this.currentScale = scale;

        // 両方の変換を適用
        this.applyTransform();
    }

    /**
     * 回転変更ハンドラ（連続値）
     * @param {number} angle - 角度（-180〜180）
     */
    handleRotateChange(angle) {
        document.getElementById('rotate-value').textContent = Math.round(angle).toString();

        // 現在の回転値を更新
        this.currentRotation = angle;

        // 両方の変換を適用
        this.applyTransform();
    }

    /**
     * スケールと回転を同時に適用
     */
    applyTransform() {
        if (!networkManager.cy) return;

        const isSelectedOnly = this.currentScaleAxis === 'selected';
        const nodes = isSelectedOnly 
            ? networkManager.cy.nodes(':selected') 
            : networkManager.cy.nodes();

        if (nodes.length === 0) return;

        const centerX = this.originalCenter.x;
        const centerY = this.originalCenter.y;
        const angleRadians = (this.currentRotation * Math.PI) / 180;

        // スケール軸に応じてスケール値を設定
        let scaleX = 1;
        let scaleY = 1;
        
        switch (this.currentScaleAxis) {
            case 'width':
                scaleX = this.currentScale;
                break;
            case 'height':
                scaleY = this.currentScale;
                break;
            case 'selected':
                scaleX = this.currentScale;
                scaleY = this.currentScale;
                break;
        }

        nodes.forEach(node => {
            const originalPos = this.originalPositions.get(node.id());
            if (!originalPos) return;

            // 1. 中心からの相対位置を計算
            let dx = originalPos.x - centerX;
            let dy = originalPos.y - centerY;

            // 2. スケールを適用
            dx = dx * scaleX;
            dy = dy * scaleY;

            // 3. 回転を適用
            const rotatedX = dx * Math.cos(angleRadians) - dy * Math.sin(angleRadians);
            const rotatedY = dx * Math.sin(angleRadians) + dy * Math.cos(angleRadians);

            // 4. 中心に戻す
            const newX = centerX + rotatedX;
            const newY = centerY + rotatedY;

            node.position({ x: newX, y: newY });
        });
    }

    /**
     * 現在の位置を新しい基準位置として保存
     */
    applyCurrentTransform() {
        this.storeOriginalPositions();
        this.resetSliders();
    }
}

// グローバルインスタンス
const layoutTools = new LayoutTools();
