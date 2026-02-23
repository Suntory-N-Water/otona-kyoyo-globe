import { useLocationData } from '@/hooks/use-location-data';
import type { LocationGroup } from '@/types/location';
import { MapPin } from './map-pin';
import { MapScene } from './map-scene';

type MapViewProps = {
  target: LocationGroup;
};

export function MapView({ target }: MapViewProps) {
  const { groups } = useLocationData();
  const visibleGroups = groups.length > 0 ? groups : [target];

  return (
    <div className='fixed inset-0'>
      <MapScene target={target}>
        {visibleGroups.map((group) => (
          <MapPin key={group.name} group={group} />
        ))}
      </MapScene>
    </div>
  );
}
