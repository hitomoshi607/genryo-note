import { describe, expect, it } from 'vitest';
import { durationMin, hm, sleepStats } from './sleep';

describe('睡眠', () => {
  it('日付をまたいでも睡眠時間を数える', () => {
    expect(durationMin({ bed: '23:30', wake: '07:00' })).toBe(450);
    expect(durationMin({ bed: '01:15', wake: '08:00' })).toBe(405);
    expect(hm(450)).toBe('7:30');
    expect(hm(405)).toBe('6:45');
  });
  it('7日平均・寝る時刻の平均とばらつき（0時をまたいでも近い時刻として扱う）', () => {
    const sleep = {
      '2026-11-18': { bed: '23:30', wake: '07:00' },
      '2026-11-19': { bed: '00:30', wake: '07:30' },
      '2026-11-20': { bed: '00:00', wake: '07:00' },
      '2026-11-10': { bed: '03:00', wake: '06:00' }, // 7日より前なので数えない
    };
    const st = sleepStats(sleep, '2026-11-20')!;
    expect(st.nights).toBe(3);
    expect(st.avgMin).toBe(430);
    expect(st.avgBed).toBe('0:00');
    expect(st.avgWake).toBe('7:10');
    expect(st.bedSpread).toBe(60);
  });
  it('記録がなければ null', () => {
    expect(sleepStats({}, '2026-11-20')).toBeNull();
  });
});
