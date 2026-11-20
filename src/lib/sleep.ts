// 睡眠の計算（SPEC.md「睡眠」）：寝た時刻と起きた時刻から睡眠時間・7日平均・寝る時刻のばらつき
import { addDays, fromMin, toMin } from './date';
import type { SleepRec } from './schema';

/** 睡眠時間（分）。日付をまたいでも正しく数える */
export const durationMin = (r: SleepRec) => {
  const m = (toMin(r.wake) - toMin(r.bed) + 1440) % 1440;
  return m;
};

/** 'H時間MM分' ではなく画面用の '7:05' */
export const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min) % 60).padStart(2, '0')}`;

/**
 * 寝る時刻を「正午からの分」に直す。23:30 も 0:30 も近い値になり、平均やばらつきを出せる
 */
const fromNoon = (hhmm: string) => (toMin(hhmm) - 720 + 1440) % 1440;
const backFromNoon = (m: number) => fromMin(Math.round(m) + 720);

/** 起きた日が [to−6, to] の記録 */
export function lastWeek(sleep: Record<string, SleepRec>, to: string) {
  const from = addDays(to, -6);
  return Object.entries(sleep)
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, r]) => ({ d, ...r, min: durationMin(r) }));
}

export function sleepStats(sleep: Record<string, SleepRec>, to: string) {
  const w = lastWeek(sleep, to);
  if (!w.length) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const beds = w.map((r) => fromNoon(r.bed));
  const wakes = w.map((r) => toMin(r.wake));
  return {
    nights: w.length,
    avgMin: Math.round(avg(w.map((r) => r.min))),
    avgBed: backFromNoon(avg(beds)),
    avgWake: fromMin(Math.round(avg(wakes))),
    /** 寝た時刻のいちばん早い日と遅い日の差（分） */
    bedSpread: Math.max(...beds) - Math.min(...beds),
  };
}
