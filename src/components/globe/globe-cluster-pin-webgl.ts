import * as THREE from 'three';

// キャンバスにクラスターピン(ティアドロップ + 数字)を描画する
function drawClusterCanvas(
  canvasSize: number,
  count: number,
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
  const headR = C * 0.28; // クラスターは少し大きめの頭部
  const headCy = C * 0.35;
  const tipY = C * 0.93;

  // グロー
  ctx.shadowColor = 'rgba(245,158,11,0.55)';
  ctx.shadowBlur = C * 0.14;

  // ピン本体
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.bezierCurveTo(
    cx + headR * 0.35,
    tipY,
    cx + headR,
    headCy + headR * 1.4,
    cx + headR,
    headCy,
  );
  ctx.arc(cx, headCy, headR, 0, Math.PI, true);
  ctx.bezierCurveTo(
    cx - headR,
    headCy + headR * 1.4,
    cx - headR * 0.35,
    tipY,
    cx,
    tipY,
  );
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    cx - headR,
    headCy - headR,
    cx + headR,
    headCy + headR,
  );
  grad.addColorStop(0, 'rgba(251,191,36,0.92)');
  grad.addColorStop(1, 'rgba(245,158,11,0.88)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;

  // 数字テキスト(白、影あり)
  const fontSize = Math.round(headR * 1.05);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillText(String(count), cx, headCy + fontSize * 0.04);

  return canvas;
}

// 裏半球の判定用に使い回すベクトル
const _worldPos = new THREE.Vector3();

// クラスターピン — THREE.Sprite(ビルボード)
export function createGlobeClusterPinMesh(count: number): THREE.Object3D {
  const canvas = drawClusterCanvas(128, count);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    sizeAttenuation: false,
    depthTest: false, // スプライト同士のz-fightingを完全に排除
  });
  const sprite = new THREE.Sprite(material);

  const markerW = Math.max(28, Math.min(24 + count * 2, 44));
  const markerH = Math.round(markerW * 1.4);
  const K = 0.001;
  sprite.scale.set((markerW / 0.65) * K, (markerH / 0.88) * K, 1);

  // 先端を地表に合わせる
  sprite.center.set(0.5, 0);

  // 毎フレーム: カメラと逆側の半球にあるピンを非表示にする
  sprite.onBeforeRender = (_renderer, _scene, camera) => {
    sprite.getWorldPosition(_worldPos);
    sprite.visible = _worldPos.dot(camera.position) > 0;
  };

  return sprite;
}
