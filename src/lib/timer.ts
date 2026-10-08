// レストタイマー・ストレス食いタイマー。終了時刻で持つので、画面を離れて戻っても正しい残り時間になる
import { useEffect, useState, useSyncExternalStore } from 'react';

export interface Countdown {
  endsAt: number;
  total: number;
  label: string;
}

function createTimer() {
  let cur: Countdown | null = null;
  const ls = new Set<() => void>();
  const emit = () => ls.forEach((l) => l());
  return {
    get: () => cur,
    start(sec: number, label: string) {
      cur = { endsAt: Date.now() + sec * 1000, total: sec, label };
      emit();
    },
    add(sec: number) {
      if (!cur) return;
      const left = Math.max(0, cur.endsAt - Date.now());
      cur = { ...cur, endsAt: Date.now() + left + sec * 1000, total: cur.total + sec };
      emit();
    },
    stop() {
      cur = null;
      emit();
    },
    subscribe(l: () => void) {
      ls.add(l);
      return () => {
        ls.delete(l);
      };
    },
  };
}

export const restTimer = createTimer();
export const sosTimer = createTimer();

export const useTimer = (t: ReturnType<typeof createTimer>) => useSyncExternalStore(t.subscribe, t.get);

/** 残り秒数。動いている間だけ 250ms ごとに更新 */
export function useSecondsLeft(c: Countdown | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!c) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [c]);
  return c ? Math.max(0, Math.ceil((c.endsAt - now) / 1000)) : 0;
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/* ---------- 音 ---------- */

let ctx: AudioContext | null = null;

/** iOS はタップ中にしか音を鳴らす準備ができないので、開始ボタンで呼ぶ */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(times = 3) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.3);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.3 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + i * 0.3);
    o.stop(t0 + i * 0.3 + 0.22);
  }
  navigator.vibrate?.([200, 100, 200]);
}

/* ---------- 画面を消さない ---------- */

let lock: WakeLockSentinel | null = null;

export async function keepAwake(on: boolean) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {
        lock = null;
      });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
