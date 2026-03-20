# financial-dolim-solution

Workbook-driven multi-lender vehicle finance quote platform.

This project is building a web-based calculator platform for automotive finance products such as:

1. operating lease
2. financial lease
3. installment / auto loan

The platform is designed so that finance companies can send an updated Excel workbook every month, and the system can ingest that workbook, normalize the data, activate a new version, and use it for quote calculation on the web.

## Current focus

The first lender target is **MG Capital**.

The current implementation includes:

1. project scaffold for Bun + Hono + Cloudflare Pages Functions
2. initial Drizzle schema design for versioned workbook imports
3. lender adapter registry and MG Capital adapter
4. workbook parsing for:
   - vehicle catalog rows
   - residual matrix rows
   - brand-level base rate policies
5. import preview API and import persistence service
6. planning documents for scaling to multiple finance companies

## Tech stack

### Runtime and API

1. `Bun`
2. `Hono`
3. `Cloudflare Pages Functions`

### Database and data access

1. `Supabase`
2. `PostgreSQL 17+`
3. `Drizzle ORM`

### Frontend and UI

1. `shadcn/ui`
2. shared lender/product quote UI planned on top of the same API

### Workbook and validation

1. `xlsx`
2. typed validation with `zod`

## Why Drizzle over Prisma

This project prefers **Drizzle** because it fits the intended stack better:

1. lighter for Bun and serverless environments
2. SQL-first and easier to control for finance-oriented domain logic
3. better fit for versioned workbook imports and explicit schema ownership
4. more practical than Prisma for Cloudflare-oriented runtime constraints

## Project structure

```text
functions/
  api/
src/
  db/
  domain/
    imports/
    lenders/
  lib/
docs/
```

## Key files

1. `src/app.ts`
   - Hono app entry
   - health endpoint
   - lender list endpoint
   - workbook preview import endpoint
   - workbook persistence import endpoint

2. `src/domain/lenders/mg-capital/workbook-parser.ts`
   - parses MG workbook data into normalized preview output

3. `src/db/schema.ts`
   - initial database schema for lenders, imports, vehicle programs, residual matrices, rate policies, and quote snapshots

4. `src/domain/imports/import-service.ts`
   - persists parsed lender workbook data into the database when `DATABASE_URL` is configured

5. `docs/platform-blueprint.md`
   - platform architecture for future multi-lender expansion

6. `docs/lender-onboarding-playbook.md`
   - repeatable process for onboarding additional finance companies

## API endpoints

### `GET /`

Basic service metadata.

### `GET /health`

Health check endpoint.

### `GET /api/lenders`

Returns currently registered lender adapters.

### `POST /api/imports/preview`

Accepts a workbook file upload and returns parsed preview data.

Expected request:

- multipart form-data
- field name: `file`

### `POST /api/imports`

Accepts a workbook file upload, parses it, and persists the version when `DATABASE_URL` is configured.

Expected request:

- multipart form-data
- field name: `file`
- optional field: `activate=true|false`

## Local development

Install dependencies:

```bash
bun install
```

Run typecheck:

```bash
bun run typecheck
```

Run local Pages dev server:

```bash
bun run dev
```

## Environment variables

### Required for preview-only mode

1. `APP_ENV`

### Required for persistence mode

1. `DATABASE_URL`

## Environment notes

The long-term production target is:

1. deploy API on Cloudflare Pages Functions
2. persist business data in Supabase PostgreSQL
3. use versioned lender workbook imports as the monthly update mechanism

For production DB connectivity from Cloudflare, plan for a supported secure connection path such as Hyperdrive in front of Supabase Postgres.

## Planning docs

1. [Project Planning Docs](./docs/README.md)
2. [Platform Blueprint](./docs/platform-blueprint.md)
3. [Lender Onboarding Playbook](./docs/lender-onboarding-playbook.md)
4. [Implementation Roadmap](./docs/implementation-roadmap.md)
5. [MG Capital Implementation Plan](./docs/mg-capital-implementation-plan.md)

## Next implementation steps

1. add Drizzle migrations for the expanded multi-lender schema
2. connect `POST /api/imports` to real Supabase persistence with runtime env wiring
3. implement the first MG operating lease calculator
4. add fixture-based parity tests against workbook results
5. build admin upload and activation UI
