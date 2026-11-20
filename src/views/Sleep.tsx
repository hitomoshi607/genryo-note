import { useState } from 'react';
import { SleepChart } from '../components/charts';
import { SleepInput } from '../components/Inputs';
import { SLEEP_TARGET_H } from '../data/plan';
import { deleteSleep } from '../lib/actions';
import { jDate } from '../lib/date';
import { durationMin, hm, sleepStats } from '../lib/sleep';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { Card, ConfirmButton, PageHead } from '../ui';

export function Sleep() {
  const d = useData();
  const today = useToday();
  const ss = sleepStats(d.sleep, today);
  const [date, setDate] = useState(today);
  const [more, setMore] = useState(false);
  const list = Object.keys(d.sleep).sort().reverse();

  return (
    <>
      <PageHead title="睡眠" help="sleep" helpLabel="睡眠の見方" />

      <Card title="直近7日" side={ss ? `${ss.nights}日分` : undefined}>
        <div className="big3 n">
          <div>
            <b className={ss && ss.avgMin < SLEEP_TARGET_H * 60 ? 'warn-t' : ''}>{ss ? hm(ss.avgMin) : '—'}</b>
            <span>平均（目安 {SLEEP_TARGET_H}:00）</span>
          </div>
          <div>
            <b>{ss ? ss.avgBed : '—'}</b>
            <span>寝る時刻</span>
          </div>
          <div>
            <b className={ss && ss.bedSpread > 60 ? 'warn-t' : ''}>{ss ? hm(ss.bedSpread) : '—'}</b>
            <span>寝る時刻の幅</span>
          </div>
        </div>
      </Card>

      <Card title="14日間">
        <SleepChart d={d} today={today} />
      </Card>

      <Card title="記録">
        <label className="date-row">
          <span>起きた日</span>
          <input className="n" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <SleepInput key={date} date={date} />
        <ul className="hist">
          {(more ? list : list.slice(0, 14)).map((k) => (
            <li key={k}>
              <span className="hd">{jDate(k)}</span>
              <span className="hv n">
                {hm(durationMin(d.sleep[k]))}
                <small>
                  {' '}
                  {d.sleep[k].bed}〜{d.sleep[k].wake}
                </small>
              </span>
              <ConfirmButton onConfirm={() => deleteSleep(k)} />
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
