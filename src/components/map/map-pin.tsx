import L from 'leaflet';
import { useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { LocationGroup } from '@/types/location';

// アンバーカラーのピンアイコン
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:rgba(245,158,11,0.9);border:2px solid white;box-shadow:0 0 8px rgba(245,158,11,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type MapPinProps = {
  group: LocationGroup;
};

export function MapPin({ group }: MapPinProps) {
  const markerRef = useRef<L.Marker>(null);

  return (
    <Marker
      ref={markerRef}
      position={[group.lat, group.lng]}
      icon={pinIcon}
      eventHandlers={{
        mouseover: () => markerRef.current?.openPopup(),
      }}
    >
      <Popup maxWidth={320} minWidth={280}>
        <div>
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {group.name}
            <span
              style={{
                marginLeft: '8px',
                fontSize: '12px',
                opacity: 0.7,
                fontWeight: 'normal',
              }}
            >
              {group.videos.length}本
            </span>
          </h3>
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {group.videos.map((video) => (
              <a
                key={video.videoId}
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target='_blank'
                rel='noopener noreferrer'
                style={{
                  display: 'flex',
                  gap: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: '8px',
                  padding: '4px',
                  transition: 'background 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <img
                  src={video.thumbnailUrl}
                  alt=''
                  style={{
                    width: '100px',
                    height: '56px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                  loading='lazy'
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {video.title}
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '11px',
                      opacity: 0.6,
                    }}
                  >
                    {video.viewCount >= 10000
                      ? `${(video.viewCount / 10000).toFixed(1)}万回`
                      : `${video.viewCount.toLocaleString()}回`}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
