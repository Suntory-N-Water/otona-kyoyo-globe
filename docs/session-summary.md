# セッションサマリー (2026-02-21)

## 完了した作業

### フロントエンド (全て実装済み、ビルド通過)

- `bun run build` 成功、`bun run ai-check` 通過
- react-globe.gl による3D地球儀表示 (NASAテクスチャ、糸島初期カメラ)
- supercluster によるピンクラスタリング
- ピンクリック → 自転アニメーション → Leaflet地図画面への遷移
- CartoDB Dark Matter タイルによるダークテーマ地図
- 「← 地球儀に戻る」ボタン + カメラ位置復元
- shadcn/ui Sheet による動画一覧パネル (右スライドイン)
- 動画カード (サムネ + タイトル + 再生数 + 投稿日)
- 初回ガイドオーバーレイ (localStorage で制御)
- ヘッダー、OGPメタタグ

### パイプライン (スクリプト作成済み、一部動作未確認)

- `scripts/` を uv プロジェクトとして構築 (pyproject.toml + uv.lock)
- `fetch_videos.py` -- 指定した動画URLのメタデータ + 字幕取得
- `extract_locations.py` -- LLM で地名抽出 (スタブ、未実装)
- `geocode.py` -- Nominatim → Google Places フォールバック
- `validate_and_merge.py` -- バリデーション + 既存JSONマージ
- `data-pipeline.yml` -- GitHub Actions ワークフロー
- `bun run pipeline:fetch -- VIDEO_ID` で各ステップ単体実行可能

---

## 未解決の問題

### [ブロッカー] 字幕取得が YouTube の IP レート制限でブロックされている

テスト動画: `clFtrDq0FoA`

試した方法と結果:

| 方法 | 結果 |
|------|------|
| youtube-transcript-api | IPブロック (RequestBlocked) |
| yt-dlp (素) | 429 Too Many Requests |
| yt-dlp + curl_cffi (impersonation) | 429 Too Many Requests |

原因:
- 短時間にテストを繰り返したことで YouTube の `timedtext` エンドポイントに対するレート制限が発動
- 一度 429 が発生すると解除までに時間がかかる (数時間〜)

補足:
- YouTube Data API v3 の Captions API は他人の動画の字幕取得不可 (OAuth + 自分の動画のみ)
- `extract_info()` (メタデータ取得) は yt-dlp でもブロックされずに成功している
- 字幕のダウンロードフェーズだけがブロックされている

検討すべき対応策:
1. 時間を空けて再試行 (レート制限解除後)
2. youtube-transcript-api + Webshare プロキシ (有料、月額数ドル〜)
3. yt-dlp + ブラウザ cookie (`--cookies-from-browser`、ローカルのみ)
4. 動画の description (説明文) も YouTube Data API で取得し、字幕が取れない場合の補助情報として使う

### [未着手] LLM プロバイダーが未選定

`extract_locations.py` の `call_llm()` が `NotImplementedError` のスタブ状態。
Claude / GPT / Gemini のいずれかを選定して実装する必要がある。

---

## 現在のコード上の不整合

### fetch_videos.py が youtube-transcript-api を import しているが、pyproject.toml には yt-dlp しか入っていない

`pyproject.toml` の依存:
```
yt-dlp>=2026.2.4
curl-cffi>=0.14.0
```

`fetch_videos.py` の import:
```python
from youtube_transcript_api import YouTubeTranscriptApi
```

字幕取得ライブラリを確定させた上で、import とdependencies を一致させる必要がある。

---

## ディレクトリ構成 (現状)

```
src/
  App.tsx                         # globe/map 画面遷移
  main.tsx
  index.css                       # ダークテーマ、overflow:hidden
  types/location.ts               # Video, Location, LocationGroup 型
  data/locations.json              # 空テンプレート
  hooks/
    use-location-data.ts           # JSON読み込み + グルーピング
    use-clustered-pins.ts          # supercluster
    use-guide.ts                   # 初回ガイド制御
  components/
    globe/
      globe-view.tsx               # 地球儀画面コンテナ
      globe-scene.tsx              # react-globe.gl + ピン統合
      globe-pin.ts                 # 個別ピン DOM 生成
      globe-cluster-pin.ts         # クラスタピン DOM 生成
    map/
      map-view.tsx                 # 地図画面 + ピン + パネル
      map-scene.tsx                # MapContainer + タイル
      map-bounds-controller.tsx    # 日本 zoom 9 / 海外 fitBounds
      map-pin.tsx                  # Leaflet Marker
    panel/
      video-panel.tsx              # Sheet (動画一覧)
      video-card.tsx               # サムネ + タイトル
    overlay/
      site-header.tsx              # ヘッダー
      back-button.tsx              # ← 地球儀に戻る
      guide-overlay.tsx            # 初回ガイド
    ui/
      button.tsx, badge.tsx, sheet.tsx  # shadcn/ui
  lib/
    constants.ts                   # 糸島座標、テクスチャURL、チャンネルURL
    geo.ts                         # Haversine距離、日本判定
    pin-style.ts                   # 再生数→サイズ、投稿日→明るさ
    utils.ts                       # cn()

scripts/
  pyproject.toml                   # uv プロジェクト
  uv.lock
  config.py                        # 共通定数
  fetch_videos.py                  # Step 1: メタデータ + 字幕
  extract_locations.py             # Step 2: LLM 地名抽出 (スタブ)
  geocode.py                       # Step 3: 座標取得
  validate_and_merge.py            # Step 4: バリデーション + マージ

.github/workflows/data-pipeline.yml
```

---

## 次のセッションでやること

1. 字幕取得問題を解決する (レート制限解除後に再テスト、ライブラリ確定)
2. fetch_videos.py の import と pyproject.toml の依存を一致させる
3. LLM プロバイダーを選定し、extract_locations.py を実装する
4. パイプライン全体をテスト動画で通しで実行する
5. 実データで地球儀上のピン表示を確認する
