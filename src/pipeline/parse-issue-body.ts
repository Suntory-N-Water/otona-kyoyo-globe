/**
 * Issue本文からYouTube URLを抽出してstdoutに出力する
 *
 * 使い方:
 *   ISSUE_BODY="..." bun run src/pipeline/parse-issue-body.ts
 */

import { extractYouTubeUrl } from './youtube.ts';

const body = process.env.ISSUE_BODY ?? '';
const url = extractYouTubeUrl(body);

if (!url) {
  console.error('エラー: Issue本文にYouTube URLが見つかりません');
  process.exit(1);
}

console.log(url);
