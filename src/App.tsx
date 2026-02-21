import { useCallback, useState } from 'react';
import type { PointOfView } from '@/components/globe/globe-scene';
import { GlobeView } from '@/components/globe/globe-view';
import { MapView } from '@/components/map/map-view';
import { BackButton } from '@/components/overlay/back-button';
import { GuideOverlay } from '@/components/overlay/guide-overlay';
import { SiteHeader } from '@/components/overlay/site-header';
import { useGuide } from '@/hooks/use-guide';
import type { LocationGroup } from '@/types/location';

type AppView =
  | { screen: 'globe'; returnPov?: PointOfView }
  | { screen: 'map'; target: LocationGroup; returnPov: PointOfView };

function App() {
  const [view, setView] = useState<AppView>({ screen: 'globe' });
  const { showGuide, dismissGuide } = useGuide();

  const handleLocationClick = useCallback(
    (group: LocationGroup, returnPov: PointOfView) => {
      dismissGuide();
      setView({ screen: 'map', target: group, returnPov });
    },
    [dismissGuide],
  );

  const handleBack = useCallback(() => {
    if (view.screen === 'map') {
      setView({ screen: 'globe', returnPov: view.returnPov });
    }
  }, [view]);

  return (
    <>
      {view.screen === 'globe' && (
        <>
          <GlobeView
            onLocationClick={handleLocationClick}
            restorePov={view.returnPov}
          />
          <SiteHeader />
          {showGuide && <GuideOverlay onDismiss={dismissGuide} />}
        </>
      )}
      {view.screen === 'map' && (
        <>
          <MapView target={view.target} />
          <BackButton onClick={handleBack} />
        </>
      )}
    </>
  );
}

export default App;
