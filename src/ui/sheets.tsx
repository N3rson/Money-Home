import { useEffect, useMemo, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import type { Entry, EntryType, MonthKey, MortgageParams, Person } from '../model/types';
import { INCOME_CATEGORIES, TYPE_LABEL } from '../model/defaults';
import { liveEntries, billsToCopy } from '../model/calc';
import {
  addBillCategory,
  addEntries,
  deleteEntries,
  renameBillCategory,
  setCategoryArchived,
  setMe,
  setMonth as setAppMonth,
  toast,
  updateEntry,
  updateMortgage,
  updatePeople,
  useStore,
  type EntryDraft,
} from '../model/store';
import { amountInputValue, formatPLN, parseAmount } from '../lib/money';
import { addMonths, currentMonth, monthLabel, MONTHS_LOCATIVE, parseMonth } from '../lib/months';
import { Chips, Field, Hanko, MonthNav, Segmented, Sheet, Stepper, Switch } from './components';
import { Icon, billIcon } from './icons';

// ------------------------------------------------------------------ host

type SheetState =
  | { kind: 'entry'; id?: string; type?: EntryType; month?: MonthKey }
  | { kind: 'copyBills'; month: MonthKey }
  | { kind: 'invite' }
  | { kind: 'join' }
  | { kind: 'mortgage' }
  | { kind: 'people' }
  | { kind: 'categories' };

let current: SheetState | null = null;
const subs = new Set<() => void>();
function setSheet(s: SheetState | null) {
  current = s;
  subs.forEach((f) => f());
}
export const closeSheet = () => setSheet(null);
export const openEntry = (opts: { id?: string; type?: EntryType; month?: MonthKey } = {}) => setSheet({ kind: 'entry', ...opts });
export const openCopyBills = (month: MonthKey) => setSheet({ kind: 'copyBills', month });
export const openInvite = () => setSheet({ kind: 'invite' });
export const openJoin = () => setSheet({ kind: 'join' });
export const openMortgage = () => setSheet({ kind: 'mortgage' });
export const openPeople = () => setSheet({ kind: 'people' });
export const openCategories = () => setSheet({ kind: 'categories' });

export function SheetHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  if (!current) return null;
  switch (current.kind) {
    case 'entry':
      return <EntryEditor key={current.id ?? 'new'} id={current.id} type={current.type} month={current.month} />;
    case 'copyBills':
      return <CopyBills month={current.month} />;
    case 'invite':
      return <Invite />;
    case 'join':
      return <Join />;
    case 'mortgage':
      return <MortgageEditor />;
    case 'people':
      return <PeopleEditor />;
    case 'categories':
      return <CategoriesEditor />;
  }
}

// ------------------------------------------------------------------ entry editor

const TYPES: EntryType[] = ['income', 'bill', 'expense', 'overpayment'];

function lastAmount(entries: Entry[], match: (e: Entry) => boolean, before: MonthKey): number | null {
  let best: Entry | null = null;
  for (const e of entries) {
    if (match(e) && e.month <= before && (!best || e.month > best.month || (e.month === best.month && e.updatedAt > best.updatedAt))) best = e;
  }
  return best ? best.amount : null;
}

function EntryEditor({ id, type: initialType, month: initialMonth }: { id?: string; type?: EntryType; month?: MonthKey }) {
  const h = useStore((s) => s.household);
  const me = useStore((s) => s.prefs.me);
  const tab = useStore((s) => s.tab);
  const selectedMonth = useStore((s) => s.month);
  const existing = id ? h.entries.find((e) => e.id === id) : undefined;
  const live = liveEntries(h);
  const cats = h.billCategories.filter((c) => !c.archived || c.id === existing?.category);
  const defaultMonth = initialMonth ?? (tab === 'wpisy' ? selectedMonth : currentMonth());

  const [type, setType] = useState<EntryType>(existing?.type ?? initialType ?? 'expense');
  const [amount, setAmount] = useState(existing ? amountInputValue(existing.amount) : '');
  const [month, setMonthLocal] = useState<MonthKey>(existing?.month ?? defaultMonth);
  const [person, setPerson] = useState<string>(existing?.person ?? (existing?.type === 'expense' ? '' : me ?? h.people[0]?.id ?? ''));
  const [incomeCat, setIncomeCat] = useState(existing?.type === 'income' ? existing.category ?? 'base' : 'base');
  const [billCat, setBillCat] = useState(() => {
    if (existing?.type === 'bill') return existing.category ?? cats[0]?.id ?? '';
    const used = new Set(live.filter((e) => e.type === 'bill' && e.month === defaultMonth).map((e) => e.category));
    return cats.find((c) => !used.has(c.id))?.id ?? cats[0]?.id ?? '';
  });
  const [expensePayer, setExpensePayer] = useState<string>(existing?.type === 'expense' ? existing.person ?? '' : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState(10);
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [newCat, setNewCat] = useState<string | null>(null);

  const parsed = parseAmount(amount);
  const amountError = parsed === null ? 'Wpisz kwotę, np. 120,50' : parsed < 0 ? 'Kwota nie może być ujemna' : parsed === 0 && !(type === 'expense' && note.trim()) ? 'Kwota musi być większa od zera' : null;
  const titleError = type === 'expense' && !title.trim() ? 'Napisz, co to za wydatek' : null;
  const valid = !amountError && !titleError;

  const suggestion = useMemo(() => {
    if (existing) return null;
    if (type === 'income') return lastAmount(live, (e) => e.type === 'income' && e.person === person && e.category === incomeCat, month);
    if (type === 'bill') return lastAmount(live, (e) => e.type === 'bill' && e.category === billCat, month);
    if (type === 'overpayment') return lastAmount(live, (e) => e.type === 'overpayment' && e.person === person, month);
    return null;
  }, [type, person, incomeCat, billCat, month]);

  const draft = (): EntryDraft => {
    const base: EntryDraft = { type, month, amount: parsed ?? 0 };
    if (type === 'income') Object.assign(base, { person, category: incomeCat });
    if (type === 'overpayment') Object.assign(base, { person });
    if (type === 'bill') Object.assign(base, { category: billCat });
    if (type === 'expense') Object.assign(base, { title: title.trim(), person: expensePayer || undefined });
    if (note.trim()) base.note = note.trim();
    return base;
  };

  const save = (e: Event) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const d = draft();
    if (existing) {
      const patch: Partial<Entry> = { ...d, note: d.note ?? undefined, title: d.title ?? undefined, person: d.person ?? undefined, category: d.category ?? undefined };
      updateEntry(existing.id, patch);
      toast('Zapisano zmiany');
    } else if (type === 'expense' && installments && count > 1) {
      const sid = `s-${Date.now().toString(36)}`;
      addEntries(Array.from({ length: count }, (_, i) => ({ ...d, month: addMonths(month, i), series: { id: sid, index: i + 1, count } })));
      toast(`Dodano ${count} rat po ${formatPLN(parsed ?? 0)}`);
    } else {
      addEntries([d]);
      toast(`Dodano: ${TYPE_LABEL[type].toLowerCase()} ${formatPLN(parsed ?? 0)}`);
    }
    // show the month the entry landed in
    setAppMonth(month);
    closeSheet();
  };

  const remove = (all: boolean) => {
    if (!existing) return;
    const ids = all && existing.series ? live.filter((e) => e.series?.id === existing.series!.id).map((e) => e.id) : [existing.id];
    deleteEntries(ids, ids.length > 1 ? `Usunięto ${ids.length} raty` : 'Usunięto wpis');
    closeSheet();
  };

  const personOptions = h.people.map((p) => ({ value: p.id, label: p.name, swatch: p.tone === 'indigo' ? 'var(--indigo)' : 'var(--clay)' }));

  return (
    <Sheet title={existing ? `Edytuj: ${TYPE_LABEL[existing.type].toLowerCase()}` : 'Nowy wpis'} onClose={closeSheet}>
      <form onSubmit={save} style={{ display: 'grid', gap: '20px' }} noValidate>
        <Segmented
          label="Rodzaj wpisu"
          value={type}
          onChange={(t) => {
            setType(t);
            if ((t === 'income' || t === 'overpayment') && !person) setPerson(me ?? h.people[0]?.id ?? '');
          }}
          options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />

        <div class="field">
          <label for="amount" class="sr-only">
            Kwota
          </label>
          <div class="amount-field">
            <input
              id="amount"
              data-autofocus
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              aria-invalid={tried && !!amountError}
              onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
            />
            <span class="unit">zł{type === 'expense' && installments ? ' / mies.' : ''}</span>
          </div>
          {tried && amountError ? (
            <span class="error">{amountError}</span>
          ) : suggestion !== null && suggestion !== parsed ? (
            <div>
              <button type="button" class="chip dashed" onClick={() => setAmount(amountInputValue(suggestion))}>
                Jak ostatnio: {formatPLN(suggestion)}
              </button>
            </div>
          ) : (
            <span class="hint">Możesz wpisać działanie, np. 1200 + 349,90</span>
          )}
        </div>

        {(type === 'income' || type === 'overpayment') && (
          <Field label={type === 'income' ? 'Czyj dochód' : 'Kto nadpłacił'}>
            <Segmented label="Osoba" value={person} onChange={setPerson} options={personOptions} />
          </Field>
        )}

        {type === 'income' && (
          <Field label="Rodzaj">
            <Chips label="Rodzaj dochodu" value={incomeCat} onChange={setIncomeCat} options={INCOME_CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
        )}

        {type === 'bill' && (
          <Field label="Opłata" hint="Opłaty stałe dzielicie po połowie.">
            <div class="chips">
              {cats.map((c) => (
                <button type="button" key={c.id} class="chip" aria-pressed={billCat === c.id} onClick={() => setBillCat(c.id)}>
                  <Icon name={billIcon(c.id)} size={16} />
                  {c.name}
                </button>
              ))}
              {newCat === null ? (
                <button type="button" class="chip dashed" onClick={() => setNewCat('')}>
                  <Icon name="plus" size={16} /> Nowa
                </button>
              ) : (
                <span style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input class="input" placeholder="np. Woda" value={newCat} onInput={(e) => setNewCat((e.target as HTMLInputElement).value)} aria-label="Nazwa nowej opłaty" />
                  <button
                    type="button"
                    class="btn secondary sm"
                    style={{ height: '48px' }}
                    onClick={() => {
                      if (!newCat.trim()) return;
                      const cid = addBillCategory(newCat);
                      setBillCat(cid);
                      setNewCat(null);
                    }}
                  >
                    Dodaj
                  </button>
                </span>
              )}
            </div>
          </Field>
        )}

        {type === 'expense' && (
          <>
            <Field label="Co kupiliście" id="title" error={tried ? titleError : null}>
              <input id="title" class="input" placeholder="np. Lodówka + piekarnik" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} aria-invalid={tried && !!titleError} />
            </Field>
            <Field label="Kto płaci" hint={expensePayer ? 'Wydatek tylko tej osoby.' : 'Wspólny wydatek, liczony po połowie.'}>
              <Segmented label="Kto płaci" value={expensePayer} onChange={setExpensePayer} options={[{ value: '', label: 'Wspólnie' }, ...personOptions]} />
            </Field>
            {!existing && (
              <div class="field">
                <div class="toggle-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>Na raty</div>
                    <div class="hint">Doda ratę w każdym kolejnym miesiącu.</div>
                  </div>
                  <Switch checked={installments} onChange={setInstallments} label="Na raty" />
                </div>
                {installments && (
                  <div class="toggle-row">
                    <Stepper label="Liczba rat" value={count} min={2} max={60} onChange={setCount} />
                    <span class="hint num" style={{ textAlign: 'right' }}>
                      {count} × {formatPLN(parsed ?? 0)}
                      <br />
                      razem {formatPLN((parsed ?? 0) * count)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Field label={installments && type === 'expense' && !existing ? 'Pierwsza rata' : 'Miesiąc'}>
          <MonthNav month={month} onChange={setMonthLocal} />
        </Field>

        <Field label="Notatka (opcjonalnie)" id="note">
          <input id="note" class="input" placeholder={type === 'expense' ? 'np. 1500 zł, połowę dali rodzice' : 'np. wyrównanie za wrzesień'} value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
        </Field>

        {existing?.series && <p class="hint">Rata {existing.series.index} z {existing.series.count}. Zmiana dotyczy tylko tej raty.</p>}

        <div class="sheet-foot">
          <button class="btn primary block" type="submit">
            <Icon name="check" size={20} /> {existing ? 'Zapisz zmiany' : 'Dodaj'}
          </button>
          {existing && !confirm && (
            <button class="btn danger block" type="button" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={19} /> Usuń wpis
            </button>
          )}
          {existing && confirm && (
            <div class="confirm-box" role="alert">
              <strong>Usunąć ten wpis?</strong>
              <span class="hint">Przez kilka sekund możesz to cofnąć.</span>
              <div class="btn-row">
                <button class="btn secondary sm" type="button" onClick={() => setConfirm(false)}>
                  Anuluj
                </button>
                <button class="btn danger solid sm" type="button" onClick={() => remove(false)}>
                  {existing.series ? 'Tylko tę ratę' : 'Usuń'}
                </button>
              </div>
              {existing.series && (
                <button class="btn danger sm" type="button" onClick={() => remove(true)}>
                  Wszystkie raty ({live.filter((e) => e.series?.id === existing.series!.id).length})
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// ------------------------------------------------------------------ copy bills

function CopyBills({ month }: { month: MonthKey }) {
  const h = useStore((s) => s.household);
  const source = billsToCopy(h, month);
  const cats = Object.fromEntries(h.billCategories.map((c) => [c.id, c.name]));
  const [rows, setRows] = useState(() => source.map((e) => ({ category: e.category!, amount: amountInputValue(e.amount), on: true })));
  const prevLoc = source[0] ? MONTHS_LOCATIVE[parseMonth(source[0].month).month - 1] : '';
  const chosen = rows.filter((r) => r.on && parseAmount(r.amount));
  const total = chosen.reduce((a, r) => a + (parseAmount(r.amount) ?? 0), 0);

  const add = () => {
    addEntries(chosen.map((r) => ({ type: 'bill' as const, month, category: r.category, amount: parseAmount(r.amount)! })));
    setAppMonth(month);
    toast(`Dodano ${chosen.length} ${chosen.length === 1 ? 'opłatę' : chosen.length < 5 ? 'opłaty' : 'opłat'} · ${formatPLN(total)}`);
    closeSheet();
  };

  return (
    <Sheet title="Opłaty stałe" onClose={closeSheet}>
      <p class="soft">
        Kwoty jak w {prevLoc}. Popraw te, które się zmieniły, i dodaj wszystko naraz do: <strong>{monthLabel(month).toLowerCase()}</strong>.
      </p>
      <div class="card tight">
        {rows.map((r, i) => (
          <div class="row" key={r.category} style={{ gridTemplateColumns: 'auto minmax(0,1fr) 128px' }}>
            <Switch checked={r.on} label={cats[r.category] ?? r.category} onChange={(on) => setRows(rows.map((x, j) => (j === i ? { ...x, on } : x)))} />
            <div class="main">
              <span class="title">{cats[r.category] ?? r.category}</span>
            </div>
            <input
              class="input num"
              style={{ height: '42px', textAlign: 'right' }}
              inputMode="decimal"
              value={r.amount}
              aria-label={`Kwota: ${cats[r.category]}`}
              disabled={!r.on}
              onInput={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: (e.target as HTMLInputElement).value } : x)))}
            />
          </div>
        ))}
      </div>
      <button class="btn primary block" type="button" disabled={!chosen.length} onClick={add}>
        Dodaj {chosen.length} {chosen.length === 1 ? 'opłatę' : chosen.length < 5 ? 'opłaty' : 'opłat'} · {formatPLN(total)}
      </button>
    </Sheet>
  );
}

// ------------------------------------------------------------------ connect phones

function QR({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${svg.n + 4} ${svg.n + 4}`} role="img" aria-label="Kod QR zaproszenia" shape-rendering="crispEdges">
      <rect x={-2} y={-2} width={svg.n + 4} height={svg.n + 4} fill="#fbfaf7" />
      <path d={svg.d} fill="#23211e" />
    </svg>
  );
}

function demoInvite(): string {
  const payload = { v: 1, repo: 'N3rson/money-home-dane', file: 'budzet.json', token: 'PROTOTYP-BEZ-TOKENU' };
  return 'MH1.' + btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function Invite() {
  const code = useMemo(demoInvite, []);
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title="Połącz drugi telefon" onClose={closeSheet}>
      {__PROTOTYPE__ && (
        <div class="note-card warn">
          <Icon name="info" size={18} />
          <span>Prototyp: to przykładowy kod. W aplikacji zawiera dostęp do Waszego prywatnego pliku z budżetem.</span>
        </div>
      )}
      <div class="qr">
        <QR text={code} />
      </div>
      <ol class="steps">
        <li>
          <span>
            Na drugim telefonie zainstaluj <strong>Money Home</strong> (Android: plik APK, iPhone: Safari → Udostępnij → <strong>Do ekranu początkowego</strong>).
          </span>
        </li>
        <li>
          <span>
            Otwórz aplikację i wybierz <strong>Dołącz do domu</strong>.
          </span>
        </li>
        <li>
          <span>Zeskanuj ten kod albo wklej kod tekstowy poniżej. Od teraz oba telefony zapisują do jednego pliku.</span>
        </li>
      </ol>
      <div class="field">
        <span class="label">Kod tekstowy</span>
        <div class="code-box">{code}</div>
        <button
          class="btn secondary sm"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
              toast('Zaznacz kod i skopiuj go ręcznie');
            }
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Skopiowano' : 'Kopiuj kod'}
        </button>
        <span class="hint">Kod daje pełny dostęp do budżetu. Wyślij go tylko partnerowi/partnerce.</span>
      </div>
    </Sheet>
  );
}

function Join() {
  const h = useStore((s) => s.household);
  const me = useStore((s) => s.prefs.me);
  const [code, setCode] = useState('');
  const [who, setWho] = useState(me ?? h.people[0]?.id ?? '');
  const ok = /^MH1\.[A-Za-z0-9_-]{20,}$/.test(code.trim());
  return (
    <Sheet title="Dołącz do domu" onClose={closeSheet}>
      <p class="soft">Na telefonie, który już ma budżet: Więcej → Połącz drugi telefon. Potem zeskanuj kod albo wklej go tutaj.</p>
      <button class="btn secondary block" type="button" disabled={__PROTOTYPE__} onClick={() => toast('Skaner otworzy aparat')}>
        <Icon name="scan" size={20} /> Skanuj kod QR{__PROTOTYPE__ ? ' (w aplikacji)' : ''}
      </button>
      <Field label="Albo wklej kod" id="join-code" error={code && !ok ? 'To nie wygląda na kod Money Home (zaczyna się od MH1.)' : null}>
        <textarea id="join-code" class="input" placeholder="MH1.…" value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
      </Field>
      <Field label="Kim jesteś na tym telefonie?">
        <Segmented label="Kim jesteś" value={who} onChange={setWho} options={h.people.map((p) => ({ value: p.id, label: p.name }))} />
      </Field>
      <button
        class="btn primary block"
        type="button"
        disabled={!ok}
        onClick={() => {
          setMe(who);
          toast(__PROTOTYPE__ ? 'Prototyp: w aplikacji telefon połączy się z Waszym budżetem' : 'Połączono');
          closeSheet();
        }}
      >
        Dołącz
      </button>
    </Sheet>
  );
}

// ------------------------------------------------------------------ mortgage params

function MortgageEditor() {
  const h = useStore((s) => s.household);
  const m = h.mortgage;
  const [f, setF] = useState({
    propertyValue: amountInputValue(m.propertyValue),
    principal: amountInputValue(m.principal),
    rate: String(m.annualRate).replace('.', ','),
    term: String(m.termMonths),
    first: m.firstPayment,
    kind: m.kind,
    effect: m.overpayEffect,
    contributions: h.people.map((p) => amountInputValue(m.contributions.find((c) => c.person === p.id)?.amount ?? 0)),
    balanceOn: !!m.balance,
    balance: m.balance ? amountInputValue(m.balance.amount) : '',
    balanceMonth: m.balance?.month ?? addMonths(currentMonth(), -1),
    confirmed: m.confirmed,
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const rate = Number(f.rate.replace(',', '.'));
  const term = Number(f.term);
  const principal = parseAmount(f.principal);
  const errors = {
    principal: principal && principal > 0 ? null : 'Wpisz kwotę kredytu',
    rate: rate >= 0 && rate < 30 ? null : 'Wpisz oprocentowanie, np. 6,5',
    term: Number.isInteger(term) && term > 0 && term <= 600 ? null : 'Liczba rat: 1–600',
    balance: !f.balanceOn || (parseAmount(f.balance) ?? 0) > 0 ? null : 'Wpisz saldo z aplikacji banku',
  };
  const valid = Object.values(errors).every((e) => !e);
  const [tried, setTried] = useState(false);

  const save = (e: Event) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const patch: Partial<MortgageParams> = {
      propertyValue: parseAmount(f.propertyValue) ?? 0,
      principal: principal!,
      annualRate: rate,
      termMonths: term,
      firstPayment: f.first,
      kind: f.kind,
      overpayEffect: f.effect,
      contributions: h.people.map((p, i) => ({ person: p.id, amount: parseAmount(f.contributions[i]) ?? 0 })),
      balance: f.balanceOn ? { amount: parseAmount(f.balance)!, month: f.balanceMonth } : null,
      confirmed: f.confirmed,
    };
    updateMortgage(patch);
    toast('Zapisano parametry kredytu');
    closeSheet();
  };

  return (
    <Sheet title="Parametry kredytu" onClose={closeSheet}>
      <form onSubmit={save} style={{ display: 'grid', gap: '18px' }} noValidate>
        <p class="soft">Dane znajdziesz w umowie albo w aplikacji banku. Im dokładniejsze, tym trafniejsze wyliczenia nadpłat.</p>
        <div class="row-inline">
          <Field label="Kwota kredytu (zł)" id="m-principal" error={tried ? errors.principal : null}>
            <input id="m-principal" class="input num" inputMode="decimal" value={f.principal} onInput={(e) => set({ principal: (e.target as HTMLInputElement).value })} />
          </Field>
          <Field label="Wartość mieszkania" id="m-value">
            <input id="m-value" class="input num" inputMode="decimal" value={f.propertyValue} onInput={(e) => set({ propertyValue: (e.target as HTMLInputElement).value })} />
          </Field>
        </div>
        <div class="row-inline">
          <Field label="Oprocentowanie (%)" id="m-rate" error={tried ? errors.rate : null} hint="Marża + WIBOR, albo stała stopa">
            <input id="m-rate" class="input num" inputMode="decimal" value={f.rate} onInput={(e) => set({ rate: (e.target as HTMLInputElement).value })} />
          </Field>
          <Field label="Liczba rat" id="m-term" error={tried ? errors.term : null} hint={term > 0 ? `${Math.floor(term / 12)} lat${term % 12 ? ` i ${term % 12} mies.` : ''}` : undefined}>
            <input id="m-term" class="input num" inputMode="numeric" value={f.term} onInput={(e) => set({ term: (e.target as HTMLInputElement).value })} />
          </Field>
        </div>
        <Field label="Pierwsza rata">
          <MonthNav month={f.first} onChange={(first) => set({ first })} />
        </Field>
        <Field label="Rodzaj rat">
          <Segmented label="Rodzaj rat" value={f.kind} onChange={(kind) => set({ kind })} options={[{ value: 'annuity', label: 'Równe' }, { value: 'decreasing', label: 'Malejące' }]} />
        </Field>
        <Field label="Po nadpłacie bank" hint="To wybierasz przy zleceniu nadpłaty (albo ustala to umowa).">
          <Segmented label="Efekt nadpłaty" value={f.effect} onChange={(effect) => set({ effect })} options={[{ value: 'shorten', label: 'Skraca okres' }, { value: 'lower', label: 'Obniża ratę' }]} />
        </Field>
        <div class="field">
          <span class="label">Wkład własny</span>
          <div class="row-inline">
            {h.people.map((p, i) => (
              <div class="field" key={p.id}>
                <label for={`m-c-${p.id}`} class="hint">
                  {p.name}
                </label>
                <input
                  id={`m-c-${p.id}`}
                  class="input num"
                  inputMode="decimal"
                  value={f.contributions[i]}
                  onInput={(e) => set({ contributions: f.contributions.map((c, j) => (j === i ? (e.target as HTMLInputElement).value : c)) })}
                />
              </div>
            ))}
          </div>
        </div>
        <div class="field">
          <div class="toggle-row">
            <div>
              <div style={{ fontWeight: 600 }}>Saldo z banku</div>
              <div class="hint">Kapitał do spłaty po racie z wybranego miesiąca. Nadpisuje wyliczenia.</div>
            </div>
            <Switch checked={f.balanceOn} onChange={(balanceOn) => set({ balanceOn })} label="Saldo z banku" />
          </div>
          {f.balanceOn && (
            <>
              <input class="input num" inputMode="decimal" placeholder="np. 480 000" value={f.balance} aria-label="Saldo kapitału" aria-invalid={tried && !!errors.balance} onInput={(e) => set({ balance: (e.target as HTMLInputElement).value })} />
              {tried && errors.balance && <span class="error">{errors.balance}</span>}
              <MonthNav month={f.balanceMonth} onChange={(balanceMonth) => set({ balanceMonth })} sub="stan po racie z tego miesiąca" />
            </>
          )}
        </div>
        <div class="toggle-row">
          <div>
            <div style={{ fontWeight: 600 }}>Sprawdzone z umową</div>
            <div class="hint">Zdejmuje oznaczenie „szacunek”.</div>
          </div>
          <Switch checked={f.confirmed} onChange={(confirmed) => set({ confirmed })} label="Sprawdzone z umową" />
        </div>
        <button class="btn primary block" type="submit">
          <Icon name="check" size={20} /> Zapisz
        </button>
      </form>
    </Sheet>
  );
}

// ------------------------------------------------------------------ people & categories

function PeopleEditor() {
  const h = useStore((s) => s.household);
  const me = useStore((s) => s.prefs.me);
  const [names, setNames] = useState(h.people.map((p) => p.name));
  const [who, setWho] = useState(me ?? h.people[0]?.id ?? '');
  const valid = names.every((n) => n.trim().length > 0);
  return (
    <Sheet title="Domownicy" onClose={closeSheet}>
      {h.people.map((p, i) => (
        <Field label={i === 0 ? 'Pierwsza osoba' : 'Druga osoba'} id={`p-${p.id}`} key={p.id}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Hanko person={{ ...p, name: names[i] || '?' } as Person} />
            <input id={`p-${p.id}`} class="input" value={names[i]} onInput={(e) => setNames(names.map((n, j) => (j === i ? (e.target as HTMLInputElement).value : n)))} />
          </div>
        </Field>
      ))}
      <Field label="Ten telefon należy do" hint="Nowe dochody i nadpłaty podpowiedzą tę osobę, a wpisy dostaną jej pieczątkę.">
        <Segmented label="Ten telefon należy do" value={who} onChange={setWho} options={h.people.map((p, i) => ({ value: p.id, label: names[i] || p.name }))} />
      </Field>
      <button
        class="btn primary block"
        type="button"
        disabled={!valid}
        onClick={() => {
          updatePeople(h.people.map((p, i) => ({ ...p, name: names[i].trim() })));
          setMe(who);
          toast('Zapisano');
          closeSheet();
        }}
      >
        Zapisz
      </button>
    </Sheet>
  );
}

function CategoriesEditor() {
  const h = useStore((s) => s.household);
  const [name, setName] = useState('');
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of liveEntries(h)) if (e.type === 'bill' && e.category) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [h]);
  return (
    <Sheet title="Opłaty stałe" onClose={closeSheet}>
      <p class="soft">Zmień nazwę albo ukryj opłatę, której już nie płacicie. Historia zostaje.</p>
      <div class="card tight">
        {h.billCategories.map((c) => (
          <div class="row" key={c.id} style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
            <span class="glyph">
              <Icon name={billIcon(c.id)} size={17} />
            </span>
            <div class="main">
              <input
                class="input"
                style={{ height: '40px', border: 'none', background: 'transparent', padding: 0, opacity: c.archived ? 0.5 : 1 }}
                value={c.name}
                aria-label={`Nazwa: ${c.name}`}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v && v !== c.name) renameBillCategory(c.id, v);
                }}
              />
              <span class="sub">{counts[c.id] ?? 0} wpisów</span>
            </div>
            <button class="btn secondary sm" type="button" onClick={() => setCategoryArchived(c.id, !c.archived)}>
              {c.archived ? 'Przywróć' : 'Ukryj'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input class="input" placeholder="Nowa opłata, np. Woda" value={name} aria-label="Nowa opłata" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <button
          class="btn secondary"
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            addBillCategory(name);
            setName('');
          }}
        >
          Dodaj
        </button>
      </div>
    </Sheet>
  );
}
