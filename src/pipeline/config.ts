/** パイプライン共通設定 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ディレクトリ
const PIPELINE_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(PIPELINE_DIR, '../..');
export const REGISTRY_DIR = resolve(PIPELINE_DIR, 'registry');
export const OUTPUT_PATH = resolve(PROJECT_ROOT, 'src/data/locations.json');

// 中間ファイル
export const NEW_VIDEOS_PATH = resolve(REGISTRY_DIR, 'new_videos.json');
export const EXTRACTED_LOCATIONS_PATH = resolve(
  REGISTRY_DIR,
  'extracted_locations.json',
);
export const GEOCODED_LOCATIONS_PATH = resolve(
  REGISTRY_DIR,
  'geocoded_locations.json',
);
export const GEOCODE_CACHE_PATH = resolve(REGISTRY_DIR, 'geocode_cache.json');

// YouTube
export const TRANSCRIPT_MAX_CHARS = 5000;

// ジオコーディング
export const NOMINATIM_USER_AGENT = 'otona-kyoyo-globe/1.0';
export const NOMINATIM_RATE_LIMIT_MS = 1000;
// API キー
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
