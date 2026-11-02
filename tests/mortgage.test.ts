import { describe, expect, it } from 'vitest';
import { annuityPayment, simulate, overpayScenario, mortgageStatus } from '../src/model/mortgage';
import type { MortgageParams } from '../src/model/types';

// A made-up loan (the repository is public; no real figures here).
const loan: MortgageParams = {
  propertyValue: 62500000,
  principal: 50000000,
  contributions: [
    { person: 'a', amount: 7500000 },
    { person: 'b', amount: 5000000 },
  ],
  annualRate: 6,
  termMonths: 360,
  firstPayment: '2026-01',
  kind: 'annuity',
  overpayEffect: 'shorten',
  balance: null,
  confirmed: false,
  updatedAt: 0,
  updatedBy: 't',
};

describe('mortgage', () => {
  it('computes the standard annuity installment', () => {
    // 500 000 zł, 6%, 30 years -> 2 997,75 zł
    expect(Math.round(annuityPayment(50000000, 0.06 / 12, 360))).toBe(299775);
  });

  it('runs the full term without overpayments', () => {
    const s = simulate(loan);
    expect(s.months).toBe(360);
    expect(s.endMonth).toBe('2055-12');
    expect(s.rows[s.rows.length - 1].balance).toBe(0);
    expect(Math.round(s.totalInterest / 100)).toBeGreaterThan(579000);
    expect(Math.round(s.totalInterest / 100)).toBeLessThan(580000);
  });

  it('decreasing installments also close the loan', () => {
    const s = simulate({ ...loan, kind: 'decreasing' });
    expect(s.months).toBe(360);
    expect(s.rows[0].payment).toBeGreaterThan(s.rows[359].payment);
  });

  it('overpaying shortens the loan and saves interest', () => {
    const r = overpayScenario(loan, new Map(), '2026-11', 200000, 0, 'shorten');
    expect(r.savedMonths).toBeGreaterThan(120);
    expect(r.savedInterest).toBeGreaterThan(20000000);
    // "lower installment": each overpayment lowers the rata, so it saves less than shortening
    const lower = overpayScenario(loan, new Map(), '2026-11', 200000, 0, 'lower');
    expect(lower.savedInterest).toBeLessThan(r.savedInterest);
    expect(lower.newPayment).toBeLessThan(299775);
    const once = overpayScenario(loan, new Map(), '2026-11', 0, 1000000, 'lower');
    expect(once.savedMonths).toBe(0);
  });

  it('recorded overpayments reduce the balance', () => {
    const rec = new Map([['2026-08', 200000], ['2026-09', 200000], ['2026-10', 200000]]);
    const st = mortgageStatus(loan, rec, '2026-10');
    expect(st.paidInstallments).toBe(10);
    expect(st.balance).toBeLessThan(50000000 - 600000);
    expect(st.savedMonths).toBeGreaterThan(0);
    expect(st.ownedRatio).toBeGreaterThan(0.2);
  });

  it('a bank balance anchor resets the projection', () => {
    const st = mortgageStatus({ ...loan, balance: { amount: 45000000, month: '2026-10' } }, new Map(), '2026-10');
    expect(st.balance).toBe(45000000);
  });
});
