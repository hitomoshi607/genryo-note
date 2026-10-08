import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './seed';
import { EQUIPMENT, WORKOUTS, weeklySets } from './plan';

const all = Object.values(WORKOUTS).flatMap((w) => w.ex);
const byMuscle = Object.fromEntries(weeklySets().map((x) => [x.m, x]));

describe('筋トレメニュー', () => {
  it('ジムの設備リストにあるものだけを使う', () => {
    const allowed = new Set<string>(EQUIPMENT);
    for (const e of all) for (const part of e.where.split('＋')) expect(allowed.has(part), `${e.n}: ${part}`).toBe(true);
  });

  it('複数の日に出てくる種目は内容がそろっている（記録と提案を共有するため）', () => {
    const seen = new Map<string, string>();
    for (const e of all) {
      const key = JSON.stringify([e.n, e.where, e.sets, e.lo, e.hi, e.inc]);
      if (seen.has(e.id)) expect(key, e.id).toBe(seen.get(e.id));
      seen.set(e.id, key);
    }
  });

  it('脚の前・胸・背中は週3回・9セット以上', () => {
    for (const m of ['quads', 'chest', 'back']) {
      expect(byMuscle[m].days, m).toBe(3);
      expect(byMuscle[m].sets, m).toBeGreaterThanOrEqual(9);
    }
  });

  it('もも裏は週2回以上、腹は週3回・8セット以上（お腹まわり優先）', () => {
    expect(byMuscle.hams.days).toBeGreaterThanOrEqual(2);
    expect(byMuscle.abs.days).toBe(3);
    expect(byMuscle.abs.sets).toBeGreaterThanOrEqual(8);
  });

  it('どの部位も週2セット以上は直接鍛える', () => {
    for (const x of weeklySets()) expect(x.sets, x.label).toBeGreaterThanOrEqual(2);
  });

  it('1回あたり 20セット以内（約60〜80分に収める）', () => {
    for (const [k, w] of Object.entries(WORKOUTS)) expect(w.ex.reduce((n, e) => n + e.sets, 0), k).toBeLessThanOrEqual(20);
  });

  it('ジムの日は水・金・日（間が48・48・72時間）', () => {
    const s = DEFAULT_SETTINGS.schedule;
    expect([s['3'], s['5'], s['0']]).toEqual(['A', 'B', 'C']);
  });
});
