// 画面全体で使う共通部品と、シート（ヘルプ・設定など）を開くためのコンテキスト
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { GymDay, Meal } from './lib/schema';

export type Tab = 'today' | 'body' | 'gym' | 'food' | 'habit';

export interface UI {
  openHelp: (key: string) => void;
  openSos: () => void;
  openSettings: () => void;
  /** 食事の記録（meal を渡すと編集） */
  openMeal: (target: { date: string; meal?: Meal }) => void;
  go: (tab: Tab, opts?: { gymDay?: GymDay }) => void;
}

export const UIContext = createContext<UI>({
  openHelp: () => {},
  openSos: () => {},
  openSettings: () => {},
  openMeal: () => {},
  go: () => {},
});
export const useUI = () => useContext(UIContext);

/** 説明は「?」の中にしまう */
export function HelpButton({ k, label }: { k: string; label: string }) {
  const { openHelp } = useUI();
  return (
    <button type="button" className="q" onClick={() => openHelp(k)} aria-label={label}>
      ?
    </button>
  );
}

export function Card({
  title,
  side,
  help,
  helpLabel,
  children,
  className = '',
}: {
  title?: ReactNode;
  side?: ReactNode;
  help?: string;
  helpLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || help) && (
        <div className="ch">
          {title && <h2>{title}</h2>}
          {side !== undefined && <span className="side n">{side}</span>}
          {help && <HelpButton k={help} label={helpLabel ?? '説明'} />}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, help, helpLabel }: { title: string; help?: string; helpLabel?: string }) {
  return (
    <div className="page-h">
      <h1>{title}</h1>
      {help && <HelpButton k={help} label={helpLabel ?? '説明'} />}
    </div>
  );
}

export const Tag = ({ tone, children }: { tone: 'good' | 'warn' | 'neutral'; children: ReactNode }) => (
  <span className={`tag ${tone}`}>{children}</span>
);

/** 下から出てくるシート（<dialog>） */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dlg">
        <div className="dh">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            閉じる
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

/** 1回目で「もう一度で削除」、2回目で実行 */
export function ConfirmButton({
  onConfirm,
  label = '削除',
  armedLabel = 'もう一度で削除',
  className = 'del',
}: {
  onConfirm: () => void;
  label?: string;
  armedLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' arm' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? armedLabel : label}
    </button>
  );
}

/** 選択肢ボタン（Day A/B/C など） */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; title: string; sub?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={o.v === value} onClick={() => onChange(o.v)}>
          <b>{o.title}</b>
          {o.sub && <span>{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}
