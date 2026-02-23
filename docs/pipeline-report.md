# データパイプライン検証レポート

## 1. 概要

YouTube チャンネルの動画から、**撮影者が実際に訪れたロケ地を自動抽出し、地球儀上にピンとして表示する**ためのパイプライン。

### 処理フロー

```
動画ID入力
  ↓
Step 1: fetch-videos.ts    … YouTube API でメタデータ取得 + Noteey で字幕スクレイピング
  ↓ src/pipeline/tmp/new_videos.json
Step 2: extract-locations.ts … Gemini API で字幕から地名+座標を抽出
  ↓ src/pipeline/tmp/extracted_locations.json
Step 3: geocode.ts          … LLM座標をプライマリに、Nominatim → Google Places をフォールバック
  ↓ src/pipeline/tmp/geocoded_locations.json
Step 4: validate-and-merge.ts … バリデーション + 既存データにマージ
  ↓
src/data/locations.json     … フロントエンドが読み込む最終データ
```

---

## 2. 改善履歴

### 2-1. 初回実装時の課題 (gemini-2.5-flash-lite)

初回実装では以下の3つの課題があった。

| 課題 | 内容 |
| --- | --- |
| LLM 抽出精度 | 海外歴史ロケで国名が大量混入(ユーゴ動画: 11件中7件が国名) |
| ジオコーディング精度 | マイナー地名の未登録、同名誤ヒット、日本語クエリの限界 |
| confidenceScore | Nominatim の importance 値ベースで、座標精度の指標として機能せず |

### 2-2. 実施した改善

#### A. LLMに座標も出力させる(案A)

**extract-locations.ts** を改修し、Gemini に地名だけでなく緯度経度も出力させるようにした。

- 出力フォーマット: `[{"n":"地名","r":"所在地域","lat":緯度,"lng":経度}]`
- プロンプトに国名除外の制約を強化:
  - 「国名は絶対に含めない。都市名以下の粒度のみ抽出せよ」
  - 「〜国」「〜共和国」「〜王国」「〜連邦」の除外ルール
- lat/lng のバリデーション追加(範囲外は null → ジオコーディングにフォールバック)

#### B. ジオコーディングの LLM 座標プライマリ化

**geocode.ts** を改修し、座標取得の優先順位を変更した。

```
Before: 地名 → Nominatim → Google Places
After:  LLM座標あり → そのまま採用
        LLM座標なし → Nominatim(日本語→英語リトライ) → Google Places
```

- Nominatim で日本語クエリが失敗した場合、`accept-language: en` で英語リトライを追加

#### C. confidenceScore / needsReview の廃止(案E)

機能していなかった confidenceScore と needsReview をスキーマから完全削除した。

- `src/types/location.ts`: Location 型から削除
- `src/pipeline/config.ts`: CONFIDENCE_THRESHOLD 削除
- `src/pipeline/geocode.ts`: importance ベースの計算ロジック削除
- `src/pipeline/validate-and-merge.ts`: バリデーション・自動設定ロジック削除

#### D. モデル変更

`gemini-2.5-flash-lite` → `gemini-3-flash-preview` に変更。座標精度・地名精度ともに劇的に改善。

#### E. マージロジック修正

**validate-and-merge.ts** で、同じ videoId の再処理時に locations が更新されないバグを修正。新規データで既存データを上書きするように変更。

---

## 3. 検証結果

3本の動画で改善前後を比較検証した。

### 動画1: 松尾鉱山(岩手県) `3vHiPVPiEc8`

| 地名 | region | 座標 | 判定 |
| --- | --- | --- | --- |
| 松尾鉱山跡 | 岩手県八幡平市 | (39.94, 140.94) | ✅ |
| 松尾鉱山緑ヶ丘アパート | 岩手県八幡平市 | (39.94, 140.95) | ✅ |
| 玉川温泉 | 秋田県仙北市 | (39.96, 140.72) | ✅ |
| 旧松尾鉱山新中和処理施設 | 岩手県八幡平市 | (39.93, 140.95) | ✅ |

- 4件全て妥当な座標。region も市レベルまで特定できている。

### 動画2: グアム戦争跡 `d-P_T30Shus`

| 地名 | region | 座標 | 判定 |
| --- | --- | --- | --- |
| アサンビーチ | グアム | (13.47, 144.71) | ✅ |
| アサン・ビーチ展望台 | グアム | (13.47, 144.72) | ✅ |
| アガットビーチ | グアム | (13.39, 144.65) | ✅ |
| アリファン山 | グアム | (13.39, 144.66) | ✅ |
| マンガン山 日本軍司令部跡 | グアム | (13.45, 144.72) | ✅ |
| マタグアックの丘 | グアム | (13.55, 144.86) | ✅ |
| 横井ケーブ(タロフォフォの滝公園内) | グアム | (13.32, 144.75) | ✅ |
| グアム鎮魂社 | グアム | (13.52, 144.82) | ✅ |

- 8件全て異なる座標で、グアム島内の適切な位置にプロット。
- flash-lite 時代は全7件が同一座標 `(13.44, 144.79)` + ノイズ「グアムち婚車」があった。

### 動画3: ユーゴスラビア内戦 `clFtrDq0FoA`

| 地名 | region | 座標 | 判定 |
| --- | --- | --- | --- |
| ベオグラード | セルビア | (44.79, 20.45) | ✅ |
| ラテン橋 | ボスニア・ヘルツェゴビナ サラエボ | (43.86, 18.43) | ✅ |
| ユーゴスラビア博物館 | セルビア ベオグラード | (44.79, 20.45) | ✅ |
| スレブレニツァ・ポトチャリ記念センター | ボスニア・ヘルツェゴビナ スレブレニツァ | (44.16, 19.30) | ✅ |

- **国名混入 0件**(flash-lite 時代は7件の国名が混入)。
- 具体的な施設名・ランドマーク名で抽出されている。

### Before / After 比較まとめ

| 指標 | Before (flash-lite) | After (3-flash-preview) |
| --- | --- | --- |
| 国名混入 | 7件 | **0件** |
| ノイズ(字幕誤認識由来) | 1件(「グアムち婚車」) | **0件** |
| 座標の解像度 | グアム全地点が同一座標 | **各地点固有の座標** |
| ユーゴ動画の地名 | 11件(7件国名 + 2件都市 + 2件見つからず) | **4件(全て具体的施設)** |
| ジオコード成功率 | LLM=0, Nominatim/Places中心 | **LLM=16/16件 (100%)** |
| region の粒度 | 県レベル(「岩手県」) | **市レベル(「岩手県八幡平市」)** |

---

## 4. 現在のアーキテクチャ

### パイプライン各ステップの状態

| ステップ | ファイル | 状態 |
| --- | --- | --- |
| Step 1: fetch | fetch-videos.ts | ✅ 安定動作 |
| Step 2: extract | extract-locations.ts | ✅ 改善済み(gemini-3-flash-preview + 座標出力) |
| Step 3: geocode | geocode.ts | ✅ 改善済み(LLMプライマリ + 英語リトライ) |
| Step 4: validate | validate-and-merge.ts | ✅ 改善済み(confidenceScore廃止 + マージ修正) |

### 型定義(Location)

```typescript
type Location = {
  id: string;    // {videoId}-{index}
  name: string;  // 地名
  lat: number;   // 緯度 (-90 ~ 90)
  lng: number;   // 経度 (-180 ~ 180)
};
```

confidenceScore / needsReview は廃止済み。

### コスト構造

| リソース | 用途 | コスト |
| --- | --- | --- |
| Gemini API (gemini-3-flash-preview) | 地名+座標抽出 | 入力 ~9,000トークン/動画、出力 ~200-400トークン/動画 |
| Nominatim | フォールバックジオコーディング | 無料(レート制限: 1req/sec) |
| Google Places | 第2フォールバック | 従量課金(LLM座標で代替されるため使用頻度低) |
| YouTube Data API | メタデータ取得 | 無料枠内 |
| Noteey (Playwright) | 字幕取得 | 無料 |

---

## 5. 残存課題・今後の検討事項

| 項目 | 詳細 | 優先度 |
| --- | --- | --- |
| LLM 座標のハルシネーション | LLM が不正確な座標を自信を持って出す可能性。現状3本の検証では問題なし | 中(データ量増加で顕在化する可能性) |
| データ量 | 現在3本のみ。本番運用には数十〜数百本の処理が必要 | 高 |
| GitHub Actions 自動実行 | ワークフロー作成済みだが未検証 | 中 |
| チャンネルID | YouTube Data API の Search/Channels エンドポイントで 0件が返る現象あり。Videos API は正常 | 低(動画ID直接指定で回避可能) |
