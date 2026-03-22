import * as THREE from 'three';

// キャンバスに Googleマップ型ピン(ティアドロップ形状)を描画する
// tip が下(地表側)、頭部が上、白い丸コアあり
function drawPinCanvas(
  canvasSize: number,
  alpha: number, // 明るさ 0.4-1.0
): HTMLCanvasElement {
  const C = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = C;
  canvas.height = C;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  const cx = C / 2;
  const headR = C * 0.26; // 頭部円の半径
  const headCy = C * 0.35; // 頭部円の中心 Y
  const tipY = C * 0.93; // 先端の Y

  // グロー(発光)
  ctx.shadowColor = `rgba(245,158,11,${alpha * 0.55})`;
  ctx.shadowBlur = C * 0.14;

  // --- ピン本体パス ---
  // 先端 → 右ベジエ → 頭部弧 → 左ベジエ → 先端
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  // 右側: 先端 → 頭部右端 (円への接線方向=真上で到達)
  ctx.bezierCurveTo(
    cx + headR * 0.35,
    tipY, // CP1: 先端の右寄り
    cx + headR,
    headCy + headR * 1.4, // CP2: 円の真下
    cx + headR,
    headCy, // 終点: 頭部右端
  );
  // 頭部円弧 (右 → 左 , 反時計回り)
  ctx.arc(cx, headCy, headR, 0, Math.PI, true);
  // 左側: 頭部左端 → 先端
  ctx.bezierCurveTo(
    cx - headR,
    headCy + headR * 1.4,
    cx - headR * 0.35,
    tipY,
    cx,
    tipY,
  );
  ctx.closePath();

  // グラデーション塗り (135° 方向)
  const gx1 = cx - headR;
  const gy1 = headCy - headR;
  const gx2 = cx + headR;
  const gy2 = headCy + headR;
  const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
  grad.addColorStop(0, `rgba(251,191,36,${alpha})`);
  grad.addColorStop(1, `rgba(245,158,11,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fill();

  // グロー解除
  ctx.shadowBlur = 0;

  // 白いコア
  const coreR = headR * 0.38;
  ctx.beginPath();
  ctx.arc(cx, headCy, coreR, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();

  return canvas;
}

// 裏半球の判定用に使い回すベクトル (GC圧を減らすため関数外で確保)
const _worldPos = new THREE.Vector3();

// 個別ピン — THREE.Sprite(ビルボード)でキャンバス画像を表示
// size は pin-style.ts の pinSize() が返す 12-28 の値
export function createGlobePinMesh(
  size: number,
  brightness: number,
): THREE.Object3D {
  const canvas = drawPinCanvas(128, brightness);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    sizeAttenuation: false, // 固定スクリーンピクセルサイズ (DOMピンと同じ挙動)
    depthTest: false, // スプライト同士のz-fightingを完全に排除
  });
  const sprite = new THREE.Sprite(material);

  // sizeAttenuation:false のスケール単位は世界座標
  // screen_px ≈ scale * (viewportHeight/2) / tan(fov/2)
  // FOV=75°, viewport=720 → 1px ≈ 0.00213 world units
  // canvas内のピン本体は幅65%, 高さ88%なので逆算して補正
  const markerW = Math.max(16, size);
  const markerH = Math.round(markerW * 1.4);
  const K = 0.0013; // 微調整用定数
  sprite.scale.set((markerW / 0.65) * K, (markerH / 0.88) * K, 1);

  // center=(0.5, 0): スプライトの下端(先端)を原点(地表)に合わせる
  sprite.center.set(0.5, 0);

  // 毎フレーム: カメラと逆側の半球にあるピンを非表示にする
  // depthTest:false の副作用(地球の裏側が透けて見える)を防ぐ
  sprite.onBeforeRender = (_renderer, _scene, camera) => {
    sprite.getWorldPosition(_worldPos);
    sprite.visible = _worldPos.dot(camera.position) > 0;
  };

  return sprite;
}
