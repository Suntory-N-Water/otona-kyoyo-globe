/**
 * Step 3: 地名から座標(lat/lng)を取得する
 *
 * LLM座標をプライマリとし、Nominatim → Google Places API をフォールバックに使用。
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  EXTRACTED_LOCATIONS_PATH,
  GEOCODE_CACHE_PATH,
  GEOCODED_LOCATIONS_PATH,
  GOOGLE_API_KEY,
  NOMINATIM_RATE_LIMIT_MS,
  NOMINATIM_USER_AGENT,
  REGISTRY_DIR,
} from './config.ts';

type GeoResult = {
  lat: number;
  lng: number;
  source: string;
};

type GeocodeCacheEntry = { lat: number; lng: number; source: string };
type GeocodeCache = Record<string, GeocodeCacheEntry>;

type ExtractedLocation = {
  name: string;
  region: string;
  lat: number | null;
  lng: number | null;
};

type ExtractedVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  extractedLocations: ExtractedLocation[];
};

// メモリキャッシュ(同一地名の重複リクエスト回避)
const geocodeCache = new Map<string, GeoResult | null>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Nominatim API で地名を検索する */
async function queryNominatim(
  query: string,
  lang: string,
): Promise<GeoResult | null> {
  await sleep(NOMINATIM_RATE_LIMIT_MS);

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    'accept-language': lang,
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
    return {
      lat: Number.parseFloat(result.lat),
      lng: Number.parseFloat(result.lon),
      source: 'nominatim',
    };
  }
  return null;
}

/** Nominatim で日本語→英語の順にリトライする */
async function geocodeNominatim(
  name: string,
  region: string,
): Promise<GeoResult | null> {
  const cacheKey = `nominatim|${name}|${region}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    // 日本語クエリで検索
    const jaQuery = region ? `${name} ${region}` : name;
    const jaResult = await queryNominatim(jaQuery, 'ja');
    if (jaResult) {
      geocodeCache.set(cacheKey, jaResult);
      return jaResult;
    }

    // 日本語で見つからなければ英語クエリでリトライ(サラエボ→Sarajevo 等)
    console.log(`[geocode] Nominatim英語リトライ: ${name}`);
    const enQuery = region ? `${name} ${region}` : name;
    const enResult = await queryNominatim(enQuery, 'en');
    if (enResult) {
      geocodeCache.set(cacheKey, enResult);
      return enResult;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[geocode] Nominatimエラー: ${name} - ${msg}`);
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

/** Google Places API (Text Search) で地名を検索する */
async function geocodeGooglePlaces(
  name: string,
  region: string,
): Promise<GeoResult | null> {
  if (!GOOGLE_API_KEY) {
    return null;
  }

  try {
    const query = region ? `${name} ${region}` : name;
    const params = new URLSearchParams({
      query,
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
      return {
        lat: location.lat,
        lng: location.lng,
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
async function geocodeFallback(
  name: string,
  region: string,
): Promise<GeoResult | null> {
  const result = await geocodeNominatim(name, region);
  if (result) {
    return result;
  }

  console.log(`[geocode] フォールバック→Google Places: ${name}`);
  return geocodeGooglePlaces(name, region);
}

/**
 * LLM座標をプライマリとし、なければ Nominatim/Places にフォールバックする。
 * 永続キャッシュにヒットした場合は外部APIリクエスト不要。
 */
async function geocode(
  loc: ExtractedLocation,
  persistentCache: GeocodeCache,
): Promise<GeoResult | null> {
  const cacheKey = `${loc.name}|${loc.region}`;

  // 永続キャッシュヒット → 外部APIリクエスト不要
  const cached = persistentCache[cacheKey];
  if (cached) {
    return { lat: cached.lat, lng: cached.lng, source: cached.source };
  }

  // LLM座標がある場合はそのまま採用
  if (loc.lat !== null && loc.lng !== null) {
    return { lat: loc.lat, lng: loc.lng, source: 'llm' };
  }

  // LLM座標がない場合はフォールバック
  return geocodeFallback(loc.name, loc.region);
}

async function main() {
  const force = process.argv.includes('--force');

  if (!existsSync(EXTRACTED_LOCATIONS_PATH)) {
    console.error(`エラー: ${EXTRACTED_LOCATIONS_PATH} が見つかりません`);
    console.error('先に extract-locations.ts を実行してください');
    process.exit(1);
  }

  await mkdir(REGISTRY_DIR, { recursive: true });

  // 永続キャッシュ読み込み
  const persistentCache: GeocodeCache = existsSync(GEOCODE_CACHE_PATH)
    ? JSON.parse(await readFile(GEOCODE_CACHE_PATH, 'utf-8'))
    : {};

  const videos: ExtractedVideo[] = JSON.parse(
    await readFile(EXTRACTED_LOCATIONS_PATH, 'utf-8'),
  );

  if (videos.length === 0) {
    console.log('[geocode] 処理対象の動画なし');
    await writeFile(GEOCODED_LOCATIONS_PATH, '[]', 'utf-8');
    return;
  }

  // 既存データを先に読み込む(スキップ判定 + 後続マージで使い回す)
  const existingData: {
    videoId: string;
    title: string;
    thumbnailUrl: string;
    publishedAt: string;
    viewCount: number;
    locations: { id: string; name: string; lat: number; lng: number }[];
  }[] = existsSync(GEOCODED_LOCATIONS_PATH)
    ? JSON.parse(await readFile(GEOCODED_LOCATIONS_PATH, 'utf-8'))
    : [];
  const processedIds = new Set(existingData.map((v) => v.videoId));

  // 処理済み videoId はスキップ(--force で強制再処理)
  const targetVideos = force
    ? videos
    : videos.filter((v) => {
        if (processedIds.has(v.videoId)) {
          console.log(`[geocode] スキップ(処理済み): ${v.videoId}`);
          return false;
        }
        return true;
      });

  if (targetVideos.length === 0) {
    console.log('[geocode] 全件スキップ。新規動画なし');
    return;
  }

  // name+region ペアでユニーク化し、LLM座標も保持
  const locEntries = new Map<string, ExtractedLocation>();
  for (const video of targetVideos) {
    for (const loc of video.extractedLocations ?? []) {
      const key = `${loc.name}|${loc.region}`;
      if (!locEntries.has(key)) {
        locEntries.set(key, loc);
      }
    }
  }

  const sortedEntries = [...locEntries.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  console.log(`[geocode] ユニーク地名: ${sortedEntries.length}件`);

  const geocodedMap = new Map<string, GeoResult | null>();
  for (let i = 0; i < sortedEntries.length; i++) {
    const loc = sortedEntries[i];
    const key = `${loc.name}|${loc.region}`;
    const result = await geocode(loc, persistentCache);
    geocodedMap.set(key, result);
    const label = loc.region ? `${loc.name}(${loc.region})` : loc.name;
    if (result) {
      console.log(
        `[geocode] ${i + 1}/${sortedEntries.length}: ${label} → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}) [${result.source}]`,
      );
    } else {
      console.log(
        `[geocode] ${i + 1}/${sortedEntries.length}: ${label} → 見つからず`,
      );
    }
  }

  // 永続キャッシュを更新・保存
  for (const [key, result] of geocodedMap) {
    if (result) {
      persistentCache[key] = {
        lat: result.lat,
        lng: result.lng,
        source: result.source,
      };
    }
  }
  await writeFile(
    GEOCODE_CACHE_PATH,
    JSON.stringify(persistentCache, null, 2),
    'utf-8',
  );
  console.log(
    `[geocode] キャッシュ保存: ${Object.keys(persistentCache).length}件 → ${GEOCODE_CACHE_PATH}`,
  );

  // 動画データに座標を付与
  const results = targetVideos.map((video) => {
    const locations = (video.extractedLocations ?? [])
      .map((loc, j) => {
        const key = `${loc.name}|${loc.region}`;
        const geo = geocodedMap.get(key);
        if (!geo) {
          return null;
        }

        return {
          id: `${video.videoId}-${j}`,
          name: loc.name,
          lat: geo.lat,
          lng: geo.lng,
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

  // 既存データとマージ(同一 videoId は上書き更新)
  const videoMap = new Map(existingData.map((v) => [v.videoId, v]));
  for (const video of results) {
    videoMap.set(video.videoId, video);
  }
  const merged = [...videoMap.values()].sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  );

  await writeFile(
    GEOCODED_LOCATIONS_PATH,
    JSON.stringify(merged, null, 2),
    'utf-8',
  );

  const total = results.reduce((sum, v) => sum + v.locations.length, 0);
  const sourceCount = { llm: 0, nominatim: 0, google_places: 0 };
  for (const geo of geocodedMap.values()) {
    if (geo) {
      const key = geo.source as keyof typeof sourceCount;
      if (key in sourceCount) {
        sourceCount[key]++;
      }
    }
  }
  console.log(
    `[geocode] 完了: ${total}件 (LLM=${sourceCount.llm}, Nominatim=${sourceCount.nominatim}, Places=${sourceCount.google_places}) → ${GEOCODED_LOCATIONS_PATH}`,
  );
}

void main();
