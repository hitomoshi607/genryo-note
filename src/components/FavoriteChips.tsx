import { useEffect, useState } from 'react';
import { deleteMeal, recordFavorite } from '../lib/actions';
import { comma } from '../lib/format';
import { SLOT_LABEL, sumItems } from '../lib/meals';
import type { Favorite, Meal } from '../lib/schema';
import { useUI } from '../ui';

/**
 * よく食べる食事を1タップで記録するボタン（直後は取り消せる）。
 * manageable のときは「＋ 追加」と「編集」も出し、編集中はタップで編集画面を開く
 */
export function FavoriteChips({ date, favorites, manageable }: { date: string; favorites: Favorite[]; manageable?: boolean }) {
  const { openFavorite } = useUI();
  const [last, setLast] = useState<{ meal: Meal; name: string } | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!last) return;
    const id = setTimeout(() => setLast(null), 8000);
    return () => clearTimeout(id);
  }, [last]);

  if (!favorites.length && !manageable) return null;
  return (
    <div className="fav-quick">
      {favorites.length > 0 ? (
        <div className="chips">
          {favorites.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip${editing ? ' edit-chip' : ''}`}
              aria-label={editing ? `${f.name}を編集` : `${f.name}（${sumItems(f.items).kcal}kcal）を記録`}
              onClick={() => (editing ? openFavorite({ fav: f }) : setLast({ meal: recordFavorite(date, f), name: f.name }))}
            >
              {editing && '✎ '}
              {f.name}
              <small className="n">{comma(sumItems(f.items).kcal)}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="sm muted">まだ登録がありません。「＋ 追加」から登録できます。</p>
      )}
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
        <div className="fav-tools">
          <button type="button" className="link small" onClick={() => openFavorite({})}>
            ＋ 追加
          </button>
          {favorites.length > 0 && (
            <button type="button" className="link small" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              {editing ? '編集を終える' : '編集・削除'}
            </button>
          )}
        </div>
      )}
      {editing && <p className="sm muted">直したいものを押すと、編集画面が開きます。</p>}
    </div>
  );
}
