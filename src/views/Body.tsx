import { useRef, useState } from 'react';
import { CompChart, WeightChart } from '../components/charts';
import { IconCamera } from '../components/Icons';
import { deleteComp, deleteWeight, saveComp, saveWeight } from '../lib/actions';
import {
  MUSCLE_TOLERANCE,
  PACE,
  calcTargets,
  currentWeight,
  fatJudge,
  fatMass,
  fatToStandard,
  firstComp,
  forecast,
  latestComp,
  leanMass,
  milestones,
  muscleJudge,
  nextMilestone,
  visceralJudge,
  weeklyChange,
  weightEntries,
} from '../lib/calc';
import { dayDiff, jDate, jMD, parse } from '../lib/date';
import { f1, kg, r1, signed } from '../lib/format';
import { addPhoto, deletePhoto, sharePhoto, useObjectUrl, usePhotos, type PhotoRec } from '../lib/photos';
import type { AppData, Comp } from '../lib/schema';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { Card, ConfirmButton, PageHead, Seg, Sheet, Tag } from '../ui';

type Pane = 'w' | 'c' | 'p';

export function Body() {
  const [pane, setPane] = useState<Pane>('w');
  return (
    <>
      <PageHead title="からだ" help="body" helpLabel="数字の見方" />
      <Seg
        label="表示する記録"
        value={pane}
        onChange={(p) => {
          setPane(p);
          window.scrollTo(0, 0);
        }}
        options={[
          { v: 'w', title: '体重', sub: '毎日' },
          { v: 'c', title: '体組成', sub: '月1〜2回' },
          { v: 'p', title: '写真', sub: '月1回' },
        ]}
      />
      {pane === 'w' && <WeightPane />}
      {pane === 'c' && <CompPane />}
      {pane === 'p' && <PhotoPane />}
    </>
  );
}

/* ---------- 体重 ---------- */

const fmtDate = (s: string) => {
  const p = parse(s);
  return (
    <>
      {p.getMonth() + 1}月{p.getDate()}日<small>{p.getFullYear()}年</small>
    </>
  );
};

function WeightPane() {
  const d = useData();
  const today = useToday();
  const [range, setRange] = useState<'all' | '4w'>('all');
  const cur = currentWeight(d);
  const lost = firstComp(d).w - cur;
  const fc = forecast(d, today);
  const wk = weeklyChange(d.weights);

  let paceTag: { label: string; tone: 'good' | 'warn' | 'neutral' } | null = null;
  if (wk !== null) {
    const loss = -wk;
    if (loss >= PACE.tooFast) paceTag = { label: '速すぎ', tone: 'warn' };
    else if (loss >= PACE.min && loss <= PACE.max) paceTag = { label: '目安どおり', tone: 'good' };
    else if (loss > PACE.max) paceTag = { label: 'やや速い', tone: 'neutral' };
    else paceTag = { label: 'ゆっくり', tone: 'neutral' };
  }

  return (
    <>
      <Card title="体重の推移" help="log" helpLabel="グラフの見方">
        <dl className="stats">
          <div>
            <dt>今（7日平均）</dt>
            <dd className="n">
              {f1(cur)}
              <small>kg</small>
            </dd>
          </div>
          <div>
            <dt>スタートから</dt>
            <dd className="n">
              {signed(-lost)}
              <small>kg</small>
            </dd>
          </div>
          <div>
            <dt>{fc.kind === 'trend' || fc.kind === 'flat' ? '到達予想' : fc.kind === 'plan' ? '到達予定' : 'ゴール'}</dt>
            <dd className="n dv">
              {fc.kind === 'done' ? '達成' : fc.kind === 'flat' ? '様子見' : fmtDate(fc.date)}
            </dd>
          </div>
        </dl>
        {wk !== null && paceTag && (
          <p className="pace n">
            この1週間 <b>{signed(wk)}kg</b> <Tag tone={paceTag.tone}>{paceTag.label}</Tag>
            <span className="muted">目安 −{PACE.min}〜{PACE.max}kg/週</span>
          </p>
        )}
        <div className="filter" role="group" aria-label="グラフの期間">
          {(
            [
              ['all', '全期間'],
              ['4w', '直近4週'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={range === v} onClick={() => setRange(v)}>
              {l}
            </button>
          ))}
        </div>
        <WeightChart d={d} today={today} range={range} />
      </Card>

      <PastWeightForm today={today} />
      <WeightHistory d={d} />
    </>
  );
}

function PastWeightForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [w, setW] = useState('');
  const [msg, setMsg] = useState('');
  const save = () => {
    const v = parseFloat(w);
    if (!date || date > today) return setMsg('今日までの日付を選んでください。');
    if (!Number.isFinite(v) || v < 30 || v > 200) return setMsg('30〜200kgの数字を入力してください。');
    saveWeight(date, v);
    setW('');
    setMsg(`${jDate(date)}に ${f1(v)}kg を記録しました。`);
  };
  return (
    <Card title="日付を選んで記録">
      <div className="row">
        <input className="inp" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="日付" style={{ flex: 1.4 }} />
        <input
          className="inp n"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="kg"
          value={w}
          onChange={(e) => setW(e.target.value)}
          aria-label="体重"
          style={{ flex: 1 }}
        />
        <button type="button" className="btn" onClick={save}>
          記録
        </button>
      </div>
      <p className="hint">{msg}</p>
    </Card>
  );
}

function WeightHistory({ d }: { d: AppData }) {
  const [all, setAll] = useState(false);
  const rev = weightEntries(d.weights).reverse();
  const shown = all ? rev : rev.slice(0, 7);
  return (
    <Card title="履歴">
      {rev.length === 0 ? (
        <p className="muted">まだ記録がありません。</p>
      ) : (
        <ul className="hist">
          {shown.map((x) => (
            <li key={x.d}>
              <span className="hd">{jDate(x.d)}</span>
              <span className="hv n">{f1(x.w)} kg</span>
              <ConfirmButton onConfirm={() => deleteWeight(x.d)} />
            </li>
          ))}
        </ul>
      )}
      {rev.length > 7 && (
        <button type="button" className="link" onClick={() => setAll(!all)}>
          {all ? '最近7件だけ表示' : `すべて表示（${rev.length}件）`}
        </button>
      )}
    </Card>
  );
}

/* ---------- 体組成 ---------- */

function CompPane() {
  const d = useData();
  const c = latestComp(d);
  const f0 = firstComp(d);
  const lbm = leanMass(c);
  const cur = currentWeight(d);
  const list = milestones(lbm, d.settings.goalWeight);
  const next = nextMilestone(list, cur);
  const nextIdx = next ? list.indexOf(next) : list.length;
  const prevW = nextIdx > 0 ? list[nextIdx - 1].w : f0.w;
  const fkg = fatMass(c);
  const fj = fatJudge(c.fp);
  const vj = visceralJudge(c.v);
  const mj = muscleJudge(d.comp);
  const toStd = fatToStandard(c);
  const only1 = d.comp.length < 2;
  const g = d.settings.goalWeight;
  const t = calcTargets(c);

  /** 体重・体脂肪率は減れば緑。筋肉量は誤差（−0.5kg）までは色を付けず、それより減ったら赤 */
  const delta = (x: number, muscle = false) => {
    if (only1) return null;
    let cls = x < -0.05 ? 'dn' : x > 0.05 ? 'up' : 'muted';
    if (muscle) cls = x > 0.05 ? 'dn' : x >= -MUSCLE_TOLERANCE ? 'muted' : 'up';
    return <span className={`dlt ${cls}`}>{signed(x)}</span>;
  };

  return (
    <>
      <Card title="次の目標" help="milestone" helpLabel="段階の考え方">
        {next ? (
          <>
            <p className="ms n">
              <b>{f1(next.w)}kg</b>
              <span className="muted sm">まで あと {f1(cur - next.w)}kg</span>
            </p>
            <p className="sm muted">
              {next.goal ? `ゴール（体脂肪率 ${f1(next.pct)}%）` : next.label}　{next.note}
            </p>
            <div className="ms-track" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(1, (prevW - cur) / (prevW - next.w))) * 100}%` }} />
            </div>
            <div className="ms-lab n">
              <span>{f1(prevW)}kg</span>
              <span>{f1(next.w)}kg</span>
            </div>
          </>
        ) : (
          <p className="ms">
            <b>目標を達成しています</b>
          </p>
        )}
        <ol className="ladder" aria-label="段階目標の一覧">
          {list.map((m, i) => (
            <li key={m.w} className={i < nextIdx ? 'done' : i === nextIdx ? 'now' : ''}>
              <span className="n">{f1(m.w)}</span>
              <small className="n">{f1(m.pct)}%</small>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="いまの内訳" side={`${jMD(c.d)} 測定`}>
        <div className="big3">
          <div>
            <b className="n">
              {f1(c.w)}
              <small>kg</small>
            </b>
            <span>体重</span>
            {delta(c.w - f0.w)}
          </div>
          <div>
            <b className="n">
              {f1(c.fp)}
              <small>%</small>
            </b>
            <span>体脂肪率</span>
            {delta(c.fp - f0.fp)}
          </div>
          <div>
            <b className="n">
              {f1(c.m)}
              <small>kg</small>
            </b>
            <span>筋肉量</span>
            {delta(c.m - f0.m, true)}
          </div>
        </div>
        <div className="stack" aria-hidden="true">
          <div className="f" style={{ width: `${c.fp}%` }} />
          <div className="l" />
        </div>
        <div className="stack-k n">
          <span>
            <i className="sw fat" />
            脂肪 {f1(fkg)}kg
          </span>
          <span>
            <i className="sw lean" />
            脂肪以外 {f1(lbm)}kg
          </span>
        </div>
        <div className="judge">
          <b>体脂肪率</b>
          <Tag tone={fj.tone}>{fj.label}</Tag>
          <span className="muted n">{toStd > 0.1 ? `標準まで脂肪あと ${f1(toStd)}kg` : '標準範囲です'}</span>
        </div>
        <div className="judge">
          <b>内臓脂肪</b>
          <Tag tone={vj.tone}>{vj.label}</Tag>
          <span className="muted n">レベル {kg(c.v)}（標準は10未満）</span>
        </div>
        <div className="judge">
          <b>筋肉量</b>
          <Tag tone={mj.tone}>{mj.label}</Tag>
          <span className="muted n">
            {mj.delta === null ? 'この体格では多いほう。守るのが仕事' : mj.tone === 'good' ? `初回から ${signed(mj.delta)}kg・守れています` : `初回から ${signed(mj.delta)}kg・食事を減らしすぎかも`}
          </span>
        </div>
      </Card>

      {!only1 && (
        <Card title="初回からの増減" help="comptrend" helpLabel="グラフの見方">
          <CompChart comps={d.comp} />
        </Card>
      )}

      <Card title="ゴールの数字" help="goalpic" helpLabel="この計算について">
        <dl className="kv2 n">
          <div>
            <dt>目標体重</dt>
            <dd>{kg(g)}kg</dd>
          </div>
          <div>
            <dt>そのときの体脂肪率</dt>
            <dd>{f1((1 - lbm / g) * 100)}%</dd>
          </div>
          <div>
            <dt>脂肪</dt>
            <dd>
              {f1(fkg)} → {f1(g - lbm)}kg
            </dd>
          </div>
          <div>
            <dt>脂肪以外</dt>
            <dd>{f1(lbm)}kg のまま</dd>
          </div>
        </dl>
      </Card>

      <CompForm lastV={c.v} />

      {!only1 && (
        <Card title="測定の履歴">
          <ul className="comp-list">
            {[...d.comp].reverse().map((x) => (
              <CompRow key={x.d} x={x} canDelete={d.comp.length > 1} />
            ))}
          </ul>
          <p className="muted sm">いまの目安カロリーは {jMD(c.d)} の測定（基礎代謝 {t.bmr}kcal{t.bmrMeasured ? '' : '・推定'}）から計算しています。</p>
        </Card>
      )}
    </>
  );
}

function CompRow({ x, canDelete }: { x: Comp; canDelete: boolean }) {
  return (
    <li>
      <span className="cd">{jMD(x.d)}</span>
      <span className="cv n">
        {f1(x.w)}kg・{f1(x.fp)}%
        <small>
          筋肉 {f1(x.m)}・内臓 {kg(x.v)}
          {x.bmr ? `・代謝 ${x.bmr}` : ''}
        </small>
      </span>
      {canDelete && <ConfirmButton onConfirm={() => deleteComp(x.d)} />}
    </li>
  );
}

function CompForm({ lastV }: { lastV: number }) {
  const today = useToday();
  const [f, setF] = useState({ d: today, w: '', fp: '', m: '', v: '', bmr: '' });
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const w = parseFloat(f.w);
    const fp = parseFloat(f.fp);
    const m = parseFloat(f.m);
    const v = parseFloat(f.v);
    const bmr = parseFloat(f.bmr);
    if (!f.d || f.d > today) return setMsg('今日までの日付を選んでください。');
    if (!(w >= 30 && w <= 200) || !(fp >= 3 && fp <= 70) || !(m >= 10 && m <= 150)) {
      return setMsg('体重・体脂肪率・筋肉量は必ず入力してください。');
    }
    saveComp({
      d: f.d,
      w: r1(w),
      fp: r1(fp),
      m: r1(m),
      v: v >= 1 && v <= 60 ? v : lastV,
      ...(bmr >= 800 && bmr <= 4000 ? { bmr: Math.round(bmr) } : {}),
    });
    setF({ d: f.d, w: '', fp: '', m: '', v: '', bmr: '' });
    setMsg(`${jDate(f.d)}の測定を記録しました。目安の数字も更新しています。`);
  };
  return (
    <Card title="測定を記録" help="measure" helpLabel="測定のコツ">
      <div className="fg">
        <label className="full">
          測定日
          <input className="inp" type="date" value={f.d} max={today} onChange={set('d')} />
        </label>
        <label>
          体重（kg）
          <input className="inp n" type="number" inputMode="decimal" step="0.1" value={f.w} onChange={set('w')} />
        </label>
        <label>
          体脂肪率（%）
          <input className="inp n" type="number" inputMode="decimal" step="0.1" value={f.fp} onChange={set('fp')} />
        </label>
        <label>
          筋肉量（kg）
          <input className="inp n" type="number" inputMode="decimal" step="0.1" value={f.m} onChange={set('m')} />
        </label>
        <label>
          内臓脂肪レベル
          <input className="inp n" type="number" inputMode="decimal" step="0.5" value={f.v} placeholder={kg(lastV)} onChange={set('v')} />
        </label>
        <label className="full">
          基礎代謝（kcal・レシートにあれば）
          <input className="inp n" type="number" inputMode="numeric" step="1" value={f.bmr} onChange={set('bmr')} />
        </label>
      </div>
      <button type="button" className="btn wide" onClick={save}>
        この測定を記録
      </button>
      <p className="hint">{msg}</p>
    </Card>
  );
}

/* ---------- 写真 ---------- */

function PhotoPane() {
  const today = useToday();
  const { photos, error, reload } = usePhotos();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<PhotoRec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = photos?.[photos.length - 1];
  const sinceLast = last ? dayDiff(last.d, today) : null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await addPhoto(file, today);
      reload();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <Card title="体型の写真" help="photos" helpLabel="写真の記録">
        <p className="ms n">
          <b>{photos === null ? '…' : photos.length}</b>
          <span className="muted sm">枚{last ? `・前回 ${jMD(last.d)}（${sinceLast}日前）` : ''}</span>
        </p>
        {sinceLast !== null && sinceLast >= 28 && <p className="hint">そろそろ今月の1枚を。</p>}
        {error && <p className="hint err">写真を読み込めませんでした。</p>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button type="button" className="btn wide icon-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          <IconCamera />
          {busy ? '保存中…' : '写真を追加'}
        </button>
        <p className="muted sm mt">写真はこの端末の中だけに保存されます（バックアップには含まれません）。</p>
      </Card>

      {photos && photos.length >= 2 && (
        <Card title="最初と最新">
          <div className="compare">
            <Thumb p={photos[0]} onOpen={setOpen} />
            <Thumb p={photos[photos.length - 1]} onOpen={setOpen} />
          </div>
        </Card>
      )}

      {photos && photos.length > 0 && (
        <Card title="すべての写真">
          <div className="grid3">
            {[...photos].reverse().map((p) => (
              <Thumb key={p.id} p={p} onOpen={setOpen} />
            ))}
          </div>
        </Card>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? jDate(open.d) : ''}>
        {open && (
          <PhotoView
            p={open}
            onDeleted={() => {
              setOpen(null);
              reload();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function Thumb({ p, onOpen }: { p: PhotoRec; onOpen: (p: PhotoRec) => void }) {
  const url = useObjectUrl(p.blob);
  return (
    <button type="button" className="thumb" onClick={() => onOpen(p)} aria-label={`${jDate(p.d)}の写真を開く`}>
      {url && <img src={url} alt="" />}
      <span className="n">{jMD(p.d)}</span>
    </button>
  );
}

function PhotoView({ p, onDeleted }: { p: PhotoRec; onDeleted: () => void }) {
  const url = useObjectUrl(p.blob);
  const d = useData();
  const w = d.weights[p.d];
  return (
    <>
      {url && <img className="photo-full" src={url} alt={`${jDate(p.d)}の体型写真`} />}
      {w !== undefined && <p className="muted n">この日の体重 {f1(w)}kg</p>}
      <div className="dfoot">
        <ConfirmButton
          className="btn danger sm"
          onConfirm={() => {
            void deletePhoto(p.id).then(onDeleted);
          }}
        />
        <button type="button" className="btn sm" onClick={() => void sharePhoto(p)}>
          保存・共有
        </button>
      </div>
    </>
  );
}
