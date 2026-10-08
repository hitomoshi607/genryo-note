// 品目の入力欄（食事の記録と、よく食べる食事の編集で共通）と、claude.ai の結果の貼り付け
import { useState, type ReactNode } from 'react';
import { normalizeItem, type MealItem } from '../lib/schema';

/** 入力中の品目（数値も文字列で持つ） */
export interface Row {
  name: string;
  amount: string;
  kcal: string;
  p: string;
  f: string;
  c: string;
}

export const toRow = (i: MealItem): Row => ({ name: i.name, amount: i.amount, kcal: String(i.kcal), p: String(i.p), f: String(i.f), c: String(i.c) });
export const EMPTY_ROW: Row = { name: '', amount: '', kcal: '', p: '', f: '', c: '' };
export const toItems = (rows: Row[]) =>
  rows
    .map((r) => normalizeItem({ name: r.name, amount: r.amount, kcal: +r.kcal || 0, p: +r.p || 0, f: +r.f || 0, c: +r.c || 0 }))
    .filter((i): i is MealItem => i !== null);

const NUMS = [
  ['kcal', 'kcal'],
  ['p', 'P g'],
  ['f', 'F g'],
  ['c', 'C g'],
] as const;

export function ItemRows({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  const setRow = (i: number, k: keyof Row, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <>
      {rows.length > 0 && (
        <ul className="items">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="it-top">
                <input className="inp it-name" value={r.name} placeholder="品目" aria-label="品目" onChange={(e) => setRow(i, 'name', e.target.value)} />
                <button type="button" className="del" aria-label={`${r.name || '品目'}を削除`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  削除
                </button>
              </div>
              <input className="inp it-amt" value={r.amount} placeholder="量（例：茶碗1杯）" aria-label="量" onChange={(e) => setRow(i, 'amount', e.target.value)} />
              <div className="it-nums">
                {NUMS.map(([k, l]) => (
                  <label key={k}>
                    <span>{l}</span>
                    <input className="inp n" type="number" inputMode="numeric" min="0" value={r[k]} onChange={(e) => setRow(i, k, e.target.value)} />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="link" onClick={() => onChange([...rows, EMPTY_ROW])}>
        ＋ 品目を手で追加
      </button>
    </>
  );
}

/**
 * 「claude.ai の結果を貼り付け」ボタン。クリップボードが読めない環境では入力欄を出す。
 * 読み取った文字は onText に渡し、解釈は呼び出し側が行う（失敗したら false を返す）
 */
export function PasteButton({ onText, disabled, className, children }: { onText: (text: string) => boolean; disabled?: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const start = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim() && onText(t)) return;
    } catch {
      /* 読めない環境では下の入力欄に貼ってもらう */
    }
    setOpen(true);
  };
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => void start()}>
        {children}
      </button>
      {open && (
        <div className="paste">
          <textarea
            className="inp ta"
            rows={3}
            placeholder="推定ページの「減量ノート用にコピー」で写した文字をここに貼り付け"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="推定結果の貼り付け"
          />
          <button
            type="button"
            className="btn sm"
            disabled={!text.trim()}
            onClick={() => {
              if (onText(text)) {
                setOpen(false);
                setText('');
              }
            }}
          >
            読み込む
          </button>
        </div>
      )}
    </>
  );
}
