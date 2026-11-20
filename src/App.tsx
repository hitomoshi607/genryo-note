import { useEffect, useMemo, useState, type JSX } from 'react';
import { IconGear, IconGym, IconSleep, IconToday, IconWeight } from './components/Icons';
import { RestTimerBar } from './components/RestTimer';
import { HelpSheet, SettingsSheet, UpdatePrompt } from './components/Sheets';
import { f1 } from './lib/format';
import { requestPersist, useData } from './lib/store';
import { TodayContext, useTodayClock } from './lib/useToday';
import { weightStatus } from './lib/weight';
import { UIContext, type Tab, type UI } from './ui';
import { Gym } from './views/Gym';
import { Sleep } from './views/Sleep';
import { Today } from './views/Today';
import { Weight } from './views/Weight';

const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'today', label: '今日', icon: IconToday },
  { id: 'weight', label: '体重', icon: IconWeight },
  { id: 'sleep', label: '睡眠', icon: IconSleep },
  { id: 'gym', label: 'ジム', icon: IconGym },
];

export function App() {
  const d = useData();
  const today = useTodayClock();
  const [tab, setTab] = useState<Tab>('today');
  const [help, setHelp] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const st = weightStatus(d, today);

  useEffect(() => {
    void requestPersist();
  }, []);

  const ui = useMemo<UI>(
    () => ({
      openHelp: setHelp,
      openSettings: () => setSettings(true),
      go: (t) => {
        setTab(t);
        window.scrollTo(0, 0);
      },
    }),
    [],
  );

  return (
    <TodayContext.Provider value={today}>
      <UIContext.Provider value={ui}>
        <header className="top">
          <div className="top-in">
            <span className="nm">減量ノート</span>
            <span className="kg n" aria-label="いまの体重（7日平均）">
              {st ? `${f1(st.now)}kg` : ''}
            </span>
            <button type="button" className="ico" onClick={() => setSettings(true)} aria-label="設定">
              <IconGear />
            </button>
          </div>
        </header>

        <main key={today}>
          {tab === 'today' && <Today />}
          {tab === 'weight' && <Weight />}
          {tab === 'sleep' && <Sleep />}
          {tab === 'gym' && <Gym />}
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
        <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      </UIContext.Provider>
    </TodayContext.Provider>
  );
}
