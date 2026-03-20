# Platform Blueprint

## Goal

Build a web-based lease quote platform that can support multiple finance companies using the same product foundation:

1. monthly lender workbook upload
2. normalized storage of lender data
3. lender-specific calculation engine
4. shared quote UI and shared admin workflows

The platform should let us add new lenders without rebuilding the whole system each time.

## Product principles

1. Excel is a monthly data source, not the runtime engine.
2. Every lender gets versioned data imports.
3. Calculation logic is code, not spreadsheet execution.
4. Shared concepts should be normalized once.
5. Lender-specific exceptions should be isolated in adapters and policy modules.
6. We must be able to compare web output against workbook output for regression checks.

## Recommended stack

1. Design system: `shadcn/ui`
2. Runtime: `Bun`
3. API server: `Hono`
4. Database and auth/storage: `Supabase`
5. SQL layer: `Drizzle`
6. Deploy target: `Cloudflare Pages Functions`

## High-level architecture

### 1. Admin import layer

Purpose:

1. upload workbook
2. inspect workbook structure
3. parse lender data
4. validate import quality
5. activate selected version

Main outputs:

1. versioned workbook import record
2. normalized lender data tables
3. validation report

### 2. Quote domain layer

Purpose:

1. receive user quote inputs
2. resolve active lender version
3. load lender policies and vehicle rows
4. run lender-specific calculator
5. return canonical quote result

Main outputs:

1. monthly payment
2. acquisition cost
3. tax and fee breakdown
4. residual and IRR details
5. warnings or restriction messages

### 3. Shared catalog layer

Purpose:

1. brand and model selector APIs
2. lender/product availability checks
3. residual matrix resolution
4. quote defaults by lender/product

### 4. Audit layer

Purpose:

1. keep quote snapshots
2. trace which workbook version created a quote
3. compare quote results across versions
4. support debugging when finance-company data changes

## Core data model

### Shared tables

1. `lenders`
   - lender code
   - display name
   - status

2. `lender_products`
   - lender
   - product type such as operating lease, financial lease, installment loan
   - active status

3. `workbook_imports`
   - lender
   - version label
   - source file metadata
   - checksum
   - import state
   - active flag

4. `vehicle_programs`
   - lender import version
   - brand/model
   - price
   - vehicle classification
   - flags such as hybrid/high residual

5. `residual_matrix_rows`
   - lender import version
   - residual matrix group
   - grade/band code
   - term
   - residual rate

6. `brand_rate_policies`
   - lender import version
   - brand
   - product type
   - ownership type
   - base rate / IRR
   - fee modes

7. `quote_snapshots`
   - lender import version
   - quote input
   - quote output
   - created time

### Lender-specific extension tables

These should exist only when a lender has rules that cannot fit well in generic shared tables.

Examples:

1. dealer commission matrices
2. regional tax overrides
3. residual guarantee programs
4. lender-specific fee caps or waiver tables

## Code organization target

Recommended folder shape:

```text
src/
  app/
  db/
  domain/
    quote/
      core/
      shared/
      lenders/
        mg-capital/
        bnk-capital/
  lib/
    excel/
    imports/
    validation/
  modules/
    admin-imports/
    quotes/
    catalog/
```

### Important rule

Do not scatter lender logic everywhere.

Each lender should own:

1. workbook parser adapter
2. normalized mapping rules
3. calculator implementation
4. validation fixtures

## Import pipeline standard

Every lender import should follow the same steps:

1. upload raw workbook
2. identify lender adapter
3. parse workbook into raw extracted payload
4. normalize payload into shared tables
5. run validation rules
6. show preview and anomalies
7. persist version
8. activate version

## Calculation engine standard

All lenders should return a canonical result shape even if internal formulas differ.

Canonical quote result should include:

1. lender code
2. product type
3. workbook version
4. resolved vehicle row
5. major input values
6. fees and taxes
7. residual amount and rate
8. monthly payment
9. displayed rate and internal rate
10. warnings and restriction flags

## Validation strategy

We should maintain a fixture bank per lender.

Each fixture should contain:

1. workbook version
2. input scenario
3. expected output from Excel
4. acceptable tolerance

This is required before expanding to many lenders safely.

## Deployment notes

1. Cloudflare Pages Functions should host the API.
2. Supabase is the source of persistent truth.
3. For production direct Postgres from Cloudflare, plan for Hyperdrive or another supported secure path.
4. Admin import routes should be protected separately from public quote routes.

## Non-goals

1. running uploaded Excel formulas in production for every quote
2. storing all spreadsheet cell addresses as the domain model
3. making one giant generic formula engine that hides lender intent

## Architectural success criteria

We are done when:

1. a lender workbook can be uploaded monthly without code changes for ordinary data updates
2. quote parity is testable against Excel fixtures
3. new lenders can be added as adapters without rewriting the whole platform
4. the admin can see which workbook version is active and when it changed
