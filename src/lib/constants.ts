// 糸島市(チャンネル拠点)の座標 - 初期カメラ位置
export const ITOSHIMA = {
  lat: 33.5563,
  lng: 130.1986,
  altitude: 2.5,
} as const;

// 地球儀テクスチャURL(NASA提供)
export const GLOBE_TEXTURES = {
  globe: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  bump: '//unpkg.com/three-globe/example/img/earth-topology.png',
  background: '//unpkg.com/three-globe/example/img/night-sky.png',
} as const;

// 大気の色
export const ATMOSPHERE_COLOR = '#3a82f7';

// カメラ遷移アニメーション時間(ms)
export const CAMERA_TRANSITION_MS = 1200;

// チャンネル情報
export const CHANNEL_URL = 'https://www.youtube.com/@donttellmearai' as const;
