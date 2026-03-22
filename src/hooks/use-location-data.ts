import locationsJson from '@/data/locations.json';
import type { LocationGroup, LocationsData } from '@/types/location';

// locationsJson はビルド時に静的にインポートされるため、モジュール初期化時に一度だけ計算する
// useEffect + setState では空データ→再レンダリングの2回サイクルが発生するため避ける
const _videos = (locationsJson as LocationsData).videos;

const _maxViewCount = Math.max(0, ..._videos.map((v) => v.viewCount));

const _groupMap = new Map<string, LocationGroup>();
for (const video of _videos) {
  for (const loc of video.locations) {
    const existing = _groupMap.get(loc.name);
    if (existing) {
      // 重複動画を防止
      if (!existing.videos.some((v) => v.videoId === video.videoId)) {
        existing.videos.push(video);
      }
    } else {
      _groupMap.set(loc.name, {
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        videos: [video],
      });
    }
  }
}
const _groups = Array.from(_groupMap.values());

export function useLocationData() {
  return { groups: _groups, maxViewCount: _maxViewCount };
}
