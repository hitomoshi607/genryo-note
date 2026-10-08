import { useState } from 'react';
import { IconTimer } from '../components/Icons';
import { WORKOUTS, type Exercise } from '../data/plan';
import { deleteLift, saveLift } from '../lib/actions';
import { deloadWindow } from '../lib/calc';
import { jDate, jMD } from '../lib/date';
import { kg } from '../lib/format';
import { suggest, suggestedWeight, suggestionText } from '../lib/progression';
import type { GymDay, LiftRec } from '../lib/schema';
import { useData } from '../lib/store';
import { keepAwake, restTimer, unlockAudio } from '../lib/timer';
import { useToday } from '../lib/useToday';
import { Card, ConfirmButton, HelpButton, PageHead, Seg } from '../ui';

/* ---------- 入力途中の値（今日の間だけ残す） ---------- */

const DRAFT_KEY = 'genryo-gym-draft';
type Draft = Record<string, { w: string; r: string[] }>;

function loadDraft(today: string): Draft {
  try {
    const x = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    if (x && x.d === today && x.v && typeof x.v === 'object') return x.v as Draft;
  } catch {
    /* 壊れていたら捨てる */
  }
  return {};
}

function storeDraft(today: string, v: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ d: today, v }));
  } catch {
    /* 保存できなくても入力は続けられる */
  }
}

export function Gym({ day, onDay }: { day: GymDay; onDay: (d: GymDay) => void }) {
  const today = useToday();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(today));
  const W = WORKOUTS[day];
  const dl = deloadWindow(today);

  const setOne = (id: string, v: { w: string; r: string[] } | null) => {
    const next = { ...draft };
    if (v) next[id] = v;
    else delete next[id];
    setDraft(next);
    storeDraft(today, next);
  };

  return (
    <>
      <PageHead title="筋トレ" help="gym" helpLabel="進め方のルール" />
      <Seg
        label="メニュー"
        value={day}
        onChange={onDay}
        options={(['A', 'B', 'C'] as const).map((k) => ({ v: k, title: `Day ${k}`, sub: WORKOUTS[k].short }))}
      />

      {dl.active && (
        <div className="alert deload" role="status">
          <div>
            <b>今週はディロード週</b>
            <span>
              重さはいつもの7割（{jMD(dl.from)}〜{jMD(dl.to)}）
            </span>
          </div>
        </div>
      )}

      <Card title={`Day ${day}：${W.name}`} side={W.time} help="program" helpLabel="このメニューの考え方">
        <p className="row-tag">
          <span className="pill">準備</span>
          <span className="sm">{W.warm}</span>
        </p>
      </Card>

      {W.ex.map((ex, i) => (
        <ExerciseCard key={`${today}-${ex.id}`} ex={ex} no={i + 1} today={today} draft={draft[ex.id]} onDraft={(v) => setOne(ex.id, v)} />
      ))}

      <Card>
        <p className="row-tag">
          <span className="pill">有酸素</span>
          <span className="sm">
            <b>{W.cardioAt}</b>
            <br />
            {W.cardio}
          </span>
        </p>
      </Card>
    </>
  );
}

function ExerciseCard({
  ex,
  no,
  today,
  draft,
  onDraft,
}: {
  ex: Exercise;
  no: number;
  today: string;
  draft?: { w: string; r: string[] };
  onDraft: (v: { w: string; r: string[] } | null) => void;
}) {
  const d = useData();
  const hist = d.lifts[ex.id] ?? [];
  const sug = suggest(ex, hist, today);
  const todayRec = hist.find((h) => h.d === today);
  const prev = [...hist].reverse().find((h) => h.d < today);
  const [msg, setMsg] = useState('');
  const [showHist, setShowHist] = useState(false);

  const sw = suggestedWeight(sug);
  const base = draft ?? {
    w: todayRec ? kg(todayRec.w) : sw !== null ? kg(sw) : ex.inc === 0 ? '0' : '',
    r: Array.from({ length: ex.sets }, (_, i) => (todayRec?.r[i] ? String(todayRec.r[i]) : '')),
  };
  const edit = (v: { w: string; r: string[] }) => {
    onDraft(v);
    setMsg('');
  };

  const save = () => {
    const w = parseFloat(base.w);
    const r = base.r.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
    if (!Number.isFinite(w) || w < 0) return setMsg('重さを入力してください（自重は0）。');
    if (!r.length) return setMsg('回数を1セット以上入力してください。');
    saveLift(ex.id, today, w, r);
    onDraft(null);
    setMsg('記録しました。');
  };

  return (
    <section className="card">
      <div className="ex-h">
        <span className="ex-no">{no}</span>
        <div className="ex-b">
          <h3>{ex.n}</h3>
          <p className="ex-m">
            <span className="sets n">
              {ex.sets}セット × {ex.lo}〜{ex.hi}回{ex.side ? `（${ex.side}）` : ''}
            </span>
            <span>休憩 {ex.rest}</span>
            <span>{ex.where}</span>
          </p>
        </div>
        <HelpButton k={`ex:${ex.id}`} label={`${ex.n}のポイント`} />
      </div>
      <div className="ex-log">
        <p className="ex-last n">
          {prev ? `前回 ${jMD(prev.d)}　${kg(prev.w)}kg × ${prev.r.join('/')}回` : '記録なし'}
          {todayRec && <span className="today-rec">　今日 {kg(todayRec.w)}kg × {todayRec.r.join('/')}</span>}
        </p>
        <p className={`ex-next${sug.kind === 'up' ? ' up' : ''}`}>{suggestionText(sug)}</p>
        <div className="ex-f">
          <input
            className="kgin n"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="kg"
            aria-label={`${ex.n}の重さ（kg）`}
            value={base.w}
            onChange={(e) => edit({ ...base, w: e.target.value })}
          />
          <span className="x">kg ×</span>
          {base.r.map((v, i) => (
            <input
              key={i}
              className="rep n"
              type="number"
              inputMode="numeric"
              min="0"
              max="50"
              placeholder={String(ex.hi)}
              aria-label={`${ex.n} ${i + 1}セット目の回数`}
              value={v}
              onChange={(e) => {
                const r = [...base.r];
                r[i] = e.target.value;
                edit({ ...base, r });
              }}
            />
          ))}
          <button type="button" className="btn sm" onClick={save}>
            記録
          </button>
        </div>
        <p className="ex-ok">{msg}</p>
        <div className="ex-act">
          <button
            type="button"
            className="btn ghost sm icon-btn"
            onClick={() => {
              unlockAudio();
              void keepAwake(true);
              restTimer.start(ex.restSec, ex.n);
            }}
          >
            <IconTimer />
            休憩 {Math.floor(ex.restSec / 60)}:{String(ex.restSec % 60).padStart(2, '0')}
          </button>
          {hist.length > 0 && (
            <button type="button" className="link" onClick={() => setShowHist(!showHist)} aria-expanded={showHist}>
              {showHist ? '履歴を閉じる' : `履歴（${hist.length}）`}
            </button>
          )}
        </div>
        {showHist && <LiftHistory id={ex.id} hist={hist} />}
      </div>
    </section>
  );
}

function LiftHistory({ id, hist }: { id: string; hist: LiftRec[] }) {
  return (
    <ul className="hist sm">
      {[...hist].reverse().map((h) => (
        <li key={h.d}>
          <span className="hd">{jDate(h.d)}</span>
          <span className="hv n">
            {kg(h.w)}kg × {h.r.join('/')}
          </span>
          <ConfirmButton onConfirm={() => deleteLift(id, h.d)} />
        </li>
      ))}
    </ul>
  );
}
