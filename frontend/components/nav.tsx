"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isAuthed, logout } from '@/lib/api';

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: 'Operations',
    items: [
      { href: '/visits', label: 'Sales Visits' },
      { href: '/collections', label: 'Collections' },
      { href: '/ar', label: 'AR Invoices' },
      { href: '/inventory', label: 'Inventory' },
      { href: '/inventory/load', label: 'Load to Customer' },
      { href: '/inventory/return', label: 'Return from Customer' },
      { href: '/inventory/adjustment', label: 'Stock Adjustment' },
      { href: '/inventory/production-receipt', label: 'Production Receipt' },
      { href: '/inventory/lots', label: 'Product Lots' },
    ],
  },
  {
    label: 'Master',
    items: [
      { href: '/customers', label: 'Customers' },
      { href: '/customer-groups', label: 'Customer Groups' },
      { href: '/products', label: 'Products' },
      { href: '/product-categories', label: 'Product Categories' },
      { href: '/warehouses', label: 'Warehouses' },
      { href: '/employees', label: 'Employees' },
      { href: '/routes', label: 'Routes' },
      { href: '/customer-routes', label: 'Customer Routes' },
      { href: '/users', label: 'Users' },
      { href: '/roles', label: 'Roles' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/ar-aging', label: 'AR Aging' },
      { href: '/credit-risk', label: 'Credit Risk' },
      { href: '/reports/ar-outstanding', label: 'AR Outstanding' },
      { href: '/reports/sales-by-customer', label: 'Sales by Customer' },
      { href: '/reports/sales-by-sku', label: 'Sales by SKU' },
      { href: '/reports/sales-by-employee', label: 'Sales by Employee' },
      { href: '/reports/current-stock', label: 'Current Stock' },
      { href: '/reports/consignment-stock', label: 'Consignment Stock' },
      { href: '/reports/collection', label: 'Collection' },
      { href: '/reports/best-sellers', label: 'Best Sellers' },
      { href: '/reports/slow-movers', label: 'Slow Movers' },
      { href: '/reports/dead-stock', label: 'Dead Stock' },
      { href: '/reports/production-planning', label: 'Production Planning' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit', label: 'Audit Log' },
      { href: '/imports', label: 'CSV Import' },
      { href: '/notifications', label: 'Notifications' },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthed()), [pathname]);

  if (pathname === '/login') return null;

  const dashActive = pathname === '/dashboard' || pathname === '/';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3">
        <Link href="/dashboard" className="whitespace-nowrap text-base font-semibold text-brand-600">
          Consignment ERP
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          <Link
            href="/dashboard"
            className={
              'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
              (dashActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')
            }
          >
            Dashboard
          </Link>
          {groups.map((g) => (
            <NavDropdown key={g.label} group={g} pathname={pathname} />
          ))}
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

function NavDropdown({ group, pathname }: { group: Group; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = group.items.some(
    (it) => pathname === it.href || pathname.startsWith(it.href + '/'),
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition ' +
          (active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100')
        }
      >
        {group.label}
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[210px] rounded-md border border-slate-200 bg-white shadow-lg">
          {group.items.map((it) => {
            const isActive =
              pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                className={
                  'block px-3 py-2 text-sm transition ' +
                  (isActive
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-slate-700 hover:bg-slate-100')
                }
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
