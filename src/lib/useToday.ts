import { createContext, useContext, useEffect, useState } from 'react';
import { todayStr } from './date';

/**
 * 今日の日付。ホーム画面アプリは前日の画面のまま復帰することがあるので、
 * 画面に戻ったときと30秒ごとに確認する
 */
export function useTodayClock() {
  const [t, setT] = useState(todayStr);
  useEffect(() => {
    const upd = () => setT(todayStr());
    const id = setInterval(upd, 30000);
    document.addEventListener('visibilitychange', upd);
    window.addEventListener('focus', upd);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', upd);
      window.removeEventListener('focus', upd);
    };
  }, []);
  return t;
}

export const TodayContext = createContext(todayStr());
export const useToday = () => useContext(TodayContext);
