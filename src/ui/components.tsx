import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { moneyParts } from '../lib/money';
import { MONTHS, MONTHS_SHORT, addMonths, currentMonth, monthKey, monthLabel, parseMonth } from '../lib/months';
import type { MonthKey, Person } from '../model/types';
import { useStore } from '../model/store';
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

/** Month name between arrows; tapping the name opens a year + 12 months picker. */
export function MonthNav({ month, onChange, min, max, sub }: { month: MonthKey; onChange: (m: MonthKey) => void; min?: MonthKey; max?: MonthKey; sub?: string }) {
  const { year } = parseMonth(month);
  const label = monthLabel(month).split(' ')[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // close the picker, not the sheet around it
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div class="month-nav" ref={ref}>
      <button class="icon-btn" type="button" aria-label="Poprzedni miesiąc" disabled={!!min && month <= min} onClick={() => onChange(addMonths(month, -1))}>
        <Icon name="left" size={20} />
      </button>
      <button class="label" type="button" aria-live="polite" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <strong>{label}</strong>
        <span>
          {sub ?? year}
          <Icon name="down" size={13} class={`nav-caret${open ? ' open' : ''}`} />
        </span>
      </button>
      <button class="icon-btn" type="button" aria-label="Następny miesiąc" disabled={!!max && month >= max} onClick={() => onChange(addMonths(month, 1))}>
        <Icon name="right" size={20} />
      </button>
      {open && (
        <MonthPicker
          month={month}
          min={min}
          max={max}
          onPick={(m) => {
            setOpen(false);
            if (m !== month) onChange(m);
          }}
        />
      )}
    </div>
  );
}

function MonthPicker({ month, min, max, onPick }: { month: MonthKey; min?: MonthKey; max?: MonthKey; onPick: (m: MonthKey) => void }) {
  const h = useStore((s) => s.household);
  const [year, setYear] = useState(parseMonth(month).year);
  // a dot marks months with real amounts (planned 0 zł bills alone do not count)
  const marks = useMemo(() => new Set(h.entries.filter((e) => !e.deleted && e.amount > 0).map((e) => e.month)), [h]);
  const now = currentMonth();
  return (
    <div class="month-picker" role="dialog" aria-label="Wybierz miesiąc">
      <div class="mp-head">
        <button class="icon-btn ghost" type="button" aria-label="Poprzedni rok" onClick={() => setYear(year - 1)}>
          <Icon name="left" size={18} />
        </button>
        <strong>{year}</strong>
        <button class="icon-btn ghost" type="button" aria-label="Następny rok" onClick={() => setYear(year + 1)}>
          <Icon name="right" size={18} />
        </button>
      </div>
      <div class="mp-grid">
        {MONTHS_SHORT.map((name, i) => {
          const key = monthKey(year, i + 1);
          const disabled = (!!min && key < min) || (!!max && key > max);
          return (
            <button
              key={key}
              type="button"
              class={`mp-cell${key === month ? ' sel' : ''}${key === now ? ' now' : ''}`}
              aria-pressed={key === month}
              aria-label={`${MONTHS[i]} ${year}${key === now ? ', bieżący miesiąc' : ''}`}
              disabled={disabled}
              onClick={() => onPick(key)}
            >
              {name}
              {marks.has(key) && <i class="mp-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Swipe left/right to change month. The neighbouring months are drawn on both
 * sides and follow the finger, so the next card is visible before the swipe
 * ends. Vertical scrolling stays native (touch-action: pan-y).
 */
export function MonthSwiper({ month, onChange, render, label }: { month: MonthKey; onChange: (m: MonthKey) => void; render: (m: MonthKey) => ComponentChildren; label?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; dx: number; axis: 'x' | 'y' | null } | null>(null);
  const dragged = useRef(false);
  const busy = useRef(false);

  const move = (px: number, ms: number) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none';
    el.style.transform = px ? `translate3d(${px}px, 0, 0)` : '';
  };

  // the new month is in the middle pane: snap back without animation
  useLayoutEffect(() => {
    move(0, 0);
    busy.current = false;
  }, [month]);

  const onDown = (e: PointerEvent) => {
    if (busy.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, axis: null };
    dragged.current = false;
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (d.axis === 'x') {
        try {
          wrap.current?.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety */
        }
      }
    }
    if (d.axis !== 'x') return;
    dragged.current = true;
    d.dx = dx;
    move(dx, 0);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== 'x') return;
    const w = wrap.current?.clientWidth ?? 360;
    const speed = Math.abs(d.dx) / Math.max(1, performance.now() - d.t); // px per ms
    const go = Math.abs(d.dx) > w * 0.25 || (speed > 0.45 && Math.abs(d.dx) > 30);
    if (!go) {
      move(0, 220);
      return;
    }
    const dir = d.dx < 0 ? 1 : -1;
    busy.current = true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onChange(addMonths(month, dir));
      return;
    }
    move(-dir * w, 260);
    window.setTimeout(() => onChange(addMonths(month, dir)), 260);
  };
  const onCancel = () => {
    if (drag.current?.axis === 'x') move(0, 200);
    drag.current = null;
  };

  const side = { 'aria-hidden': 'true', inert: true } as Record<string, unknown>;
  return (
    <div
      class="swiper"
      ref={wrap}
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onClickCapture={(e) => {
        // a swipe that ends on a button must not press it
        if (dragged.current) {
          e.preventDefault();
          e.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      <div class="swiper-track" ref={track}>
        <div class="swiper-pane prev" {...side}>
          {render(addMonths(month, -1))}
        </div>
        <div class="swiper-pane">{render(month)}</div>
        <div class="swiper-pane next" {...side}>
          {render(addMonths(month, 1))}
        </div>
      </div>
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
