import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { HALT, SOS_STEPS, T_OPT } from '../data/plan';
import { getHelp } from '../help';
import { importData, logSos, markBackup, resetAll, saveSettings } from '../lib/actions';
import { copyBackup, exportBackup } from '../lib/backup';
import { AI_MODELS, AiError, DEFAULT_MODEL, YEN_PER_USD, clearAi, loadAi, saveAi, verifyAi, type AiModel, type AiSettings } from '../lib/ai';
import { WD, jDate, todayStr } from '../lib/date';
import { kg } from '../lib/format';
import { DAY_TYPES, normalize, summarize, type AppData, type DayType, type Settings, type Theme } from '../lib/schema';
import { lastSaveFailed, useData } from '../lib/store';
import { mmss, sosTimer, unlockAudio, useSecondsLeft, useTimer, beep } from '../lib/timer';
import { useToday } from '../lib/useToday';
import { ConfirmButton, HelpButton, Sheet } from '../ui';

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

/* ---------- ストレス食い対策 ---------- */

export function SosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="10分だけ待ってみよう">
      <SosBody />
    </Sheet>
  );
}

function SosBody() {
  const today = useToday();
  const [why, setWhy] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const t = useTimer(sosTimer);
  const left = useSecondsLeft(t);
  const finished = !!t && left === 0;
  const rang = useRef<number | null>(null);

  useEffect(() => {
    if (t && finished && rang.current !== t.endsAt) {
      rang.current = t.endsAt;
      beep(2);
    }
  }, [t, finished]);

  return (
    <>
      <p className="muted sm">今の状態に近いのは？</p>
      <div className="halt">
        {HALT.map((h) => (
          <button key={h.id} type="button" aria-pressed={why === h.id} onClick={() => setWhy(h.id)}>
            {h.label}
          </button>
        ))}
      </div>
      {why && <p className="hans">{HALT.find((h) => h.id === why)?.advice}</p>}
      <div className="timer">
        <span className="t n">{t ? mmss(left) : '10:00'}</span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            unlockAudio();
            sosTimer.start(600, 'sos');
          }}
        >
          {t ? 'やり直す' : 'タイマー開始'}
        </button>
      </div>
      <p className="tmsg">
        {finished ? '10分たちました。まだ食べたいなら1つだけお皿に出して落ち着いて。' : t ? 'この間に、下のどれか1つを。' : ''}
      </p>
      <ol className="steps">
        {SOS_STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="sos-a">
        <button
          type="button"
          className="btn"
          onClick={() => {
            logSos(today, 'held');
            sosTimer.stop();
            setDone('ナイス。乗り切った記録を残しました。');
          }}
        >
          乗り切った
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            logSos(today, 'ate');
            sosTimer.stop();
            setDone('記録しました。責めなくてOK。次の食事をいつも通りに。');
          }}
        >
          食べた
        </button>
      </div>
      <p className="sdone" role="status">
        {done}
      </p>
    </>
  );
}

/* ---------- 設定 ---------- */

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<'main' | 'import'>('main');
  return (
    <Sheet
      open={open}
      onClose={() => {
        setView('main');
        onClose();
      }}
      title={view === 'main' ? '設定' : 'データを読み込む'}
    >
      {view === 'main' ? <SettingsBody onClose={onClose} onImport={() => setView('import')} /> : <ImportBody onDone={() => setView('main')} />}
    </Sheet>
  );
}

function SettingsBody({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const d = useData();
  const [s, setS] = useState<Settings>(d.settings);
  const [nums, setNums] = useState({ age: String(s.age), height: String(s.height), goal: kg(s.goalWeight) });
  const [msg, setMsg] = useState('');
  const [dataMsg, setDataMsg] = useState('');

  const save = () => {
    const age = parseInt(nums.age, 10);
    const height = parseFloat(nums.height);
    const goal = parseFloat(nums.goal);
    if (!(age >= 10 && age <= 100)) return setMsg('年齢を確認してください。');
    if (!(height >= 100 && height <= 250)) return setMsg('身長を確認してください。');
    if (!(goal >= 30 && goal <= 200)) return setMsg('目標体重を確認してください。');
    saveSettings({ ...s, age, height, goalWeight: Math.round(goal * 10) / 10 });
    onClose();
  };

  const doExport = async () => {
    const r = await exportBackup(d);
    if (r === 'cancelled') return;
    markBackup();
    setDataMsg(r === 'shared' ? '書き出しました。' : 'ダウンロードしました。');
  };

  return (
    <>
      <div className="fg">
        <label>
          年齢
          <input className="inp n" type="number" inputMode="numeric" value={nums.age} onChange={(e) => setNums({ ...nums, age: e.target.value })} />
        </label>
        <label>
          身長（cm）
          <input className="inp n" type="number" inputMode="decimal" step="0.1" value={nums.height} onChange={(e) => setNums({ ...nums, height: e.target.value })} />
        </label>
        <label>
          目標体重（kg）
          <input className="inp n" type="number" inputMode="decimal" step="0.1" value={nums.goal} onChange={(e) => setNums({ ...nums, goal: e.target.value })} />
        </label>
        <label>
          画面の色
          <select className="inp" value={s.theme} onChange={(e) => setS({ ...s, theme: e.target.value as Theme })}>
            <option value="auto">端末に合わせる</option>
            <option value="light">明るい</option>
            <option value="dark">暗い</option>
          </select>
        </label>
        <label>
          寝る時刻
          <input className="inp n" type="time" value={s.bed} onChange={(e) => e.target.value && setS({ ...s, bed: e.target.value })} />
        </label>
        <label>
          起きる時刻
          <input className="inp n" type="time" value={s.wake} onChange={(e) => e.target.value && setS({ ...s, wake: e.target.value })} />
        </label>
      </div>

      <p className="fl">曜日ごとの予定</p>
      <div className="sched">
        {['1', '2', '3', '4', '5', '6', '0'].map((k) => (
          <label key={k}>
            {WD[Number(k)]}
            <select
              className="inp"
              value={s.schedule[k]}
              aria-label={`${WD[Number(k)]}曜日の予定`}
              onChange={(e) => setS({ ...s, schedule: { ...s.schedule, [k]: e.target.value as DayType } })}
            >
              {DAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {T_OPT[t]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="hint err">{msg}</p>
      <button type="button" className="btn wide" onClick={save}>
        保存
      </button>

      <div className="sect">
        <div className="sect-h">
          <h3>データ</h3>
          <HelpButton k="backup" label="バックアップについて" />
        </div>
        <p className="sm muted">最後のバックアップ：{d.backupAt ? jDate(d.backupAt.slice(0, 10)) : 'まだありません'}</p>
        {lastSaveFailed() && <p className="hint err">保存に失敗しています。空き容量を確認して、書き出しておいてください。</p>}
        <div className="btns">
          <button type="button" className="btn" onClick={() => void doExport()}>
            書き出す（JSON）
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              void copyBackup(d).then(
                () => setDataMsg('コピーしました。'),
                () => setDataMsg('コピーできませんでした。'),
              )
            }
          >
            コピー
          </button>
          <button type="button" className="btn ghost" onClick={onImport}>
            読み込む
          </button>
        </div>
        <p className="hint">{dataMsg}</p>
      </div>

      <AiSection d={d} />

      <div className="sect">
        <div className="sect-h">
          <h3>朝のリマインダー</h3>
          <HelpButton k="reminder" label="設定のしかた" />
        </div>
        <p className="sm muted">iPhone の「リマインダー」で毎朝の通知を設定します。</p>
      </div>

      <div className="sect">
        <div className="sect-h">
          <h3>このプランについて</h3>
          <HelpButton k="about" label="このプランについて" />
        </div>
        <ConfirmButton
          className="btn danger sm"
          label="記録をすべて消す"
          armedLabel="もう一度押すと消えます"
          onConfirm={() => {
            resetAll();
            onClose();
          }}
        />
        <p className="sm muted mt">設定と初回の体組成は残ります。</p>
      </div>
    </>
  );
}

/** 写真からのカロリー推定（Claude API）の設定。キーはこの端末にだけ保存する */
function AiSection({ d }: { d: AppData }) {
  const [saved, setSaved] = useState(loadAi);
  const [key, setKey] = useState('');
  const [model, setModel] = useState<AiModel>(saved?.model ?? DEFAULT_MODEL);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const month = todayStr().slice(0, 7);
  const usd = Object.entries(d.meals)
    .filter(([date]) => date.startsWith(month))
    .flatMap(([, list]) => list)
    .reduce((a, m) => a + (m.ai?.usd ?? 0), 0);

  const check = async (s: AiSettings) => {
    setBusy(true);
    setMsg('確認中…');
    try {
      await verifyAi(s);
      setMsg('使えます。食事タブの「食事を記録」から写真で推定できます。');
    } catch (e) {
      setMsg(e instanceof AiError ? e.message : '確認できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sect">
      <div className="sect-h">
        <h3>写真からカロリー推定（AI）</h3>
        <HelpButton k="ai-setup" label="API キーの取り方" />
      </div>
      {saved ? (
        <>
          <p className="sm muted">
            API キー登録済み（…{saved.apiKey.slice(-4)}）・今月の推定費用 約{Math.round(usd * YEN_PER_USD)}円
          </p>
          <label className="fl-inline">
            モデル
            <select
              className="inp"
              value={model}
              onChange={(e) => {
                const m = e.target.value as AiModel;
                setModel(m);
                const next = { ...saved, model: m };
                saveAi(next);
                setSaved(next);
                setMsg('');
              }}
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className="btns">
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void check(saved)}>
              接続を確認
            </button>
            <ConfirmButton
              className="btn danger sm"
              label="キーを削除"
              armedLabel="もう一度で削除"
              onConfirm={() => {
                clearAi();
                setSaved(null);
                setMsg('キーを削除しました。');
              }}
            />
          </div>
        </>
      ) : (
        <>
          <p className="sm muted">Anthropic Console で作った API キーを貼り付けます。キーはこの端末の中だけに保存され、バックアップにも含まれません。</p>
          <input
            className="inp"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Claude API キー"
          />
          <button
            type="button"
            className="btn sm mt"
            disabled={busy || !key.trim()}
            onClick={() => {
              const s = { apiKey: key.trim(), model };
              saveAi(s);
              setSaved(s);
              setKey('');
              void check(s);
            }}
          >
            保存して確認
          </button>
        </>
      )}
      <p className="hint" role="status">
        {msg}
      </p>
    </div>
  );
}

function ImportBody({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<AppData | null>(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const parse = (raw: string) => {
    setDone('');
    try {
      setParsed(normalize(JSON.parse(raw)));
      setErr('');
    } catch (e) {
      setParsed(null);
      setErr(e instanceof SyntaxError ? 'JSON として読めませんでした。' : (e as Error).message);
    }
  };

  const sum = parsed ? summarize(parsed) : null;
  return (
    <>
      <p className="sm muted">試作版やバックアップの JSON を読み込みます。ファイルを選ぶか、中身を貼り付けてください。</p>
      <label className="btn ghost wide file-btn">
        ファイルを選ぶ
        <input
          type="file"
          accept="application/json,.json,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then(parse);
          }}
        />
      </label>
      <textarea className="inp ta" rows={5} placeholder="ここに貼り付け" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn ghost wide" disabled={!text.trim()} onClick={() => parse(text)}>
        貼り付けた内容を確認
      </button>
      {err && <p className="hint err">{err}</p>}
      {sum && (
        <div className="box n">
          <b>読み込む内容</b>
          <br />
          体重 {sum.weights}件{sum.from ? `（${sum.from} 〜 ${sum.to}）` : ''}
          <br />
          チェック {sum.habits}日・筋トレ {sum.lifts}件・体組成 {sum.comp}回・食事 {sum.meals}件
        </div>
      )}
      {parsed && (
        <div className="btns">
          <button
            type="button"
            className="btn"
            onClick={() => {
              importData(parsed, 'merge');
              setDone('統合しました。');
              setParsed(null);
            }}
          >
            統合する
          </button>
          <ConfirmButton
            className="btn danger"
            label="置き換える"
            armedLabel="今の記録を消して置き換え"
            onConfirm={() => {
              importData(parsed, 'replace');
              setDone('置き換えました。');
              setParsed(null);
            }}
          />
        </div>
      )}
      {parsed && <p className="sm muted">統合：同じ日付は読み込んだ方を優先。置き換え：今の記録を消して読み込んだ内容だけにします。</p>}
      <p className="hint">{done}</p>
      <button type="button" className="link" onClick={onDone}>
        ← 設定に戻る
      </button>
    </>
  );
}

/* ---------- 新しいバージョンのお知らせ ---------- */

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
