"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { isAuthed, logout } from '@/lib/api';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogOutIcon, MenuIcon, UsersIcon } from '@/components/icons';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthed()), [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-surface-200 bg-white/80 px-3 backdrop-blur dark:border-surface-800 dark:bg-surface-900/80 sm:px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="btn btn-ghost -ml-1 p-2 lg:hidden"
        aria-label={t('openMenu')}
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <LocaleSwitcher />
      <ThemeToggle />
      {authed && (
        <>
          <Link
            href="/profile"
            className={
              'btn btn-ghost gap-1.5 px-2 sm:px-3 ' +
              (pathname.startsWith('/profile')
                ? 'bg-surface-100 dark:bg-surface-800'
                : '')
            }
            aria-label={t('profile')}
          >
            <UsersIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile')}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              router.refresh();
            }}
            className="btn btn-ghost gap-1.5 px-2 sm:px-3"
            aria-label={t('signOut')}
          >
            <LogOutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('signOut')}</span>
          </button>
        </>
      )}
    </header>
  );
}
