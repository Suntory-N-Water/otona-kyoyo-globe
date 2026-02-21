// クラスタピンの DOM 要素を生成
export function createGlobeClusterPin(count: number): HTMLDivElement {
  const el = document.createElement('div');
  const size = Math.min(20 + count * 2, 48);

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.background = 'rgba(59,130,246,0.25)';
  el.style.border = '2px solid rgba(59,130,246,0.7)';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.color = 'white';
  el.style.fontSize = `${Math.max(10, size * 0.35)}px`;
  el.style.fontWeight = 'bold';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.transition = 'opacity 250ms';
  el.textContent = String(count);

  return el;
}
