# Consignment ERP Lite — Web (admin MVP)

Next.js 14 (App Router) + Tailwind + React Query admin panel for the
Consignment ERP backend.

## Pages

- `/login` — sign in (default `admin / Admin@12345`)
- `/dashboard` — KPI tiles from `GET /api/v1/reports/dashboard`
- `/visits` and `/visits/[id]` — sales visit list + detail
- `/customers` — customer master + search
- `/products` — product master + search
- `/ar-aging` — bucketed receivables aging
- `/credit-risk` — customers at / above their credit limit

## Local dev

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 npm run dev
# open http://localhost:3001
```

Or via Docker compose (root):

```bash
docker compose --profile frontend up --build
# api    -> http://localhost:3000  (Swagger at /docs)
# web    -> http://localhost:3001
```

The token is stored in `localStorage` (`token`). On a 401 the client clears
it and bounces back to `/login`.
