/**
 * Gemini API クライアント(フォールバック戦略 + レート制限対策)
 *
 * レート制限(429)やサービス不可(503)時に、次のモデルへ自動フォールバックする。
 * 各モデルには最小リクエスト間隔を設定し、無料枠のレート制限に対応する。
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from './config.ts';

type ModelConfig = {
  model: string;
  /** リクエスト間の最小待機時間(ms) */
  minIntervalMs: number;
};

/** 試行するモデルリスト(優先順位順) */
const MODELS: ModelConfig[] = [
  { model: 'gemini-3-flash-preview', minIntervalMs: 15_000 },
  { model: 'gemini-3.1-flash-lite-preview', minIntervalMs: 15_000 },
  { model: 'gemini-2.5-flash', minIntervalMs: 15_000 },
  { model: 'gemini-2.5-flash-lite', minIntervalMs: 10_000 },
];

/** リトライ対象のHTTPステータスコード */
const RETRYABLE_STATUS = new Set([429, 503]);

/** リトライ対象のエラーメッセージキーワード */
const RETRYABLE_KEYWORDS = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'rate limit'];

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/** モデルごとの最終リクエスト時刻 */
const lastRequestAt = new Map<string, number>();

/** レート制限に従って待機する */
async function waitForRateLimit(config: ModelConfig): Promise<void> {
  const last = lastRequestAt.get(config.model) ?? 0;
  const elapsed = Date.now() - last;
  const wait = config.minIntervalMs - elapsed;
  if (wait > 0) {
    console.log(
      `[gemini] レート制限待機: ${config.model} ${Math.ceil(wait / 1000)}秒`,
    );
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/** エラーがリトライ対象か判定する */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    if (RETRYABLE_KEYWORDS.some((kw) => msg.includes(kw))) {
      return true;
    }
    // HTTP ステータスコードが含まれる場合
    const statusMatch = msg.match(/(\d{3})/);
    if (statusMatch && RETRYABLE_STATUS.has(Number(statusMatch[1]))) {
      return true;
    }
  }
  return false;
}

/**
 * Gemini API でテキストを生成する(フォールバック付き)
 *
 * 全モデルが失敗した場合は例外をスローする。
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<{
  text: string;
  model: string;
  usage: { input: number; output: number };
}> {
  let lastError: unknown;

  for (const config of MODELS) {
    try {
      await waitForRateLimit(config);

      console.log(`[gemini] リクエスト: ${config.model}`);
      lastRequestAt.set(config.model, Date.now());

      const response = await ai.models.generateContent({
        model: config.model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const usage = response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;
      console.log(
        `[gemini] 完了: ${config.model} (入力=${inputTokens} 出力=${outputTokens})`,
      );

      return {
        text: response.text ?? '',
        model: config.model,
        usage: { input: inputTokens, output: outputTokens },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRetryable(err)) {
        console.warn(
          `[gemini] レート制限/一時エラー: ${config.model} → 次のモデルへ (${msg.slice(0, 80)})`,
        );
        lastError = err;
        continue;
      }
      // リトライ対象外のエラーはそのままスロー
      throw err;
    }
  }

  throw new Error(
    `[gemini] 全モデルが失敗しました。最後のエラー: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
