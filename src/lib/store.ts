// 記録データの保存先は端末の localStorage だけ（2026-11 の作り直しでキーを v3 に変え、新しく始めた）
import { useSyncExternalStore } from 'react';
import { defaults, normalize, type AppData } from './schema';

export const STORAGE_KEY = 'genryo-note-v3';

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

/* ---------- 前の版のデータ ---------- */

/** 前の版が使っていた保存先（記録・写真推定の API キー・筋トレの入力途中） */
const OLD_KEYS = ['genryo-note-v2', 'genryo-note-ai', 'genryo-gym-draft'];
/** 前の版が写真を入れていた IndexedDB */
const OLD_DBS = ['genryo-note-photos', 'genryo-note-meal-photos'];

/** 前の版の記録（JSON の文字列）。なければ null */
export function oldRecord(): string | null {
  try {
    return localStorage.getItem('genryo-note-v2');
  } catch {
    return null;
  }
}

/** 前の版のデータを端末から消す（記録・API キー・写真） */
export async function deleteOldData() {
  for (const k of OLD_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* 消せなくても続ける */
    }
  }
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('genryo-note-v2-broken-')) localStorage.removeItem(k);
  }
  await Promise.all(
    OLD_DBS.map(
      (name) =>
        new Promise<void>((done) => {
          try {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => done();
          } catch {
            done();
          }
        }),
    ),
  );
}
