import type { AppData, MealItem, MealSlot } from './schema';

export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: '朝', lunch: '昼', snack: '間食', dinner: '夕' };

export interface Totals {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export function sumItems(items: MealItem[]): Totals {
  return items.reduce((t, i) => ({ kcal: t.kcal + i.kcal, p: t.p + i.p, f: t.f + i.f, c: t.c + i.c }), { kcal: 0, p: 0, f: 0, c: 0 });
}

/** その日に記録した食事の合計（exceptId の食事は除く） */
export function dayTotals(d: AppData, date: string, exceptId?: string): Totals {
  return sumItems((d.meals[date] ?? []).filter((m) => m.id !== exceptId).flatMap((m) => m.items));
}

/** 時刻からいちばんありそうな食事区分 */
export function defaultSlot(now = new Date()): MealSlot {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 10 * 60 + 30) return 'breakfast';
  if (m < 15 * 60) return 'lunch';
  if (m < 17 * 60 + 30) return 'snack';
  return 'dinner';
}

export const nowHHMM = (now = new Date()) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

export const newMealId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
