"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthed, logout } from '@/lib/api';

const items = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/visits', label: 'Visits' },
  { href: '/customers', label: 'Customers' },
  { href: '/products', label: 'Products' },
  { href: '/ar-aging', label: 'AR Aging' },
  { href: '/credit-risk', label: 'Credit Risk' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthed()), [pathname]);

  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="text-base font-semibold text-brand-600">
          Consignment ERP
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
                {it.label}
              </Link>
            );
          })}
        </nav>
        {authed ? (
          <button
            type="button"
            onClick={() => {
              logout();
              router.refresh();
            }}
            className="btn btn-ghost"
          >
            Sign out
          </button>
        ) : (
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
