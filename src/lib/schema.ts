// 保存データの形。試作版（localStorage キー genryo-note-v2）と同じ形で、
// food / backupAt だけを追加している。
import { DEFAULT_FAVORITES, DEFAULT_SETTINGS, SEED_COMP } from '../data/seed';
import { isHHMM, isYmd } from './date';
import { r1 } from './format';

export type DayType = 'uni' | 'A' | 'B' | 'C' | 'rest';
export type GymDay = 'A' | 'B' | 'C';
export type Theme = 'auto' | 'light' | 'dark';

export const DAY_TYPES: DayType[] = ['uni', 'A', 'B', 'C', 'rest'];
export const isGym = (t: DayType): t is GymDay => t === 'A' || t === 'B' || t === 'C';

export interface Settings {
  age: number;
  height: number;
  goalWeight: number;
  bed: string;
  wake: string;
  theme: Theme;
  /** キーは曜日番号 '0'（日）〜 '6'（土） */
  schedule: Record<string, DayType>;
}

/** 筋トレ1回分: w = 重量kg, r = 各セットの回数 */
export interface LiftRec {
  d: string;
  w: number;
  r: number[];
}

/** 体組成: fp = 体脂肪率, m = 筋肉量, v = 内臓脂肪レベル, bmr = 基礎代謝（実測） */
export interface Comp {
  d: string;
  w: number;
  fp: number;
  m: number;
  v: number;
  bmr?: number;
}

export interface SosDay {
  held: number;
  ate: number;
}

export type FoodKey = 'fried' | 'alcohol' | 'treat' | 'heavy';
export type FoodDay = Partial<Record<FoodKey, number>>;
export const FOOD_KEYS: FoodKey[] = ['fried', 'alcohol', 'treat', 'heavy'];

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** 1品: p = たんぱく質, f = 脂質, c = 炭水化物（いずれも g） */
export interface MealItem {
  name: string;
  amount: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

/** よく食べる食事（1タップで記録する） */
export interface Favorite {
  id: string;
  name: string;
  /** 記録するときの区分。なければ時刻から決める */
  slot?: MealSlot;
  items: MealItem[];
}

export interface Meal {
  id: string;
  /** 記録した時刻 HH:MM */
  t: string;
  slot: MealSlot;
  items: MealItem[];
  note?: string;
  /** 食事写真のサムネイル（IndexedDB のキー） */
  photo?: string;
  /** AI で推定したときの情報（usd は推定にかかった費用の目安） */
  ai?: { model: string; confidence: 'high' | 'medium' | 'low'; usd?: number };
}

export interface AppData {
  v: 2;
  settings: Settings;
  weights: Record<string, number>;
  habits: Record<string, Record<string, boolean>>;
  sos: Record<string, SosDay>;
  lifts: Record<string, LiftRec[]>;
  comp: Comp[];
  /** 追加: 週の回数で管理する食事（揚げ物・お酒・ごほうび食・△の昼） */
  food: Record<string, FoodDay>;
  /** 追加: 食事の記録（写真からの推定や手入力） */
  meals: Record<string, Meal[]>;
  /** 追加: よく食べる食事 */
  favorites: Favorite[];
  /** 追加: 最後にバックアップを書き出した日時（ISO） */
  backupAt?: string;
}

export function defaults(): AppData {
  return {
    v: 2,
    settings: { ...DEFAULT_SETTINGS, schedule: { ...DEFAULT_SETTINGS.schedule } },
    weights: { [SEED_COMP.d]: SEED_COMP.w },
    habits: {},
    sos: {},
    lifts: {},
    comp: [{ ...SEED_COMP }],
    food: {},
    meals: {},
    favorites: DEFAULT_FAVORITES.map((f) => ({ ...f, items: f.items.map((i) => ({ ...i })) })),
  };
}

const num = (x: unknown, lo: number, hi: number): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined;

const int = (x: unknown) => {
  const n = num(x, 0, 1000);
  return n === undefined ? 0 : Math.round(n);
};

const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

const KNOWN_KEYS = ['settings', 'weights', 'habits', 'sos', 'lifts', 'comp'];

/**
 * 外から来たデータ（localStorage・インポート）を検証して整える。
 * 試作版の JSON をそのまま受け付ける。形が明らかに違うときは例外。
 */
export function normalize(raw: unknown): AppData {
  const o = obj(raw);
  if (!KNOWN_KEYS.some((k) => k in o)) throw new Error('減量ノートのデータではないようです');
  const base = defaults();

  const s = obj(o.settings);
  const sch = obj(s.schedule);
  const settings: Settings = {
    age: num(s.age, 10, 100) ?? base.settings.age,
    height: num(s.height, 100, 250) ?? base.settings.height,
    goalWeight: num(s.goalWeight, 30, 200) ?? base.settings.goalWeight,
    bed: isHHMM(s.bed) ? s.bed : base.settings.bed,
    wake: isHHMM(s.wake) ? s.wake : base.settings.wake,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
    schedule: Object.fromEntries(
      ['0', '1', '2', '3', '4', '5', '6'].map((k) => {
        const v = sch[k];
        return [k, DAY_TYPES.includes(v as DayType) ? (v as DayType) : base.settings.schedule[k]];
      }),
    ),
  };

  const weights: Record<string, number> = {};
  for (const [d, w] of Object.entries(obj(o.weights))) {
    const v = num(w, 30, 200);
    if (isYmd(d) && v !== undefined) weights[d] = r1(v);
  }

  const habits: AppData['habits'] = {};
  for (const [d, h] of Object.entries(obj(o.habits))) {
    if (!isYmd(d)) continue;
    const on = Object.entries(obj(h)).filter(([, v]) => v === true);
    if (on.length) habits[d] = Object.fromEntries(on.map(([k]) => [k, true]));
  }

  const sos: AppData['sos'] = {};
  for (const [d, x] of Object.entries(obj(o.sos))) {
    const e = obj(x);
    const rec = { held: int(e.held), ate: int(e.ate) };
    if (isYmd(d) && (rec.held || rec.ate)) sos[d] = rec;
  }

  const lifts: AppData['lifts'] = {};
  for (const [id, arr] of Object.entries(obj(o.lifts))) {
    if (!Array.isArray(arr)) continue;
    const byDate = new Map<string, LiftRec>();
    for (const x of arr) {
      const e = obj(x);
      const w = num(e.w, 0, 500);
      const r = Array.isArray(e.r) ? e.r.map((n) => num(n, 1, 100)).filter((n): n is number => n !== undefined).map(Math.round) : [];
      if (isYmd(e.d) && w !== undefined && r.length) byDate.set(e.d, { d: e.d, w: r1(w), r });
    }
    const list = [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
    if (list.length) lifts[id] = list;
  }

  const compByDate = new Map<string, Comp>();
  let lastV = base.comp[0].v;
  const rawComp = (Array.isArray(o.comp) ? o.comp : []).map(obj).sort((a, b) => (String(a.d) < String(b.d) ? -1 : 1));
  for (const e of rawComp) {
    const w = num(e.w, 30, 200);
    const fp = num(e.fp, 3, 70);
    const m = num(e.m, 10, 150);
    if (!isYmd(e.d) || w === undefined || fp === undefined || m === undefined) continue;
    const v = num(e.v, 1, 60) ?? lastV;
    lastV = v;
    const bmr = num(e.bmr, 800, 4000);
    compByDate.set(e.d, { d: e.d, w: r1(w), fp: r1(fp), m: r1(m), v, ...(bmr !== undefined ? { bmr: Math.round(bmr) } : {}) });
  }
  const comp = compByDate.size ? [...compByDate.values()] : base.comp;

  const food: AppData['food'] = {};
  for (const [d, x] of Object.entries(obj(o.food))) {
    if (!isYmd(d)) continue;
    const e = obj(x);
    const rec: FoodDay = {};
    for (const k of FOOD_KEYS) if (int(e[k])) rec[k] = int(e[k]);
    if (Object.keys(rec).length) food[d] = rec;
  }

  const meals: AppData['meals'] = {};
  for (const [d, list] of Object.entries(obj(o.meals))) {
    if (!isYmd(d) || !Array.isArray(list)) continue;
    const day = list.map(normalizeMeal).filter((m): m is Meal => m !== null);
    if (day.length) meals[d] = day;
  }

  // まだ一度も保存していない（試作版や古いデータ）ときだけ初期値を入れる。空の配列は「全部消した」なので尊重する
  const favorites = Array.isArray(o.favorites)
    ? o.favorites.map(normalizeFavorite).filter((f): f is Favorite => f !== null)
    : base.favorites;

  // 測定日の体重は体重記録にも入れておく（試作版と同じ挙動）
  for (const c of comp) if (weights[c.d] === undefined) weights[c.d] = c.w;

  const out: AppData = { v: 2, settings, weights, habits, sos, lifts, comp, food, meals, favorites };
  if (typeof o.backupAt === 'string') out.backupAt = o.backupAt;
  return out;
}

const str = (x: unknown, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '');

/** 品目の数値を整える（AI の出力やインポートで使う） */
export function normalizeItem(x: unknown): MealItem | null {
  const e = obj(x);
  const name = str(e.name, 60).trim();
  if (!name) return null;
  const n = (v: unknown) => Math.round(num(v, 0, 5000) ?? 0);
  return { name, amount: str(e.amount, 60), kcal: n(e.kcal), p: n(e.p), f: n(e.f), c: n(e.c) };
}

function normalizeMeal(x: unknown): Meal | null {
  const e = obj(x);
  const items = (Array.isArray(e.items) ? e.items : []).map(normalizeItem).filter((i): i is MealItem => i !== null);
  if (typeof e.id !== 'string' || !items.length) return null;
  const slot = MEAL_SLOTS.includes(e.slot as MealSlot) ? (e.slot as MealSlot) : 'snack';
  const meal: Meal = { id: e.id, t: isHHMM(e.t) ? e.t : '12:00', slot, items };
  if (typeof e.note === 'string' && e.note) meal.note = e.note.slice(0, 200);
  if (typeof e.photo === 'string') meal.photo = e.photo;
  const ai = obj(e.ai);
  if (typeof ai.model === 'string' && ['high', 'medium', 'low'].includes(ai.confidence as string)) {
    meal.ai = { model: ai.model, confidence: ai.confidence as 'high' | 'medium' | 'low' };
    const usd = num(ai.usd, 0, 10);
    if (usd !== undefined) meal.ai.usd = usd;
  }
  return meal;
}

function normalizeFavorite(x: unknown): Favorite | null {
  const e = obj(x);
  const items = (Array.isArray(e.items) ? e.items : []).map(normalizeItem).filter((i): i is MealItem => i !== null);
  const name = str(e.name, 40).trim();
  if (typeof e.id !== 'string' || !name || !items.length) return null;
  const fav: Favorite = { id: e.id, name, items };
  if (MEAL_SLOTS.includes(e.slot as MealSlot)) fav.slot = e.slot as MealSlot;
  return fav;
}

/** インポートの「統合」: 同じ日付は読み込んだ側を優先。設定は読み込んだ側 */
export function mergeData(cur: AppData, inc: AppData): AppData {
  const lifts: AppData['lifts'] = { ...cur.lifts };
  for (const [id, list] of Object.entries(inc.lifts)) {
    const m = new Map((lifts[id] ?? []).map((x) => [x.d, x]));
    for (const x of list) m.set(x.d, x);
    lifts[id] = [...m.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  }
  const comp = new Map(cur.comp.map((c) => [c.d, c]));
  for (const c of inc.comp) comp.set(c.d, c);
  // 食事は同じ日でも別の記録なので、id ごとに合わせる
  const meals: AppData['meals'] = { ...cur.meals };
  for (const [d, list] of Object.entries(inc.meals)) {
    const m = new Map((meals[d] ?? []).map((x) => [x.id, x]));
    for (const x of list) m.set(x.id, x);
    meals[d] = [...m.values()].sort((a, b) => (a.t < b.t ? -1 : 1));
  }
  return {
    v: 2,
    settings: inc.settings,
    weights: { ...cur.weights, ...inc.weights },
    habits: { ...cur.habits, ...inc.habits },
    sos: { ...cur.sos, ...inc.sos },
    lifts,
    comp: [...comp.values()].sort((a, b) => (a.d < b.d ? -1 : 1)),
    food: { ...cur.food, ...inc.food },
    meals,
    favorites: [...new Map([...cur.favorites, ...inc.favorites].map((f) => [f.id, f])).values()],
    backupAt: cur.backupAt,
  };
}

/** インポート前の確認用の件数 */
export function summarize(d: AppData) {
  const wd = Object.keys(d.weights).sort();
  return {
    weights: wd.length,
    from: wd[0],
    to: wd[wd.length - 1],
    habits: Object.keys(d.habits).length,
    lifts: Object.values(d.lifts).reduce((n, l) => n + l.length, 0),
    comp: d.comp.length,
    meals: Object.values(d.meals).reduce((n, l) => n + l.length, 0),
  };
}
