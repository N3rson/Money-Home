/**
 * Entries the app plans by itself:
 * - every fixed bill (category with "co miesiąc") at 0 zł in the current month,
 * - the remaining installments of a purchase on installments.
 *
 * Their ids are deterministic and their timestamps are older than anything a
 * person does, so both phones plan exactly the same entries (merging them is a
 * no-op) and any real edit or delete always wins over a planned copy.
 */
import type { Entry, Household, MonthKey } from './types';
import { addMonths } from '../lib/months';

export const AUTO_TS = 1;

type Draft = Omit<Entry, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;

function planned(d: Draft): Entry {
  return { ...d, createdAt: AUTO_TS, createdBy: 'auto', updatedAt: AUTO_TS, updatedBy: 'auto' };
}

export function plannedEntries(h: Household, today: MonthKey): Entry[] {
  const out: Entry[] = [];
  const ids = new Set(h.entries.map((e) => e.id));
  const live = h.entries.filter((e) => !e.deleted);
  // a fresh phone (nothing before this month) plans nothing until it has the shared data
  if (!live.some((e) => e.month < today)) return out;

  for (const c of h.billCategories) {
    if (c.archived || c.recurring === false) continue;
    const id = `auto-${today}-${c.id}`;
    if (ids.has(id)) continue;
    if (live.some((e) => e.type === 'bill' && e.month === today && e.category === c.id)) continue;
    out.push(planned({ id, type: 'bill', month: today, amount: 0, category: c.id }));
  }

  const bySeries = new Map<string, Entry[]>();
  for (const e of h.entries) {
    if (!e.series) continue;
    const list = bySeries.get(e.series.id);
    if (list) list.push(e);
    else bySeries.set(e.series.id, [e]);
  }
  for (const [sid, list] of bySeries) {
    const count = Math.max(...list.map((e) => e.series!.count));
    // deleted installments count too, so a deleted one is never planned again
    const maxIndex = Math.max(...list.map((e) => e.series!.index));
    const last = list.filter((e) => !e.deleted).sort((a, b) => b.series!.index - a.series!.index)[0];
    if (!last || maxIndex >= count) continue;
    for (let i = maxIndex + 1; i <= count; i++) {
      const id = `auto-${sid}-${i}`;
      if (ids.has(id)) continue;
      out.push(
        planned({
          id,
          type: last.type,
          month: addMonths(last.month, i - last.series!.index),
          amount: last.amount,
          title: last.title,
          person: last.person,
          category: last.category,
          series: { id: sid, index: i, count },
        }),
      );
    }
  }
  return out;
}
