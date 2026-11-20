import { describe, expect, it } from 'vitest';
import { dayKind, deloadWindow, isDeloadWeek, projectSessions, sessionFor, weekNo } from './gym';
import { defaults } from './schema';

const WEEK = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];

describe('曜日ごとの予定', () => {
  it('水・金・日は筋トレ、月・火・木は有酸素、土は休み', () => {
    const d = defaults();
    expect(WEEK.map((x) => dayKind(d, x))).toEqual(['cardio', 'cardio', 'lift', 'cardio', 'lift', 'rest', 'lift']);
  });
});

describe('ベンチの日とデッドの日の交互', () => {
  it('最初はベンチの日、次は前回の反対', () => {
    const d = defaults();
    expect(sessionFor(d, '2026-11-20')).toBe('A');
    const d2 = { ...d, sessions: { '2026-11-20': 'A' as const } };
    expect(sessionFor(d2, '2026-11-20')).toBe('A');
    expect(sessionFor(d2, '2026-11-22')).toBe('B');
  });
  it('今週の先の筋トレの日も交互に見せる', () => {
    const d = { ...defaults(), sessions: { '2026-11-22': 'B' as const } };
    expect(projectSessions(d, WEEK)).toEqual({ '2026-11-25': 'A', '2026-11-27': 'B', '2026-11-29': 'A' });
  });
});

describe('軽めの週（8週ごと）', () => {
  const start = '2026-11-20';
  it('開始した週が1週目', () => {
    expect(weekNo(start, '2026-11-16')).toBe(1);
    expect(weekNo(start, '2026-11-23')).toBe(2);
  });
  it('8週目は 2027-01-04〜01-10', () => {
    expect(isDeloadWeek(start, '2027-01-03')).toBe(false);
    expect(isDeloadWeek(start, '2027-01-04')).toBe(true);
    expect(isDeloadWeek(start, '2027-01-10')).toBe(true);
    expect(deloadWindow(start, '2026-11-20')).toEqual({ active: false, from: '2027-01-04', to: '2027-01-10' });
    expect(deloadWindow(start, '2027-01-06')).toEqual({ active: true, from: '2027-01-04', to: '2027-01-10' });
    expect(deloadWindow(start, '2027-01-11').from).toBe('2027-03-01');
  });
});
