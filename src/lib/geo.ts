// 日本の緯度経度範囲
const JAPAN_BOUNDS = {
  latMin: 24,
  latMax: 46,
  lngMin: 122,
  lngMax: 154,
} as const;

export function isInJapan(lat: number, lng: number): boolean {
  return (
    lat >= JAPAN_BOUNDS.latMin &&
    lat <= JAPAN_BOUNDS.latMax &&
    lng >= JAPAN_BOUNDS.lngMin &&
    lng <= JAPAN_BOUNDS.lngMax
  );
}
