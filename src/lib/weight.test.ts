import { describe, expect, it } from 'vitest';
import { defaults } from './schema';
import { avg7, checkpoint, goalDate, monthStatus, monthsToGoal, planAt, weightStatus } from './weight';

const s = defaults().settings;

describe('体重の計画（82kg から毎月 −2kg、70kg まで）', () => {
  it('初期値', () => {
    expect(s).toMatchObject({ startDate: '2026-11-20', startWeight: 82, goalWeight: 70, perMonth: 2 });
    expect(monthsToGoal(s)).toBe(6);
    expect(goalDate(s)).toBe('2027-05-20');
  });
  it('毎月の区切りで −2kg', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => checkpoint(s, n))).toEqual([
      { d: '2026-11-20', w: 82 },
      { d: '2026-12-20', w: 80 },
      { d: '2027-01-20', w: 78 },
      { d: '2027-02-20', w: 76 },
      { d: '2027-03-20', w: 74 },
      { d: '2027-04-20', w: 72 },
      { d: '2027-05-20', w: 70 },
    ]);
  });
  it('区切りの間は日数でならす。開始前・目標日のあとは端の値', () => {
    expect(planAt(s, '2026-11-01')).toBe(82);
    expect(planAt(s, '2026-12-05')).toBe(81);
    expect(planAt(s, '2026-12-20')).toBe(80);
    expect(planAt(s, '2027-02-04')).toBe(77);
    expect(planAt(s, '2027-08-01')).toBe(70);
  });
});

describe('7日平均と計画との差', () => {
  const w = { '2026-11-20': 82.0, '2026-11-21': 81.6, '2026-11-23': 81.8, '2026-11-27': 81.2, '2026-11-28': 81.0 };

  it('その日を含む7日間の平均', () => {
    expect(avg7(w, '2026-11-26')).toBe(81.8); // 11/20〜11/26 の3件
    expect(avg7(w, '2026-11-28')).toBe(81.3); // 11/22〜11/28 の3件
    expect(avg7(w, '2026-11-10')).toBeNull();
  });
  it('いまの7日平均と計画の差（プラスは計画より重い）', () => {
    const d = { ...defaults(), weights: w };
    const st = weightStatus(d, '2026-11-28')!;
    expect(st.now).toBe(81.3);
    expect(st.plan).toBe(81.5);
    expect(st.diff).toBe(-0.2);
    expect(st.left).toBe(11.3);
  });
  it('今の1か月の変化', () => {
    const d = { ...defaults(), weights: { ...w, '2026-12-20': 80.4, '2026-12-27': 79.6 } };
    const m = monthStatus(d, '2026-12-27')!;
    expect(m).toMatchObject({ n: 2, from: '2026-12-20', to: '2027-01-20', target: -2, goalW: 78 });
    expect(m.change).toBe(-0.8);
  });
});
