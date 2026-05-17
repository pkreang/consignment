"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isAuthed, logout } from '@/lib/api';
import { LocaleSwitcher } from '@/components/locale-switcher';

const items = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/visits', key: 'visits' },
  { href: '/customers', key: 'customers' },
  { href: '/products', key: 'products' },
  { href: '/ar-aging', key: 'arAging' },
  { href: '/credit-risk', key: 'creditRisk' },
  { href: '/audit', key: 'audit' },
] as const;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthed()), [pathname]);

  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="text-base font-semibold text-brand-600">
          {t('brand')}
        </Link>
        <nav className="flex flex-1 gap-1">
          {items.map((it) => {
            const active = pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={
                  'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                  (active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100')
                }
              >
                {t(it.key)}
              </Link>
            );
          })}
        </nav>
        <LocaleSwitcher />
        {authed ? (
          <button
            type="button"
            onClick={() => {
              logout();
              router.refresh();
            }}
            className="btn btn-ghost"
          >
            {t('signOut')}
          </button>
        ) : (
          <Link href="/login" className="btn btn-primary">
            {t('signIn')}
          </Link>
        )}
      </div>
    </header>
  );
}
