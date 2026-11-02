import { useEffect, useRef } from 'preact/hooks';
import { dismissToast, finishWelcome, getState, setTab, useStore, type Tab } from './model/store';
import { liveEntries } from './model/calc';
import { timeLabel } from './lib/months';
import { BrandMark, Icon, type IconName } from './ui/icons';
import { ProtoBanner } from './ui/components';
import { SheetHost, closeSheet, importFromFile, isSheetOpen, openConnect, openEntry, openJoin, openWhoAmI } from './ui/sheets';
import { Home } from './ui/screens/Home';
import { Entries } from './ui/screens/Entries';
import { Mortgage } from './ui/screens/Mortgage';
import { More } from './ui/screens/More';
import { startSync, syncNow } from './sync/engine';
import { initNativeBack, needsIOSInstall, registerServiceWorker, setSystemBars } from './platform';
import { APP_URL } from './config';

const viewerTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;

function useTheme() {
  const theme = useStore((s) => s.prefs.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      if (viewerTheme) root.setAttribute('data-theme', viewerTheme);
      else root.removeAttribute('data-theme');
    } else root.setAttribute('data-theme', theme);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!mq?.matches);
      void setSystemBars(dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        if (theme !== 'system') m.setAttribute('content', dark ? '#171614' : '#edebe5');
      });
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
}

function SyncPill() {
  const pending = useStore((s) => s.pending);
  const sync = useStore((s) => s.sync);
  const connected = !!sync.config || __PROTOTYPE__;
  const syncing = sync.status === 'syncing';
  let state = 'ok';
  let label = 'Aktualne';
  if (!connected) {
    state = 'off';
    label = 'Tylko ten telefon';
  } else if (syncing) {
    state = 'syncing';
    label = 'Wysyłam…';
  } else if (sync.status === 'offline') {
    state = 'offline';
    label = pending ? `Offline · ${pending}` : 'Offline';
  } else if (sync.status === 'error') {
    state = 'error';
    label = 'Błąd synchr.';
  } else if (pending) {
    state = 'pending';
    label = `${pending} do wysłania`;
  }
  return (
    <button
      class="sync-pill"
      type="button"
      data-state={state}
      title={sync.lastSync ? `Ostatnio: ${timeLabel(sync.lastSync)}` : 'Synchronizuj'}
      aria-label={`Synchronizacja: ${label}.`}
      onClick={() => {
        if (!connected || sync.status === 'error') setTab('wiecej');
        else void syncNow();
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

/** First launch on a new phone: connect, join or load a file. */
function Welcome() {
  const file = useRef<HTMLInputElement>(null);
  const ios = needsIOSInstall();
  return (
    <div class="welcome">
      <div class="welcome-head">
        <BrandMark class="brand-mark" />
        <h1>Money Home</h1>
        <p class="soft">Wspólny budżet dla Was dwojga.</p>
      </div>
      {ios && (
        <div class="install-card" role="note">
          <strong>Najpierw dodaj aplikację do ekranu początkowego</strong>
          <ol>
            <li>
              W Safari dotknij <ShareIcon /> <strong>Udostępnij</strong>.
            </li>
            <li>
              Wybierz <strong>Do ekranu początkowego</strong> → Dodaj.
            </li>
            <li>Otwórz Money Home z nowej ikony i dopiero tam dołącz do domu.</li>
          </ol>
          <span class="hint">Aplikacja z ikony ma własną pamięć, oddzielną od Safari.</span>
        </div>
      )}
      <div class="card tight">
        <button class="choice" type="button" onClick={openJoin}>
          <span class="glyph">
            <Icon name="scan" size={20} />
          </span>
          <span>
            <strong>Dołączam do domu</strong>
            <span class="sub">Zeskanuj kod z telefonu partnera</span>
          </span>
          <Icon name="right" size={18} class="muted" />
        </button>
        <button class="choice" type="button" onClick={openConnect}>
          <span class="glyph">
            <Icon name="github" size={20} />
          </span>
          <span>
            <strong>Zaczynam jako pierwszy telefon</strong>
            <span class="sub">Połącz z prywatnym repozytorium (token GitHub)</span>
          </span>
          <Icon name="right" size={18} class="muted" />
        </button>
        <button class="choice" type="button" onClick={() => file.current?.click()}>
          <span class="glyph">
            <Icon name="upload" size={20} />
          </span>
          <span>
            <strong>Wczytaj dane z pliku</strong>
            <span class="sub">Plik budżetu .json</span>
          </span>
          <Icon name="right" size={18} class="muted" />
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) void importFromFile(f);
          (e.target as HTMLInputElement).value = '';
        }}
      />
      <button class="link-btn" type="button" style={{ justifySelf: 'center' }} onClick={finishWelcome}>
        Na razie bez łączenia
      </button>
      {!ios && <p class="hint" style={{ textAlign: 'center' }}>iPhone: {APP_URL.replace('https://', '')}</p>}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg class="share-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 15V3.5M8 7.5l4-4 4 4" />
      <path d="M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
    </svg>
  );
}

export function App() {
  useTheme();
  const tab = useStore((s) => s.tab);
  const toast = useStore((s) => s.toast);
  const h = useStore((s) => s.household);
  const me = useStore((s) => s.prefs.me);
  const welcomeDone = useStore((s) => s.prefs.welcomeDone);
  const config = useStore((s) => s.sync.config);
  const pending = useStore((s) => s.pending);
  const showWelcome = !__PROTOTYPE__ && !config && !welcomeDone && liveEntries(h).length === 0;

  useEffect(() => {
    startSync();
    registerServiceWorker();
    void initNativeBack(() => {
      if (isSheetOpen()) {
        closeSheet();
        return true;
      }
      if (getState().tab !== 'start') {
        setTab('start');
        return true;
      }
      return false;
    });
  }, []);

  // after joining: ask who this phone belongs to
  useEffect(() => {
    if (config && liveEntries(h).length > 0 && !h.people.some((p) => p.id === me) && !isSheetOpen()) openWhoAmI();
  }, [config, h.people, me]);

  // warn before closing a browser tab with unsent changes (web only)
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (getState().pending > 0 && getState().sync.config) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [pending]);

  if (showWelcome) {
    return (
      <>
        <div class="app">
          <Welcome />
        </div>
        <SheetHost />
        {toast && (
          <div class="toast" role="status" key={toast.id}>
            <span>{toast.text}</span>
          </div>
        )}
      </>
    );
  }

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

