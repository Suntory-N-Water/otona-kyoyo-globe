import L from 'leaflet';
import { useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { LocationGroup } from '@/types/location';

// アンバーカラーのピンアイコン(ティアドロップ型)
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,rgba(251,191,36,0.95),rgba(245,158,11,0.9));border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 8px rgba(245,158,11,0.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 14],
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
      <Popup maxWidth={300} minWidth={220}>
        <div>
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'white',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            {group.name}
          </h3>
          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
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
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <img
                  src={video.thumbnailUrl}
                  alt=''
                  style={{
                    width: '88px',
                    height: '50px',
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
                      lineHeight: 1.4,
                      color: 'white',
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
                      margin: '3px 0 0',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.7)',
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
