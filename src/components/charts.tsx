// グラフ（SVG を手書き）。線は 2px、グリッドは細い実線、タップ・なぞりで値を表示する
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SLEEP_TARGET_H } from '../data/plan';
import { addDays, addMonths, dayDiff, jDate, jMD, parse, ymd } from '../lib/date';
import { f1, kg } from '../lib/format';
import type { AppData } from '../lib/schema';
import { durationMin, hm } from '../lib/sleep';
import { avgSeries, goalDate, planAt, sortedWeights } from '../lib/weight';

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
    sel: sel !== null && sel < count ? sel : null,
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
  const pct = Math.min(78, Math.max(22, (x / W) * 100));
  return (
    <div className="tip" style={{ left: `${pct}%` }} role="status">
      {children}
    </div>
  );
}

const niceStep = (span: number) => (span >= 8 ? 2 : span > 4 ? 1 : 0.5);

/* ---------- 体重 ---------- */

export function WeightChart({ d, today, range }: { d: AppData; today: string; range: 'all' | '4w' }) {
  const H = 220;
  const L = 34;
  const R = 12;
  const T = 12;
  const B = 24;
  const clip = useId();
  const s = d.settings;
  const raw = useMemo(() => sortedWeights(d.weights), [d.weights]);
  const avg = useMemo(() => avgSeries(d.weights), [d.weights]);
  const end = goalDate(s);

  const xs = range === 'all' ? [raw[0]?.d ?? s.startDate, s.startDate].sort()[0] : addDays(today, -27);
  const xe = range === 'all' ? [end, today, raw[raw.length - 1]?.d ?? today].sort().reverse()[0] : today;
  const span = Math.max(7, dayDiff(xs, xe));
  const vis = raw.filter((p) => p.d >= xs && p.d <= xe);
  const visAvg = avg.filter((p) => p.d >= xs && p.d <= xe);

  // 計画線は毎月の区切りで折れる
  const planPts = [xs];
  for (let n = 1; addMonths(s.startDate, n) < xe; n++) if (addMonths(s.startDate, n) > xs) planPts.push(addMonths(s.startDate, n));
  if (s.startDate > xs && s.startDate < xe) planPts.push(s.startDate);
  planPts.push(xe);
  planPts.sort();
  const plan = planPts.map((p) => ({ d: p, w: planAt(s, p) }));

  const ys = [...vis.map((p) => p.w), ...visAvg.map((p) => p.w), ...plan.map((p) => p.w)];
  if (range === 'all') ys.push(s.goalWeight);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const pad = Math.max(0.4, (yMax - yMin) * 0.08);
  const step = niceStep(yMax - yMin);
  yMin = Math.floor((yMin - pad) / step) * step;
  yMax = Math.ceil((yMax + pad) / step) * step;

  const X = (date: string) => L + ((W - L - R) * dayDiff(xs, date)) / span;
  const Y = (w: number) => T + ((H - T - B) * (yMax - w)) / (yMax - yMin);

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);

  const xTicks: { x: number; label: string; end?: boolean }[] = [];
  if (range === 'all') {
    const st = parse(xs);
    for (let m = new Date(st.getFullYear(), st.getMonth() + 1, 1); ymd(m) <= xe; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      xTicks.push({ x: X(ymd(m)), label: `${m.getMonth() + 1}月` });
    }
  } else {
    for (let i = 0; i <= 3; i++) {
      const dd = addDays(xs, i * 9);
      xTicks.push({ x: X(dd), label: jMD(dd), end: i === 3 });
    }
  }

  const { sel, svgProps } = useScrub(visAvg.length, (i) => X(visAvg[i].d));
  const last = visAvg[visAvg.length - 1];
  const selP = sel !== null ? visAvg[sel] : null;
  const goalIn = s.goalWeight >= yMin && s.goalWeight <= yMax;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`体重の推移。最新の7日平均 ${last ? f1(last.w) : '—'}kg、目標 ${kg(s.goalWeight)}kg。左右キーで日ごとの値`} {...svgProps}>
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
          <text key={t.label} className="axis" x={t.x} y={H - 7} textAnchor={t.end ? 'end' : 'middle'}>
            {t.label}
          </text>
        ))}
        <g clipPath={`url(#${clip})`}>
          <polyline className="plan" points={plan.map((p) => `${X(p.d)},${Y(p.w)}`).join(' ')} />
          {goalIn && (
            <>
              <line className="goal" x1={L} x2={W - R} y1={Y(s.goalWeight)} y2={Y(s.goalWeight)} />
              <text className="goal-t" x={L + 4} y={Y(s.goalWeight) - 5} textAnchor="start">
                目標 {kg(s.goalWeight)}
              </text>
            </>
          )}
          {vis.map((p) => (
            <circle key={p.d} className="raw" cx={X(p.d)} cy={Y(p.w)} r={2.4} />
          ))}
          {visAvg.length >= 2 && <polyline className="avg" points={visAvg.map((p) => `${X(p.d)},${Y(p.w)}`).join(' ')} />}
          {last && <circle className="end" cx={X(last.d)} cy={Y(last.w)} r={4.5} />}
          {selP && (
            <>
              <line className="cross" x1={X(selP.d)} x2={X(selP.d)} y1={T} y2={H - B} />
              <circle className="end" cx={X(selP.d)} cy={Y(selP.w)} r={4.5} />
            </>
          )}
        </g>
      </svg>
      {selP && (
        <Tooltip x={X(selP.d)}>
          <span className="tip-d">{jDate(selP.d)}</span>
          <span className="tip-r">
            <i className="key-line avg" />
            <b className="n">{f1(selP.w)}</b> 7日平均
          </span>
          <span className="tip-r">
            <i className="key-dot raw" />
            <b className="n">{f1(d.weights[selP.d])}</b> その日
          </span>
          <span className="tip-r">
            <i className="key-line plan" />
            <b className="n">{f1(planAt(s, selP.d))}</b> 計画
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
          その日
        </span>
        <span>
          <i className="key-line plan" />
          計画（毎月 −{kg(s.perMonth)}kg）
        </span>
      </div>
    </div>
  );
}

/* ---------- 睡眠 ---------- */

export function SleepChart({ d, today, days = 14 }: { d: AppData; today: string; days?: number }) {
  const H = 170;
  const L = 28;
  const R = 8;
  const T = 10;
  const B = 22;
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  const mins = dates.map((dt) => (d.sleep[dt] ? durationMin(d.sleep[dt]) : null));
  const maxH = Math.max(9, Math.ceil(Math.max(0, ...mins.map((m) => (m ?? 0) / 60))));
  const bw = (W - L - R) / days;
  const X = (i: number) => L + bw * i + bw / 2;
  const Y = (h: number) => T + ((H - T - B) * (maxH - h)) / maxH;
  const { sel, svgProps } = useScrub(days, X);
  const ticks = [0, 3, 6, 9].filter((h) => h <= maxH);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`直近${days}日の睡眠時間。左右キーで日ごとの値`} {...svgProps}>
        {ticks.map((h) => (
          <g key={h}>
            <line className="grid" x1={L} x2={W - R} y1={Y(h)} y2={Y(h)} />
            <text className="axis" x={L - 6} y={Y(h) + 3.5} textAnchor="end">
              {h}h
            </text>
          </g>
        ))}
        {mins.map((m, i) =>
          m === null ? null : (
            <rect
              key={dates[i]}
              className={`sbar${m < SLEEP_TARGET_H * 60 ? ' short' : ''}${sel === i ? ' on' : ''}`}
              x={X(i) - bw * 0.32}
              y={Y(m / 60)}
              width={bw * 0.64}
              height={Math.max(1, Y(0) - Y(m / 60))}
              rx={3}
            />
          ),
        )}
        <line className="target" x1={L} x2={W - R} y1={Y(SLEEP_TARGET_H)} y2={Y(SLEEP_TARGET_H)} />
        {dates.map((dt, i) =>
          i % 2 === (days - 1) % 2 ? (
            <text key={dt} className="axis" x={X(i)} y={H - 6} textAnchor="middle">
              {jMD(dt)}
            </text>
          ) : null,
        )}
      </svg>
      {sel !== null && (
        <Tooltip x={X(sel)}>
          <span className="tip-d">{jDate(dates[sel])}</span>
          {d.sleep[dates[sel]] ? (
            <span className="tip-r">
              <b className="n">{hm(mins[sel]!)}</b>
              <span className="n">
                {d.sleep[dates[sel]].bed}〜{d.sleep[dates[sel]].wake}
              </span>
            </span>
          ) : (
            <span className="tip-r">記録なし</span>
          )}
        </Tooltip>
      )}
      <div className="legend">
        <span>
          <i className="key-box" />
          睡眠時間
        </span>
        <span>
          <i className="key-line target" />
          目安 {SLEEP_TARGET_H}時間
        </span>
      </div>
    </div>
  );
}
