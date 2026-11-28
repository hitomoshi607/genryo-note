// 体組成（TANITA）のカードと入力シート
import { useState } from 'react';
import { deleteComp, saveComp } from '../lib/actions';
import { atGoal, compDiff, fatKg, LEAN_TOLERANCE, leanKg, musclePct, sortedComps } from '../lib/comp';
import { jDate, jMD } from '../lib/date';
import { comma, f1, kg, signed } from '../lib/format';
import type { Comp } from '../lib/schema';
import { useData } from '../lib/store';
import { useToday } from '../lib/useToday';
import { Card, ConfirmButton, Sheet } from '../ui';

/** 前回との差。good = 減ると良い（脂肪）／ keep = 減りすぎに注意（筋肉・除脂肪量） */
function Delta({ v, unit, kind }: { v: number | undefined; unit: string; kind: 'good' | 'keep' }) {
  if (v === undefined) return null;
  const tone = kind === 'good' ? (v < 0 ? 'ok-t' : v > 0 ? 'warn-t' : 'muted') : v < -LEAN_TOLERANCE ? 'warn-t' : 'muted';
  return (
    <small className={`dlt n ${tone}`}>
      {signed(v)}
      {unit}
    </small>
  );
}

export function CompCard() {
  const d = useData();
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState(false);
  const cd = compDiff(d.comp);
  const list = sortedComps(d.comp).reverse();

  return (
    <Card title="体組成" side={cd ? jMD(cd.now.d) : undefined} help="comp" helpLabel="体組成の見方とアドバイス">
      {cd && (
        <>
          <div className="comp4 n">
            <div>
              <b>
                {f1(cd.now.fat)}
                <small>%</small>
              </b>
              <span>体脂肪率</span>
              <Delta v={cd.d?.fat} unit="" kind="good" />
            </div>
            <div>
              <b>
                {f1(fatKg(cd.now))}
                <small>kg</small>
              </b>
              <span>脂肪量</span>
              <Delta v={cd.d?.fatKg} unit="" kind="good" />
            </div>
            <div>
              <b>
                {f1(leanKg(cd.now))}
                <small>kg</small>
              </b>
              <span>除脂肪量</span>
              <Delta v={cd.d?.lean} unit="" kind="keep" />
            </div>
            <div>
              <b>
                {f1(cd.now.muscle)}
                <small>kg</small>
              </b>
              <span>筋肉量</span>
              <Delta v={cd.d?.muscle} unit="" kind="keep" />
            </div>
          </div>
          <p className="sub n">
            {[
              cd.now.visceral !== undefined && `内臓脂肪 ${kg(cd.now.visceral)}`,
              cd.now.bmr !== undefined && `基礎代謝 ${comma(cd.now.bmr)}`,
              cd.now.water !== undefined && `水分 ${f1(cd.now.water)}%`,
              cd.now.bone !== undefined && `骨量 ${f1(cd.now.bone)}`,
            ]
              .filter(Boolean)
              .join('・')}
          </p>
          <p className="sub n">
            {kg(d.settings.goalWeight)}kg で除脂肪量を保つと体脂肪率 <b>{f1(atGoal(cd.now, d.settings).fatPct)}%</b>（脂肪 −{f1(atGoal(cd.now, d.settings).fatToLose)}kg）
          </p>
        </>
      )}
      <div className="ex-act">
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
          体組成を記録
        </button>
        {list.length > 0 && (
          <button type="button" className="link" aria-expanded={hist} onClick={() => setHist(!hist)}>
            {hist ? '履歴を閉じる' : `履歴 ${list.length}`}
          </button>
        )}
      </div>
      {hist && (
        <ul className="hist">
          {list.map((c) => (
            <li key={c.d}>
              <span className="hd">{jDate(c.d)}</span>
              <span className="hv n">
                {f1(c.fat)}%<small> {f1(c.w)}kg・除脂肪 {f1(leanKg(c))}</small>
              </span>
              <ConfirmButton onConfirm={() => deleteComp(c.d)} />
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="体組成を記録">
        <CompForm onDone={() => setOpen(false)} />
      </Sheet>
    </Card>
  );
}

const FIELDS: { k: keyof Comp; label: string; unit: string; step: string; need?: boolean }[] = [
  { k: 'w', label: '体重', unit: 'kg', step: '0.1', need: true },
  { k: 'fat', label: '体脂肪率', unit: '%', step: '0.1', need: true },
  { k: 'muscle', label: '筋肉量', unit: 'kg', step: '0.1', need: true },
  { k: 'visceral', label: '内臓脂肪レベル', unit: '', step: '0.5' },
  { k: 'bmr', label: '基礎代謝', unit: 'kcal', step: '1' },
  { k: 'water', label: '体水分率', unit: '%', step: '0.1' },
  { k: 'bone', label: '推定骨量', unit: 'kg', step: '0.1' },
];

function CompForm({ onDone }: { onDone: () => void }) {
  const d = useData();
  const today = useToday();
  const last = sortedComps(d.comp).pop();
  const [date, setDate] = useState(today);
  const [f, setF] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const n = (k: keyof Comp) => (f[k]?.trim() ? Number(f[k]) : undefined);
  const w = n('w');
  const fat = n('fat');
  const muscle = n('muscle');
  const ready = w !== undefined && fat !== undefined && muscle !== undefined && w > 0 && fat > 0;
  const preview: Comp | null = ready ? { w, fat, muscle } : null;

  const save = () => {
    if (!preview) return setErr('体重・体脂肪率・筋肉量を入れてください。');
    if (!(w! >= 30 && w! <= 250) || !(fat! >= 1 && fat! <= 75) || !(muscle! >= 10 && muscle! < w!)) return setErr('数値を確認してください。');
    const c: Comp = { w: w!, fat: fat!, muscle: muscle! };
    for (const k of ['visceral', 'bmr', 'water', 'bone'] as const) {
      const v = n(k);
      if (v !== undefined && Number.isFinite(v) && v > 0) c[k] = v;
    }
    saveComp(date, c);
    onDone();
  };

  return (
    <div className="settings">
      <label className="field">
        <span>測った日</span>
        <input className="n" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {FIELDS.map((x) => (
        <label key={x.k} className="field">
          <span>
            {x.label}
            {x.need && <small className="muted">（必須）</small>}
          </span>
          <span className="field-in">
            <input
              className="n"
              type="number"
              inputMode="decimal"
              step={x.step}
              placeholder={last?.[x.k] !== undefined ? String(last[x.k]) : ''}
              value={f[x.k] ?? ''}
              onChange={(e) => {
                setF({ ...f, [x.k]: e.target.value });
                setErr('');
              }}
            />
            <small>{x.unit}</small>
          </span>
        </label>
      ))}
      {preview && (
        <p className="sub n">
          脂肪量 {f1(fatKg(preview))}kg・除脂肪量 {f1(leanKg(preview))}kg・筋肉率 {f1(musclePct(preview))}%
        </p>
      )}
      {err && <p className="hint err">{err}</p>}
      <button type="button" className="btn wide" disabled={!ready} onClick={save}>
        保存
      </button>
    </div>
  );
}
