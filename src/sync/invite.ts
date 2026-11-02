/**
 * An invite carries everything the second phone needs to open the shared file:
 * repository, file path and the access token. It is shown as a QR code (or
 * text) on the first phone. Treat it like a password.
 */
import type { SyncConfig } from '../model/store';

const PREFIX = 'MH1.';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeInvite(cfg: SyncConfig): string {
  const payload: Record<string, string> = { o: cfg.owner, r: cfg.repo, p: cfg.path, t: cfg.token };
  if (cfg.branch) payload.b = cfg.branch;
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

/** Accepts the bare code, a code with spaces or line breaks, or a link containing it. */
export function decodeInvite(input: string): SyncConfig | null {
  const m = input.replace(/\s+/g, '').match(/MH1\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const p = JSON.parse(fromBase64Url(m[1])) as Record<string, string>;
    if (!p.o || !p.r || !p.p || !p.t) return null;
    return { owner: p.o, repo: p.r, path: p.p, token: p.t, ...(p.b ? { branch: p.b } : {}) };
  } catch {
    return null;
  }
}

/** "github.com/owner/repo", "owner/repo" or a full URL -> owner + repo */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function looksLikeToken(t: string): boolean {
  return /^(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})$/.test(t.trim());
}
