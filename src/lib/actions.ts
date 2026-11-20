// 記録の追加・変更・削除
import type { Session } from '../data/plan';
import { r1 } from './format';
import { defaults, type AppData, type CardioRec, type Settings, type SleepRec } from './schema';
import { update } from './store';

const without = <T,>(rec: Record<string, T>, key: string) => {
  const next = { ...rec };
  delete next[key];
  return next;
};

export const saveWeight = (d: string, w: number) => update((s) => ({ ...s, weights: { ...s.weights, [d]: r1(w) } }));

export const deleteWeight = (d: string) => update((s) => ({ ...s, weights: without(s.weights, d) }));

export const saveSleep = (d: string, rec: SleepRec) => update((s) => ({ ...s, sleep: { ...s.sleep, [d]: rec } }));

export const deleteSleep = (d: string) => update((s) => ({ ...s, sleep: without(s.sleep, d) }));

/** 1種目の記録。同じ日に記録し直したら上書きし、その日の筋トレの種類も残す */
export const saveLift = (id: string, session: Session, d: string, w: number, r: number[]) =>
  update((s) => {
    const list = (s.lifts[id] ?? []).filter((x) => x.d !== d);
    list.push({ d, w: r1(w), r });
    list.sort((a, b) => a.d.localeCompare(b.d));
    return { ...s, lifts: { ...s.lifts, [id]: list }, sessions: { ...s.sessions, [d]: session } };
  });

export const deleteLift = (id: string, d: string) =>
  update((s) => {
    const list = (s.lifts[id] ?? []).filter((x) => x.d !== d);
    const lifts = { ...s.lifts, [id]: list };
    if (!list.length) delete lifts[id];
    // その日の筋トレの記録がなくなったら、種類の記録も消す
    const left = Object.values(lifts).some((l) => l.some((x) => x.d === d));
    return { ...s, lifts, sessions: left ? s.sessions : without(s.sessions, d) };
  });

export const saveCardio = (d: string, rec: CardioRec) => update((s) => ({ ...s, cardio: { ...s.cardio, [d]: rec } }));

export const deleteCardio = (d: string) => update((s) => ({ ...s, cardio: without(s.cardio, d) }));

export const saveSettings = (settings: Settings) => update((s) => ({ ...s, settings }));

/** 記録をすべて消す（設定は残す） */
export const resetAll = () => update((s) => ({ ...defaults(), weights: {}, settings: s.settings }));

/** バックアップを読み込む。merge は今の記録に足す（同じ日は読み込んだほうを使う） */
export function importData(x: AppData, mode: 'merge' | 'replace') {
  update((s) => {
    if (mode === 'replace') return x;
    const lifts = { ...s.lifts };
    for (const [id, list] of Object.entries(x.lifts)) {
      const byDay = new Map((lifts[id] ?? []).map((r) => [r.d, r]));
      for (const r of list) byDay.set(r.d, r);
      lifts[id] = [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
    }
    return {
      ...s,
      weights: { ...s.weights, ...x.weights },
      sleep: { ...s.sleep, ...x.sleep },
      lifts,
      sessions: { ...s.sessions, ...x.sessions },
      cardio: { ...s.cardio, ...x.cardio },
    };
  });
}
