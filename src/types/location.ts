export type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  confidenceScore: number;
  needsReview: boolean;
};

export type Video = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  locations: Location[];
};

export type LocationsData = {
  generatedAt: string;
  videos: Video[];
};

// 同一地名でグルーピングされたデータ
export type LocationGroup = {
  name: string;
  lat: number;
  lng: number;
  videos: Video[];
};
