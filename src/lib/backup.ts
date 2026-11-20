// バックアップの書き出し（JSON）。iPhone では共有シートから「ファイルに保存」できる
import { todayStr } from './date';
import type { AppData } from './schema';

export const backupJson = (d: AppData) => JSON.stringify({ ...d, exportedAt: new Date().toISOString() }, null, 1);

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

async function saveJson(text: string, name: string, title: string): Promise<ExportResult> {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
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

const stamp = () => todayStr().replaceAll('-', '');

export const exportBackup = (d: AppData) => saveJson(backupJson(d), `genryo-note-${stamp()}.json`, '減量ノートのバックアップ');

/** 前の版の記録をそのまま書き出す */
export const exportOld = (raw: string) => saveJson(raw, `genryo-note-old-${stamp()}.json`, '減量ノート（前の版）の記録');
