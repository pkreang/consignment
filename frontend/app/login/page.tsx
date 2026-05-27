"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { login, prewarmBackend } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';
import { BoxIcon, ChartIcon, TruckIcon, UsersIcon } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
  const errorMessage = useErrorMessage();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warming, setWarming] = useState<'pending' | 'ready' | 'failed'>('pending');

  // Wake the Render free-tier backend while the user types — cold start
  // can take 30-60s and would otherwise hit on submit. Block the submit
  // button until /ready answers so the form doesn't appear to hang.
  useEffect(() => {
    let cancelled = false;
    prewarmBackend().then((ok) => {
      if (!cancelled) setWarming(ok ? 'ready' : 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl dark:border-surface-800 dark:bg-surface-900 lg:grid-cols-2">
      {/* Branding panel — desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 p-10 text-white lg:flex">
        <Decorations />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
              C
            </span>
            <span className="text-lg font-semibold">{t('brand')}</span>
          </div>
          <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">
            {t('tagline')}
          </h2>
          <p className="max-w-sm text-sm text-white/75">{t('taglineSub')}</p>
        </div>
        <div className="relative grid grid-cols-2 gap-3 pt-8 text-sm">
          <Feature icon={TruckIcon} label={t('featureVisits')} />
          <Feature icon={BoxIcon} label={t('featureInventory')} />
          <Feature icon={UsersIcon} label={t('featureCustomers')} />
          <Feature icon={ChartIcon} label={t('featureReports')} />
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-col justify-center p-6 sm:p-10">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile brand header */}
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-base font-bold text-white">
              C
            </span>
            <span className="text-base font-semibold">{t('brand')}</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-surface-500">{t('subtitle')}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-username">
                {t('username')}
              </label>
              <input
                id="login-username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="login-password">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-16"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs font-medium text-surface-500 transition hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-200"
                  aria-label={showPw ? t('hidePassword') : t('showPassword')}
                >
                  {showPw ? t('hidePassword') : t('showPassword')}
                </button>
              </div>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button
              className="btn btn-primary w-full gap-2"
              disabled={busy || warming === 'pending'}
              type="submit"
            >
              {warming === 'pending' && <Spinner />}
              {busy
                ? t('submitting')
                : warming === 'pending'
                  ? t('warming')
                  : t('submit')}
            </button>

            {warming === 'pending' && (
              <p className="text-center text-xs text-surface-500">{t('warmingHint')}</p>
            )}

            <p className="rounded-md bg-surface-50 px-3 py-2 text-xs text-surface-500 dark:bg-surface-800/50 dark:text-surface-400">
              {t('defaultAdmin')}{' '}
              <span className="font-mono text-surface-700 dark:text-surface-200">
                admin / Admin@12345
              </span>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Decorations() {
  return (
    <>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
    </>
  );
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="relative flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate text-xs font-medium">{label}</span>
    </div>
  );
}
