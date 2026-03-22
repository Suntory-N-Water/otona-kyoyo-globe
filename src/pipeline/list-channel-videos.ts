/**
 * チャンネルの全動画を取得し、ロケ動画候補を出力する
 *
 * 使い方:
 *   bun run src/pipeline/list-channel-videos.ts
 *
 * 出力:
 *   src/pipeline/registry/channel_videos.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { GOOGLE_API_KEY, REGISTRY_DIR } from './config.ts';

const CHANNEL_HANDLE = 'donttellmearai';

/** ロケ動画っぽいタイトルキーワード */
const LOCALE_KEYWORDS = ['ロケ', '現地'];

export type ChannelVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  url: string;
  isLocaleCandidate: boolean;
};

/** チャンネルハンドルからチャンネルIDとアップロード用プレイリストIDを取得する */
async function fetchChannelInfo(
  handle: string,
): Promise<{ channelId: string; uploadsPlaylistId: string }> {
  const params = new URLSearchParams({
    part: 'contentDetails',
    forHandle: handle,
    key: GOOGLE_API_KEY,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`,
  );
  if (!res.ok) {
    throw new Error(`チャンネル情報取得失敗: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error(`チャンネルが見つかりません: @${handle}`);
  }

  const uploadsPlaylistId =
    item.contentDetails?.relatedPlaylists?.uploads ?? '';
  if (!uploadsPlaylistId) {
    throw new Error('アップロードプレイリストIDが取得できません');
  }

  console.log(`[list] チャンネルID: ${item.id}`);
  console.log(`[list] アップロードプレイリスト: ${uploadsPlaylistId}`);

  return { channelId: item.id, uploadsPlaylistId };
}

/** プレイリストから全動画IDを取得する(ページネーション対応) */
async function fetchAllVideoIds(playlistId: string): Promise<string[]> {
  const videoIds: string[] = [];
  let pageToken: string | undefined;
  let page = 1;

  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      key: GOOGLE_API_KEY,
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
    );
    if (!res.ok) {
      throw new Error(
        `プレイリスト取得失敗(ページ${page}): ${res.status} ${res.statusText}`,
      );
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) {
        videoIds.push(id);
      }
    }

    pageToken = data.nextPageToken;
    console.log(
      `[list] プレイリスト取得: ページ${page} (累計${videoIds.length}件)`,
    );
    page++;
  } while (pageToken);

  return videoIds;
}

/** ISO 8601 duration (PT1H2M3S) を秒数に変換する */
function parseIsoDuration(duration: string): number {
  const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) {
    return 0;
  }
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** 動画IDのリストからメタデータを一括取得する(50件ずつ) */
async function fetchVideoDetails(
  videoIds: string[],
): Promise<Omit<ChannelVideo, 'isLocaleCandidate'>[]> {
  const videos: Omit<ChannelVideo, 'isLocaleCandidate'>[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: chunk.join(','),
      key: GOOGLE_API_KEY,
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
    );
    if (!res.ok) {
      throw new Error(`動画詳細取得失敗: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      // 3分未満はShortsまたは短い告知動画として除外
      const durationSec = parseIsoDuration(item.contentDetails?.duration ?? '');
      if (durationSec < 180) {
        continue;
      }
      videos.push({
        videoId: item.id,
        title: snippet.title,
        publishedAt: snippet.publishedAt,
        thumbnailUrl: snippet.thumbnails?.medium?.url ?? '',
        url: `https://www.youtube.com/watch?v=${item.id}`,
      });
    }
  }

  return videos;
}

/** タイトルからロケ動画候補かどうか判定する */
function isLocaleCandidate(title: string): boolean {
  return LOCALE_KEYWORDS.some((kw) => title.includes(kw));
}

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('エラー: GOOGLE_API_KEY が設定されていません');
    process.exit(1);
  }

  await mkdir(REGISTRY_DIR, { recursive: true });

  console.log(`[list] チャンネル @${CHANNEL_HANDLE} の動画一覧を取得中...`);

  const { uploadsPlaylistId } = await fetchChannelInfo(CHANNEL_HANDLE);
  const videoIds = await fetchAllVideoIds(uploadsPlaylistId);
  console.log(`[list] 合計 ${videoIds.length} 件の動画IDを取得`);

  const details = await fetchVideoDetails(videoIds);
  console.log(`[list] メタデータ取得: ${details.length} 本 (Shorts除外済み)`);

  const videos: ChannelVideo[] = details
    .map((v) => ({
      ...v,
      isLocaleCandidate: isLocaleCandidate(v.title),
    }))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const outputPath = `${REGISTRY_DIR}/channel_videos.json`;
  await writeFile(outputPath, JSON.stringify(videos, null, 2), 'utf-8');

  const candidateCount = videos.filter((v) => v.isLocaleCandidate).length;
  console.log(`\n[list] 完了: ${videos.length} 本 → ${outputPath}`);
  console.log(
    `[list] ロケ動画候補: ${candidateCount} 本 / ${videos.length} 本`,
  );

  // コンソールにも候補一覧を表示
  console.log('\n--- ロケ動画候補 (isLocaleCandidate=true) ---');
  for (const v of videos.filter((v) => v.isLocaleCandidate)) {
    console.log(`  ${v.publishedAt.slice(0, 10)}  ${v.videoId}  ${v.title}`);
  }
  console.log('\n--- ロケ動画候補外 ---');
  for (const v of videos.filter((v) => !v.isLocaleCandidate)) {
    console.log(`  ${v.publishedAt.slice(0, 10)}  ${v.videoId}  ${v.title}`);
  }
}

void main();
