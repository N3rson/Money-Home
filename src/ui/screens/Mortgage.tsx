import { useMemo, useState } from 'preact/hooks';
import { lastInstallment, overpaymentsByMonth, overpaymentsByPerson, liveEntries } from '../../model/calc';
import { mortgageStatus, overpayScenario } from '../../model/mortgage';
import type { MortgageParams } from '../../model/types';
import { useStore } from '../../model/store';
import { formatPLN, parseAmount, percent } from '../../lib/money';
import { currentMonth, durationLabel, monthShortYear, plural } from '../../lib/months';
import { Empty, Hanko, Money, Segmented } from '../components';
import { BalanceChart, Enso } from '../charts';
import { Icon } from '../icons';
import { openMortgage } from '../sheets';

const PRESETS = [0, 100000, 250000, 500000];

export function Mortgage() {
  const h = useStore((s) => s.household);
  const m = h.mortgage;
  const recorded = useMemo(() => overpaymentsByMonth(h), [h]);
  const last = lastInstallment(h, currentMonth());
  const asOf = last?.month ?? null;
  const st = useMemo(() => (m.principal ? mortgageStatus(m, recorded, asOf) : null), [m, recorded, asOf]);

  if (!st) {
    return (
      <div class="screen">
        <div class="screen-head">
          <h1 class="screen-title">Kredyt</h1>
        </div>
        <div class="card">
          <Empty icon="loan" title="Dodaj swój kredyt">
            <span>Kwota, oprocentowanie i liczba rat wystarczą, żeby policzyć efekt nadpłat.</span>
            <button class="btn primary sm" type="button" style={{ marginTop: '6px' }} onClick={openMortgage}>
              Uzupełnij parametry
            </button>
          </Empty>
        </div>
      </div>
    );
  }

  const down = m.contributions.reduce((a, c) => a + c.amount, 0);
  const totalOverpaid = [...recorded.values()].reduce((a, b) => a + b, 0);
  const planned = monthShortYear(st.baseline.endMonth);

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Kredyt</h1>
      </div>

      {!m.confirmed && (
        <button class="note-card warn" type="button" style={{ textAlign: 'left', width: '100%' }} onClick={openMortgage}>
          <Icon name="alert" size={20} />
          <span>
            <strong>Oprocentowanie {String(m.annualRate).replace('.', ',')}% i {m.termMonths} rat to szacunek</strong> odtworzony z raty w arkuszu. Uzupełnij dane z umowy, żeby wyliczenia były dokładne.
          </span>
        </button>
      )}

      <section class="card" aria-label="Stan kredytu" style={{ display: 'grid', gap: '16px' }}>
        <div class="enso-wrap">
          <Enso
            total={m.propertyValue || m.principal}
            label={`Spłacone: ${percent(st.ownedRatio, 1, 1)} mieszkania`}
            parts={[
              { value: down, color: 'var(--oak)' },
              { value: st.paidPrincipal, color: 'var(--moss)' },
            ]}
          >
            <strong class="num">{percent(st.ownedRatio, 1, 1)}</strong>
            <span>
              mieszkania
              <br />
              jest Wasze
            </span>
          </Enso>
          <div style={{ display: 'grid', gap: '10px', minWidth: 0 }}>
            <div>
              <div class="eyebrow">
                Do spłaty{!m.balance && <span class="tag" style={{ letterSpacing: 0, textTransform: 'none' }}>szacunek</span>}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>
                <Money value={Math.round(st.balance)} decimals={false} />
              </div>
            </div>
            <div class="hint">
              {last ? 'Ostatnia rata' : 'Rata'}: <strong class="num" style={{ color: 'var(--ink)' }}>{formatPLN(last?.amount ?? st.nextPayment)}</strong>
              <br />
              Koniec: <strong style={{ color: 'var(--ink)' }}>{monthShortYear(st.actual.endMonth)}</strong>
              {st.savedMonths > 0 && <> (planowo {planned})</>}
            </div>
          </div>
        </div>
        <div class="breakdown">
          <div class="breakdown-row">
            <span class="sw" style={{ background: 'var(--oak)' }} />
            <span class="lbl">Wkład własny</span>
            <Money value={down} decimals="auto" />
          </div>
          <div class="breakdown-row">
            <span class="sw" style={{ background: 'var(--moss)' }} />
            <span class="lbl">
              Spłacony kapitał · {st.paidInstallments} {plural(st.paidInstallments, 'rata', 'raty', 'rat')}
            </span>
            <Money value={Math.round(st.paidPrincipal)} />
          </div>
          <div class="breakdown-row">
            <span class="sw hollow" />
            <span class="lbl">Pozostało do spłaty</span>
            <Money value={Math.round(st.balance)} />
          </div>
        </div>
      </section>

      {totalOverpaid > 0 && (
        <section class="card flat" aria-label="Efekt dotychczasowych nadpłat">
          <div class="eyebrow" style={{ marginBottom: '10px' }}>
            Nadpłaty do tej pory
          </div>
          <div class="facts">
            <div class="fact">
              <span class="label">Nadpłaciliście</span>
              <span class="value num">{formatPLN(totalOverpaid, { decimals: 'auto' })}</span>
            </div>
            <div class="fact">
              <span class="label">{m.overpayEffect === 'shorten' ? 'Krócej o' : 'Rata niższa'}</span>
              <span class="value">{m.overpayEffect === 'shorten' ? durationLabel(st.savedMonths) : formatPLN(Math.max(0, (st.baseline.rows[st.paidInstallments]?.payment ?? 0) - st.nextPayment))}</span>
            </div>
            <div class="fact" style={{ gridColumn: '1 / -1' }}>
              <span class="label">Mniej odsetek do zapłacenia</span>
              <span class="value num pos">{formatPLN(Math.round(st.savedInterest), { decimals: false })}</span>
              <span class="foot">Każda złotówka nadpłaty dziś oszczędza odsetki przez wszystkie kolejne lata.</span>
            </div>
          </div>
        </section>
      )}

      <Simulator m={m} recorded={recorded} />

      <Ownership />

      <section class="section" aria-label="Parametry kredytu">
        <div class="section-head">
          <h2 class="section-title">Parametry</h2>
          <button class="link-btn" type="button" onClick={openMortgage}>
            <Icon name="edit" size={16} /> Edytuj
          </button>
        </div>
        <div class="facts">
          <Fact label="Kwota kredytu" value={formatPLN(m.principal, { decimals: 'auto' })} />
          <Fact label="Oprocentowanie" value={`${String(m.annualRate).replace('.', ',')}%`} foot={m.rateFixedUntil ? `stałe do ${monthShortYear(m.rateFixedUntil)}` : m.confirmed ? 'z umowy' : 'szacunek'} />
          <Fact label="Liczba rat" value={`${m.termMonths}`} foot={durationLabel(m.termMonths)} />
          <Fact label="Pierwsza rata" value={monthShortYear(m.firstPayment)} />
          <Fact label="Raty" value={m.kind === 'annuity' ? 'Równe' : 'Malejące'} />
          <Fact label="Nadpłata" value={m.overpayEffect === 'shorten' ? 'Skraca okres' : 'Obniża ratę'} />
          {m.balance && <Fact label="Saldo z banku" value={formatPLN(m.balance.amount)} foot={`po racie: ${monthShortYear(m.balance.month)}${m.balance.remaining ? ` · ${m.balance.remaining} rat` : ''}`} />}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <div class="fact">
      <span class="label">{label}</span>
      <span class="value num">{value}</span>
      {foot && <span class="foot">{foot}</span>}
    </div>
  );
}

function Simulator({ m, recorded }: { m: MortgageParams; recorded: Map<string, number> }) {
  const h = useStore((s) => s.household);
  const lastOver = useMemo(() => {
    const ovp = liveEntries(h).filter((e) => e.type === 'overpayment');
    if (!ovp.length) return 100000;
    const latest = ovp.reduce((a, e) => (e.month > a ? e.month : a), ovp[0].month);
    return ovp.filter((e) => e.month === latest).reduce((a, e) => a + e.amount, 0);
  }, [h]);
  const [monthly, setMonthly] = useState(Math.min(1000000, Math.round(lastOver / 10000) * 10000));
  const [onceText, setOnceText] = useState('');
  const [effect, setEffect] = useState<MortgageParams['overpayEffect']>(m.overpayEffect);
  const once = parseAmount(onceText) ?? 0;
  const from = currentMonth();

  const base = useMemo(() => overpayScenario(m, recorded, from, 0, 0, effect), [m, recorded, effect]);
  const sc = useMemo(() => overpayScenario(m, recorded, from, monthly, once, effect), [m, recorded, monthly, once, effect]);
  const presets = useMemo(() => PRESETS.map((p) => ({ p, r: overpayScenario(m, recorded, from, p, 0, effect) })), [m, recorded, effect]);
  const fill = `${(monthly / 1000000) * 100}%`;
  // installments still ahead (the bank app counts these)
  const paid = base.schedule.rows.filter((r) => r.month < from).length;
  const anything = monthly > 0 || once > 0;

  return (
    <section class="section" aria-label="Symulator nadpłat">
      <div class="section-head">
        <h2 class="section-title">Symulator nadpłat</h2>
      </div>
      <div class="card" style={{ display: 'grid', gap: '16px' }}>
        <div class="field">
          <label for="sim-monthly" class="label">
            Nadpłata co miesiąc, od {monthShortYear(from)}
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em' }} class="num">
              {formatPLN(monthly, { decimals: false, unit: false })}
            </span>
            <span class="muted">zł / mies.</span>
          </div>
          <input
            id="sim-monthly"
            class="range"
            type="range"
            min={0}
            max={1000000}
            step={10000}
            value={monthly}
            style={{ '--fill': fill } as Record<string, string>}
            onInput={(e) => setMonthly(Number((e.target as HTMLInputElement).value))}
          />
          <div class="chips">
            {PRESETS.map((p) => (
              <button type="button" class="chip" key={p} aria-pressed={monthly === p} onClick={() => setMonthly(p)}>
                {p === 0 ? 'Bez' : formatPLN(p, { decimals: false })}
              </button>
            ))}
          </div>
        </div>
        <div class="row-inline">
          <div class="field">
            <label for="sim-once" class="label">
              Jednorazowo teraz
            </label>
            <input id="sim-once" class="input num" inputMode="decimal" placeholder="np. 20 000" value={onceText} onInput={(e) => setOnceText((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <span class="label">Po nadpłacie</span>
            <Segmented
              label="Efekt nadpłaty"
              value={effect}
              onChange={setEffect}
              options={[
                { value: 'shorten', label: 'Krócej' },
                { value: 'lower', label: 'Niższa rata' },
              ]}
            />
          </div>
        </div>

        <div class="facts" aria-live="polite">
          <div class="fact">
            <span class="label">Koniec spłaty</span>
            <span class="value">{monthShortYear(sc.endMonth)}</span>
            <span class="foot">{anything ? `zamiast ${monthShortYear(base.endMonth)}` : 'jak teraz'}</span>
          </div>
          <div class="fact">
            <span class="label">{effect === 'shorten' ? 'Szybciej o' : 'Nowa rata'}</span>
            <span class="value">{effect === 'shorten' ? (sc.savedMonths ? durationLabel(sc.savedMonths) : '—') : formatPLN(sc.newPayment)}</span>
            <span class="foot">{effect === 'shorten' ? `zostanie ${sc.schedule.months - paid} rat zamiast ${base.schedule.months - paid}` : `zamiast ${formatPLN(base.newPayment)}`}</span>
          </div>
          <div class="fact" style={{ gridColumn: '1 / -1' }}>
            <span class="label">Mniej odsetek</span>
            <span class={`value num ${sc.savedInterest > 0 ? 'pos' : ''}`}>{formatPLN(Math.round(sc.savedInterest), { decimals: false })}</span>
            <span class="foot">
              {anything
                ? `Nadpłacicie łącznie ${formatPLN(Math.round(sc.schedule.totalOverpay - base.schedule.totalOverpay), { decimals: false })}; odsetki spadną z ${formatPLN(Math.round(base.schedule.totalInterest), { decimals: false })} do ${formatPLN(Math.round(sc.schedule.totalInterest), { decimals: false })}.`
                : `Odsetki do końca kredytu: ${formatPLN(Math.round(base.schedule.totalInterest), { decimals: false })} (od początku).`}
            </span>
          </div>
        </div>

        <BalanceChart
          start={m.firstPayment}
          principal={m.principal}
          series={[
            { key: 'now', label: 'Obecny plan', color: 'var(--ink-3)', values: base.schedule.rows.map((r) => r.balance) },
            ...(anything ? [{ key: 'sim', label: `Z nadpłatą ${formatPLN(monthly, { decimals: false })}/mies.${once ? ' + jednorazowo' : ''}`, color: 'var(--moss)', emphasis: true, values: sc.schedule.rows.map((r) => r.balance) }] : []),
          ]}
        />

        <table class="cmp-table" aria-label="Porównanie nadpłat">
          <thead>
            <tr>
              <th scope="col">Co miesiąc</th>
              <th scope="col">Koniec</th>
              <th scope="col">{effect === 'shorten' ? 'Szybciej' : 'Rata'}</th>
              <th scope="col">Oszczędność</th>
            </tr>
          </thead>
          <tbody>
            {presets.map(({ p, r }) => (
              <tr key={p} class={p === monthly && !once ? 'total' : ''}>
                <td>{p ? formatPLN(p, { decimals: false }) : 'bez nadpłat'}</td>
                <td>{monthShortYear(r.endMonth)}</td>
                <td>{effect === 'shorten' ? (r.savedMonths ? durationLabel(r.savedMonths) : '—') : formatPLN(r.newPayment, { decimals: false })}</td>
                <td>{r.savedInterest ? formatPLN(Math.round(r.savedInterest), { decimals: false }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="hint">
          {m.rateFixedUntil
            ? `Wyliczenia zakładają ${String(m.annualRate).replace('.', ',')}% do końca spłaty. Stopa jest stała do ${monthShortYear(m.rateFixedUntil)}; potem bank ustali nową, więc dalsze lata to dobry kierunek, nie wynik co do złotówki.`
            : 'Wyliczenia zakładają niezmienne oprocentowanie. Przy zmiennym (WIBOR) traktuj je jako dobry kierunek, nie wynik co do złotówki.'}
        </p>
      </div>
    </section>
  );
}

function Ownership() {
  const h = useStore((s) => s.household);
  const m = h.mortgage;
  const ovp = overpaymentsByPerson(h);
  const rows = h.people.map((p) => {
    const own = m.contributions.find((c) => c.person === p.id)?.amount ?? 0;
    return { p, own, over: ovp[p.id] ?? 0, total: own + (ovp[p.id] ?? 0) };
  });
  const sum = rows.reduce((a, r) => a + r.total, 0);
  const down = m.contributions.reduce((a, c) => a + c.amount, 0);
  return (
    <section class="section" aria-label="Mieszkanie i wkład">
      <div class="section-head">
        <h2 class="section-title">Mieszkanie</h2>
      </div>
      <div class="facts">
        <Fact label="Wartość" value={formatPLN(m.propertyValue, { decimals: 'auto' })} />
        <Fact label="Kredyt" value={formatPLN(m.principal, { decimals: 'auto' })} foot={m.propertyValue ? `${percent(m.principal, m.propertyValue)} wartości` : undefined} />
      </div>
      <div class="card">
        <div class="eyebrow" style={{ marginBottom: '12px' }}>
          Wkład + nadpłaty
        </div>
        <table class="cmp-table">
          <thead>
            <tr>
              <th scope="col">
                <span class="sr-only">Osoba</span>
              </th>
              <th scope="col">Wkład</th>
              <th scope="col">Nadpłaty</th>
              <th scope="col">Razem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Hanko person={r.p} size="sm" />
                    {r.p.name}
                  </span>
                </td>
                <td>{formatPLN(r.own, { decimals: false, unit: false })}</td>
                <td>{r.over ? formatPLN(r.over, { decimals: false, unit: false }) : '—'}</td>
                <td>{formatPLN(r.total, { decimals: false, unit: false })}</td>
              </tr>
            ))}
            <tr class="total">
              <td>Razem</td>
              <td>{formatPLN(down, { decimals: false, unit: false })}</td>
              <td>{formatPLN(sum - down, { decimals: false, unit: false })}</td>
              <td>{formatPLN(sum, { decimals: false, unit: false })}</td>
            </tr>
          </tbody>
        </table>
        {sum > 0 && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '14px' }}>
            <div class="section-head">
              <span class="hint">Udział w finansowaniu</span>
              <span class="hint num">{rows.map((r) => `${r.p.name} ${percent(r.total, sum)}`).join(' · ')}</span>
            </div>
            <div class="segbar tall" role="img" aria-label={rows.map((r) => `${r.p.name} ${percent(r.total, sum)}`).join(', ')}>
              {rows.map((r) => (
                <span key={r.p.id} style={{ flexGrow: r.total / sum, flexBasis: 0, background: r.p.tone === 'indigo' ? 'var(--indigo)' : 'var(--clay)' }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
