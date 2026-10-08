import { useState } from 'react';
import { habitRate, sleepPlan, STEPS_GOAL } from '../lib/calc';
import { WD, addDays, jDate, mondayOf, weekday } from '../lib/date';
import { comma } from '../lib/format';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { Card, PageHead } from '../ui';

export function Habit() {
  const d = useData();
  const today = useToday();
  const sp = sleepPlan(d.settings.bed, d.settings.wake);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rates = days.map((x) => ({ d: x, ...habitRate(d, x) }));
  const avg = Math.round((rates.reduce((a, r) => a + r.rate, 0) / rates.length) * 100);
  const [sel, setSel] = useState<string | null>(null);
  const selR = rates.find((r) => r.d === sel);

  const mon = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => d.sos[addDays(mon, i)]).filter(Boolean);
  const held = week.reduce((a, s) => a + (s?.held ?? 0), 0);
  const ate = week.reduce((a, s) => a + (s?.ate ?? 0), 0);

  return (
    <>
      <PageHead title="睡眠と習慣" help="about" helpLabel="このプランについて" />

      <Card title="睡眠" help="sleep" helpLabel="睡眠のポイント">
        <div className="sleep">
          <div>
            <b className="n">{d.settings.bed.replace(/^0/, '')}</b>
            <span>寝る</span>
          </div>
          <div>
            <b className="n">{d.settings.wake.replace(/^0/, '')}</b>
            <span>起きる</span>
          </div>
          <div>
            <b className="n">{sp.hours}h</b>
            <span>睡眠</span>
          </div>
        </div>
        <ul className="tl">
          {sp.timeline.map((x) => (
            <li key={x.what}>
              <span className="t n">{x.t}</span>
              <span>{x.what}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="習慣チェック（7日）" side={`平均 ${avg}%`} help="habitbars" helpLabel="グラフの見方">
        <div className="hab" role="group" aria-label="直近7日のチェック達成率">
          <i className="hab-goal" aria-hidden="true" />
          {rates.map((r) => (
            <button
              key={r.d}
              type="button"
              className={`hb${r.d === today ? ' td' : ''}`}
              aria-pressed={sel === r.d}
              aria-label={`${jDate(r.d)} ${r.n}/${r.total}`}
              onClick={() => setSel(sel === r.d ? null : r.d)}
            >
              <i style={{ height: `${Math.max(3, r.rate * 100)}%`, opacity: r.n ? 1 : 0.25 }} />
              <span>{WD[weekday(r.d)]}</span>
            </button>
          ))}
        </div>
        <p className="hint n">{selR ? `${jDate(selR.d)}　${selR.n} / ${selR.total} 項目` : '目標は半分以上を続けること'}</p>
      </Card>

      <Card title="ストレス食い（今週）" help="stress" helpLabel="つきあい方">
        <div className="sleep">
          <div>
            <b className="n">{held}</b>
            <span>乗り切った</span>
          </div>
          <div>
            <b className="n">{ate}</b>
            <span>食べた</span>
          </div>
          <div>
            <b className="n">{held + ate ? Math.round((held / (held + ate)) * 100) : '—'}</b>
            <span>乗り切り率 %</span>
          </div>
        </div>
      </Card>

      <Card title="毎日の活動" help="activity" helpLabel="活動のポイント">
        <ul className="lines">
          <li>
            1日 <b className="n">{comma(STEPS_GOAL)}歩</b>
          </li>
          <li>大学の日は駅まで歩く・階段を使う</li>
          <li>休養日は散歩30分</li>
          <li>座りっぱなしは30分まで</li>
        </ul>
      </Card>

      <Card title="体重の見方" help="weight" helpLabel="見方と停滞時">
        <ul className="lines">
          <li>毎朝、トイレのあとに測る</li>
          <li>
            判断は <b>7日平均</b> で
          </li>
          <li>目安は週0.3〜0.7kg減</li>
          <li>体組成は月1〜2回・写真は月1回</li>
        </ul>
      </Card>
    </>
  );
}
