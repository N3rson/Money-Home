import type { MonthKey } from '../model/types';

export const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
export const MONTHS_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
/** "w październiku" */
export const MONTHS_LOCATIVE = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];
/** "2 listopada" */
export const MONTHS_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export function monthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonth(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, month } = parseMonth(key);
  const idx = year * 12 + (month - 1) + n;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

export function diffMonths(a: MonthKey, b: MonthKey): number {
  const pa = parseMonth(a);
  const pb = parseMonth(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

export function currentMonth(now = new Date()): MonthKey {
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function monthsOfYear(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
}

export function monthName(key: MonthKey): string {
  return MONTHS[parseMonth(key).month - 1];
}

export function monthShort(key: MonthKey): string {
  return MONTHS_SHORT[parseMonth(key).month - 1];
}

export function monthLabel(key: MonthKey): string {
  const { year, month } = parseMonth(key);
  return `${MONTHS[month - 1]} ${year}`;
}

/** "gru 2055" */
export function monthShortYear(key: MonthKey): string {
  const { year, month } = parseMonth(key);
  return `${MONTHS_SHORT[month - 1].toLowerCase()} ${year}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const d = abs % 10;
  const dd = abs % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return few;
  return many;
}

/** 27 -> "2 lata 3 mies." */
export function durationLabel(months: number): string {
  const m = Math.max(0, Math.round(months));
  const y = Math.floor(m / 12);
  const r = m % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${plural(y, 'rok', 'lata', 'lat')}`);
  if (r || !y) parts.push(`${r} mies.`);
  return parts.join(' ');
}

export function dateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeLabel(ts: number, now = Date.now()): string {
  const diff = Math.round((now - ts) / 1000);
  if (diff < 45) return 'przed chwilą';
  if (diff < 3600) return `${Math.round(diff / 60)} min temu`;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return `dziś ${hh}:${mm}`;
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}, ${hh}:${mm}`;
}
