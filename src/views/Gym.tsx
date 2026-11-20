import { useState } from 'react';
import { IconCheck, IconTimer } from '../components/Icons';
import { CardioRow } from '../components/Inputs';
import { WORKOUTS, type Exercise, type Session } from '../data/plan';
import { deleteLift, saveLift } from '../lib/actions';
import { addDays, jDate, jMD, mondayOf, WD, weekday } from '../lib/date';
import { kg } from '../lib/format';
import { dayKind, deloadWindow, KIND_LABEL, projectSessions, sessionFor } from '../lib/gym';
import { suggest, suggestedWeight, suggestionText } from '../lib/progression';
import type { LiftRec } from '../lib/schema';
import { useData } from '../lib/store';
import { keepAwake, mmss, restTimer, unlockAudio } from '../lib/timer';
import { useToday } from '../lib/useToday';
import { Card, ConfirmButton, HelpButton, PageHead, Seg } from '../ui';

/* ---------- 入力途中の値（今日の間だけ残す） ---------- */

const DRAFT_KEY = 'genryo-note-v3-gym-draft';
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

type View = Session | 'cardio';

export function Gym() {
  const d = useData();
  const today = useToday();
  const kind = dayKind(d, today);
  const next = sessionFor(d, today);
  const [view, setView] = useState<View>(kind === 'cardio' ? 'cardio' : next);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(today));
  const dl = deloadWindow(d.settings.startDate, today);

  const setOne = (id: string, v: { w: string; r: string[] } | null) => {
    const nd = { ...draft };
    if (v) nd[id] = v;
    else delete nd[id];
    setDraft(nd);
    storeDraft(today, nd);
  };

  const mark = (v: View) => ((kind === 'cardio' && v === 'cardio') || (kind === 'lift' && v === next) ? '今日' : v === next ? '次' : '');

  return (
    <>
      <PageHead title="ジム" help="gym" helpLabel="メニューの考え方" />
      <Seg
        label="メニュー"
        value={view}
        onChange={setView}
        options={[
          { v: 'A', title: 'ベンチの日', sub: mark('A') },
          { v: 'B', title: 'デッドの日', sub: mark('B') },
          { v: 'cardio', title: '有酸素', sub: mark('cardio') },
        ]}
      />

      {dl.active && view !== 'cardio' && (
        <p className="note" role="status">
          今週は軽めの週（{jMD(dl.from)}〜{jMD(dl.to)}）：重さはいつもの7割
        </p>
      )}

      {view === 'cardio' ? (
        <Card title="傾斜ウォーキング" side={`${d.settings.cardio.cardioMin}分`} help="cardio" helpLabel="傾斜ウォーキングについて">
          <CardioRow key={`${today}-c`} date={today} kind="cardio" />
        </Card>
      ) : (
        <>
          {WORKOUTS[view].ex.map((ex, i) => (
            <ExerciseCard
              key={`${today}-${ex.id}`}
              ex={ex}
              no={i + 1}
              session={view}
              today={today}
              draft={draft[ex.id]}
              onDraft={(v) => setOne(ex.id, v)}
            />
          ))}
          <Card title="有酸素" side={`${d.settings.cardio.liftMin}分`} help="cardio" helpLabel="傾斜ウォーキングについて">
            <CardioRow key={`${today}-l`} date={today} kind="lift" />
          </Card>
        </>
      )}

      <WeekCard />
    </>
  );
}

function ExerciseCard({
  ex,
  no,
  session,
  today,
  draft,
  onDraft,
}: {
  ex: Exercise;
  no: number;
  session: Session;
  today: string;
  draft?: { w: string; r: string[] };
  onDraft: (v: { w: string; r: string[] } | null) => void;
}) {
  const d = useData();
  const hist = d.lifts[ex.id] ?? [];
  const sug = suggest(ex, hist, today, d.settings.startDate);
  const todayRec = hist.find((h) => h.d === today);
  const prev = [...hist].reverse().find((h) => h.d < today);
  // 記録したあとは、今日の記録をふまえた次回の提案を出す
  const nextSug = todayRec ? suggest(ex, hist, addDays(today, 1), d.settings.startDate) : null;
  const [msg, setMsg] = useState('');
  const [showHist, setShowHist] = useState(false);

  const sw = suggestedWeight(sug);
  const base = draft ?? {
    w: todayRec ? kg(todayRec.w) : sw !== null ? kg(sw) : '',
    r: Array.from({ length: ex.sets }, (_, i) => (todayRec?.r[i] ? String(todayRec.r[i]) : '')),
  };
  const edit = (v: { w: string; r: string[] }) => {
    onDraft(v);
    setMsg('');
  };

  const save = () => {
    const w = parseFloat(base.w);
    const r = base.r.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
    if (!Number.isFinite(w) || w < 0) return setMsg('重さを入れてください。');
    if (!r.length) return setMsg('回数を1セット以上入れてください。');
    saveLift(ex.id, session, today, w, r);
    onDraft(null);
    setMsg('');
  };

  return (
    <section className={`card ex${todayRec ? ' is-done' : ''}`}>
      <div className="ex-h">
        <span className="ex-no n">{todayRec ? <IconCheck /> : no}</span>
        <div className="ex-b">
          <h3>{ex.n}</h3>
          <p className="ex-m n">
            {ex.sets}×{ex.lo}〜{ex.hi}回・休憩 {mmss(ex.restSec)}
          </p>
        </div>
        <HelpButton k={`ex:${ex.id}`} label={`${ex.n}のやり方`} />
      </div>

      <p className="ex-last n">
        {todayRec && nextSug ? (
          <>
            <span>
              今日 {kg(todayRec.w)}kg × {todayRec.r.join('/')}
            </span>
            <span className={nextSug.kind === 'up' ? 'up' : ''}>→ 次回 {suggestionText(nextSug)}</span>
          </>
        ) : (
          <>
            <span>{prev ? `前回 ${kg(prev.w)}kg × ${prev.r.join('/')}` : '記録なし'}</span>
            <span className={sug.kind === 'up' ? 'up' : ''}>→ {suggestionText(sug)}</span>
          </>
        )}
      </p>

      <div className="ex-f">
        <label className="kg-box">
          <input
            className="n"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="0"
            aria-label={`${ex.n}の重さ（kg）`}
            value={base.w}
            onChange={(e) => edit({ ...base, w: e.target.value })}
          />
          <span>kg</span>
        </label>
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
        <button type="button" className={`btn${todayRec && !draft ? ' done' : ''}`} onClick={save}>
          {todayRec && !draft ? <IconCheck /> : '記録'}
        </button>
      </div>
      {msg && (
        <p className="hint err" role="alert">
          {msg}
        </p>
      )}

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
          休憩 {mmss(ex.restSec)}
        </button>
        {hist.length > 0 && (
          <button type="button" className="link" onClick={() => setShowHist(!showHist)} aria-expanded={showHist}>
            {showHist ? '履歴を閉じる' : `履歴 ${hist.length}`}
          </button>
        )}
      </div>
      {showHist && <LiftHistory id={ex.id} hist={hist} />}
    </section>
  );
}

function LiftHistory({ id, hist }: { id: string; hist: LiftRec[] }) {
  return (
    <ul className="hist">
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

/** 今週の予定と、できた日 */
function WeekCard() {
  const d = useData();
  const today = useToday();
  const mon = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  // 今日から先の筋トレの日だけ、交互の予定を見せる
  const plan = projectSessions(
    d,
    days.filter((dt) => dt >= today),
  );
  return (
    <Card title="今週">
      <ul className="week">
        {days.map((dt) => {
          const k = dayKind(d, dt);
          const lifted = !!d.sessions[dt];
          const walked = !!d.cardio[dt];
          const done = k === 'lift' ? lifted : k === 'cardio' ? walked : false;
          return (
            <li key={dt} className={`${k}${dt === today ? ' today' : ''}${done ? ' done' : ''}`}>
              <span className="wd">{WD[weekday(dt)]}</span>
              <span className="wk">{d.sessions[dt] ? WORKOUTS[d.sessions[dt]].short : k === 'lift' && plan[dt] ? WORKOUTS[plan[dt]].short : KIND_LABEL[k]}</span>
              <span className="wc" aria-label={done ? 'できた' : ''}>
                {done ? <IconCheck /> : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
