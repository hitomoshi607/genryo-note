import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { pace } from '../data/plan';
import { getHelp } from '../help';
import { importData, resetAll, saveSettings } from '../lib/actions';
import { exportBackup, exportOld, type ExportResult } from '../lib/backup';
import { jMD, WD } from '../lib/date';
import { kg } from '../lib/format';
import { KIND_LABEL } from '../lib/gym';
import { DAY_KINDS, isOldVersion, normalize, summarize, type AppData, type Settings } from '../lib/schema';
import { deleteOldData, lastSaveFailed, oldRecord, useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { goalDate, monthsToGoal } from '../lib/weight';
import { ConfirmButton, Sheet } from '../ui';

/* ---------- ヘルプ ---------- */

export function HelpSheet({ k, onClose }: { k: string | null; onClose: () => void }) {
  const d = useData();
  const today = useToday();
  const h = k ? getHelp(k, d, today) : null;
  return (
    <Sheet open={!!h} onClose={onClose} title={h?.title ?? ''}>
      <div className="hb-body">{h?.body}</div>
    </Sheet>
  );
}

/* ---------- 設定 ---------- */

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="設定">
      <SettingsBody />
    </Sheet>
  );
}

const exportMsg: Record<ExportResult, string> = {
  shared: '書き出しました。',
  downloaded: 'ファイルを保存しました。',
  cancelled: '',
};

function SettingsBody() {
  const d = useData();
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [old, setOld] = useState(oldRecord);

  return (
    <div className="settings">
      {lastSaveFailed() && <p className="hint err">端末に保存できませんでした。空き容量を確認してください。</p>}

      <section>
        <h3>目標</h3>
        <GoalForm key={JSON.stringify(d.settings)} s={d.settings} />
      </section>

      <section>
        <h3>曜日ごとの予定</h3>
        <WeekForm s={d.settings} />
      </section>

      <section>
        <h3>有酸素（傾斜ウォーキング）</h3>
        <CardioForm key={JSON.stringify(d.settings.cardio)} s={d.settings} />
      </section>

      <section>
        <h3>バックアップ</h3>
        <p className="sub">記録はこの iPhone の中だけにあります。月に1回くらい書き出して「ファイル」に保存してください。</p>
        <div className="btns">
          <button type="button" className="btn ghost" onClick={() => void exportBackup(d).then((r) => setMsg(exportMsg[r]))}>
            書き出す
          </button>
          <button type="button" className="btn ghost" aria-expanded={importing} onClick={() => setImporting(!importing)}>
            読み込む
          </button>
        </div>
        {msg && <p className="sub ok-t">{msg}</p>}
        {importing && <ImportBody onDone={() => setImporting(false)} />}
      </section>

      {old && (
        <section>
          <h3>前の版の記録</h3>
          <p className="sub">作り直す前の記録（体重・食事・写真推定の API キーなど）がこの iPhone に残っています。新しい版では使いません。</p>
          <div className="btns">
            <button type="button" className="btn ghost" onClick={() => void exportOld(old)}>
              書き出す
            </button>
            <ConfirmButton
              className="btn danger"
              label="端末から消す"
              armedLabel="もう一度押すと消す"
              onConfirm={() => void deleteOldData().then(() => setOld(null))}
            />
          </div>
        </section>
      )}

      <section>
        <h3>記録をすべて消す</h3>
        <p className="sub">体重・睡眠・ジムの記録を消します。目標と曜日の設定は残ります。</p>
        <ConfirmButton className="btn danger" label="すべて消す" armedLabel="もう一度押すと消す" onConfirm={resetAll} />
      </section>
    </div>
  );
}

function NumField({ label, unit, value, onChange, step = '0.1' }: { label: string; unit: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-in">
        <input className="n" type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
        <small>{unit}</small>
      </span>
    </label>
  );
}

function GoalForm({ s }: { s: Settings }) {
  const [f, setF] = useState({ startDate: s.startDate, startWeight: kg(s.startWeight), goalWeight: kg(s.goalWeight), perMonth: kg(s.perMonth) });
  const [err, setErr] = useState('');
  const next: Settings = { ...s, startDate: f.startDate, startWeight: +f.startWeight, goalWeight: +f.goalWeight, perMonth: +f.perMonth };
  const valid = !!f.startDate && next.startWeight >= 30 && next.goalWeight >= 30 && next.goalWeight < next.startWeight && next.perMonth >= 0.5 && next.perMonth <= 5;

  return (
    <>
      <label className="field">
        <span>開始日</span>
        <input className="n" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
      </label>
      <NumField label="開始時の体重" unit="kg" value={f.startWeight} onChange={(v) => setF({ ...f, startWeight: v })} />
      <NumField label="目標の体重" unit="kg" value={f.goalWeight} onChange={(v) => setF({ ...f, goalWeight: v })} />
      <NumField label="1か月に減らす" unit="kg" value={f.perMonth} onChange={(v) => setF({ ...f, perMonth: v })} />
      <p className="sub n">{valid ? `${monthsToGoal(next)}か月で達成・${jMD(goalDate(next))}` : '目標は開始時より軽く、1か月 0.5〜5kg にしてください。'}</p>
      {err && <p className="hint err">{err}</p>}
      <button
        type="button"
        className="btn wide"
        disabled={!valid}
        onClick={() => {
          if (!valid) return setErr('入力を確認してください。');
          saveSettings(next);
          setErr('');
        }}
      >
        保存
      </button>
    </>
  );
}

function WeekForm({ s }: { s: Settings }) {
  // 月曜から並べる
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ul className="week-form">
      {order.map((i) => (
        <li key={i}>
          <span className="wd">{WD[i]}</span>
          <div className="mini-seg" role="radiogroup" aria-label={`${WD[i]}曜日の予定`}>
            {DAY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={s.week[i] === k}
                onClick={() => {
                  const week = [...s.week];
                  week[i] = k;
                  saveSettings({ ...s, week });
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardioForm({ s }: { s: Settings }) {
  const c = s.cardio;
  const [f, setF] = useState({ incline: kg(c.incline), speed: kg(c.speed), cardioMin: String(c.cardioMin), liftMin: String(c.liftMin) });
  const next = { incline: +f.incline, speed: +f.speed, cardioMin: Math.round(+f.cardioMin), liftMin: Math.round(+f.liftMin) };
  const valid = next.incline >= 0 && next.incline <= 30 && next.speed >= 1 && next.speed <= 20 && next.cardioMin >= 1 && next.liftMin >= 0;
  return (
    <>
      <NumField label="傾斜" unit="%" value={f.incline} onChange={(v) => setF({ ...f, incline: v })} step="0.5" />
      <NumField label="速さ" unit="km/h" value={f.speed} onChange={(v) => setF({ ...f, speed: v })} />
      <p className="sub n">1km {pace(next.speed)}</p>
      <NumField label="有酸素の日" unit="分" value={f.cardioMin} onChange={(v) => setF({ ...f, cardioMin: v })} step="1" />
      <NumField label="筋トレのあと" unit="分" value={f.liftMin} onChange={(v) => setF({ ...f, liftMin: v })} step="1" />
      <button type="button" className="btn wide" disabled={!valid} onClick={() => saveSettings({ ...s, cardio: next })}>
        保存
      </button>
    </>
  );
}

function ImportBody({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<AppData | null>(null);
  const [err, setErr] = useState('');

  const read = (raw: string) => {
    try {
      const x: unknown = JSON.parse(raw);
      if (isOldVersion(x)) {
        setParsed(null);
        setErr('作り直す前の版のバックアップは読み込めません。');
        return;
      }
      setParsed(normalize(x));
      setErr('');
    } catch {
      setParsed(null);
      setErr('JSON として読めませんでした。');
    }
  };

  const sum = parsed ? summarize(parsed) : null;
  return (
    <div className="import">
      <label className="btn ghost wide file-btn">
        ファイルを選ぶ
        <input
          type="file"
          accept="application/json,.json,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then(read);
          }}
        />
      </label>
      <textarea className="inp ta" rows={4} placeholder="または中身を貼り付け" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn ghost wide" disabled={!text.trim()} onClick={() => read(text)}>
        貼り付けた内容を確認
      </button>
      {err && <p className="hint err">{err}</p>}
      {sum && (
        <p className="sub n">
          体重 {sum.weights}件{sum.from ? `（${sum.from}〜${sum.to}）` : ''}・睡眠 {sum.sleep}件・筋トレ {sum.lifts}件・有酸素 {sum.cardio}件
        </p>
      )}
      {parsed && (
        <div className="btns">
          <button
            type="button"
            className="btn"
            onClick={() => {
              importData(parsed, 'merge');
              onDone();
            }}
          >
            今の記録に足す
          </button>
          <ConfirmButton
            className="btn danger"
            label="置き換える"
            armedLabel="もう一度押すと置き換え"
            onConfirm={() => {
              importData(parsed, 'replace');
              onDone();
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- 更新のお知らせ ---------- */

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // ホーム画面アプリは開きっぱなしになりやすいので、戻ってきたときに更新を確認する
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="toast" role="status">
      {needRefresh ? (
        <>
          <span>新しいバージョンがあります</span>
          <button type="button" className="btn sm" onClick={() => void updateServiceWorker(true)}>
            更新
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setNeedRefresh(false)}>
            あとで
          </button>
        </>
      ) : (
        <span>オフラインでも使えるようになりました</span>
      )}
    </div>
  );
}
