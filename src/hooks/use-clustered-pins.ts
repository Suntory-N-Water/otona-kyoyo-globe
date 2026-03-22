import { useMemo } from 'react';
import Supercluster from 'supercluster';
import type { LocationGroup } from '@/types/location';

export type ClusterPin = {
  id: string;
  lat: number;
  lng: number;
  isCluster: boolean;
  count: number;
  group?: LocationGroup;
  clusterGroups?: LocationGroup[];
};

// globe.gl の altitude からおおよその zoom レベルに変換
function altitudeToZoom(altitude: number): number {
  // altitude 0.1 → zoom 12, altitude 4 → zoom 1
  return Math.max(0, Math.min(16, Math.round(12 - Math.log2(altitude * 10))));
}

export function useClusteredPins(groups: LocationGroup[], altitude: number) {
  const index = useMemo(() => {
    const cluster = new Supercluster({
      radius: 60,
      maxZoom: 12,
    });

    const points: Supercluster.PointFeature<{
      groupIndex: number;
    }>[] = groups.map((g, i) => ({
      type: 'Feature' as const,
      properties: { groupIndex: i },
      geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
    }));

    cluster.load(points);
    return cluster;
  }, [groups]);

  // zoom は整数なので altitude が細かく変化しても zoom が変わらなければ再計算しない
  const zoom = useMemo(() => altitudeToZoom(altitude), [altitude]);

  const pins = useMemo(() => {
    const clusters = index.getClusters([-180, -90, 180, 90], zoom);

    return clusters.map((feature): ClusterPin => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;

      if ('cluster' in props && props.cluster) {
        const leaves = index.getLeaves(
          feature.id as number,
          Number.POSITIVE_INFINITY,
        );
        const clusterGroups = leaves.map((leaf) => {
          const leafGroupIndex = (leaf.properties as { groupIndex: number })
            .groupIndex;
          return groups[leafGroupIndex];
        });
        return {
          id: `cluster-${feature.id}`,
          lat,
          lng,
          isCluster: true,
          count: props.point_count,
          clusterGroups,
        };
      }

      const groupIndex = (props as { groupIndex: number }).groupIndex;
      return {
        id: `pin-${groupIndex}`,
        lat,
        lng,
        isCluster: false,
        count: 1,
        group: groups[groupIndex],
      };
    });
  }, [index, groups, zoom]);

  return pins;
}
