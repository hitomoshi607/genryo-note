import { useEffect, useMemo, useState, type JSX } from 'react';
import { IconBody, IconFood, IconGear, IconGym, IconHabit, IconToday } from './components/Icons';
import { FavoriteSheet, type FavoriteTarget } from './components/FavoriteSheet';
import { MealSheet, type MealTarget } from './components/MealSheet';
import { RestTimerBar } from './components/RestTimer';
import { HelpSheet, SettingsSheet, SosSheet, UpdatePrompt } from './components/Sheets';
import { currentWeight, nextGymDay } from './lib/calc';
import { f1 } from './lib/format';
import type { GymDay } from './lib/schema';
import { requestPersist, useData } from './lib/store';
import { TodayContext, useTodayClock } from './lib/useToday';
import { UIContext, type Tab, type UI } from './ui';
import { Body } from './views/Body';
import { Food } from './views/Food';
import { Gym } from './views/Gym';
import { Habit } from './views/Habit';
import { Today } from './views/Today';

const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'today', label: '今日', icon: IconToday },
  { id: 'body', label: 'からだ', icon: IconBody },
  { id: 'gym', label: '筋トレ', icon: IconGym },
  { id: 'food', label: '食事', icon: IconFood },
  { id: 'habit', label: '習慣', icon: IconHabit },
];

export function App() {
  const d = useData();
  const today = useTodayClock();
  const [tab, setTab] = useState<Tab>('today');
  const [gymDay, setGymDay] = useState<GymDay | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [sos, setSos] = useState(false);
  const [settings, setSettings] = useState(false);
  const [meal, setMeal] = useState<MealTarget | null>(null);
  const [favorite, setFavorite] = useState<FavoriteTarget | null>(null);

  useEffect(() => {
    const t = d.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }, [d.settings.theme]);

  useEffect(() => {
    void requestPersist();
  }, []);

  const ui = useMemo<UI>(
    () => ({
      openHelp: setHelp,
      openSos: () => setSos(true),
      openSettings: () => setSettings(true),
      openMeal: setMeal,
      openFavorite: setFavorite,
      go: (t, opts) => {
        if (opts?.gymDay) setGymDay(opts.gymDay);
        setTab(t);
        window.scrollTo(0, 0);
      },
    }),
    [],
  );

  const day = gymDay ?? nextGymDay(d, today);

  return (
    <TodayContext.Provider value={today}>
      <UIContext.Provider value={ui}>
        <header className="top">
          <div className="top-in">
            <span className="nm">減量ノート</span>
            <span className="kg n" aria-label="いまの体重（7日平均）">
              {f1(currentWeight(d))}kg
            </span>
            <button type="button" className="ico" onClick={() => setSettings(true)} aria-label="設定">
              <IconGear />
            </button>
          </div>
        </header>

        <main key={today}>
          {tab === 'today' && <Today />}
          {tab === 'body' && <Body />}
          {tab === 'gym' && <Gym day={day} onDay={setGymDay} />}
          {tab === 'food' && <Food />}
          {tab === 'habit' && <Habit />}
        </main>

        <div className="dock">
          <UpdatePrompt />
          <RestTimerBar />
          <nav className="tabs" aria-label="メニュー">
            <div className="tabs-in" role="tablist">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => ui.go(id)}>
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        <HelpSheet k={help} onClose={() => setHelp(null)} />
        <SosSheet open={sos} onClose={() => setSos(false)} />
        <SettingsSheet open={settings} onClose={() => setSettings(false)} />
        <MealSheet target={meal} onClose={() => setMeal(null)} />
        <FavoriteSheet target={favorite} onClose={() => setFavorite(null)} />
      </UIContext.Provider>
    </TodayContext.Provider>
  );
}
