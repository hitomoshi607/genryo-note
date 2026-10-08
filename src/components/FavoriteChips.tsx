import { useEffect, useState } from 'react';
import { deleteFavorite, deleteMeal, recordFavorite } from '../lib/actions';
import { comma } from '../lib/format';
import { SLOT_LABEL, sumItems } from '../lib/meals';
import type { Favorite, Meal } from '../lib/schema';
import { ConfirmButton } from '../ui';

/** よく食べる食事を1タップで記録するボタン（直後は取り消せる） */
export function FavoriteChips({ date, favorites, manageable }: { date: string; favorites: Favorite[]; manageable?: boolean }) {
  const [last, setLast] = useState<{ meal: Meal; name: string } | null>(null);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    if (!last) return;
    const id = setTimeout(() => setLast(null), 8000);
    return () => clearTimeout(id);
  }, [last]);

  if (!favorites.length) return null;
  return (
    <div className="fav-quick">
      <div className="chips">
        {favorites.map((f) =>
          manage ? (
            <ConfirmButton key={f.id} className="chip del-chip" label={`${f.name} ✕`} armedLabel="もう一度で削除" onConfirm={() => deleteFavorite(f.id)} />
          ) : (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-label={`${f.name}（${sumItems(f.items).kcal}kcal）を記録`}
              onClick={() => setLast({ meal: recordFavorite(date, f), name: f.name })}
            >
              {f.name}
              <small className="n">{comma(sumItems(f.items).kcal)}</small>
            </button>
          ),
        )}
      </div>
      {last && (
        <p className="undo" role="status">
          <span>
            「{last.name}」を{SLOT_LABEL[last.meal.slot]}に記録しました
          </span>
          <button
            type="button"
            className="link inline"
            onClick={() => {
              deleteMeal(date, last.meal.id);
              setLast(null);
            }}
          >
            取り消す
          </button>
        </p>
      )}
      {manageable && (
        <button type="button" className="link small" onClick={() => setManage(!manage)}>
          {manage ? '整理を終える' : 'よく食べる食事を整理'}
        </button>
      )}
    </div>
  );
}
