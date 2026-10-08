import type { Comp, Favorite, Settings } from '../lib/schema';

/**
 * よく食べる食事の初期値（SPEC.md 6章「1日の例」と間食リストから。数値は日本食品標準成分表に沿った目安）。
 * 朝・昼・間食・夕の合計はプランの値（530 / 650 / 180 / 650kcal、P 26 / 35 / 30 / 40g）に合わせてある。
 */
export const DEFAULT_FAVORITES: Favorite[] = [
  {
    id: 'f-breakfast', name: 'いつもの朝ごはん', slot: 'breakfast',
    items: [
      { name: 'ご飯', amount: '150g', kcal: 234, p: 4, f: 0, c: 56 },
      { name: '卵', amount: '2個', kcal: 142, p: 12, f: 10, c: 0 },
      { name: '納豆', amount: '1パック', kcal: 86, p: 7, f: 5, c: 5 },
      { name: '味噌汁', amount: '1杯（豆腐・わかめ）', kcal: 68, p: 3, f: 2, c: 5 },
    ],
  },
  {
    id: 'f-teishoku', name: '学食の定食', slot: 'lunch',
    items: [{ name: '学食の定食（焼き魚・生姜焼き）', amount: 'ご飯は小〜並', kcal: 650, p: 35, f: 20, c: 80 }],
  },
  {
    id: 'f-conbini', name: 'コンビニ（おにぎり＋サラダチキン）', slot: 'lunch',
    items: [
      { name: 'おにぎり（鮭など）', amount: '2個', kcal: 360, p: 10, f: 2, c: 76 },
      { name: 'サラダチキン', amount: '1個', kcal: 110, p: 24, f: 2, c: 0 },
    ],
  },
  {
    id: 'f-snack', name: 'プロテイン＋ヨーグルト', slot: 'snack',
    items: [{ name: 'プロテイン＋無糖ヨーグルト', amount: '1杯＋1個', kcal: 180, p: 30, f: 3, c: 9 }],
  },
  {
    id: 'f-protein', name: 'プロテイン', slot: 'snack',
    items: [{ name: 'プロテイン', amount: '1杯', kcal: 120, p: 22, f: 2, c: 4 }],
  },
  {
    id: 'f-banana', name: 'バナナ', slot: 'snack',
    items: [{ name: 'バナナ', amount: '1本', kcal: 90, p: 1, f: 0, c: 22 }],
  },
  {
    id: 'f-dinner', name: 'いつもの夕食', slot: 'dinner',
    items: [{ name: '夕食（ご飯150g・主菜・野菜・汁物）', amount: '主菜は手のひら1〜1.5枚', kcal: 650, p: 40, f: 20, c: 75 }],
  },
];

/** 開始日（初回測定日） */
export const START_DATE = '2026-09-27';

/** 初回測定（TANITA DC-13C / 2026-09-27 13:46）。全計算の基準 */
export const SEED_COMP: Comp = { d: '2026-09-27', w: 78.3, fp: 24.2, m: 56.3, v: 11, bmr: 1735 };

/** 初回測定の全項目（ヘルプ表示用。計算には SEED_COMP を使う） */
export const SEED_REPORT: { label: string; value: string; judge?: string }[] = [
  { label: '体重', value: '78.3 kg' },
  { label: '体脂肪率', value: '24.2 %', judge: '軽肥満' },
  { label: '脂肪量', value: '18.9 kg' },
  { label: '除脂肪量', value: '59.4 kg' },
  { label: '筋肉量', value: '56.3 kg', judge: '多' },
  { label: '筋肉率', value: '71.9 %' },
  { label: '体水分量', value: '41.4 kg（52.9%）' },
  { label: '推定骨量', value: '3.1 kg' },
  { label: '基礎代謝量', value: '1735 kcal', judge: '燃えやすい' },
  { label: '内臓脂肪レベル', value: '11', judge: 'やや過剰' },
  { label: 'BMI', value: '28.8', judge: '肥満1' },
  { label: '標準体重', value: '59.9 kg' },
  { label: '肥満度', value: '30.7 %' },
  { label: '体脂肪標準範囲', value: '11.0〜21.9 % / 7.3〜16.7 kg' },
  { label: '体型判定', value: 'かた太り型' },
];

export const DEFAULT_SETTINGS: Settings = {
  age: 21,
  height: 165,
  goalWeight: 69,
  bed: '23:30',
  wake: '07:00',
  theme: 'auto',
  // キーは曜日番号（0=日）
  schedule: { '0': 'C', '1': 'uni', '2': 'uni', '3': 'A', '4': 'uni', '5': 'B', '6': 'rest' },
};
