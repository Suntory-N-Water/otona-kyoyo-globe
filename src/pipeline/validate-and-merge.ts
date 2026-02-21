/** Step 4: バリデーション + 既存データとマージ + JSON出力 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GEOCODED_LOCATIONS_PATH, OUTPUT_PATH, TMP_DIR } from './config.ts';

type LocationData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  confidenceScore: number;
  needsReview: boolean;
};

type VideoData = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  locations: LocationData[];
};

type LocationsFile = {
  generatedAt: string;
  videos: VideoData[];
};

/** 動画データのバリデーション。エラーがなければ VideoData として安全。 */
function validateVideo(video: VideoData): string[] {
  const errors: string[] = [];
  const vid = video.videoId || 'unknown';

  for (let i = 0; i < video.locations.length; i++) {
    const loc = video.locations[i];
    if (loc.lat < -90 || loc.lat > 90) {
      errors.push(`[${vid}] locations[${i}] lat が範囲外: ${loc.lat}`);
    }
    if (loc.lng < -180 || loc.lng > 180) {
      errors.push(`[${vid}] locations[${i}] lng が範囲外: ${loc.lng}`);
    }
    if (loc.confidenceScore < 0 || loc.confidenceScore > 1) {
      errors.push(
        `[${vid}] locations[${i}] confidenceScore が範囲外: ${loc.confidenceScore}`,
      );
    }
  }

  return errors;
}

/** 既存の locations.json を読み込む */
async function loadExisting(): Promise<LocationsFile> {
  if (!existsSync(OUTPUT_PATH)) {
    return { generatedAt: '', videos: [] };
  }
  return JSON.parse(await readFile(OUTPUT_PATH, 'utf-8'));
}

/** 新規動画データを既存データにマージする */
function merge(existing: LocationsFile, newVideos: VideoData[]): LocationsFile {
  // 既存データを videoId でインデックス化
  const videoMap = new Map<string, VideoData>();
  for (const video of existing.videos) {
    videoMap.set(video.videoId, video);
  }

  // 新規データをマージ(既存動画は viewCount を更新)
  for (const video of newVideos) {
    const existingVideo = videoMap.get(video.videoId);
    if (existingVideo) {
      existingVideo.viewCount = video.viewCount;
    } else {
      videoMap.set(video.videoId, video);
    }
  }

  // publishedAt で降順ソート
  const sortedVideos = [...videoMap.values()].sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  );

  return {
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    videos: sortedVideos,
  };
}

async function main() {
  if (!existsSync(GEOCODED_LOCATIONS_PATH)) {
    console.error(`エラー: ${GEOCODED_LOCATIONS_PATH} が見つかりません`);
    console.error('先に geocode.ts を実行してください');
    process.exit(1);
  }

  await mkdir(TMP_DIR, { recursive: true });

  const newVideos: VideoData[] = JSON.parse(
    await readFile(GEOCODED_LOCATIONS_PATH, 'utf-8'),
  );

  const allErrors: string[] = [];
  const validVideos: VideoData[] = [];

  for (const video of newVideos) {
    const errors = validateVideo(video);
    if (errors.length > 0) {
      allErrors.push(...errors);
      for (const err of errors) {
        console.error(`[validate] ${err}`);
      }
    } else {
      validVideos.push(video);
    }
  }

  console.log(
    `[validate] バリデーション: ${validVideos.length}/${newVideos.length}本OK, ${allErrors.length}件エラー`,
  );

  if (validVideos.length === 0) {
    console.error('[validate] エラー: 有効な動画が0件');
    process.exit(1);
  }

  const existing = await loadExisting();
  const existingCount = existing.videos.length;
  const result = merge(existing, validVideos);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');

  const newCount = result.videos.length;
  const totalLocations = result.videos.reduce(
    (sum, v) => sum + v.locations.length,
    0,
  );
  console.log(
    `[validate] 完了: ${existingCount}→${newCount}本, ${totalLocations}件のロケ地 → ${OUTPUT_PATH}`,
  );
}

void main();
