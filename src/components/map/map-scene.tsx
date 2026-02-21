import 'leaflet/dist/leaflet.css';
import type { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LocationGroup } from '@/types/location';
import { MapBoundsController } from './map-bounds-controller';

type MapSceneProps = {
  target: LocationGroup;
  children?: ReactNode;
};

// CartoDB Dark Matter タイル
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

export function MapScene({ target, children }: MapSceneProps) {
  return (
    <MapContainer
      center={[target.lat, target.lng]}
      zoom={9}
      className='h-full w-full'
      zoomControl={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <MapBoundsController target={target} />
      {children}
    </MapContainer>
  );
}
