// 個別ピンの DOM 要素を生成
export function createGlobePin(
  size: number,
  brightness: number,
  onClick: () => void,
): HTMLDivElement {
  const el = document.createElement('div');
  const alpha = brightness;

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.background = `radial-gradient(circle, rgba(59,130,246,${alpha}) 0%, rgba(59,130,246,${alpha * 0.3}) 70%, transparent 100%)`;
  el.style.boxShadow = `0 0 ${size * 0.6}px rgba(59,130,246,${alpha * 0.5})`;
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  el.style.transition = 'opacity 250ms, transform 150ms';
  el.style.transform = 'translate(-50%, -50%)';

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'translate(-50%, -50%) scale(1.3)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'translate(-50%, -50%)';
  });
  el.addEventListener('click', onClick);

  return el;
}
