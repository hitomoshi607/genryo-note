// 計算ロジック。SPEC.md「3. 計算ロジック」の式どおり。式を変えるときは calc.test.ts も確認すること。
import { CHECKS } from '../data/plan';
import { START_DATE } from '../data/seed';
import { addDays, dayDiff, fromMin, mondayOf, toMin, weekday } from './date';
import { r1 } from './format';
import type { AppData, Comp, DayType, FoodKey } from './schema';
import { isGym } from './schema';

export const FAT_STD = { lo: 11.0, hi: 21.9 } as const;
export const ACTIVITY_FACTOR = 1.5;
export const DEFICIT_KCAL = 550;
/** 計画ペース（kg/週） */
export const PLAN_KG_PER_WEEK = 0.5;
/** 目安の減量ペース（kg/週） */
export const PACE = { min: 0.3, max: 0.7, tooFast: 1.0 } as const;
export const STEPS_GOAL = 8000;

/* ---------- 体組成 ---------- */

export const leanMass = (c: Pick<Comp, 'w' | 'fp'>) => c.w * (1 - c.fp / 100);
export const fatMass = (c: Pick<Comp, 'w' | 'fp'>) => (c.w * c.fp) / 100;
export const katchMcArdle = (lbm: number) => Math.round(370 + 21.6 * lbm);
export const bmi = (w: number, heightCm: number) => w / (heightCm / 100) ** 2;

export const latestComp = (d: AppData) => d.comp[d.comp.length - 1];
export const firstComp = (d: AppData) => d.comp[0];

export interface Targets {
  lbm: number;
  bmr: number;
  bmrMeasured: boolean;
  tdee: number;
  floor: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export function calcTargets(comp: Comp): Targets {
  const lbm = leanMass(comp);
  const bmrMeasured = typeof comp.bmr === 'number' && comp.bmr > 0;
  // 体組成計の実測値を優先。なければ Katch-McArdle
  const bmr = bmrMeasured ? (comp.bmr as number) : katchMcArdle(lbm);
  const tdee = bmr * ACTIVITY_FACTOR;
  const floor = bmr + 150;
  const kcal = Math.max(floor, Math.round((tdee - DEFICIT_KCAL) / 50) * 50);
  // タンパク質は体重ではなく除脂肪量 × 2.2g
  const p = Math.round((lbm * 2.2) / 5) * 5;
  const f = Math.round((kcal * 0.25) / 9 / 5) * 5;
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4 / 5) * 5);
  return { lbm, bmr, bmrMeasured, tdee, floor, kcal, p, f, c };
}

export type Tone = 'good' | 'warn' | 'neutral';
export interface Judge {
  label: string;
  tone: Tone;
}

/** TANITA の判定基準（男性 18〜39歳） */
export function fatJudge(fp: number): Judge {
  if (fp < FAT_STD.lo) return { label: 'やせ', tone: 'neutral' };
  if (fp < 22) return { label: '標準', tone: 'good' };
  if (fp < 27) return { label: '軽肥満', tone: 'warn' };
  return { label: '肥満', tone: 'warn' };
}

export function visceralJudge(v: number): Judge {
  if (v < 10) return { label: '標準', tone: 'good' };
  if (v < 15) return { label: 'やや過剰', tone: 'warn' };
  return { label: '過剰', tone: 'warn' };
}

/** 筋肉量の許容幅（kg）。体組成計の水分による誤差を見込む */
export const MUSCLE_TOLERANCE = 0.5;

export function muscleJudge(comps: Comp[]): Judge & { delta: number | null } {
  if (comps.length < 2) return { label: '多', tone: 'good', delta: null };
  const delta = comps[comps.length - 1].m - comps[0].m;
  return delta >= -MUSCLE_TOLERANCE ? { label: '維持', tone: 'good', delta } : { label: '要注意', tone: 'warn', delta };
}

/** 体脂肪率を標準上限（21.9%）まで下げるのに、あと何kgの脂肪を落とすか */
export function fatToStandard(c: Comp) {
  const lbm = leanMass(c);
  const fatAtStd = (lbm / (1 - FAT_STD.hi / 100)) * (FAT_STD.hi / 100);
  return Math.max(0, fatMass(c) - fatAtStd);
}

/* ---------- 段階目標 ---------- */

export interface Milestone {
  w: number;
  pct: number;
  label: string;
  note: string;
  goal?: boolean;
}

/** 除脂肪量を維持する前提で、体脂肪率から逆算した体重: LBM / (1 − 目標体脂肪率/100) */
export function milestones(lbm: number, goalWeight: number): Milestone[] {
  const stages: Milestone[] = [
    { pct: FAT_STD.hi, note: '体脂肪率が標準範囲に入る' },
    { pct: 19, note: '内臓脂肪レベルが標準に戻るころ' },
    { pct: 15, note: '見た目が明確に変わる' },
  ].map((s) => ({ ...s, w: r1(lbm / (1 - s.pct / 100)), label: `体脂肪率 ${s.pct}%` }));
  const goal: Milestone = {
    w: r1(goalWeight),
    pct: r1((1 - lbm / goalWeight) * 100),
    label: 'ゴール',
    note: '目標体重',
    goal: true,
  };
  // ゴールより下（または近すぎる）段階は出さない
  return [...stages.filter((s) => s.w > goal.w + 0.3), goal].sort((a, b) => b.w - a.w);
}

/** 未達成の中でいちばん近いもの。判断は 7日平均 */
export function nextMilestone(list: Milestone[], current: number) {
  return list.find((m) => current > m.w + 0.05) ?? null;
}

/* ---------- 体重 ---------- */

export interface WPoint {
  d: string;
  w: number;
}

export const weightEntries = (weights: Record<string, number>): WPoint[] =>
  Object.keys(weights)
    .sort()
    .map((d) => ({ d, w: weights[d] }));

/** d を含む直近7日間（d−6〜d）の平均。記録がなければ null */
export function avg7(weights: Record<string, number>, d: string): number | null {
  const from = addDays(d, -6);
  let s = 0;
  let n = 0;
  for (const k in weights) {
    if (k >= from && k <= d) {
      s += weights[k];
      n++;
    }
  }
  return n ? s / n : null;
}

const countIn = (weights: Record<string, number>, from: string, to: string) =>
  Object.keys(weights).filter((k) => k >= from && k <= to).length;

/** 各記録日の 7日平均（グラフ用） */
export function avgSeries(weights: Record<string, number>): (WPoint & { a: number })[] {
  return weightEntries(weights).map((e) => ({ ...e, a: avg7(weights, e.d) as number }));
}

/** いまの体重 = 最後の記録日の 7日平均（記録がなければ最新の体組成） */
export function currentWeight(d: AppData): number {
  const e = weightEntries(d.weights);
  if (!e.length) return latestComp(d).w;
  return avg7(d.weights, e[e.length - 1].d) as number;
}

/** 直近3週間の 7日平均から最小二乗法で出した傾き（kg/日）。データ5点以上かつ期間9日以上でのみ */
export function trendSlope(weights: Record<string, number>): number | null {
  const e = weightEntries(weights);
  if (e.length < 5) return null;
  const last = e[e.length - 1].d;
  const from = addDays(last, -20);
  const pts = e.filter((x) => x.d >= from).map((x) => ({ x: dayDiff(from, x.d), y: avg7(weights, x.d) as number }));
  if (pts.length < 5 || pts[pts.length - 1].x - pts[0].x < 9) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den ? num / den : null;
}

export type Forecast =
  | { kind: 'done' }
  | { kind: 'trend'; date: string; perWeek: number }
  | { kind: 'flat'; perWeek: number }
  | { kind: 'plan'; date: string };

/** 到達予想日。傾きが出せなければ 週0.5kg ペースの予定日 */
export function forecast(d: AppData, today: string): Forecast {
  const cur = currentWeight(d);
  const goal = d.settings.goalWeight;
  if (cur <= goal) return { kind: 'done' };
  const slope = trendSlope(d.weights);
  if (slope !== null && slope < -0.01) {
    const e = weightEntries(d.weights);
    return { kind: 'trend', date: addDays(e[e.length - 1].d, Math.ceil((cur - goal) / -slope)), perWeek: slope * 7 };
  }
  if (slope !== null) return { kind: 'flat', perWeek: slope * 7 };
  return { kind: 'plan', date: addDays(today, Math.ceil(((cur - goal) / PLAN_KG_PER_WEEK) * 7)) };
}

/** 計画ペースの線（初回測定から 週0.5kg で目標まで） */
export function planLine(d: AppData) {
  const f = firstComp(d);
  const goal = d.settings.goalWeight;
  const days = Math.max(0, Math.ceil(((f.w - goal) / PLAN_KG_PER_WEEK) * 7));
  return { from: { d: f.d, w: f.w }, to: { d: addDays(f.d, days), w: goal } };
}

/** 直近1週間の 7日平均の変化（kg）。前の週の記録がなければ null */
export function weeklyChange(weights: Record<string, number>): number | null {
  const e = weightEntries(weights);
  if (!e.length) return null;
  const last = e[e.length - 1].d;
  const a = avg7(weights, last);
  const b = avg7(weights, addDays(last, -7));
  return a !== null && b !== null ? a - b : null;
}

/* ---------- 体重の警告 ---------- */

export interface StallTip {
  id: 'nosugar' | 'rice' | 'steps' | 'sleep' | 'more-steps';
  text: string;
}

export type WeightAlert = { kind: 'fast'; perWeek: number } | { kind: 'stall'; change: number; tip: StallTip };

/**
 * 停滞したときの対処を1つだけ選ぶ。直近2週間のチェック記録から、守れていない習慣を優先する。
 * チェックの記録が少ないときは「歩数を増やす」。
 */
export function stallTip(d: AppData, today: string): StallTip {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const logged = days.filter((x) => d.habits[x] && Object.keys(d.habits[x]).length > 0);
  if (logged.length >= 7) {
    const rate = (id: string) => logged.filter((x) => d.habits[x][id]).length / logged.length;
    if (rate('nosugar') < 0.8) return { id: 'nosugar', text: '甘い飲み物ゼロの日を増やす（水・お茶・無糖へ）' };
    if (rate('rice') < 0.6) return { id: 'rice', text: 'ご飯を毎食150gに戻す（2週間だけ量る）' };
    if (rate('steps') < 0.6) return { id: 'steps', text: 'まず毎日8,000歩をそろえる' };
    if (rate('sleep') < 0.6) return { id: 'sleep', text: '7時間睡眠を先に整える（寝不足は食欲を上げる）' };
  }
  return { id: 'more-steps', text: '歩数を＋2,000歩（1日10,000歩）にする' };
}

/**
 * - 週1kg以上の減少が2週続く → 食べなさすぎ（開始3週間は水分で落ちやすいので見ない）
 * - 2週間 7日平均が 0.2kg 以上減らない → 停滞
 */
export function weightAlert(d: AppData, today: string): WeightAlert | null {
  const e = weightEntries(d.weights);
  if (!e.length) return null;
  if (currentWeight(d) <= d.settings.goalWeight) return null;
  const L = e[e.length - 1].d;
  if (dayDiff(L, today) > 7) return null;
  const sinceStart = dayDiff(firstComp(d).d, L);
  const w = d.weights;
  const a0 = avg7(w, L);
  const a1 = avg7(w, addDays(L, -7));
  const a2 = avg7(w, addDays(L, -14));
  const enough0 = countIn(w, addDays(L, -6), L) >= 3;
  const enough1 = countIn(w, addDays(L, -13), addDays(L, -7)) >= 3;
  const enough2 = countIn(w, addDays(L, -20), addDays(L, -14)) >= 3;
  if (a0 === null || !enough0) return null;

  if (sinceStart >= 21 && a1 !== null && a2 !== null && enough1 && enough2) {
    if (a0 - a1 <= -PACE.tooFast && a1 - a2 <= -PACE.tooFast) return { kind: 'fast', perWeek: (a0 - a2) / 2 };
  }
  if (sinceStart >= 14 && a2 !== null && enough2) {
    const change = a0 - a2;
    if (change > -0.2) return { kind: 'stall', change, tip: stallTip(d, today) };
  }
  return null;
}

/* ---------- 曜日・チェック ---------- */

export const dayTypeOf = (d: AppData, date: string): DayType => d.settings.schedule[String(weekday(date))] ?? 'rest';

export const checksFor = (d: AppData, date: string) => {
  const gym = isGym(dayTypeOf(d, date));
  return CHECKS.filter((c) => !c.gymOnly || gym);
};

/** その日のチェック達成率（0〜1） */
export function habitRate(d: AppData, date: string) {
  const list = checksFor(d, date);
  const done = d.habits[date] ?? {};
  const n = list.filter((c) => done[c.id]).length;
  return { n, total: list.length, rate: list.length ? n / list.length : 0 };
}

/** 次のジムの日（今日を含む）。ジムの日がなければ A */
export function nextGymDay(d: AppData, today: string) {
  for (let i = 0; i < 7; i++) {
    const t = dayTypeOf(d, addDays(today, i));
    if (isGym(t)) return t;
  }
  return 'A' as const;
}

/* ---------- 食事の週カウント ---------- */

export function weekFoodCount(d: AppData, today: string, key: FoodKey) {
  const mon = mondayOf(today);
  let n = 0;
  for (let i = 0; i < 7; i++) n += d.food[addDays(mon, i)]?.[key] ?? 0;
  return n;
}

/* ---------- 睡眠 ---------- */

export function sleepPlan(bed: string, wake: string) {
  const b = toMin(bed);
  const w = toMin(wake);
  const len = (w - b + 1440) % 1440;
  return {
    hours: Math.round(len / 6) / 10,
    timeline: [
      { t: fromMin(w), what: '朝の光を浴びて朝ごはん' },
      { t: '15:00〜', what: 'カフェインを控える' },
      { t: fromMin(b - 180), what: 'までに夕食を終える' },
      { t: fromMin(b - 90), what: 'お風呂（湯船15分）' },
      { t: fromMin(b - 30), what: 'スマホを置く' },
      { t: fromMin(b), what: '寝る' },
    ],
  };
}

/* ---------- ディロード（8週間トレーニング → 1週間 7割） ---------- */

export const DELOAD_CYCLE = 9;

export function trainingWeek(date: string, start = START_DATE) {
  const diff = dayDiff(start, date);
  return diff < 0 ? -1 : Math.floor(diff / 7);
}

export const isDeloadWeek = (date: string, start = START_DATE) => {
  const w = trainingWeek(date, start);
  return w >= 0 && w % DELOAD_CYCLE === DELOAD_CYCLE - 1;
};

/** いま、または次のディロード週の範囲 */
export function deloadWindow(today: string, start = START_DATE) {
  const w = Math.max(0, trainingWeek(today, start));
  const k = Math.floor(w / DELOAD_CYCLE) * DELOAD_CYCLE + DELOAD_CYCLE - 1;
  const from = addDays(start, k * 7);
  return { from, to: addDays(from, 6), active: isDeloadWeek(today, start) };
}
