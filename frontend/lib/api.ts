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
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
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
    const message =
      ((body as { error?: { message?: string } } | null)?.error?.message ??
        res.statusText) || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
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
