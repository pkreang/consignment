/**
 * Single source of truth for route → required permission mapping.
 * Used by both the sidebar (to hide menu items) and the app shell
 * (to redirect users who navigate to a forbidden URL directly).
 *
 * Routes not listed here are accessible to any authenticated user
 * (e.g. /dashboard, /login).
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  // Operations
  '/visits': 'visit.read',
  '/collections': 'collection.read',
  '/ar': 'ar.read',
  '/ar-aging': 'ar.read',

  // Inventory
  '/inventory': 'inventory.read',
  '/inventory/load': 'inventory.load',
  '/inventory/return': 'inventory.return',
  '/inventory/adjustment': 'inventory.adjust',
  '/inventory/production-receipt': 'inventory.production_receipt',
  '/inventory/lots': 'inventory.read',

  // Master data
  '/customers': 'customer.read',
  '/customer-groups': 'customer.read',
  '/customer-routes': 'customer.read',
  '/products': 'product.read',
  '/product-categories': 'product.read',
  '/warehouses': 'warehouse.read',
  '/routes': 'route.read',
  '/employees': 'employee.read',

  // Reports
  '/credit-risk': 'credit.read',
  '/reports/ar-outstanding': 'report.read',
  '/reports/sales-by-customer': 'report.read',
  '/reports/sales-by-sku': 'report.read',
  '/reports/sales-by-employee': 'report.read',
  '/reports/current-stock': 'report.read',
  '/reports/consignment-stock': 'report.read',
  '/reports/collection': 'report.read',
  '/reports/best-sellers': 'report.read',
  '/reports/slow-movers': 'report.read',
  '/reports/dead-stock': 'report.read',
  '/reports/production-planning': 'report.read',

  // System
  '/users': 'user.read',
  '/roles': 'user.read',
  '/audit': 'user.read',
  '/imports': 'user.write',
  '/notifications': 'user.write',
};

/** Returns the permission code required to access `pathname`,
 *  or undefined if the route is unrestricted. */
export function requiredPermission(pathname: string): string | undefined {
  // Try exact match first so /inventory/load matches before /inventory.
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];
  // Fall back to longest matching prefix (handles dynamic segments like /ar/[id]).
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_PERMISSIONS[match] : undefined;
}
