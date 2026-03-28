# React + shadcn/ui Migration Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Replace `src/playground.ts` (HTML-in-string) with a `client/` React + Vite + Tailwind + shadcn/ui app

---

## Objective

Migrate the existing operating lease quote UI from a monolithic HTML-string file (`src/playground.ts`, ~3000 lines) to a React + shadcn/ui component-based app. The backend Hono API is unchanged. All existing functionality, form fields, and calculation results must remain identical — this is a visual and structural refactor only.

---

## Constraints

1. **No calculation logic changes** — all math stays in `src/domain/lenders/mg-capital/operating-lease-service.ts`
2. **All form fields preserved** — every existing input, select, checkbox, radio must be carried over; hidden fields become React state
3. **All API contracts unchanged** — `POST /api/quotes/calculate`, `GET /api/catalog/brands`, `GET /api/catalog/models`, etc.
4. **Internal staff only** — no public auth, no user management needed
5. **Cloudflare Pages deployment** — Vite build output in `client/dist`, served as static assets
6. **잔가 후보 선택 panel intentionally removed** — the existing "잔가 후보 선택" card (candidate list / click-to-select) is not carried over. APS/SNK selection is handled automatically by `summarizeMgResidualCandidates` in the API. Only the winning result is displayed.

---

## Architecture

### Folder structure

```
financial-dolim-solution/
  src/              ← Hono API server (unchanged)
  functions/        ← Cloudflare Pages Functions (unchanged)
  client/           ← NEW: React + Vite + Tailwind + shadcn app
    src/
      pages/
        QuotePage.tsx       ← 견적 계산 tab
        ImportPage.tsx      ← 워크북 임포트 tab
      components/
        vehicle/
          VehicleInfoCard.tsx
        acquisition/
          AcquisitionCostCard.tsx
        quote-conditions/
          QuoteConditionsCard.tsx
        results/
          QuoteResultCard.tsx
        ui/                 ← shadcn generated components
      hooks/
        useCatalog.ts       ← brand/model/trim fetch + state
        useQuote.ts         ← calculate API call + result state
      lib/
        utils.ts            ← shadcn cn() helper
        api.ts              ← typed fetch wrappers for /api/*
    index.html
    vite.config.ts
    tsconfig.json           ← browser/DOM-scoped, separate from root tsconfig
    tailwind.config.ts
    components.json         ← shadcn config
```

### Build integration

`wrangler.jsonc` → change `pages_build_output_dir` to `"client/dist"` **at Step 8 only** (after confirming the React app works end-to-end). Cloudflare Pages continues to discover the `functions/` directory from the repo root regardless of this setting — the Pages Functions routing is unaffected.

`client/vite.config.ts` → proxy `/api/*` to `http://localhost:8788` in dev mode. In development, run `bun run dev:pages` (wrangler, port 8788) and `bun run dev:client` (vite) in parallel.

> **Note:** `bun run dev` starts a non-wrangler local server (`src/local-dev.ts`). Use `bun run dev:pages` to start the wrangler Pages dev server on port 8788 for the Vite proxy target.

---

## Tab Navigation

Two tabs using shadcn `Tabs` component:

| Tab | Content |
|-----|---------|
| 견적 계산 | Quote form + result panel (default) |
| 워크북 임포트 | Workbook upload UI (existing import flow) |

---

## 견적 계산 Page Layout

Two-column layout: `grid-cols-[1fr_420px]`

### Left: Input form (3 cards + action buttons)

#### Card 1 — 차량 정보

4-column label/input grid (120px label, 1fr input, repeating):

| Label | Field | Notes |
|-------|-------|-------|
| Brand | Select | Populated from `GET /api/catalog/brands` |
| 차량 가격 | Number input | Editable; `quotedVehiclePrice` API field |
| Model | Select (disabled) | Placeholder for future multi-model support; not sent to API |
| 옵션 가격 | **Read-only display** | Populated from trim selection metadata (`optionAmountDisplay`); **not sent to API** |
| Trim | Select | Populated from `GET /api/catalog/models?brand=...`; triggers `syncSelectedModelMeta()` |
| 할인 가격 | Number input | Editable; `discountAmount` API field |

Summary info line (read-only text below grid):
- 기본차량가 · 차종 · 배기량 · 고잔가 가능 여부 · 프로모션

Summary stat cards (3-col grid, all read-only):
- **최종차량가** (`quotedVehiclePrice - discountAmount`)
- **일반잔가** (% and amount) — from `previewBaseResidualRate()`
- **최대(고)잔가** (% and amount) — from `previewMaximumResidualRate()`

#### Card 2 — 취득원가 산출

4-column label/field grid:

| Label | Field | Notes |
|-------|-------|-------|
| 취득세 감면 | Select (해당없음/감면) | Drives `acquisitionTaxRateOverride` state (0.07 or reduced) |
| 탁송료 | Checkbox + number input | `deliveryFee` |
| 취득세 포함 | Checkbox + computed display (green) | When checked: `acquisitionTaxRateOverride=0.07`; display shows computed tax amount |
| 부대비용 | Checkbox + number input | `miscFee` |
| 공채 할인 | Checkbox + number input | Checkbox → `includePublicBondCost` (bool); input → `publicBondCost` (number) |
| 취득원가 | Read-only display (green) | Computed total; displayed in `#sheet-acquisition-cost`; also shown as `financedPrincipal` after calculation |

#### Card 3 — 견적 조건

4-column label/field grid (5 rows):

| Label | Field | Notes |
|-------|-------|-------|
| 판매사 | Select (비활성/...) | `dealerName`; display-only, drives no direct API field |
| 기간(개월) | Select (12/24/36/48/60) | `leaseTermMonths`; **default 60** |
| 제휴수수료 | Radio (비해당/해당) | Drives `affiliateType` state: 비해당 → `"비제휴사"`, 해당 → `"KCC오토"` (the "해당" path is currently inert in playground.ts — the hidden field stays `"비제휴사"` regardless; carry over the radio but keep `"비제휴사"` as the only active value until this path is fully defined) |
| 약정거리 | Select (10k–35k, step 5k) | `annualMileageKm`; **default 20,000** |
| 보증금 | Mode toggle (금액/%) + input | Mode drives computation: `depositAmount = (vehiclePrice - discountAmount) × %/100`; final value stored as `depositAmount` |
| 잔존가치 | Percent string input (e.g. `54.5%`) | `selectedResidualRateOverride`; auto-populated with `maximumResidualRate` on trim selection; accepts manual override |
| 선납금 | Mode toggle (금액/%) + input | Same % computation as 보증금; final value stored as `upfrontPayment` |
| CM수수료 | Number input | `cmFeeRate`; default 0% |
| 전기차 보조금 | Radio (비해당/해당) + conditional input | Input visible only when "해당" selected; **currently UI-only — no `evSubsidy` field in `CanonicalQuoteInput`; the toggle/input is not sent to the API.** Carry over the UI toggle but omit from API payload until the API supports it. |
| AG수수료 | Number input | `agFeeRate`; default 0% |

**Advanced overrides** (collapsible `<details>` section below the grid, collapsed by default):

| Label | Field | Notes |
|-------|-------|-------|
| 유효 IRR override | Number input | `annualEffectiveRateOverride`; leave empty to use auto-calculated value |
| 월 납입률 override | Number input | `paymentRateOverride`; leave empty to use auto-calculated value |

> These two fields correspond to `annualIrrRateOverride` and `paymentRateOverride` in the API payload. They exist for workbook-parity debugging. In normal use, leave both empty.

#### Action buttons (below Card 3)

Three buttons in a row (or stacked if needed):

| Button | Behavior |
|--------|---------|
| 엑셀 기본값 적용 | Resets all override inputs to workbook defaults (calls `resetToWorkbookDefaults()` logic) |
| **견적 계산** | Primary submit; calls `POST /api/quotes/calculate`; full-width dark button |
| 잔가 선택값 지우기 | Clears `selectedResidualRateOverride` and triggers recalculation |

### Right: Result panel

shadcn `Card` with:
- Header row: 금융사 이름 + Badge tags (법인/개인명의, 일반잔가/고잔가, 매트릭스그룹)
- 2×2 result grid:
  - **월 납입금** (primary, blue) + 내부값 sub
  - **IRR** + 유효IRR sub
  - **잔가율** (%) + 잔가금액 (원) sub
  - **총 구매비용** + `월납입금×N개월+잔존가치` formula sub

**UI states:**

| State | Display |
|-------|---------|
| Initial / pre-calculate | Dashed placeholder card: "계산 전 상태" |
| Loading | 견적 계산 button shows spinner / disabled; result area shows skeleton or "계산 중..." text |
| Success | Full result card rendered |
| Error | Error message displayed below button (red); result area unchanged |
| Workbook diff | If user overrides differ from workbook defaults, show `#workbook-diff-warning` callout above result card |

---

## Data Flow

```
Component mount
  → useCatalog.fetchBrands() → GET /api/catalog/brands
  → populate Brand select

Brand select change
  → useCatalog.fetchModels(brand) → GET /api/catalog/models?brand=...
  → populate Trim select
  → call syncSelectedModelMeta() to fill residual previews

Trim select change
  → syncSelectedModelMeta():
      populate 옵션 가격 display (read-only)
      populate 최종차량가 / 일반잔가 / 최대잔가 summary cards
      auto-fill 잔존가치 with maximumResidualRate

견적 계산 button click
  → useQuote.calculate(formData) → POST /api/quotes/calculate
  → on success: render QuoteResultCard with 2x2 grid
  → on error: show error message

보증금/선납금 input change (% mode)
  → recompute amount = (vehiclePrice - discountAmount) × value / 100
  → update depositAmount / upfrontPayment state
  (also recompute when vehiclePrice or discountAmount changes)
```

---

## State: Hidden fields → React state

All fields that were `<input type="hidden">` in `playground.ts` become React state (not rendered as DOM inputs):

| State key | Default | Source |
|-----------|---------|--------|
| `affiliateType` | `"비제휴사"` | Radio 제휴수수료; always send Korean string to API |
| `ownershipType` | `'company'` | Fixed (법인) |
| `acquisitionTaxRateOverride` | `0.07` | 취득세 포함 checkbox toggle |
| `insuranceYearlyAmount` | `0` | Fixed |
| `lossDamageAmount` | `0` | Fixed |
| `stampDuty` | `10000` | Fixed |
| `depositAmount` | `0` | Computed from 보증금 input |
| `upfrontPayment` | `0` | Computed from 선납금 input |
| `residualAmountOverride` | `undefined` | Not exposed in UI by default |
| `annualIrrRateOverride` | `undefined` | Advanced override field |
| `paymentRateOverride` | `undefined` | Advanced override field |
| `directModelEntry` | `false` | Fixed |
| `manualVehicleClass` | `undefined` | Fixed |
| `manualEngineDisplacementCc` | `undefined` | Fixed |

---

## Testing Strategy

- Existing `bun test` fixture suite runs against the API — no changes needed
- Manual smoke test against 3 reference fixtures after migration: AUDI A3 36m, BMW X7 60m, BENZ A200d 36m
- No React unit tests in scope for this migration

---

## Migration Steps

1. Scaffold `client/` Vite + React + TypeScript + Tailwind + shadcn (run `bun create vite client -- --template react-ts`, then `cd client && bunx shadcn init`)
2. Add `client/tsconfig.json` scoped to `lib: ["dom", "es2020"]` (separate from root tsconfig which targets Cloudflare Workers)
3. Wire up `/api` proxy in `client/vite.config.ts` → `http://localhost:8788`
4. Add `dev:client` script to root `package.json`: `"dev:client": "cd client && bun run dev"`
5. Build `QuotePage` top-down: VehicleInfoCard → AcquisitionCostCard → QuoteConditionsCard → QuoteResultCard
6. Port each JS function from `playground.ts` as a hook or utility in `client/src/`
7. Verify against 3 reference fixtures via manual testing
8. Update `wrangler.jsonc` `pages_build_output_dir` to `"client/dist"`
9. Retire `src/playground.ts` (remove route in `src/app.ts`)

`playground.ts` stays in place and continues to work until Step 9 is confirmed.

---

## Out of Scope

- Auth / access control
- `금융리스` / `할부/오토론` products
- Admin UI (Phase 4 in roadmap)
- Second lender
- Automated React component tests
- 잔가 후보 선택 UI (intentionally removed — auto-selection handles APS/SNK choice)
