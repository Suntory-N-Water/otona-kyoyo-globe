import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { isInJapan } from '@/lib/geo';
import type { LocationGroup } from '@/types/location';

type MapBoundsControllerProps = {
  target: LocationGroup;
};

// 日本エリア: zoom 9 固定、海外: fitBounds で自動調整
const JAPAN_ZOOM = 9;
const OVERSEAS_PADDING = 2; // 度

export function MapBoundsController({ target }: MapBoundsControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (isInJapan(target.lat, target.lng)) {
      map.setView([target.lat, target.lng], JAPAN_ZOOM);
    } else {
      // 周辺をある程度含めて表示
      map.fitBounds([
        [target.lat - OVERSEAS_PADDING, target.lng - OVERSEAS_PADDING],
        [target.lat + OVERSEAS_PADDING, target.lng + OVERSEAS_PADDING],
      ]);
    }
  }, [map, target]);

  return null;
}
