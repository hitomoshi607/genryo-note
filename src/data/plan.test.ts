import { describe, expect, it } from 'vitest';
import { ALL_EXERCISES, EQUIPMENT, WORKOUTS, pace } from './plan';

describe('筋トレメニュー', () => {
  const all = Object.values(WORKOUTS);

  it('使う設備はすべていつものジムにある', () => {
    const eq = new Set<string>(EQUIPMENT);
    for (const ex of ALL_EXERCISES) {
      for (const w of [...ex.where, ...ex.alt.where]) expect(eq.has(w), `${ex.n}: ${w}`).toBe(true);
    }
  });
  it('どの日も4種目で、脚が入り、押す・引くがそろう', () => {
    for (const w of all) {
      expect(w.ex).toHaveLength(4);
      expect(w.ex.some((e) => e.part === 'legs')).toBe(true);
      expect(w.ex.some((e) => e.part === 'push')).toBe(true);
      expect(w.ex.some((e) => e.part === 'pull')).toBe(true);
    }
  });
  it('ベンチの日にベンチプレス、デッドの日にデッドリフト', () => {
    expect(WORKOUTS.A.ex[0].id).toBe('bench');
    expect(WORKOUTS.B.ex[0].id).toBe('deadlift');
  });
  it('1種目10分ほどに収まる（3セット × (動作45秒＋休憩)）', () => {
    for (const ex of ALL_EXERCISES) expect(ex.sets * (45 + ex.restSec)).toBeLessThanOrEqual(600);
  });
  it('種目の id は重ならない', () => {
    expect(new Set(ALL_EXERCISES.map((e) => e.id)).size).toBe(ALL_EXERCISES.length);
  });
  it('時速4.8km は 1km 12:30', () => {
    expect(pace(4.8)).toBe('12:30');
    expect(pace(6)).toBe('10:00');
  });
});
