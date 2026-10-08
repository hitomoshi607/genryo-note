import { describe, expect, it } from 'vitest';
import { SEED_COMP } from '../data/seed';
import {
  avg7,
  calcTargets,
  deloadWindow,
  fatJudge,
  forecast,
  isDeloadWeek,
  katchMcArdle,
  leanMass,
  milestones,
  muscleJudge,
  nextMilestone,
  sleepPlan,
  stallTip,
  trendSlope,
  visceralJudge,
  weightAlert,
} from './calc';
import { addDays } from './date';
import { r1 } from './format';
import { defaults, type AppData } from './schema';

/** start から days 日分、毎日 perDay kg ずつ変わる体重を入れる */
function withWeights(start: string, days: number, w0: number, perDay: number, base = defaults()): AppData {
  const weights: Record<string, number> = {};
  for (let i = 0; i < days; i++) weights[addDays(start, i)] = r1(w0 + perDay * i);
  return { ...base, weights };
}

describe('初回の目標値（SPEC の初回値と一致すること）', () => {
  const t = calcTargets(SEED_COMP);
  it('除脂肪量 59.4kg', () => expect(r1(t.lbm)).toBe(59.4));
  it('基礎代謝は実測 1735 を使う', () => {
    expect(t.bmr).toBe(1735);
    expect(t.bmrMeasured).toBe(true);
  });
  it('消費カロリー = BMR × 1.5', () => expect(t.tdee).toBeCloseTo(2602.5));
  it('目標 2050 kcal', () => expect(t.kcal).toBe(2050));
  it('タンパク質 130g（除脂肪量 × 2.2）', () => expect(t.p).toBe(130));
  it('脂質 55g', () => expect(t.f).toBe(55));
  it('炭水化物 260g', () => expect(t.c).toBe(260));
});

describe('目標値の細部', () => {
  it('実測がなければ Katch-McArdle: 370 + 21.6 × LBM', () => {
    const t = calcTargets({ ...SEED_COMP, bmr: undefined });
    expect(t.bmrMeasured).toBe(false);
    expect(t.bmr).toBe(katchMcArdle(leanMass(SEED_COMP)));
    expect(t.bmr).toBe(1652);
  });
  it('下限は BMR + 150', () => {
    // BMR が高く体脂肪が少ないと (TDEE−550) が下限を割る… ことは通常ないので、極端な例で確認
    const t = calcTargets({ d: '2026-10-01', w: 50, fp: 10, m: 42, v: 3, bmr: 1500 });
    expect(t.kcal).toBe(Math.max(1650, Math.round((1500 * 1.5 - 550) / 50) * 50));
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr + 150);
  });
});

describe('段階目標', () => {
  const list = milestones(leanMass(SEED_COMP), 69);
  it('SPEC の表と一致', () => {
    expect(list.map((m) => m.w)).toEqual([76.0, 73.3, 69.8, 69.0]);
    expect(list.map((m) => m.pct)).toEqual([21.9, 19, 15, 14.0]);
  });
  it('次の目標は未達成の中でいちばん近いもの', () => {
    expect(nextMilestone(list, 78.3)?.w).toBe(76.0);
    expect(nextMilestone(list, 75.9)?.w).toBe(73.3);
    expect(nextMilestone(list, 69.0)).toBeNull();
  });
  it('ゴールより下の段階は出さない', () => {
    expect(milestones(leanMass(SEED_COMP), 72).map((m) => m.w)).toEqual([76.0, 73.3, 72]);
  });
});

describe('判定（TANITA）', () => {
  it('体脂肪率', () => {
    expect(fatJudge(24.2).label).toBe('軽肥満');
    expect(fatJudge(21.9).label).toBe('標準');
    expect(fatJudge(26.9).label).toBe('軽肥満');
    expect(fatJudge(27).label).toBe('肥満');
  });
  it('内臓脂肪', () => {
    expect(visceralJudge(11).label).toBe('やや過剰');
    expect(visceralJudge(9.5).label).toBe('標準');
    expect(visceralJudge(15).label).toBe('過剰');
  });
  it('筋肉量は初回比 −0.5kg まで「維持」', () => {
    expect(muscleJudge([SEED_COMP]).label).toBe('多');
    expect(muscleJudge([SEED_COMP, { ...SEED_COMP, d: '2026-11-01', m: 55.9 }]).label).toBe('維持');
    expect(muscleJudge([SEED_COMP, { ...SEED_COMP, d: '2026-11-01', m: 55.6 }]).label).toBe('要注意');
  });
});

describe('7日移動平均と到達予想', () => {
  it('7日平均は d−6〜d の平均', () => {
    const w = { '2026-10-01': 78, '2026-10-05': 77, '2026-10-07': 76, '2026-09-30': 99 };
    expect(avg7(w, '2026-10-07')).toBeCloseTo(77);
  });
  it('データ5点未満・期間9日未満では傾きを出さない', () => {
    expect(trendSlope(withWeights('2026-10-01', 4, 78, -0.1).weights)).toBeNull();
    expect(trendSlope(withWeights('2026-10-01', 9, 78, -0.1).weights)).toBeNull(); // 期間8日
    expect(trendSlope(withWeights('2026-10-01', 10, 78, -0.1).weights)).not.toBeNull();
  });
  it('直近3週間の傾きから到達予想日', () => {
    // 記録の最初の6日は7日平均の元データが少ないので、十分前から記録がある状態で確認する
    const d = withWeights('2026-09-20', 35, 78, -0.07);
    const f = forecast(d, '2026-10-24');
    expect(f.kind).toBe('trend');
    if (f.kind === 'trend') expect(f.perWeek).toBeCloseTo(-0.49, 1);
  });
  it('足りなければ週0.5kgペースの予定日', () => {
    const d = { ...defaults(), weights: { '2026-09-27': 78.3 } };
    const f = forecast(d, '2026-10-08');
    expect(f).toEqual({ kind: 'plan', date: addDays('2026-10-08', Math.ceil((9.3 / 0.5) * 7)) });
  });
});

describe('体重の警告', () => {
  it('週1kg以上の減少が2週続くと「食べなさすぎ」', () => {
    const d = withWeights('2026-09-27', 40, 78.3, -0.16);
    expect(weightAlert(d, addDays('2026-09-27', 39))?.kind).toBe('fast');
  });
  it('開始3週間は水分で落ちやすいので警告しない', () => {
    const d = withWeights('2026-09-27', 18, 78.3, -0.16);
    expect(weightAlert(d, addDays('2026-09-27', 17))).toBeNull();
  });
  it('2週間 7日平均が動かないと「停滞」', () => {
    const d = withWeights('2026-09-27', 35, 76, 0);
    const a = weightAlert(d, addDays('2026-09-27', 34));
    expect(a?.kind).toBe('stall');
  });
  it('順調なら何も出さない', () => {
    const d = withWeights('2026-09-27', 35, 78.3, -0.07);
    expect(weightAlert(d, addDays('2026-09-27', 34))).toBeNull();
  });
  it('停滞の対処はチェック記録から1つだけ選ぶ', () => {
    const today = '2026-11-01';
    const habits: AppData['habits'] = {};
    for (let i = 0; i < 14; i++) habits[addDays(today, -i)] = { nosugar: true, rice: true, steps: i % 2 === 0, sleep: true };
    expect(stallTip({ ...defaults(), habits }, today).id).toBe('steps');
    expect(stallTip(defaults(), today).id).toBe('more-steps');
  });
});

describe('睡眠タイムライン', () => {
  it('23:30 就寝 / 7:00 起床', () => {
    const p = sleepPlan('23:30', '07:00');
    expect(p.hours).toBe(7.5);
    expect(p.timeline.map((x) => x.t)).toEqual(['7:00', '15:00〜', '20:30', '22:00', '23:00', '23:30']);
  });
  it('0時以降に寝る設定でも崩れない', () => {
    expect(sleepPlan('00:30', '08:00').timeline[2].t).toBe('21:30');
  });
});

describe('ディロード週', () => {
  it('開始から9週目（11/22〜11/28）', () => {
    expect(isDeloadWeek('2026-11-21')).toBe(false);
    expect(isDeloadWeek('2026-11-22')).toBe(true);
    expect(isDeloadWeek('2026-11-28')).toBe(true);
    expect(isDeloadWeek('2026-11-29')).toBe(false);
    expect(deloadWindow('2026-10-08')).toEqual({ from: '2026-11-22', to: '2026-11-28', active: false });
    expect(deloadWindow('2026-12-01').from).toBe('2027-01-24');
  });
});
