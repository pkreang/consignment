"use client";

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

/**
 * Top-level layout. Renders sidebar + topbar for app pages, and just
 * a plain centered container for /login (no chrome).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (pathname === '/login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4 py-8 dark:bg-surface-950">
        {children}
      </div>
    );
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
