// 体組成の計算（SPEC.md「体組成」）：脂肪量・除脂肪量、前回との差、目標の体重になったときの体脂肪率
import { r1 } from './format';
import type { Comp, Settings } from './schema';

export const fatKg = (c: Comp) => r1((c.w * c.fat) / 100);

/** 除脂肪量 = 体重 − 脂肪量 */
export const leanKg = (c: Comp) => r1(c.w - (c.w * c.fat) / 100);

export const musclePct = (c: Comp) => r1((c.muscle / c.w) * 100);

export type CompPoint = Comp & { d: string };

export const sortedComps = (comp: Record<string, Comp>): CompPoint[] =>
  Object.entries(comp)
    .map(([d, c]) => ({ d, ...c }))
    .sort((a, b) => a.d.localeCompare(b.d));

/** 筋肉量・除脂肪量の減りがこれより大きいときだけ注意を出す（体組成計の測り方によるぶれを見込む） */
export const LEAN_TOLERANCE = 0.5;

/** 最新とその前の差 */
export function compDiff(comp: Record<string, Comp>) {
  const list = sortedComps(comp);
  const now = list[list.length - 1];
  const prev = list[list.length - 2];
  if (!now) return null;
  return {
    now,
    prev,
    d: prev
      ? {
          w: r1(now.w - prev.w),
          fat: r1(now.fat - prev.fat),
          fatKg: r1(fatKg(now) - fatKg(prev)),
          lean: r1(leanKg(now) - leanKg(prev)),
          muscle: r1(now.muscle - prev.muscle),
        }
      : null,
  };
}

/** 除脂肪量を保ったまま目標の体重になったときの体脂肪率と、落とす脂肪の量 */
export function atGoal(c: Comp, s: Settings) {
  const lean = c.w - (c.w * c.fat) / 100;
  const fatAtGoal = Math.max(0, s.goalWeight - lean);
  return {
    fatPct: r1((fatAtGoal / s.goalWeight) * 100),
    fatToLose: r1(Math.max(0, (c.w * c.fat) / 100 - fatAtGoal)),
  };
}

/** TANITA の内臓脂肪レベルの区分（機器の表示と同じ） */
export const visceralLabel = (v: number) => (v < 10 ? '標準' : v < 15 ? 'やや過剰' : '過剰');

/**
 * 食事の目安（「?」の中だけで出す）。
 * 消費 = 基礎代謝 × 1.5、毎月の減量分（脂肪1kg ≒ 7,200kcal）を1日あたりで引く。基礎代謝は下回らない。
 * たんぱく質は除脂肪量 × 2.2g（減量中に筋肉を守る目安）
 */
export function dailyGuide(c: Comp, s: Settings) {
  if (!c.bmr) return null;
  const burn = c.bmr * 1.5;
  const deficit = (s.perMonth * 7200 * 12) / 365;
  return {
    burn: Math.round(burn / 50) * 50,
    deficit: Math.round(deficit / 10) * 10,
    kcal: Math.max(c.bmr, Math.round((burn - deficit) / 50) * 50),
    protein: Math.round((leanKg(c) * 2.2) / 5) * 5,
  };
}
