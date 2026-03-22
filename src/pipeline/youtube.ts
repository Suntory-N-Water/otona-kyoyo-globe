/** YouTube URL / 動画ID のパースユーティリティ */

/** URLまたは動画IDからYouTube動画IDを抽出する */
export function parseVideoId(urlOrId: string) {
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

/** テキスト中からYouTube URLを抽出する（Issue本文のパース用） */
export function extractYouTubeUrl(text: string) {
  const match = text.match(
    /https?:\/\/(www\.)?youtube\.com\/watch\?[^\s]*v=[a-zA-Z0-9_-]{11}|https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}/,
  );
  return match ? match[0] : null;
}
