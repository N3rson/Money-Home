import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeHouseholds, parseHousehold, serialize } from '../src/sync/merge';
import { decodeInvite, encodeInvite, looksLikeToken, parseRepo } from '../src/sync/invite';
import { decodeBase64Utf8, encodeBase64Utf8 } from '../src/sync/github';
import { emptyHousehold } from '../src/model/defaults';
import type { Entry, Household } from '../src/model/types';

const entry = (id: string, amount: number, updatedAt: number, extra: Partial<Entry> = {}): Entry => ({
  id,
  type: 'expense',
  month: '2026-11',
  amount,
  title: `Rzecz ${id}`,
  createdAt: 1,
  createdBy: 'a',
  updatedAt,
  updatedBy: 'a',
  ...extra,
});

function household(entries: Entry[], t = 100): Household {
  const h = emptyHousehold(0);
  return {
    ...h,
    people: [
      { id: 'a', name: 'Ala', tone: 'indigo' },
      { id: 'b', name: 'Bartek', tone: 'clay' },
    ],
    entries,
    mortgage: { ...h.mortgage, principal: 1000000, updatedAt: t },
    meta: { createdAt: 1, updatedAt: t, peopleUpdatedAt: t, categoriesUpdatedAt: t },
  };
}

describe('merge', () => {
  it('keeps entries added on both phones', () => {
    const m = mergeHouseholds(household([entry('x', 100, 5)]), household([entry('y', 200, 6)]));
    expect(m.entries.map((e) => e.id).sort()).toEqual(['x', 'y']);
  });

  it('the newer edit of the same entry wins', () => {
    const m = mergeHouseholds(household([entry('x', 100, 5)]), household([entry('x', 300, 9)]));
    expect(m.entries[0].amount).toBe(300);
    const m2 = mergeHouseholds(household([entry('x', 500, 12)]), household([entry('x', 300, 9)]));
    expect(m2.entries[0].amount).toBe(500);
  });

  it('a delete wins over an older copy and loses to a newer edit', () => {
    const del = entry('x', 100, 10, { deleted: true });
    expect(mergeHouseholds(household([del]), household([entry('x', 100, 5)])).entries[0].deleted).toBe(true);
    expect(mergeHouseholds(household([del]), household([entry('x', 150, 11)])).entries[0].deleted).toBeFalsy();
  });

  it('a fresh phone takes everything from the shared file', () => {
    const remote = household([entry('x', 100, 5)]);
    const m = mergeHouseholds(emptyHousehold(), remote);
    expect(m.people.map((p) => p.name)).toEqual(['Ala', 'Bartek']);
    expect(m.mortgage.principal).toBe(1000000);
    expect(m.entries).toHaveLength(1);
  });

  it('newer settings win and categories are merged', () => {
    const local = household([], 50);
    local.billCategories = [...local.billCategories, { id: 'woda', name: 'Woda' }];
    local.meta.categoriesUpdatedAt = 200;
    const remote = household([], 100);
    remote.billCategories = [...remote.billCategories, { id: 'gaz', name: 'Gaz' }];
    const m = mergeHouseholds(local, remote);
    expect(m.billCategories.map((c) => c.id)).toContain('woda');
    expect(m.billCategories.map((c) => c.id)).toContain('gaz');
    expect(m.mortgage.updatedAt).toBe(100);
  });
});

describe('file format', () => {
  it('round-trips and writes one entry per line, sorted', () => {
    const h = household([entry('b', 1, 1, { month: '2026-12' }), entry('a', 2, 1, { month: '2026-01' })]);
    const text = serialize(h);
    expect(parseHousehold(text).entries).toHaveLength(2);
    const lines = text.split('\n').filter((l) => l.startsWith('    {"id"'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"id":"a"');
    expect(serialize(parseHousehold(text))).toBe(text);
  });

  it('rejects unknown files', () => {
    expect(() => parseHousehold('{"schema":2,"entries":[]}')).toThrow(/nowszej wersji/);
    expect(() => parseHousehold('{"hello":1}')).toThrow();
  });

  it('base64 keeps Polish letters', () => {
    const s = 'Zażółć gęślą jaźń — 12 345,67 zł';
    expect(decodeBase64Utf8(encodeBase64Utf8(s))).toBe(s);
  });
});

describe('invite', () => {
  const cfg = { owner: 'ala', repo: 'dom-dane', path: 'budzet.json', token: 'github_pat_' + 'A1b2'.repeat(20) };
  it('round-trips, also from a pasted message with line breaks', () => {
    const code = encodeInvite(cfg);
    expect(code.startsWith('MH1.')).toBe(true);
    expect(decodeInvite(code)).toEqual(cfg);
    expect(decodeInvite(`Kod: ${code.slice(0, 30)}\n${code.slice(30)} `)).toEqual(cfg);
    expect(decodeInvite('cokolwiek')).toBeNull();
  });
  it('reads repository names and tokens', () => {
    expect(parseRepo('https://github.com/ala/dom-dane')).toEqual({ owner: 'ala', repo: 'dom-dane' });
    expect(parseRepo('ala/dom-dane')).toEqual({ owner: 'ala', repo: 'dom-dane' });
    expect(parseRepo('dom-dane')).toBeNull();
    expect(looksLikeToken(cfg.token)).toBe(true);
    expect(looksLikeToken('haslo123')).toBe(false);
  });
});

// ---------------------------------------------------------------- engine against a fake GitHub

interface FakeRepo {
  text: string | null;
  sha: number;
  /** run once before the next PUT (simulates the other phone saving) */
  beforePut?: () => void;
  puts: number;
}

function fakeGitHub(repo: FakeRepo) {
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
    if (!url.includes('/contents/')) return json(200, { private: true, default_branch: 'main' });
    if (method === 'GET') {
      if (repo.text === null) return json(404, { message: 'Not Found' });
      return json(200, { type: 'file', sha: `s${repo.sha}`, encoding: 'base64', content: encodeBase64Utf8(repo.text) }, { etag: `"e${repo.sha}"` });
    }
    const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
    if (repo.beforePut) {
      const f = repo.beforePut;
      repo.beforePut = undefined;
      f();
    }
    if (repo.text !== null && body.sha !== `s${repo.sha}`) return json(409, { message: 'sha does not match' });
    repo.text = decodeBase64Utf8(body.content);
    repo.sha++;
    repo.puts++;
    return json(200, { content: { sha: `s${repo.sha}` } });
  });
}

describe('sync engine', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function load() {
    const store = await import('../src/model/store');
    const engine = await import('../src/sync/engine');
    return { store, engine };
  }

  const cfg = { owner: 'ala', repo: 'dom-dane', path: 'budzet.json', token: 't' };

  it('a new phone downloads the shared file', async () => {
    const repo: FakeRepo = { text: serialize(household([entry('x', 100, 5)])), sha: 1, puts: 0 };
    vi.stubGlobal('fetch', fakeGitHub(repo));
    const { store, engine } = await load();
    const r = await engine.connect(cfg);
    expect(r.entries).toBe(1);
    expect(store.getState().household.people[0].name).toBe('Ala');
    expect(repo.puts).toBe(0); // nothing new to send
  });

  it('creates the file when the repository is empty', async () => {
    const repo: FakeRepo = { text: null, sha: 0, puts: 0 };
    vi.stubGlobal('fetch', fakeGitHub(repo));
    const { store, engine } = await load();
    store.addEntries([{ type: 'expense', month: '2026-11', amount: 999, title: 'Lampa' }]);
    await engine.connect(cfg);
    expect(repo.puts).toBe(1);
    expect(parseHousehold(repo.text!).entries[0].title).toBe('Lampa');
    expect(store.getState().pending).toBe(0);
  });

  it('merges when the other phone saved at the same moment', async () => {
    const repo: FakeRepo = { text: serialize(household([entry('x', 100, 5)])), sha: 1, puts: 0 };
    vi.stubGlobal('fetch', fakeGitHub(repo));
    const { store, engine } = await load();
    await engine.connect(cfg);
    store.addEntries([{ type: 'expense', month: '2026-11', amount: 4200, title: 'Z mojego telefonu' }]);
    // the other phone adds "y" right before our write
    repo.beforePut = () => {
      const other = parseHousehold(repo.text!);
      other.entries.push(entry('y', 777, 50));
      repo.text = serialize(other);
      repo.sha++;
    };
    await engine.syncNow();
    const titles = parseHousehold(repo.text!).entries.map((e) => e.title).sort();
    expect(titles).toEqual(['Rzecz x', 'Rzecz y', 'Z mojego telefonu']);
    expect(store.getState().household.entries).toHaveLength(3);
    expect(store.getState().pending).toBe(0);
  });

  it('keeps changes on the phone when offline', async () => {
    const repo: FakeRepo = { text: serialize(household([])), sha: 1, puts: 0 };
    vi.stubGlobal('fetch', fakeGitHub(repo));
    const { store, engine } = await load();
    await engine.connect(cfg);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    store.addEntries([{ type: 'expense', month: '2026-11', amount: 100, title: 'Offline' }]);
    await engine.syncNow();
    expect(store.getState().sync.status).toBe('offline');
    expect(store.getState().pending).toBe(1);
    vi.stubGlobal('fetch', fakeGitHub(repo));
    await engine.syncNow();
    expect(store.getState().pending).toBe(0);
    expect(parseHousehold(repo.text!).entries[0].title).toBe('Offline');
  });

  it('reports an expired token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"Bad credentials"}', { status: 401 })));
    const { engine } = await load();
    await expect(engine.connect(cfg)).rejects.toThrow(/Token/);
  });
});
