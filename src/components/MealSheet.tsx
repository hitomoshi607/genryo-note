import { useEffect, useRef, useState } from 'react';
import { addFavorite, bumpFood, deleteMeal, saveMeal } from '../lib/actions';
import { AiError, YEN_PER_USD, chatPrompt, estimateMeal, loadAi, parsePastedMeal, type MealEstimate } from '../lib/ai';
import { calcTargets, dayTypeOf, latestComp } from '../lib/calc';
import { jDate } from '../lib/date';
import { comma } from '../lib/format';
import { SLOT_LABEL, dayTotals, defaultSlot, newMealId, nowHHMM, sumItems } from '../lib/meals';
import { deleteMealPhoto, downscale, saveMealPhoto, useMealPhoto, useObjectUrl } from '../lib/photos';
import { MEAL_SLOTS, isGym, type Meal, type MealItem, type MealSlot } from '../lib/schema';
import { useData } from '../lib/store';
import { ConfirmButton, HelpButton, Sheet, useUI } from '../ui';
import { IconCamera } from './Icons';
import { CopyButton, ItemRows, PasteButton, toItems, toRow, type Row } from './ItemRows';

export interface MealTarget {
  date: string;
  meal?: Meal;
}

export function MealSheet({ target, onClose }: { target: MealTarget | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.meal ? '食事を編集' : '食事を記録'}>
      {target && <MealForm key={target.meal?.id ?? target.date} target={target} onDone={onClose} />}
    </Sheet>
  );
}


const CONF_LABEL = { high: '高い', medium: 'ふつう', low: '低い' } as const;

/** 登録名の初期値: 「夕・ご飯と鶏の唐揚げ」 */
const defaultFavName = (slot: MealSlot, items: MealItem[]) =>
  `${SLOT_LABEL[slot]}・${items
    .slice(0, 2)
    .map((i) => i.name)
    .join('と')}`.slice(0, 40);

function MealForm({ target, onDone }: { target: MealTarget; onDone: () => void }) {
  const d = useData();
  const { openSettings, openHelp } = useUI();
  const editing = target.meal;
  const ai = loadAi();
  const [slot, setSlot] = useState<MealSlot>(editing?.slot ?? defaultSlot());
  const [file, setFile] = useState<Blob | null>(null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [rows, setRows] = useState<Row[]>(editing ? editing.items.map(toRow) : []);
  const [est, setEst] = useState<(MealEstimate & { usd: number; model: string }) | null>(null);
  const [flags, setFlags] = useState({ fried: false, heavy: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fav, setFav] = useState(false);
  const [favName, setFavName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // 推定中に閉じられたら結果を捨てる（付け直されたときは戻す）
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const preview = useObjectUrl(file ?? undefined);
  const savedPhoto = useMealPhoto(editing?.photo);
  const t = calcTargets(latestComp(d));
  const gymDay = isGym(dayTypeOf(d, target.date));
  const items = toItems(rows);
  const total = sumItems(items);
  const before = dayTotals(d, target.date, editing?.id);
  const riceLimit = gymDay && slot === 'dinner' ? 180 : 150;

  const run = async () => {
    if (!ai) return;
    setBusy(true);
    setErr('');
    try {
      const image = file ? await downscale(file, 1024, 0.85) : undefined;
      const r = await estimateMeal({ image, note, slot, gymDay, eaten: before, target: { kcal: t.kcal, p: t.p } }, ai);
      if (!alive.current) return;
      setEst(r);
      setRows(r.items.map(toRow));
      setFlags({ fried: r.fried, heavy: r.heavyLunch && slot === 'lunch' });
    } catch (e) {
      if (alive.current) setErr(e instanceof AiError ? e.message : '推定に失敗しました。');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  /** Claude のチャットの返事（または推定ページでコピーした結果）を読み込む */
  const applyPaste = (text: string) => {
    try {
      const p = parsePastedMeal(text);
      const s = p.slot ?? slot;
      setSlot(s);
      if (p.note && !note.trim()) setNote(p.note);
      setEst({ ...p.est, usd: 0, model: 'claude.ai' });
      setRows(p.est.items.map(toRow));
      setFlags({ fried: p.est.fried, heavy: p.est.heavyLunch && s === 'lunch' });
      setErr('');
      return true;
    } catch (e) {
      setErr(e instanceof AiError ? e.message : '貼り付けた文字を読み取れませんでした。');
      return false;
    }
  };

  const save = async () => {
    if (!items.length) return setErr('品目を1つ以上入れてください。');
    setBusy(true);
    try {
      let photo = editing?.photo;
      if (file) {
        try {
          photo = await saveMealPhoto(file);
        } catch {
          photo = undefined; // 写真が保存できなくても記録は残す
        }
      }
      const meal: Meal = {
        id: editing?.id ?? newMealId(),
        t: editing?.t ?? nowHHMM(),
        slot,
        items,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(photo ? { photo } : {}),
        ...(est ? { ai: { model: est.model, confidence: est.confidence, usd: est.usd } } : editing?.ai ? { ai: editing.ai } : {}),
      };
      saveMeal(target.date, meal);
      if (fav) {
        addFavorite({ id: `f${Date.now().toString(36)}`, name: favName.trim() || defaultFavName(slot, items), slot, items });
      }
      if (!editing) {
        if (flags.fried) bumpFood(target.date, 'fried', 1);
        if (flags.heavy) bumpFood(target.date, 'heavy', 1);
      }
      onDone();
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const photoUrl = preview ?? savedPhoto;

  return (
    <div className="meal-form">
      <p className="muted sm">{jDate(target.date)}</p>
      <div className="slots" role="radiogroup" aria-label="食事の区分">
        {MEAL_SLOTS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={slot === s} onClick={() => setSlot(s)}>
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      {photoUrl && <img className="meal-photo" src={photoUrl} alt="食事の写真" />}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFile(f);
            setErr('');
          }
          e.target.value = '';
        }}
      />
      <button type="button" className="btn ghost wide icon-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
        <IconCamera />
        {photoUrl ? '写真を撮り直す・選び直す' : '写真を撮る・選ぶ'}
      </button>
      <input
        className="inp mt"
        type="text"
        placeholder="メモ（例：ご飯は150g、学食の生姜焼き定食）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="メモ"
      />

      {ai && (
        <div className="ai-row">
          <button type="button" className="btn wide" disabled={busy || (!file && !note.trim())} onClick={() => void run()}>
            {busy ? 'AIが推定中…（10秒ほど）' : rows.length ? 'AIでもう一度推定' : 'AIでカロリーを推定'}
          </button>
          <HelpButton k="meal-ai" label="写真からの推定について" />
        </div>
      )}
      <div className="chat-row">
        <CopyButton
          className={`btn${ai ? ' ghost' : ''}`}
          disabled={busy}
          text={() => chatPrompt({ slot, note, gymDay, eaten: before, target: { kcal: t.kcal, p: t.p } })}
        >
          ① Claude 用にコピー
        </CopyButton>
        <PasteButton className="btn ghost" disabled={busy} onText={applyPaste}>
          ② 結果を貼り付け
        </PasteButton>
        <HelpButton k="meal-free" label="Claude のチャットで無料で推定するには" />
      </div>
      {d.favorites.length > 0 && (
        <div className="fav-add">
          <span className="sm muted">よく食べるものから追加</span>
          <div className="chips">
            {d.favorites.map((f) => (
              <button key={f.id} type="button" className="chip" onClick={() => setRows([...rows, ...f.items.map(toRow)])}>
                {f.name}
                <small className="n">{comma(sumItems(f.items).kcal)}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      {!ai && !editing && (
        <p className="sm muted">
          API キーを登録すると、この画面で直接推定することもできます（有料）。
          <button
            type="button"
            className="link inline"
            onClick={() => {
              onDone();
              openSettings();
            }}
          >
            設定
          </button>
          ・
          <button type="button" className="link inline" onClick={() => openHelp('ai-setup')}>
            キーの取り方
          </button>
        </p>
      )}
      {err && (
        <p className="hint err" role="alert">
          {err}
        </p>
      )}

      {est && (
        <div className="est">
          <p className="sm">
            <b>{est.advice}</b>
          </p>
          <p className="sm muted">
            確からしさ：{CONF_LABEL[est.confidence]}
            {est.notes ? `・${est.notes}` : ''}
          </p>
          {est.riceG > riceLimit && (
            <p className="sm warn-t">
              ご飯 約{est.riceG}g（目安{riceLimit}g）
            </p>
          )}
          {est.sugaryDrink && <p className="sm warn-t">甘い飲み物が含まれています</p>}
          <p className="sm muted n">
            {est.model === 'claude.ai' ? 'claude.ai で推定（API 料金なし）' : `推定費用 約${(est.usd * YEN_PER_USD).toFixed(1)}円`}
          </p>
        </div>
      )}

      <ItemRows rows={rows} onChange={setRows} />

      {items.length > 0 && (
        <div className="meal-total n">
          <span>
            この食事 <b>{comma(total.kcal)}kcal</b>・P {total.p}g
          </span>
          <span className="muted sm">
            今日の合計 {comma(before.kcal + total.kcal)} / {comma(t.kcal)}kcal・P {before.p + total.p} / {t.p}g
          </span>
        </div>
      )}

      {!editing && est && (est.fried || (est.heavyLunch && slot === 'lunch')) && (
        <div className="flags">
          {est.fried && (
            <label>
              <input type="checkbox" checked={flags.fried} onChange={(e) => setFlags({ ...flags, fried: e.target.checked })} />
              揚げ物の回数に＋1
            </label>
          )}
          {est.heavyLunch && slot === 'lunch' && (
            <label>
              <input type="checkbox" checked={flags.heavy} onChange={(e) => setFlags({ ...flags, heavy: e.target.checked })} />
              △の昼ごはんに＋1
            </label>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="fav-reg">
          <label>
            <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} />
            よく食べる食事に登録（次から1タップで記録）
          </label>
          {fav && (
            <input
              className="inp"
              type="text"
              value={favName}
              placeholder={defaultFavName(slot, items)}
              onChange={(e) => setFavName(e.target.value)}
              aria-label="登録する名前"
            />
          )}
        </div>
      )}

      <div className="dfoot">
        {editing ? (
          <ConfirmButton
            className="btn danger sm"
            onConfirm={() => {
              deleteMeal(target.date, editing.id);
              if (editing.photo) void deleteMealPhoto(editing.photo);
              onDone();
            }}
          />
        ) : (
          <span />
        )}
        <button type="button" className="btn" disabled={busy || !items.length} onClick={() => void save()}>
          保存
        </button>
      </div>
    </div>
  );
}
