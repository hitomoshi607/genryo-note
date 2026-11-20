import { describe, expect, it } from 'vitest';
import { WORKOUTS } from '../data/plan';
import { deloadWeight, suggest, suggestionText } from './progression';

const bench = WORKOUTS.A.ex[0]; // 3 × 6〜10、+2.5kg
const start = '2026-11-20';

describe('次回の重さ', () => {
  it('記録がなければ初回', () => {
    expect(suggest(bench, [], '2026-11-20', start).kind).toBe('first');
  });
  it('全セットで上限に届いたら +2.5kg', () => {
    const s = suggest(bench, [{ d: '2026-11-20', w: 50, r: [10, 10, 10] }], '2026-11-22', start);
    expect(s).toEqual({ kind: 'up', w: 52.5 });
    expect(suggestionText(s)).toBe('52.5kg に上げる');
  });
  it('範囲内なら同じ重さで回数を増やす', () => {
    expect(suggest(bench, [{ d: '2026-11-20', w: 50, r: [10, 9, 8] }], '2026-11-22', start)).toEqual({ kind: 'hold-more', w: 50 });
  });
  it('下限に届かなければ同じ重さ、2回続いたら1段階下げる', () => {
    const one = [{ d: '2026-11-20', w: 50, r: [7, 6, 5] }];
    expect(suggest(bench, one, '2026-11-22', start)).toEqual({ kind: 'hold-low', w: 50 });
    const two = [...one, { d: '2026-11-22', w: 50, r: [6, 5, 5] }];
    expect(suggest(bench, two, '2026-11-25', start)).toEqual({ kind: 'down', w: 47.5 });
  });
  it('今日の記録は判断に使わない', () => {
    const h = [
      { d: '2026-11-20', w: 50, r: [8, 8, 8] },
      { d: '2026-11-22', w: 50, r: [10, 10, 10] },
    ];
    expect(suggest(bench, h, '2026-11-22', start)).toEqual({ kind: 'hold-more', w: 50 });
  });
  it('軽めの週は7割。軽めの週の記録は次の判断に使わない', () => {
    expect(deloadWeight(60)).toBe(42.5);
    const h = [{ d: '2026-12-30', w: 60, r: [10, 10, 10] }];
    expect(suggest(bench, h, '2027-01-06', start)).toEqual({ kind: 'deload', w: 42.5, base: 60 });
    const after = [...h, { d: '2027-01-06', w: 42.5, r: [10, 10, 10] }];
    expect(suggest(bench, after, '2027-01-13', start)).toEqual({ kind: 'up', w: 62.5 });
  });
});
