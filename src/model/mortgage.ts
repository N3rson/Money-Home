import type { MonthKey, MortgageParams } from './types';
import { addMonths, diffMonths } from '../lib/months';

/** All amounts in grosze. Interest is rounded to whole grosze each month, like a bank schedule. */

export interface ScheduleRow {
  month: MonthKey;
  payment: number;
  interest: number;
  principal: number;
  overpay: number;
  balance: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalInterest: number;
  totalOverpay: number;
  endMonth: MonthKey;
  months: number;
}

export interface SimOptions {
  /** Overpayments that already happened (from entries), by month. */
  recorded?: Map<MonthKey, number>;
  /** Hypothetical overpayment each month from `from` on. */
  extraMonthly?: number;
  /** Hypothetical one-time overpayment in `from`. */
  extraOnce?: number;
  from?: MonthKey;
  effect?: MortgageParams['overpayEffect'];
}

export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (months <= 0) return balance;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

type LoanShape = Pick<MortgageParams, 'principal' | 'annualRate' | 'termMonths' | 'firstPayment' | 'kind' | 'overpayEffect' | 'balance'>;

export function simulate(loan: LoanShape, opts: SimOptions = {}): Schedule {
  const r = loan.annualRate / 100 / 12;
  const effect = opts.effect ?? loan.overpayEffect;
  const recorded = opts.recorded ?? new Map<MonthKey, number>();
  let balance = loan.principal;
  let remaining = loan.termMonths;
  let payment = annuityPayment(balance, r, remaining);
  let capital = remaining > 0 ? balance / remaining : balance;
  let month = loan.firstPayment;
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalOverpay = 0;

  for (let guard = 0; balance > 0.5 && guard < 1200; guard++) {
    const interest = Math.round(balance * r);
    let principalPart: number;
    let pay: number;
    if (loan.kind === 'annuity') {
      // the last installment closes the loan
      pay = remaining <= 1 ? balance + interest : Math.min(Math.round(payment), balance + interest);
      principalPart = Math.max(0, pay - interest);
    } else {
      principalPart = remaining <= 1 ? balance : Math.min(balance, Math.round(capital));
      pay = principalPart + interest;
    }
    balance -= principalPart;
    remaining -= 1;

    let over = recorded.get(month) ?? 0;
    if (opts.from && month >= opts.from) over += opts.extraMonthly ?? 0;
    if (opts.from && month === opts.from) over += opts.extraOnce ?? 0;
    over = Math.min(over, balance);
    balance -= over;

    let recalc = over > 0 && effect === 'lower';
    const anchor = loan.balance;
    if (anchor && anchor.month === month && anchor.amount > 0) {
      balance = anchor.amount;
      if (anchor.remaining && anchor.remaining > 0) remaining = anchor.remaining;
      recalc = true;
    }
    if (recalc && balance > 0.5) {
      const left = Math.max(1, remaining);
      if (loan.kind === 'annuity') payment = annuityPayment(balance, r, left);
      else capital = balance / left;
    }

    totalInterest += interest;
    totalOverpay += over;
    rows.push({ month, payment: pay, interest, principal: principalPart, overpay: over, balance: Math.max(0, balance) });
    month = addMonths(month, 1);
  }

  const last = rows[rows.length - 1];
  return {
    rows,
    totalInterest,
    totalOverpay,
    endMonth: last ? last.month : loan.firstPayment,
    months: rows.length,
  };
}

export interface MortgageStatus {
  /** Last month whose installment is counted as paid. */
  asOf: MonthKey | null;
  paidInstallments: number;
  balance: number;
  paidPrincipal: number;
  paidRatio: number;
  /** Own contribution + repaid principal, as a share of the property value. */
  ownedRatio: number;
  nextPayment: number;
  /** With the overpayments made so far. */
  actual: Schedule;
  /** As if nothing had ever been overpaid. */
  baseline: Schedule;
  savedInterest: number;
  savedMonths: number;
  remainingInterest: number;
}

export function mortgageStatus(m: MortgageParams, recorded: Map<MonthKey, number>, asOf: MonthKey | null): MortgageStatus {
  const actual = simulate(m, { recorded });
  const baseline = simulate({ ...m, balance: null }, {});
  let idx = -1;
  if (asOf) idx = actual.rows.findIndex((r) => r.month === asOf);
  if (asOf && idx === -1 && actual.rows.length && asOf > actual.rows[actual.rows.length - 1].month) idx = actual.rows.length - 1;
  const row = idx >= 0 ? actual.rows[idx] : null;
  const balance = row ? row.balance : m.principal;
  const paidPrincipal = m.principal - balance;
  const next = actual.rows[idx + 1];
  const downPayment = m.contributions.reduce((a, c) => a + c.amount, 0);
  const remainingInterest = actual.rows.slice(idx + 1).reduce((a, r) => a + r.interest, 0);
  return {
    asOf: row ? row.month : null,
    paidInstallments: idx + 1,
    balance,
    paidPrincipal,
    paidRatio: m.principal ? paidPrincipal / m.principal : 0,
    ownedRatio: m.propertyValue ? Math.min(1, (downPayment + paidPrincipal) / m.propertyValue) : 0,
    nextPayment: next ? next.payment : 0,
    actual,
    baseline,
    savedInterest: Math.max(0, baseline.totalInterest - actual.totalInterest),
    savedMonths: Math.max(0, baseline.months - actual.months),
    remainingInterest,
  };
}

export interface ScenarioResult {
  schedule: Schedule;
  /** Compared with continuing as now (recorded overpayments only). */
  savedMonths: number;
  savedInterest: number;
  /** First regular installment after the overpayments start (matters for "lower"). */
  newPayment: number;
  endMonth: MonthKey;
}

export function overpayScenario(
  m: MortgageParams,
  recorded: Map<MonthKey, number>,
  from: MonthKey,
  extraMonthly: number,
  extraOnce: number,
  effect: MortgageParams['overpayEffect'] = m.overpayEffect,
): ScenarioResult {
  const now = simulate(m, { recorded, effect });
  const schedule = simulate(m, { recorded, extraMonthly, extraOnce, from, effect });
  const after = schedule.rows.find((r) => r.month > from) ?? schedule.rows[schedule.rows.length - 1];
  return {
    schedule,
    savedMonths: Math.max(0, now.months - schedule.months),
    savedInterest: Math.max(0, now.totalInterest - schedule.totalInterest),
    newPayment: after ? after.payment : 0,
    endMonth: schedule.endMonth,
  };
}

/** Balance at the end of each year, for charts. */
export function yearlyBalances(s: Schedule, start: MonthKey): { month: MonthKey; balance: number }[] {
  const out: { month: MonthKey; balance: number }[] = [];
  for (const r of s.rows) {
    if (r.month.endsWith('-12') || r === s.rows[s.rows.length - 1]) out.push({ month: r.month, balance: r.balance });
  }
  return out.filter((p) => diffMonths(start, p.month) >= 0);
}
