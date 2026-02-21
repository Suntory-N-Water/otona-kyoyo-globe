/**
 * Step 2: LLM API で字幕・タイトルから地名を抽出する
 *
 * LLM プロバイダーは未選定。callLlm() を実装してから使用する。
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  EXTRACTED_LOCATIONS_PATH,
  NEW_VIDEOS_PATH,
  TMP_DIR,
} from './config.ts';

const SYSTEM_PROMPT = `あなたは地名抽出の専門家です。
YouTubeの動画タイトルと字幕テキストから、動画で訪問・紹介されている地名を抽出してください。

ルール:
- 国名、都市名、遺跡名、建造物名、自然地名(山、川、湖など)を抽出する
- 一般的な名詞(「駅」「空港」単体など)は除外する
- 同じ場所の別表記は日本語の正式名称に統一する(例: Belgrade → ベオグラード)
- 地名ごとに、情報源(タイトル/字幕)を記載する
- 確信度が低い地名も含めてよいが、context にその旨を記載する

出力は以下のJSON配列のみを返してください(説明文不要):
[
  {"name": "正式地名", "context": "タイトルに記載 / 字幕で○○の文脈で言及"}
]

地名が見つからない場合は空配列 [] を返してください。`;

type VideoInput = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  transcript: string | null;
};

type ExtractedLocation = {
  name: string;
  context: string;
};

/** 動画情報からユーザープロンプトを構築する */
function buildUserPrompt(video: VideoInput): string {
  const parts = [`タイトル: ${video.title}`];
  if (video.transcript) {
    parts.push(`\n字幕テキスト:\n${video.transcript}`);
  } else {
    parts.push('\n(字幕なし。タイトルのみで判断してください)');
  }
  return parts.join('\n');
}

/** LLM API を呼び出して地名を抽出する。TODO: LLM プロバイダー選定後に実装する。 */
function callLlm(_systemPrompt: string, _userPrompt: string): Promise<string> {
  throw new Error(
    'LLM プロバイダーが未選定です。callLlm() を実装してください。',
  );
}

/** LLMの応答からJSON配列を抽出する */
function parseJsonResponse(text: string): ExtractedLocation[] {
  let cleaned = text.trim();

  // コードブロックで囲まれている場合を処理
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .split('\n')
      .filter((line) => !line.trim().startsWith('```'))
      .join('\n');
  }

  try {
    const result = JSON.parse(cleaned);
    return Array.isArray(result) ? result : [];
  } catch {
    // JSON部分だけ抽出を試みる
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // パース失敗
      }
    }
    return [];
  }
}

async function main() {
  if (!existsSync(NEW_VIDEOS_PATH)) {
    console.error(`エラー: ${NEW_VIDEOS_PATH} が見つかりません`);
    console.error('先に fetch-videos.ts を実行してください');
    process.exit(1);
  }

  await mkdir(TMP_DIR, { recursive: true });

  const videos: VideoInput[] = JSON.parse(
    await readFile(NEW_VIDEOS_PATH, 'utf-8'),
  );

  if (videos.length === 0) {
    console.log('[extract] 処理対象の動画なし');
    await writeFile(EXTRACTED_LOCATIONS_PATH, '[]', 'utf-8');
    return;
  }

  console.log(`[extract] 処理対象: ${videos.length}本`);

  const results: {
    videoId: string;
    title: string;
    thumbnailUrl: string;
    publishedAt: string;
    viewCount: number;
    extractedLocations: ExtractedLocation[];
  }[] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const userPrompt = buildUserPrompt(video);
    const response = await callLlm(SYSTEM_PROMPT, userPrompt);
    const locations = parseJsonResponse(response);
    console.log(
      `[extract] ${i + 1}/${videos.length}: ${video.title.slice(0, 40)} → ${locations.length}件`,
    );

    results.push({
      videoId: video.videoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      extractedLocations: locations,
    });
  }

  await writeFile(
    EXTRACTED_LOCATIONS_PATH,
    JSON.stringify(results, null, 2),
    'utf-8',
  );

  const totalLocations = results.reduce(
    (sum, r) => sum + r.extractedLocations.length,
    0,
  );
  console.log(
    `[extract] 完了: ${totalLocations}件の地名を抽出 → ${EXTRACTED_LOCATIONS_PATH}`,
  );
}

void main();
