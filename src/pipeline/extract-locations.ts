/**
 * Step 2: Gemini API で字幕・タイトルから地名を抽出する
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import {
  EXTRACTED_LOCATIONS_PATH,
  GEMINI_API_KEY,
  NEW_VIDEOS_PATH,
  TMP_DIR,
} from './config.ts';

const SYSTEM_PROMPT = `# 思考のレンズ

## 前提 (Premise)
- 入力はYouTubeチャンネル「大人の教養TV」の動画タイトルと字幕テキストである
- このチャンネルは撮影者が世界各地を実際に訪問し、現地で歴史や文化を解説するスタイルである
- 字幕は自動生成のため誤字・脱字を含む可能性がある
- 出力はWebアプリの地球儀上にピンとして表示される

## 状況 (Situation)
- 字幕テキストには「撮影者が実際にいる場所」と「解説の中で言及しているだけの場所」が混在している
- 同じ地名でも日本各地・世界各地に存在するため、所在地域の特定が不可欠である
- 海外の歴史解説ロケでは、国名が動画の主題そのものであり、訪問と解説の区別が特に曖昧になる

## 目的 (Purpose)
- 撮影者が実際に訪れた・カメラに映っている具体的な場所のみを抽出する
- 各地名にはジオコーディングで一意に特定できる所在地域を付与する
- 各地名の緯度経度(おおよそでよい)を付与する

## 動機 (Motive)
- ファンが「この動画はどこで撮ったんだろう」と地球儀で発見・再発見する体験を提供するためである
- 撮影者が行っていない場所にピンが立つと体験が損なわれるため、精度を最優先する

## 制約 (Constraint)
- まず字幕テキストの冒頭部分(最初の数百文字)に、撮影者が現地にいることを示す発話があるか判定せよ。例:「〜に来ています」「〜にいるんですけど」「〜に来ました」「〜にやって来ました」等。そのような発話がなければロケ動画ではないと判断し、空配列 [] のみを返せ
- 最重要: 「撮影者がその場所にいる」証拠が字幕にない場所は絶対に含めない
- 判断基準: 「ここに来ました」「今いるのは」「目の前に見える」等の発話があるか
- 歴史の解説で登場するだけの国・地域・都市は含めない(例: 戦争相手国、植民地、条約の舞台)
- 国名は絶対に含めない。都市名以下の粒度のみ抽出せよ
  - 「〜国」「〜共和国」「〜王国」「〜連邦」のような国レベルの地名は除外
  - 海外歴史ロケで複数の国が話題に出ても、国名ではなく撮影者がいる具体的な都市・施設のみ抽出
- 都道府県のような広域名は含めない(ピンを刺す意味がない)
- 地名は日本語正式名称に統一する(字幕の誤字は修正する)
- 迷ったら含めない。少数精鋭を最優先する
- 出力はJSON配列のみ: [{"n":"地名","r":"所在地域","lat":緯度,"lng":経度}]
- nは具体的な場所名、rは都道府県名や国名などジオコーディングで地名を一意に特定できる地域名
- latは緯度(数値, -90〜90)、lngは経度(数値, -180〜180)。おおよその座標で構わない`;

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
  region: string;
  lat: number | null;
  lng: number | null;
};

/** LLMの生レスポンス1件の型 */
type RawLocation = {
  n?: string;
  r?: string;
  name?: string;
  region?: string;
  lat?: number;
  lng?: number;
};

/** 緯度経度が有効な範囲かチェックする */
function validateCoord(
  lat: number | undefined,
  lng: number | undefined,
): { lat: number; lng: number } | null {
  if (lat === undefined || lng === undefined) {
    return null;
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (
    Number.isNaN(latNum) ||
    Number.isNaN(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return null;
  }
  return { lat: latNum, lng: lngNum };
}

/** 短縮キーの応答を正規のフィールド名に変換する */
function normalizeLocations(raw: RawLocation[]): ExtractedLocation[] {
  return raw
    .map((item) => {
      const name = item.n ?? item.name ?? '';
      const region = item.r ?? item.region ?? '';
      const coord = validateCoord(item.lat, item.lng);
      return {
        name,
        region,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
      };
    })
    .filter((item) => item.name !== '');
}

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

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/** Gemini API を呼び出して地名を抽出する */
async function callLlm(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // トークン使用量を監視
  const usage = response.usageMetadata;
  if (usage) {
    console.log(
      `[extract] トークン: 入力=${usage.promptTokenCount ?? 0} 出力=${usage.candidatesTokenCount ?? 0}`,
    );
  }

  return response.text ?? '';
}

/** LLMの応答からJSON配列を抽出する */
function parseJsonResponse(text: string): RawLocation[] {
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
  if (!GEMINI_API_KEY) {
    console.error('エラー: GEMINI_API_KEY が設定されていません');
    process.exit(1);
  }

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
    const locations = normalizeLocations(parseJsonResponse(response));
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
