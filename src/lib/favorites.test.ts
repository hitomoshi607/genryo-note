import { describe, expect, it } from 'vitest';
import { DEFAULT_FAVORITES } from '../data/seed';
import { deleteFavorite, deleteMeal, recordFavorite, resetAll } from './actions';
import { sumItems } from './meals';
import { defaults, normalize } from './schema';
import { getData, setData } from './store';

describe('よく食べる食事', () => {
  it('初期値はプランの1日の例と合う', () => {
    const t = (id: string) => sumItems(DEFAULT_FAVORITES.find((f) => f.id === id)!.items);
    expect([t('f-breakfast').kcal, t('f-breakfast').p]).toEqual([530, 26]);
    expect([t('f-teishoku').kcal, t('f-teishoku').p]).toEqual([650, 35]);
    expect([t('f-snack').kcal, t('f-snack').p]).toEqual([180, 30]);
    expect([t('f-dinner').kcal, t('f-dinner').p]).toEqual([650, 40]);
  });

  it('古いデータ（favorites なし）には初期値を入れ、空の配列はそのまま', () => {
    expect(normalize({ weights: {} }).favorites).toHaveLength(DEFAULT_FAVORITES.length);
    expect(normalize({ weights: {}, favorites: [] }).favorites).toEqual([]);
  });

  it('1タップで記録して、取り消せる', () => {
    setData(defaults());
    const fav = getData().favorites[0];
    const meal = recordFavorite('2026-10-08', fav, new Date(2026, 9, 8, 7, 15));
    expect(getData().meals['2026-10-08']).toHaveLength(1);
    expect(meal.slot).toBe('breakfast');
    expect(meal.t).toBe('07:15');
    expect(sumItems(meal.items).kcal).toBe(530);
    deleteMeal('2026-10-08', meal.id);
    expect(getData().meals['2026-10-08']).toBeUndefined();
  });

  it('記録をすべて消しても、登録した食事は残る', () => {
    setData(defaults());
    deleteFavorite('f-banana');
    resetAll();
    expect(getData().favorites.some((f) => f.id === 'f-banana')).toBe(false);
    expect(getData().favorites.length).toBe(DEFAULT_FAVORITES.length - 1);
  });
});
