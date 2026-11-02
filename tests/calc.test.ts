import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { householdFromSeed, estimateAnnualRate } from '../src/model/defaults';
import { summarizeMonth, summarizeYear, lensView, billsToCopy } from '../src/model/calc';
import { parseAmount, formatPLN } from '../src/lib/money';
import { durationLabel } from '../src/lib/months';
import { annuityPayment } from '../src/model/mortgage';
import type { Entry, SeedFile } from '../src/model/types';

describe('money', () => {
  it('formats Polish amounts', () => {
    expect(formatPLN(1234567)).toBe('12 345,67 zł');
    expect(formatPLN(-12345)).toBe('−123,45 zł');
    expect(formatPLN(400000, { decimals: 'auto' })).toBe('4 000 zł');
  });
  it('parses what people type', () => {
    expect(parseAmount('120,50')).toBe(12050);
    expect(parseAmount('1 234,56')).toBe(123456);
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('1234.56')).toBe(123456);
    expect(parseAmount('3 500')).toBe(350000);
    expect(parseAmount('1.500')).toBe(150000);
    expect(parseAmount('1200 + 349,90')).toBe(154990);
    expect(parseAmount('1500-1500')).toBe(0);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('labels durations', () => {
    expect(durationLabel(27)).toBe('2 lata 3 mies.');
    expect(durationLabel(12)).toBe('1 rok');
    expect(durationLabel(60)).toBe('5 lat');
    expect(durationLabel(5)).toBe('5 mies.');
  });
});

describe('estimateAnnualRate', () => {
  it('recovers the rate from recorded installments', () => {
    const principal = 40000000;
    const rata = Math.round(annuityPayment(principal, 0.072 / 12, 360));
    const bill = (month: string, amount: number): Entry => ({ id: month, type: 'bill', category: 'mortgage', month, amount, createdAt: 0, createdBy: 't', updatedAt: 0, updatedBy: 't' });
    const entries = [bill('2026-01', rata + 41000), bill('2026-02', rata), bill('2026-03', rata), bill('2026-04', rata)];
    expect(estimateAnnualRate(principal, entries)).toBeCloseTo(7.2, 1);
  });
});

/*
 * Parity with the spreadsheet. Runs only with the private seed file
 * (SEED_FILE=/path/budget.json); no real figures live in the code. The seed carries the sheet's own computed results
 * ("DOCHÓD VS OPŁATY") and the app must reproduce every month of them.
 */
const seedPath = process.env.SEED_FILE;
const hasSeed = !!seedPath && existsSync(seedPath);

describe.skipIf(!hasSeed)('spreadsheet parity', () => {
  const seed = hasSeed ? (JSON.parse(readFileSync(seedPath!, 'utf8')) as SeedFile) : null;
  const h = seed ? householdFromSeed(seed, 0) : null;
  const months = Object.keys(seed?.checks ?? {});

  it('the seed carries the sheet results', () => {
    expect(months.length).toBeGreaterThan(0);
  });

  it.each(months)('%s matches "DOCHÓD VS OPŁATY"', (month) => {
    const sheet = seed!.checks![month];
    const s = summarizeMonth(h!, month);
    for (const p of h!.people) {
      const exp = sheet[p.id];
      if (!exp) continue;
      // halving bills can leave half a grosz; the sheet and JS round .5 differently
      expect(s.income[p.id]).toBe(exp.income);
      expect(Math.abs(s.personCosts[p.id] - exp.costs)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.personLeft[p.id] - exp.left)).toBeLessThanOrEqual(1);
    }
    const all = sheet.all;
    expect(s.incomeTotal).toBe(all.income);
    expect(s.bills).toBe(all.bills);
    expect(s.expenses).toBe(all.expenses);
    expect(s.outTotal).toBe(all.out);
    expect(s.left).toBe(all.left);
  });

  it('year totals add up month by month', () => {
    const y = summarizeYear(h!, seed!.year, 'all');
    const sum = (k: string) => months.reduce((a, m) => a + (seed!.checks![m].all[k] ?? 0), 0);
    expect(y.total.income).toBe(sum('income'));
    expect(y.total.out).toBe(sum('out'));
    expect(y.total.left).toBe(sum('left'));
  });

  it('person lens splits bills in half and adds own overpayments', () => {
    const month = months.find((m) => summarizeMonth(h!, m).overpayTotal > 0)!;
    const s = summarizeMonth(h!, month);
    for (const p of h!.people) {
      const v = lensView(s, p.id);
      expect(Math.round(v.bills)).toBe(Math.round(s.bills / 2));
      expect(v.overpay).toBe(s.overpay[p.id]);
    }
  });

  it('suggests the previous month bills to copy', () => {
    const last = [...months].reverse().find((m) => summarizeMonth(h!, m).bills > 0)!;
    const next = `${last.slice(0, 5)}${String(Number(last.slice(5)) + 1).padStart(2, '0')}`;
    if (Number(last.slice(5)) < 12) expect(billsToCopy(h!, next).length).toBeGreaterThan(0);
  });

  it('estimates a plausible mortgage rate from the installments', () => {
    expect(h!.mortgage.annualRate).toBeGreaterThan(1);
    expect(h!.mortgage.annualRate).toBeLessThan(15);
  });
});

describe('paid bills', () => {
  const bill = (month: string, amount: number, paid?: boolean): Entry => ({
    id: `${month}-${amount}`,
    type: 'bill',
    category: 'rent',
    month,
    amount,
    paid,
    createdAt: 0,
    createdBy: 't',
    updatedAt: 0,
    updatedBy: 't',
  });
  it('past months count as paid unless marked otherwise', async () => {
    const { isPaid } = await import('../src/model/calc');
    expect(isPaid(bill('2026-10', 100), '2026-11')).toBe(true);
    expect(isPaid(bill('2026-10', 100, false), '2026-11')).toBe(false);
    expect(isPaid(bill('2026-11', 100), '2026-11')).toBe(false);
    expect(isPaid(bill('2026-11', 100, true), '2026-11')).toBe(true);
  });
  it('progress counts bills and paid amounts', async () => {
    const { billProgress } = await import('../src/model/calc');
    const p = billProgress([bill('2026-11', 300000, true), bill('2026-11', 50000), bill('2026-11', 25000, true)], '2026-11');
    expect(p).toEqual({ count: 3, paid: 2, total: 375000, paidAmount: 325000 });
  });
});
