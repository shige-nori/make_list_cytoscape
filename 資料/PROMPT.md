# ネットワーク可視化ツール作成プロンプト

## 概要
HTML、CSS、JavaScript、Cytoscape.jsを使用して、ネットワーク可視化ツールを作成してください。

## 技術スタック
- **Cytoscape.js v3.28.1** - ネットワークグラフ可視化ライブラリ
- **cytoscape-dagre** - 階層レイアウト拡張
- **SheetJS (xlsx v0.18.5)** - Excel/CSVファイル読み込み
- **Vanilla JavaScript (ES6+)** - モジュラーなクラス構造

## ファイル構成
```
project/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # メインアプリケーションコントローラー
│   ├── fileHandler.js  # ファイル読み込み処理
│   ├── networkManager.js # Cytoscape管理
│   └── layoutTools.js  # レイアウトツール
└── data/
    ├── sample_network.csv
    └── sample_nodes.csv
```

## 画面構成

### 1. メニューバー
上部に固定されたメニューバーを配置：
- **File**
  - Import
    - Network File... （エッジデータのインポート）
    - Table File... （ノードデータのインポート）
- **Style** （将来拡張用）
- **Filter** （将来拡張用）
- **Layout**
  - Layout Tools （レイアウトツールパネルを開く）

サブメニューは親メニューの右側に表示。

### 2. ネットワーク表示エリア
メニューバー以外の画面全体をCytoscape.jsのネットワーク表示エリアとして使用。

### 3. ファイルインポートモーダル

#### Network Fileモーダル:
- ファイル選択（CSV、Excel対応）
- ファイル情報表示（ファイル名、行数、列数）
- Column Settings（テーブル形式）:
  - 列名 | Role（ドロップダウン）
  - Role選択肢: Source, Target, Edge Attribute, -- (ignore)
  - Source/Target選択時はData Type/Delimiter列を非表示
  - Edge Attribute選択時のみData Type（String/Integer/List）とDelimiter（リスト区切り文字）を表示
  - Integer型は数値のみの列で自動検出
- Importボタン（読み込み中はローディング表示）

#### Table Fileモーダル:
- 同様の構成
- Role選択肢: Node ID, Node Attribute, -- (ignore)
- Node ID選択時はData Type/Delimiter列を非表示

### 4. Layout Toolsパネル
ドラッグ可能なフローティングパネル：

#### Scaleセクション:
- ラジオボタン: Width / Height / Selected Only
- スライダー: 1/8 ～ 8（対数スケール、中央が1）
  - スライダー値: -3 ～ 3（内部は2^x変換）
  - 目盛り: 1/8, 1/4, 1/2, 1, 2, 4, 8
  - 各目盛りに縦線を表示、その下にラベル
- 現在値表示: "Scale: 1.00x"

#### Rotateセクション:
- スライダー: -180° ～ 180°（連続値）
  - 目盛り: -180°, -90°, 0°, 90°, 180°
  - 各目盛りに縦線を表示、その下にラベル
- 現在値表示: "Angle: 0°"

#### スライダー目盛りの仕様:
- スライダーのthumb（つまみ）の中心位置と目盛り縦線が一致
- 両端の目盛りラベルはスライダーバーからはみ出してOK
- 目盛りコンテナはthumbの半径分（9px）を両端からマージン

#### 動作仕様:
- 軸（Width/Height/Selected Only）を変更したらスライダーをリセット
- ScaleとRotateは同時に適用（どちらかを変えても両方維持）
- 元の位置を保存し、その位置からの相対変換として適用

## レイアウト

**初期レイアウト:** Dagre（階層レイアウト）
- rankDir: 'TB'（上から下）
- nodeSep: 50
- rankSep: 80

## スタイル

### ノード:
- 背景色: #4a90d9
- ラベル: data(id)
- 幅/高さ: 40px
- 選択時: 赤いボーダー

### エッジ:
- 線色: #999
- 線幅: 2px
- 矢印: triangle（ターゲット側）
- カーブスタイル: bezier

## データ形式

### sample_network.csv (エッジデータ):
```csv
source,target,interaction,weight
node1,node2,activates,1
node2,node3,inhibits,2
...
```

### sample_nodes.csv (ノードデータ):
```csv
id,label,type,size
node1,Node 1,protein,30
node2,Node 2,gene,25
...
```

## 実装詳細

### 対数スケールスライダー:
```javascript
// HTML: min="-3" max="3" step="0.01" value="0"
// JavaScript変換:
const scale = Math.pow(2, sliderValue);
// sliderValue=0 → scale=1 (中央)
// sliderValue=-3 → scale=0.125 (1/8)
// sliderValue=3 → scale=8
```

### スケール/回転の同時適用:
```javascript
applyTransform() {
    nodes.forEach(node => {
        const orig = originalPositions.get(node.id());
        // 回転を適用
        let newX = orig.x * cos(rotation) - orig.y * sin(rotation);
        let newY = orig.x * sin(rotation) + orig.y * cos(rotation);
        // スケールを適用（軸に応じて）
        if (axis === 'width') newX = center.x + (newX - center.x) * scale;
        if (axis === 'height') newY = center.y + (newY - center.y) * scale;
        node.position({ x: newX, y: newY });
    });
}
```

### 目盛りCSS:
```css
.slider-ticks {
    display: flex;
    justify-content: space-between;
    margin-left: 9px;  /* thumbの半径 */
    margin-right: 9px;
}
.slider-ticks .tick {
    width: 0;  /* 中心基準で配置 */
    display: flex;
    flex-direction: column;
    align-items: center;
}
.tick-line {
    width: 1px;
    height: 8px;
    background-color: var(--border-color);
}
```
