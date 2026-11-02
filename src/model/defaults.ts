import type { Category, Entry, Household, MortgageParams, Person, SeedFile } from './types';
import { monthKey } from '../lib/months';
import { annuityPayment } from './mortgage';

export const INCOME_CATEGORIES: Category[] = [
  { id: 'base', name: 'Podstawa' },
  { id: 'overtime', name: 'Nadgodziny' },
  { id: 'bonus', name: 'Premia' },
  { id: 'other', name: 'Inne' },
];

export const DEFAULT_BILL_CATEGORIES: Category[] = [
  { id: 'mortgage', name: 'Rata kredytu' },
  { id: 'insurance', name: 'Ubezpieczenie' },
  { id: 'power', name: 'Prąd' },
  { id: 'internet', name: 'Internet' },
  { id: 'rent', name: 'Czynsz' },
];

export const TYPE_LABEL = {
  income: 'Dochód',
  bill: 'Opłata',
  overpayment: 'Nadpłata',
  expense: 'Wydatek',
} as const;

export const TYPE_LABEL_PLURAL = {
  income: 'Dochody',
  bill: 'Opłaty',
  overpayment: 'Nadpłaty',
  expense: 'Wydatki',
} as const;

const TONES: Person['tone'][] = ['indigo', 'clay'];

export function defaultMortgage(now: number, year: number): MortgageParams {
  return {
    propertyValue: 0,
    principal: 0,
    contributions: [],
    annualRate: 6.5,
    termMonths: 360,
    firstPayment: monthKey(year, 1),
    kind: 'annuity',
    overpayEffect: 'shorten',
    balance: null,
    confirmed: false,
    updatedAt: now,
    updatedBy: 'system',
  };
}

export function emptyHousehold(now = Date.now()): Household {
  const year = new Date(now).getFullYear();
  return {
    schema: 1,
    people: [
      { id: 'osoba-1', name: 'Ja', tone: 'indigo' },
      { id: 'osoba-2', name: 'Partner', tone: 'clay' },
    ],
    billCategories: DEFAULT_BILL_CATEGORIES,
    entries: [],
    mortgage: defaultMortgage(now, year),
    meta: { createdAt: now, updatedAt: now, peopleUpdatedAt: now, categoriesUpdatedAt: now },
  };
}

/**
 * The spreadsheet has the loan amount and the monthly installments, but not the
 * rate. Assuming a 30-year annuity, find the rate that reproduces the most
 * common installment. It is shown as an estimate until confirmed.
 */
export function estimateAnnualRate(principal: number, entries: Entry[], termMonths = 360): number | null {
  const amounts = entries.filter((e) => e.type === 'bill' && e.category === 'mortgage' && !e.deleted).map((e) => e.amount);
  if (!principal || !amounts.length) return null;
  const freq = new Map<number, number>();
  for (const a of amounts) freq.set(a, (freq.get(a) ?? 0) + 1);
  const installment = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0][0];
  let lo = 0;
  let hi = 0.05;
  if (annuityPayment(principal, hi, termMonths) < installment) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (annuityPayment(principal, mid, termMonths) > installment) hi = mid;
    else lo = mid;
  }
  return Math.round(lo * 12 * 100 * 100) / 100;
}

/** Build a household from the spreadsheet converted by tools/xlsx_to_json.py. */
export function householdFromSeed(seed: SeedFile, now = Date.now()): Household {
  const people: Person[] = seed.people.slice(0, 2).map((p, i) => ({ id: p.id, name: p.name, tone: TONES[i] }));
  const m = seed.mortgage;
  const rate = estimateAnnualRate(m.principal ?? 0, seed.entries);
  return {
    schema: 1,
    people,
    billCategories: seed.billCategories.length ? seed.billCategories : DEFAULT_BILL_CATEGORIES,
    entries: seed.entries,
    mortgage: {
      ...defaultMortgage(now, seed.year),
      propertyValue: m.propertyValue ?? 0,
      principal: m.principal ?? 0,
      contributions: m.contributions ?? [],
      annualRate: rate ?? 6.5,
      termMonths: 360,
      firstPayment: monthKey(seed.year, 1),
    },
    meta: { createdAt: now, updatedAt: now, peopleUpdatedAt: now, categoriesUpdatedAt: now },
  };
}
