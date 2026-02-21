import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { LocationGroup } from '@/types/location';

type MapPinProps = {
  group: LocationGroup;
  onClick: (group: LocationGroup) => void;
};

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:rgba(59,130,246,0.8);border:2px solid white;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function MapPin({ group, onClick }: MapPinProps) {
  return (
    <Marker
      position={[group.lat, group.lng]}
      icon={pinIcon}
      eventHandlers={{
        click: () => onClick(group),
      }}
    />
  );
}
