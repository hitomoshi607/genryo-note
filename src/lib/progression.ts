// 漸進性の自動提案（SPEC.md「漸進性の自動提案ロジック」）
import type { Exercise } from '../data/plan';
import { START_DATE } from '../data/seed';
import { isDeloadWeek } from './calc';
import { kg, r1 } from './format';
import type { LiftRec } from './schema';

export type Suggestion =
  | { kind: 'first' }
  | { kind: 'up'; w: number }
  | { kind: 'bodyweight-up' }
  | { kind: 'hold-low'; w: number }
  | { kind: 'hold-more'; w: number }
  | { kind: 'deload'; w: number; base: number };

/** ディロード週の重さ（前回の7割を、種目の刻みに丸める） */
export function deloadWeight(w: number, inc: number) {
  const step = inc >= 2.5 ? 2.5 : 1;
  return r1(Math.round((w * 0.7) / step) * step);
}

export function suggest(ex: Exercise, hist: LiftRec[], today: string, start = START_DATE): Suggestion {
  // ディロード週の記録は進め方の判断に使わない
  const normal = hist.filter((h) => !isDeloadWeek(h.d, start));
  const last = normal[normal.length - 1] ?? hist[hist.length - 1];
  if (!last) return { kind: 'first' };
  if (isDeloadWeek(today, start)) return { kind: 'deload', w: deloadWeight(last.w, ex.inc), base: last.w };
  const r = last.r.slice(0, ex.sets);
  if (r.length >= ex.sets && r.every((x) => x >= ex.hi)) {
    return ex.inc > 0 ? { kind: 'up', w: r1(last.w + ex.inc) } : { kind: 'bodyweight-up' };
  }
  if (r.some((x) => x < ex.lo)) return { kind: 'hold-low', w: last.w };
  return { kind: 'hold-more', w: last.w };
}

export function suggestionText(s: Suggestion): string {
  switch (s.kind) {
    case 'first':
      return '初回：「あと2回できる」重さを探す';
    case 'up':
      return `次回は ${kg(s.w)}kg に上げる`;
    case 'bodyweight-up':
      return '次回はプレートを持つか回数を増やす';
    case 'hold-low':
      return `次回も ${kg(s.w)}kg（きつければ下げる）`;
    case 'hold-more':
      return `次回も ${kg(s.w)}kg で回数を増やす`;
    case 'deload':
      return `ディロード週：${kg(s.w)}kg（いつもの7割）`;
  }
}

/** 入力欄に最初から入れておく重さ */
export function suggestedWeight(s: Suggestion): number | null {
  return s.kind === 'first' || s.kind === 'bodyweight-up' ? null : s.w;
}
