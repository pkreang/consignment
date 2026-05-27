"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasPermission, isAuthed } from '@/lib/api';
import { requiredPermission } from '@/lib/route-permissions';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

/**
 * Top-level layout. Renders sidebar + topbar for app pages, and just
 * a plain centered container for /login (no chrome).
 *
 * Enforces two gates before painting children:
 *  1. Authentication — unauthenticated → /login.
 *  2. Authorization — if the URL requires a permission the user lacks,
 *     bounce to /dashboard so they don't land on a page that will just
 *     show a 403 from the API.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLogin = pathname === '/login';

  // null = haven't checked yet (SSR + first paint), 'ok' / 'denied' = checked
  const [gate, setGate] = useState<'pending' | 'ok' | 'denied'>('pending');
  useEffect(() => {
    if (isLogin) {
      setGate('ok');
      return;
    }
    if (!isAuthed()) {
      setGate('denied');
      router.replace('/login');
      return;
    }
    const needed = requiredPermission(pathname);
    if (needed && !hasPermission(needed)) {
      setGate('denied');
      router.replace('/dashboard');
      return;
    }
    setGate('ok');
  }, [pathname, isLogin, router]);

  if (isLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4 py-8 dark:bg-surface-950">
        {children}
      </div>
    );
  }

  // Render nothing while the gates are being checked or after a denial —
  // prevents the protected page from flashing during redirect.
  if (gate !== 'ok') {
    return <div className="min-h-screen bg-surface-50 dark:bg-surface-950" />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={drawerOpen} onMobileClose={() => setDrawerOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-screen-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
