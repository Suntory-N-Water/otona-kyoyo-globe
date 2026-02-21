// 再生数 → ピンサイズ (12-28px)
const MIN_SIZE = 12;
const MAX_SIZE = 28;

export function pinSize(viewCount: number, maxViewCount: number): number {
  if (maxViewCount <= 0) {
    return MIN_SIZE;
  }
  const ratio = Math.min(viewCount / maxViewCount, 1);
  return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(ratio);
}

// 投稿日 → 明るさ (0.4-1.0)、新しいほど明るい
const MIN_BRIGHTNESS = 0.4;
const MAX_BRIGHTNESS = 1.0;
// 2年間を基準
const AGE_RANGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export function pinBrightness(publishedAt: string): number {
  const age = Date.now() - new Date(publishedAt).getTime();
  const ratio = Math.min(age / AGE_RANGE_MS, 1);
  return MAX_BRIGHTNESS - (MAX_BRIGHTNESS - MIN_BRIGHTNESS) * ratio;
}
