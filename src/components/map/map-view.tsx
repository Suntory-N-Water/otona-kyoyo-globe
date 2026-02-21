import { useCallback, useState } from 'react';
import { VideoPanel } from '@/components/panel/video-panel';
import { useLocationData } from '@/hooks/use-location-data';
import type { LocationGroup } from '@/types/location';
import { MapPin } from './map-pin';
import { MapScene } from './map-scene';

type MapViewProps = {
  target: LocationGroup;
};

export function MapView({ target }: MapViewProps) {
  const { groups } = useLocationData();
  const [selectedGroup, setSelectedGroup] = useState<LocationGroup | null>(
    null,
  );
  const [panelOpen, setPanelOpen] = useState(false);

  const handlePinClick = useCallback((group: LocationGroup) => {
    setSelectedGroup(group);
    setPanelOpen(true);
  }, []);

  // 対象地域のグループをフィルタリング(同じ地名 or 近隣)
  const visibleGroups = groups.length > 0 ? groups : [target];

  return (
    <div className='fixed inset-0'>
      <MapScene target={target}>
        {visibleGroups.map((group) => (
          <MapPin key={group.name} group={group} onClick={handlePinClick} />
        ))}
      </MapScene>
      <VideoPanel
        group={selectedGroup}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </div>
  );
}
