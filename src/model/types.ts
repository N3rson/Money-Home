export type PersonId = string;
export type MonthKey = string; // 'YYYY-MM'
export type EntryType = 'income' | 'bill' | 'overpayment' | 'expense';

export interface Person {
  id: PersonId;
  name: string;
  tone: 'indigo' | 'clay';
}

export interface Category {
  id: string;
  name: string;
  archived?: boolean;
}

/** Installment purchase: one entry per month, linked by series id. */
export interface Series {
  id: string;
  index: number; // 1-based
  count: number;
}

export interface Entry {
  id: string;
  type: EntryType;
  month: MonthKey;
  /** Amount in grosze (1 zł = 100). */
  amount: number;
  /** income / overpayment: whose. expense: paid alone by (empty = shared). */
  person?: PersonId;
  /** income: base | overtime | bonus | other. bill: bill category id. */
  category?: string;
  /** expense: what was bought. Optional custom label elsewhere. */
  title?: string;
  note?: string;
  series?: Series;
  /**
   * Bills: ticked off as paid. Missing = paid for months before the current
   * one (history is settled) and unpaid from the current month on.
   */
  paid?: boolean;
  paidAt?: number;
  paidBy?: PersonId;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  /** Tombstone, so a delete on one phone wins over an older copy on the other. */
  deleted?: boolean;
}

export interface Contribution {
  person: PersonId;
  amount: number;
}

export interface MortgageParams {
  propertyValue: number;
  principal: number;
  /** Own contribution (wkład własny) per person. */
  contributions: Contribution[];
  /** Annual interest rate in percent, e.g. 6.14. */
  annualRate: number;
  termMonths: number;
  firstPayment: MonthKey;
  kind: 'annuity' | 'decreasing';
  overpayEffect: 'shorten' | 'lower';
  /**
   * Optional figures from the bank app, after the installment of `month`:
   * remaining principal and (optionally) how many installments are left.
   */
  balance?: { amount: number; month: MonthKey; remaining?: number } | null;
  /** Last month of a fixed-rate period, e.g. '2030-12'. */
  rateFixedUntil?: MonthKey | null;
  /** False until the parameters were checked against the loan agreement. */
  confirmed: boolean;
  updatedAt: number;
  updatedBy: string;
}

export interface Household {
  schema: 1;
  people: Person[];
  billCategories: Category[];
  entries: Entry[];
  mortgage: MortgageParams;
  meta: { createdAt: number; updatedAt: number; peopleUpdatedAt: number; categoriesUpdatedAt: number };
}

/** Shape produced by tools/xlsx_to_json.py */
export interface SeedFile {
  year: number;
  people: { id: string; name: string }[];
  billCategories: Category[];
  entries: Entry[];
  mortgage: {
    propertyValue?: number;
    downPayment?: number;
    principal?: number;
    contributions?: Contribution[];
  };
  /** The spreadsheet's own computed results (DOCHÓD VS OPŁATY), used by parity tests. */
  checks?: Record<MonthKey, Record<string, Record<string, number>>>;
}
