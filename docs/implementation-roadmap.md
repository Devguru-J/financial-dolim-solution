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
12. verified Supabase connection, migration, and workbook import on a real project
13. first MG `operating_lease` quote API backed by active workbook data

## Current operational note

Right now the project is in a good handoff state.

What is ready:

1. preview parsing without DB
2. DB persistence and import listing with verified Supabase connectivity
3. active workbook-backed MG `operating_lease` calculation
4. fixture-based Excel parity validation for multiple MG `operating_lease` scenarios
5. residual candidate summary and final residual override path for workbook parity
6. local `/playground` test page for quote iteration
7. documentation for continuing in a fresh thread
8. production API path no longer depends on launching Microsoft Excel
9. residual-company selection logic is moving toward a shared SNK/APS comparison path
10. quote engine and catalog preview now use closer residual-company selection logic for maximum residual display
11. playground UI redesigned into three focused sections: 차량 정보, 취득원가 산출, 견적 조건 — unnecessary fields hidden, key fields surfaced with better UX (2026-03-26)

What is not done yet:

1. all-model Excel parity is not finished yet
2. some hidden workbook fee/rate paths still need to be normalized into DB-backed rules
3. admin UI is not implemented yet
4. `financial_lease` and `installment_loan` are not implemented yet
5. frontend React migration not started yet (playground.ts still in use)

## Phase 1. Import foundation

Target:

Make workbook import reliable and versioned.

Status:

Implemented and verified against a real Supabase project.

Completed:

1. add `lenders` and `lender_products` tables
2. finish `POST /api/imports/preview`
3. implement `POST /api/imports`
4. store normalized import metadata and rows
5. add import status values such as previewed, validated, activated
6. add checksum generation in persistence service

Remaining:

1. add duplicate import handling policy beyond checksum generation
2. add active-version switching validation tests

Deliverable:

Admin can upload MG workbook and activate a version.

## Phase 2. MG calculator

Target:

Get full MG quote parity for at least one product first.

Status:

Advanced parity-hardening in progress with a DB-backed runtime path.

Completed:

1. canonical quote input and output shape for the first MG slice
2. `운용리스` calculation service using active workbook import data
3. `POST /api/quotes/calculate`
4. workbook-backed calculation verification using the local MG sample workbook
5. fixture bank for company/customer, upfront/deposit, mixed, and promo cases
6. hidden residual candidate summary for `에스앤케이`, `APS`, and `차봇`
7. final residual selection path through `selectedResidualRateOverride`
8. local `/playground` page for manual quote testing
9. removed Excel automation from the normal API calculation path
10. generalized `SNK/APS` residual-company candidate comparison for more models
11. catalog-side `max residual` preview now follows the same candidate-summary direction more closely
12. representative BENZ/BMW cases added to residual-company selection regression tests
13. monthly payment display now follows Excel quote-sheet `ROUNDUP(...,-2)` style output
14. playground UI rebuilt: 차량 정보 (Brand/Model/Trim 3-level, summary row), 취득원가 산출 (acquisition cost section), 견적 조건 (contract conditions with deposit/upfront mode toggle, auto residual fill) — 2026-03-26
15. fixture format extended to support end-to-end tests without rate overrides (baseIrrRate, resolvedMatrixGroup, maximumResidualRateOverride fields) — 2026-03-26
16. BMW X7 76.5M 60M 54.5% scenario verified end-to-end without overrides: CQ27 auto-computes 4.823% from 4.7% base rate via APS guarantee fee path, engine payment 913,092 → UI displays 913,100 matching Excel — 2026-03-26
17. fixture parity corrections: BENZ A200d resolvedMatrixGroup APS→SNK (apsBand=null vehicle), BMW X7 36m maximumResidualRateOverride 0.595→0.735 (aps36=0.63+promo0.025+boost0.08) — 2026-03-28
18. five new 60m model fixtures added and verified (BMW 520i/320d/X5/X3, BENZ E220d), total 33 fixtures all passing — 2026-03-28
    - BMW 520i: APS, gap=0.05 → 0.44% fee, displayedRate 4.823%
    - BMW 320d: APS, gap≥0.08 → 0% fee, displayedRate 4.705%
    - BMW X5 30d: APS, gap≥0.07 → 0% fee, displayedRate 4.702%
    - BMW X3 20d: SNK wins (snkPromo=0.015 → SNK max 0.585 > APS max 0.57), displayedRate 4.704%
    - BENZ E220d 4MATIC: APS wins tie, gap≥0.085 → 0% fee, displayedRate 4.703%
19. financedPrincipal bug fixed: was incorrectly subtracting upfrontPayment, now correctly equals gross acquisitionCost matching Excel CP17 — 2026-03-28
20. fixture bank expanded from 33 to 41: added 24m/48m term variants, deposit/upfront combos, customer ownership, 30k mileage (SNK 2% gap → 1.1% fee), BENZ E220d 36m — 2026-03-28
21. React frontend fully live: DashboardPage implemented (active workbook stats, brand catalog, ping-ring status); ImportPage fully implemented (drag-and-drop upload, preview, import, history); sidebar navigation replaces tab header — 2026-03-28
22. UI polish: fade-up/shimmer/ping-ring CSS animations, skeleton loaders, tactile button feedback, dot-grid background, min-h-[100dvh], number fonts changed to normal weight — 2026-03-28
23. 일반잔가 display updated to match Excel CI31: Math.floor(finalPrice × rate / 1000) × 1000 (roundDown -3) — 2026-03-29
24. ImportPage lender selector: dynamic dropdown fetching from /api/lenders, fetchLenders() added to api client — 2026-03-29
25. sidebar sticky fix: App root changed from min-h-[100dvh] to h-[100dvh] overflow-hidden so sidebar stays fixed during content scroll — 2026-03-29
26. removed unimplemented utility buttons from QuotePage ("엑셀 기본값 적용", "잔가 선택값 지우기") — 2026-03-29

Remaining:

1. add 36m variants for more models (BMW 520i, 320d, X5, X3)
2. add deposit/upfront scenarios for non-BMW models
3. model remaining hidden fee and exception rules that still create small payment deltas
4. complete the all-model residual-company selection verification path
5. build UI flow for confirming workbook-style final residual selection when needed

Deliverable:

One product works end to end with workbook-backed data, a DB-backed runtime path, and repeatable Excel parity checks.

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
7. residual candidate picker wired to `selectedResidualRateOverride`

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

1. complete React + Vite + Tailwind + shadcn client app setup in `client/` subfolder
2. migrate playground quote form to React components (shadcn Card, Badge, Table, etc.)
3. add 36m variants for the 5 newly added models (BMW 520i, 320d, X5, X3, BENZ E220d)
4. add deposit/upfront scenario fixtures for the new models
5. investigate customer ownership (개인명의) bug — potential cq8 offset gap between TypeScript and Excel for AUDI A3 customer fixture
6. model remaining hidden fee and exception rules in the MG calculator
7. start `financial_lease`

## Future lender readiness checklist

We are ready to add a second lender only when:

1. MG import and activation are stable
2. canonical quote input/output is settled
3. lender adapter boundaries are explicit
4. fixture-based parity checks exist
