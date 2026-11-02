import { useMemo } from 'preact/hooks';
import { lensView, summarizeMonth, summarizeYear, overpaymentsByMonth, lastInstallment, billsToCopy, overpaymentsByPerson, liveEntries } from '../../model/calc';
import { mortgageStatus } from '../../model/mortgage';
import type { Household, MonthKey, Person } from '../../model/types';
import { currentMonth, monthName, MONTHS_LOCATIVE, parseMonth, monthShortYear, durationLabel, addMonths } from '../../lib/months';
import { formatPLN, percent } from '../../lib/money';
import { Hanko, HeroMoney, Money, MonthNav, SegBar, Segmented, type SegPart } from '../components';
import { Enso, MonthBars, PairBars, type Tone } from '../charts';
import { Icon } from '../icons';
import { setLens, setMonth, setTab, useStore, type Prefs } from '../../model/store';
import { openCopyBills } from '../sheets';

export function Home() {
  const h = useStore((s) => s.household);
  const month = useStore((s) => s.month);
  const lens = useStore((s) => s.prefs.lens);
  const { year } = parseMonth(month);
  const [a, b] = h.people;

  const lensOptions: { value: Prefs['lens']; label: string; swatch?: string }[] = [
    { value: 'all', label: 'Razem' },
    ...h.people.map((p) => ({ value: p.id, label: p.name, swatch: p.tone === 'indigo' ? 'var(--indigo)' : 'var(--clay)' })),
    { value: 'compare', label: 'Porównaj' },
  ];

  return (
    <div class="screen">
      <MonthNav month={month} onChange={setMonth} />
      <Segmented label="Czyje liczby" value={lens} options={lensOptions} onChange={setLens} ink />
      {lens === 'compare' && a && b ? <Compare h={h} month={month} a={a} b={b} /> : <LensSummary h={h} month={month} lens={lens === 'compare' ? 'all' : lens} year={year} />}
      <CurrentMonthNudge h={h} />
      <LoanTeaser h={h} />
    </div>
  );
}

function toneFor(h: Household, lens: string): Tone {
  if (lens === 'all') return 'neutral';
  return h.people.find((p) => p.id === lens)?.tone ?? 'neutral';
}

function LensSummary({ h, month, lens, year }: { h: Household; month: MonthKey; lens: string; year: number }) {
  const s = useMemo(() => summarizeMonth(h, month), [h, month]);
  const ys = useMemo(() => summarizeYear(h, year, lens), [h, year, lens]);
  const v = lensView(s, lens);
  const person = h.people.find((p) => p.id === lens);
  const tone = toneFor(h, lens);
  const strong = tone === 'neutral' ? 'var(--neutral-bar-strong)' : `var(--${tone})`;
  const loc = MONTHS_LOCATIVE[parseMonth(month).month - 1];

  const parts: SegPart[] =
    lens === 'all'
      ? [
          { key: 'bills', label: 'Opłaty stałe', value: v.bills, color: strong },
          { key: 'overpay', label: 'Nadpłaty kredytu', value: v.overpay, color: 'var(--moss)' },
          { key: 'exp', label: 'Wydatki', value: v.expenses, color: 'var(--oak)' },
          { key: 'left', label: 'Zostaje', value: Math.max(0, v.left), color: 'transparent', hollow: true },
        ]
      : [
          { key: 'bills', label: 'Połowa opłat', value: v.bills, color: strong },
          { key: 'overpay', label: 'Nadpłaty kredytu', value: v.overpay, color: 'var(--moss)' },
          { key: 'left', label: 'Zostaje', value: Math.max(0, v.left), color: 'transparent', hollow: true },
        ];

  const noData = s.entryCount === 0;
  const kept = v.income > 0 ? percent(Math.max(0, v.left), v.income) : null;

  return (
    <>
      <section class="card hero" aria-label="Bilans miesiąca">
        <div class="eyebrow">{lens === 'all' ? `Zostaje w ${loc}` : `${person?.name ?? ''}: zostaje po opłatach`}</div>
        <HeroMoney value={Math.round(v.left)} />
        <p class="hero-sub">
          {noData ? (
            <>Brak wpisów w tym miesiącu.</>
          ) : v.income > 0 ? (
            <>
              z <strong>{formatPLN(v.income)}</strong> dochodu{kept && <> · zostaje {kept}</>}
            </>
          ) : (
            <>Brak dochodów w tym miesiącu — dodaj je przyciskiem +.</>
          )}
        </p>
        {!noData && <SegBar parts={parts} label="Na co idzie dochód" />}
        {!noData && (
          <div class="breakdown">
            {parts.map((p) =>
              p.key === 'left' ? null : (
                <div class="breakdown-row" key={p.key}>
                  <span class="sw" style={{ background: p.color }} />
                  <span class="lbl">{p.label}</span>
                  <Money value={Math.round(p.value)} />
                </div>
              ),
            )}
            <div class="breakdown-row total">
              <span class="sw hollow" />
              <span class="lbl">Zostaje</span>
              <Money value={Math.round(v.left)} class={v.left < 0 ? 'neg' : ''} />
            </div>
            {lens !== 'all' && v.expenses > 0 && (
              <p class="hint" style={{ paddingTop: '8px' }}>
                Po połowie wspólnych wydatków ({formatPLN(Math.round(v.expenses))}): <strong class="num">{formatPLN(Math.round(v.leftAfterExpenses))}</strong>
              </p>
            )}
          </div>
        )}
      </section>

      <section class="section" aria-label={`Rok ${year}`}>
        <div class="section-head">
          <h2 class="section-title">Rok {year}</h2>
          <button class="link-btn" type="button" onClick={() => setTab('wpisy')}>
            Arkusz <Icon name="right" size={16} />
          </button>
        </div>
        <div class="stats">
          <div class="stat">
            <span class="label">Dochód</span>
            <span class="value num">{formatPLN(ys.total.income, { decimals: false, unit: false })}<span class="unit">zł</span></span>
            <span class="foot">śr. {formatPLN(ys.avgIncome, { decimals: false, unit: false })}/mies.</span>
          </div>
          <div class="stat">
            <span class="label">{lens === 'all' ? 'Wydano' : 'Opłaty'}</span>
            <span class="value num">{formatPLN(ys.total.out, { decimals: false, unit: false })}<span class="unit">zł</span></span>
            <span class="foot">nadpłaty {formatPLN(ys.total.overpay, { decimals: false, unit: false })}</span>
          </div>
          <div class="stat">
            <span class="label">Zostało</span>
            <span class={`value num ${ys.total.left < 0 ? 'neg' : ''}`}>{formatPLN(ys.total.left, { decimals: false, unit: false })}<span class="unit">zł</span></span>
            <span class="foot">śr. {formatPLN(ys.avgLeft, { decimals: false, unit: false })}/mies.</span>
          </div>
        </div>
        <div class="card">
          <MonthBars
            data={ys.months.map((m) => {
              const lv = lensView(m, lens);
              return { month: m.month, income: lv.income, out: lv.out };
            })}
            selected={month}
            onSelect={setMonth}
            tone={tone}
            outLabel={lens === 'all' ? 'Wydano' : 'Opłaty'}
          />
        </div>
      </section>
    </>
  );
}

function Compare({ h, month, a, b }: { h: Household; month: MonthKey; a: Person; b: Person }) {
  const { year } = parseMonth(month);
  const s = useMemo(() => summarizeMonth(h, month), [h, month]);
  const ya = useMemo(() => summarizeYear(h, year, a.id), [h, year, a.id]);
  const yb = useMemo(() => summarizeYear(h, year, b.id), [h, year, b.id]);
  const va = lensView(s, a.id);
  const vb = lensView(s, b.id);
  const ovp = overpaymentsByPerson(h);
  const contrib = (id: string) => (h.mortgage.contributions.find((c) => c.person === id)?.amount ?? 0) + (ovp[id] ?? 0);
  const ca = contrib(a.id);
  const cb = contrib(b.id);
  const loc = MONTHS_LOCATIVE[parseMonth(month).month - 1];

  const rows: [string, number, number, boolean?][] = [
    ['Dochód', va.income, vb.income],
    ['Połowa opłat', va.bills, vb.bills],
    ['Nadpłaty', va.overpay, vb.overpay],
    ['Zostaje', va.left, vb.left, true],
  ];

  return (
    <>
      <div class="compare-head">
        {[
          [a, va],
          [b, vb],
        ].map(([p, v]) => {
          const person = p as Person;
          const view = v as typeof va;
          return (
            <div class="person-card" key={person.id}>
              <div class="who">
                <Hanko person={person} />
                {person.name}
              </div>
              <div>
                <div class="eyebrow">Zostaje</div>
                <div class={`big num ${view.left < 0 ? 'neg' : ''}`}>{formatPLN(Math.round(view.left), { decimals: false })}</div>
                <div class="hint">z {formatPLN(view.income, { decimals: false })} dochodu</div>
              </div>
            </div>
          );
        })}
      </div>

      <section class="card" aria-label={`Porównanie w ${loc}`}>
        <div class="card-head">
          <div class="eyebrow">W {loc}</div>
        </div>
        <table class="cmp-table">
          <thead>
            <tr>
              <th scope="col">
                <span class="sr-only">Pozycja</span>
              </th>
              <th scope="col">{a.name}</th>
              <th scope="col">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, x, y, total]) => (
              <tr class={total ? 'total' : ''} key={label}>
                <td>{label}</td>
                <td class={x < 0 ? 'neg' : ''}>{x ? formatPLN(Math.round(x)) : '—'}</td>
                <td class={y < 0 ? 'neg' : ''}>{y ? formatPLN(Math.round(y)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {va.income + vb.income > 0 && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '14px' }}>
            <div class="section-head">
              <span class="hint">Udział w dochodzie domu</span>
              <span class="hint num">
                {percent(va.income, va.income + vb.income)} / {percent(vb.income, va.income + vb.income)}
              </span>
            </div>
            <SegBar
              tall
              label={`Udział w dochodzie: ${a.name} ${percent(va.income, va.income + vb.income)}, ${b.name} ${percent(vb.income, va.income + vb.income)}`}
              parts={[
                { key: 'a', label: a.name, value: va.income, color: 'var(--indigo)' },
                { key: 'b', label: b.name, value: vb.income, color: 'var(--clay)' },
              ]}
            />
          </div>
        )}
      </section>

      <section class="section" aria-label={`Rok ${year}`}>
        <div class="section-head">
          <h2 class="section-title">Dochody {year}</h2>
        </div>
        <div class="card">
          <table class="cmp-table" style={{ marginBottom: '14px' }}>
            <thead>
              <tr>
                <th scope="col">
                  <span class="sr-only">Pozycja</span>
                </th>
                <th scope="col">{a.name}</th>
                <th scope="col">{b.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Razem w roku</td>
                <td>{formatPLN(ya.total.income, { decimals: false })}</td>
                <td>{formatPLN(yb.total.income, { decimals: false })}</td>
              </tr>
              <tr>
                <td>Średnio / mies.</td>
                <td>{formatPLN(ya.avgIncome, { decimals: false })}</td>
                <td>{formatPLN(yb.avgIncome, { decimals: false })}</td>
              </tr>
              <tr class="total">
                <td>Zostało w roku</td>
                <td>{formatPLN(ya.total.left, { decimals: false })}</td>
                <td>{formatPLN(yb.total.left, { decimals: false })}</td>
              </tr>
            </tbody>
          </table>
          <PairBars
            data={ya.months.map((m, i) => ({ month: m.month, a: m.income[a.id] ?? 0, b: yb.months[i].income[b.id] ?? 0 }))}
            names={[a.name, b.name]}
            selected={month}
            onSelect={setMonth}
          />
        </div>
      </section>

      <section class="card" aria-label="Wkład w mieszkanie">
        <div class="card-head">
          <div class="eyebrow">Wkład w mieszkanie</div>
          <button class="link-btn" type="button" onClick={() => setTab('kredyt')}>
            Kredyt <Icon name="right" size={16} />
          </button>
        </div>
        <p class="hint" style={{ marginBottom: '10px' }}>
          Wkład własny i wszystkie nadpłaty kredytu
        </p>
        <SegBar
          tall
          label={`${a.name} ${formatPLN(ca)}, ${b.name} ${formatPLN(cb)}`}
          parts={[
            { key: 'a', label: a.name, value: ca, color: 'var(--indigo)' },
            { key: 'b', label: b.name, value: cb, color: 'var(--clay)' },
          ]}
        />
        <div class="breakdown" style={{ marginTop: '8px' }}>
          {[
            [a, ca],
            [b, cb],
          ].map(([p, v]) => (
            <div class="breakdown-row" key={(p as Person).id}>
              <span class="sw" style={{ background: (p as Person).tone === 'indigo' ? 'var(--indigo)' : 'var(--clay)' }} />
              <span class="lbl">
                {(p as Person).name} · {percent(v as number, ca + cb)}
              </span>
              <Money value={v as number} decimals="auto" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** When the current month still lacks income or bills, offer the shortcut. */
function CurrentMonthNudge({ h }: { h: Household }) {
  const month = useStore((s) => s.month);
  const now = currentMonth();
  const s = summarizeMonth(h, now);
  const copy = billsToCopy(h, now);
  if (month !== now && month > now) return null;
  const missingIncome = !s.hasIncome;
  if (!missingIncome && !copy.length) return null;
  const count = liveEntries(h).filter((e) => e.month === now).length;
  return (
    <section class="card flat" aria-label={`${monthName(now)} w toku`}>
      <div class="card-head" style={{ marginBottom: '8px' }}>
        <div class="eyebrow">{monthName(now)} w toku</div>
        <span class="tag">{count} {count === 1 ? 'wpis' : count >= 2 && count <= 4 ? 'wpisy' : 'wpisów'}</span>
      </div>
      <p class="soft" style={{ fontSize: '14px', marginBottom: '14px' }}>
        {missingIncome && copy.length ? 'Brakuje jeszcze dochodów i stałych opłat.' : missingIncome ? 'Brakuje jeszcze dochodów.' : 'Brakuje jeszcze stałych opłat.'}
      </p>
      <div class="btn-row">
        {copy.length > 0 && (
          <button class="btn secondary sm" type="button" onClick={() => openCopyBills(now)}>
            <Icon name="layers" size={18} /> Opłaty jak w {MONTHS_LOCATIVE[parseMonth(addMonths(now, -1)).month - 1]}
          </button>
        )}
        <button
          class="btn secondary sm"
          type="button"
          onClick={() => {
            setMonth(now);
            setTab('wpisy');
          }}
        >
          Zobacz {monthName(now).toLowerCase()}
        </button>
      </div>
    </section>
  );
}

function LoanTeaser({ h }: { h: Household }) {
  const m = h.mortgage;
  const st = useMemo(() => {
    if (!m.principal) return null;
    const asOf = lastInstallment(h, currentMonth())?.month ?? null;
    return mortgageStatus(m, overpaymentsByMonth(h), asOf);
  }, [h]);
  if (!st) return null;
  const down = m.contributions.reduce((x, c) => x + c.amount, 0);
  return (
    <button class="card" type="button" style={{ textAlign: 'left', display: 'grid', gap: '14px' }} onClick={() => setTab('kredyt')} aria-label="Kredyt — szczegóły">
      <div class="card-head" style={{ marginBottom: 0 }}>
        <div class="eyebrow">Kredyt hipoteczny</div>
        <Icon name="right" size={18} class="muted" />
      </div>
      <div class="enso-wrap" style={{ gridTemplateColumns: 'auto 1fr' }}>
        <Enso
          size={74}
          total={m.propertyValue || m.principal}
          label={`Mieszkanie spłacone w ${percent(st.ownedRatio, 1)}`}
          parts={[
            { value: down, color: 'var(--oak)' },
            { value: st.paidPrincipal, color: 'var(--moss)' },
          ]}
        >
          <strong class="num">{percent(st.ownedRatio, 1)}</strong>
        </Enso>
        <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
          <span class="soft" style={{ fontSize: '13px' }}>
            Do spłaty
          </span>
          <Money value={Math.round(st.balance)} decimals={false} />
          <span class="hint">
            Koniec: {monthShortYear(st.actual.endMonth)}
            {st.savedMonths > 0 && <> · nadpłaty skróciły o {durationLabel(st.savedMonths)}</>}
          </span>
        </div>
      </div>
    </button>
  );
}
