import { describe, expect, it } from 'vitest';
import { defaults, mergeData, normalize } from './schema';

// SPEC.md「9. 既存データの引き継ぎ」の例
const PROTOTYPE = {
  v: 2,
  settings: {
    age: 21, height: 165, goalWeight: 69,
    bed: '23:30', wake: '07:00', theme: 'auto',
    schedule: { '0': 'C', '1': 'uni', '2': 'uni', '3': 'A', '4': 'uni', '5': 'B', '6': 'rest' },
  },
  weights: { '2026-09-27': 78.3 },
  habits: { '2026-09-27': { sleep: true, nosugar: true } },
  sos: { '2026-09-27': { held: 1, ate: 0 } },
  lifts: { squat: [{ d: '2026-09-27', w: 60, r: [10, 10, 10] }] },
  comp: [{ d: '2026-09-27', w: 78.3, fp: 24.2, m: 56.3, v: 11, bmr: 1735 }],
};

describe('試作版データの読み込み', () => {
  it('そのまま読める', () => {
    const d = normalize(PROTOTYPE);
    expect(d.weights).toEqual({ '2026-09-27': 78.3 });
    expect(d.habits['2026-09-27']).toEqual({ sleep: true, nosugar: true });
    expect(d.sos['2026-09-27']).toEqual({ held: 1, ate: 0 });
    expect(d.lifts.squat).toEqual([{ d: '2026-09-27', w: 60, r: [10, 10, 10] }]);
    expect(d.comp[0].bmr).toBe(1735);
    expect(d.food).toEqual({});
  });
  it('おかしな値は捨てる', () => {
    const d = normalize({ ...PROTOTYPE, weights: { '2026-09-27': 78.3, 'bad': 70, '2026-10-01': 'x', '2026-10-02': 900 } });
    expect(Object.keys(d.weights)).toEqual(['2026-09-27']);
  });
  it('関係ない JSON は拒否', () => {
    expect(() => normalize({ foo: 1 })).toThrow();
    expect(() => normalize(null)).toThrow();
  });
  it('統合は同じ日付なら読み込んだ側を優先', () => {
    const cur = { ...defaults(), weights: { '2026-09-27': 78.3, '2026-10-08': 77.0 } };
    const inc = normalize({ ...PROTOTYPE, weights: { '2026-10-08': 76.8, '2026-10-01': 77.5 } });
    const m = mergeData(cur, inc);
    expect(m.weights).toEqual({ '2026-09-27': 78.3, '2026-10-01': 77.5, '2026-10-08': 76.8 });
  });
});
