import { useEffect, useRef } from 'react';
import { beep, keepAwake, mmss, restTimer, useSecondsLeft, useTimer } from '../lib/timer';
import { HelpButton } from '../ui';

/** タブバーの上に出るレストタイマー */
export function RestTimerBar() {
  const t = useTimer(restTimer);
  const left = useSecondsLeft(t);
  const rang = useRef<number | null>(null);
  const finished = !!t && left === 0;

  useEffect(() => {
    if (!t || !finished || rang.current === t.endsAt) return;
    rang.current = t.endsAt;
    beep();
    const id = setTimeout(() => {
      restTimer.stop();
    }, 20000);
    return () => clearTimeout(id);
  }, [t, finished]);

  useEffect(() => {
    if (!t) void keepAwake(false);
  }, [t]);

  if (!t) return null;
  const pct = finished ? 100 : Math.min(100, ((t.total - left) / t.total) * 100);
  return (
    <div className={`restbar${finished ? ' done' : ''}`} role="timer" aria-live={finished ? 'assertive' : 'off'}>
      <div className="restbar-in">
        <div className="rb-main">
          <span className="rb-l">{finished ? '休憩終了・次のセットへ' : `休憩中　${t.label}`}</span>
          <b className="n">{finished ? '0:00' : mmss(left)}</b>
        </div>
        {!finished && (
          <button type="button" className="btn ghost sm" onClick={() => restTimer.add(30)}>
            ＋30秒
          </button>
        )}
        <button type="button" className="btn sm" onClick={() => restTimer.stop()}>
          {finished ? '閉じる' : '終了'}
        </button>
        <HelpButton k="rest" label="タイマーについて" />
      </div>
      <div className="rb-track" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
