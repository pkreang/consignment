"use client";

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoonIcon, SunIcon } from '@/components/icons';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('nav');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Until hydration completes, render a placeholder of the same size to
  // avoid the layout shifting when the icon swaps.
  if (!mounted) {
    return <span className="inline-block h-9 w-9" aria-hidden />;
  }

  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="btn btn-ghost p-2"
      aria-label={isDark ? t('lightMode') : t('darkMode')}
      title={isDark ? t('lightMode') : t('darkMode')}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
