// グラフ（SVG を手書き）。線は 2px、グリッドは実線の細線、タップ・なぞりで値を表示する
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { PLAN_KG_PER_WEEK, avgSeries, fatMass, planLine } from '../lib/calc';
import { addDays, dayDiff, jDate, jMD, parse, ymd } from '../lib/date';
import { f1, kg, signed } from '../lib/format';
import type { AppData, Comp } from '../lib/schema';

const W = 360;

/** ポインタ・矢印キーで一番近い点を選ぶ */
function useScrub(count: number, xOf: (i: number) => number) {
  const [sel, setSel] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !count) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i;
    setSel(best);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!count) return;
    if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? count) - 1));
    else if (e.key === 'ArrowRight') setSel((s) => Math.min(count - 1, (s ?? -1) + 1));
    else if (e.key === 'Escape') setSel(null);
    else return;
    e.preventDefault();
  };
  return {
    sel,
    svgProps: {
      ref: svgRef,
      tabIndex: 0,
      onPointerDown: pick,
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse' || e.buttons) pick(e);
      },
      onPointerLeave: (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse') setSel(null);
      },
      onKeyDown,
      onBlur: () => setSel(null),
    },
  };
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  const pct = Math.min(80, Math.max(20, (x / W) * 100));
  return (
    <div className="tip" style={{ left: `${pct}%` }} role="status">
      {children}
    </div>
  );
}

const niceStep = (span: number) => (span > 12 ? 2 : span > 5 ? 1 : 0.5);

/* ---------- 体重 ---------- */

export function WeightChart({ d, today, range }: { d: AppData; today: string; range: 'all' | '4w' }) {
  const H = 214;
  const L = 34;
  const R = 14;
  const T = 12;
  const B = 24;
  const clip = useId();
  const series = useMemo(() => avgSeries(d.weights), [d.weights]);
  const plan = planLine(d);
  const goal = d.settings.goalWeight;

  let xs: string;
  let xe: string;
  if (range === 'all') {
    xs = [series[0]?.d ?? plan.from.d, plan.from.d].sort()[0];
    xe = [series[series.length - 1]?.d ?? today, plan.to.d, today].sort().reverse()[0];
  } else {
    xs = addDays(today, -27);
    xe = today;
  }
  const span = Math.max(7, dayDiff(xs, xe));
  const vis = series.filter((p) => p.d >= xs && p.d <= xe);
  const ys = vis.flatMap((p) => [p.w, p.a]);
  if (range === 'all') ys.push(plan.from.w, goal);
  if (!ys.length) ys.push(plan.from.w);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (range === '4w' && Math.abs(goal - yMin) < 1.5) yMin = Math.min(yMin, goal);
  const pad = Math.max(0.4, (yMax - yMin) * 0.08);
  const step = niceStep(yMax - yMin);
  yMin = Math.floor((yMin - pad) / step) * step;
  yMax = Math.ceil((yMax + pad) / step) * step;

  const X = (date: string) => L + ((W - L - R) * dayDiff(xs, date)) / span;
  const Y = (w: number) => T + ((H - T - B) * (yMax - w)) / (yMax - yMin);

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);

  const xTicks: { x: number; label: string }[] = [];
  if (range === 'all') {
    const s = parse(xs);
    for (let m = new Date(s.getFullYear(), s.getMonth() + 1, 1); ymd(m) <= xe; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      xTicks.push({ x: X(ymd(m)), label: `${m.getMonth() + 1}月` });
    }
  } else {
    for (let i = 0; i <= 3; i++) {
      const dd = addDays(xs, i * 7);
      xTicks.push({ x: X(dd), label: jMD(dd) });
    }
  }

  const { sel, svgProps } = useScrub(vis.length, (i) => X(vis[i].d));
  const last = vis[vis.length - 1];
  const selP = sel !== null ? vis[sel] : null;
  const planAt = (date: string) => Math.max(goal, plan.from.w - (dayDiff(plan.from.d, date) / 7) * PLAN_KG_PER_WEEK);

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`体重の推移。最新の7日平均 ${last ? f1(last.a) : '—'}kg、目標 ${kg(goal)}kg。左右キーで日ごとの値`}
        {...svgProps}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={L} y={T - 6} width={W - L - R + 6} height={H - T - B + 12} />
          </clipPath>
        </defs>
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
            <text className="axis" x={L - 6} y={Y(v) + 3.5} textAnchor="end">
              {step < 1 ? v.toFixed(1) : v}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.label} className="axis" x={t.x} y={H - 7} textAnchor="middle">
            {t.label}
          </text>
        ))}
        <g clipPath={`url(#${clip})`}>
          <line
            className="plan"
            x1={X(range === 'all' ? plan.from.d : xs)}
            y1={Y(range === 'all' ? plan.from.w : planAt(xs))}
            x2={X(range === 'all' ? plan.to.d : xe)}
            y2={Y(range === 'all' ? plan.to.w : planAt(xe))}
          />
          {goal >= yMin && goal <= yMax && (
            <>
              <line className="goal" x1={L} x2={W - R} y1={Y(goal)} y2={Y(goal)} />
              <text className="goal-t" x={L + 4} y={Y(goal) > H - B - 16 ? Y(goal) - 5 : Y(goal) + 13} textAnchor="start">
                目標 {kg(goal)}kg
              </text>
            </>
          )}
          {vis.map((p) => (
            <circle key={p.d} className="raw" cx={X(p.d)} cy={Y(p.w)} r={2.4} />
          ))}
          {vis.length >= 2 && <polyline className="avg" points={vis.map((p) => `${X(p.d)},${Y(p.a)}`).join(' ')} />}
          {last && (
            <>
              <circle className="end" cx={X(last.d)} cy={Y(last.a)} r={4.5} />
              {!selP && (
                <text className="end-t" x={X(last.d) + (X(last.d) > W - 70 ? -8 : 8)} y={Y(last.a) - 8} textAnchor={X(last.d) > W - 70 ? 'end' : 'start'}>
                  {f1(last.a)}
                </text>
              )}
            </>
          )}
          {selP && (
            <>
              <line className="cross" x1={X(selP.d)} x2={X(selP.d)} y1={T} y2={H - B} />
              <circle className="end" cx={X(selP.d)} cy={Y(selP.a)} r={4.5} />
            </>
          )}
        </g>
      </svg>
      {selP && (
        <Tooltip x={X(selP.d)}>
          <span className="tip-d">{jDate(selP.d)}</span>
          <span className="tip-r">
            <i className="key-line avg" />
            <b className="n">{f1(selP.a)}kg</b> 7日平均
          </span>
          <span className="tip-r">
            <i className="key-dot raw" />
            <b className="n">{f1(selP.w)}kg</b> その日
          </span>
        </Tooltip>
      )}
      <div className="legend">
        <span>
          <i className="key-line avg" />
          7日平均
        </span>
        <span>
          <i className="key-dot raw" />
          毎日の値
        </span>
        <span>
          <i className="key-line plan" />
          計画（週0.5kg）
        </span>
        <span>
          <i className="key-line goal" />
          目標
        </span>
      </div>
    </div>
  );
}

/* ---------- 体組成の推移（初回からの増減 kg） ---------- */

const COMP_SERIES = [
  { key: 'm', label: '筋肉量', cls: 'lean', val: (c: Comp) => c.m },
  { key: 'f', label: '脂肪量', cls: 'fat', val: (c: Comp) => fatMass(c) },
  { key: 'w', label: '体重', cls: 'weight', val: (c: Comp) => c.w },
] as const;

export function CompChart({ comps }: { comps: Comp[] }) {
  const H = 190;
  const L = 34;
  const R = 14;
  const T = 12;
  const B = 24;
  const first = comps[0];
  const lastC = comps[comps.length - 1];
  const span = Math.max(1, dayDiff(first.d, lastC.d));
  const deltas = comps.map((c) => COMP_SERIES.map((s) => s.val(c) - s.val(first)));
  const all = deltas.flat();
  let yMin = Math.min(0, ...all);
  let yMax = Math.max(0, ...all);
  const step = niceStep(yMax - yMin) >= 1 ? niceStep(yMax - yMin) : 0.5;
  yMin = Math.floor((yMin - 0.3) / step) * step;
  yMax = Math.ceil((yMax + 0.3) / step) * step;
  const X = (date: string) => L + 6 + ((W - L - R - 12) * dayDiff(first.d, date)) / span;
  const Y = (v: number) => T + ((H - T - B) * (yMax - v)) / (yMax - yMin);
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);
  const { sel, svgProps } = useScrub(comps.length, (i) => X(comps[i].d));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="体組成の推移（初回からの増減）。左右キーで測定ごとの値" {...svgProps}>
        {yTicks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'grid zero' : 'grid'} x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
            <text className="axis" x={L - 6} y={Y(v) + 3.5} textAnchor="end">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}
        <text className="axis" x={X(first.d)} y={H - 7} textAnchor="start">
          {jMD(first.d)}
        </text>
        <text className="axis" x={X(lastC.d)} y={H - 7} textAnchor="end">
          {jMD(lastC.d)}
        </text>
        {sel !== null && <line className="cross" x1={X(comps[sel].d)} x2={X(comps[sel].d)} y1={T} y2={H - B} />}
        {COMP_SERIES.map((s, si) => (
          <g key={s.key} className={`s-${s.cls}`}>
            <polyline className="sline" points={comps.map((c, i) => `${X(c.d)},${Y(deltas[i][si])}`).join(' ')} />
            {comps.map((c, i) => (
              <circle key={c.d} className="sdot" cx={X(c.d)} cy={Y(deltas[i][si])} r={4} />
            ))}
          </g>
        ))}
      </svg>
      {sel !== null && (
        <Tooltip x={X(comps[sel].d)}>
          <span className="tip-d">{jDate(comps[sel].d)}（初回から）</span>
          {COMP_SERIES.map((s, si) => (
            <span className="tip-r" key={s.key}>
              <i className={`key-line ${s.cls}`} />
              <b className="n">{signed(deltas[sel][si])}kg</b> {s.label}
            </span>
          ))}
        </Tooltip>
      )}
      <div className="legend">
        {COMP_SERIES.map((s) => (
          <span key={s.key}>
            <i className={`key-line ${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
