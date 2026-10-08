// よく食べる食事を、食事として記録せずに追加・編集・削除する
import { useState } from 'react';
import { addFavorite, deleteFavorite } from '../lib/actions';
import { AiError, chatPrompt, parsePastedMeal } from '../lib/ai';
import { calcTargets, latestComp } from '../lib/calc';
import { comma } from '../lib/format';
import { SLOT_LABEL, sumItems } from '../lib/meals';
import { MEAL_SLOTS, type Favorite, type MealSlot } from '../lib/schema';
import { useData } from '../lib/store';
import { ConfirmButton, HelpButton, Sheet } from '../ui';
import { CopyButton, ItemRows, PasteButton, toItems, toRow, type Row } from './ItemRows';

export interface FavoriteTarget {
  fav?: Favorite;
}

export function FavoriteSheet({ target, onClose }: { target: FavoriteTarget | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.fav ? 'よく食べる食事を編集' : 'よく食べる食事を追加'}>
      {target && <FavoriteForm key={target.fav?.id ?? 'new'} fav={target.fav} onDone={onClose} />}
    </Sheet>
  );
}

function FavoriteForm({ fav, onDone }: { fav?: Favorite; onDone: () => void }) {
  const d = useData();
  const [name, setName] = useState(fav?.name ?? '');
  const [slot, setSlot] = useState<MealSlot | 'any'>(fav?.slot ?? 'any');
  const [rows, setRows] = useState<Row[]>(fav ? fav.items.map(toRow) : []);
  const [err, setErr] = useState('');
  const items = toItems(rows);
  const total = sumItems(items);
  const t = calcTargets(latestComp(d));

  const applyPaste = (text: string) => {
    try {
      const p = parsePastedMeal(text);
      setRows(p.est.items.map(toRow));
      if (p.slot && slot === 'any') setSlot(p.slot);
      if (!name.trim()) setName((p.note ?? p.est.items.map((i) => i.name).slice(0, 2).join('と')).slice(0, 40));
      setErr('');
      return true;
    } catch (e) {
      setErr(e instanceof AiError ? e.message : '貼り付けた文字を読み取れませんでした。');
      return false;
    }
  };

  const save = () => {
    if (!name.trim()) return setErr('名前を入れてください（例：母のカレー）。');
    if (!items.length) return setErr('品目を1つ以上入れてください。');
    addFavorite({
      id: fav?.id ?? `f${Date.now().toString(36)}`,
      name: name.trim().slice(0, 40),
      ...(slot !== 'any' ? { slot } : {}),
      items,
    });
    onDone();
  };

  return (
    <div className="meal-form">
      <p className="muted sm">登録しても、今日の食事としては記録されません。</p>
      <label className="fl-inline">
        名前
        <input className="inp" type="text" value={name} placeholder="例：母のカレー" onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="fl">区分（今日タブに出す時間帯）</p>
      <div className="slots five" role="radiogroup" aria-label="区分">
        <button type="button" role="radio" aria-checked={slot === 'any'} onClick={() => setSlot('any')}>
          指定なし
        </button>
        {MEAL_SLOTS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={slot === s} onClick={() => setSlot(s)}>
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="chat-row">
        <CopyButton
          className="btn ghost"
          text={() => chatPrompt({ ...(slot !== 'any' ? { slot } : {}), note: name, gymDay: false, target: { kcal: t.kcal, p: t.p } })}
        >
          ① Claude 用にコピー
        </CopyButton>
        <PasteButton className="btn ghost" onText={applyPaste}>
          ② 結果を貼り付け
        </PasteButton>
        <HelpButton k="meal-free" label="Claude のチャットで推定するには" />
      </div>

      <ItemRows rows={rows} onChange={setRows} />

      {items.length > 0 && (
        <div className="meal-total n">
          <span>
            合計 <b>{comma(total.kcal)}kcal</b>・P {total.p}g・F {total.f}g・C {total.c}g
          </span>
        </div>
      )}
      {err && (
        <p className="hint err" role="alert">
          {err}
        </p>
      )}

      <div className="dfoot">
        {fav ? (
          <ConfirmButton
            className="btn danger sm"
            onConfirm={() => {
              deleteFavorite(fav.id);
              onDone();
            }}
          />
        ) : (
          <span />
        )}
        <button type="button" className="btn" disabled={!items.length} onClick={save}>
          保存
        </button>
      </div>
    </div>
  );
}
