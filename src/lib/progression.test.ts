import { describe, expect, it } from 'vitest';
import { WORKOUTS, type Exercise } from '../data/plan';
import { suggest, suggestionText } from './progression';

const squat = WORKOUTS.A.ex[0]; // 3×6〜10, +5kg
// 自重種目（いまのメニューにはないが、種目を足したときのために確認）
const backext: Exercise = {
  id: 'backext', n: 'バックエクステンション', where: 'バックエクステンション（1F）', focus: 'hams',
  sets: 2, lo: 12, hi: 15, rest: '60秒', restSec: 60, inc: 0, tip: '',
};
const today = '2026-10-14';

describe('漸進性の自動提案', () => {
  it('記録なし → 初回', () => {
    expect(suggestionText(suggest(squat, [], today))).toBe('初回：「あと2回できる」重さを探す');
  });
  it('全セットで上限回数達成 → 増量幅ぶん上げる', () => {
    const s = suggest(squat, [{ d: '2026-10-07', w: 60, r: [10, 10, 10] }], today);
    expect(s).toEqual({ kind: 'up', w: 65 });
    expect(suggestionText(s)).toBe('次回は 65kg に上げる');
  });
  it('セット数が足りないときは上げない', () => {
    expect(suggest(squat, [{ d: '2026-10-07', w: 60, r: [10, 10] }], today).kind).toBe('hold-more');
  });
  it('下限を割ったセットあり → 同じ重量（きつければ下げる）', () => {
    const s = suggest(squat, [{ d: '2026-10-07', w: 60, r: [8, 6, 5] }], today);
    expect(suggestionText(s)).toBe('次回も 60kg（きつければ下げる）');
  });
  it('それ以外 → 同じ重量で回数を増やす', () => {
    const s = suggest(squat, [{ d: '2026-10-07', w: 60, r: [10, 9, 8] }], today);
    expect(suggestionText(s)).toBe('次回も 60kg で回数を増やす');
  });
  it('自重種目は上限達成でプレートか回数', () => {
    expect(suggest(backext, [{ d: '2026-10-11', w: 0, r: [15, 15] }], today).kind).toBe('bodyweight-up');
  });
  it('ディロード週は前回の7割', () => {
    const s = suggest(squat, [{ d: '2026-11-18', w: 80, r: [8, 8, 8] }], '2026-11-25');
    expect(s).toEqual({ kind: 'deload', w: 55, base: 80 });
  });
  it('ディロード週の記録は次の判断に使わない', () => {
    const hist = [
      { d: '2026-11-18', w: 80, r: [9, 8, 8] },
      { d: '2026-11-25', w: 55, r: [10, 10, 10] },
    ];
    expect(suggest(squat, hist, '2026-12-02')).toEqual({ kind: 'hold-more', w: 80 });
  });
});
