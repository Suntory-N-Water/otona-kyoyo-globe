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

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { GOOGLE_API_KEY, NEW_VIDEOS_PATH, TMP_DIR } from './config.ts';

type VideoMeta = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  transcript: string | null;
};

/** URLまたは動画IDから動画IDを抽出する */
function parseVideoId(urlOrId: string): string {
  // youtube.com/watch?v=ID 形式
  const watchMatch = urlOrId.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return watchMatch[1];
  }

  // youtu.be/ID 形式
  const shortMatch = urlOrId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return shortMatch[1];
  }

  // そのままIDとして扱う
  const stripped = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(stripped)) {
    return stripped;
  }

  console.error(`エラー: 動画IDを認識できません: ${urlOrId}`);
  process.exit(1);
}

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
  const args = process.argv.slice(2);
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

  await mkdir(TMP_DIR, { recursive: true });

  const videoIds = args.map(parseVideoId);
  console.log(`[fetch] 対象動画: ${videoIds.join(', ')}`);

  const videos = await fetchVideoDetails(videoIds);
  if (videos.length === 0) {
    console.error('[fetch] エラー: 動画が見つかりません');
    process.exit(1);
  }
  console.log(`[fetch] メタデータ取得: ${videos.length}本`);

  const transcripts = await fetchTranscripts(videoIds);

  const results: VideoMeta[] = videos.map((video) => ({
    ...video,
    transcript: transcripts.get(video.videoId) ?? null,
  }));

  await writeFile(NEW_VIDEOS_PATH, JSON.stringify(results, null, 2), 'utf-8');

  const transcriptCount = results.filter((v) => v.transcript).length;
  console.log(
    `[fetch] 完了: ${transcriptCount}/${results.length}本の字幕を取得 → ${NEW_VIDEOS_PATH}`,
  );
}

void main();
