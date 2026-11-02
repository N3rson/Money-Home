/**
 * Two phones edit the same budget, sometimes offline. Instead of "last save
 * wins" for the whole file, changes are merged record by record:
 * - entries: union by id; for the same id the newer `updatedAt` wins
 *   (deletes are kept as tombstones, so they win over older copies),
 * - mortgage, people: the newer version wins,
 * - bill categories: union by id, newer list wins on conflicts.
 */
import type { Category, Entry, Household } from '../model/types';

function newer<T extends { updatedAt: number }>(a: T, b: T): T {
  return a.updatedAt > b.updatedAt ? a : b;
}

export function mergeHouseholds(local: Household, remote: Household): Household {
  const byId = new Map<string, Entry>();
  for (const e of remote.entries) byId.set(e.id, e);
  for (const e of local.entries) {
    const r = byId.get(e.id);
    byId.set(e.id, r ? newer(e, r) : e);
  }

  const localCatsWin = local.meta.categoriesUpdatedAt > remote.meta.categoriesUpdatedAt;
  const cats = new Map<string, Category>();
  const [first, second] = localCatsWin ? [remote.billCategories, local.billCategories] : [local.billCategories, remote.billCategories];
  for (const c of first) cats.set(c.id, c);
  for (const c of second) cats.set(c.id, c);
  const order = (localCatsWin ? local.billCategories : remote.billCategories).map((c) => c.id);
  const billCategories = [...cats.values()].sort((a, b) => rank(order, a.id) - rank(order, b.id));

  return {
    schema: 1,
    people: local.meta.peopleUpdatedAt > remote.meta.peopleUpdatedAt ? local.people : remote.people,
    billCategories,
    entries: [...byId.values()],
    mortgage: newer(local.mortgage, remote.mortgage),
    meta: {
      createdAt: Math.min(local.meta.createdAt || Infinity, remote.meta.createdAt || Infinity) || Date.now(),
      updatedAt: Math.max(local.meta.updatedAt, remote.meta.updatedAt),
      peopleUpdatedAt: Math.max(local.meta.peopleUpdatedAt, remote.meta.peopleUpdatedAt),
      categoriesUpdatedAt: Math.max(local.meta.categoriesUpdatedAt, remote.meta.categoriesUpdatedAt),
    },
  };
}

function rank(order: string[], id: string): number {
  const i = order.indexOf(id);
  return i === -1 ? order.length : i;
}

const TYPE_ORDER = { income: 0, bill: 1, overpayment: 2, expense: 3 } as const;

/**
 * Stable, diff-friendly file format: settings first, then one entry per line,
 * sorted by month. Git history then shows exactly which entries changed.
 */
export function serialize(h: Household): string {
  const entries = [...h.entries].sort(
    (a, b) => a.month.localeCompare(b.month) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id.localeCompare(b.id),
  );
  const head = {
    schema: h.schema,
    app: 'money-home',
    people: h.people,
    billCategories: h.billCategories,
    mortgage: h.mortgage,
    meta: h.meta,
  };
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  const lines = entries.map((e) => '    ' + JSON.stringify(e));
  return `${top},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

export function parseHousehold(text: string): Household {
  const data = JSON.parse(text) as Partial<Household> & { schema?: number };
  if (data.schema !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.people) || !data.mortgage || !data.meta) {
    throw new Error(data.schema && data.schema > 1 ? 'Plik pochodzi z nowszej wersji aplikacji — zaktualizuj ją' : 'Nieznany format pliku z budżetem');
  }
  return {
    schema: 1,
    people: data.people,
    billCategories: data.billCategories ?? [],
    entries: data.entries,
    mortgage: data.mortgage,
    meta: data.meta,
  };
}
