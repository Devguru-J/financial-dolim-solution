# Implementation Roadmap

## Objective

Move from the current MG-first scaffold to a production-ready multi-lender quote platform.

## Phase 0. Current state

Already done:

1. basic Bun + Hono + Drizzle + Cloudflare scaffold
2. initial MG workbook analysis
3. MG parser for `차량DB`, `잔가map`, and base brand rate rows
4. lender adapter registry and MG Capital adapter structure
5. `POST /api/imports/preview`
6. `POST /api/imports`
7. `GET /api/imports`
8. import persistence service with `DATABASE_URL`-aware behavior
9. Drizzle schema and generated migration files
10. repository root normalized to `financial-dolim-solution`
11. Supabase setup guide and env example files

## Current operational note

Right now the project is in a good handoff state.

What is ready:

1. preview parsing without DB
2. DB persistence code path when `DATABASE_URL` is configured
3. import listing when `DATABASE_URL` is configured
4. documentation for continuing in a fresh thread

What is not done yet:

1. real Supabase connection has not been verified in this repo yet
2. MG quote calculation engine is not implemented yet
3. admin UI is not implemented yet
4. fixture-based parity tests are not implemented yet

## Phase 1. Import foundation

Target:

Make workbook import reliable and versioned.

Status:

Mostly implemented in code, pending real DB verification.

Completed:

1. add `lenders` and `lender_products` tables
2. finish `POST /api/imports/preview`
3. implement `POST /api/imports`
4. store normalized import metadata and rows
5. add import status values such as previewed, validated, activated
6. add checksum generation in persistence service

Remaining:

1. verify against a real Supabase project
2. confirm migration/push flow on Supabase
3. add duplicate import handling policy beyond checksum generation
4. add active-version switching validation tests

Deliverable:

Admin can upload MG workbook and activate a version.

## Phase 2. MG calculator

Target:

Get full MG quote parity for at least one product first.

Tasks:

1. map canonical quote input shape
2. implement `운용리스` calculation service
3. add fixture tests against workbook scenarios
4. expose `POST /api/quotes/calculate`
5. return canonical quote output shape

Deliverable:

One product works end to end with workbook-backed data.

## Phase 3. MG product completion

Target:

Complete all MG products.

Tasks:

1. add `금융리스`
2. add `할부/오토론`
3. model product-specific warnings and restrictions
4. capture remaining `견적관리자용` policy cells

Deliverable:

MG is production-capable as the first lender.

## Phase 4. Admin UI

Target:

Build the minimum operations surface.

Tasks:

1. shadcn admin upload page
2. import preview table
3. import anomaly summary
4. activate/deactivate version flow
5. import history view
6. quote comparison tool for debug

Deliverable:

A non-developer can update monthly lender data.

## Phase 5. Shared quote UI

Target:

Build the customer-facing or staff-facing quoting surface.

Tasks:

1. shared quote form components
2. lender selector
3. product selector
4. vehicle search and dependent model fields
5. breakdown cards and printable result summary

Deliverable:

One UI can quote across lenders and products with configuration.

## Phase 6. Multi-lender framework

Target:

Make adding lenders systematic.

Status:

Started.

Completed:

1. lender adapter contract introduced in code
2. MG parser moved under lender-specific domain path
3. reusable import persistence path introduced
4. onboarding and blueprint docs created

Remaining:

1. create reusable validation fixture runner
2. define quote-calculator adapter contract
3. add second lender using the same structure

Deliverable:

Second lender can be added without architectural changes.

## Phase 7. Operational hardening

Target:

Prepare for real monthly operations.

Tasks:

1. access control for admin routes
2. audit logs for imports and activations
3. import failure alerts
4. result caching where safe
5. regression test suite in CI
6. rollback to previous workbook version

Deliverable:

Safe monthly production workflow.

## Immediate next priority

If work resumes in a fresh thread, do this in order:

1. connect the real Supabase `DATABASE_URL`
2. run Drizzle schema push or migration on Supabase
3. verify `GET /api/imports` and `POST /api/imports`
4. start MG `운용리스` calculation engine
5. add fixture-based validation against the workbook

## Future lender readiness checklist

We are ready to add a second lender only when:

1. MG import and activation are stable
2. canonical quote input/output is settled
3. lender adapter boundaries are explicit
4. fixture-based parity checks exist
