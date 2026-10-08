import { useState } from 'react';
import { FavoriteChips } from '../components/FavoriteChips';
import { IconCamera, IconCheck } from '../components/Icons';
import { dayTotals, defaultSlot } from '../lib/meals';
import { T_MAIN, T_SHORT, T_OPT, T_SUB } from '../data/plan';
import { saveWeight, toggleHabit } from '../lib/actions';
import { STEPS_GOAL, avg7, calcTargets, checksFor, currentWeight, dayTypeOf, latestComp, weightAlert, weightEntries } from '../lib/calc';
import { WD, addDays, dayDiff, jDate, mondayOf, weekday } from '../lib/date';
import { comma, f1, signed } from '../lib/format';
import { isGym, type AppData } from '../lib/schema';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { alertHelpKey } from '../help';
import { Card, HelpButton, useUI } from '../ui';

export function Today() {
  const d = useData();
  const today = useToday();
  const { go, openSos, openSettings, openMeal } = useUI();
  const type = dayTypeOf(d, today);
  const t = calcTargets(latestComp(d));
  const eaten = dayTotals(d, today);
  const slotNow = defaultSlot();
  const alert = weightAlert(d, today);
  const mon = mondayOf(today);
  const sos = d.sos[today];
  const backupDays = d.backupAt ? dayDiff(d.backupAt.slice(0, 10), today) : null;
  const hasRecords = Object.keys(d.weights).length > 3;

  return (
    <>
      <div className="hero">
        <div>
          <p className="hero-d">{jDate(today)}</p>
          <h1>{T_MAIN[type]}</h1>
          <p className="hero-s">{T_SUB[type]}</p>
        </div>
        <HelpButton k="today" label="今日のポイント" />
      </div>

      {isGym(type) && (
        <button type="button" className="btn wide mb" onClick={() => go('gym', { gymDay: type })}>
          今日のメニュー（Day {type}）を開く
        </button>
      )}

      <ul className="week" aria-label="今週の予定">
        {Array.from({ length: 7 }, (_, i) => addDays(mon, i)).map((day) => {
          const k = dayTypeOf(d, day);
          return (
            <li
              key={day}
              className={`${isGym(k) ? 'gym' : ''}${day === today ? ' now' : ''}`}
              aria-label={`${WD[weekday(day)]}曜日 ${T_OPT[k]}${d.weights[day] !== undefined ? ' 体重記録あり' : ''}`}
            >
              <span className="wd">{WD[weekday(day)]}</span>
              <span className="wt">{T_SHORT[k]}</span>
              <span className={`wdot${d.weights[day] !== undefined ? ' on' : ''}`} />
            </li>
          );
        })}
      </ul>

      {alert && (
        <div className={`alert ${alert.kind}`} role="status">
          <div>
            <b>{alert.kind === 'fast' ? `減りが速すぎ（週${f1(-alert.perWeek)}kg）` : '2週間 7日平均が停滞'}</b>
            <span>{alert.kind === 'fast' ? '間食を1つ足す' : `今週は：${alert.tip.text}`}</span>
          </div>
          <HelpButton k={alertHelpKey(alert.kind)} label="くわしく" />
        </div>
      )}

      <Card title="今日の目安" help="targets" helpLabel="目安の根拠">
        <div className="aims">
          <div>
            <b className="n">{comma(t.kcal)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b className="n">{t.p}</b>
            <span>タンパク質 g</span>
          </div>
          <div>
            <b className="n">{comma(STEPS_GOAL)}</b>
            <span>歩</span>
          </div>
        </div>
        <div className="eaten">
          {eaten.kcal > 0 ? (
            <span className="n">
              食べた <b className={eaten.kcal > t.kcal ? 'warn-t' : ''}>{comma(eaten.kcal)}</b>kcal・P <b>{eaten.p}</b>g
            </span>
          ) : (
            <span className="muted">食事の記録はまだありません</span>
          )}
          <button type="button" className="btn ghost sm icon-btn" onClick={() => openMeal({ date: today })}>
            <IconCamera />
            食事を記録
          </button>
        </div>
        <FavoriteChips date={today} favorites={d.favorites.filter((f) => !f.slot || f.slot === slotNow)} />
      </Card>

      <WeightCard key={today} d={d} today={today} />

      <ChecksCard d={d} today={today} />

      <button type="button" className="sos" onClick={openSos}>
        食べたくなったら押す
      </button>
      <p className="sos-n n">{sos ? `今日：乗り切った ${sos.held}回／食べた ${sos.ate}回` : ''}</p>

      {hasRecords && (backupDays === null || backupDays >= 30) && (
        <button type="button" className="nudge" onClick={openSettings}>
          {backupDays === null ? 'まだバックアップがありません' : `最後のバックアップから${backupDays}日`} → 設定から書き出す
        </button>
      )}
    </>
  );
}

function WeightCard({ d, today }: { d: AppData; today: string }) {
  const recorded = d.weights[today];
  const entries = weightEntries(d.weights);
  const lastVal = entries.length ? entries[entries.length - 1].w : latestComp(d).w;
  const [val, setVal] = useState(recorded !== undefined ? f1(recorded) : '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);

  const stepBy = (delta: number) => {
    const base = parseFloat(val);
    setVal(f1((Number.isFinite(base) ? base : lastVal) + delta));
    setMsg('');
  };

  const save = () => {
    const v = parseFloat(val);
    if (!Number.isFinite(v) || v < 30 || v > 200) {
      setErr(true);
      setMsg('30〜200kgの数字を入力してください。');
      return;
    }
    saveWeight(today, v);
    const next = { ...d.weights, [today]: Math.round(v * 10) / 10 };
    const a = avg7(next, today) as number;
    const p = avg7(next, addDays(today, -7));
    setErr(false);
    setVal(f1(v));
    setMsg(`記録しました。7日平均 ${f1(a)}kg${p !== null ? `（先週より ${signed(a - p)}kg）` : ''}`);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <Card title={<label htmlFor="w-today">今朝の体重</label>} help="weigh" helpLabel="測り方">
      <div className="wrow">
        <button type="button" className="stepper" onClick={() => stepBy(-0.1)} aria-label="0.1kg減らす">
          −
        </button>
        <div className="inp-wrap">
          <input
            id="w-today"
            className="inp big n"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="200"
            placeholder={f1(lastVal)}
            value={val}
            aria-invalid={err}
            aria-describedby="w-hint"
            onChange={(e) => {
              setVal(e.target.value);
              setMsg('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <span className="unit">kg</span>
        </div>
        <button type="button" className="stepper" onClick={() => stepBy(0.1)} aria-label="0.1kg増やす">
          ＋
        </button>
        <button type="button" className="btn" onClick={save}>
          記録
        </button>
      </div>
      <p id="w-hint" className={`hint n${err ? ' err' : ''}`}>
        {msg || (recorded !== undefined ? '今日は記録済みです（直すときは入れ直して記録）' : `前回 ${f1(lastVal)}kg・いま（7日平均）${f1(currentWeight(d))}kg`)}
      </p>
    </Card>
  );
}

function ChecksCard({ d, today }: { d: AppData; today: string }) {
  const list = checksFor(d, today);
  const done = d.habits[today] ?? {};
  const n = list.filter((c) => done[c.id]).length;
  return (
    <Card title="今日のチェック" side={`${n} / ${list.length}`} help="checks" helpLabel="項目の説明">
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${Math.round((n / list.length) * 100)}%` }} />
      </div>
      <ul className="checks">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" className="ck" aria-pressed={!!done[c.id]} onClick={() => toggleHabit(today, c.id)}>
              <span className="bx">
                <IconCheck />
              </span>
              <span className="ct">{c.t}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
