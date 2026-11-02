import type { JSX } from 'preact';

const paths: Record<string, JSX.Element> = {
  home: (
    <>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" />
      <path d="M5.5 8.8V20h13V8.8" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.6" cy="6.5" r="1" />
      <circle cx="4.6" cy="12" r="1" />
      <circle cx="4.6" cy="17.5" r="1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  loan: (
    <>
      <path d="M3.5 11 12 4.5l8.5 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <circle cx="10" cy="12.6" r="1.1" />
      <circle cx="14" cy="16.6" r="1.1" />
      <path d="m14.6 12.2-5.2 4.8" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  left: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  right: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.8h5V7" />
      <path d="M6.5 7l.9 12.2h9.2L17.5 7" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
      <path d="m13.5 8.5 3 3" />
    </>
  ),
  sync: (
    <>
      <path d="M19.5 9A7.8 7.8 0 0 0 5.6 7.3L4 9" />
      <path d="M4 4.5V9h4.5" />
      <path d="M4.5 15a7.8 7.8 0 0 0 13.9 1.7L20 15" />
      <path d="M20 19.5V15h-4.5" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v1.5M14 20v-1" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 3.5 5.5 13.5h6l-1 7 7.5-10h-6z" />,
  wifi: (
    <>
      <path d="M3.5 9.5a12 12 0 0 1 17 0" />
      <path d="M6.5 12.8a7.7 7.7 0 0 1 11 0" />
      <path d="M9.5 16a3.4 3.4 0 0 1 5 0" />
      <circle cx="12" cy="19" r="0.6" />
    </>
  ),
  shield: <path d="M12 3.5 5 6.3v5.2c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.3z" />,
  building: (
    <>
      <rect x="5.5" y="3.5" width="13" height="17" rx="1" />
      <path d="M9 7.5h1.5M13.5 7.5H15M9 11h1.5M13.5 11H15M9 14.5h1.5M13.5 14.5H15M10.5 20.5v-2.5h3v2.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l-1 12h-11z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="10" cy="7" rx="5.5" ry="2.5" />
      <path d="M4.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
      <path d="M8.5 16.3c.5.1 1 .2 1.5.2 3 0 5.5-1.1 5.5-2.5" />
      <path d="M15.5 11.2c2.3.3 4 1.2 4 2.3v4c0 1.4-2.5 2.5-5.5 2.5-2.1 0-3.9-.5-4.9-1.3" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 4.5v12" />
      <path d="m6.5 11.5 5.5 5.5 5.5-5.5" />
      <path d="M5 20h14" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 19.5h18z" />
      <path d="M12 10v4.5M12 17v.4" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.7c1.9.6 3.1 2.2 3.5 4.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10.5 5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5v-11" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M3.5 10h17M3.5 14.5h17M9.5 5v14" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4.5h8l9 9-8 8z" />
      <circle cx="8" cy="9" r="1.3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4.5H15" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" />
      <path d="M4 12h16" />
    </>
  ),
  github: (
    <path d="M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.6-.2.6-.4v-1.6c-2.4.5-2.9-1-2.9-1-.4-1-1-1.3-1-1.3-.8-.5.1-.5.1-.5.9.1 1.3.9 1.3.9.8 1.3 2 1 2.5.7.1-.6.3-1 .6-1.2-1.9-.2-3.9-.9-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.3 0 0 .7-.2 2.3.9a8 8 0 0 1 4.2 0c1.6-1.1 2.3-.9 2.3-.9.5 1.2.2 2.1.1 2.3.5.6.9 1.4.9 2.3 0 3.3-2 4-3.9 4.2.3.3.6.8.6 1.6v2.4c0 .2.2.5.6.4A8.5 8.5 0 0 0 12 3.5z" />
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, class: cls, title }: { name: IconName; size?: number; class?: string; title?: string }) {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}

/** Brand mark: an open ensō circle with a roof line. */
export function BrandMark({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M26.6 9.6A12.4 12.4 0 1 0 28 16.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      <path d="M10.4 18.6 16 13.4l5.6 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12.6 17.2v4.6h6.8v-4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function billIcon(category?: string): IconName {
  switch (category) {
    case 'mortgage':
      return 'loan';
    case 'insurance':
      return 'shield';
    case 'power':
      return 'bolt';
    case 'internet':
      return 'wifi';
    case 'rent':
      return 'building';
    default:
      return 'receipt';
  }
}
