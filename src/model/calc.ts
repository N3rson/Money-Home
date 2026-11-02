import type { Entry, Household, MonthKey, PersonId } from './types';
import { monthsOfYear, parseMonth } from '../lib/months';

/** 'all' = the household, otherwise one person. */
export type Lens = 'all' | PersonId;

export interface MonthSummary {
  month: MonthKey;
  income: Record<PersonId, number>;
  incomeByCat: Record<PersonId, Record<string, number>>;
  incomeTotal: number;
  /** Shared fixed bills (rata, czynsz, prąd...). */
  bills: number;
  billsByCat: Record<string, number>;
  overpay: Record<PersonId, number>;
  overpayTotal: number;
  /** All expenses. */
  expenses: number;
  /** Expenses marked as paid alone by one person. */
  expensesOwn: Record<PersonId, number>;
  /** Bills + overpayments + expenses ("Opłaty Total" in the spreadsheet). */
  outTotal: number;
  /** Income minus everything ("Reszta" for Razem). */
  left: number;
  /** Half of the shared bills + own overpayments ("Opłaty" per person). */
  personCosts: Record<PersonId, number>;
  /** Income minus personCosts ("Reszta" per person). */
  personLeft: Record<PersonId, number>;
  /** Half of shared expenses + own expenses. */
  personExpenseShare: Record<PersonId, number>;
  entryCount: number;
  hasIncome: boolean;
}

export function liveEntries(h: Household): Entry[] {
  return h.entries.filter((e) => !e.deleted);
}

export function summarizeMonth(h: Household, month: MonthKey, entries = liveEntries(h)): MonthSummary {
  const ids = h.people.map((p) => p.id);
  const share = ids.length ? 1 / ids.length : 1;
  const zero = () => Object.fromEntries(ids.map((id) => [id, 0])) as Record<PersonId, number>;
  const s: MonthSummary = {
    month,
    income: zero(),
    incomeByCat: Object.fromEntries(ids.map((id) => [id, {}])),
    incomeTotal: 0,
    bills: 0,
    billsByCat: {},
    overpay: zero(),
    overpayTotal: 0,
    expenses: 0,
    expensesOwn: zero(),
    outTotal: 0,
    left: 0,
    personCosts: zero(),
    personLeft: zero(),
    personExpenseShare: zero(),
    entryCount: 0,
    hasIncome: false,
  };
  let sharedExpenses = 0;
  for (const e of entries) {
    if (e.month !== month) continue;
    s.entryCount++;
    switch (e.type) {
      case 'income': {
        const p = e.person ?? ids[0];
        s.income[p] = (s.income[p] ?? 0) + e.amount;
        const cat = e.category ?? 'other';
        const byCat = (s.incomeByCat[p] ??= {});
        byCat[cat] = (byCat[cat] ?? 0) + e.amount;
        s.incomeTotal += e.amount;
        break;
      }
      case 'bill': {
        s.bills += e.amount;
        const cat = e.category ?? 'other';
        s.billsByCat[cat] = (s.billsByCat[cat] ?? 0) + e.amount;
        break;
      }
      case 'overpayment': {
        const p = e.person ?? ids[0];
        s.overpay[p] = (s.overpay[p] ?? 0) + e.amount;
        s.overpayTotal += e.amount;
        break;
      }
      case 'expense': {
        s.expenses += e.amount;
        if (e.person && ids.includes(e.person)) s.expensesOwn[e.person] += e.amount;
        else sharedExpenses += e.amount;
        break;
      }
    }
  }
  s.hasIncome = s.incomeTotal > 0;
  s.outTotal = s.bills + s.overpayTotal + s.expenses;
  s.left = s.incomeTotal - s.outTotal;
  for (const id of ids) {
    s.personCosts[id] = s.bills * share + s.overpay[id];
    s.personLeft[id] = s.income[id] - s.personCosts[id];
    s.personExpenseShare[id] = sharedExpenses * share + s.expensesOwn[id];
  }
  return s;
}

/** The numbers one lens shows for a month. */
export interface LensView {
  income: number;
  bills: number;
  overpay: number;
  expenses: number;
  /** What the lens counts as spent. For a person: half of bills + own overpayments (as in the spreadsheet). */
  out: number;
  left: number;
  /** For a person: what is left after their share of expenses too. */
  leftAfterExpenses: number;
}

export function lensView(s: MonthSummary, lens: Lens): LensView {
  if (lens === 'all') {
    return {
      income: s.incomeTotal,
      bills: s.bills,
      overpay: s.overpayTotal,
      expenses: s.expenses,
      out: s.outTotal,
      left: s.left,
      leftAfterExpenses: s.left,
    };
  }
  const income = s.income[lens] ?? 0;
  const overpay = s.overpay[lens] ?? 0;
  const bills = (s.personCosts[lens] ?? 0) - overpay;
  const expenses = s.personExpenseShare[lens] ?? 0;
  const left = s.personLeft[lens] ?? 0;
  return { income, bills, overpay, expenses, out: bills + overpay, left, leftAfterExpenses: left - expenses };
}

export interface YearSummary {
  year: number;
  months: MonthSummary[];
  total: LensView;
  /** Months with income for this lens; averages divide by this. */
  incomeMonths: number;
  avgIncome: number;
  avgLeft: number;
}

export function summarizeYear(h: Household, year: number, lens: Lens): YearSummary {
  const entries = liveEntries(h);
  const months = monthsOfYear(year).map((m) => summarizeMonth(h, m, entries));
  const total: LensView = { income: 0, bills: 0, overpay: 0, expenses: 0, out: 0, left: 0, leftAfterExpenses: 0 };
  let incomeMonths = 0;
  let leftInIncomeMonths = 0;
  for (const m of months) {
    const v = lensView(m, lens);
    total.income += v.income;
    total.bills += v.bills;
    total.overpay += v.overpay;
    total.expenses += v.expenses;
    total.out += v.out;
    total.left += v.left;
    total.leftAfterExpenses += v.leftAfterExpenses;
    if (v.income > 0) {
      incomeMonths++;
      leftInIncomeMonths += v.left;
    }
  }
  return {
    year,
    months,
    total,
    incomeMonths,
    avgIncome: incomeMonths ? total.income / incomeMonths : 0,
    avgLeft: incomeMonths ? leftInIncomeMonths / incomeMonths : 0,
  };
}

/** Years that have any entries, plus the given one; newest first. */
export function yearsWithData(h: Household, ensure: number): number[] {
  const set = new Set<number>([ensure]);
  for (const e of liveEntries(h)) set.add(parseMonth(e.month).year);
  return [...set].sort((a, b) => b - a);
}

/** Latest month <= `upTo` that has income, else `upTo`. */
export function latestIncomeMonth(h: Household, upTo: MonthKey): MonthKey {
  let best: MonthKey | null = null;
  for (const e of liveEntries(h)) {
    if (e.type === 'income' && e.month <= upTo && (!best || e.month > best)) best = e.month;
  }
  return best ?? upTo;
}

/** Total overpayments per person, all time. */
export function overpaymentsByPerson(h: Household): Record<PersonId, number> {
  const out: Record<PersonId, number> = Object.fromEntries(h.people.map((p) => [p.id, 0]));
  for (const e of liveEntries(h)) {
    if (e.type === 'overpayment' && e.person) out[e.person] = (out[e.person] ?? 0) + e.amount;
  }
  return out;
}

/** Overpayments keyed by month (all people). */
export function overpaymentsByMonth(h: Household): Map<MonthKey, number> {
  const map = new Map<MonthKey, number>();
  for (const e of liveEntries(h)) {
    if (e.type === 'overpayment') map.set(e.month, (map.get(e.month) ?? 0) + e.amount);
  }
  return map;
}

/** Latest mortgage installment recorded as a bill. */
export function lastInstallment(h: Household, upTo: MonthKey): { month: MonthKey; amount: number } | null {
  let best: { month: MonthKey; amount: number } | null = null;
  for (const e of liveEntries(h)) {
    if (e.type === 'bill' && e.category === 'mortgage' && e.month <= upTo && (!best || e.month > best.month)) {
      best = { month: e.month, amount: e.amount };
    }
  }
  return best;
}

/** Bills of the latest month before `month` that had any, to copy forward. */
export function billsToCopy(h: Household, month: MonthKey): Entry[] {
  const entries = liveEntries(h).filter((e) => e.type === 'bill' && e.month < month);
  if (!entries.length) return [];
  const prev = entries.reduce((a, e) => (e.month > a ? e.month : a), entries[0].month);
  const already = new Set(liveEntries(h).filter((e) => e.type === 'bill' && e.month === month).map((e) => e.category));
  return entries.filter((e) => e.month === prev && !already.has(e.category));
}
