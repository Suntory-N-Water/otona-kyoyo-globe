// クラスタピン(ドロップマーカー型 + 数字)の DOM 要素を生成
export function createGlobeClusterPin(count: number): HTMLDivElement {
  // マーカーサイズ: クラスタ数に応じて拡大
  const markerW = Math.max(28, Math.min(24 + count * 2, 44));
  const markerH = Math.round(markerW * 1.4);
  const touchSize = Math.max(44, markerH + 12);

  // 外側: タッチターゲット(透明)
  const el = document.createElement('div');
  el.style.width = `${touchSize}px`;
  el.style.height = `${touchSize}px`;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.background = 'transparent';
  el.style.transform = 'translate(-50%, -100%)';
  el.style.transition = 'opacity 250ms';

  // マーカー本体
  const marker = document.createElement('div');
  marker.style.width = `${markerW}px`;
  marker.style.height = `${markerH}px`;
  marker.style.position = 'relative';

  // ティアドロップ形状
  const drop = document.createElement('div');
  drop.style.width = `${markerW}px`;
  drop.style.height = `${markerW}px`;
  drop.style.borderRadius = '50% 50% 50% 0';
  drop.style.transform = 'rotate(-45deg)';
  drop.style.background =
    'linear-gradient(135deg, rgba(251,191,36,0.9) 0%, rgba(245,158,11,0.85) 100%)';
  drop.style.boxShadow = `0 0 ${markerW}px rgba(245,158,11,0.5), 0 2px 4px rgba(0,0,0,0.3)`;
  drop.style.position = 'absolute';
  drop.style.top = '0';
  drop.style.left = '0';

  // 中央の数字(rotate を打ち消し)
  const label = document.createElement('span');
  label.style.position = 'absolute';
  label.style.top = '50%';
  label.style.left = '50%';
  label.style.transform = 'rotate(45deg) translate(-50%, -50%)';
  label.style.transformOrigin = '0 0';
  label.style.color = 'white';
  label.style.fontSize = `${Math.max(11, Math.round(markerW * 0.38))}px`;
  label.style.fontWeight = 'bold';
  label.style.textShadow = '0 1px 2px rgba(0,0,0,0.4)';
  label.style.lineHeight = '1';
  label.textContent = String(count);

  drop.appendChild(label);
  marker.appendChild(drop);
  el.appendChild(marker);

  return el;
}
