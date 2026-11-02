/** Money is stored as integer grosze. Display follows Polish conventions: 12 345,67 zł */

const GROUP = ' ';
export const MINUS = '−';

function groupDigits(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

export interface MoneyParts {
  sign: '' | '+' | typeof MINUS;
  int: string;
  dec: string;
}

export function moneyParts(grosze: number, opts: { plus?: boolean } = {}): MoneyParts {
  const v = Math.round(grosze);
  const abs = Math.abs(v);
  const int = groupDigits(String(Math.floor(abs / 100)));
  const dec = String(abs % 100).padStart(2, '0');
  const sign = v < 0 ? MINUS : opts.plus && v > 0 ? '+' : '';
  return { sign, int, dec };
}

/** "12 345,67 zł". `decimals: 'auto'` drops ",00". */
export function formatPLN(
  grosze: number,
  opts: { plus?: boolean; decimals?: boolean | 'auto'; unit?: boolean } = {},
): string {
  const { sign, int, dec } = moneyParts(grosze, opts);
  const showDec = opts.decimals === false ? false : opts.decimals === 'auto' ? dec !== '00' : true;
  const unit = opts.unit === false ? '' : `${GROUP}zł`;
  return `${sign}${int}${showDec ? ',' + dec : ''}${unit}`;
}

/** Short axis/tick labels: 0, 5 tys., 12,5 tys., 1,2 mln */
export function compactPLN(grosze: number): string {
  const zl = grosze / 100;
  const abs = Math.abs(zl);
  const sign = zl < 0 ? MINUS : '';
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}${GROUP}mln`;
  if (abs >= 1000) return `${sign}${trim(abs / 1000)}${GROUP}tys.`;
  return `${sign}${Math.round(abs)}`;
}

function trim(n: number): string {
  const s = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
  return s.replace('.', ',');
}

/**
 * Parse what people type: "1 234,56", "1234.56", "1.234,56", "3 500" and simple
 * sums like "1112,18 + 348,94" (the spreadsheet had such formulas).
 * Returns grosze or null when the text is not a number.
 */
export function parseAmount(input: string): number | null {
  const raw = input.replace(/zł/gi, '').replace(/[\s   ]/g, '').replace(/−/g, '-');
  if (!raw) return null;
  const terms = raw.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  let total = 0;
  for (const t of terms) {
    const neg = t.startsWith('-');
    const body = t.replace(/^[+-]/, '');
    const n = parseNumber(body);
    if (n === null) return null;
    total += neg ? -n : n;
  }
  return Math.round(total * 100);
}

function parseNumber(s: string): number | null {
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // both used: the later one is the decimal separator ("1.234,56" / "1,234.56")
    const dec = lastComma > lastDot ? ',' : '.';
    const grp = dec === ',' ? '.' : ',';
    normalized = s.split(grp).join('').replace(dec, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    // money never has 3 decimals, so "1.500" / "1,500" / "1.234.567" are thousands
    const grouping = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = grouping ? parts.join('') : parts.join('.');
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Value for an <input>: "120,5" -> "120,50" */
export function amountInputValue(grosze: number): string {
  const { int, dec } = moneyParts(Math.abs(grosze));
  return `${int.split(GROUP).join(' ')},${dec}`.replace(/,00$/, '');
}

export function percent(part: number, whole: number, digits = 0): string {
  if (!whole) return '0%';
  const v = (part / whole) * 100;
  return `${v.toFixed(digits).replace('.', ',')}%`;
}
