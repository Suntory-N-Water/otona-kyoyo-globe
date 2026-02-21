import { useEffect, useState } from 'react';
import locationsJson from '@/data/locations.json';
import type { LocationGroup, LocationsData, Video } from '@/types/location';

export function useLocationData() {
  const [groups, setGroups] = useState<LocationGroup[]>([]);
  const [maxViewCount, setMaxViewCount] = useState(0);

  useEffect(() => {
    const data = locationsJson as LocationsData;
    const videos = data.videos;

    // 最大再生数を算出
    const max = Math.max(0, ...videos.map((v) => v.viewCount));
    setMaxViewCount(max);

    // 同一地名でグルーピング
    const groupMap = new Map<string, LocationGroup>();

    for (const video of videos) {
      for (const loc of video.locations) {
        const existing = groupMap.get(loc.name);
        if (existing) {
          // 重複動画を防止
          if (!existing.videos.some((v) => v.videoId === video.videoId)) {
            existing.videos.push(video);
          }
        } else {
          groupMap.set(loc.name, {
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            videos: [video],
          });
        }
      }
    }

    setGroups(Array.from(groupMap.values()));
  }, []);

  return { groups, maxViewCount };
}

// 全動画からフラットなリストを取得
export function flattenVideos(groups: LocationGroup[]): Video[] {
  const seen = new Set<string>();
  const result: Video[] = [];
  for (const group of groups) {
    for (const video of group.videos) {
      if (!seen.has(video.videoId)) {
        seen.add(video.videoId);
        result.push(video);
      }
    }
  }
  return result;
}
