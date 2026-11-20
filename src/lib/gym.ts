// ジムの予定（SPEC.md「ジム」）：曜日ごとの予定、ベンチの日とデッドの日の交互、8週ごとの軽めの週
import type { Session } from '../data/plan';
import { addDays, dayDiff, mondayOf, weekday } from './date';
import type { AppData, DayKind } from './schema';

export const dayKind = (d: AppData, date: string): DayKind => d.settings.week[weekday(date)];

export const KIND_LABEL: Record<DayKind, string> = { lift: '筋トレ', cardio: '有酸素', rest: '休み' };

/**
 * その日に行う筋トレ。記録済みならそれ、まだなら前回の反対（最初はベンチの日）
 */
export function sessionFor(d: AppData, date: string): Session {
  if (d.sessions[date]) return d.sessions[date];
  const before = Object.keys(d.sessions)
    .filter((k) => k < date)
    .sort();
  const last = before[before.length - 1];
  if (!last) return 'A';
  return d.sessions[last] === 'A' ? 'B' : 'A';
}

/**
 * 並んだ日付の筋トレの予定。記録した日はその種類、まだの筋トレの日は前の筋トレの反対にする
 * （今週の表で、先の日曜まで交互に見せるため）
 */
export function projectSessions(d: AppData, dates: string[]): Record<string, Session> {
  const out: Record<string, Session> = {};
  let prev: Session | null = null;
  for (const dt of [...dates].sort()) {
    if (d.sessions[dt]) out[dt] = d.sessions[dt];
    else if (dayKind(d, dt) === 'lift') out[dt] = prev === null ? sessionFor(d, dt) : prev === 'A' ? 'B' : 'A';
    else continue;
    prev = out[dt];
  }
  return out;
}

/** 開始した週を1週目として何週目か */
export const weekNo = (start: string, date: string) => Math.floor(dayDiff(mondayOf(start), date) / 7) + 1;

/** 8週ごとの1週間は軽めの週（重さはいつもの7割） */
export const DELOAD_EVERY = 8;

export const isDeloadWeek = (start: string, date: string) => {
  const n = weekNo(start, date);
  return n > 0 && n % DELOAD_EVERY === 0;
};

/** 今週が軽めの週ならその期間、違えば次の軽めの週 */
export function deloadWindow(start: string, today: string) {
  const n = weekNo(start, today);
  const k = n > 0 && n % DELOAD_EVERY === 0 ? n : (Math.floor(Math.max(n, 0) / DELOAD_EVERY) + 1) * DELOAD_EVERY;
  const from = addDays(mondayOf(start), (k - 1) * 7);
  return { active: k === n, from, to: addDays(from, 6) };
}
