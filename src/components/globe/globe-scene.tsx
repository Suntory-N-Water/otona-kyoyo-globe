import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { createGlobeClusterPinMesh } from '@/components/globe/globe-cluster-pin-webgl';
import { createGlobePinMesh } from '@/components/globe/globe-pin-webgl';
import type { ClusterPin } from '@/hooks/use-clustered-pins';
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

// Three.js オブジェクトを再帰的に破棄してGPUメモリを解放
function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        for (const m of child.material) {
          m.dispose();
        }
      } else {
        child.material.dispose();
      }
    }
    if (child instanceof THREE.Sprite) {
      if (child.material.map) {
        child.material.map.dispose();
      }
      child.material.dispose();
    }
  });
}

export function GlobeScene({ onLocationClick, restorePov }: GlobeSceneProps) {
  const globeRef = useRef<GlobeMethods>(undefined);
  const [altitude, setAltitude] = useState<number>(ITOSHIMA.altitude);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { groups, maxViewCount } = useLocationData();
  const pins = useClusteredPins(groups, altitude);

  // タッチデバイス判定 (モバイル向け軽量モード)
  const isMobile = useMemo(
    () => window.matchMedia('(pointer: coarse)').matches,
    [],
  );

  // Three.js オブジェクトキャッシュ (ズーム時の再生成とGPUメモリ再確保を削減)
  const pinMeshCacheRef = useRef<Map<string, THREE.Object3D>>(new Map());
  useEffect(() => {
    const currentIds = new Set(pins.map((p) => p.id));
    const toDispose: [string, THREE.Object3D][] = [];
    for (const [key, obj] of pinMeshCacheRef.current.entries()) {
      if (!currentIds.has(key)) {
        // 即時dispose するとreact-globe.glが同フレームに描画してグレー化するため
        // まず非表示にし、次フレームで GPU リソースを解放する
        obj.visible = false;
        toDispose.push([key, obj]);
      }
    }
    if (toDispose.length > 0) {
      const raf = requestAnimationFrame(() => {
        for (const [key, obj] of toDispose) {
          disposeObject3D(obj);
          pinMeshCacheRef.current.delete(key);
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [pins]);

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

    // ズーム範囲を制限 (minDistance=108でほぼ地表近くまで寄れる)
    const controls = globe.controls();
    controls.minDistance = 108;
    controls.maxDistance = 800;

    // モバイルでpixelRatioを制限してGPU描画負荷を削減 (Retina=3xを1.5xに抑える)
    if (isMobile) {
      const renderer = globe.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }, [restorePov, isMobile]);

  const navigateToMap = useCallback(
    (group: LocationGroup, currentPov: PointOfView) => {
      setTimeout(() => {
        onLocationClick(group, currentPov);
      }, CAMERA_TRANSITION_MS + 200);
    },
    [onLocationClick],
  );

  const handlePinClick = useCallback(
    (group: LocationGroup) => {
      const globe = globeRef.current;
      if (!globe) {
        return;
      }

      const currentPov = globe.pointOfView() as PointOfView;
      const targetAltitude = Math.min(currentPov.altitude, 0.5);
      globe.pointOfView(
        { lat: group.lat, lng: group.lng, altitude: targetAltitude },
        CAMERA_TRANSITION_MS,
      );

      navigateToMap(group, currentPov);
    },
    [navigateToMap],
  );

  const handleClusterClick = useCallback(
    (clusterGroups: LocationGroup[], lat: number, lng: number) => {
      const globe = globeRef.current;
      if (!globe) {
        return;
      }

      const currentPov = globe.pointOfView() as PointOfView;
      const targetAltitude = Math.min(currentPov.altitude, 0.5);
      globe.pointOfView(
        { lat, lng, altitude: targetAltitude },
        CAMERA_TRANSITION_MS,
      );

      const seenVideoIds = new Set<string>();
      const mergedVideos = clusterGroups
        .flatMap((g) => g.videos)
        .filter((v) => {
          if (seenVideoIds.has(v.videoId)) {
            return false;
          }
          seenVideoIds.add(v.videoId);
          return true;
        });
      const syntheticGroup: LocationGroup = {
        name: clusterGroups.map((g) => g.name).join('・'),
        lat,
        lng,
        videos: mergedVideos,
      };

      navigateToMap(syntheticGroup, currentPov);
    },
    [navigateToMap],
  );

  // altitude 追跡(クラスタリング更新用) - startTransition で非緊急更新としてスケジュール
  const handleZoom = useCallback((pov: PointOfView) => {
    startTransition(() => setAltitude(pov.altitude));
  }, []);

  // objectsData のクリックハンドラ: ライブラリがデータアイテムを引数として渡す
  const handleObjectClick = useCallback(
    (obj: object) => {
      const pin = obj as ClusterPin;
      if (pin.isCluster) {
        handleClusterClick(pin.clusterGroups ?? [], pin.lat, pin.lng);
      } else if (pin.group) {
        handlePinClick(pin.group);
      }
    },
    [handleClusterClick, handlePinClick],
  );

  return (
    <Globe
      ref={globeRef}
      width={dimensions.width}
      height={dimensions.height}
      globeImageUrl={GLOBE_TEXTURES.globe}
      bumpImageUrl={isMobile ? undefined : GLOBE_TEXTURES.bump}
      backgroundImageUrl={isMobile ? undefined : GLOBE_TEXTURES.background}
      showAtmosphere={!isMobile}
      atmosphereColor={ATMOSPHERE_COLOR}
      atmosphereAltitude={0.2}
      animateIn={false}
      rendererConfig={{
        antialias: !isMobile,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
      }}
      onZoom={handleZoom}
      objectsData={pins}
      objectLat='lat'
      objectLng='lng'
      objectAltitude={0.01}
      objectFacesSurfaces={true}
      objectThreeObject={(d) => {
        const pin = d as ClusterPin;

        // キャッシュヒット時は既存オブジェクトを返す
        const cached = pinMeshCacheRef.current.get(pin.id);
        if (cached) {
          return cached;
        }

        let obj: THREE.Object3D;
        if (pin.isCluster) {
          obj = createGlobeClusterPinMesh(pin.count);
          // クラスターは個別ピンより常に手前に描画 (Z順のちらつき防止)
          obj.renderOrder = 10 + pin.count;
        } else {
          const group = pin.group;
          if (!group) {
            return new THREE.Object3D();
          }
          const topVideo = group.videos.reduce((a, b) =>
            a.viewCount > b.viewCount ? a : b,
          );
          const size = pinSize(topVideo.viewCount, maxViewCount);
          const brightness = pinBrightness(topVideo.publishedAt);
          obj = createGlobePinMesh(size, brightness);
          // 再生数が多いピンを手前に描画して安定させる
          obj.renderOrder = Math.round(size);
        }

        pinMeshCacheRef.current.set(pin.id, obj);
        return obj;
      }}
      objectLabel={(d) => {
        const pin = d as ClusterPin;
        return pin.isCluster ? '' : (pin.group?.name ?? '');
      }}
      onObjectClick={handleObjectClick}
    />
  );
}
