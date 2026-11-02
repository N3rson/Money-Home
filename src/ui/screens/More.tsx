import { useRef, useState } from 'preact/hooks';
import { forgetThisPhone, resetToSeed, setTheme, useStore, type Theme } from '../../model/store';
import { liveEntries } from '../../model/calc';
import { timeLabel, plural } from '../../lib/months';
import { syncNow } from '../../sync/engine';
import { isNative, openExternal } from '../../platform';
import { Hanko, Segmented } from '../components';
import { Icon } from '../icons';
import { importFromFile, openCategories, openConnect, openInvite, openJoin, openPeople } from '../sheets';

export function More() {
  const h = useStore((s) => s.household);
  const prefs = useStore((s) => s.prefs);
  const [confirmReset, setConfirmReset] = useState(false);
  const me = h.people.find((p) => p.id === prefs.me);
  const count = liveEntries(h).length;

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Więcej</h1>
      </div>

      <SharedData />

      <section class="section" aria-label="Dom">
        <div class="section-head">
          <h2 class="section-title">Dom</h2>
        </div>
        <div class="card tight">
          <button class="settings-row" type="button" onClick={openPeople}>
            <span style={{ display: 'flex' }}>
              {h.people.map((p, i) => (
                <span key={p.id} style={{ marginLeft: i ? '-6px' : 0 }}>
                  <Hanko person={p} />
                </span>
              ))}
            </span>
            <span class="main">
              <strong>{h.people.map((p) => p.name).join(' i ')}</strong>
              <span>Ten telefon: {me?.name ?? 'nie wybrano'}</span>
            </span>
            <Icon name="right" size={18} class="muted" />
          </button>
          <button class="settings-row" type="button" onClick={openCategories}>
            <span class="glyph">
              <Icon name="receipt" size={17} />
            </span>
            <span class="main">
              <strong>Opłaty stałe</strong>
              <span>
                {h.billCategories
                  .filter((c) => !c.archived)
                  .map((c) => c.name)
                  .join(', ')}
              </span>
            </span>
            <Icon name="right" size={18} class="muted" />
          </button>
        </div>
      </section>

      <section class="section" aria-label="Wygląd">
        <div class="section-head">
          <h2 class="section-title">Wygląd</h2>
        </div>
        <Segmented
          label="Motyw"
          value={prefs.theme}
          onChange={(t: Theme) => setTheme(t)}
          options={[
            { value: 'system', label: <><Icon name="auto" size={16} /> Auto</> },
            { value: 'light', label: <><Icon name="sun" size={16} /> Jasny</> },
            { value: 'dark', label: <><Icon name="moon" size={16} /> Ciemny</> },
          ]}
        />
      </section>

      {__PROTOTYPE__ && (
        <section class="section" aria-label="Prototyp">
          <div class="card tight">
            <div class="settings-row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}>
              <span class="glyph">
                <Icon name="refresh" size={17} />
              </span>
              {!confirmReset ? (
                <button type="button" class="main" style={{ textAlign: 'left' }} onClick={() => setConfirmReset(true)}>
                  <strong>Przywróć dane z arkusza</strong>
                  <span>Cofa Twoje zmiany w prototypie ({count} wpisów teraz)</span>
                </button>
              ) : (
                <div class="btn-row">
                  <button class="btn secondary sm" type="button" onClick={() => setConfirmReset(false)}>
                    Anuluj
                  </button>
                  <button
                    class="btn danger solid sm"
                    type="button"
                    onClick={() => {
                      resetToSeed();
                      setConfirmReset(false);
                    }}
                  >
                    Przywróć
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <p class="hint" style={{ textAlign: 'center', paddingTop: '6px' }}>
        Money Home {__PROTOTYPE__ ? 'prototyp' : `${__APP_VERSION__}${isNative() ? ' · Android' : ''}`} · {__BUILD_DATE__}
      </p>
    </div>
  );
}

function SharedData() {
  const h = useStore((s) => s.household);
  const sync = useStore((s) => s.sync);
  const pending = useStore((s) => s.pending);
  const [busy, setBusy] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const me = useStore((s) => s.prefs.me);
  const cfg = sync.config;
  const connected = !!cfg || __PROTOTYPE__;
  const partner = h.people.find((p) => p.id !== me)?.name;

  const status = (() => {
    if (__PROTOTYPE__) return pending ? `${pending} ${plural(pending, 'zmiana czeka', 'zmiany czekają', 'zmian czeka')} na wysłanie` : 'Wszystko aktualne';
    if (!cfg) return 'Dane są tylko na tym telefonie';
    if (sync.status === 'syncing') return 'Synchronizuję…';
    if (sync.status === 'offline') return `Offline${pending ? ` · ${pending} ${plural(pending, 'zmiana czeka', 'zmiany czekają', 'zmian czeka')}` : ''}`;
    if (sync.status === 'error') return sync.error ?? 'Błąd synchronizacji';
    if (pending) return `${pending} ${plural(pending, 'zmiana czeka', 'zmiany czekają', 'zmian czeka')} na wysłanie`;
    return sync.lastSync ? `Zsynchronizowano ${timeLabel(sync.lastSync)}` : 'Połączono';
  })();

  return (
    <section class="section" aria-label="Wspólne dane">
      <div class="section-head">
        <h2 class="section-title">Wspólne dane</h2>
      </div>
      <div class="card" style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span class="glyph" style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
            <Icon name="github" size={20} />
          </span>
          <div style={{ display: 'grid', minWidth: 0 }}>
            <strong>{cfg ? `${cfg.owner}/${cfg.repo}` : __PROTOTYPE__ ? 'Prywatny plik na GitHubie' : 'Brak połączenia'}</strong>
            <span class={`hint ${sync.status === 'error' ? 'neg' : ''}`}>{status}</span>
          </div>
        </div>

        {connected ? (
          <>
            <p class="soft" style={{ fontSize: '13.5px' }}>
              Każda zmiana zapisuje się od razu w telefonie i sama wysyła się do wspólnego pliku, gdy jest internet. Gdy oboje coś zmienicie, aplikacja łączy zmiany wpis po wpisie, więc nic nie ginie.
              {__PROTOTYPE__ && ' W prototypie wysyłanie jest tylko symulowane.'}
            </p>
            <button
              class="btn primary block"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await syncNow();
                setBusy(false);
              }}
            >
              <Icon name="sync" size={20} /> {busy || sync.status === 'syncing' ? 'Synchronizuję…' : pending ? `Wyślij ${pending} ${plural(pending, 'zmianę', 'zmiany', 'zmian')}` : 'Synchronizuj teraz'}
            </button>
            {sync.status === 'error' && /Token/i.test(sync.error ?? '') && (
              <button class="btn secondary block" type="button" onClick={openConnect}>
                <Icon name="link" size={18} /> Wklej nowy token
              </button>
            )}
            <div class="btn-row">
              <button class="btn secondary sm" type="button" onClick={openInvite}>
                <Icon name="qr" size={18} /> Połącz {partner ? `telefon: ${partner}` : 'drugi telefon'}
              </button>
              {cfg && (
                <button class="btn secondary sm" type="button" onClick={() => openExternal(`https://github.com/${cfg.owner}/${cfg.repo}/commits`)}>
                  <Icon name="layers" size={18} /> Historia zmian
                </button>
              )}
            </div>
            {cfg &&
              (!confirmForget ? (
                <button class="link-btn" type="button" style={{ justifySelf: 'start' }} onClick={() => setConfirmForget(true)}>
                  Odłącz ten telefon
                </button>
              ) : (
                <div class="confirm-box" role="alert">
                  <strong>Odłączyć ten telefon?</strong>
                  <span class="hint">Usunie z niego token i dane. Wspólny plik na GitHubie zostaje bez zmian{pending ? `, ale ${pending} niewysłanych zmian przepadnie` : ''}.</span>
                  <div class="btn-row">
                    <button class="btn secondary sm" type="button" onClick={() => setConfirmForget(false)}>
                      Anuluj
                    </button>
                    <button class="btn danger solid sm" type="button" onClick={forgetThisPhone}>
                      Odłącz
                    </button>
                  </div>
                </div>
              ))}
          </>
        ) : (
          <>
            <p class="soft" style={{ fontSize: '13.5px' }}>Połącz telefon z Waszym prywatnym repozytorium, żeby oboje widzieli i zapisywali te same dane.</p>
            <button class="btn primary block" type="button" onClick={openConnect}>
              <Icon name="link" size={20} /> Połącz z GitHubem
            </button>
            <div class="btn-row">
              <button class="btn secondary sm" type="button" onClick={openJoin}>
                <Icon name="scan" size={18} /> Dołącz kodem
              </button>
              <button class="btn secondary sm" type="button" onClick={() => file.current?.click()}>
                <Icon name="upload" size={18} /> Wczytaj plik
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
          </>
        )}
      </div>
    </section>
  );
}
