/**
 * バッチパイプライン実行スクリプト
 *
 * channel_videos.json から isLocaleCandidate=true の動画を読み込み、
 * 4ステップのパイプラインを順番に実行する。
 * 各ステップは既処理動画をスキップするため、途中再開が可能。
 *
 * 使い方:
 *   bun run src/pipeline/run-batch.ts [--from-step <1-4>]
 *
 * オプション:
 *   --from-step 2   fetch をスキップして extract から開始
 *   --from-step 3   geocode から開始
 *   --from-step 4   validate-and-merge のみ実行
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { REGISTRY_DIR } from './config.ts';
import type { ChannelVideo } from './list-channel-videos.ts';

const PIPELINE_DIR = import.meta.dir;

/** サブプロセスを実行し、終了コードが非0なら例外をスロー */
async function runScript(script: string, args: string[] = []): Promise<void> {
  const proc = Bun.spawn(
    ['bun', 'run', resolve(PIPELINE_DIR, script), ...args],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${script} が終了コード ${code} で失敗しました`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fromStepIdx = args.indexOf('--from-step');
  const fromStep = fromStepIdx !== -1 ? Number(args[fromStepIdx + 1]) : 1;

  if (![1, 2, 3, 4].includes(fromStep)) {
    console.error('エラー: --from-step は 1〜4 で指定してください');
    process.exit(1);
  }

  // 選別済みロケ動画を読み込む
  const channelVideos: ChannelVideo[] = JSON.parse(
    await readFile(`${REGISTRY_DIR}/channel_videos.json`, 'utf-8'),
  );
  const selected = channelVideos.filter((v) => v.isLocaleCandidate);
  console.log(
    `[batch] ロケ動画候補: ${selected.length} 本 (ステップ${fromStep}から開始)`,
  );

  // Step 1: 字幕取得
  if (fromStep <= 1) {
    console.log('\n[batch] ===== Step 1: 字幕取得 =====');
    const videoIds = selected.map((v) => v.videoId);
    // fetch-videos.ts は既処理をスキップするので全IDを渡す
    await runScript('fetch-videos.ts', videoIds);
  }

  // Step 2: 地名抽出
  if (fromStep <= 2) {
    console.log('\n[batch] ===== Step 2: 地名抽出 =====');
    await runScript('extract-locations.ts');
  }

  // Step 3: ジオコーディング
  if (fromStep <= 3) {
    console.log('\n[batch] ===== Step 3: ジオコーディング =====');
    await runScript('geocode.ts');
  }

  // Step 4: バリデーション & マージ
  console.log('\n[batch] ===== Step 4: バリデーション & マージ =====');
  await runScript('validate-and-merge.ts');

  console.log('\n[batch] 全ステップ完了！');
}

void main();
