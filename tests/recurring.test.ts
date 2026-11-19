import { describe, expect, it } from 'vitest';
import { plannedEntries, AUTO_TS } from '../src/model/recurring';
import { billsToFill, latestEntryMonth, lastInstallment } from '../src/model/calc';
import { mergeHouseholds } from '../src/sync/merge';
import { emptyHousehold } from '../src/model/defaults';
import type { Entry, Household } from '../src/model/types';

const e = (id: string, month: string, extra: Partial<Entry> = {}): Entry => ({
  id,
  type: 'bill',
  month,
  amount: 10000,
  category: 'rent',
  createdAt: 5,
  createdBy: 'a',
  updatedAt: 5,
  updatedBy: 'a',
  ...extra,
});

function household(entries: Entry[]): Household {
  const h = emptyHousehold(0);
  return {
    ...h,
    billCategories: [
      { id: 'mortgage', name: 'Rata kredytu' },
      { id: 'rent', name: 'Czynsz' },
      { id: 'water', name: 'Woda', recurring: false },
      { id: 'old', name: 'Stara', archived: true },
    ],
    entries,
  };
}

describe('planned entries', () => {
  const hist = [e('m10', '2026-10', { category: 'mortgage', amount: 316394 }), e('r10', '2026-10', { amount: 65937 })];

  it('plans every fixed bill at 0 zł in the new month', () => {
    const p = plannedEntries(household(hist), '2026-11');
    expect(p.map((x) => x.id).sort()).toEqual(['auto-2026-11-mortgage', 'auto-2026-11-rent']);
    expect(p.every((x) => x.amount === 0 && x.updatedAt === AUTO_TS && x.month === '2026-11')).toBe(true);
  });

  it('skips bills already entered, switched off, hidden or deleted', () => {
    const h = household([...hist, e('r11', '2026-11', { amount: 65000 }), e('auto-2026-11-mortgage', '2026-11', { category: 'mortgage', amount: 0, deleted: true })]);
    expect(plannedEntries(h, '2026-11')).toEqual([]);
  });

  it('plans nothing on a fresh phone', () => {
    expect(plannedEntries(emptyHousehold(), '2026-11')).toEqual([]);
  });

  it('is idempotent', () => {
    const h = household(hist);
    const once = { ...h, entries: [...h.entries, ...plannedEntries(h, '2026-11')] };
    expect(plannedEntries(once, '2026-11')).toEqual([]);
  });

  it('continues installments up to the planned count', () => {
    const tv = (i: number, month: string): Entry => e(`tv${i}`, month, { type: 'expense', category: undefined, title: 'TV', amount: 44814, series: { id: 'tv', index: i, count: 10 } });
    const h = household([...hist, tv(7, '2026-09'), tv(8, '2026-10')]);
    const p = plannedEntries(h, '2026-11').filter((x) => x.series);
    expect(p.map((x) => [x.month, x.series!.index, x.amount, x.title])).toEqual([
      ['2026-11', 9, 44814, 'TV'],
      ['2026-12', 10, 44814, 'TV'],
    ]);
  });

  it('never plans a deleted installment again', () => {
    const tv8 = e('tv8', '2026-10', { type: 'expense', title: 'TV', series: { id: 'tv', index: 8, count: 10 } });
    const gone = e('auto-tv-9', '2026-11', { type: 'expense', title: 'TV', series: { id: 'tv', index: 9, count: 10 }, deleted: true });
    const p = plannedEntries(household([...hist, tv8, gone]), '2026-11').filter((x) => x.series);
    expect(p.map((x) => x.series!.index)).toEqual([10]);
  });

  it('a delete or an edit on the other phone wins over a planned copy', () => {
    const h = household(hist);
    const planned = plannedEntries(h, '2026-11');
    const phoneA = { ...h, entries: [...h.entries, ...planned] };
    const rent = planned.find((x) => x.category === 'rent')!;
    const phoneB = { ...h, entries: [...h.entries, ...planned.filter((x) => x !== rent), { ...rent, deleted: true, updatedAt: 1000 }] };
    const merged = mergeHouseholds(phoneA, phoneB);
    expect(merged.entries.find((x) => x.id === rent.id)!.deleted).toBe(true);
  });
});

describe('month helpers', () => {
  it('opens on the latest month with any entry', () => {
    const h = household([e('a', '2026-10'), e('b', '2026-11', { type: 'expense', title: 'Półki' })]);
    expect(latestEntryMonth(h, '2026-11')).toBe('2026-11');
    expect(latestEntryMonth(h, '2026-10')).toBe('2026-10');
  });

  it('a planned 0 zł installment is not the last paid one', () => {
    const h = household([e('m10', '2026-10', { category: 'mortgage', amount: 316394 }), e('m11', '2026-11', { category: 'mortgage', amount: 0 })]);
    expect(lastInstallment(h, '2026-11')).toEqual({ month: '2026-10', amount: 316394 });
  });

  it('suggests the last amount for planned bills', () => {
    const h = household([e('r10', '2026-10', { amount: 65937 }), e('auto-2026-11-rent', '2026-11', { amount: 0 })]);
    expect(billsToFill(h, '2026-11')).toEqual([{ category: 'rent', entryId: 'auto-2026-11-rent', suggestion: 65937, fromMonth: '2026-10' }]);
  });
});
