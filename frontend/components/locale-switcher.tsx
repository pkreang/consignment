"use client";

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/request';

const LOCALES = [
  { code: 'th', label: 'TH' },
  { code: 'en', label: 'EN' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(code: Locale) {
    if (code === locale) return;
    // Persist the choice for a year; the server layout reads this cookie.
    document.cookie = `locale=${code}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={isPending}
          aria-pressed={l.code === locale}
          onClick={() => selectLocale(l.code)}
          className={
            'rounded px-2 py-0.5 text-xs font-medium transition ' +
            (l.code === locale
              ? 'bg-brand-50 text-brand-700'
              : 'text-slate-500 hover:bg-slate-100 disabled:opacity-50')
          }
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
