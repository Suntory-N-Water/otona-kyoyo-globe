/**
 * Step 3: 地名から座標(lat/lng)を取得する
 *
 * Nominatim → Google Places API のフォールバック構成。
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  CONFIDENCE_THRESHOLD,
  EXTRACTED_LOCATIONS_PATH,
  GEOCODED_LOCATIONS_PATH,
  GOOGLE_API_KEY,
  NOMINATIM_RATE_LIMIT_MS,
  NOMINATIM_USER_AGENT,
  TMP_DIR,
} from './config.ts';

type GeoResult = {
  lat: number;
  lng: number;
  confidenceScore: number;
  source: string;
};

type ExtractedVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  extractedLocations: { name: string; context: string }[];
};

// メモリキャッシュ(同一地名の重複リクエスト回避)
const geocodeCache = new Map<string, GeoResult | null>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Nominatim API で地名を検索する */
async function geocodeNominatim(name: string): Promise<GeoResult | null> {
  if (geocodeCache.has(name)) {
    return geocodeCache.get(name) ?? null;
  }

  await sleep(NOMINATIM_RATE_LIMIT_MS);

  try {
    const params = new URLSearchParams({
      q: name,
      format: 'json',
      limit: '1',
      'accept-language': 'ja',
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { 'User-Agent': NOMINATIM_USER_AGENT },
        signal: AbortSignal.timeout(10 * 1000),
      },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const results = await res.json();
    if (results.length > 0) {
      const result = results[0];
      const importance = Number.parseFloat(result.importance ?? '0.5');
      const geocoded: GeoResult = {
        lat: Number.parseFloat(result.lat),
        lng: Number.parseFloat(result.lon),
        confidenceScore:
          Math.round(Math.min(importance + 0.2, 1.0) * 100) / 100,
        source: 'nominatim',
      };
      geocodeCache.set(name, geocoded);
      return geocoded;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[geocode] Nominatimエラー: ${name} - ${msg}`);
  }

  geocodeCache.set(name, null);
  return null;
}

/** Google Places API (Text Search) で地名を検索する */
async function geocodeGooglePlaces(name: string): Promise<GeoResult | null> {
  if (!GOOGLE_API_KEY) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      query: name,
      key: GOOGLE_API_KEY,
      language: 'ja',
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
      { signal: AbortSignal.timeout(10 * 1000) },
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = data.results ?? [];
    if (results.length > 0) {
      const result = results[0];
      const location = result.geometry.location;

      // types による信頼度調整
      const types = new Set<string>(result.types ?? []);
      const highConfidenceTypes = new Set([
        'country',
        'administrative_area_level_1',
        'locality',
        'natural_feature',
        'point_of_interest',
        'tourist_attraction',
      ]);

      const typeMatch = [...types].some((t) => highConfidenceTypes.has(t));
      const score = typeMatch ? 0.85 : 0.7;

      return {
        lat: location.lat,
        lng: location.lng,
        confidenceScore: score,
        source: 'google_places',
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[geocode] Google Placesエラー: ${name} - ${msg}`);
  }

  return null;
}

/** Nominatim → Google Places のフォールバックでジオコーディングする */
async function geocode(name: string): Promise<GeoResult | null> {
  const result = await geocodeNominatim(name);
  if (result) {
    return result;
  }

  console.log(`[geocode] フォールバック→Google Places: ${name}`);
  return geocodeGooglePlaces(name);
}

async function main() {
  if (!existsSync(EXTRACTED_LOCATIONS_PATH)) {
    console.error(`エラー: ${EXTRACTED_LOCATIONS_PATH} が見つかりません`);
    console.error('先に extract-locations.ts を実行してください');
    process.exit(1);
  }

  await mkdir(TMP_DIR, { recursive: true });

  const videos: ExtractedVideo[] = JSON.parse(
    await readFile(EXTRACTED_LOCATIONS_PATH, 'utf-8'),
  );

  if (videos.length === 0) {
    console.log('[geocode] 処理対象の動画なし');
    await writeFile(GEOCODED_LOCATIONS_PATH, '[]', 'utf-8');
    return;
  }

  const allNames = new Set<string>();
  for (const video of videos) {
    for (const loc of video.extractedLocations ?? []) {
      allNames.add(loc.name);
    }
  }

  const sortedNames = [...allNames].sort();
  console.log(`[geocode] ユニーク地名: ${sortedNames.length}件`);

  const geocodedMap = new Map<string, GeoResult | null>();
  for (let i = 0; i < sortedNames.length; i++) {
    const name = sortedNames[i];
    const result = await geocode(name);
    geocodedMap.set(name, result);
    if (result) {
      console.log(
        `[geocode] ${i + 1}/${sortedNames.length}: ${name} → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}) [${result.source}]`,
      );
    } else {
      console.log(
        `[geocode] ${i + 1}/${sortedNames.length}: ${name} → 見つからず`,
      );
    }
  }

  // 動画データに座標を付与
  const results = videos.map((video) => {
    const locations = (video.extractedLocations ?? [])
      .map((loc, j) => {
        const geo = geocodedMap.get(loc.name);
        if (!geo) {
          return null;
        }

        return {
          id: `${video.videoId}-${j}`,
          name: loc.name,
          lat: geo.lat,
          lng: geo.lng,
          confidenceScore: geo.confidenceScore,
          needsReview: geo.confidenceScore < CONFIDENCE_THRESHOLD,
        };
      })
      .filter((loc) => loc !== null);

    return {
      videoId: video.videoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      locations,
    };
  });

  await writeFile(
    GEOCODED_LOCATIONS_PATH,
    JSON.stringify(results, null, 2),
    'utf-8',
  );

  const total = results.reduce((sum, v) => sum + v.locations.length, 0);
  const reviewCount = results.reduce(
    (sum, v) => sum + v.locations.filter((l) => l.needsReview).length,
    0,
  );
  console.log(
    `[geocode] 完了: ${total}件(要レビュー${reviewCount}件) → ${GEOCODED_LOCATIONS_PATH}`,
  );
}

void main();
