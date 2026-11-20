// 体重・睡眠・有酸素の入力（今日の画面と各タブで共通）
import { useState } from 'react';
import { pace } from '../data/plan';
import { deleteCardio, saveCardio, saveSleep, saveWeight } from '../lib/actions';
import { f1, kg } from '../lib/format';
import type { DayKind } from '../lib/schema';
import { durationMin, hm } from '../lib/sleep';
import { useData } from '../lib/store';
import { sortedWeights } from '../lib/weight';
import { IconCheck } from './Icons';

/** 体重の入力。前回の値から ±0.1 で合わせて記録する */
export function WeightInput({ date }: { date: string }) {
  const d = useData();
  const rec = d.weights[date];
  const prev = sortedWeights(d.weights)
    .filter((p) => p.d < date)
    .pop();
  const [v, setV] = useState(rec !== undefined ? f1(rec) : prev ? f1(prev.w) : '');
  const [msg, setMsg] = useState('');
  const num = parseFloat(v);
  const saved = rec !== undefined && Math.abs(rec - num) < 0.05;

  const step = (n: number) => {
    const base = Number.isFinite(num) ? num : (prev?.w ?? d.settings.startWeight);
    setV(f1(base + n));
    setMsg('');
  };
  const save = () => {
    if (!(num >= 30 && num <= 250)) return setMsg('30〜250kg で入力してください。');
    saveWeight(date, num);
    setMsg('');
  };

  return (
    <>
      <div className="wt-in">
        <button type="button" className="stepper" aria-label="0.1kg 減らす" onClick={() => step(-0.1)}>
          −
        </button>
        <label className="wt-box">
          <input
            className="n"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="250"
            aria-label="体重（kg）"
            value={v}
            onChange={(e) => {
              setV(e.target.value);
              setMsg('');
            }}
          />
          <span>kg</span>
        </label>
        <button type="button" className="stepper" aria-label="0.1kg 増やす" onClick={() => step(0.1)}>
          ＋
        </button>
        <button type="button" className={`btn${saved ? ' done' : ''}`} onClick={save}>
          {saved ? <IconCheck /> : '記録'}
        </button>
      </div>
      {msg && (
        <p className="hint err" role="alert">
          {msg}
        </p>
      )}
      {!msg && prev && <p className="sub n">前回 {kg(prev.w)}kg</p>}
    </>
  );
}

/** 睡眠の入力。date は起きた日 */
export function SleepInput({ date }: { date: string }) {
  const d = useData();
  const rec = d.sleep[date];
  const prevDay = Object.keys(d.sleep)
    .filter((k) => k < date)
    .sort()
    .pop();
  const prev = prevDay ? d.sleep[prevDay] : undefined;
  const [bed, setBed] = useState(rec?.bed ?? prev?.bed ?? '23:30');
  const [wake, setWake] = useState(rec?.wake ?? prev?.wake ?? '07:00');
  const saved = rec?.bed === bed && rec?.wake === wake;
  const ok = !!bed && !!wake;

  return (
    <div className="sl-in">
      <label>
        <span>寝た</span>
        <input className="n" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
      </label>
      <label>
        <span>起きた</span>
        <input className="n" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
      </label>
      <b className="sl-len n" aria-label="睡眠時間">
        {ok ? hm(durationMin({ bed, wake })) : '—'}
      </b>
      <button type="button" className={`btn${saved ? ' done' : ''}`} disabled={!ok} onClick={() => saveSleep(date, { bed, wake })}>
        {saved ? <IconCheck /> : '記録'}
      </button>
    </div>
  );
}

/** 有酸素（傾斜ウォーキング）。押すと完了として記録する */
export function CardioRow({ date, kind }: { date: string; kind: Exclude<DayKind, 'rest'> }) {
  const d = useData();
  const c = d.settings.cardio;
  const plan = kind === 'cardio' ? c.cardioMin : c.liftMin;
  const rec = d.cardio[date];
  const [min, setMin] = useState(String(rec?.min ?? plan));
  const m = parseInt(min, 10);
  const km = (c.speed * (Number.isFinite(m) ? m : plan)) / 60;

  return (
    <div className="cardio">
      <dl className="cd-spec n">
        <div>
          <dt>傾斜</dt>
          <dd>
            {kg(c.incline)}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>時速</dt>
          <dd>
            {kg(c.speed)}
            <small>km</small>
          </dd>
        </div>
        <div>
          <dt>1km</dt>
          <dd>{pace(c.speed)}</dd>
        </div>
        <div>
          <dt>距離</dt>
          <dd>
            {km.toFixed(1)}
            <small>km</small>
          </dd>
        </div>
      </dl>
      {rec ? (
        <div className="cd-done">
          <span className="ok-t">
            <IconCheck />
            <b className="n">{rec.min}分</b> 完了
          </span>
          <button type="button" className="link" onClick={() => deleteCardio(date)}>
            取り消す
          </button>
        </div>
      ) : (
        <div className="cd-go">
          <label className="min-box">
            <input
              className="n"
              type="number"
              inputMode="numeric"
              min="1"
              max="300"
              aria-label="有酸素の時間（分）"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
            <span>分</span>
          </label>
          <button
            type="button"
            className="btn"
            disabled={!(m > 0)}
            onClick={() => saveCardio(date, { min: m, incline: c.incline, speed: c.speed })}
          >
            完了
          </button>
        </div>
      )}
    </div>
  );
}
