/**
 * Layout Worker - Dagreレイアウト計算をバックグラウンドで実行
 */

// Cytoscape.jsとDagre拡張をインポート
importScripts('https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js');
importScripts('https://unpkg.com/dagre@0.8.5/dist/dagre.min.js');
importScripts('https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js');

// Dagre拡張を登録
if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
    cytoscape.use(cytoscapeDagre);
}

/**
 * メインスレッドからのメッセージを処理
 */
self.addEventListener('message', function(e) {
    const { type, data } = e.data;

    if (type === 'layout') {
        try {
            const { elements, layoutName, layoutOptions } = data;
            
            // Worker内でCytoscapeインスタンスを作成
            const cy = cytoscape({
                headless: true,  // ヘッドレスモード（描画なし）
                elements: elements,
                styleEnabled: false  // スタイル計算を無効化
            });

            // レイアウトを実行
            const layout = cy.layout(layoutOptions);
            
            // レイアウト完了を待つ
            const promise = layout.promiseOn('layoutstop');
            layout.run();

            promise.then(() => {
                // 計算された位置情報を取得
                const positions = {};
                cy.nodes().forEach(node => {
                    positions[node.id()] = {
                        x: node.position('x'),
                        y: node.position('y')
                    };
                });

                // メインスレッドに結果を返す
                self.postMessage({
                    type: 'layout-complete',
                    positions: positions
                });
            });

        } catch (error) {
            self.postMessage({
                type: 'layout-error',
                error: error.message
            });
        }
    }
});

// Workerの準備完了を通知
self.postMessage({ type: 'worker-ready' });
