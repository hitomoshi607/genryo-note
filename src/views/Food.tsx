import { useState } from 'react';
import { FavoriteChips } from '../components/FavoriteChips';
import { IconCamera } from '../components/Icons';
import { EXAMPLE_DAY, FOOD_LIMITS, LUNCH, RULES, SNACKS, VISCERAL3 } from '../data/plan';
import { bumpFood } from '../lib/actions';
import { calcTargets, latestComp, weekFoodCount } from '../lib/calc';
import { addDays, jDate } from '../lib/date';
import { comma } from '../lib/format';
import { SLOT_LABEL, dayTotals, sumItems } from '../lib/meals';
import { useMealPhoto } from '../lib/photos';
import type { Meal } from '../lib/schema';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { Card, HelpButton, PageHead, useUI } from '../ui';

/** 目標に対する進み具合（over: 超えたら警告色にする） */
export function Meter({ label, value, max, unit, over }: { label: string; value: number; max: number; unit: string; over?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  const isOver = over && value > max;
  return (
    <div className="meter">
      <div className="meter-h n">
        <span>{label}</span>
        <span>
          <b className={isOver ? 'warn-t' : ''}>{comma(value)}</b> / {comma(max)}
          {unit}
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} className={isOver ? 'over' : ''} />
      </div>
    </div>
  );
}

function MealLog() {
  const d = useData();
  const today = useToday();
  const { openMeal } = useUI();
  const [date, setDate] = useState(today);
  const t = calcTargets(latestComp(d));
  const tot = dayTotals(d, date);
  const list = d.meals[date] ?? [];
  return (
    <Card title="食事の記録" help="meal-ai" helpLabel="写真からの推定について">
      <div className="daynav">
        <button type="button" className="stepper" aria-label="前の日" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <span>{date === today ? `今日・${jDate(date)}` : jDate(date)}</span>
        <button type="button" className="stepper" aria-label="次の日" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
      </div>
      <Meter label="エネルギー" value={tot.kcal} max={t.kcal} unit="kcal" over />
      <Meter label="タンパク質" value={tot.p} max={t.p} unit="g" />
      <div className="fav-block">
        <div className="fav-h">
          <span className="sm muted">よく食べる（タップで記録）</span>
          <HelpButton k="favorites" label="よく食べる食事について" />
        </div>
        <FavoriteChips date={date} favorites={d.favorites} manageable />
      </div>
      {list.length > 0 && (
        <ul className="meals">
          {list.map((m) => (
            <MealRow key={m.id} m={m} onOpen={() => openMeal({ date, meal: m })} />
          ))}
        </ul>
      )}
      <button type="button" className="btn wide icon-btn mt" onClick={() => openMeal({ date })}>
        <IconCamera />
        食事を記録
      </button>
    </Card>
  );
}

function MealRow({ m, onOpen }: { m: Meal; onOpen: () => void }) {
  const photo = useMealPhoto(m.photo);
  const s = sumItems(m.items);
  return (
    <li>
      <button type="button" className="meal-row" onClick={onOpen}>
        {photo ? <img src={photo} alt="" /> : <span className="meal-ph">{SLOT_LABEL[m.slot]}</span>}
        <span className="mr-body">
          <b>
            {SLOT_LABEL[m.slot]} <small className="muted n">{m.t.replace(/^0/, '')}</small>
          </b>
          <small className="muted">{m.items.map((i) => i.name).join('・')}</small>
        </span>
        <span className="mr-kcal n">
          {comma(s.kcal)}
          <small>kcal・P{s.p}</small>
        </span>
      </button>
    </li>
  );
}

const Strong = ({ text, strong }: { text: string; strong?: string }) => {
  if (!strong || !text.includes(strong)) return <>{text}</>;
  const [a, b] = text.split(strong);
  return (
    <>
      {a}
      <b>{strong}</b>
      {b}
    </>
  );
};

export function Food() {
  const d = useData();
  const today = useToday();
  const t = calcTargets(latestComp(d));
  const total = EXAMPLE_DAY.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p }), { kcal: 0, p: 0 });
  const limits = FOOD_LIMITS.filter((f) => !f.adult || d.settings.age >= 20);

  return (
    <>
      <PageHead title="食事" help="targets" helpLabel="目安の根拠" />
      <Card>
        <div className="pfc">
          <div>
            <b className="n">{comma(t.kcal)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b className="n">{t.p}</b>
            <span>タンパク質g</span>
          </div>
          <div>
            <b className="n">{t.f}</b>
            <span>脂質g</span>
          </div>
          <div>
            <b className="n">{t.c}</b>
            <span>炭水化物g</span>
          </div>
        </div>
      </Card>

      <MealLog />

      <Card title="今週の回数" help="foodcount" helpLabel="回数の管理">
        <ul className="counters">
          {limits.map((f) => {
            const n = weekFoodCount(d, today, f.key);
            const over = n > f.limit;
            return (
              <li key={f.key}>
                <div className="cn-l">
                  <b>{f.label}</b>
                  <small>{f.note}</small>
                </div>
                <span className={`cn-v n${over ? ' over' : n === f.limit ? ' full' : ''}`}>
                  {n}
                  <small> / {f.limit}</small>
                </span>
                <button type="button" className="stepper" disabled={n === 0} onClick={() => bumpFood(today, f.key, -1)} aria-label={`${f.label}を1回減らす`}>
                  −
                </button>
                <button type="button" className="stepper plus" onClick={() => bumpFood(today, f.key, 1)} aria-label={`${f.label}を今日1回追加`}>
                  ＋
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="実家ごはんのルール" help="rules" helpLabel="くわしく">
        <ul className="lines">
          {RULES.map((r) => (
            <li key={r.text}>
              <Strong {...r} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="内臓脂肪を減らす3つ" help="visceral" helpLabel="内臓脂肪について">
        <ol className="lines num">
          {VISCERAL3.map((v) => (
            <li key={v.t}>
              <b>{v.t}</b>
              <span className="muted sm">　{v.d}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="1日の例（大学の日）" help="day" helpLabel="補足">
        <ul className="lines">
          {EXAMPLE_DAY.map((m) => (
            <li key={m.when} className="meal">
              <span className="w">{m.when}</span>
              <span>{m.what}</span>
              <span className="k n">{m.kcal}</span>
            </li>
          ))}
        </ul>
        <div className="tot n">
          <span>合計</span>
          <span>
            約{comma(total.kcal)}kcal／P {total.p}g
          </span>
        </div>
        <p className="sm muted mt">ジムの日：行く1〜2時間前におにぎり1個かバナナ＋夕食のご飯180g</p>
      </Card>

      <div className="card row-card">
        <span>
          朝食をプロテインに？ <b className="warn-t">→ 非推奨</b>
        </span>
        <HelpButton k="breakfast" label="理由と代わりの案" />
      </div>

      <Card title="大学の昼ごはん" help="lunch" helpLabel="選び方">
        <ul className="lines">
          {LUNCH.map((l) => (
            <li key={l.t}>
              <span className={`mk ${l.ok ? 'o' : 'x'}`} aria-label={l.ok ? 'おすすめ' : '控えめに'}>
                {l.ok ? '◎' : '△'}
              </span>
              {l.t}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="間食は1日200kcalまで" help="snack" helpLabel="間食のコツ">
        <div className="chips">
          {SNACKS.map(([n, k]) => (
            <span key={n}>
              {n}
              <small className="n">{k}</small>
            </span>
          ))}
        </div>
        <p className="sm muted mt">お皿に出して座って食べる・16時ごろに1回</p>
      </Card>

      <Card title="週1回のごほうび食" help="reward" helpLabel="ルール">
        <p>
          好きなものを <b>1食だけ</b>、量を気にせず
        </p>
      </Card>
    </>
  );
}
