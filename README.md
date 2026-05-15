# Consignment ERP Lite — Backend

Node.js + Express + TypeScript + Prisma + PostgreSQL backend for a consignment / van sales / route accounting ERP. Implements the eight phases of the [plan](.cursor/plans) — schema, master CRUD, stock ledger, sales-visit workflow, collections, AR, credit control, reports, and tests.

## Stack
- Node.js 20+
- Express 4 + Helmet + Morgan
- Prisma 5 + PostgreSQL 14+
- Zod for request validation
- JWT (HS256) + bcrypt for auth + RBAC
- decimal.js for monetary math (`Decimal(18,2)` end to end)
- Vitest for unit & integration tests

## Project layout

```
src/
  config/                env + logger
  database/              prisma client, tx helper, audit middleware
  common/                errors, middleware, validators, utils
  modules/
    auth/                login, me
    users/, security/    app_user, role, permission
    products/, customers/, warehouses/, employees/, routes/
    inventory/           dual-row ledger, adjustments, load, return
    consignment/         consignment stock queries
    sales-visits/        visit workflow + confirm transaction
    collections/         FIFO standalone settlement
    ar/                  invoices, payments, aging
    credit/              exposure, validate, policy, override
    reports/             dashboard + all reports
  prisma/                schema.prisma, migrations/, seed.ts
  tests/
    unit/                pure-function tests
    integration/         service-level tests against a real Postgres
  app.ts / server.ts
```

## Running

```bash
cp .env.example .env            # configure DATABASE_URL & JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:deploy           # apply migrations
npm run db:seed                 # roles, permissions, demo data, admin user
npm run dev                     # http://localhost:3000
```

Seed creates an admin user `admin / Admin@12345`.

## Tests

```bash
npm test                        # unit tests (always)
TEST_DATABASE_URL=postgres://... npm test
                                # also runs integration tests
```

The integration tests cover the critical paths called out in the spec:
load-to-customer, replenishment, sales-visit confirmation, qty math,
collection (FIFO), AR invoice creation, AR payment, credit limit validation,
negative-stock prevention, and audit-trail completeness.

## Important transactional invariants

Every operation that changes balances does the following inside one Prisma
`$transaction` at `Serializable` isolation:

1. Locks the affected `customer`, `inventory_balance`, and `consignment_stock`
   rows with `SELECT ... FOR UPDATE` to serialise credit calculations and
   balance updates.
2. Updates `inventory_balance` / `consignment_stock` to the new on-hand qty.
3. Inserts one `stock_movement` row per location side of the transfer.
   The pair share `ref_doc_type` + `ref_doc_id` so the ledger remains
   reconstructable from any direction.
4. For credit-affecting writes (load-to-customer, visit replenishment), runs
   the credit-limit check after the locks are acquired so concurrent writes
   cannot double-spend the customer's available credit.
5. Audit entries (`audit_log`) are written in the same transaction with the
   acting user, request id, and a redacted before/after snapshot.

## Permissions

The seed installs five roles:

- `SYS_ADMIN` (wildcard)
- `OPS_MANAGER`
- `SALES_REP`
- `WAREHOUSE_OFFICER`
- `FINANCE`

Permission codes are stable strings such as `inventory.load`, `visit.confirm`,
`ar.payment.write`, and `credit.override`. The full list is in `src/prisma/seed.ts`.

## Document numbering

Visit, invoice, and collection numbers come from Postgres sequences
(`seq_visit_no`, `seq_invoice_no`, `seq_collection_no`) and are formatted
`PREFIX-YYYYMM-000001` at creation time.
