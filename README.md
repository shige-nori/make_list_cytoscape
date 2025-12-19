# Network Visualizer - Cytoscape.js

Cytoscape.jsを使用したネットワーク図可視化ツールです。

## 機能

### ファイルインポート
- **Network File (エッジファイル)**: CSV / Excelファイルからネットワークの接続情報を読み込みます
- **Table File (ノードファイル)**: CSV / Excelファイルからノードの属性情報を読み込みます

### 対応フォーマット
- CSV (.csv)
- Excel (.xlsx, .xls)

## 使い方

1. ブラウザで `index.html` を開きます
2. メニューバーの **File → Import → Network File** からエッジファイルを選択
3. カラム設定画面で Source, Target, Attribute を設定
4. **Import** ボタンでネットワークを読み込み
5. 必要に応じて **File → Import → Table File** からノード属性ファイルを追加

## サンプルデータ

`sample_data` フォルダにサンプルファイルがあります：
- `network.csv` - エッジデータ（Source, Target, weight, type）
- `nodes.csv` - ノードデータ（node, label, category, score）

## データ型

カラムに設定できるデータ型：
| 型 | 説明 |
|---|---|
| String | 文字列 |
| Integer | 整数 |
| Float | 浮動小数点数 |
| Y/N (Boolean) | Yes/No (Y, N, Yes, No, true, false, 1, 0) |
| String Array | 文字列配列（区切り文字で分割） |
| Integer Array | 整数配列 |
| Float Array | 浮動小数点配列 |
| Boolean Array | Boolean配列 |

## 技術スタック

- **Cytoscape.js** - ネットワーク可視化ライブラリ
- **cytoscape-dagre** - 階層レイアウト（Hierarchical Layout）
- **SheetJS (xlsx)** - Excelファイル読み込み
- **HTML5 / CSS3 / JavaScript (ES6+)**

## ライセンス

MIT License
