// 食事の写真（またはメモ）から Claude に品目ごとのカロリーと PFC を推定してもらう。
// API キーは端末の localStorage（記録データとは別のキー）にだけ保存し、バックアップには含めない。
import type Anthropic from '@anthropic-ai/sdk';
import type { MealItem, MealSlot } from './schema';
import { normalizeItem } from './schema';
import { SLOT_LABEL, type Totals } from './meals';

export type AiModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

/** 料金は $/100万トークン（2026-10 時点） */
export const AI_MODELS: { id: AiModel; label: string; inUsd: number; outUsd: number; fallback: boolean }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（精度重視）', inUsd: 4, outUsd: 20, fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（バランス）', inUsd: 2, outUsd: 10, fallback: true },
  // Haiku 5.5 にはサーバー側の切り替え（fallbacks）がない
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（最安）', inUsd: 0.1, outUsd: 0.5, fallback: false },
];
export const DEFAULT_MODEL: AiModel = 'claude-opus-5-5';
export const YEN_PER_USD = 150;

/* ---------- 設定（端末にだけ保存） ---------- */

const AI_KEY = 'genryo-note-ai';

export interface AiSettings {
  apiKey: string;
  model: AiModel;
}

export function loadAi(): AiSettings | null {
  try {
    const x = JSON.parse(localStorage.getItem(AI_KEY) ?? 'null');
    if (x && typeof x.apiKey === 'string' && x.apiKey) {
      const model = AI_MODELS.some((m) => m.id === x.model) ? (x.model as AiModel) : DEFAULT_MODEL;
      return { apiKey: x.apiKey, model };
    }
  } catch {
    /* 壊れていたら未設定扱い */
  }
  return null;
}

export function saveAi(s: AiSettings) {
  localStorage.setItem(AI_KEY, JSON.stringify(s));
}

export function clearAi() {
  localStorage.removeItem(AI_KEY);
}

/* ---------- エラー ---------- */

export type AiErrorKind = 'auth' | 'rate' | 'offline' | 'refusal' | 'notfood' | 'bad' | 'other';

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/* ---------- 出力の形 ---------- */

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'amount', 'kcal', 'protein_g', 'fat_g', 'carb_g'],
  properties: {
    name: { type: 'string', description: '料理名（日本語）' },
    amount: { type: 'string', description: '量。例:「茶碗1杯（約150g）」' },
    kcal: { type: 'number' },
    protein_g: { type: 'number' },
    fat_g: { type: 'number' },
    carb_g: { type: 'number' },
  },
};

export const ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'rice_g', 'fried', 'sugary_drink', 'heavy_lunch', 'confidence', 'notes', 'advice'],
  properties: {
    is_food: { type: 'boolean', description: '食事・飲み物が写っている（または書かれている）か' },
    items: { type: 'array', items: ITEM_SCHEMA },
    rice_g: { type: 'number', description: '白米・ご飯の量（g）。なければ 0' },
    fried: { type: 'boolean', description: '揚げ物が含まれる' },
    sugary_drink: { type: 'boolean', description: 'ジュース・加糖コーヒー・エナジードリンクなど砂糖入りの飲み物が含まれる' },
    heavy_lunch: { type: 'boolean', description: 'カツ丼・カレー大盛り・ラーメン＋ライスのどれかに当たる' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string', description: '推定の前提や不確かな点を1文で' },
    advice: { type: 'string', description: '次にできることを1文（40字程度）で' },
  },
};

export interface MealEstimate {
  items: MealItem[];
  riceG: number;
  fried: boolean;
  sugaryDrink: boolean;
  heavyLunch: boolean;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  advice: string;
}

/** モデルの JSON を検証して整える。食べ物でなければ AiError('notfood') */
export function parseEstimate(raw: unknown): MealEstimate {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (o.is_food === false) throw new AiError('notfood', '食べ物が見つかりませんでした。写真を撮り直すか、メモに料理名を書いてください。');
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((x) => {
      const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return normalizeItem({ name: e.name, amount: e.amount, kcal: e.kcal, p: e.protein_g, f: e.fat_g, c: e.carb_g });
    })
    .filter((i): i is MealItem => i !== null);
  if (!items.length) throw new AiError('bad', '推定結果を読み取れませんでした。もう一度試してください。');
  const conf = o.confidence === 'high' || o.confidence === 'low' ? o.confidence : 'medium';
  const rice = typeof o.rice_g === 'number' && Number.isFinite(o.rice_g) ? Math.max(0, Math.round(o.rice_g)) : 0;
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '');
  return {
    items,
    riceG: rice,
    fried: o.fried === true,
    sugaryDrink: o.sugary_drink === true,
    heavyLunch: o.heavy_lunch === true,
    confidence: conf,
    notes: text(o.notes),
    advice: text(o.advice),
  };
}

/* ---------- claude.ai（チャット・推定ページ）から貼り付け ---------- */

/**
 * Claude のチャットの返事か、推定ページの「減量ノート用にコピー」で作った文字を読む。
 * 前後に説明文やコードブロックの印があっても、最初の { から最後の } までを JSON として読む。
 */
export function parsePastedMeal(text: string): { est: MealEstimate; slot?: MealSlot; note?: string } {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new AiError('bad', '貼り付けた文字に推定結果が見つかりませんでした。Claude の返事をコピーしてから貼り付けてください。');
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new AiError('bad', '貼り付けた文字を読み取れませんでした。もう一度コピーしてから貼り付けてください。');
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const est = parseEstimate(o);
  const slot = ['breakfast', 'lunch', 'snack', 'dinner'].includes(o.slot as string) ? (o.slot as MealSlot) : undefined;
  const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim().slice(0, 200) : undefined;
  return { est, ...(slot ? { slot } : {}), ...(note ? { note } : {}) };
}

/* ---------- プロンプト ---------- */

export interface EstimateInput {
  image?: Blob;
  note: string;
  slot: MealSlot;
  gymDay: boolean;
  /** この食事を除いた、その日のここまでの合計 */
  eaten: Totals;
  target: { kcal: number; p: number };
}

export function systemPrompt(target: { kcal: number; p: number }) {
  return `あなたは日本の家庭料理・学食・コンビニ食に詳しい管理栄養士です。食事の写真やメモから、品目ごとの量・エネルギー・たんぱく質・脂質・炭水化物を推定します。

利用者は21歳男性・165cm。筋肉を守りながら減量中で、1日の目標は ${target.kcal}kcal・たんぱく質 ${target.p}g。実家で親の作った料理を食べています。

推定のしかた:
- 料理を1品ずつ分けます（ご飯・汁物・主菜・副菜・飲み物など）。
- 量は茶碗・皿・箸・手などの大きさから見積もり、値は日本食品標準成分表に沿った一般的な値にします。
- 調理油・ドレッシング・ソースなど見えにくいカロリーも含めます。
- メモに量や料理名があれば、それを優先します。
- 見えない部分があって迷うときは中くらいの見積もりにし、confidence を下げます。
- 食べ物が写っておらず、メモにも食事の記述がなければ is_food を false にし、items は空にします。

advice は、利用者のルール（ご飯は1食150g・ジムの日の夕食は180gまで、主菜は手のひら1〜1.5枚、揚げ物は週2回まで、甘い飲み物は避ける、間食は1日200kcalまで）とその日の残りを踏まえて、次の食事でできることを1文で書きます。責める言い方はしません。`;
}

export function userText(input: EstimateInput) {
  const lines = [
    `食事区分: ${SLOT_LABEL[input.slot]}${input.gymDay ? '（ジムの日）' : ''}`,
    `メモ: ${input.note.trim() || 'なし'}`,
    `今日これまで（この食事を除く）: ${Math.round(input.eaten.kcal)}kcal・たんぱく質 ${Math.round(input.eaten.p)}g`,
  ];
  if (!input.image) lines.unshift('写真はありません。メモから推定してください。');
  return lines.join('\n');
}

/** Claude のチャット（claude.ai・Claude アプリ）に写真と一緒に送る文 */
export interface ChatPromptInput {
  /** よく食べる食事の登録では区分なし */
  slot?: MealSlot;
  note: string;
  gymDay: boolean;
  /** この食事を除いた、その日のここまでの合計（よく食べる食事の登録ではなし） */
  eaten?: Totals;
  target: { kcal: number; p: number };
}

export function chatPrompt(input: ChatPromptInput) {
  const example = {
    genryo_meal: 1,
    ...(input.slot ? { slot: input.slot } : {}),
    is_food: true,
    items: [{ name: 'ご飯', amount: '茶碗1杯（約150g）', kcal: 234, protein_g: 4, fat_g: 1, carb_g: 56 }],
    rice_g: 150,
    fried: false,
    sugary_drink: false,
    heavy_lunch: false,
    confidence: 'medium',
    notes: '推定の前提や不確かな点を1文で',
    advice: '次の食事でできることを1文で',
  };
  return [
    '【減量ノート】添付した食事の写真（写真がなければ下のメモ）から、品目ごとの量・エネルギー・たんぱく質・脂質・炭水化物を推定してください。',
    '',
    systemPrompt(input.target),
    '',
    ...(input.slot ? [`食事区分: ${SLOT_LABEL[input.slot]}${input.gymDay ? '（ジムの日）' : ''}`] : []),
    `メモ: ${input.note.trim() || 'なし'}`,
    ...(input.eaten ? [`今日これまで（この食事を除く）: ${Math.round(input.eaten.kcal)}kcal・たんぱく質 ${Math.round(input.eaten.p)}g`] : []),
    '',
    '返事は次の形の JSON だけにしてください（数値は単位なしの数字）。',
    JSON.stringify(example),
    'heavy_lunch はカツ丼・カレー大盛り・ラーメン＋ライスのどれかなら true。confidence は high・medium・low のどれか。rice_g はご飯がなければ 0。',
  ].join('\n');
}

/* ---------- 画像 ---------- */

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ---------- 呼び出し ---------- */

async function client(s: AiSettings, fetchImpl?: typeof fetch) {
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  // キーは利用者本人の端末にだけあり、利用者本人の操作でだけ送るのでブラウザから直接呼ぶ
  const c = new AnthropicSdk({ apiKey: s.apiKey, dangerouslyAllowBrowser: true, timeout: 90_000, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  return { c, Sdk: AnthropicSdk };
}

function toAiError(e: unknown, Sdk: typeof Anthropic): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Sdk.AuthenticationError) return new AiError('auth', 'API キーが正しくないようです。設定を確認してください。');
  if (e instanceof Sdk.PermissionDeniedError) return new AiError('auth', 'この API キーではこのモデルを使えません。設定のモデルを確認してください。');
  if (e instanceof Sdk.RateLimitError) return new AiError('rate', '短時間に送りすぎたか、利用上限に達しました。少し待ってから試してください。');
  if (e instanceof Sdk.APIConnectionError) return new AiError('offline', '通信できませんでした。電波の良い場所でもう一度試してください。');
  if (e instanceof Sdk.APIError) return new AiError('other', `推定に失敗しました（${e.status ?? 'エラー'}）。もう一度試してください。`);
  return new AiError('other', '推定に失敗しました。もう一度試してください。');
}

export const usdCost = (model: AiModel, usage: { input_tokens: number; output_tokens: number }) => {
  const m = AI_MODELS.find((x) => x.id === model) ?? AI_MODELS[0];
  return (usage.input_tokens * m.inUsd + usage.output_tokens * m.outUsd) / 1_000_000;
};

export async function estimateMeal(input: EstimateInput, s: AiSettings, fetchImpl?: typeof fetch): Promise<MealEstimate & { usd: number; model: string }> {
  const { c, Sdk } = await client(s, fetchImpl);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(input.image) } });
  }
  content.push({ type: 'text', text: userText(input) });
  const useFallback = AI_MODELS.find((m) => m.id === s.model)?.fallback ?? false;

  try {
    const res = await c.beta.messages.create({
      model: s.model,
      max_tokens: 16000,
      system: systemPrompt(input.target),
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESTIMATE_SCHEMA } },
      // 安全のための判定で断られたとき、サーバー側で別モデルに切り替えて続ける
      ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    if (res.stop_reason === 'refusal') throw new AiError('refusal', 'この写真は推定できませんでした。メモだけで試すか、手入力してください。');
    if (res.stop_reason === 'max_tokens') throw new AiError('bad', '推定結果が途中で切れました。もう一度試してください。');
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError('bad', '推定結果を読み取れませんでした。もう一度試してください。');
    }
    return { ...parseEstimate(json), usd: usdCost(s.model, res.usage), model: res.model };
  } catch (e) {
    throw toAiError(e, Sdk);
  }
}

/** キーとモデルが使えるかを確認する（モデル情報の取得なので料金はかからない） */
export async function verifyAi(s: AiSettings) {
  const { c, Sdk } = await client(s);
  try {
    await c.models.retrieve(s.model);
  } catch (e) {
    throw toAiError(e, Sdk);
  }
}
