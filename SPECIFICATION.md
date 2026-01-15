# Network Visualizer - Cytoscape.js 仕様書

## 概要

**アプリケーション名**: Network Visualizer  
**バージョン**: 1.2  
**技術スタック**: HTML5, CSS3, JavaScript (ES6+), Cytoscape.js  
**対象ブラウザ**: モダンブラウザ（Chrome, Firefox, Edge, Safari）

このアプリケーションは、CSV/Excelファイルからネットワークデータを読み込み、インタラクティブなグラフとして可視化するWebアプリケーションです。デスクトップ版Cytoscapeに類似したUIを持ち、スタイルのカスタマイズ、レイアウト調整、データテーブル表示などの機能を提供します。

---

## 1. プロジェクト構成

```
project/
├── index.html              # メインHTML
├── css/
│   └── style.css          # スタイルシート
├── js/
│   ├── app.js             # メインアプリケーション
│   ├── fileHandler.js     # ファイル読み込み・解析
│   ├── networkManager.js  # Cytoscape.js管理
│   ├── layoutTools.js     # レイアウトツール
│   ├── stylePanel.js      # スタイル設定パネル
│   └── tablePanel.js      # データテーブルパネル
└── sample_data/           # サンプルデータ
    ├── network.csv
    └── nodes.csv
```

---

## 2. 外部ライブラリ

| ライブラリ | バージョン | 用途 |
|-----------|----------|------|
| Cytoscape.js | 3.28.1 | グラフ可視化エンジン |
| Dagre | 0.8.5 | 階層型レイアウト計算 |
| cytoscape-dagre | 2.5.0 | Cytoscape用Dagre拡張 |
| SheetJS (xlsx) | 0.18.5 | Excel/CSVファイル読み込み |

CDN読み込み:
```html
<script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
<script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
<script src="https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

---

## 3. メニュー構成

### 3.1 File メニュー
- **Import**（サブメニュー）
  - **Network File**: ネットワークファイル（CSV/Excel）をインポート
  - **Table File**: テーブルファイル（CSV/Excel）をインポートし、既存ノードに属性を追加

### 3.2 Style メニュー
- クリックでスタイル設定パネルを開く

### 3.3 View メニュー
- **Table Panel**: データテーブルパネルの表示/非表示を切り替え

### 3.4 Filter メニュー
- Coming soon（将来実装予定）

### 3.5 Layout メニュー
- **Layout Tools**: スケール・回転調整パネルを開く
- **Edge Bends**: エッジの曲げ強度調整パネルを開く
- **Hierarchical**（サブメニュー）
  - **Defaults**: Dagreレイアウトを適用
  - **Equal**: 縦横比1:1で均等配置

---

## 4. モジュール仕様

### 4.1 FileHandler (fileHandler.js)

**役割**: ファイルの読み込みと解析を担当

#### メソッド

| メソッド | 説明 |
|---------|------|
| `readFile(file)` | CSV/Excelファイルを読み込み、{headers, data}を返す |
| `readCSV(file)` | CSVファイルを解析 |
| `readExcel(file)` | Excelファイルを解析（SheetJS使用） |
| `parseCSV(text)` | CSVテキストを解析（ダブルクォート対応） |
| `parseCSVLine(line)` | CSV1行を解析 |
| `convertValue(value, dataType, delimiter)` | 値をデータ型に従って変換 |

#### データ型変換

| データ型 | 変換ルール |
|---------|-----------|
| String | 文字列として保持 |
| Number | parseFloatで数値変換、NaNならnull |
| Boolean | true/false/1/0/yes/noを認識 |
| Date | ISO 8601形式に変換 |
| Array | 区切り文字で分割して配列化 |

---

### 4.2 NetworkManager (networkManager.js)

**役割**: Cytoscape.jsインスタンスの管理とネットワーク操作

#### 主要メソッド

| メソッド | 説明 |
|---------|------|
| `initialize()` | Cytoscapeインスタンスを初期化 |
| `importNetworkData({data, columnSettings})` | ネットワークデータをインポート |
| `importTableData({data, columnSettings})` | テーブルデータをインポート（既存ノードに属性追加） |
| `applyLayout(layoutName)` | レイアウトを適用 |
| `exportToJSON()` | ネットワークをJSON形式でエクスポート |
| `importFromJSON(data)` | JSONからネットワークをインポート |
| `fitWithZoomLimit()` | ズーム制限付きでビューをフィット |
| `getStats()` | ノード数・エッジ数を取得 |
| `clear()` | ネットワークをクリア |

#### ホバーハイライト機能

- ノードにマウスオーバーすると、上流・下流パスをピンク色（#ff1493）でハイライト
- ハイライト箇所以外のノード・エッジは透明度50%に設定され、ハイライト部分が明確に視認可能
- 大規模ネットワーク（2000要素以上）ではパフォーマンス考慮のため自動的に無効化

#### デフォルトスタイル

```javascript
// ノードスタイル
{
    'background-color': '#2563eb',
    'label': 'data(label)',
    'width': 40,
    'height': 40,
    'border-width': 3,
    'border-color': '#1d4ed8'
}

// エッジスタイル
{
    'width': 2,
    'line-color': '#94a3b8',
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier'
}
```

---

### 4.3 App (app.js)

**役割**: メインアプリケーションの制御

#### 主要機能

1. **アプリケーション初期化**
   - 各モジュールの初期化
   - イベントリスナーの設定

2. **ファイルインポート処理**
   - Network File: ネットワーク構造を作成
   - Table File: 既存ノードに属性を追加

3. **カラムマッピングモーダル**
   - Role: Source / Target / Attribute / None
   - Data Type: String / Number / Boolean / Date / Array
   - Delimiter: Array型の区切り文字（デフォルト: `|`）

4. **モーダル制御**
   - openModal() / closeModal()
   - プログレスオーバーレイ表示

---

### 4.4 StylePanel (stylePanel.js)

**役割**: ノード/エッジのスタイル設定パネル

#### タブ構成

1. **Node タブ**
   - Label Font Size
   - Label Color
   - Fill Color
   - Shape (ellipse, rectangle, triangle, etc.)
   - Size
   - Border Width
   - Border Color
   - Opacity

2. **Edge タブ**
   - Line Type (solid, dashed, dotted)
   - Arrow Shape
   - Width
   - Line Color
   - Opacity
   - Curve Style (bezier, straight, etc.)

#### マッピング機能

各スタイルプロパティに対して、データカラムに基づくマッピングが可能:

- **Individual**: 個別値ごとにスタイルを指定
- **Continuous**: 数値範囲に基づくスタイル（サイズ等）
- **Gradient**: 数値範囲に基づく色のグラデーション

#### 静的メソッド

| メソッド | 説明 |
|---------|------|
| `StylePanel.show(tab)` | パネルを表示 |
| `StylePanel.applyAllStyles()` | 保存されたスタイルを全要素に適用 |

---

### 4.5 TablePanel (tablePanel.js)

**役割**: ノード/エッジデータをテーブル形式で表示・操作

#### 機能

1. **タブ切り替え**
   - Node Table: ノードデータを表示
   - Edge Table: エッジデータを表示

2. **グローバル検索**
   - 全カラムを対象にした全文検索

3. **カラムフィルタ**
   - 各カラムのヘッダーにフィルタ入力欄

4. **ソート**
   - カラムヘッダークリックで昇順/降順切り替え

5. **選択連動**
   - テーブル行クリック → グラフ上で選択
   - グラフ上で選択 → テーブル行がハイライト

6. **カラム表示設定**
   - 表示するカラムを選択可能

7. **リサイズ**
   - パネル高さをドラッグで調整
   - カラム幅をドラッグで調整

8. **ポップアウト**
   - 別ウィンドウで表示

---

### 4.6 LayoutTools (layoutTools.js)

**役割**: レイアウト調整ツール

#### Layout Tools パネル

1. **Scale（スケール）**
   - Width: 横方向のみスケール
   - Height: 縦方向のみスケール
   - Selected Only: 選択ノードのみスケール
   - 対数スケール: 1/8 ～ 8倍

2. **Rotate（回転）**
   - -180° ～ 180°

#### Edge Bends パネル

- エッジの曲げ強度（control-point-step-size）を調整
- 同じノード間の複数エッジが重ならないように

#### Equalize レイアウト

- 縦横比1:1で各階層のノードを均等配置

---

## 5. データフォーマット

### 5.1 Network File（CSV/Excel）

```csv
source,target,weight,type
A,B,10,normal
B,C,20,strong
C,A,5,weak
```

- **Source**: エッジの始点ノードID
- **Target**: エッジの終点ノードID
- その他: エッジ属性

### 5.2 Table File（CSV/Excel）

```csv
id,label,category,value
A,Node A,Type1,100
B,Node B,Type2,200
C,Node C,Type1,150
```

- **Source**: 既存ノードIDとマッチするキー
- その他: ノード属性として追加

### 5.3 エクスポート形式（JSON）

Cytoscape Desktop互換形式 + アプリ拡張データ:

```json
{
    "format_version": "1.0",
    "generated_by": "cytoscape-js-app",
    "target_cytoscapejs_version": "~3.28",
    "data": {
        "name": "Network"
    },
    "elements": {
        "nodes": [
            {
                "data": { "id": "A", "label": "A" },
                "position": { "x": 100, "y": 100 }
            }
        ],
        "edges": [
            {
                "data": { "id": "e0", "source": "A", "target": "B" }
            }
        ]
    },
    "appExtensions": {
        "version": "1.2",
        "exportDate": "2026-01-14T...",
        "styleSettings": { ... },
        "edgeBendsSettings": { "bendStrength": 40 }
    }
}
```

---

## 6. UI コンポーネント

### 6.1 メニューバー

- 固定位置（top: 0）
- 高さ: 40px
- 背景色: #1e293b（ダークネイビー）
- ドロップダウンメニュー対応
- ネストしたサブメニュー対応

### 6.2 モーダルウィンドウ

- 背景オーバーレイ（半透明黒）
- 中央配置
- アニメーション付き表示
- 背景クリックで閉じる

### 6.3 ツールパネル

- ドラッグ移動可能
- 閉じるボタン付き
- スライダーコントロール

### 6.4 プログレスオーバーレイ

- スピナーアニメーション
- テキストメッセージ表示
- 処理中の画面操作をブロック

---

## 7. スタイル変数（CSS）

```css
:root {
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --secondary-color: #64748b;
    --background-color: #f8fafc;
    --menubar-bg: #1e293b;
    --menubar-text: #f1f5f9;
    --menu-hover: #334155;
    --border-color: #e2e8f0;
    --text-color: #1e293b;
    --text-light: #64748b;
    --success-color: #22c55e;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
}
```

---

## 8. インタラクション仕様

### 8.1 グラフ操作

| 操作 | 動作 |
|-----|------|
| ドラッグ | ノードを移動 |
| クリック | ノード/エッジを選択 |
| Ctrl+クリック | 複数選択 |
| ホイール | ズームイン/アウト |
| 背景ドラッグ | パン（移動） |
| ノードホバー | 上流/下流パスをハイライト |

### 8.2 選択スタイル

- ノード選択時: オレンジ背景、オレンジボーダー
- エッジ選択時: オレンジライン

### 8.3 ハイライトスタイル

- ホバー時: ピンク色（#ff1493）
- テーブル選択時: オレンジオーバーレイ

---

## 9. レイアウトアルゴリズム

| レイアウト | 説明 |
|-----------|------|
| dagre | 階層型（TB: 上から下） |
| circle | 円形配置 |
| grid | グリッド配置 |
| concentric | 同心円配置 |
| breadthfirst | 幅優先配置 |
| cose | 力学モデル配置 |
| random | ランダム配置 |

---

## 10. パフォーマンス考慮

1. **大規模ネットワーク対策**
   - 2000要素以上でホバーハイライト無効化
   - バッチ処理（cy.batch()）による描画最適化

2. **ズーム制限**
   - minZoom: 0.01
   - maxZoom: 10
   - fit時: 0.05 ～ 1.5に制限

3. **Web Worker対応**
   - layout-worker.js（将来的な重いレイアウト計算用）

---

## 11. ファイルインポートワークフロー

### Network File
1. メニュー → File → Import → Network File
2. ファイル選択ダイアログ
3. カラムマッピングモーダル表示
4. Source/Target/Attributeを設定
5. Importボタンでネットワーク作成
6. Dagreレイアウト自動適用

### Table File
1. 先にNetwork Fileをインポート
2. メニュー → File → Import → Table File
3. ファイル選択ダイアログ
4. カラムマッピングモーダル表示
5. Sourceカラム（ノードIDとマッチ）を設定
6. Importボタンで属性追加

---

## 12. 対応ファイル形式

| 拡張子 | 形式 |
|-------|------|
| .csv | カンマ区切りテキスト（UTF-8） |
| .xlsx | Excel 2007以降 |
| .xls | Excel 97-2003 |

---

## 13. 制限事項

- サーバーサイド処理なし（純粋なクライアントサイドアプリ）
- ファイル保存はダウンロード形式のみ
- 同時に1つのネットワークのみ表示
- ノード/エッジの削除機能は未実装
- フィルタ機能は未実装

---

## 14. 拡張ポイント

1. **Filter機能の追加**
   - 属性値によるノード/エッジのフィルタリング

2. **Export機能の追加**
   - PNG/SVG画像エクスポート
   - CSV/Excelエクスポート

3. **Open/Save機能**
   - JSON形式でのファイル保存・読み込み

4. **アンドゥ/リドゥ**
   - 操作履歴の管理

5. **検索機能**
   - ノード/エッジの検索とハイライト
