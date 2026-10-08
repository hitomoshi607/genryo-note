// バックアップの書き出し（JSON）。iPhone では共有シートから「ファイルに保存」できる
import { todayStr } from './date';
import type { AppData } from './schema';

export const backupJson = (d: AppData) => JSON.stringify({ ...d, exportedAt: new Date().toISOString() }, null, 1);

export async function exportBackup(d: AppData): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = `genryo-note-${todayStr().replaceAll('-', '')}.json`;
  const file = new File([backupJson(d)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '減量ノートのバックアップ' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // 共有に失敗したらダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export async function copyBackup(d: AppData) {
  await navigator.clipboard.writeText(backupJson(d));
}
