/**
 * Offline-first sync. Every change is saved on the phone first; the shared
 * file is then read, merged record by record and written back with the sha we
 * read (GitHub rejects the write if the other phone saved in between, and we
 * simply merge again). Runs on start, on every change (debounced), when the app
 * comes back to the foreground or online, and every 45 s while it is open.
 */
import { applyRemote, getState, onCommit, setSync, toast, type SyncConfig } from '../model/store';
import { mergeHouseholds, parseHousehold, serialize } from './merge';
import { checkRepo, readFile, SyncError, writeFile } from './github';
import { plural } from '../lib/months';

const POLL_MS = 45_000;
const DEBOUNCE_MS = 1500;

let running: Promise<void> | null = null;
let again = false;
let debounce: ReturnType<typeof setTimeout> | undefined;
let started = false;

function commitMessage(changes: number): string {
  const s = getState();
  const who = s.household.people.find((p) => p.id === s.prefs.me)?.name ?? 'Telefon';
  if (!changes) return `${who}: uzupełnienie danych (Money Home)`;
  return `${who}: ${changes} ${plural(changes, 'zmiana', 'zmiany', 'zmian')} (Money Home)`;
}

async function syncOnce(): Promise<void> {
  const cfg = getState().sync.config;
  if (!cfg) return;
  const sent = getState().pending;
  setSync({ status: 'syncing', error: null });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = getState();
      const remote = await readFile(cfg, cur.pending === 0 ? cur.sync.etag : null);
      if (remote === 'unchanged') {
        setSync({ status: 'idle', lastSync: Date.now() });
        return;
      }
      const local = getState().household;
      if (remote === null) {
        const { sha } = await writeFile(cfg, serialize(local), null, commitMessage(sent));
        applyRemote(getState().household, sent);
        setSync({ status: 'idle', lastSync: Date.now(), remoteSha: sha, etag: null });
        return;
      }
      const remoteHh = parseHousehold(remote.text);
      const merged = mergeHouseholds(local, remoteHh);
      const text = serialize(merged);
      let sha = remote.sha;
      let etag = remote.etag;
      if (text !== serialize(remoteHh)) {
        try {
          ({ sha } = await writeFile(cfg, text, remote.sha, commitMessage(sent)));
          etag = null;
        } catch (e) {
          if (e instanceof SyncError && e.kind === 'conflict') continue; // the other phone saved first: merge again
          throw e;
        }
      }
      // edits made while we were talking to GitHub stay pending for the next round
      applyRemote(mergeHouseholds(getState().household, merged), sent);
      setSync({ status: 'idle', lastSync: Date.now(), remoteSha: sha, etag });
      return;
    }
    throw new SyncError('conflict', 'Plik ciągle się zmienia — spróbuję za chwilę');
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError('format', (e as Error).message || 'Nieznany błąd');
    setSync({ status: err.kind === 'network' ? 'offline' : 'error', error: err.message });
  }
}

async function simulate(): Promise<void> {
  setSync({ status: 'syncing' });
  await new Promise((r) => setTimeout(r, 900));
  applyRemote(getState().household, getState().pending);
  setSync({ status: 'off', lastSync: Date.now() });
}

/** Sync now; concurrent calls join the running one (and trigger one more round). */
export function syncNow(): Promise<void> {
  if (__PROTOTYPE__) return simulate();
  if (!getState().sync.config) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

export function startSync() {
  if (started || __PROTOTYPE__) return;
  started = true;
  onCommit(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), DEBOUNCE_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, POLL_MS);
  void syncNow();
}

/** Connect this phone to the shared file. Throws a SyncError with a readable message. */
export async function connect(cfg: SyncConfig): Promise<{ entries: number }> {
  await checkRepo(cfg);
  setSync({ config: cfg, status: 'idle', error: null, remoteSha: null, etag: null });
  await syncNow();
  const s = getState();
  if (s.sync.status === 'error' || s.sync.status === 'offline') {
    const message = s.sync.error ?? 'Nie udało się połączyć';
    setSync({ config: null, status: 'off', error: null });
    throw new SyncError('server', message);
  }
  return { entries: s.household.entries.filter((e) => !e.deleted).length };
}

export function reportSyncError() {
  const s = getState().sync;
  if (s.status === 'error' && s.error) toast(s.error);
}
