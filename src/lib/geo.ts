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

// Haversine 距離計算(km)
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
