// 保存データの形と、読み込んだデータを安全な形に整える処理
import { DEFAULT_CARDIO, DEFAULT_GOAL, FIRST_COMP, type Session } from '../data/plan';
import { isHHMM, isYmd } from './date';

export type DayKind = 'lift' | 'cardio' | 'rest';
export const DAY_KINDS: DayKind[] = ['lift', 'cardio', 'rest'];

/** 1種目・1日分の記録 */
export interface LiftRec {
  d: string;
  w: number;
  r: number[];
}

/** 睡眠（起きた日の日付で保存） */
export interface SleepRec {
  bed: string;
  wake: string;
}

export interface CardioRec {
  min: number;
  incline: number;
  speed: number;
}

/** 体組成計（TANITA）の結果。脂肪量・除脂肪量などは体重と体脂肪率から出す */
export interface Comp {
  /** 体重 kg */
  w: number;
  /** 体脂肪率 % */
  fat: number;
  /** 筋肉量 kg */
  muscle: number;
  /** 内臓脂肪レベル */
  visceral?: number;
  /** 基礎代謝 kcal */
  bmr?: number;
  /** 推定骨量 kg */
  bone?: number;
  /** 体水分率 % */
  water?: number;
}

export interface Settings {
  startDate: string;
  startWeight: number;
  goalWeight: number;
  /** 1か月に減らす kg */
  perMonth: number;
  /** 曜日ごとの予定（0 = 日曜） */
  week: DayKind[];
  cardio: { incline: number; speed: number; cardioMin: number; liftMin: number };
}

export interface AppData {
  v: 3;
  weights: Record<string, number>;
  sleep: Record<string, SleepRec>;
  lifts: Record<string, LiftRec[]>;
  /** その日に行った筋トレ（ベンチの日／デッドの日） */
  sessions: Record<string, Session>;
  cardio: Record<string, CardioRec>;
  /** 体組成（測った日ごと） */
  comp: Record<string, Comp>;
  settings: Settings;
}

/** 日・月・火・水・木・金・土 */
export const DEFAULT_WEEK: DayKind[] = ['lift', 'cardio', 'cardio', 'lift', 'cardio', 'lift', 'rest'];

export const defaultSettings = (): Settings => ({
  ...DEFAULT_GOAL,
  week: [...DEFAULT_WEEK],
  cardio: { ...DEFAULT_CARDIO },
});

export const defaults = (): AppData => ({
  v: 3,
  // 開始時の体重と最初の体組成を記録にしておく（その日に量り直したら上書きされる）
  weights: { [DEFAULT_GOAL.startDate]: DEFAULT_GOAL.startWeight, [FIRST_COMP.d]: FIRST_COMP.c.w },
  sleep: {},
  lifts: {},
  sessions: {},
  cardio: {},
  comp: { [FIRST_COMP.d]: { ...FIRST_COMP.c } },
  settings: defaultSettings(),
});

/* ---------- 整える ---------- */

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export const num = (x: unknown, lo: number, hi: number): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined;

const r1 = (n: number) => Math.round(n * 10) / 10;

function normalizeSettings(x: unknown): Settings {
  const e = obj(x);
  const def = defaultSettings();
  const week = Array.isArray(e.week) && e.week.length === 7 && e.week.every((k) => DAY_KINDS.includes(k as DayKind)) ? (e.week as DayKind[]) : def.week;
  const c = obj(e.cardio);
  return {
    startDate: isYmd(e.startDate) ? e.startDate : def.startDate,
    startWeight: num(e.startWeight, 30, 250) ?? def.startWeight,
    goalWeight: num(e.goalWeight, 30, 250) ?? def.goalWeight,
    perMonth: num(e.perMonth, 0.5, 5) ?? def.perMonth,
    week: [...week],
    cardio: {
      incline: num(c.incline, 0, 30) ?? def.cardio.incline,
      speed: num(c.speed, 1, 20) ?? def.cardio.speed,
      cardioMin: num(c.cardioMin, 1, 180) ?? def.cardio.cardioMin,
      liftMin: num(c.liftMin, 0, 180) ?? def.cardio.liftMin,
    },
  };
}

function normalizeLift(x: unknown): LiftRec | null {
  const e = obj(x);
  if (!isYmd(e.d)) return null;
  const w = num(e.w, 0, 500);
  const r = (Array.isArray(e.r) ? e.r : []).filter((n): n is number => num(n, 1, 100) !== undefined).map(Math.round);
  if (w === undefined || !r.length) return null;
  return { d: e.d, w: r1(w), r: r.slice(0, 10) };
}

function normalizeComp(x: unknown): Comp | null {
  const e = obj(x);
  const w = num(e.w, 30, 250);
  const fat = num(e.fat, 1, 75);
  const muscle = num(e.muscle, 10, 200);
  if (w === undefined || fat === undefined || muscle === undefined || muscle >= w) return null;
  const c: Comp = { w: r1(w), fat: r1(fat), muscle: r1(muscle) };
  const visceral = num(e.visceral, 1, 59);
  const bmr = num(e.bmr, 500, 5000);
  const bone = num(e.bone, 0.5, 10);
  const water = num(e.water, 20, 80);
  // 内臓脂肪レベルは 0.5 刻みで出る機種がある
  if (visceral !== undefined) c.visceral = Math.round(visceral * 2) / 2;
  if (bmr !== undefined) c.bmr = Math.round(bmr);
  if (bone !== undefined) c.bone = r1(bone);
  if (water !== undefined) c.water = r1(water);
  return c;
}

/** 読み込んだ JSON を、この版の形に整える（壊れた項目は捨てる） */
export function normalize(x: unknown): AppData {
  const e = obj(x);
  const out = defaults();
  out.weights = {};

  for (const [d, w] of Object.entries(obj(e.weights))) {
    const v = num(w, 30, 250);
    if (isYmd(d) && v !== undefined) out.weights[d] = r1(v);
  }
  for (const [d, s] of Object.entries(obj(e.sleep))) {
    const v = obj(s);
    if (isYmd(d) && isHHMM(v.bed) && isHHMM(v.wake)) out.sleep[d] = { bed: v.bed, wake: v.wake };
  }
  for (const [id, list] of Object.entries(obj(e.lifts))) {
    const recs = (Array.isArray(list) ? list : []).map(normalizeLift).filter((r): r is LiftRec => r !== null);
    // 同じ日の記録は1つにして日付順に並べる
    const byDay = new Map(recs.map((r) => [r.d, r]));
    if (byDay.size) out.lifts[id] = [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
  }
  for (const [d, s] of Object.entries(obj(e.sessions))) {
    if (isYmd(d) && (s === 'A' || s === 'B')) out.sessions[d] = s;
  }
  for (const [d, c] of Object.entries(obj(e.cardio))) {
    const v = obj(c);
    const min = num(v.min, 1, 300);
    if (isYmd(d) && min !== undefined) {
      out.cardio[d] = { min: Math.round(min), incline: num(v.incline, 0, 30) ?? 0, speed: num(v.speed, 0, 20) ?? 0 };
    }
  }
  if ('comp' in e) {
    out.comp = {};
    for (const [d, c] of Object.entries(obj(e.comp))) {
      const v = normalizeComp(c);
      if (isYmd(d) && v) out.comp[d] = v;
    }
  } else if (out.weights[FIRST_COMP.d] === undefined && 'weights' in e) {
    // 体組成を足す前のデータ：最初の体組成（defaults の値）を残し、その日の体重がなければ入れる
    out.weights[FIRST_COMP.d] = FIRST_COMP.c.w;
  }
  out.settings = normalizeSettings(e.settings);
  // 体重のないデータ（新しく始めた直後など）は、最初からある記録を入れておく
  if (!('weights' in e)) out.weights = { ...defaults().weights };
  return out;
}

/** 読み込み前の確認用の件数 */
export function summarize(d: AppData) {
  const days = Object.keys(d.weights).sort();
  return {
    weights: days.length,
    from: days[0],
    to: days[days.length - 1],
    sleep: Object.keys(d.sleep).length,
    lifts: Object.values(d.lifts).reduce((a, l) => a + l.length, 0),
    cardio: Object.keys(d.cardio).length,
    comp: Object.keys(d.comp).length,
  };
}

/** 前の版（genryo-note-v2）のデータかどうか */
export const isOldVersion = (x: unknown) => {
  const e = obj(x);
  return e.v !== 3 && ('habits' in e || 'comp' in e || 'meals' in e);
};
