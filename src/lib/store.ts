// 記録データの保存先は端末の localStorage だけ（キーは試作版と同じ genryo-note-v2）
import { useSyncExternalStore } from 'react';
import { defaults, normalize, type AppData } from './schema';

export const STORAGE_KEY = 'genryo-note-v2';

let saveFailed = false;

function load(): AppData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // 読めないデータで上書きしてしまわないよう、元の文字列を別キーに退避しておく
    if (raw) {
      try {
        localStorage.setItem(`${STORAGE_KEY}-broken-${Date.now()}`, raw);
      } catch {
        /* 退避もできないときは諦める */
      }
    }
  }
  return defaults();
}

let state: AppData = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getData = () => state;

export function setData(next: AppData) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  emit();
}

export const update = (fn: (d: AppData) => AppData) => setData(fn(state));

export const lastSaveFailed = () => saveFailed;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const useData = () => useSyncExternalStore(subscribe, getData);

// 別タブで変更されたら読み直す
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      emit();
    }
  });
}

/** iOS などでストレージを勝手に消されにくくする */
export async function requestPersist() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
  } catch {
    /* 対応していない環境では何もしない */
  }
}
