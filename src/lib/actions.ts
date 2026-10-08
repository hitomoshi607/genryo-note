// 記録の追加・削除。すべて新しいオブジェクトを作って store に渡す
import { addDays, mondayOf } from './date';
import { r1 } from './format';
import { defaultSlot, newMealId, nowHHMM } from './meals';
import { defaults, mergeData, type AppData, type Comp, type Favorite, type FoodKey, type Meal, type Settings } from './schema';
import { update } from './store';

export const saveWeight = (d: string, w: number) => update((s) => ({ ...s, weights: { ...s.weights, [d]: r1(w) } }));

export const deleteWeight = (d: string) =>
  update((s) => {
    const weights = { ...s.weights };
    delete weights[d];
    return { ...s, weights };
  });

export const toggleHabit = (d: string, id: string) =>
  update((s) => {
    const day = { ...(s.habits[d] ?? {}) };
    if (day[id]) delete day[id];
    else day[id] = true;
    const habits = { ...s.habits };
    if (Object.keys(day).length) habits[d] = day;
    else delete habits[d];
    return { ...s, habits };
  });

export const logSos = (d: string, kind: 'held' | 'ate') =>
  update((s) => {
    const cur = s.sos[d] ?? { held: 0, ate: 0 };
    return { ...s, sos: { ...s.sos, [d]: { ...cur, [kind]: cur[kind] + 1 } } };
  });

/** 同じ日の記録は上書き */
export const saveLift = (id: string, d: string, w: number, r: number[]) =>
  update((s) => {
    const list = (s.lifts[id] ?? []).filter((x) => x.d !== d);
    list.push({ d, w: r1(w), r });
    list.sort((a, b) => (a.d < b.d ? -1 : 1));
    return { ...s, lifts: { ...s.lifts, [id]: list } };
  });

export const deleteLift = (id: string, d: string) =>
  update((s) => {
    const list = (s.lifts[id] ?? []).filter((x) => x.d !== d);
    const lifts = { ...s.lifts };
    if (list.length) lifts[id] = list;
    else delete lifts[id];
    return { ...s, lifts };
  });

export const saveComp = (c: Comp) =>
  update((s) => {
    const comp = s.comp.filter((x) => x.d !== c.d);
    comp.push(c);
    comp.sort((a, b) => (a.d < b.d ? -1 : 1));
    const weights = s.weights[c.d] === undefined ? { ...s.weights, [c.d]: c.w } : s.weights;
    return { ...s, comp, weights };
  });

/** 体組成は最低1件残す（計算の基準になるため） */
export const deleteComp = (d: string) =>
  update((s) => (s.comp.length <= 1 ? s : { ...s, comp: s.comp.filter((x) => x.d !== d) }));

/**
 * 週の回数を増減する。+1 は今日に、−1 は今日→その週の新しい日の順に減らす
 */
export const bumpFood = (today: string, key: FoodKey, delta: 1 | -1) =>
  update((s) => {
    const food = { ...s.food };
    const set = (d: string, n: number) => {
      const day = { ...(food[d] ?? {}) };
      if (n > 0) day[key] = n;
      else delete day[key];
      if (Object.keys(day).length) food[d] = day;
      else delete food[d];
    };
    if (delta > 0) {
      set(today, (food[today]?.[key] ?? 0) + 1);
    } else {
      const mon = mondayOf(today);
      for (let d = today; d >= mon; d = addDays(d, -1)) {
        const n = food[d]?.[key] ?? 0;
        if (n > 0) {
          set(d, n - 1);
          break;
        }
      }
    }
    return { ...s, food };
  });

/** 同じ id があれば置き換え */
export const saveMeal = (d: string, meal: Meal) =>
  update((s) => {
    const list = (s.meals[d] ?? []).filter((m) => m.id !== meal.id);
    list.push(meal);
    list.sort((a, b) => (a.t < b.t ? -1 : 1));
    return { ...s, meals: { ...s.meals, [d]: list } };
  });

export const deleteMeal = (d: string, id: string) =>
  update((s) => {
    const list = (s.meals[d] ?? []).filter((m) => m.id !== id);
    const meals = { ...s.meals };
    if (list.length) meals[d] = list;
    else delete meals[d];
    return { ...s, meals };
  });

/** 同じ id があれば同じ位置で置き換え、なければ末尾に足す */
export const addFavorite = (fav: Favorite) =>
  update((s) => {
    const i = s.favorites.findIndex((f) => f.id === fav.id);
    const favorites = [...s.favorites];
    if (i >= 0) favorites[i] = fav;
    else favorites.push(fav);
    return { ...s, favorites };
  });

export const deleteFavorite = (id: string) => update((s) => ({ ...s, favorites: s.favorites.filter((f) => f.id !== id) }));

/** よく食べる食事を1タップで記録。取り消し用に食事の id を返す */
export function recordFavorite(d: string, fav: Favorite, now = new Date()) {
  const meal: Meal = {
    id: newMealId(),
    t: nowHHMM(now),
    slot: fav.slot ?? defaultSlot(now),
    items: fav.items.map((i) => ({ ...i })),
  };
  saveMeal(d, meal);
  return meal;
}

export const saveSettings = (settings: Settings) => update((s) => ({ ...s, settings }));

export const markBackup = () => update((s) => ({ ...s, backupAt: new Date().toISOString() }));

/** 記録をすべて消す（設定と初回の体組成は残す） */
export const resetAll = () =>
  update((s) => {
    const base = defaults();
    return { ...base, settings: s.settings, favorites: s.favorites, comp: [s.comp[0]], weights: { [s.comp[0].d]: s.comp[0].w } };
  });

export const importData = (inc: AppData, mode: 'merge' | 'replace') =>
  update((s) => (mode === 'merge' ? mergeData(s, inc) : { ...inc, backupAt: s.backupAt }));
