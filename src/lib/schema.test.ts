import { describe, expect, it } from 'vitest';
import { defaults, isOldVersion, normalize, summarize } from './schema';

describe('保存データ', () => {
  it('新しく始めると、開始時の体重 82kg が最初の記録になる', () => {
    const d = defaults();
    expect(d.v).toBe(3);
    expect(d.weights).toEqual({ '2026-11-20': 82 });
    expect(normalize({})).toEqual(d);
  });
  it('壊れた項目は捨て、同じ日の筋トレの記録は1つにする', () => {
    const d = normalize({
      weights: { '2026-11-21': 81.64, xx: 80, '2026-11-22': 999 },
      sleep: { '2026-11-21': { bed: '23:30', wake: '07:00' }, '2026-11-22': { bed: '25:00', wake: '07:00' } },
      lifts: {
        bench: [
          { d: '2026-11-22', w: 50, r: [10, 9, 8] },
          { d: '2026-11-20', w: 47.5, r: [10, 10, 10] },
          { d: '2026-11-22', w: 52.5, r: [8, 8, 7] },
          { d: '2026-11-23', w: 50, r: [] },
        ],
      },
      sessions: { '2026-11-22': 'A', '2026-11-25': 'C' },
      cardio: { '2026-11-23': { min: 25, incline: 12, speed: 4.8 }, '2026-11-24': { min: 0 } },
      settings: { week: ['lift'], perMonth: 9, goalWeight: 72 },
    });
    expect(d.weights).toEqual({ '2026-11-21': 81.6 });
    expect(Object.keys(d.sleep)).toEqual(['2026-11-21']);
    expect(d.lifts.bench.map((r) => [r.d, r.w])).toEqual([
      ['2026-11-20', 47.5],
      ['2026-11-22', 52.5],
    ]);
    expect(d.sessions).toEqual({ '2026-11-22': 'A' });
    expect(Object.keys(d.cardio)).toEqual(['2026-11-23']);
    expect(d.settings.week).toEqual(defaults().settings.week);
    expect(d.settings.perMonth).toBe(2);
    expect(d.settings.goalWeight).toBe(72);
  });
  it('件数のまとめ', () => {
    const s = summarize(normalize({ weights: { '2026-11-20': 82, '2026-11-21': 81.8 }, sleep: { '2026-11-21': { bed: '23:00', wake: '06:30' } } }));
    expect(s).toMatchObject({ weights: 2, from: '2026-11-20', to: '2026-11-21', sleep: 1, lifts: 0, cardio: 0 });
  });
  it('前の版のバックアップを見分ける', () => {
    expect(isOldVersion({ v: 2, weights: {}, habits: {} })).toBe(true);
    expect(isOldVersion({ weights: {}, meals: {} })).toBe(true);
    expect(isOldVersion(defaults())).toBe(false);
  });
});
