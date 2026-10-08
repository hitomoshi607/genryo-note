// 体型写真は IndexedDB に端末内だけで保存する（バックアップ JSON には含めない）
import { createStore, del, entries, get, set } from 'idb-keyval';
import { useCallback, useEffect, useState } from 'react';

export interface PhotoRec {
  id: string;
  d: string;
  blob: Blob;
}

const store = createStore('genryo-note-photos', 'photos');
const mealStore = createStore('genryo-note-meal-photos', 'photos');

/** 画像を読み込む。createImageBitmap は画面が裏にあっても待たされないので優先する */
async function decodeImage(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { src: b, w: b.width, h: b.height, done: () => b.close() };
    } catch {
      /* 古いブラウザは下の方法で */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** 長辺 max px の JPEG に縮める（iPhone の HEIC もここで JPEG になる） */
export async function downscale(file: Blob, max = 1280, quality = 0.82): Promise<Blob> {
  const img = await decodeImage(file);
  try {
    const scale = Math.min(1, max / Math.max(img.w, img.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.w * scale);
    canvas.height = Math.round(img.h * scale);
    canvas.getContext('2d')?.drawImage(img.src, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('画像を変換できませんでした'))), 'image/jpeg', quality));
  } finally {
    img.done();
  }
}

export async function addPhoto(file: File, d: string) {
  const blob = await downscale(file);
  const rec: PhotoRec = { id: `${d}_${Date.now()}`, d, blob };
  await set(rec.id, rec, store);
  return rec;
}

export async function listPhotos(): Promise<PhotoRec[]> {
  const all = await entries<string, PhotoRec>(store);
  return all.map(([, v]) => v).sort((a, b) => (a.id < b.id ? -1 : 1));
}

export const deletePhoto = (id: string) => del(id, store);

/* ---------- 食事写真のサムネイル ---------- */

export async function saveMealPhoto(blob: Blob) {
  const id = `mp${Date.now().toString(36)}`;
  await set(id, await downscale(blob, 480, 0.75), mealStore);
  return id;
}

export const getMealPhoto = (id: string) => get<Blob>(id, mealStore);
export const deleteMealPhoto = (id: string) => del(id, mealStore);

export function useMealPhoto(id: string | undefined) {
  const [blob, setBlob] = useState<Blob>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    getMealPhoto(id).then((b) => alive && setBlob(b), () => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return useObjectUrl(blob);
}

/** 写真一覧と再読み込み関数 */
export function usePhotos() {
  const [photos, setPhotos] = useState<PhotoRec[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    listPhotos()
      .then((p) => {
        setPhotos(p);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(reload, [reload]);
  return { photos, error, reload };
}

/** Blob の表示用 URL（アンマウント時に解放） */
export function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export async function sharePhoto(p: PhotoRec) {
  const file = new File([p.blob], `body-${p.d}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* キャンセル */
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
