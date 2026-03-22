## 基本原則

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、**後方互換性を維持しない**

## プロジェクト概要

YouTubeチャンネル「大人の教養TV」のロケ地を3D地球儀で探索する非公式Webサイト。
詳細な要件定義は `@docs/requirements.md` を参照。

## コマンド

```bash
# 静的解析(コード修正後に必ず実行、ユーザー許可不要)
bun run ai-check

# データパイプライン (個別実行可能)
bun run pipeline:fetch     # 動画一覧 + 字幕取得
bun run pipeline:extract   # AI 地名抽出
bun run pipeline:geocode   # ジオコーディング
bun run pipeline:validate  # バリデーション + マージ → src/data/locations.json
```

## アーキテクチャ

- 2画面構成: Globe画面(react-globe.gl + supercluster)→ ピンクリックで Map画面(react-leaflet)に遷移
- 画面遷移は `App.tsx` の `AppView` state で管理(ルーターなし)
- データ型は `src/types/location.ts` に集約(`LocationsData` > `Video` > `Location`、表示用に `LocationGroup`)
- パイプライン: `src/pipeline/` 内の4ステップ。中間ファイルは `src/pipeline/registry/`、最終出力は `src/data/locations.json`

## コード規約

- Biome でフォーマット・リント(`biome.jsonc`)。`type` を使う(`interface` ではない)。`any` 禁止
- GitHub の情報取得には `gh` コマンドを使用する
- ライブラリの仕様は`Context7` MCP で確認すること
- GitHub Actions ワークフロー更新時は `actions-check` Skills で静的解析を実施する
