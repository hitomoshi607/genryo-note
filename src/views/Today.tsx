import { IconCheck } from '../components/Icons';
import { CardioRow, SleepInput, WeightInput } from '../components/Inputs';
import { WORKOUTS } from '../data/plan';
import { addDays, jDate, WD, weekday } from '../lib/date';
import { f1, signed } from '../lib/format';
import { dayKind, isDeloadWeek, KIND_LABEL, projectSessions, sessionFor } from '../lib/gym';
import { sleepStats, hm } from '../lib/sleep';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { weightStatus } from '../lib/weight';
import { Card, HelpButton, useUI } from '../ui';

export function Today() {
  const d = useData();
  const today = useToday();
  const kind = dayKind(d, today);
  const st = weightStatus(d, today);
  const ss = sleepStats(d.sleep, today);

  return (
    <>
      <div className="page-h">
        <h1>{jDate(today)}</h1>
        <span className={`kind ${kind}`}>{kind === 'lift' ? `筋トレ・${WORKOUTS[sessionFor(d, today)].short}` : KIND_LABEL[kind]}</span>
        <HelpButton k="today" label="この画面について" />
      </div>

      <Card title="体重" help="weight" helpLabel="体重の見方">
        <WeightInput key={today} date={today} />
        {st && (
          <p className="sub n">
            7日平均 <b>{f1(st.now)}</b>・計画 {f1(st.plan)}
            <span className={st.diff > 0 ? 'warn-t' : 'ok-t'}>（{signed(st.diff)}）</span>
          </p>
        )}
      </Card>

      <Card title="睡眠" side="昨夜" help="sleep" helpLabel="睡眠の見方">
        <SleepInput key={today} date={today} />
        {ss && (
          <p className="sub n">
            7日平均 <b>{hm(ss.avgMin)}</b>・寝る時刻 {ss.avgBed}
          </p>
        )}
      </Card>

      <TodayGym />
    </>
  );
}

function TodayGym() {
  const d = useData();
  const today = useToday();
  const { go } = useUI();
  const kind = dayKind(d, today);

  if (kind === 'cardio') {
    return (
      <Card title="有酸素" help="cardio" helpLabel="傾斜ウォーキングについて">
        <CardioRow key={today} date={today} kind="cardio" />
      </Card>
    );
  }

  if (kind === 'rest') {
    // 次にジムへ行く日
    let next = addDays(today, 1);
    for (let i = 0; i < 7 && dayKind(d, next) === 'rest'; i++) next = addDays(next, 1);
    const nk = dayKind(d, next);
    const plan = projectSessions(d, Array.from({ length: 8 }, (_, i) => addDays(today, i)));
    return (
      <Card title="休み">
        <p className="sub">
          次は {WD[weekday(next)]}曜：{nk === 'lift' && plan[next] ? `筋トレ（${WORKOUTS[plan[next]].name}）` : KIND_LABEL[nk]}
        </p>
      </Card>
    );
  }

  const s = sessionFor(d, today);
  const W = WORKOUTS[s];
  const done = W.ex.filter((ex) => d.lifts[ex.id]?.some((r) => r.d === today)).length;
  return (
    <Card title={W.name} side={`${done}/${W.ex.length}`} help="gym" helpLabel="メニューの考え方">
      {isDeloadWeek(d.settings.startDate, today) && <p className="note">今週は軽めの週（重さはいつもの7割）</p>}
      <ol className="ex-list">
        {W.ex.map((ex) => {
          const rec = d.lifts[ex.id]?.find((r) => r.d === today);
          return (
            <li key={ex.id} className={rec ? 'done' : ''}>
              <span>{ex.n}</span>
              {rec ? (
                <span className="n ok-t">
                  <IconCheck />
                  {f1(rec.w).replace(/\.0$/, '')}kg×{rec.r.join('/')}
                </span>
              ) : (
                <span className="n muted">
                  {ex.sets}×{ex.lo}〜{ex.hi}
                </span>
              )}
            </li>
          );
        })}
        <li className={d.cardio[today] ? 'done' : ''}>
          <span>有酸素</span>
          {d.cardio[today] ? (
            <span className="n ok-t">
              <IconCheck />
              {d.cardio[today].min}分
            </span>
          ) : (
            <span className="n muted">{d.settings.cardio.liftMin}分</span>
          )}
        </li>
      </ol>
      <button type="button" className="btn wide mt" onClick={() => go('gym')}>
        ジムの記録を開く
      </button>
    </Card>
  );
}
