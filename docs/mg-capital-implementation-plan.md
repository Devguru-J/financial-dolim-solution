# MG Capital Lease Web Calculator Plan

## 1. Workbook analysis summary

The workbook `복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제.xlsx` is not just a printable quote form. It behaves like a compact quote engine with three layers:

1. Input and quote presentation sheets
   - `운용리스`
   - `금융리스`
   - `할부오토론`
   - `펀딩신청서`

2. Monthly policy and lookup data
   - `차량DB`: brand, model, displacement, class, invoice price, residuals by term, flags like `고잔가가능시 Y`, hybrid flag, residual promo code, residual group code
   - `잔가map`: residual lookup matrices such as `에스앤케이모터스`, `APS`
   - `견적관리자용`: brand-level IRR defaults, affiliate fee behavior, fee caps, extra costs, residual minimums, class mappings

3. Hidden calculation engine embedded in quote sheets
   - Shared hidden input cells live mainly around `BD:BQ`, `BY:BZ`, `CD:CI`, `CO:CQ`
   - Example core fields in `운용리스`:
     - customer/brand/model inputs in `BD4:BD36`
     - manual override switches in `CE*`
     - derived pricing and tax values in `CI*`
     - quote outputs and IRR cashflow values in `CP*`, `CQ*`, `CM*`

## 2. What should be uploaded monthly

The monthly upload should not be treated as a file we execute at runtime. It should be normalized into versioned tables:

1. Workbook version metadata
2. Vehicle program rows from `차량DB`
3. Residual matrix rows from `잔가map`
4. Brand/product fee and IRR rules from `견적관리자용`
5. Later, optional dealer mapping and regional tax overrides from quote-sheet hidden cells

This gives us a stable calculator where monthly changes are data-only.

## 3. Recommended stack decisions

### ORM recommendation

Use **Drizzle**, not Prisma.

Why:

1. Better fit for Bun and lightweight serverless code
2. SQL-first and easier to control for finance-grade calculations
3. Easier to keep schema, migrations, and typed inserts aligned with import jobs
4. More practical than Prisma on Cloudflare runtime

### Cloudflare + Supabase note

For production runtime on Cloudflare Pages Functions, direct Postgres connectivity should go through **Cloudflare Hyperdrive** in front of Supabase Postgres.

Recommended split:

1. Local migration/import scripts: Drizzle + direct `DATABASE_URL`
2. Production runtime: Drizzle-compatible Postgres access via Hyperdrive, or Supabase REST/RPC for selected flows if we need to avoid connection complexity

## 4. Target architecture

### Frontend

1. `shadcn/ui` based quote UI
2. Product tabs:
   - 운용리스
   - 금융리스
   - 할부/오토론
3. User inputs:
   - brand
   - model
   - trim/manual model input
   - vehicle price / option / discount / delivery fee
   - registration region
   - ownership type
   - lease term
   - prepayment / deposit / residual options
   - insurance/tax toggles where applicable
4. Output cards:
   - acquisition cost
   - tax
   - residual
   - monthly payment
   - effective IRR / displayed rate
   - fee breakdown

### API

1. `POST /api/imports/preview`
   - upload workbook
   - parse workbook
   - return normalized preview counts and sample rows
2. `POST /api/imports`
   - persist a new monthly version
   - optionally mark as active
3. `POST /api/quotes/calculate`
   - run domain calculator against active workbook version
4. `GET /api/catalog/models`
   - serve brand/model data for selectors

### DB core tables

1. `workbook_imports`
2. `vehicle_programs`
3. `residual_matrix_rows`
4. `brand_rate_policies`
5. `quote_snapshots`

## 5. Migration strategy from Excel formulas to code

We should not try to mirror every worksheet cell 1:1 in the app. Instead:

1. Preserve Excel as source-of-truth for monthly data
2. Rebuild the calculator as explicit TypeScript domain functions
3. Use workbook parsing to populate typed data tables
4. Cross-check TypeScript outputs against a handful of saved Excel scenarios

Implementation order:

1. Import parser
2. Normalized persistence
3. Catalog APIs
4. Quote domain calculator for `운용리스`
5. Validation against Excel snapshots
6. Add `금융리스`
7. Add `할부/오토론`

## 6. Important risks

1. Some hidden sheet logic contains business exceptions not yet covered by the first parser
2. Certain workbook formulas reference dealer-specific cases and caps embedded in scattered cells
3. Exact parity requires a scenario test set from the lender workbook

## 7. What was started in this scaffold

1. Bun + Hono + Drizzle + Cloudflare Pages project skeleton
2. Initial workbook preview endpoint
3. Initial parser for:
   - `차량DB`
   - `잔가map`
4. Initial Postgres schema draft for versioned imports and quote snapshots

## 8. Immediate next build slice

1. Persist import previews into Supabase
2. Parse `견적관리자용` into brand policy tables
3. Implement first `운용리스` quote calculation service
4. Build a small admin upload page and quote test page
