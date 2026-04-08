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
27. multi-lender E2E web flow: catalog queries merged across all active workbooks, stampDuty lender-specific defaults, mileage options 15k/40k for BNK, fetchModels mg-capital hardcode removed — 2026-04-04
28. single-command local dev: `bun run start` launches backend(8788) + frontend(5173) via scripts/dev.ts — 2026-04-04
29. MG 36m variant fixtures added: BMW 520i/320d/X5 30d/X3 20d + BENZ E220d Exclusive — 5 new Excel-verified fixtures (46 MG total) — 2026-04-05
30. BNK WS(웨스트) residual provider registered: BNK_PROVIDERS adds wsGrade (maxFee 1.32%); workbook-parser reads CDB col 10/11 for wsGrade/wsPGrade — 2026-04-05
31. Acquisition tax 4-mode UI exposed: automatic/ratio/reduction/amount — previously backend-only now surfaced in AcquisitionCostCard dropdown; BNK engine gains all 4 modes (was rateOverride only) — 2026-04-05
32. EV subsidy wired end-to-end: evSubsidyAmount added to Zod schema / CanonicalQuoteInput / both engines (subtracted from vehicle price like discount) / QuotePage payload — 2026-04-05
33. vehicleKey cross-lender matching: extractVehicleKey utility (BMW/BENZ/AUDI/VOLVO/LEXUS/GENESIS), both engines gain fallback (exact modelName first, then vehicleKey), 67 unit tests — 2026-04-08
34. BNK cross-brand fixtures: BENZ CLE53, AUDI A7, VOLVO XC40, BMW 520i 90M — Phase A IRR override, 17 BNK fixtures total — 2026-04-08
35. BNK RVs parser .xlsm fix: headerRow/dataRowStart offset corrected for blankrows:false — matrixGroups now BNK_9/BNK_S1 instead of BNK_0.61 — 2026-04-08
36. Trim dropdown MG-only filter: BNK vehicles (vehiclePrice=0) excluded from catalog model list — 2026-04-08
37. .xlsm upload support: ImportPage accept attribute extended — 2026-04-08
38. BNK dealer rate mapping: Cond left-side dealer→conditionType parsing (122 policies), dealer dropdown UI, default to 비제휴 — 2026-04-08
39. BNK guarantee fee lump-sum model: fee as PV addition (not rate), RATE back-calc for displayed rate, floating-point gap fix (ROUND 5 decimals) — 2026-04-08
40. 고잔가/일반잔가 toggle: residualMode replaces text input, MG +8% / BNK +7% boost, best-rate provider for fee calc — 2026-04-08
41. MG dev warnings suppressed (public bond, insurance, BK27 residual policy) — 2026-04-08

Remaining:

1. add 36m variants for more models (BMW 520i, 320d, X5, X3)
2. add deposit/upfront scenarios for non-BMW models
3. model remaining hidden fee and exception rules that still create small payment deltas
4. build UI flow for confirming workbook-style final residual selection when needed

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

Complete — BNK Capital onboarded as second lender (2026-04-04).

Completed:

1. lender adapter contract introduced in code
2. MG parser moved under lender-specific domain path
3. reusable import persistence path introduced
4. onboarding and blueprint docs created
5. BNK Capital fully onboarded: parser, adapter, engine, 13 parity fixtures — 2026-04-03
6. multi-lender catalog: brands/models API fetches across all active workbooks — 2026-04-04
7. multi-lender quote UI: parallel requests to all lenders, per-lender result cards — 2026-03-29
8. lender-specific defaults: stampDuty (MG=10000, BNK=0), mileage options, residual handling — 2026-04-04

Remaining:

1. create reusable validation fixture runner (currently each lender has its own test runner)

Deliverable:

Second lender can be added without architectural changes. ✅ Done — BNK proved the pattern.

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

1. **BNK 제휴사(딜러) 금리 매핑** — Cond 시트 좌측에 딜러별 conditionType 존재 (BMW-동성모터스→운용_세영=0.0521, BMW_비제휴→운용_기타브랜드=0.0681 등). 파서가 딜러별 conditionType을 추출하고, UI에 제휴사 드롭다운 추가, 엔진이 선택된 제휴사에 따라 baseIrr 결정. 데이터: Cond 시트 cols 2(brand)+3(dealer)+11(condType), 제조사별 선택표 시트 참조.
2. BNK WS(웨스트) validation fixture — WS engine registered (2026-04-05). Need CDB vehicle with wsGrade populated to prove Phase B auto-select.
3. add deposit/upfront scenario fixtures for non-BMW MG models (36m already covered)
4. model remaining hidden fee and exception rules in the MG calculator
5. start `금융리스` (financial lease)

## Future lender readiness checklist

We are ready to add a second lender only when:

1. MG import and activation are stable
2. canonical quote input/output is settled
3. lender adapter boundaries are explicit
4. fixture-based parity checks exist
