import type { LocationGroup } from '@/types/location';
import type { PointOfView } from './globe-scene';
import { GlobeScene } from './globe-scene';

type GlobeViewProps = {
  onLocationClick: (group: LocationGroup, returnPov: PointOfView) => void;
  restorePov?: PointOfView;
};

export function GlobeView({ onLocationClick, restorePov }: GlobeViewProps) {
  return (
    <div className='fixed inset-0' style={{ touchAction: 'none' }}>
      <GlobeScene onLocationClick={onLocationClick} restorePov={restorePov} />
    </div>
  );
}
