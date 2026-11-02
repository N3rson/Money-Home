import { useState } from 'preact/hooks';
import { resetToSeed, setTheme, syncNow, useStore, type Theme } from '../../model/store';
import { liveEntries } from '../../model/calc';
import { timeLabel } from '../../lib/months';
import { Hanko, Segmented } from '../components';
import { Icon } from '../icons';
import { openCategories, openInvite, openJoin, openPeople } from '../sheets';

export function More() {
  const h = useStore((s) => s.household);
  const prefs = useStore((s) => s.prefs);
  const pending = useStore((s) => s.pending);
  const lastSync = useStore((s) => s.lastSync);
  const [syncing, setSyncing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const me = h.people.find((p) => p.id === prefs.me);
  const count = liveEntries(h).length;

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Więcej</h1>
      </div>

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
              <strong>Prywatny plik na GitHubie</strong>
              <span class="hint">
                {pending > 0 ? `${pending} ${pending === 1 ? 'zmiana czeka' : 'zmiany czekają'} na wysłanie` : lastSync ? `Zsynchronizowano ${timeLabel(lastSync)}` : 'Wszystko aktualne'}
              </span>
            </div>
          </div>
          <p class="soft" style={{ fontSize: '13.5px' }}>
            Każda zmiana zapisuje się od razu w telefonie i sama wysyła się do wspólnego pliku, gdy jest internet. Gdy oboje coś zmienicie, aplikacja łączy zmiany wpis po wpisie, więc nic nie ginie.
            {__PROTOTYPE__ && ' W prototypie wysyłanie jest tylko symulowane.'}
          </p>
          <button
            class="btn primary block"
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              await syncNow();
              setSyncing(false);
            }}
          >
            <Icon name="sync" size={20} /> {syncing ? 'Synchronizuję…' : pending ? `Wyślij ${pending} ${pending === 1 ? 'zmianę' : pending < 5 ? 'zmiany' : 'zmian'}` : 'Synchronizuj teraz'}
          </button>
          <div class="btn-row">
            <button class="btn secondary sm" type="button" onClick={openInvite}>
              <Icon name="qr" size={18} /> Połącz telefon
            </button>
            <button class="btn secondary sm" type="button" onClick={openJoin}>
              <Icon name="link" size={18} /> Dołącz kodem
            </button>
          </div>
        </div>
      </section>

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
              <span>{h.billCategories.filter((c) => !c.archived).map((c) => c.name).join(', ')}</span>
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

      <section class="section" aria-label="Dane">
        <div class="section-head">
          <h2 class="section-title">Dane</h2>
        </div>
        <div class="card tight">
          <div class="settings-row">
            <span class="glyph">
              <Icon name="download" size={17} />
            </span>
            <span class="main">
              <strong>Eksport do Excela</strong>
              <span>Arkusz w układzie jak budget.xlsx{__PROTOTYPE__ ? ' · w aplikacji' : ''}</span>
            </span>
            <span />
          </div>
          <div class="settings-row">
            <span class="glyph">
              <Icon name="upload" size={17} />
            </span>
            <span class="main">
              <strong>Import z Excela</strong>
              <span>Kolejne lata z tego samego szablonu{__PROTOTYPE__ ? ' · w aplikacji' : ''}</span>
            </span>
            <span />
          </div>
          {__PROTOTYPE__ && (
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
          )}
        </div>
      </section>

      <p class="hint" style={{ textAlign: 'center', paddingTop: '6px' }}>
        Money Home {__PROTOTYPE__ ? 'prototyp' : 'v0.1'} · {__BUILD_DATE__}
      </p>
    </div>
  );
}
