# Project Planning Docs

These documents are the long-term planning baseline for the lease calculator platform.

## Core docs

1. [Platform Blueprint](./platform-blueprint.md)
   - system shape for a multi-lender quote platform
   - runtime, DB, import, calculation, and deployment boundaries

2. [Lender Onboarding Playbook](./lender-onboarding-playbook.md)
   - step-by-step process for adding a new finance company
   - workbook analysis, parser design, validation, and release checklist

3. [Implementation Roadmap](./implementation-roadmap.md)
   - staged execution plan from current scaffold to production
   - includes current implementation status and immediate priorities

4. [MG Capital Implementation Plan](./mg-capital-implementation-plan.md)
   - lender-specific analysis for the first implementation target
   - includes workbook findings and current MG implementation coverage

5. [Supabase Setup](./supabase-setup.md)
   - how to connect the project to Supabase PostgreSQL
   - local env setup, migration flow, and import verification steps

## Current project status summary

As of 2026-03-22, the project already has:

1. repository root normalized to `financial-dolim-solution`
2. Bun + Hono + Drizzle + Cloudflare Pages scaffold in the repository root
3. MG Capital workbook parser for vehicle rows, residual matrices, and base rate policies
4. lender adapter structure for future multi-lender expansion
5. workbook import preview API
6. workbook import persistence service
7. import listing API
8. verified Supabase connection and Drizzle migration flow
9. first MG Capital `operating_lease` quote calculation API backed by active workbook data
10. Drizzle migration files for the current schema
11. fixture-based Excel parity tests and hidden residual candidate tracing
12. `/playground` page for local quote testing and residual selection verification
13. normal web calculation path no longer launches Microsoft Excel
14. shared residual-company selection logic being hardened across models
15. Korean README and planning docs for handoff continuity

## How to use these docs

1. Read `Platform Blueprint` before changing architecture.
2. Use `Lender Onboarding Playbook` whenever a new monthly workbook or a new lender is added.
3. Use `Implementation Roadmap` to decide what to build next.
4. Use `Supabase Setup` when connecting a real Supabase project.
5. Keep lender-specific discoveries in a dedicated `<lender>-implementation-plan.md` file.
6. For current MG work, treat `candidateSummary` and `selectionGuide` as the bridge to the future quote UI.
7. Treat all-model Excel parity as still in progress, not complete.
