/**
 * Step 1: 指定した動画のメタデータと字幕を取得する
 *
 * 使い方:
 *   bun run src/pipeline/fetch-videos.ts VIDEO_ID_OR_URL [VIDEO_ID_OR_URL ...]
 *
 * 例:
 *   bun run src/pipeline/fetch-videos.ts clFtrDq0FoA
 *   bun run src/pipeline/fetch-videos.ts "https://www.youtube.com/watch?v=clFtrDq0FoA"
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { GOOGLE_API_KEY, NEW_VIDEOS_PATH, REGISTRY_DIR } from './config.ts';
import { parseVideoId } from './youtube.ts';

type VideoMeta = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  transcript: string | null;
};

/** YouTube Data API v3 で動画メタデータを一括取得する(50件ずつ) */
async function fetchVideoDetails(
  videoIds: string[],
): Promise<Omit<VideoMeta, 'transcript'>[]> {
  const videos: Omit<VideoMeta, 'transcript'>[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: chunk.join(','),
      key: GOOGLE_API_KEY,
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );
    if (!res.ok) {
      throw new Error(
        `YouTube Data API エラー: ${res.status} ${res.statusText}`,
      );
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      const stats = item.statistics ?? {};
      videos.push({
        videoId: item.id,
        title: snippet.title,
        thumbnailUrl: snippet.thumbnails?.medium?.url ?? '',
        publishedAt: snippet.publishedAt,
        viewCount: Number(stats.viewCount ?? 0),
      });
    }
  }

  return videos;
}

/** 自動字幕のノイズを除去する */
function cleanTranscript(raw: string): string {
  let text = raw;
  // NFKC 正規化(全角英数→半角、合字分解など)
  text = text.normalize('NFKC');
  // [音楽] [拍手] 等の自動生成タグを除去
  text = text.replace(/\[.+?\]/g, '');
  // 自動字幕の不自然なスペース(日本語文中)を除去、英数字間のスペースは保持
  text = text.replace(/([^\x20-\x7E])\s+([^\x20-\x7E])/g, '$1$2');
  // 連続スペースを1つに
  text = text.replace(/ {2,}/g, ' ');
  return text.trim();
}

/** Noteey を Playwright でスクレイピングして字幕テキストを取得する */
async function fetchTranscripts(
  videoIds: string[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    for (const videoId of videoIds) {
      try {
        await page.goto('https://www.noteey.com/ja/youtube-to-transcript', {
          waitUntil: 'load',
        });

        // URL入力
        await page
          .getByPlaceholder('YouTubeのURLを入力')
          .fill(`https://www.youtube.com/watch?v=${videoId}`);

        // 「文字起こしを取得」ボタンをクリック
        await page.getByRole('button', { name: '文字起こしを取得' }).click();

        // 最初のトランスクリプトアイテムが表示されるまで auto-wait
        const transcriptItems = page.locator(
          '.desktop-transcript-container .transcript-item',
        );
        await transcriptItems.first().waitFor({ timeout: 30_000 });

        // 各アイテムの2番目の div(テキスト本文)を抽出してクリーニング
        const segments = await transcriptItems
          .locator('div:nth-child(2)')
          .allTextContents();
        const text = cleanTranscript(
          segments
            .map((t) => t.trim())
            .filter(Boolean)
            .join(' '),
        );

        if (text) {
          results.set(videoId, text);
          console.log(`[fetch] 字幕OK: ${videoId} (${text.length}文字)`);
        } else {
          results.set(videoId, null);
          console.log(`[fetch] 字幕なし: ${videoId}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[fetch] 字幕取得失敗: ${videoId} - ${msg}`);
        results.set(videoId, null);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes('--force');
  const args = rawArgs.filter((a) => a !== '--force');

  if (args.length === 0) {
    console.error(
      '使い方: bun run src/pipeline/fetch-videos.ts VIDEO_ID_OR_URL [...]',
    );
    process.exit(1);
  }

  if (!GOOGLE_API_KEY) {
    console.error('エラー: GOOGLE_API_KEY が設定されていません');
    process.exit(1);
  }

  await mkdir(REGISTRY_DIR, { recursive: true });

  const videoIds = args.map(parseVideoId);
  console.log(`[fetch] 対象動画: ${videoIds.join(', ')}`);

  // 既存データを先に読み込む(スキップ判定 + 後続マージで使い回す)
  const existing: VideoMeta[] = existsSync(NEW_VIDEOS_PATH)
    ? JSON.parse(await readFile(NEW_VIDEOS_PATH, 'utf-8'))
    : [];
  const existingIds = new Set(existing.map((v) => v.videoId));

  // 処理済み videoId はスキップ(--force で強制再処理)
  const targetIds = force
    ? videoIds
    : videoIds.filter((id) => {
        if (existingIds.has(id)) {
          console.log(`[fetch] スキップ(処理済み): ${id}`);
          return false;
        }
        return true;
      });

  if (targetIds.length === 0) {
    console.log('[fetch] 全件スキップ。新規動画なし');
    return;
  }

  const videos = await fetchVideoDetails(targetIds);
  if (videos.length === 0) {
    console.error('[fetch] エラー: 動画が見つかりません');
    process.exit(1);
  }
  console.log(`[fetch] メタデータ取得: ${videos.length}本`);

  const transcripts = await fetchTranscripts(targetIds);

  const results: VideoMeta[] = videos.map((video) => ({
    ...video,
    transcript: transcripts.get(video.videoId) ?? null,
  }));

  // 既存データとマージ(同一 videoId は上書き更新)
  const videoMap = new Map(existing.map((v) => [v.videoId, v]));
  for (const video of results) {
    videoMap.set(video.videoId, video);
  }
  const merged = [...videoMap.values()].sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  );

  await writeFile(NEW_VIDEOS_PATH, JSON.stringify(merged, null, 2), 'utf-8');

  const transcriptCount = results.filter((v) => v.transcript).length;
  console.log(
    `[fetch] 完了: ${transcriptCount}/${results.length}本の字幕を取得 → ${NEW_VIDEOS_PATH} (累計${merged.length}本)`,
  );
}

void main();
