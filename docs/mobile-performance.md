# モバイルパフォーマンス改善 作業記録

## 課題

- スマホ(iPhone15 でもカクつく)での動作が重い
- 古い Android 端末では動かない可能性がある
- 日本・韓国・中国周辺にピンが密集しており、最大ズームでも分離できない
- 拡大しすぎると画面がブラックアウトしてリロードする(WebGL クラッシュ)
- スマホでピンチ操作を「ブラウザのページ拡大」と「地球儀のズーム」に誤認識することがある

---

## 試したこと・結果

### ✅ CSS keyframes によるアニメーション最適化(効果大)

**問題:** 各ピン(最大 330 個)が `element.animate()` API で `box-shadow` の無限ループアニメーションを実行していた。`box-shadow` はGPUコンポジションの対象外のため毎フレームCPUがソフトウェアレンダリングする。330個同時実行でスマホのCPUが飽和。

**対応:** `drop.animate(...)` 呼び出しを削除し、CSS `@keyframes globe-pin-pulse` で `opacity` アニメーションに変更。`opacity` アニメーションはコンポジタスレッドで GPU 加速される。

**結果:** PC での動作が軽くなった。

**注:** 後に DOM ピンを WebGL ピンに切り替えたため、このアニメーション自体は現在使用していない。

---

### ✅ クラスタリング計算の最適化

**問題:** `altitude`(カメラ高度)は浮動小数点数で毎フレーム変化するが、`useClusteredPins` の `useMemo` が `altitude` を依存配列に含んでいたため、同じズームレベル内でも毎フレーム再計算が走っていた。

**対応:** `use-clustered-pins.ts` で `altitude → zoom`(整数)への変換を先にメモ化し、`pins` の `useMemo` 依存を `zoom` に変更。同一ズームレベル内では再計算しなくなった。

```ts
const zoom = useMemo(() => altitudeToZoom(altitude), [altitude]);
const pins = useMemo(() => { ... }, [index, groups, zoom]); // altitude → zoom
```

---

### ✅ ズームハンドラを `startTransition` に変更

**問題:** `onZoom` イベントが 60fps で発火し `setAltitude` → React 再レンダリングが連鎖していた。以前は `setTimeout 50ms` デバウンスで対処していた(後から `startTransition` に変更)。

**対応:** `startTransition(() => setAltitude(...))` で非緊急更新としてスケジュール。React Concurrent Mode が複数ズームイベントをバッチ処理し、より重要な操作(タップ等)を優先できるようになった。

---

### ✅ モバイル軽量モード(複数対応)

タッチデバイスを `window.matchMedia('(pointer: coarse)')` で判定し、以下を適用：

| 対応 | 内容 |
|------|------|
| `bumpImageUrl` 無効化 | earth-topology.png(地形テクスチャ)の読み込みを省略 |
| `backgroundImageUrl` 無効化 | night-sky.png(星空背景)の読み込みを省略(約8MB GPU節約) |
| `showAtmosphere={false}` | 大気エフェクトのシェーダー計算をなくす |
| `antialias: false` | WebGL アンチエイリアス無効化 |
| `powerPreference: 'low-power'` | ブラウザに省電力GPU使用を指示 |
| `renderer.setPixelRatio(1.5)` | Retina 3x を 1.5x に制限(描画ピクセル数を約 1/4 に削減) |

---

### ✅ ズーム最大値の拡大

**問題:** `controls.minDistance = 120`(altitude ≈ 0.2 相当)が日本・韓国・中国周辺のピン密集エリアでの手動ズームの限界になっていた。

**対応:**
- `controls.minDistance = 108`(altitude ≈ 0.08 相当)に変更
- ピンクリック時の `targetAltitude` を `1.8 → 0.5` に変更

**注意:** `minDistance = 101`(Globe 半径=100 に対してギリギリ)にすると WebGL の z-buffer が破綻してブラックアウトする。108 程度が安全な下限。

---

### ✅ ピン DOM キャッシング → 後に不要化

同じ ID のピン DOM 要素を `useRef` の Map に保存して再利用するキャッシュを実装した。後に DOM 方式自体を廃止したため意味がなくなった。現在は Three.js オブジェクトのキャッシュに置き換えられている。

---

### ✅ `useLocationData` の useEffect 廃止

**問題:** `useEffect` + `setState` で JSON を処理していたため、初回レンダリングで空データ → データあり の 2 回レンダリングが発生していた。

**対応:** `locationsJson` はビルド時に静的にバンドルされる定数のため、モジュールロード時(モジュールスコープ)に一度だけ処理するよう変更。`useState` と `useEffect` を完全に廃止。

---

### ✅ ピンレンダリングを DOM → WebGL ネイティブに移行(最大の効果)

**問題(根本原因):**

```
WebGL (Three.js) で Globe を描画
    ↕ 毎フレーム合成  ← ここが重い
DOM (HTML) で 330 個のピンを描画
```

`htmlElementsData` を使うと、ブラウザが毎フレーム「WebGL 描画結果 + 330 個の DOM 要素」を合成(コンポジット)しなければならない。これがスマホ重さの根本原因だった。

**対応:** `htmlElementsData` を廃止し、`objectsData` + `objectThreeObject` に移行。ピンを Three.js の Mesh(コーン＋球体)として Globe のシーングラフ内に配置。すべての描画が 1 回の WebGL パスで完結する。

```tsx
// 変更前(DOM方式)
htmlElementsData={pins}
htmlElement={(d) => { /* document.createElement... */ }}

// 変更後(WebGL方式)
objectsData={pins}
objectThreeObject={(d) => new THREE.Group(/* cone + sphere */)}
onObjectClick={handleObjectClick}
```

クラスターピンの数字表示は `THREE.Sprite` + Canvas テクスチャで実現。GPU メモリリーク防止のため `geometry.dispose()` / `material.dispose()` を実装。

**結果:** 体感できるレベルで軽くなった。

---

### ✅ タッチイベント取り合いの修正

**問題:** Globe コンテナに `touch-action` が未設定のため、ブラウザがピンチ操作を横取りすることがあった。

**対応:** `globe-view.tsx` のコンテナ div に `style={{ touchAction: 'none' }}` を追加。

---

---

### ✅ ピンの見た目改善: LatheGeometry → THREE.Sprite に移行

**問題:** WebGL 移行直後のピン形状(コーン＋球体)が「エヴァの使徒みたい」で見た目が悪かった。

**試行1 — LatheGeometry でティアドロップ形状(失敗):**
`THREE.LatheGeometry` で Y 軸回転のティアドロップ形状を作成。2D 断面では綺麗なのに、3D 回転体なのでカメラ角度によって「三角形のニンジン」に見えてしまう。地球の縁付近では特に形状が潰れる。

**試行2 — THREE.Sprite + Canvas 描画(採用):**
DOM ピンが「常にカメラを向く 2D 平面図形」だったことに気づき、同じ挙動の `THREE.Sprite` に変更。Canvas 2D API でベジエ曲線 + 円弧を使い、元の CSS ティアドロップ(Googleマップ型)と同じシルエットを描画。

```ts
// Canvas に Googleマップ型ピンを描画
ctx.beginPath();
ctx.moveTo(cx, tipY);
ctx.bezierCurveTo(cx + headR * 0.35, tipY, cx + headR, headCy + headR * 1.4, cx + headR, headCy);
ctx.arc(cx, headCy, headR, 0, Math.PI, true);
ctx.bezierCurveTo(cx - headR, headCy + headR * 1.4, cx - headR * 0.35, tipY, cx, tipY);
// アンバーグラデーション + グロー + 白いコア
```

`sizeAttenuation: false` で DOM ピンと同じく「ズームに関わらず固定ピクセルサイズ」を実現。`sprite.center.set(0.5, 0)` で先端(キャンバス下端)を地表座標に固定。

**スケール計算:**
`sizeAttenuation: false` 時のスクリーンピクセル換算：`screen_px ≈ scale * (viewportHeight/2) / tan(fov/2)`
FOV=75°、viewport=720px → `1px ≈ 0.00213 world units`。キャンバス内のピン本体占有率(幅65%・高さ88%)を逆算して補正し、定数 `K = 0.001` を乗算。

**結果:** 本番(DOM ピン)とほぼ同じ見た目になった。

---

### ❌ うまく行かなかったこと

#### minDistance = 101 でのブラックアウト
`controls.minDistance = 101` にすると地球半径 100 にギリギリすぎて WebGL の z-buffer が破綻し、画面がブラックアウトしてリロードが発生した。108 に戻した。

#### LatheGeometry ティアドロップ(形状は正しいが 3D で崩れる)
`THREE.LatheGeometry` で正確なティアドロップ断面を定義しても、Y 軸回転体として 3D 空間に置かれるため、斜め・横から見ると形状が認識できなくなる。マップピンのような「常に正面を向く 2D アイコン」には根本的に不向き。

#### Sprite の z-fighting と端ピンのちらつき(部分的未解決)

**z-fighting(globe メッシュとの深度競合):**
`objectAltitude={0}` だと Sprite の深度値が globe メッシュと一致し、地平線付近のピンが「羽」型や「括弧」型に欠ける。`objectAltitude={0.01}` に変更して地表から 1 ユニット浮かせることで大幅改善。

**スプライト同士のちらつき(根本解決できず):**
`sizeAttenuation: false` のスプライトは全ピクセルが 3D 原点と同じ深度値を持つ。重なりが多い日本エリアなどで、カメラ移動につれてスプライト同士の深度ソート順が入れ替わりちらつく。`renderOrder` を固定値(クラスター: `10 + count`、個別: `Math.round(size)`)にすることで軽減。ただし**根本解決は困難**(後述)。

**グレーピン(タイミング依存):**
ズームレベル変化時に `dispose()` 済みスプライトを react-globe.gl が同フレームに描画しようとし、テクスチャが解放された状態でグレー表示される。`obj.visible = false` で即座に非表示にし、`requestAnimationFrame` で次フレームに `dispose` を遅延させることで対処。

---

## 現在の実装状態

### ファイル構成

| ファイル | 内容 |
|---------|------|
| `src/components/globe/globe-scene.tsx` | Globe メインコンポーネント。objectsData 方式、renderOrder・dispose遅延 |
| `src/components/globe/globe-pin-webgl.ts` | 個別ピン(THREE.Sprite + Canvas ティアドロップ描画) |
| `src/components/globe/globe-cluster-pin-webgl.ts` | クラスターピン(THREE.Sprite + Canvas 数字描画) |
| `src/components/globe/globe-pin.ts` | 旧 DOM ピン(未使用・削除候補) |
| `src/components/globe/globe-cluster-pin.ts` | 旧 DOM クラスターピン(未使用・削除候補) |
| `src/hooks/use-clustered-pins.ts` | Supercluster によるクラスタリング(zoom でメモ化済み) |
| `src/hooks/use-location-data.ts` | モジュールスコープで静的計算(useEffect なし) |

### 主要パラメータ

| パラメータ | 値 | 意味 |
|-----------|-----|------|
| `objectAltitude` | `0.01` | globe メッシュとの z-fighting 防止 |
| `sizeAttenuation` | `false` | DOM ピンと同じ固定ピクセルサイズ |
| `K` (スケール定数) | `0.001` | `markerW * K` が world unit スケール |
| `renderOrder` (個別) | `Math.round(size)` | 再生数が多いほど手前 |
| `renderOrder` (クラスター) | `10 + count` | 個別より常に手前 |

---

## 今後の課題

### ピンちらつきの根本解決(難易度高)

現在のちらつきの根本原因：`sizeAttenuation: false` スプライトは全ピクセルが同一深度値を持つため、重なった 2 枚のスプライトが Three.js の透明オブジェクトソートによって描画順が入れ替わる。

| 対策案 | 効果 | 問題 |
|--------|------|------|
| `depthTest: false` | 完全解消 | 地球の裏側のピンが透過して見える |
| `renderOrder` 固定 | 軽減(実施済み) | カメラ方向で完全には防げない |
| 可視半球フィルタ | 裏側ピンを非表示に + depthTest:false | フレームごとにカメラ方向を計算する必要あり。objectThreeObject はキャッシュされるので per-frame 更新が難しい |
| `customLayerData` に移行 | フレームごとの更新が可能 | react-globe.gl の別 API に乗り換えが必要 |

### パルスアニメーション復活(優先度低)

現在パルスアニメーションがない。Three.js でアニメーションするには `customLayerData` + `customThreeObjectUpdate` を使う必要がある(`objectsData` にはフレームごとの更新コールバックがない)。または Globe の `requestAnimationFrame` に乗せて自前でアニメーションループを書く。

### スマホでの根本的な重さ(限界あり)

現在できる対応はほぼ出し切った。さらに軽くするには：

- **スマホで Globe を非表示、2D 地図に切り替える** - UX 変更を伴うが劇的に軽くなる
- **`objectsData` → `pointsData` に変更** - 単純な円柱になるがさらに軽い
