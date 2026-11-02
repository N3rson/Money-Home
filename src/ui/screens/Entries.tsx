import { useMemo, useState } from 'preact/hooks';
import type { Entry, EntryType, Household, MonthKey } from '../../model/types';
import { INCOME_CATEGORIES, TYPE_LABEL_PLURAL } from '../../model/defaults';
import { billProgress, billsToCopy, isPaid, liveEntries, summarizeMonth, summarizeYear, lensView, yearsWithData } from '../../model/calc';
import { setMonth, setPaid, useStore } from '../../model/store';
import { formatPLN } from '../../lib/money';
import { MONTHS_LOCATIVE, MONTHS_SHORT, monthKey, monthName, parseMonth, addMonths } from '../../lib/months';
import { Chips, Empty, Hanko, Money, MonthNav, Segmented } from '../components';
import { Icon, billIcon } from '../icons';
import { openCopyBills, openEntry } from '../sheets';

type Filter = 'all' | EntryType;
const ORDER: EntryType[] = ['income', 'bill', 'overpayment', 'expense'];

export function Entries() {
  const [mode, setMode] = useState<'list' | 'sheet'>('list');
  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Wpisy</h1>
      </div>
      <Segmented
        label="Widok"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'list', label: <><Icon name="list" size={17} /> Lista</> },
          { value: 'sheet', label: <><Icon name="table" size={17} /> Arkusz</> },
        ]}
      />
      {mode === 'list' ? <MonthList /> : <YearSheet onPick={() => setMode('list')} />}
    </div>
  );
}

function MonthList() {
  const h = useStore((s) => s.household);
  const month = useStore((s) => s.month);
  const [filter, setFilter] = useState<Filter>('all');
  const s = useMemo(() => summarizeMonth(h, month), [h, month]);
  const entries = useMemo(() => liveEntries(h).filter((e) => e.month === month), [h, month]);
  const copy = billsToCopy(h, month);
  const prevLoc = MONTHS_LOCATIVE[parseMonth(addMonths(month, -1)).month - 1];

  const groups = ORDER.filter((t) => filter === 'all' || filter === t)
    .map((t) => ({ type: t, items: sortEntries(entries.filter((e) => e.type === t), h) }))
    .filter((g) => g.items.length);

  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      <div class="facts">
        <div class="fact">
          <span class="label">Wpłynęło</span>
          <span class="value num">{formatPLN(s.incomeTotal)}</span>
        </div>
        <div class="fact">
          <span class="label">Wyszło</span>
          <span class="value num">{formatPLN(s.outTotal)}</span>
        </div>
      </div>
      <Chips
        label="Pokaż"
        scroll
        value={filter}
        onChange={setFilter}
        options={[{ value: 'all' as Filter, label: 'Wszystkie' }, ...ORDER.map((t) => ({ value: t as Filter, label: TYPE_LABEL_PLURAL[t] }))]}
      />
      {copy.length > 0 && !entries.some((e) => e.type === 'bill') && (
        <button class="note-card" type="button" style={{ textAlign: 'left', width: '100%' }} onClick={() => openCopyBills(month)}>
          <Icon name="layers" size={20} />
          <span>
            <strong style={{ color: 'var(--ink)' }}>Brak opłat stałych.</strong> Dodaj je jednym ruchem z kwotami jak w {prevLoc} ({formatPLN(copy.reduce((a, e) => a + e.amount, 0))}).
          </span>
        </button>
      )}
      {groups.length === 0 ? (
        <div class="card flat">
          <Empty icon="calendar" title={entries.length ? 'Nic w tym filtrze' : `${monthName(month)} jest pusty`}>
            <span>Dodaj dochód, opłatę albo wydatek.</span>
            <button class="btn primary sm" type="button" style={{ marginTop: '6px' }} onClick={() => openEntry({ month, type: filter === 'all' ? undefined : filter })}>
              <Icon name="plus" size={18} /> Dodaj wpis
            </button>
          </Empty>
        </div>
      ) : (
        groups.map((g) => <Group key={g.type} type={g.type} items={g.items} h={h} month={month} />)
      )}
    </>
  );
}

function sortEntries(items: Entry[], h: Household): Entry[] {
  const personIdx = (id?: string) => (id ? h.people.findIndex((p) => p.id === id) : 9);
  const incomeIdx = (c?: string) => INCOME_CATEGORIES.findIndex((x) => x.id === c);
  const billIdx = (c?: string) => h.billCategories.findIndex((x) => x.id === c);
  return [...items].sort((a, b) => {
    if (a.type === 'income') return personIdx(a.person) - personIdx(b.person) || incomeIdx(a.category) - incomeIdx(b.category);
    if (a.type === 'bill') return billIdx(a.category) - billIdx(b.category);
    if (a.type === 'overpayment') return personIdx(a.person) - personIdx(b.person);
    return b.amount - a.amount;
  });
}

function Group({ type, items, h, month }: { type: EntryType; items: Entry[]; h: Household; month: MonthKey }) {
  const total = items.reduce((a, e) => a + e.amount, 0);
  return (
    <section class="group" aria-label={TYPE_LABEL_PLURAL[type]}>
      <div class="group-head">
        <span class="eyebrow">{TYPE_LABEL_PLURAL[type]}</span>
        <Money value={total} />
      </div>
      {type === 'bill' && <PaidProgress items={items} />}
      <div class="card tight">
        {items.map((e) => (
          <EntryRow key={e.id} e={e} h={h} />
        ))}
        <button class="row" type="button" style={{ minHeight: '48px', color: 'var(--ink-2)' }} onClick={() => openEntry({ type, month })}>
          <span class="glyph" style={{ borderStyle: 'dashed', background: 'transparent' }}>
            <Icon name="plus" size={16} />
          </span>
          <span class="main">
            <span style={{ fontSize: '14px' }}>Dodaj {type === 'income' ? 'dochód' : type === 'bill' ? 'opłatę' : type === 'overpayment' ? 'nadpłatę' : 'wydatek'}</span>
          </span>
          <span />
        </button>
      </div>
    </section>
  );
}

/** How much of this month's bills is already paid: a thin bar and one line. */
function PaidProgress({ items }: { items: Entry[] }) {
  const p = billProgress(items);
  if (!p.count) return null;
  const share = p.total ? p.paidAmount / p.total : 0;
  const pct = Math.round(share * 100);
  const done = p.paid === p.count;
  return (
    <div class="paid-progress">
      <div class="paid-track" role="progressbar" aria-label="Opłacone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <div class="paid-caption">
        <span>{done ? 'Wszystko opłacone' : `Opłacone ${pct}% · ${p.paid} z ${p.count}`}</span>
        {!done && <span class="num">zostało {formatPLN(p.total - p.paidAmount)}</span>}
      </div>
    </div>
  );
}

function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`;
}

function BillRow({ e, h }: { e: Entry; h: Household }) {
  const name = h.billCategories.find((c) => c.id === e.category)?.name ?? 'Opłata';
  const paid = isPaid(e);
  const status = paid ? (e.paidAt ? `opłacone ${shortDate(e.paidAt)}` : 'opłacone') : 'do zapłaty';
  return (
    <div class={`row bill-row ${paid ? 'is-paid' : ''}`}>
      <button class="row-main" type="button" onClick={() => openEntry({ id: e.id })}>
        <span class="glyph">
          <Icon name={billIcon(e.category)} size={17} />
        </span>
        <span class="main">
          <span class="title">{name}</span>
          <span class="sub">{[status, 'po połowie', e.note].filter(Boolean).join(' · ')}</span>
        </span>
        <span class="amount">
          <Money value={e.amount} />
        </span>
      </button>
      <button
        class="paid-check"
        type="button"
        aria-pressed={paid}
        aria-label={`${name}: ${paid ? 'opłacone, dotknij, aby cofnąć' : 'oznacz jako opłacone'}`}
        onClick={() => setPaid(e.id, !paid)}
      >
        <Icon name="check" size={18} />
      </button>
    </div>
  );
}

function EntryRow({ e, h }: { e: Entry; h: Household }) {
  if (e.type === 'bill') return <BillRow e={e} h={h} />;
  const person = h.people.find((p) => p.id === e.person);
  let title = '';
  const sub: string[] = [];
  let lead = <span class="glyph"><Icon name="receipt" size={17} /></span>;
  switch (e.type) {
    case 'income':
      title = INCOME_CATEGORIES.find((c) => c.id === e.category)?.name ?? 'Dochód';
      sub.push(person?.name ?? '');
      lead = <Hanko person={person} />;
      break;
    case 'overpayment':
      title = 'Nadpłata kredytu';
      sub.push(person?.name ?? '');
      lead = <Hanko person={person} />;
      break;
    case 'expense':
      title = e.title || 'Wydatek';
      if (e.series) sub.push(`rata ${e.series.index} z ${e.series.count}`);
      sub.push(person ? `płaci ${person.name}` : 'wspólny');
      lead = person ? <Hanko person={person} /> : <span class="glyph"><Icon name="bag" size={17} /></span>;
      break;
  }
  if (e.note) sub.push(e.note);
  return (
    <button class="row" type="button" onClick={() => openEntry({ id: e.id })}>
      {lead}
      <span class="main">
        <span class="title">{title}</span>
        <span class="sub">{sub.filter(Boolean).join(' · ')}</span>
      </span>
      <span class="amount">
        <Money value={e.amount} plus={e.type === 'income'} />
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ spreadsheet view

interface SheetRow {
  label: string;
  values: number[];
  kind?: 'block' | 'sum';
  avg?: boolean;
}

function YearSheet({ onPick }: { onPick: () => void }) {
  const h = useStore((s) => s.household);
  const month = useStore((s) => s.month);
  const { year, month: mIdx } = parseMonth(month);
  const years = yearsWithData(h, year);
  const rows = useMemo(() => buildRows(h, year), [h, year]);

  return (
    <>
      <div class="month-nav">
        <button class="icon-btn" type="button" aria-label="Poprzedni rok" disabled={!years.includes(year - 1)} onClick={() => setMonth(monthKey(year - 1, mIdx))}>
          <Icon name="left" size={20} />
        </button>
        <div class="label">
          <strong>{year}</strong>
          <span>jak w arkuszu</span>
        </div>
        <button class="icon-btn" type="button" aria-label="Następny rok" onClick={() => setMonth(monthKey(year + 1, mIdx))}>
          <Icon name="right" size={20} />
        </button>
      </div>
      <div class="sheet-scroll">
        <table class="xl">
          <thead>
            <tr>
              <th class="rowhead" scope="col">
                {year}
              </th>
              {MONTHS_SHORT.map((m, i) => (
                <th scope="col" key={m} class={i + 1 === mIdx ? 'sel' : ''}>
                  <button
                    type="button"
                    style={{ font: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}
                    onClick={() => {
                      setMonth(monthKey(year, i + 1));
                      onPick();
                    }}
                    aria-label={`Pokaż wpisy: ${monthName(monthKey(year, i + 1))}`}
                  >
                    {m.toUpperCase()}
                  </button>
                </th>
              ))}
              <th scope="col" class="yr">
                ROK
              </th>
              <th scope="col">ŚR.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) =>
              r.kind === 'block' ? (
                <tr class="block" key={i}>
                  <td class="rowhead">{r.label}</td>
                  <td colSpan={14} />
                </tr>
              ) : (
                <tr class={r.kind === 'sum' ? 'sum' : ''} key={i}>
                  <td class="rowhead">{r.label}</td>
                  {r.values.map((v, j) => (
                    <td key={j} class={`${v === 0 ? 'nil' : v < 0 ? 'neg' : ''} ${j + 1 === mIdx ? 'sel' : ''}`}>
                      {v === 0 ? '·' : formatPLN(v, { unit: false })}
                    </td>
                  ))}
                  <td class={`yr ${sum(r.values) < 0 ? 'neg' : ''}`}>{formatPLN(sum(r.values), { unit: false })}</td>
                  <td>{formatPLN(avg(r.values), { unit: false })}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p class="hint">Średnia liczy miesiące z wpisami (jak ŚREDNIA w arkuszu). Dotknij miesiąca, żeby zobaczyć jego wpisy.</p>
    </>
  );
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const avg = (v: number[]) => {
  const nz = v.filter((x) => x !== 0);
  return nz.length ? Math.round(sum(nz) / nz.length) : 0;
};

function buildRows(h: Household, year: number): SheetRow[] {
  const all = summarizeYear(h, year, 'all');
  const rows: SheetRow[] = [];
  for (const p of h.people) {
    rows.push({ label: `Dochód · ${p.name}`, values: [], kind: 'block' });
    const cats = INCOME_CATEGORIES.filter((c) => c.id !== 'other' || all.months.some((m) => m.incomeByCat[p.id]?.[c.id]));
    for (const c of cats) rows.push({ label: c.name, values: all.months.map((m) => m.incomeByCat[p.id]?.[c.id] ?? 0) });
    rows.push({ label: 'Razem', values: all.months.map((m) => m.income[p.id] ?? 0), kind: 'sum' });
  }
  rows.push({ label: 'Opłaty', values: [], kind: 'block' });
  for (const c of h.billCategories) {
    const values = all.months.map((m) => m.billsByCat[c.id] ?? 0);
    if (c.archived && !values.some(Boolean)) continue;
    rows.push({ label: c.name, values });
  }
  rows.push({ label: 'Razem opłaty', values: all.months.map((m) => m.bills), kind: 'sum' });
  rows.push({ label: 'Nadpłaty kredytu', values: [], kind: 'block' });
  for (const p of h.people) rows.push({ label: p.name, values: all.months.map((m) => m.overpay[p.id] ?? 0) });
  rows.push({ label: 'Wydatki', values: [], kind: 'block' });
  rows.push({ label: 'Razem wydatki', values: all.months.map((m) => m.expenses), kind: 'sum' });
  rows.push({ label: 'Dochód vs opłaty', values: [], kind: 'block' });
  for (const p of h.people) {
    rows.push({ label: `${p.name} · zostaje`, values: all.months.map((m) => Math.round(lensView(m, p.id).left)) });
  }
  rows.push({ label: 'Dochód domu', values: all.months.map((m) => m.incomeTotal) });
  rows.push({ label: 'Wydano razem', values: all.months.map((m) => m.outTotal) });
  rows.push({ label: 'Zostaje', values: all.months.map((m) => m.left), kind: 'sum' });
  return rows;
}
