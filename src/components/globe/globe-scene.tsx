import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import Globe from 'react-globe.gl';
import { createGlobeClusterPin } from '@/components/globe/globe-cluster-pin';
import { createGlobePin } from '@/components/globe/globe-pin';
import { useClusteredPins } from '@/hooks/use-clustered-pins';
import { useLocationData } from '@/hooks/use-location-data';
import {
  ATMOSPHERE_COLOR,
  CAMERA_TRANSITION_MS,
  GLOBE_TEXTURES,
  ITOSHIMA,
} from '@/lib/constants';
import { pinBrightness, pinSize } from '@/lib/pin-style';
import type { LocationGroup } from '@/types/location';

export type PointOfView = {
  lat: number;
  lng: number;
  altitude: number;
};

type GlobeSceneProps = {
  onLocationClick: (group: LocationGroup, returnPov: PointOfView) => void;
  restorePov?: PointOfView;
};

export function GlobeScene({ onLocationClick, restorePov }: GlobeSceneProps) {
  const globeRef = useRef<GlobeMethods>(undefined);
  const [altitude, setAltitude] = useState<number>(ITOSHIMA.altitude);
  const { groups, maxViewCount } = useLocationData();
  const pins = useClusteredPins(groups, altitude);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) {
      return;
    }

    // カメラ位置を復元または初期位置に設定
    const pov = restorePov ?? {
      lat: ITOSHIMA.lat,
      lng: ITOSHIMA.lng,
      altitude: ITOSHIMA.altitude,
    };
    globe.pointOfView(pov, restorePov ? CAMERA_TRANSITION_MS : 0);

    // ズーム範囲を制限
    const controls = globe.controls();
    controls.minDistance = 120;
    controls.maxDistance = 800;
  }, [restorePov]);

  const handlePinClick = useCallback(
    (group: LocationGroup) => {
      const globe = globeRef.current;
      if (!globe) {
        return;
      }

      const currentPov = globe.pointOfView() as PointOfView;

      // 現在より引いている場合のみズームイン、既に近い場合はそのまま寄る
      const targetAltitude = Math.min(currentPov.altitude, 1.8);
      globe.pointOfView(
        { lat: group.lat, lng: group.lng, altitude: targetAltitude },
        CAMERA_TRANSITION_MS,
      );

      // アニメーション完了後に画面遷移
      setTimeout(() => {
        onLocationClick(group, currentPov);
      }, CAMERA_TRANSITION_MS + 200);
    },
    [onLocationClick],
  );

  // altitude 追跡(クラスタリング更新用)
  const handleZoom = useCallback((pov: PointOfView) => {
    setAltitude(pov.altitude);
  }, []);

  return (
    <Globe
      ref={globeRef}
      globeImageUrl={GLOBE_TEXTURES.globe}
      bumpImageUrl={GLOBE_TEXTURES.bump}
      backgroundImageUrl={GLOBE_TEXTURES.background}
      showAtmosphere={true}
      atmosphereColor={ATMOSPHERE_COLOR}
      atmosphereAltitude={0.2}
      animateIn={false}
      onZoom={handleZoom}
      htmlElementsData={pins}
      htmlLat='lat'
      htmlLng='lng'
      htmlAltitude={0.01}
      htmlElement={(d) => {
        const pin = d as (typeof pins)[number];
        if (pin.isCluster) {
          return createGlobeClusterPin(pin.count);
        }

        // 個別ピン: 最も再生数の多い動画でスタイルを決定
        const group = pin.group;
        if (!group) {
          return document.createElement('div');
        }

        const topVideo = group.videos.reduce((a, b) =>
          a.viewCount > b.viewCount ? a : b,
        );
        const size = pinSize(topVideo.viewCount, maxViewCount);
        const brightness = pinBrightness(topVideo.publishedAt);

        return createGlobePin(size, brightness, () => handlePinClick(group));
      }}
      htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
        el.style.opacity = isVisible ? '1' : '0';
      }}
    />
  );
}
