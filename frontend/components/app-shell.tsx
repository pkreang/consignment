"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthed } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

/**
 * Top-level layout. Renders sidebar + topbar for app pages, and just
 * a plain centered container for /login (no chrome).
 *
 * Also enforces auth: any non-/login route is gated behind an
 * isAuthed() check that runs before children paint, so an
 * unauthenticated user lands directly on /login without flashing
 * the protected page first.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLogin = pathname === '/login';

  // null = haven't checked yet (SSR + first paint), true/false = checked
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const ok = isAuthed();
    setAuthed(ok);
    if (!ok && !isLogin) router.replace('/login');
  }, [pathname, isLogin, router]);

  if (isLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4 py-8 dark:bg-surface-950">
        {children}
      </div>
    );
  }

  // Render nothing until we know the user is authed — prevents the
  // protected page from flashing on screen while the client guard
  // is still figuring out where to send them.
  if (authed !== true) {
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
