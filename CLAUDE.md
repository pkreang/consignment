# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Backend (and a Next.js admin frontend) for a **consignment / van sales / route accounting ERP**. Field reps drive routes, count consignment stock held at each customer, sell/replenish during visits, collect cash, and the system tracks inventory, AR, and credit exposure. Node 20+ / Express 4 / TypeScript / Prisma 5 / PostgreSQL 14+.

## Commands

```bash
npm run dev                     # tsx watch, http://localhost:3000
npm run build                   # tsc -> dist/
npm start                       # node dist/server.js
npm run lint                    # eslint src/**/*.ts

npm run prisma:generate          # regenerate client after editing schema.prisma
npm run prisma:migrate           # create + apply a dev migration
npm run prisma:deploy            # apply existing migrations (CI/prod)
npm run db:seed                  # roles, permissions, demo data, admin user
npm run prisma:studio

npm run openapi:export           # writes docs/openapi.json + docs/postman_collection.json
npm run smoke                    # end-to-end: login->load->visit->confirm->AR->reports
```

The Prisma schema lives at `src/prisma/schema.prisma` (not the default `prisma/`); `package.json` points Prisma there.

## Tests

```bash
npm test                                          # unit tests only
TEST_DATABASE_URL=postgres://... npm test          # also runs integration tests
npx vitest run src/tests/unit/money.test.ts        # a single file
npx vitest run -t "negative stock"                 # a single test by name
```

- Vitest, `pool: forks` / `singleFork` — tests run **serially in one process** because integration tests share one Postgres DB.
- `src/tests/integration/*` is **skipped entirely unless `TEST_DATABASE_URL` is set** (see `integrationEnabled` in `src/tests/integration/setup.ts`). `resetDatabase()` drops and re-migrates the public schema between runs, so point `TEST_DATABASE_URL` at a throwaway database.
- Unit tests (`src/tests/unit/*`) are pure-function tests (money math, FEFO, visit math, CSV) and always run.

## Architecture

### Module shape

Each domain under `src/modules/<name>/` follows the same three-file pattern:
- `*.routes.ts` — Express `Router`; wires middleware then delegates to the service.
- `*.service.ts` — all business logic and DB access. **Routes contain no logic.**
- `*.dto.ts` — Zod schemas for request validation.

`src/modules/index.ts` mounts every router under `/api/v1`. `src/app.ts` builds the Express app (helmet, cors, pino-http, metrics, rate limit, audit context) and mounts `/health`, `/ready`, `/metrics`, `/docs`, `/openapi.json`. `src/server.ts` is the entrypoint.

Standard route pipeline: `authenticate` → `requirePermission(...)` → optional `mutationRateLimit` / `idempotency()` → `validate({ params, query, body })` → `asyncHandler(service call)`.

### Transactional invariants — read before touching any balance/credit/AR write

Every operation that mutates inventory, consignment stock, AR, or credit runs inside `withTx()` (`src/database/prisma.ts`) at **`Serializable` isolation**. Within the transaction:

1. Lock the affected `customer` / `inventory_balance` / `consignment_stock` rows with raw `SELECT ... FOR UPDATE` **before** reading balances. The lock helpers are `lockOrCreateWarehouseBalance` and `lockOrCreateConsignmentStock` in `inventory.service.ts`.
2. The stock ledger is **dual-row**: one transfer writes a `stock_movement` per location side (warehouse out + consignment in), both sharing `ref_doc_type` + `ref_doc_id`. Use `applyWarehouseDelta` / `applyConsignmentDelta` — they update the balance row, enforce non-negative stock (`InsufficientStockError`), and append the movement. Never write `stock_movement` or balance rows directly.
3. Credit-affecting writes (load-to-customer, visit confirm/replenishment) call `enforceCreditLimitTx` **after** locks are held, so concurrent writes cannot double-spend available credit.
4. Audit rows are written **in the same transaction** via `writeAuditLog(tx, ...)` — never as a separate write.

### Audit context

`auditContext` middleware stashes user/request info into an `AsyncLocalStorage` (`src/database/audit.ts`). `writeAuditLog` reads it implicitly via `getAuditContext()`, so services pass only `tableName`/`action`/`oldValue`/`newValue`. `password`/`password_hash` are auto-redacted.

### Money and serialization

- All monetary math uses **`decimal.js`** (`Decimal(18,2)` end to end). Helpers in `src/common/utils/money.ts`. Never use JS `number` for money.
- `src/common/utils/json.ts` patches `BigInt.prototype.toJSON` and provides `serializeValue` so `res.json` can emit Prisma `BigInt` ids and `Decimal` columns as strings. IDs cross the wire as **strings**; route handlers cast `req.params.id` to `bigint`.

### Sales-visit lifecycle

`DRAFT → CHECKED_IN → COUNTED → CONFIRMED`, with `CANCELLED` reachable from any non-confirmed state. Transitions are enforced by `TRANSITIONS` in `sales-visits.service.ts`. `recordItems` captures counted quantities; `confirmVisit` re-locks and **recomputes per-item math under locks** (counted vs. before → sold/replenished), posts `SALE_CONFIRMED` movements, creates AR invoices, and applies collections. Confirm is the only irreversible step.

### Auth & permissions

JWT (HS256) bearer tokens. `authenticate` populates `req.user` with a `permissions: string[]` baked into the token at login. `requirePermission(...code)` checks them; `*` is the wildcard (`SYS_ADMIN`). Permission codes are stable dotted strings (`inventory.load`, `visit.confirm`, `ar.payment.write`, `credit.override`) — the full set and the five seeded roles live in `src/prisma/seed.ts`.

### Cross-cutting middleware

- **Idempotency** (`idempotency()`): mutation POSTs accept an `Idempotency-Key` header; the first success is cached per (key, user) and replayed; same key + different body → 409. Backed by an `idempotency_key` table.
- **Document numbers**: visit/invoice/collection numbers come from Postgres sequences (`seq_visit_no`, etc.), formatted `PREFIX-YYYYMM-000001` via `src/common/utils/docNumber.ts`.
- **FEFO lots**: optional. Once any `ProductLot` exists for a product, loads/returns/sales FEFO-split across lots (oldest expiry first) and stamp `stock_movement.lot_id`; per-location lot balances live in `warehouse_stock_lot` / `consignment_stock_lot`. Logic in `src/modules/inventory/lot.service.ts`.

## Conventions

- `experimentalDecorators` is on but unused; `@typescript-eslint/no-explicit-any` is disabled and `tsconfig` `strict` is on. The path alias `@/*` maps to `src/*`.
- New endpoints must be added to the OpenAPI spec in `src/openapi/spec.ts` (CI runs `openapi:export`).
- The frontend (`frontend/`) is a separate Next.js 14 + Tailwind + React Query app with its own `package.json`; its `npm run dev` serves on port 3001.

## Deploy ops (Render + Neon)

Production deploys to Render (Oregon free), DB on Neon. Required env vars **must** be set in the Render dashboard (marked `sync: false` in `render.yaml`):

- `DATABASE_URL` — Neon pooler URL (app runtime)
- `DIRECT_URL` — Neon direct URL (used by `prisma migrate deploy`)
- `JWT_SECRET` — at least 16 chars

If `DIRECT_URL` is missing, migrations fall back to the pooler and may apply partially/silently — verify both URLs after rotating Neon branches.

`RUN_SEED` is pinned to `"false"` in `render.yaml` so the prod DB never gets reseeded on deploy. To re-seed, set it `true` *temporarily* in the dashboard and redeploy, then revert.

`docker/entrypoint.sh` logs `DB target: <hostname>/<db>` on startup — check the Render deploy log to confirm the container connected to the expected Neon project/branch.

Recover lost data: Neon free tier keeps 7-day Point-in-Time Restore (Neon dashboard → Branches → Restore).
