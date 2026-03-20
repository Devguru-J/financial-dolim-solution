# Implementation Roadmap

## Objective

Move from the current MG-first scaffold to a production-ready multi-lender quote platform.

## Phase 0. Current state

Already done:

1. basic Bun + Hono + Drizzle + Cloudflare scaffold
2. initial MG workbook analysis
3. initial parser for `차량DB`, `잔가map`, and base brand rate rows

## Phase 1. Import foundation

Target:

Make workbook import reliable and versioned.

Tasks:

1. add `lenders` and `lender_products` tables
2. finish `POST /api/imports/preview`
3. implement `POST /api/imports`
4. store raw import metadata and normalized rows
5. add import status tracking such as previewed, validated, activated
6. add checksum-based duplicate detection

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
5. quote comparison tool for debug

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

Tasks:

1. define lender adapter contract in code
2. move MG code under `domain/quote/lenders/mg-capital`
3. create reusable import pipeline service
4. create reusable validation fixture runner
5. document lender adapter template

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

## Roadmap priorities

If we need a strict build order, use this order:

1. finish import persistence
2. finish MG operating lease calculator
3. add fixture tests
4. build admin upload and activation flow
5. complete remaining MG products
6. extract lender adapter abstraction
7. onboard second lender

## Future lender readiness checklist

We are ready to add a second lender only when:

1. MG import and activation are stable
2. canonical quote input/output is settled
3. lender adapter boundaries are explicit
4. fixture-based parity checks exist
