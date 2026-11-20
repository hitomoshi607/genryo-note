import { useState } from 'react';
import { WeightChart } from '../components/charts';
import { WeightInput } from '../components/Inputs';
import { deleteWeight } from '../lib/actions';
import { jDate, jMD } from '../lib/date';
import { f1, kg, signed } from '../lib/format';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { avg7, goalDate, monthStatus, sortedWeights, weightStatus } from '../lib/weight';
import { Card, ConfirmButton, PageHead, Seg } from '../ui';

export function Weight() {
  const d = useData();
  const today = useToday();
  const s = d.settings;
  const st = weightStatus(d, today);
  const ms = monthStatus(d, today);
  const [range, setRange] = useState<'4w' | 'all'>('all');
  const [date, setDate] = useState(today);
  const [more, setMore] = useState(false);
  const list = sortedWeights(d.weights).reverse();

  return (
    <>
      <PageHead title="体重" help="weight" helpLabel="体重の見方" />

      <Card>
        <div className="big3 n">
          <div>
            <b>{st ? f1(st.now) : '—'}</b>
            <span>7日平均</span>
          </div>
          <div>
            <b>{st ? f1(st.plan) : '—'}</b>
            <span>計画</span>
          </div>
          <div>
            <b className={st && st.diff > 0 ? 'warn-t' : 'ok-t'}>{st ? signed(st.diff) : '—'}</b>
            <span>計画との差</span>
          </div>
        </div>
        <p className="sub n">
          目標 {kg(s.goalWeight)}kg まで <b>{st ? `${kg(Math.max(0, st.left))}kg` : '—'}</b>・{jMD(goalDate(s))}
        </p>
      </Card>

      {ms && (
        <Card title={`${ms.n}か月目`} side={`${jMD(ms.from)}〜${jMD(ms.to)}`} help="month" helpLabel="1か月ごとの目標">
          <div className="month n">
            <span>
              <b className={ms.change <= ms.target ? 'ok-t' : ''}>{signed(ms.change)}</b> / {signed(ms.target)}kg
            </span>
            <span className="muted">月末の計画 {kg(ms.goalW)}kg</span>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, Math.max(0, (ms.change / ms.target) * 100))}%` }} />
          </div>
        </Card>
      )}

      <Card title="推移">
        <Seg
          label="表示する期間"
          value={range}
          onChange={setRange}
          options={[
            { v: 'all', title: '全期間' },
            { v: '4w', title: '4週間' },
          ]}
        />
        <WeightChart d={d} today={today} range={range} />
      </Card>

      <Card title="記録">
        <label className="date-row">
          <span>日付</span>
          <input className="n" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <WeightInput key={date} date={date} />
        <ul className="hist">
          {(more ? list : list.slice(0, 14)).map((p) => (
            <li key={p.d}>
              <span className="hd">{jDate(p.d)}</span>
              <span className="hv n">
                {f1(p.w)}
                <small> 平均 {f1(avg7(d.weights, p.d)!)}</small>
              </span>
              <ConfirmButton onConfirm={() => deleteWeight(p.d)} />
            </li>
          ))}
        </ul>
        {list.length > 14 && (
          <button type="button" className="link" onClick={() => setMore(!more)}>
            {more ? '閉じる' : `すべて表示（${list.length}件）`}
          </button>
        )}
      </Card>
    </>
  );
}
