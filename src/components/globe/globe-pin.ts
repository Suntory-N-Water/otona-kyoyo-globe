// 個別ピン(ドロップマーカー型)の DOM 要素を生成
export function createGlobePin(
  size: number,
  brightness: number,
  onClick: () => void,
): HTMLDivElement {
  const alpha = brightness;
  // マーカーのサイズ: size をベースに幅と高さを決定
  const markerW = Math.max(16, size);
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
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  // ピンの下端が座標位置に来るようにオフセット
  el.style.transform = 'translate(-50%, -100%)';

  // マーカー本体: ティアドロップ型(rotate(-45deg) + border-radius)
  const marker = document.createElement('div');
  marker.style.width = `${markerW}px`;
  marker.style.height = `${markerH}px`;
  marker.style.position = 'relative';
  marker.style.transition = 'filter 150ms';

  // ティアドロップ形状
  const drop = document.createElement('div');
  drop.style.width = `${markerW}px`;
  drop.style.height = `${markerW}px`;
  drop.style.borderRadius = '50% 50% 50% 0';
  drop.style.transform = 'rotate(-45deg)';
  drop.style.background = `linear-gradient(135deg, rgba(251,191,36,${alpha}) 0%, rgba(245,158,11,${alpha}) 100%)`;
  drop.style.boxShadow = `0 0 ${markerW * 0.8}px rgba(245,158,11,${alpha * 0.6}), 0 2px 4px rgba(0,0,0,0.3)`;
  drop.style.position = 'absolute';
  drop.style.top = '0';
  drop.style.left = '0';

  // 白いコア(中央の円)
  const core = document.createElement('div');
  const coreSize = Math.max(6, Math.round(markerW * 0.4));
  core.style.width = `${coreSize}px`;
  core.style.height = `${coreSize}px`;
  core.style.borderRadius = '50%';
  core.style.background = 'white';
  core.style.position = 'absolute';
  core.style.top = `${(markerW - coreSize) / 2}px`;
  core.style.left = `${(markerW - coreSize) / 2}px`;
  // rotate を打ち消し
  core.style.transform = 'rotate(45deg)';

  drop.appendChild(core);
  marker.appendChild(drop);

  // パルスアニメーション(グロー明滅)
  drop.animate(
    [
      {
        boxShadow: `0 0 ${markerW * 0.8}px rgba(245,158,11,${alpha * 0.6}), 0 2px 4px rgba(0,0,0,0.3)`,
      },
      {
        boxShadow: `0 0 ${markerW * 1.6}px rgba(245,158,11,${alpha * 0.4}), 0 2px 4px rgba(0,0,0,0.3)`,
      },
    ],
    {
      duration: 2000,
      iterations: Number.POSITIVE_INFINITY,
      direction: 'alternate',
      easing: 'ease-in-out',
    },
  );

  el.addEventListener('mouseenter', () => {
    marker.style.filter = 'brightness(1.3)';
  });
  el.addEventListener('mouseleave', () => {
    marker.style.filter = '';
  });
  el.addEventListener('click', onClick);

  el.appendChild(marker);
  return el;
}
