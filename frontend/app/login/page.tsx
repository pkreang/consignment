"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { login } from '@/lib/api';
import { useErrorMessage } from '@/lib/use-error-message';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
  const errorMessage = useErrorMessage();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold text-surface-800">{t('title')}</h1>
      <p className="mb-6 text-sm text-surface-500">
        {t('defaultAdmin')} <span className="font-mono">admin / Admin@12345</span>
      </p>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <label className="label">{t('username')}</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">{t('password')}</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          {busy ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
