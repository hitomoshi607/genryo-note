import { describe, expect, it } from 'vitest';
import { AiError, blobToBase64, estimateMeal, parseEstimate, parsePastedMeal, usdCost, type EstimateInput } from './ai';
import { dayTotals, defaultSlot, sumItems } from './meals';
import { defaults } from './schema';

const GOOD = {
  is_food: true,
  items: [
    { name: 'ご飯', amount: '茶碗1杯（約180g）', kcal: 281, protein_g: 4.5, fat_g: 0.5, carb_g: 66.8 },
    { name: '鶏の唐揚げ', amount: '4個（約120g）', kcal: 350, protein_g: 22, fat_g: 22, carb_g: 12 },
  ],
  rice_g: 180,
  fried: true,
  sugary_drink: false,
  heavy_lunch: false,
  confidence: 'medium',
  notes: '揚げ油の量で前後します。',
  advice: '唐揚げは3個にして、豆腐か納豆を足すと満足感はそのままです。',
};

const input: EstimateInput = {
  image: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
  note: '夕食',
  slot: 'dinner',
  gymDay: true,
  eaten: { kcal: 1200, p: 70, f: 30, c: 150 },
  target: { kcal: 2050, p: 130 },
};

/** API の代わりに決まった応答を返し、送られたリクエストを記録する */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as typeof fetch;
  return { f, calls };
}

const message = (text: string, stop = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text }],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 2000, output_tokens: 1000 },
});

describe('推定結果の読み取り', () => {
  it('品目と目安を取り出す', () => {
    const r = parseEstimate(GOOD);
    expect(r.items).toEqual([
      { name: 'ご飯', amount: '茶碗1杯（約180g）', kcal: 281, p: 5, f: 1, c: 67 },
      { name: '鶏の唐揚げ', amount: '4個（約120g）', kcal: 350, p: 22, f: 22, c: 12 },
    ]);
    expect(r.riceG).toBe(180);
    expect(r.fried).toBe(true);
  });
  it('食べ物がなければ notfood', () => {
    expect(() => parseEstimate({ ...GOOD, is_food: false, items: [] })).toThrow(AiError);
  });
  it('品目が空なら失敗扱い', () => {
    expect(() => parseEstimate({ ...GOOD, items: [] })).toThrow(AiError);
  });
});

describe('Claude への問い合わせ（通信は偽物）', () => {
  it('Opus 5.5 に画像・JSON形式・fallbacks を付けて送る', async () => {
    const { f, calls } = fakeFetch(message(JSON.stringify(GOOD)));
    const r = await estimateMeal(input, { apiKey: 'sk-test', model: 'claude-opus-5-5' }, f);
    expect(r.items).toHaveLength(2);
    expect(r.usd).toBeCloseTo((2000 * 4 + 1000 * 20) / 1e6);

    const req = calls[0];
    expect(req.url).toContain('/v1/messages');
    expect(req.headers.get('x-api-key')).toBe('sk-test');
    expect(req.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.fallbacks).toBe('default');
    expect(req.body).not.toHaveProperty('thinking');
    const oc = req.body.output_config as { effort: string; format: { type: string } };
    expect(oc.effort).toBe('medium');
    expect(oc.format.type).toBe('json_schema');
    const content = (req.body.messages as { content: { type: string; source?: { media_type: string; data: string } }[] }[])[0].content;
    expect(content[0].type).toBe('image');
    expect(content[0].source?.media_type).toBe('image/jpeg');
    expect(content[0].source?.data).toBe(await blobToBase64(input.image!));
    expect(content[1].type).toBe('text');
  });

  it('Haiku 5.5 には fallbacks を付けない', async () => {
    const { f, calls } = fakeFetch(message(JSON.stringify(GOOD)));
    await estimateMeal(input, { apiKey: 'sk-test', model: 'claude-haiku-5-5' }, f);
    expect(calls[0].body).not.toHaveProperty('fallbacks');
    expect(calls[0].headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('断られたら refusal', async () => {
    const { f } = fakeFetch(message('', 'refusal'));
    await expect(estimateMeal(input, { apiKey: 'sk-test', model: 'claude-opus-5-5' }, f)).rejects.toMatchObject({ kind: 'refusal' });
  });

  it('キーが違えば auth', async () => {
    const { f } = fakeFetch({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
    await expect(estimateMeal(input, { apiKey: 'sk-bad', model: 'claude-opus-5-5' }, f)).rejects.toMatchObject({ kind: 'auth' });
  });
});

describe('食事の合計', () => {
  it('日ごとの合計（編集中の食事は除く）', () => {
    const d = defaults();
    d.meals['2026-10-08'] = [
      { id: 'a', t: '07:30', slot: 'breakfast', items: [{ name: '朝', amount: '', kcal: 530, p: 26, f: 15, c: 70 }] },
      { id: 'b', t: '12:30', slot: 'lunch', items: [{ name: '昼', amount: '', kcal: 650, p: 35, f: 20, c: 80 }] },
    ];
    expect(dayTotals(d, '2026-10-08')).toEqual({ kcal: 1180, p: 61, f: 35, c: 150 });
    expect(dayTotals(d, '2026-10-08', 'b').kcal).toBe(530);
    expect(sumItems([]).kcal).toBe(0);
  });
  it('時刻から食事区分', () => {
    expect(defaultSlot(new Date(2026, 9, 8, 7, 0))).toBe('breakfast');
    expect(defaultSlot(new Date(2026, 9, 8, 12, 30))).toBe('lunch');
    expect(defaultSlot(new Date(2026, 9, 8, 16, 0))).toBe('snack');
    expect(defaultSlot(new Date(2026, 9, 8, 19, 0))).toBe('dinner');
  });
  it('費用の目安', () => {
    expect(usdCost('claude-haiku-5-5', { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(0.1);
  });
});

describe('claude.ai の推定ページから貼り付け', () => {
  // 推定ページ（companion/meal-estimator.html）の「減量ノート用にコピー」と同じ形
  const copied = JSON.stringify({ genryo_meal: 1, slot: 'lunch', note: '学食', ...GOOD });

  it('そのまま読める', () => {
    const r = parsePastedMeal(copied);
    expect(r.slot).toBe('lunch');
    expect(r.note).toBe('学食');
    expect(r.est.items.map((i) => i.name)).toEqual(['ご飯', '鶏の唐揚げ']);
    expect(r.est.fried).toBe(true);
  });
  it('前後に余計な文字があっても読める', () => {
    expect(parsePastedMeal(`コピーしました\n${copied}\n`).est.items).toHaveLength(2);
  });
  it('関係ない文字はエラー', () => {
    expect(() => parsePastedMeal('こんにちは')).toThrow(AiError);
    expect(() => parsePastedMeal('{壊れた}')).toThrow(AiError);
  });
});
