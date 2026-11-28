import { describe, expect, it } from 'vitest';
import { FIRST_COMP } from '../data/plan';
import { atGoal, compDiff, dailyGuide, fatKg, leanKg, musclePct, visceralLabel } from './comp';
import { defaults } from './schema';

const c = { ...FIRST_COMP.c };
const s = defaults().settings;

describe('体組成（TANITA 2026-11-28）', () => {
  it('体組成計の表示と同じ脂肪量・除脂肪量・筋肉率になる', () => {
    expect(fatKg(c)).toBe(21.2);
    expect(leanKg(c)).toBe(59.0);
    expect(musclePct(c)).toBe(69.7);
  });
  it('除脂肪量を保って 70kg になると体脂肪率 15.7%、落とす脂肪は 10.2kg', () => {
    expect(atGoal(c, s)).toEqual({ fatPct: 15.7, fatToLose: 10.2 });
  });
  it('1日の目安：消費 2,600・1日 470kcal 減らして 約2,100kcal、たんぱく質 130g', () => {
    expect(dailyGuide(c, s)).toEqual({ burn: 2600, deficit: 470, kcal: 2100, protein: 130 });
  });
  it('内臓脂肪レベルは TANITA の区分', () => {
    expect([9, 10, 11, 14.5, 15].map(visceralLabel)).toEqual(['標準', 'やや過剰', 'やや過剰', 'やや過剰', '過剰']);
  });
  it('前回との差', () => {
    const next = { w: 78.2, fat: 24.6, muscle: 55.8 };
    const cd = compDiff({ '2026-11-28': c, '2026-12-27': next })!;
    expect(cd.now.d).toBe('2026-12-27');
    expect(cd.d).toEqual({ w: -2, fat: -1.8, fatKg: -2, lean: 0, muscle: -0.1 });
    expect(compDiff({ '2026-11-28': c })!.d).toBeNull();
  });
});
