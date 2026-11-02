import { useEffect, useState } from 'preact/hooks';
import seed from 'virtual:seed';
import type { Entry, Household, MonthKey, MortgageParams, Person, PersonId } from './types';
import { emptyHousehold, householdFromSeed } from './defaults';
import { currentMonth } from '../lib/months';
import { latestIncomeMonth, type Lens } from './calc';

export type Tab = 'start' | 'wpisy' | 'kredyt' | 'wiecej';
export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  me: PersonId | null;
  theme: Theme;
  lens: Lens | 'compare';
  deviceId: string;
  /** The welcome screen was skipped ("try without connecting"). */
  welcomeDone?: boolean;
}

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

/** Where the shared file lives. Stored only on this phone. */
export interface SyncConfig {
  owner: string;
  repo: string;
  branch?: string;
  path: string;
  token: string;
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  config: SyncConfig | null;
  status: SyncStatus;
  error: string | null;
  lastSync: number | null;
  remoteSha: string | null;
  etag: string | null;
}

export interface State {
  household: Household;
  prefs: Prefs;
  tab: Tab;
  month: MonthKey;
  /** Changes made on this phone and not yet in the shared file. */
  pending: number;
  sync: SyncState;
  toast: Toast | null;
}

const KEY_DATA = 'money-home.household.v1';
const KEY_PREFS = 'money-home.prefs.v1';
const KEY_SYNC = 'money-home.sync.v1';
const KEY_PENDING = 'money-home.pending.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable (private mode); the app keeps working in memory */
  }
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function initialHousehold(): Household {
  const stored = read<Household>(KEY_DATA);
  if (stored && stored.schema === 1) return stored;
  return seed ? householdFromSeed(seed) : emptyHousehold();
}

function initialTab(): Tab {
  const h = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
  return (['start', 'wpisy', 'kredyt', 'wiecej'] as Tab[]).includes(h as Tab) ? (h as Tab) : 'start';
}

const household = initialHousehold();
const storedPrefs = read<Prefs>(KEY_PREFS);
const prefs: Prefs = {
  me: storedPrefs?.me ?? (seed ? household.people[0]?.id ?? null : null),
  theme: storedPrefs?.theme ?? 'system',
  lens: storedPrefs?.lens ?? 'all',
  deviceId: storedPrefs?.deviceId ?? newId(),
  welcomeDone: storedPrefs?.welcomeDone ?? false,
};
const storedSync = read<Pick<SyncState, 'config' | 'lastSync' | 'remoteSha'>>(KEY_SYNC);

let state: State = {
  household,
  prefs,
  tab: initialTab(),
  month: latestIncomeMonth(household, currentMonth()),
  pending: read<number>(KEY_PENDING) ?? 0,
  sync: {
    config: storedSync?.config ?? null,
    status: storedSync?.config ? 'idle' : 'off',
    error: null,
    lastSync: storedSync?.lastSync ?? null,
    remoteSha: storedSync?.remoteSha ?? null,
    etag: null,
  },
  toast: null,
};

const listeners = new Set<() => void>();
const commitListeners = new Set<() => void>();

export function getState(): State {
  return state;
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useStore<T>(select: (s: State) => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return select(state);
}

/** Called after every local change (the sync engine listens). */
export function onCommit(listener: () => void): () => void {
  commitListeners.add(listener);
  return () => commitListeners.delete(listener);
}

// ---------------------------------------------------------------- household

export function meId(): string {
  return state.prefs.me ?? 'unknown';
}

function commit(next: Household, changes = 1) {
  next = { ...next, meta: { ...next.meta, updatedAt: Date.now() } };
  write(KEY_DATA, next);
  const pending = state.pending + changes;
  write(KEY_PENDING, pending);
  setState({ household: next, pending });
  commitListeners.forEach((l) => l());
}

/** Used by sync: replace the household with the merged one; `sent` local changes are now remote. */
export function applyRemote(next: Household, sent: number) {
  write(KEY_DATA, next);
  const pending = Math.max(0, state.pending - sent);
  write(KEY_PENDING, pending);
  const month = state.household.entries.length === 0 && next.entries.length > 0 ? latestIncomeMonth(next, currentMonth()) : state.month;
  setState({ household: next, pending, month });
}

export function setSync(patch: Partial<SyncState>) {
  const sync = { ...state.sync, ...patch };
  write(KEY_SYNC, sync.config ? { config: sync.config, lastSync: sync.lastSync, remoteSha: sync.remoteSha } : null);
  setState({ sync });
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, undo?: () => void) {
  clearTimeout(toastTimer);
  setState({ toast: { id: ++toastSeq, text, undo } });
  toastTimer = setTimeout(() => setState({ toast: null }), undo ? 6000 : 3200);
}
export function dismissToast() {
  clearTimeout(toastTimer);
  setState({ toast: null });
}

export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;

export function addEntries(drafts: EntryDraft[]): Entry[] {
  const now = Date.now();
  const created = drafts.map((d) => ({ ...d, id: newId(), createdAt: now, createdBy: meId(), updatedAt: now, updatedBy: meId() }));
  commit({ ...state.household, entries: [...state.household.entries, ...created] }, created.length);
  return created;
}

export function updateEntry(id: string, patch: Partial<Entry>) {
  const now = Date.now();
  commit({
    ...state.household,
    entries: state.household.entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: now, updatedBy: meId() } : e)),
  });
}

/** Tick a bill off as paid (or undo it). */
export function setPaid(id: string, paid: boolean) {
  updateEntry(id, paid ? { paid: true, paidAt: Date.now(), paidBy: meId() } : { paid: false, paidAt: undefined, paidBy: undefined });
}

function setDeleted(ids: Set<string>, deleted: boolean) {
  const now = Date.now();
  commit(
    {
      ...state.household,
      entries: state.household.entries.map((e) => (ids.has(e.id) ? { ...e, deleted, updatedAt: now, updatedBy: meId() } : e)),
    },
    ids.size,
  );
}

export function deleteEntries(ids: string[], label: string) {
  const set = new Set(ids);
  setDeleted(set, true);
  toast(label, () => {
    setDeleted(set, false);
    toast('Przywrócono');
  });
}

export function updateMortgage(patch: Partial<MortgageParams>) {
  commit({
    ...state.household,
    mortgage: { ...state.household.mortgage, ...patch, updatedAt: Date.now(), updatedBy: meId() },
  });
}

export function updatePeople(people: Person[]) {
  commit({ ...state.household, people, meta: { ...state.household.meta, peopleUpdatedAt: Date.now() } });
}

export function addBillCategory(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'oplata';
  let id = base;
  let n = 2;
  while (state.household.billCategories.some((c) => c.id === id)) id = `${base}-${n++}`;
  commit({
    ...state.household,
    billCategories: [...state.household.billCategories, { id, name: name.trim() }],
    meta: { ...state.household.meta, categoriesUpdatedAt: Date.now() },
  });
  return id;
}

export function renameBillCategory(id: string, name: string) {
  commit({
    ...state.household,
    billCategories: state.household.billCategories.map((c) => (c.id === id ? { ...c, name } : c)),
    meta: { ...state.household.meta, categoriesUpdatedAt: Date.now() },
  });
}

export function setCategoryArchived(id: string, archived: boolean) {
  commit({
    ...state.household,
    billCategories: state.household.billCategories.map((c) => (c.id === id ? { ...c, archived } : c)),
    meta: { ...state.household.meta, categoriesUpdatedAt: Date.now() },
  });
}

/** Load a whole household (from a file) as local changes; sync sends it on. */
export function importHousehold(next: Household) {
  commit(next, Math.max(1, next.entries.length));
  setState({ month: latestIncomeMonth(next, currentMonth()) });
}

export function resetToSeed() {
  const next = seed ? householdFromSeed(seed) : emptyHousehold();
  write(KEY_DATA, next);
  write(KEY_PENDING, 0);
  setState({ household: next, pending: 0, month: latestIncomeMonth(next, currentMonth()) });
  toast('Przywrócono dane z arkusza');
}

/** Forget the connection and the data on this phone (the shared file stays untouched). */
export function forgetThisPhone() {
  write(KEY_DATA, null);
  write(KEY_SYNC, null);
  write(KEY_PENDING, 0);
  const fresh = emptyHousehold();
  savePrefs({ ...state.prefs, me: null, welcomeDone: false });
  setState({
    household: fresh,
    pending: 0,
    month: currentMonth(),
    sync: { config: null, status: 'off', error: null, lastSync: null, remoteSha: null, etag: null },
  });
}

// ---------------------------------------------------------------- ui state

export function setTab(tab: Tab) {
  if (state.tab === tab) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  try {
    history.replaceState(null, '', `#${tab}`);
  } catch {
    /* hash may be unavailable in embedded viewers */
  }
  setState({ tab });
  window.scrollTo({ top: 0 });
}

export function setMonth(month: MonthKey) {
  setState({ month });
}

function savePrefs(p: Prefs) {
  write(KEY_PREFS, p);
  setState({ prefs: p });
}

export function setLens(lens: Prefs['lens']) {
  savePrefs({ ...state.prefs, lens });
}

export function setTheme(theme: Theme) {
  savePrefs({ ...state.prefs, theme });
}

export function setMe(id: PersonId) {
  savePrefs({ ...state.prefs, me: id });
}

export function finishWelcome() {
  savePrefs({ ...state.prefs, welcomeDone: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const t = initialTab();
    if (t !== state.tab) setState({ tab: t });
  });
}
