import { describe, expect, it } from 'vitest';
import { defaults, isOldVersion, normalize, summarize } from './schema';

describe('保存データ', () => {
  it('新しく始めると、開始時の体重 82kg と 11/28 の体組成が最初の記録になる', () => {
    const d = defaults();
    expect(d.v).toBe(3);
    expect(d.weights).toEqual({ '2026-11-20': 82, '2026-11-28': 80.2 });
    expect(d.comp).toEqual({ '2026-11-28': { w: 80.2, fat: 26.4, muscle: 55.9, visceral: 11, bmr: 1731, bone: 3.1, water: 49.6 } });
    expect(normalize({})).toEqual(d);
  });
  it('体組成を足す前のデータには 11/28 の体組成を入れ、その日の体重がなければ 80.2kg を入れる', () => {
    const a = normalize({ weights: { '2026-11-20': 82, '2026-11-25': 81 } });
    expect(Object.keys(a.comp)).toEqual(['2026-11-28']);
    expect(a.weights['2026-11-28']).toBe(80.2);
    const b = normalize({ weights: { '2026-11-28': 80.6 } });
    expect(b.weights['2026-11-28']).toBe(80.6);
    // 体組成のあるデータ（消した後を含む）には入れない
    const e = normalize({ weights: { '2026-11-25': 81 }, comp: {} });
    expect(e.comp).toEqual({});
    expect(e.weights['2026-11-28']).toBeUndefined();
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
      comp: { '2026-11-28': { w: 80.2, fat: 26.4, muscle: 90 }, '2026-11-29': { w: 80, fat: 26, muscle: 55.8, visceral: 10.7, bmr: 1720.4 } },
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
    expect(d.comp).toEqual({ '2026-11-29': { w: 80, fat: 26, muscle: 55.8, visceral: 10.5, bmr: 1720 } });
    expect(d.settings.week).toEqual(defaults().settings.week);
    expect(d.settings.perMonth).toBe(2);
    expect(d.settings.goalWeight).toBe(72);
  });
  it('件数のまとめ', () => {
    const s = summarize(normalize({ weights: { '2026-11-20': 82, '2026-11-21': 81.8 }, sleep: { '2026-11-21': { bed: '23:00', wake: '06:30' } }, comp: {} }));
    expect(s).toMatchObject({ weights: 2, from: '2026-11-20', to: '2026-11-21', sleep: 1, lifts: 0, cardio: 0, comp: 0 });
  });
  it('前の版のバックアップを見分ける', () => {
    expect(isOldVersion({ v: 2, weights: {}, habits: {} })).toBe(true);
    expect(isOldVersion({ weights: {}, meals: {} })).toBe(true);
    expect(isOldVersion(defaults())).toBe(false);
  });
});
