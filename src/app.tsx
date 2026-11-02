import { useEffect, useState } from 'preact/hooks';
import { dismissToast, setTab, syncNow, useStore, type Tab } from './model/store';
import { timeLabel } from './lib/months';
import { BrandMark, Icon, type IconName } from './ui/icons';
import { ProtoBanner } from './ui/components';
import { SheetHost, openEntry } from './ui/sheets';
import { Home } from './ui/screens/Home';
import { Entries } from './ui/screens/Entries';
import { Mortgage } from './ui/screens/Mortgage';
import { More } from './ui/screens/More';

const viewerTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;

function useTheme() {
  const theme = useStore((s) => s.prefs.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      if (viewerTheme) root.setAttribute('data-theme', viewerTheme);
      else root.removeAttribute('data-theme');
    } else root.setAttribute('data-theme', theme);
  }, [theme]);
}

function SyncPill() {
  const pending = useStore((s) => s.pending);
  const lastSync = useStore((s) => s.lastSync);
  const [busy, setBusy] = useState(false);
  const state = busy ? 'syncing' : pending ? 'pending' : 'ok';
  const label = busy ? 'Wysyłam…' : pending ? `${pending} do wysłania` : 'Aktualne';
  return (
    <button
      class="sync-pill"
      type="button"
      data-state={state}
      title={lastSync ? `Ostatnio: ${timeLabel(lastSync)}` : 'Synchronizuj'}
      aria-label={`Synchronizacja: ${label}. Dotknij, aby wysłać teraz.`}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        await syncNow();
        setBusy(false);
      }}
    >
      <span class="sync-dot" />
      {label}
    </button>
  );
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'wpisy', label: 'Wpisy', icon: 'list' },
  { id: 'kredyt', label: 'Kredyt', icon: 'loan' },
  { id: 'wiecej', label: 'Więcej', icon: 'more' },
];

export function App() {
  useTheme();
  const tab = useStore((s) => s.tab);
  const toast = useStore((s) => s.toast);

  return (
    <>
      <div class="app">
        <header class="topbar">
          <div class="brand">
            <BrandMark class="brand-mark" />
            <span class="brand-name">Money Home</span>
          </div>
          <SyncPill />
        </header>
        <main style={{ display: 'grid', gap: '14px', paddingTop: '10px' }}>
          {tab === 'start' && <ProtoBanner>Prototyp do akceptacji. Wszystko działa, ale zmiany zostają w tej przeglądarce.</ProtoBanner>}
          {tab === 'start' && <Home />}
          {tab === 'wpisy' && <Entries />}
          {tab === 'kredyt' && <Mortgage />}
          {tab === 'wiecej' && <More />}
        </main>
      </div>

      <nav class="tabbar" aria-label="Nawigacja">
        <div class="tabbar-inner">
          {TABS.slice(0, 2).map((t) => (
            <button key={t.id} class="tab" type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={23} />
              {t.label}
            </button>
          ))}
          <button class="tab-add" type="button" aria-label="Dodaj wpis" onClick={() => openEntry()}>
            <Icon name="plus" size={26} />
          </button>
          {TABS.slice(2).map((t) => (
            <button key={t.id} class="tab" type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={23} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div class="toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                const u = toast.undo!;
                dismissToast();
                u();
              }}
            >
              Cofnij
            </button>
          ) : null}
        </div>
      )}
      <SheetHost />
    </>
  );
}
