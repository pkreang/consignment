"use client";

/**
 * Tiny typed API client + auth-token storage. Keeping it dependency-light so
 * the bundle stays small and the data path is trivial to reason about.
 */

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? '') + '/api/v1'
    : '/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;
  code?: string;
  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('token', token);
  else window.localStorage.removeItem('token');
}

export function isAuthed(): boolean {
  return !!getToken();
}

/** Decode the JWT payload (no signature check — server still enforces auth).
 *  Returns the permissions string array from the token, or [] if missing. */
export function getPermissions(): string[] {
  const token = getToken();
  if (!token) return [];
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

/** True if the user's permissions include `code` or the `*` wildcard. */
export function hasPermission(code: string): boolean {
  const perms = getPermissions();
  return perms.includes('*') || perms.includes(code);
}

/** Fire a no-auth GET /ready against the API root to wake both the
 *  Render dyno AND the Neon DB while the user is still typing.
 *
 *  Why /ready not /health: /health just returns JSON (wakes Render only),
 *  /ready runs `SELECT 1` through Prisma which forces Neon's auto-suspended
 *  compute to resume too. The first auth/login query would otherwise pay
 *  that 1-3s Neon cold-start on top of bcrypt.
 *
 *  Returns true once the backend has answered with a 2xx, false on
 *  timeout/network/5xx. Never throws. */
export async function prewarmBackend(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(90_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      setToken(null);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const errorBody = (body as { error?: { message?: string; code?: string } } | null)
      ?.error;
    const message = (errorBody?.message ?? res.statusText) || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body, errorBody?.code);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function login(username: string, password: string) {
  const out = await api<{ accessToken: string; user: { username: string; role: string; permissions: string[] } }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  );
  setToken(out.accessToken);
  return out;
}

export function logout() {
  setToken(null);
  if (typeof window !== 'undefined') window.location.href = '/login';
}
