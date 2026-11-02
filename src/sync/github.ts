/**
 * The shared budget is one JSON file in a private GitHub repository, read and
 * written through the REST "contents" API. Every save is a commit, so the
 * repository doubles as a full change history.
 */
import type { SyncConfig } from '../model/store';

const API = 'https://api.github.com';

export type SyncErrorKind = 'auth' | 'forbidden' | 'notfound' | 'conflict' | 'network' | 'rate' | 'server' | 'format';

export class SyncError extends Error {
  constructor(
    public kind: SyncErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface RemoteFile {
  sha: string;
  text: string;
  etag: string | null;
}

function headers(cfg: SyncConfig, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cfg.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

function contentsUrl(cfg: SyncConfig, withRef: boolean): string {
  const path = cfg.path.split('/').map(encodeURIComponent).join('/');
  const ref = withRef && cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
  return `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path}${ref}`;
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError('network', 'Brak połączenia z internetem');
  }
}

async function fail(res: Response): Promise<never> {
  let msg = '';
  try {
    msg = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    /* no body */
  }
  if (res.status === 401) throw new SyncError('auth', 'Token jest nieprawidłowy albo wygasł', 401);
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429) throw new SyncError('rate', 'GitHub chwilowo ogranicza zapytania', res.status);
    throw new SyncError('forbidden', 'Token nie ma uprawnień do zapisu (Contents: Read and write)', 403);
  }
  if (res.status === 404) throw new SyncError('notfound', 'Nie widzę repozytorium — sprawdź nazwę i dostęp tokenu', 404);
  if (res.status === 409 || (res.status === 422 && /sha/i.test(msg))) throw new SyncError('conflict', 'Plik zmienił się w międzyczasie', res.status);
  throw new SyncError('server', `GitHub odpowiedział błędem ${res.status}${msg ? `: ${msg}` : ''}`, res.status);
}

// UTF-8 safe base64 (Polish letters, "zł")
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Check that the token can see the repository. */
export async function checkRepo(cfg: SyncConfig): Promise<{ private: boolean; defaultBranch: string }> {
  const res = await call(`${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, { headers: headers(cfg) });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { private: boolean; default_branch: string };
  return { private: json.private, defaultBranch: json.default_branch };
}

/**
 * Read the shared file. Returns null when it does not exist yet and
 * 'unchanged' when `etag` still matches (a 304 does not count against limits).
 */
export async function readFile(cfg: SyncConfig, etag?: string | null): Promise<RemoteFile | null | 'unchanged'> {
  const res = await call(contentsUrl(cfg, true), { headers: headers(cfg, etag ? { 'If-None-Match': etag } : {}) });
  if (res.status === 304) return 'unchanged';
  if (res.status === 404) {
    // a missing file and a missing repo look the same; tell them apart
    await checkRepo(cfg);
    return null;
  }
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { type: string; sha: string; content?: string; encoding?: string };
  if (json.type !== 'file') throw new SyncError('format', `${cfg.path} nie jest plikiem`);
  let text: string;
  if (json.encoding === 'base64' && json.content) {
    text = decodeBase64Utf8(json.content);
  } else {
    // files over 1 MB come without content; ask for the raw body
    const raw = await call(contentsUrl(cfg, true), { headers: headers(cfg, { Accept: 'application/vnd.github.raw+json' }) });
    if (!raw.ok) await fail(raw);
    text = await raw.text();
  }
  return { sha: json.sha, text, etag: res.headers.get('etag') };
}

/** Write the shared file. `sha` must be the version we read (null when creating). */
export async function writeFile(cfg: SyncConfig, text: string, sha: string | null, message: string): Promise<{ sha: string }> {
  const body: Record<string, string> = { message, content: encodeBase64Utf8(text) };
  if (sha) body.sha = sha;
  if (cfg.branch) body.branch = cfg.branch;
  const res = await call(contentsUrl(cfg, false), {
    method: 'PUT',
    headers: headers(cfg, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  const json = (await res.json()) as { content: { sha: string } };
  return { sha: json.content.sha };
}
