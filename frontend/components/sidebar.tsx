"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hasPermission } from '@/lib/api';
import { requiredPermission } from '@/lib/route-permissions';
import {
  BellIcon,
  BoxIcon,
  ChartIcon,
  ChevronDownIcon,
  ClipboardIcon,
  CloseIcon,
  CogIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  ListIcon,
  MapPinIcon,
  ShieldIcon,
  TruckIcon,
  UploadIcon,
  UsersIcon,
} from '@/components/icons';

type Item = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};
type Section = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

type T = ReturnType<typeof useTranslations<'nav'>>;

function buildSections(t: T): Section[] {
  return [
    {
      id: 'home',
      label: t('home'),
      icon: HomeIcon,
      items: [{ href: '/dashboard', label: t('dashboard'), icon: HomeIcon }],
    },
    {
      id: 'operations',
      label: t('operations'),
      icon: TruckIcon,
      items: [
        { href: '/visits', label: t('visits'), icon: ClipboardIcon },
        { href: '/collections', label: t('collections'), icon: CreditCardIcon },
        { href: '/ar', label: t('ar'), icon: FileTextIcon },
        { href: '/ar-aging', label: t('arAging'), icon: ChartIcon },
      ],
    },
    {
      id: 'inventory',
      label: t('inventory'),
      icon: BoxIcon,
      items: [
        { href: '/inventory', label: t('stock'), icon: BoxIcon },
        { href: '/inventory/load', label: t('load') },
        { href: '/inventory/return', label: t('return') },
        { href: '/inventory/adjustment', label: t('adjustment') },
        { href: '/inventory/production-receipt', label: t('production') },
        { href: '/inventory/lots', label: t('lots') },
      ],
    },
    {
      id: 'master',
      label: t('master'),
      icon: UsersIcon,
      items: [
        { href: '/customers', label: t('customers'), icon: UsersIcon },
        { href: '/customer-groups', label: t('customerGroups') },
        { href: '/customer-routes', label: t('customerRoutes') },
        { href: '/products', label: t('products'), icon: BoxIcon },
        { href: '/product-categories', label: t('productCategories') },
        { href: '/warehouses', label: t('warehouses') },
        { href: '/routes', label: t('routes'), icon: MapPinIcon },
        { href: '/employees', label: t('employees') },
      ],
    },
    {
      id: 'reports',
      label: t('reports'),
      icon: ChartIcon,
      items: [
        { href: '/credit-risk', label: t('creditRisk') },
        { href: '/reports/ar-outstanding', label: t('arOutstanding') },
        { href: '/reports/sales-by-customer', label: t('salesByCustomer') },
        { href: '/reports/sales-by-sku', label: t('salesBySku') },
        { href: '/reports/sales-by-employee', label: t('salesByEmployee') },
        { href: '/reports/current-stock', label: t('currentStock') },
        { href: '/reports/consignment-stock', label: t('consignmentStock') },
        { href: '/reports/collection', label: t('collectionReport') },
        { href: '/reports/best-sellers', label: t('bestSellers') },
        { href: '/reports/slow-movers', label: t('slowMovers') },
        { href: '/reports/dead-stock', label: t('deadStock') },
        { href: '/reports/production-planning', label: t('productionPlanning') },
      ],
    },
    {
      id: 'system',
      label: t('system'),
      icon: CogIcon,
      items: [
        { href: '/users', label: t('users'), icon: UsersIcon },
        { href: '/roles', label: t('roles'), icon: ShieldIcon },
        { href: '/audit', label: t('audit'), icon: ListIcon },
        { href: '/imports', label: t('imports'), icon: UploadIcon },
        { href: '/notifications', label: t('notifications'), icon: BellIcon },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  // Filter items by the JWT permissions; drop sections that end up empty.
  // Routes not listed in ROUTE_PERMISSIONS (e.g. /dashboard) stay visible.
  const sections = buildSections(t)
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        const perm = requiredPermission(it.href);
        return !perm || hasPermission(perm);
      }),
    }))
    .filter((s) => s.items.length > 0);

  // Track which section is expanded. Auto-expand the section that owns the
  // current route on first render and whenever the route changes.
  const activeSection = sections.find((s) =>
    s.items.some((it) => isActive(pathname, it.href)),
  );
  const [expanded, setExpanded] = useState<string | null>(activeSection?.id ?? 'home');
  useEffect(() => {
    if (activeSection) setExpanded(activeSection.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close drawer when route changes on mobile
  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const content = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto scrollbar-thin px-3 py-4">
      <Link
        href="/dashboard"
        className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-semibold text-white">
          C
        </span>
        <span className="font-semibold text-surface-900 dark:text-surface-100">
          {t('brand')}
        </span>
      </Link>
      {sections.map((section) => {
        const SectionIcon = section.icon;
        const isExpanded = expanded === section.id;
        const sectionActive = section.items.some((it) => isActive(pathname, it.href));
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : section.id)}
              className={
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition ' +
                (sectionActive
                  ? 'text-surface-900 dark:text-surface-50'
                  : 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800')
              }
            >
              <SectionIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{section.label}</span>
              <ChevronDownIcon
                className={
                  'h-3.5 w-3.5 shrink-0 transition ' + (isExpanded ? 'rotate-0' : '-rotate-90')
                }
              />
            </button>
            {isExpanded && (
              <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-surface-200 pl-2 dark:border-surface-800">
                {section.items.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(pathname, it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ' +
                          (active
                            ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100')
                        }
                      >
                        {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" /> : <span className="w-4 shrink-0" />}
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900 lg:block">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={onMobileClose}
            className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm dark:bg-black/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-surface-200 px-3 py-2 dark:border-surface-800">
              <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                {t('menu')}
              </span>
              <button
                type="button"
                onClick={onMobileClose}
                className="btn btn-ghost p-1.5"
                aria-label={t('closeMenu')}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
}
