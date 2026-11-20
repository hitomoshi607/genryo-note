// 次回の重さの提案（SPEC.md「重さの上げ方」）：全セットで上限回数に届いたら増量、下限割れが2回続いたら1段階下げる
import type { Exercise } from '../data/plan';
import { kg, r1 } from './format';
import { isDeloadWeek } from './gym';
import type { LiftRec } from './schema';

export type Suggestion =
  | { kind: 'first' }
  | { kind: 'up'; w: number }
  | { kind: 'hold-low'; w: number }
  | { kind: 'hold-more'; w: number }
  | { kind: 'down'; w: number }
  | { kind: 'deload'; w: number; base: number };

/** 軽めの週の重さ（前回の7割を 2.5kg 刻みに丸める） */
export const deloadWeight = (w: number) => r1(Math.round((w * 0.7) / 2.5) * 2.5);

/** hist は日付順。今日の記録は含めない */
export function suggest(ex: Exercise, hist: LiftRec[], today: string, start: string): Suggestion {
  // 軽めの週の記録は、重さを上げるかどうかの判断に使わない
  const past = hist.filter((h) => h.d < today);
  const normal = past.filter((h) => !isDeloadWeek(start, h.d));
  const last = normal[normal.length - 1] ?? past[past.length - 1];
  if (!last) return { kind: 'first' };
  if (isDeloadWeek(start, today)) return { kind: 'deload', w: deloadWeight(last.w), base: last.w };
  const r = last.r.slice(0, ex.sets);
  const missed = (h: LiftRec) => h.r.slice(0, ex.sets).some((x) => x < ex.lo);
  if (r.length >= ex.sets && r.every((x) => x >= ex.hi)) return { kind: 'up', w: r1(last.w + ex.inc) };
  if (missed(last)) {
    // 同じ重さで2回続けて下限に届かなければ1段階下げる
    const before = normal[normal.length - 2];
    if (before && before.w === last.w && missed(before)) return { kind: 'down', w: r1(Math.max(0, last.w - ex.inc)) };
    return { kind: 'hold-low', w: last.w };
  }
  return { kind: 'hold-more', w: last.w };
}

export function suggestionText(s: Suggestion): string {
  switch (s.kind) {
    case 'first':
      return '初回：あと2回できる重さを探す';
    case 'up':
      return `${kg(s.w)}kg に上げる`;
    case 'hold-low':
      return `${kg(s.w)}kg のまま（きつければ下げる）`;
    case 'hold-more':
      return `${kg(s.w)}kg のまま回数を増やす`;
    case 'down':
      return `${kg(s.w)}kg に下げる`;
    case 'deload':
      return `軽めの週：${kg(s.w)}kg`;
  }
}

/** 入力欄に最初から入れておく重さ */
export const suggestedWeight = (s: Suggestion): number | null => (s.kind === 'first' ? null : s.w);
