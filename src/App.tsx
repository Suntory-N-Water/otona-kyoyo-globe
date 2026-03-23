import { useCallback, useState } from 'react';
import type { PointOfView } from '@/components/globe/globe-scene';
import { GlobeView } from '@/components/globe/globe-view';
import { MapView } from '@/components/map/map-view';
import { ContactView } from '@/components/contact/contact-view';
import { PrivacyView } from '@/components/privacy/privacy-view';
import { BackButton } from '@/components/overlay/back-button';
import { GuideOverlay } from '@/components/overlay/guide-overlay';
import { SiteFooter } from '@/components/overlay/site-footer';
import { SiteHeader } from '@/components/overlay/site-header';
import { useGuide } from '@/hooks/use-guide';
import type { LocationGroup } from '@/types/location';

type AppView =
  | { screen: 'globe'; returnPov?: PointOfView }
  | { screen: 'map'; target: LocationGroup; returnPov: PointOfView }
  | { screen: 'privacy' }
  | { screen: 'contact' };

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
        <div
          key='globe'
          className='fixed inset-0 animate-in fade-in duration-300'
        >
          <GlobeView
            onLocationClick={handleLocationClick}
            restorePov={view.returnPov}
          />
          <SiteHeader />
          {showGuide && <GuideOverlay onDismiss={dismissGuide} />}
          {!showGuide && (
            <SiteFooter
              onPrivacy={() => setView({ screen: 'privacy' })}
              onContact={() => setView({ screen: 'contact' })}
            />
          )}
        </div>
      )}
      {view.screen === 'map' && (
        <div
          key='map'
          className='fixed inset-0 animate-in fade-in duration-300'
        >
          <MapView target={view.target} />
          <BackButton onClick={handleBack} />
        </div>
      )}
      {view.screen === 'privacy' && (
        <div
          key='privacy'
          className='fixed inset-0 animate-in fade-in duration-300'
        >
          <PrivacyView
            onBack={() => setView({ screen: 'globe' })}
            onContact={() => setView({ screen: 'contact' })}
          />
        </div>
      )}
      {view.screen === 'contact' && (
        <div
          key='contact'
          className='fixed inset-0 animate-in fade-in duration-300'
        >
          <ContactView onBack={() => setView({ screen: 'globe' })} />
        </div>
      )}
    </>
  );
}

export default App;
