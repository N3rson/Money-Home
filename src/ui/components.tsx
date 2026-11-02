import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { moneyParts } from '../lib/money';
import { addMonths, monthLabel, parseMonth } from '../lib/months';
import type { MonthKey, Person } from '../model/types';
import { Icon } from './icons';

/** 12 345,67 zł with the grosze and unit set quieter. */
export function Money({ value, plus, class: cls, unit = true, decimals = true }: { value: number; plus?: boolean; class?: string; unit?: boolean; decimals?: boolean | 'auto' }) {
  const { sign, int, dec } = moneyParts(value, { plus });
  const showDec = decimals === true || (decimals === 'auto' && dec !== '00');
  return (
    <span class={`money ${cls ?? ''}`}>
      {sign}
      {int}
      {showDec && <span class="dec">,{dec}</span>}
      {unit && <span class="unit">zł</span>}
    </span>
  );
}

export function HeroMoney({ value }: { value: number }) {
  const { sign, int, dec } = moneyParts(value);
  return (
    <div class={`hero-money ${value < 0 ? 'neg' : ''}`}>
      {sign}
      {int}
      <span class="dec">,{dec}</span>
      <span class="unit">zł</span>
    </div>
  );
}

export function Hanko({ person, size }: { person: Person | undefined; size?: 'sm' | 'lg' }) {
  const initial = (person?.name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span class={`hanko ${size ?? ''}`} data-tone={person?.tone ?? 'indigo'} aria-hidden="true">
      {initial}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ink,
  label,
}: {
  value: T;
  options: { value: T; label: ComponentChildren; swatch?: string }[];
  onChange: (v: T) => void;
  ink?: boolean;
  label: string;
}) {
  return (
    <div class={`seg ${ink ? 'ink' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.swatch && <span class="swatch" style={{ background: o.swatch }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  scroll,
  label,
}: {
  value: T;
  options: { value: T; label: ComponentChildren }[];
  onChange: (v: T) => void;
  scroll?: boolean;
  label: string;
}) {
  return (
    <div class={`chips ${scroll ? 'scroll' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" class="chip" key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MonthNav({ month, onChange, min, max, sub }: { month: MonthKey; onChange: (m: MonthKey) => void; min?: MonthKey; max?: MonthKey; sub?: string }) {
  const { year } = parseMonth(month);
  const label = monthLabel(month).split(' ')[0];
  return (
    <div class="month-nav">
      <button class="icon-btn" type="button" aria-label="Poprzedni miesiąc" disabled={!!min && month <= min} onClick={() => onChange(addMonths(month, -1))}>
        <Icon name="left" size={20} />
      </button>
      <div class="label" aria-live="polite">
        <strong>{label}</strong>
        <span>{sub ?? year}</span>
      </div>
      <button class="icon-btn" type="button" aria-label="Następny miesiąc" disabled={!!max && month >= max} onClick={() => onChange(addMonths(month, 1))}>
        <Icon name="right" size={20} />
      </button>
    </div>
  );
}

export interface SegPart {
  key: string;
  label: string;
  value: number;
  color: string;
  hollow?: boolean;
}

/** Thin segmented bar: one whole split into parts; the list beside it carries the figures. */
export function SegBar({ parts, tall, label }: { parts: SegPart[]; tall?: boolean; label: string }) {
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((a, p) => a + p.value, 0);
  return (
    <div class={`segbar ${tall ? 'tall' : ''}`} role="img" aria-label={label}>
      {total > 0 &&
        visible.map((p) => (
          <span
            key={p.key}
            title={p.label}
            style={{
              flexGrow: p.value / total,
              flexBasis: 0,
              background: p.hollow ? 'transparent' : p.color,
            }}
          />
        ))}
    </div>
  );
}

export function Sheet({ title, onClose, children, label }: { title: ComponentChildren; onClose: () => void; children: ComponentChildren; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // focus moves into the sheet for screen readers, but onto the dialog itself:
    // focusing an input would pop up the keyboard before the person chose a field
    const target = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
    if (target) setTimeout(() => target.focus({ preventScroll: true }), 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, []);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" tabIndex={-1} aria-label={label ?? (typeof title === 'string' ? title : undefined)} ref={ref}>
        <div class="sheet-grip" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn ghost" type="button" aria-label="Zamknij" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" class="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Mniej" onClick={() => onChange(Math.max(min, value - 1))}>
        <Icon name="left" size={18} />
      </button>
      <output>{value}</output>
      <button type="button" aria-label="Więcej" onClick={() => onChange(Math.min(max, value + 1))}>
        <Icon name="right" size={18} />
      </button>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} size={30} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Width of an element, kept current with ResizeObserver. */
export function useWidth<T extends HTMLElement>(fallback = 340): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function ProtoBanner({ children }: { children: ComponentChildren }) {
  if (!__PROTOTYPE__) return null;
  return (
    <div class="proto-banner">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Field({ label, children, hint, error, id }: { label: string; children: ComponentChildren; hint?: ComponentChildren; error?: string | null; id?: string }) {
  return (
    <div class="field">
      {id ? <label for={id}>{label}</label> : <span class="label">{label}</span>}
      {children}
      {error ? <span class="error">{error}</span> : hint ? <span class="hint">{hint}</span> : null}
    </div>
  );
}

export type InputEvent = JSX.TargetedEvent<HTMLInputElement, Event>;
