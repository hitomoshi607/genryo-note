// 体重の計算（SPEC.md「体重」）：7日平均、毎月 −perMonth kg の計画線、目標までの残り
import { addDays, addMonths, dayDiff } from './date';
import { r1 } from './format';
import type { AppData, Settings } from './schema';

export interface Point {
  d: string;
  w: number;
}

export const sortedWeights = (weights: Record<string, number>): Point[] =>
  Object.entries(weights)
    .map(([d, w]) => ({ d, w }))
    .sort((a, b) => a.d.localeCompare(b.d));

/** その日までの7日間（その日を含む）の平均。記録がなければ null */
export function avg7(weights: Record<string, number>, date: string): number | null {
  const from = addDays(date, -6);
  const vs = Object.entries(weights)
    .filter(([d]) => d >= from && d <= date)
    .map(([, w]) => w);
  return vs.length ? r1(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
}

/** 記録のある日ごとの7日平均（グラフ用） */
export const avgSeries = (weights: Record<string, number>): Point[] =>
  sortedWeights(weights).map(({ d }) => ({ d, w: avg7(weights, d)! }));

/** 目標に届くまでの月数（端数は切り上げ） */
export const monthsToGoal = (s: Settings) => Math.max(1, Math.ceil(r1((s.startWeight - s.goalWeight) / s.perMonth)));

export const goalDate = (s: Settings) => addMonths(s.startDate, monthsToGoal(s));

/** 開始から n か月目の区切りの日と、そのときの計画体重 */
export const checkpoint = (s: Settings, n: number) => ({
  d: addMonths(s.startDate, n),
  w: r1(Math.max(s.goalWeight, s.startWeight - s.perMonth * n)),
});

/** その日の計画体重。毎月の区切りの間は日数でならす。開始前は開始時、目標日以降は目標の体重 */
export function planAt(s: Settings, date: string): number {
  if (date <= s.startDate) return s.startWeight;
  if (date >= goalDate(s)) return s.goalWeight;
  let n = 0;
  while (addMonths(s.startDate, n + 1) <= date) n++;
  const a = checkpoint(s, n);
  const b = checkpoint(s, n + 1);
  const t = dayDiff(a.d, date) / dayDiff(a.d, b.d);
  return r1(Math.max(s.goalWeight, a.w + (b.w - a.w) * t));
}

/** いまの体重（最新の記録の日の7日平均）と、計画との差 */
export function weightStatus(d: AppData, today: string) {
  const pts = sortedWeights(d.weights).filter((p) => p.d <= today);
  const last = pts[pts.length - 1];
  if (!last) return null;
  const now = avg7(d.weights, last.d)!;
  const plan = planAt(d.settings, last.d);
  return {
    last,
    now,
    plan,
    /** プラスなら計画より重い */
    diff: r1(now - plan),
    left: r1(now - d.settings.goalWeight),
  };
}

/** 今の1か月（区切りの日から次の区切りの日まで）の計画と実際 */
export function monthStatus(d: AppData, today: string) {
  const s = d.settings;
  if (today < s.startDate) return null;
  let n = 0;
  while (addMonths(s.startDate, n + 1) <= today) n++;
  const a = checkpoint(s, n);
  const b = checkpoint(s, n + 1);
  // 区切りの日の体重：その日までの7日平均。なければ計画の値から始める
  const from = avg7(d.weights, a.d) ?? a.w;
  const st = weightStatus(d, today);
  return {
    n: n + 1,
    from: a.d,
    to: b.d,
    target: r1(b.w - a.w),
    change: st && st.last.d >= a.d ? r1(st.now - from) : 0,
    goalW: b.w,
  };
}
