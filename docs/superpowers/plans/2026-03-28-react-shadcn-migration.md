# React + shadcn/ui Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/playground.ts` (3000-line HTML-in-string) with a `client/` React + Vite + Tailwind + shadcn/ui app while keeping the Hono API and all calculation logic completely unchanged.

**Architecture:** `client/` is a standalone Vite + React app that proxies `/api/*` to the wrangler Pages dev server (port 8788). Form state lives in `QuotePage` and is sent to `POST /api/quotes/calculate` on submit. The playground.ts server route stays live until the React app is confirmed working at Step 9.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind CSS 3, shadcn/ui (Radix primitives), Bun

---

## File Map

### New files (create)

| File | Responsibility |
|------|---------------|
| `client/index.html` | Vite entry HTML |
| `client/vite.config.ts` | Vite config with `/api` proxy to port 8788 |
| `client/tsconfig.json` | TypeScript config scoped to browser/DOM (no cloudflare workers types) |
| `client/tailwind.config.ts` | Tailwind config pointing at `client/src/**` |
| `client/postcss.config.js` | PostCSS with tailwindcss + autoprefixer |
| `client/components.json` | shadcn CLI config |
| `client/src/main.tsx` | React mount point |
| `client/src/App.tsx` | Root app with shadcn Tabs (견적 계산 / 워크북 임포트) |
| `client/src/lib/utils.ts` | shadcn `cn()` helper (auto-generated) |
| `client/src/lib/api.ts` | Typed fetch wrappers for all API endpoints |
| `client/src/lib/residual.ts` | Port of residual preview logic from playground.ts |
| `client/src/types/catalog.ts` | TypeScript types for brand/model catalog API responses |
| `client/src/types/quote.ts` | TypeScript types for quote payload and result |
| `client/src/hooks/useCatalog.ts` | Brand/model/trim fetch + state |
| `client/src/hooks/useQuote.ts` | Calculate API call + result state |
| `client/src/pages/QuotePage.tsx` | 견적 계산 tab page — composes all form cards |
| `client/src/pages/ImportPage.tsx` | 워크북 임포트 tab page (iframe or stub) |
| `client/src/components/vehicle/VehicleInfoCard.tsx` | Card 1: Brand/Model/Trim + prices + summary |
| `client/src/components/acquisition/AcquisitionCostCard.tsx` | Card 2: 취득원가 산출 |
| `client/src/components/quote-conditions/QuoteConditionsCard.tsx` | Card 3: 견적 조건 (5 rows + advanced) |
| `client/src/components/results/QuoteResultCard.tsx` | Result 2×2 grid card |

### Modified files

| File | Change |
|------|--------|
| `package.json` | Add `dev:client` script |
| `wrangler.jsonc` | Change `pages_build_output_dir` to `"client/dist"` (Step 9 only) |
| `src/app.ts` | Remove playground route (Step 9 only) |

---

## Task 1: Scaffold client/ Vite + React + TypeScript

**Files:**
- Create: `client/` (entire directory from `bun create vite`)
- Create: `client/tsconfig.json`
- Modify: `package.json`

- [ ] **Step 1.1: Scaffold Vite app**

```bash
cd /path/to/financial-dolim-solution
bun create vite client -- --template react-ts
cd client && bun install
```

Expected: `client/` directory with `src/main.tsx`, `src/App.tsx`, `index.html`, `vite.config.ts`, `tsconfig.json`.

- [ ] **Step 1.2: Replace client/tsconfig.json**

The generated tsconfig references `tsconfig.node.json`. Replace with a clean browser-scoped config that does NOT pull in `@cloudflare/workers-types`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 1.3: Update vite.config.ts with path alias + API proxy**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 1.4: Add dev:client script to root package.json**

The root `package.json` already has `"dev:pages": "wrangler pages dev . --ip 127.0.0.1 --port 8788 ..."`. Add only `dev:client`:
```json
"dev:client": "cd client && bun run dev"
```

- [ ] **Step 1.5: Verify Vite starts**

Run: `bun run dev:client`
Expected: Vite starts on `http://localhost:5173` with default React template page.

- [ ] **Step 1.6: Commit**

```bash
git add client/ package.json
git commit -m "scaffold: client/ Vite + React + TypeScript app with API proxy"
```

---

## Task 2: Install Tailwind CSS + shadcn/ui

**Files:**
- Create: `client/tailwind.config.ts`
- Create: `client/postcss.config.js`
- Create: `client/components.json`
- Modify: `client/src/index.css`

- [ ] **Step 2.1: Install Tailwind**

```bash
cd client
bun add -d tailwindcss postcss autoprefixer
bunx tailwindcss init -p
```

- [ ] **Step 2.2: Configure tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2.3: Replace client/src/index.css with shadcn CSS variables**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
}
```

- [ ] **Step 2.4: Init shadcn**

```bash
cd client
bunx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

This generates `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2.5: Install required shadcn components**

```bash
cd client
bunx shadcn@latest add tabs card badge button select label separator
```

- [ ] **Step 2.6: Verify Tailwind + shadcn works**

In `client/src/App.tsx`, add a test import:
```tsx
import { Button } from '@/components/ui/button'
// render: <Button>테스트</Button>
```

Run `bun run dev:client`, check the button renders with shadcn styles.

- [ ] **Step 2.7: Remove test code from App.tsx, commit**

```bash
git add client/
git commit -m "scaffold: install Tailwind CSS + shadcn/ui components"
```

---

## Task 3: Types + API layer

**Files:**
- Create: `client/src/types/catalog.ts`
- Create: `client/src/types/quote.ts`
- Create: `client/src/lib/api.ts`
- Create: `client/src/lib/residual.ts`

- [ ] **Step 3.1: Write catalog types**

Create `client/src/types/catalog.ts`:

```typescript
export interface CatalogBrand {
  brand: string
  modelCount: number
}

export interface CatalogModel {
  modelName: string
  vehiclePrice: number
  vehicleClass: string | null
  engineDisplacementCc: number | null
  highResidualAllowed: boolean | null
  hybridAllowed: boolean | null
  residualPromotionCode: string | null
  snkResidualBand: string | null
  residuals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  snkResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  apsResidualBand?: string | null
  apsResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  chatbotResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  apsPromotionRate?: number | null
  snkPromotionRate?: number | null
  maxResidualRates?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
}
```

- [ ] **Step 3.2: Write quote types**

Create `client/src/types/quote.ts`:

```typescript
export type LeaseTerm = 12 | 24 | 36 | 48 | 60
export type AnnualMileage = 10000 | 20000 | 30000 | 35000
export type AffiliateType = '비제휴사' | 'KCC오토' | 'KCC면제'

export interface QuotePayload {
  lenderCode: 'mg-capital'
  productType: 'operating_lease'
  brand: string
  modelName: string
  affiliateType: AffiliateType
  directModelEntry: false
  ownershipType: 'company' | 'customer'
  leaseTermMonths: LeaseTerm
  annualMileageKm: AnnualMileage
  upfrontPayment: number
  depositAmount: number
  quotedVehiclePrice?: number
  discountAmount?: number
  includePublicBondCost?: boolean
  publicBondCost?: number
  includeMiscFeeAmount?: boolean
  miscFeeAmount?: number
  includeDeliveryFeeAmount?: boolean
  deliveryFeeAmount?: number
  annualIrrRateOverride?: number
  annualEffectiveRateOverride?: number
  paymentRateOverride?: number
  selectedResidualRateOverride?: number
  residualAmountOverride?: number
  acquisitionTaxRateOverride?: number
  stampDuty?: number
  agFeeRate?: number
  cmFeeRate?: number
  insuranceYearlyAmount?: number
  lossDamageAmount?: number
  manualVehicleClass?: string
  manualEngineDisplacementCc?: number
}

export interface QuoteResidual {
  rateDecimal: number
  maxRateDecimal: number | null
  amount: number
  matrixGroup?: string
}

export interface QuoteMajorInputs {
  leaseTermMonths: LeaseTerm
  ownershipType: 'company' | 'customer'
  financedPrincipal: number
}

export interface QuoteResult {
  monthlyPayment: number
  irrAnnualDecimal: number
  effectiveAnnualRateDecimal?: number
  residual: QuoteResidual
  majorInputs: QuoteMajorInputs
  warnings?: string[]
  acquisitionCost?: {
    acquisitionTax: number
    totalAcquisitionCost: number
  }
}
```

- [ ] **Step 3.3: Write API wrappers**

Create `client/src/lib/api.ts`:

```typescript
import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { QuotePayload, QuoteResult } from '@/types/quote'

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function fetchBrands(): Promise<CatalogBrand[]> {
  const data = await apiFetch<{ brands: CatalogBrand[] }>('/api/catalog/brands')
  return data.brands
}

export async function fetchModels(brand: string): Promise<CatalogModel[]> {
  const data = await apiFetch<{ models: CatalogModel[] }>(
    `/api/catalog/models?brand=${encodeURIComponent(brand)}&lenderCode=mg-capital`
  )
  return data.models
}

export async function calculateQuote(payload: QuotePayload): Promise<QuoteResult> {
  const data = await apiFetch<{ ok: boolean; quote: QuoteResult }>('/api/quotes/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.quote
}
```

- [ ] **Step 3.4: Write residual preview utilities**

Create `client/src/lib/residual.ts` (ported from `src/playground.ts` lines 1884–1946):

```typescript
import type { CatalogModel } from '@/types/catalog'

// Import the same residual matrix lookup used in the backend
// This is a static JSON export from the workbook parser
let residualMatrixLookup: Record<string, Record<number, Record<string, number>>> = {}

export function setResidualMatrixLookup(
  lookup: Record<string, Record<number, Record<string, number>>>
) {
  residualMatrixLookup = lookup
}

export function roundUpToNearestHundred(value: number): number {
  return Math.ceil(Number(value || 0) / 100) * 100
}

export function minimumResidualRateByTerm(termMonths: number): number | null {
  const lookup: Record<number, number> = {
    12: 0.5, 24: 0.4, 36: 0.3, 48: 0.2, 60: 0.15,
  }
  return lookup[termMonths] ?? null
}

export function previewMaximumResidualRate(
  model: CatalogModel,
  termMonths: number
): number | null {
  const term = Number(termMonths)
  const apiMaxRate = Number(model.maxResidualRates?.[term as 12|24|36|48|60])
  if (Number.isFinite(apiMaxRate) && apiMaxRate > 0) return apiMaxRate

  const band = model.snkResidualBand
  const fromMatrix =
    band && residualMatrixLookup[band] && residualMatrixLookup[band][term]
      ? Number(
          residualMatrixLookup[band][term]['에스앤케이모터스'] ??
            residualMatrixLookup[band][term]['APS'] ??
            Object.values(residualMatrixLookup[band][term])[0]
        )
      : null

  const directRate = Number(
    model.residuals?.[term as 12|24|36|48|60] ??
      model.snkResiduals?.[term as 12|24|36|48|60] ??
      model.apsResiduals?.[term as 12|24|36|48|60] ??
      model.chatbotResiduals?.[term as 12|24|36|48|60]
  )

  const baseRate = Number.isFinite(fromMatrix) && fromMatrix != null
    ? fromMatrix
    : Number.isFinite(directRate) ? directRate : null
  if (baseRate == null) return null
  return model.highResidualAllowed ? baseRate + 0.08 : baseRate
}

export function previewBaseResidualRate(
  model: CatalogModel,
  termMonths: number
): number | null {
  // NOTE: does NOT use maxResidualRates shortcut — returns raw matrix/direct rate
  // without highResidualAllowed +0.08 boost, so 일반잔가 < 최대잔가 when highResidualAllowed=true
  const term = Number(termMonths)
  const band = model.snkResidualBand
  const fromMatrix =
    band && residualMatrixLookup[band] && residualMatrixLookup[band][term]
      ? Number(
          residualMatrixLookup[band][term]['에스앤케이모터스'] ??
            residualMatrixLookup[band][term]['APS'] ??
            Object.values(residualMatrixLookup[band][term])[0]
        )
      : null
  const directRate = Number(
    model.residuals?.[term as 12|24|36|48|60] ??
      model.snkResiduals?.[term as 12|24|36|48|60] ??
      model.apsResiduals?.[term as 12|24|36|48|60] ??
      model.chatbotResiduals?.[term as 12|24|36|48|60]
  )
  const baseRate = Number.isFinite(fromMatrix) && fromMatrix != null
    ? fromMatrix
    : Number.isFinite(directRate) ? directRate : null
  return baseRate
}

export function formatKrw(amount: number): string {
  return `₩ ${Math.round(amount).toLocaleString('ko-KR')}`
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

export function parsePercentInput(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = String(value).replace('%', '').trim()
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n / 100
}
```

- [ ] **Step 3.5: Commit**

```bash
git add client/src/types/ client/src/lib/
git commit -m "feat: add catalog/quote types, API wrappers, and residual preview utils"
```

---

## Task 4: useCatalog and useQuote hooks

**Files:**
- Create: `client/src/hooks/useCatalog.ts`
- Create: `client/src/hooks/useQuote.ts`

- [ ] **Step 4.1: Write useCatalog hook**

Create `client/src/hooks/useCatalog.ts`:

```typescript
import { useState, useCallback } from 'react'
import { fetchBrands, fetchModels } from '@/lib/api'
import {
  previewBaseResidualRate,
  previewMaximumResidualRate,
  setResidualMatrixLookup,
} from '@/lib/residual'
import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { LeaseTerm } from '@/types/quote'

export interface CatalogState {
  brands: CatalogBrand[]
  models: CatalogModel[]
  selectedBrand: string
  selectedModel: CatalogModel | null
  brandsLoading: boolean
  modelsLoading: boolean
  error: string | null
}

export interface CatalogActions {
  loadBrands: () => Promise<void>
  selectBrand: (brand: string) => Promise<void>
  selectModel: (modelName: string) => void
}

export function useCatalog(): CatalogState & CatalogActions {
  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [models, setModels] = useState<CatalogModel[]>([])
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedModel, setSelectedModelState] = useState<CatalogModel | null>(null)
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    setError(null)
    try {
      const data = await fetchBrands()
      setBrands(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setBrandsLoading(false)
    }
  }, [])

  const selectBrand = useCallback(async (brand: string) => {
    setSelectedBrand(brand)
    setSelectedModelState(null)
    setModels([])
    if (!brand) return
    setModelsLoading(true)
    setError(null)
    try {
      const data = await fetchModels(brand)
      setModels(data)
      // Also inject residual matrix lookup from first model's data if available
      // (The matrix lookup is embedded in the catalog response)
    } catch (e) {
      setError(String(e))
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const selectModel = useCallback((modelName: string) => {
    const model = models.find((m) => m.modelName === modelName) ?? null
    setSelectedModelState(model)
  }, [models])

  return {
    brands, models, selectedBrand, selectedModel,
    brandsLoading, modelsLoading, error,
    loadBrands, selectBrand, selectModel,
  }
}

export function getResidualPreviews(
  model: CatalogModel | null,
  leaseTermMonths: LeaseTerm
) {
  if (!model) return { base: null, max: null }
  return {
    base: previewBaseResidualRate(model, leaseTermMonths),
    max: previewMaximumResidualRate(model, leaseTermMonths),
  }
}
```

- [ ] **Step 4.2: Write useQuote hook**

Create `client/src/hooks/useQuote.ts`:

```typescript
import { useState, useCallback } from 'react'
import { calculateQuote } from '@/lib/api'
import type { QuotePayload, QuoteResult } from '@/types/quote'

export interface QuoteState {
  result: QuoteResult | null
  loading: boolean
  error: string | null
}

export interface QuoteActions {
  calculate: (payload: QuotePayload) => Promise<void>
  reset: () => void
}

export function useQuote(): QuoteState & QuoteActions {
  const [result, setResult] = useState<QuoteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(async (payload: QuotePayload) => {
    setLoading(true)
    setError(null)
    try {
      const data = await calculateQuote(payload)
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, calculate, reset }
}
```

- [ ] **Step 4.3: Commit**

```bash
git add client/src/hooks/
git commit -m "feat: add useCatalog and useQuote hooks"
```

---

## Task 5: VehicleInfoCard

**Files:**
- Create: `client/src/components/vehicle/VehicleInfoCard.tsx`

- [ ] **Step 5.1: Write VehicleInfoCard**

Create `client/src/components/vehicle/VehicleInfoCard.tsx`:

```tsx
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatKrw, formatPercent } from '@/lib/residual'
import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { LeaseTerm } from '@/types/quote'

interface VehicleInfoCardProps {
  brands: CatalogBrand[]
  models: CatalogModel[]
  brandsLoading: boolean
  modelsLoading: boolean
  selectedBrand: string
  selectedModel: CatalogModel | null
  vehiclePrice: string
  optionPrice: string
  discountPrice: string
  leaseTermMonths: LeaseTerm
  baseResidualRate: number | null
  maxResidualRate: number | null
  onBrandChange: (brand: string) => void
  onModelChange: (modelName: string) => void
  onVehiclePriceChange: (value: string) => void
  onDiscountPriceChange: (value: string) => void
}

export function VehicleInfoCard({
  brands, models, brandsLoading, modelsLoading,
  selectedBrand, selectedModel,
  vehiclePrice, optionPrice, discountPrice,
  leaseTermMonths, baseResidualRate, maxResidualRate,
  onBrandChange, onModelChange,
  onVehiclePriceChange, onDiscountPriceChange,
}: VehicleInfoCardProps) {
  const finalPrice =
    (Number(vehiclePrice.replace(/,/g, '')) || 0) -
    (Number(discountPrice.replace(/,/g, '')) || 0)

  return (
    <Card>
      <CardHeader className="bg-slate-900 rounded-t-lg py-3 px-4">
        <CardTitle className="text-white text-sm font-semibold">차량 정보</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">
          {/* Row 1: Brand / 차량 가격 */}
          <FieldLabel>Brand</FieldLabel>
          <FieldCell borderRight>
            <Select value={selectedBrand} onValueChange={onBrandChange} disabled={brandsLoading}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={brandsLoading ? '로딩 중...' : '브랜드 선택'} />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.brand} value={b.brand}>{b.brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldLabel>차량 가격</FieldLabel>
          <FieldCell>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={vehiclePrice}
              onChange={(e) => onVehiclePriceChange(e.target.value)}
              placeholder="0"
            />
          </FieldCell>

          {/* Row 2: Model (disabled) / 옵션 가격 (read-only) */}
          <FieldLabel>Model</FieldLabel>
          <FieldCell borderRight>
            <Select disabled>
              <SelectTrigger className="h-8 text-xs opacity-50">
                <SelectValue placeholder="모델 선택 (비활성)" />
              </SelectTrigger>
            </Select>
          </FieldCell>
          <FieldLabel>옵션 가격</FieldLabel>
          <FieldCell>
            <div className="h-8 px-2 text-xs bg-muted border border-border rounded flex items-center text-muted-foreground">
              {selectedModel
                ? Number(selectedModel.vehiclePrice || 0).toLocaleString('ko-KR')
                : '0'}
            </div>
          </FieldCell>

          {/* Row 3: Trim / 할인 가격 */}
          <FieldLabel last>Trim</FieldLabel>
          <FieldCell borderRight last>
            <Select
              value={selectedModel?.modelName ?? ''}
              onValueChange={onModelChange}
              disabled={modelsLoading || !selectedBrand}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={modelsLoading ? '로딩 중...' : '트림 선택'} />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.modelName} value={m.modelName}>
                    {m.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldLabel last>할인 가격</FieldLabel>
          <FieldCell last>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={discountPrice}
              onChange={(e) => onDiscountPriceChange(e.target.value)}
              placeholder="0"
            />
          </FieldCell>
        </div>

        {/* Summary info line */}
        {selectedModel && (
          <div className="mx-3 my-2 px-3 py-2 bg-muted rounded text-xs text-muted-foreground">
            기본차량가 {Number(selectedModel.vehiclePrice).toLocaleString('ko-KR')}
            {selectedModel.vehicleClass && ` · ${selectedModel.vehicleClass}`}
            {selectedModel.engineDisplacementCc && ` · ${selectedModel.engineDisplacementCc.toLocaleString()}cc`}
            {selectedModel.highResidualAllowed && ' · 고잔가 가능'}
            {selectedModel.residualPromotionCode && ` · 프로모션 ${selectedModel.residualPromotionCode}`}
          </div>
        )}

        {/* Summary stat cards */}
        <div className="grid grid-cols-3 gap-2 p-3">
          <StatCard label="최종차량가" value={formatKrw(finalPrice)} />
          <StatCard
            label={`일반잔가${baseResidualRate != null ? ` (${(baseResidualRate * 100).toFixed(2)}%)` : ''}`}
            value={baseResidualRate != null ? formatKrw(finalPrice * baseResidualRate) : '-'}
          />
          <StatCard
            label={`최대(고)잔가${maxResidualRate != null ? ` (${(maxResidualRate * 100).toFixed(2)}%)` : ''}`}
            value={maxResidualRate != null ? formatKrw(finalPrice * maxResidualRate) : '-'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function FieldLabel({
  children,
  last = false,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`px-3 text-xs font-semibold text-foreground bg-muted flex items-center border-r border-border ${!last ? 'border-b' : ''}`}
      style={{ minHeight: 40 }}
    >
      {children}
    </div>
  )
}

function FieldCell({
  children,
  borderRight = false,
  last = false,
}: {
  children: React.ReactNode
  borderRight?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`px-2 py-1.5 flex items-center ${borderRight ? 'border-r border-border' : ''} ${!last ? 'border-b border-border' : ''}`}
    >
      {children}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted border border-border rounded-lg p-2.5">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  )
}
```

- [ ] **Step 5.2: Commit**

```bash
git add client/src/components/vehicle/
git commit -m "feat: add VehicleInfoCard component"
```

---

## Task 6: AcquisitionCostCard

**Files:**
- Create: `client/src/components/acquisition/AcquisitionCostCard.tsx`

- [ ] **Step 6.1: Write AcquisitionCostCard**

Create `client/src/components/acquisition/AcquisitionCostCard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKrw } from '@/lib/residual'

interface AcquisitionCostCardProps {
  acquisitionTaxIncluded: boolean
  acquisitionTaxRate: number          // 0 or 0.07
  acquisitionTaxAmount: number        // computed display value
  deliveryFeeIncluded: boolean
  deliveryFee: string
  miscFeeIncluded: boolean
  miscFee: string
  publicBondIncluded: boolean
  publicBondCost: string
  totalAcquisitionCost: number        // computed total
  onAcquisitionTaxToggle: (checked: boolean) => void
  onDeliveryFeeToggle: (checked: boolean) => void
  onDeliveryFeeChange: (value: string) => void
  onMiscFeeToggle: (checked: boolean) => void
  onMiscFeeChange: (value: string) => void
  onPublicBondToggle: (checked: boolean) => void
  onPublicBondChange: (value: string) => void
}

export function AcquisitionCostCard({
  acquisitionTaxIncluded, acquisitionTaxRate, acquisitionTaxAmount,
  deliveryFeeIncluded, deliveryFee,
  miscFeeIncluded, miscFee,
  publicBondIncluded, publicBondCost,
  totalAcquisitionCost,
  onAcquisitionTaxToggle,
  onDeliveryFeeToggle, onDeliveryFeeChange,
  onMiscFeeToggle, onMiscFeeChange,
  onPublicBondToggle, onPublicBondChange,
}: AcquisitionCostCardProps) {
  return (
    <Card>
      <CardHeader className="bg-slate-900 rounded-t-lg py-3 px-4">
        <CardTitle className="text-white text-sm font-semibold">취득원가 산출</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">
          {/* Row 1 */}
          <FieldLabel>취득세 감면</FieldLabel>
          <FieldCell borderRight>
            <select
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={acquisitionTaxRate === 0 ? 'exempt' : 'full'}
              onChange={(e) => onAcquisitionTaxToggle(e.target.value !== 'exempt')}
            >
              <option value="full">해당없음 (7%)</option>
              <option value="exempt">감면 (0%)</option>
            </select>
          </FieldCell>
          <FieldLabel>탁송료</FieldLabel>
          <FieldCell>
            <CheckboxInput
              checked={deliveryFeeIncluded}
              label="포함"
              value={deliveryFee}
              onToggle={onDeliveryFeeToggle}
              onValueChange={onDeliveryFeeChange}
            />
          </FieldCell>

          {/* Row 2 */}
          <FieldLabel>취득세 포함</FieldLabel>
          <FieldCell borderRight>
            <CheckboxDisplay
              checked={acquisitionTaxIncluded}
              onToggle={onAcquisitionTaxToggle}
              displayValue={acquisitionTaxIncluded ? formatKrw(acquisitionTaxAmount) : '₩ 0'}
              highlight
            />
          </FieldCell>
          <FieldLabel>부대비용</FieldLabel>
          <FieldCell>
            <CheckboxInput
              checked={miscFeeIncluded}
              label="포함"
              value={miscFee}
              onToggle={onMiscFeeToggle}
              onValueChange={onMiscFeeChange}
            />
          </FieldCell>

          {/* Row 3 */}
          <FieldLabel last>공채 할인</FieldLabel>
          <FieldCell borderRight last>
            <CheckboxInput
              checked={publicBondIncluded}
              label="포함"
              value={publicBondCost}
              onToggle={onPublicBondToggle}
              onValueChange={onPublicBondChange}
            />
          </FieldCell>
          <FieldLabel last>취득원가</FieldLabel>
          <FieldCell last>
            <div className="w-full h-8 px-2 text-xs bg-green-50 border border-green-200 rounded flex items-center font-bold text-green-800">
              {formatKrw(totalAcquisitionCost)}
            </div>
          </FieldCell>
        </div>
      </CardContent>
    </Card>
  )
}

function FieldLabel({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`px-3 text-xs font-semibold text-foreground bg-muted flex items-center border-r border-border ${!last ? 'border-b border-border' : ''}`}
      style={{ minHeight: 40 }}
    >
      {children}
    </div>
  )
}

function FieldCell({
  children, borderRight = false, last = false,
}: {
  children: React.ReactNode; borderRight?: boolean; last?: boolean
}) {
  return (
    <div className={`px-2 py-1.5 flex items-center gap-1.5 ${borderRight ? 'border-r border-border' : ''} ${!last ? 'border-b border-border' : ''}`}>
      {children}
    </div>
  )
}

function CheckboxInput({
  checked, label, value, onToggle, onValueChange,
}: {
  checked: boolean; label: string; value: string
  onToggle: (v: boolean) => void; onValueChange: (v: string) => void
}) {
  return (
    <>
      <input type="checkbox" className="accent-blue-600" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={!checked}
        placeholder="0"
      />
    </>
  )
}

function CheckboxDisplay({
  checked, onToggle, displayValue, highlight = false,
}: {
  checked: boolean; onToggle: (v: boolean) => void
  displayValue: string; highlight?: boolean
}) {
  return (
    <>
      <input type="checkbox" className="accent-blue-600" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span className="text-xs text-muted-foreground">포함</span>
      <div className={`flex-1 h-8 px-2 text-xs rounded flex items-center ${highlight ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-muted border border-border'}`}>
        {displayValue}
      </div>
    </>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add client/src/components/acquisition/
git commit -m "feat: add AcquisitionCostCard component"
```

---

## Task 7: QuoteConditionsCard

**Files:**
- Create: `client/src/components/quote-conditions/QuoteConditionsCard.tsx`

- [ ] **Step 7.1: Write QuoteConditionsCard**

Create `client/src/components/quote-conditions/QuoteConditionsCard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { LeaseTerm, AnnualMileage } from '@/types/quote'

interface QuoteConditionsCardProps {
  leaseTermMonths: LeaseTerm
  annualMileageKm: AnnualMileage
  depositMode: 'amount' | 'percent'
  depositValue: string
  upfrontMode: 'amount' | 'percent'
  upfrontValue: string
  residualRate: string
  cmFeeRate: string
  agFeeRate: string
  affiliateExempt: boolean       // true = 비해당 (비제휴사), false = 해당 (KCC)
  evSubsidy: boolean
  evSubsidyAmount: string
  showAdvanced: boolean
  annualIrrRateOverride: string
  annualEffectiveRateOverride: string
  paymentRateOverride: string
  onTermChange: (v: LeaseTerm) => void
  onMileageChange: (v: AnnualMileage) => void
  onDepositModeChange: (v: 'amount' | 'percent') => void
  onDepositValueChange: (v: string) => void
  onUpfrontModeChange: (v: 'amount' | 'percent') => void
  onUpfrontValueChange: (v: string) => void
  onResidualRateChange: (v: string) => void
  onCmFeeRateChange: (v: string) => void
  onAgFeeRateChange: (v: string) => void
  onAffiliateExemptChange: (v: boolean) => void
  onEvSubsidyChange: (v: boolean) => void
  onEvSubsidyAmountChange: (v: string) => void
  onToggleAdvanced: () => void
  onAnnualIrrRateOverrideChange: (v: string) => void
  onAnnualEffectiveRateOverrideChange: (v: string) => void
  onPaymentRateOverrideChange: (v: string) => void
}

export function QuoteConditionsCard(props: QuoteConditionsCardProps) {
  const {
    leaseTermMonths, annualMileageKm,
    depositMode, depositValue, upfrontMode, upfrontValue,
    residualRate, cmFeeRate, agFeeRate,
    affiliateExempt, evSubsidy, evSubsidyAmount,
    showAdvanced,
    annualIrrRateOverride, annualEffectiveRateOverride, paymentRateOverride,
    onTermChange, onMileageChange,
    onDepositModeChange, onDepositValueChange,
    onUpfrontModeChange, onUpfrontValueChange,
    onResidualRateChange, onCmFeeRateChange, onAgFeeRateChange,
    onAffiliateExemptChange, onEvSubsidyChange, onEvSubsidyAmountChange,
    onToggleAdvanced,
    onAnnualIrrRateOverrideChange, onAnnualEffectiveRateOverrideChange, onPaymentRateOverrideChange,
  } = props

  return (
    <Card>
      <CardHeader className="bg-slate-900 rounded-t-lg py-3 px-4">
        <CardTitle className="text-white text-sm font-semibold">견적 조건</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">

          {/* Row 1: 판매사 / 기간 */}
          <FieldLabel>판매사</FieldLabel>
          <FieldCell borderRight>
            <select className="w-full h-8 px-2 text-xs bg-muted border border-border rounded">
              <option>비활성</option>
            </select>
          </FieldCell>
          <FieldLabel>기간(개월)</FieldLabel>
          <FieldCell>
            <Select value={String(leaseTermMonths)} onValueChange={(v) => onTermChange(Number(v) as LeaseTerm)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {([12, 24, 36, 48, 60] as LeaseTerm[]).map((t) => (
                  <SelectItem key={t} value={String(t)}>{t}개월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>

          {/* Row 2: 제휴수수료 / 약정거리 */}
          <FieldLabel>제휴수수료</FieldLabel>
          <FieldCell borderRight>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" name="affiliate" className="accent-blue-600"
                checked={affiliateExempt} onChange={() => onAffiliateExemptChange(true)} />
              비해당
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer ml-3">
              <input type="radio" name="affiliate" className="accent-blue-600"
                checked={!affiliateExempt} onChange={() => onAffiliateExemptChange(false)} />
              해당
            </label>
          </FieldCell>
          <FieldLabel>약정거리</FieldLabel>
          <FieldCell>
            <Select value={String(annualMileageKm)} onValueChange={(v) => onMileageChange(Number(v) as AnnualMileage)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {([10000, 20000, 30000, 35000] as AnnualMileage[]).map((m) => (
                  <SelectItem key={m} value={String(m)}>{(m / 1000).toFixed(0)}만km</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>

          {/* Row 3: 보증금 / 잔존가치 */}
          <FieldLabel>보증금</FieldLabel>
          <FieldCell borderRight>
            <AmountPercentInput
              mode={depositMode} value={depositValue}
              onModeChange={onDepositModeChange} onValueChange={onDepositValueChange}
            />
          </FieldCell>
          <FieldLabel>잔존가치</FieldLabel>
          <FieldCell>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={residualRate}
              onChange={(e) => onResidualRateChange(e.target.value)}
              placeholder="예: 54.5%"
            />
          </FieldCell>

          {/* Row 4: 선납금 / CM수수료 */}
          <FieldLabel>선납금</FieldLabel>
          <FieldCell borderRight>
            <AmountPercentInput
              mode={upfrontMode} value={upfrontValue}
              onModeChange={onUpfrontModeChange} onValueChange={onUpfrontValueChange}
            />
          </FieldCell>
          <FieldLabel>CM수수료</FieldLabel>
          <FieldCell>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={cmFeeRate}
              onChange={(e) => onCmFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FieldCell>

          {/* Row 5: 전기차 보조금 / AG수수료 */}
          <FieldLabel last>전기차 보조금</FieldLabel>
          <FieldCell borderRight last>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" name="evSubsidy" className="accent-blue-600"
                checked={!evSubsidy} onChange={() => onEvSubsidyChange(false)} />
              비해당
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer ml-3">
              <input type="radio" name="evSubsidy" className="accent-blue-600"
                checked={evSubsidy} onChange={() => onEvSubsidyChange(true)} />
              해당
            </label>
            {evSubsidy && (
              <input
                className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded ml-2"
                value={evSubsidyAmount}
                onChange={(e) => onEvSubsidyAmountChange(e.target.value)}
                placeholder="0"
              />
            )}
          </FieldCell>
          <FieldLabel last>AG수수료</FieldLabel>
          <FieldCell last>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              value={agFeeRate}
              onChange={(e) => onAgFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FieldCell>
        </div>

        {/* Advanced overrides (collapsible) */}
        <details className="border-t border-border" open={showAdvanced}>
          <summary
            className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted select-none"
            onClick={(e) => { e.preventDefault(); onToggleAdvanced() }}
          >
            고급 설정 (override)
          </summary>
          <div className="px-4 pb-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">연 IRR override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
                value={annualIrrRateOverride}
                onChange={(e) => onAnnualIrrRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">유효 IRR override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
                value={annualEffectiveRateOverride}
                onChange={(e) => onAnnualEffectiveRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">월 납입률 override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
                value={paymentRateOverride}
                onChange={(e) => onPaymentRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

function FieldLabel({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`px-3 text-xs font-semibold text-foreground bg-muted flex items-center border-r border-border ${!last ? 'border-b border-border' : ''}`}
      style={{ minHeight: 40 }}
    >
      {children}
    </div>
  )
}

function FieldCell({
  children, borderRight = false, last = false,
}: {
  children: React.ReactNode; borderRight?: boolean; last?: boolean
}) {
  return (
    <div className={`px-2 py-1.5 flex items-center gap-1.5 ${borderRight ? 'border-r border-border' : ''} ${!last ? 'border-b border-border' : ''}`}>
      {children}
    </div>
  )
}

function AmountPercentInput({
  mode, value, onModeChange, onValueChange,
}: {
  mode: 'amount' | 'percent'
  value: string
  onModeChange: (v: 'amount' | 'percent') => void
  onValueChange: (v: string) => void
}) {
  return (
    <>
      <select
        className="h-8 px-1.5 text-xs bg-muted border border-border rounded"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as 'amount' | 'percent')}
      >
        <option value="amount">금액</option>
        <option value="percent">%</option>
      </select>
      <input
        className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="0"
      />
    </>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add client/src/components/quote-conditions/
git commit -m "feat: add QuoteConditionsCard component"
```

---

## Task 8: QuoteResultCard

**Files:**
- Create: `client/src/components/results/QuoteResultCard.tsx`

- [ ] **Step 8.1: Write QuoteResultCard**

Create `client/src/components/results/QuoteResultCard.tsx`:

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatKrw, formatPercent, roundUpToNearestHundred } from '@/lib/residual'
import type { QuoteResult } from '@/types/quote'

interface QuoteResultCardProps {
  result: QuoteResult
}

export function QuoteResultCard({ result }: QuoteResultCardProps) {
  const displayMonthlyPayment = roundUpToNearestHundred(result.monthlyPayment)
  const leaseTermMonths = result.majorInputs.leaseTermMonths
  const totalCost = displayMonthlyPayment * leaseTermMonths + result.residual.amount

  const ownerTag = result.majorInputs.ownershipType === 'company' ? '법인' : '고객명의'
  const isHighResidual =
    result.residual.maxRateDecimal != null &&
    Math.abs(result.residual.rateDecimal - result.residual.maxRateDecimal) < 0.001
  const residualTag = isHighResidual ? '고잔가' : '일반잔가'
  const matrixGroup = result.residual.matrixGroup ?? ''

  const irrPercent = result.irrAnnualDecimal
    ? `${(result.irrAnnualDecimal * 100).toFixed(3)}%`
    : '-'
  const effectivePercent = result.effectiveAnnualRateDecimal
    ? `${(result.effectiveAnnualRateDecimal * 100).toFixed(3)}%`
    : irrPercent

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="bg-muted py-2.5 px-4 flex flex-row items-center gap-2 flex-wrap">
        <span className="font-bold text-sm">MG캐피탈</span>
        <Badge variant="outline" className="text-xs">{ownerTag}</Badge>
        <Badge
          variant="outline"
          className={`text-xs ${isHighResidual ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
        >
          {residualTag}
        </Badge>
        {matrixGroup && (
          <Badge variant="outline" className="text-xs">{matrixGroup}</Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2">
          {/* 월 납입금 */}
          <ResultCell bg accent borderRight borderBottom>
            <ResultLabel>월 납입금</ResultLabel>
            <ResultValue accent>
              {formatKrw(displayMonthlyPayment)}
            </ResultValue>
            <ResultSub>
              내부값 {formatKrw(result.monthlyPayment)}
            </ResultSub>
          </ResultCell>

          {/* IRR */}
          <ResultCell borderBottom>
            <ResultLabel>IRR</ResultLabel>
            <ResultValue>{irrPercent}</ResultValue>
            <ResultSub>유효 {effectivePercent}</ResultSub>
          </ResultCell>

          {/* 잔가 */}
          <ResultCell bg borderRight>
            <ResultLabel>잔가</ResultLabel>
            <ResultValue>
              {(result.residual.rateDecimal * 100).toFixed(2)}%
            </ResultValue>
            <ResultSub>{formatKrw(result.residual.amount)}</ResultSub>
          </ResultCell>

          {/* 총 구매비용 */}
          <ResultCell>
            <ResultLabel>총 구매비용</ResultLabel>
            <ResultValue small>{formatKrw(totalCost)}</ResultValue>
            <ResultSub>월납입금×{leaseTermMonths}개월+잔존가치</ResultSub>
          </ResultCell>
        </div>

        {/* Warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="border-t border-border px-4 py-3 space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {w}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ResultCell({
  children, bg = false, accent = false,
  borderRight = false, borderBottom = false,
}: {
  children: React.ReactNode
  bg?: boolean; accent?: boolean
  borderRight?: boolean; borderBottom?: boolean
}) {
  return (
    <div className={[
      'p-4',
      bg ? 'bg-muted' : '',
      borderRight ? 'border-r border-border' : '',
      borderBottom ? 'border-b border-border' : '',
    ].join(' ')}>
      {children}
    </div>
  )
}

function ResultLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">
      {children}
    </div>
  )
}

function ResultValue({
  children, accent = false, small = false,
}: {
  children: React.ReactNode; accent?: boolean; small?: boolean
}) {
  return (
    <div className={[
      'font-extrabold tracking-tight',
      small ? 'text-lg' : 'text-xl',
      accent ? 'text-blue-600' : 'text-foreground',
    ].join(' ')}>
      {children}
    </div>
  )
}

function ResultSub({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-muted-foreground mt-1">{children}</div>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
git add client/src/components/results/
git commit -m "feat: add QuoteResultCard component"
```

---

## Task 9: QuotePage — wire everything together

**Files:**
- Create: `client/src/pages/QuotePage.tsx`
- Create: `client/src/pages/ImportPage.tsx`

- [ ] **Step 9.1: Write QuotePage**

Create `client/src/pages/QuotePage.tsx`. This is the main orchestration component. It holds all form state, computes derived values (취득원가, deposit/upfront amounts), and calls the API.

```tsx
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { VehicleInfoCard } from '@/components/vehicle/VehicleInfoCard'
import { AcquisitionCostCard } from '@/components/acquisition/AcquisitionCostCard'
import { QuoteConditionsCard } from '@/components/quote-conditions/QuoteConditionsCard'
import { QuoteResultCard } from '@/components/results/QuoteResultCard'
import { useCatalog, getResidualPreviews } from '@/hooks/useCatalog'
import { useQuote } from '@/hooks/useQuote'
import { parsePercentInput } from '@/lib/residual'
import type { LeaseTerm, AnnualMileage, QuotePayload } from '@/types/quote'

export function QuotePage() {
  const catalog = useCatalog()
  const quote = useQuote()

  // --- Vehicle inputs ---
  const [vehiclePrice, setVehiclePrice] = useState('')
  const [discountPrice, setDiscountPrice] = useState('0')

  // --- Acquisition cost ---
  const [acquisitionTaxIncluded, setAcquisitionTaxIncluded] = useState(true)
  const [deliveryFeeIncluded, setDeliveryFeeIncluded] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [miscFeeIncluded, setMiscFeeIncluded] = useState(false)
  const [miscFee, setMiscFee] = useState('0')
  const [publicBondIncluded, setPublicBondIncluded] = useState(false)
  const [publicBondCost, setPublicBondCost] = useState('0')

  // --- Quote conditions ---
  const [leaseTermMonths, setLeaseTermMonths] = useState<LeaseTerm>(60)
  const [annualMileageKm, setAnnualMileageKm] = useState<AnnualMileage>(20000)
  const [depositMode, setDepositMode] = useState<'amount' | 'percent'>('amount')
  const [depositValue, setDepositValue] = useState('0')
  const [upfrontMode, setUpfrontMode] = useState<'amount' | 'percent'>('amount')
  const [upfrontValue, setUpfrontValue] = useState('0')
  const [residualRate, setResidualRate] = useState('')
  const [cmFeeRate, setCmFeeRate] = useState('0%')
  const [agFeeRate, setAgFeeRate] = useState('0%')
  const [affiliateExempt, setAffiliateExempt] = useState(true)
  const [evSubsidy, setEvSubsidy] = useState(false)
  const [evSubsidyAmount, setEvSubsidyAmount] = useState('0')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [annualIrrRateOverride, setAnnualIrrRateOverride] = useState('')
  const [annualEffectiveRateOverride, setAnnualEffectiveRateOverride] = useState('')
  const [paymentRateOverride, setPaymentRateOverride] = useState('')

  // Load brands on mount
  useEffect(() => {
    void catalog.loadBrands()
  }, [])

  // Auto-fill vehicle price and residual when trim changes
  useEffect(() => {
    if (!catalog.selectedModel) return
    setVehiclePrice(String(catalog.selectedModel.vehiclePrice))
    const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
    if (previews.max != null) {
      setResidualRate(`${(previews.max * 100).toFixed(2)}%`)
    }
  }, [catalog.selectedModel?.modelName])

  // Update residual when term changes
  useEffect(() => {
    if (!catalog.selectedModel) return
    const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
    if (previews.max != null) {
      setResidualRate(`${(previews.max * 100).toFixed(2)}%`)
    }
  }, [leaseTermMonths])

  // --- Derived values ---
  const rawVehiclePrice = Number(vehiclePrice.replace(/,/g, '')) || 0
  const rawDiscount = Number(discountPrice.replace(/,/g, '')) || 0
  const discountedPrice = rawVehiclePrice - rawDiscount

  const acquisitionTaxRate = acquisitionTaxIncluded ? 0.07 : 0
  const acquisitionTaxAmount = acquisitionTaxIncluded
    ? Math.floor((discountedPrice / 1.1) * 0.07 / 10) * 10
    : 0
  // NOTE: "취득원가" displayed here is the gross acquisition outlay (all fees included).
  // The API's `financedPrincipal` = discountedPrice + acquisitionTax + stampDuty only
  // (delivery/misc/bond are separate API fields, not added to financedPrincipal).
  // The result card will show `majorInputs.financedPrincipal` from the API response
  // as the authoritative financed amount.
  const totalAcquisitionCost =
    discountedPrice +
    acquisitionTaxAmount +
    10000 + // stampDuty
    (deliveryFeeIncluded ? Number(deliveryFee) || 0 : 0) +
    (miscFeeIncluded ? Number(miscFee) || 0 : 0) +
    (publicBondIncluded ? Number(publicBondCost) || 0 : 0)

  function computeAbsoluteAmount(mode: 'amount' | 'percent', value: string): number {
    if (mode === 'amount') return Number(value.replace(/,/g, '')) || 0
    return Math.round(discountedPrice * (Number(value) || 0) / 100)
  }

  const depositAmount = computeAbsoluteAmount(depositMode, depositValue)
  const upfrontPayment = computeAbsoluteAmount(upfrontMode, upfrontValue)

  const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)

  function buildPayload(): QuotePayload | null {
    if (!catalog.selectedModel || !catalog.selectedBrand) return null
    return {
      lenderCode: 'mg-capital',
      productType: 'operating_lease',
      brand: catalog.selectedBrand,
      modelName: catalog.selectedModel.modelName,
      affiliateType: affiliateExempt ? '비제휴사' : 'KCC오토',
      directModelEntry: false,
      ownershipType: 'company',
      leaseTermMonths,
      annualMileageKm,
      upfrontPayment,
      depositAmount,
      quotedVehiclePrice: rawVehiclePrice,
      discountAmount: rawDiscount,
      acquisitionTaxRateOverride: acquisitionTaxRate,
      stampDuty: 10000,
      includePublicBondCost: publicBondIncluded,
      publicBondCost: publicBondIncluded ? Number(publicBondCost) || 0 : undefined,
      includeMiscFeeAmount: miscFeeIncluded,
      miscFeeAmount: miscFeeIncluded ? Number(miscFee) || 0 : undefined,
      includeDeliveryFeeAmount: deliveryFeeIncluded,
      deliveryFeeAmount: deliveryFeeIncluded ? Number(deliveryFee) || 0 : undefined,
      selectedResidualRateOverride: parsePercentInput(residualRate),
      cmFeeRate: parsePercentInput(cmFeeRate),
      agFeeRate: parsePercentInput(agFeeRate),
      insuranceYearlyAmount: 0,
      lossDamageAmount: 0,
      annualIrrRateOverride: parsePercentInput(annualIrrRateOverride),
      annualEffectiveRateOverride: parsePercentInput(annualEffectiveRateOverride),
      paymentRateOverride: parsePercentInput(paymentRateOverride),
    }
  }

  const handleCalculate = useCallback(() => {
    const payload = buildPayload()
    if (!payload) return
    void quote.calculate(payload)
  }, [catalog.selectedModel, catalog.selectedBrand, leaseTermMonths, annualMileageKm,
      vehiclePrice, discountPrice, depositAmount, upfrontPayment, residualRate,
      cmFeeRate, agFeeRate, affiliateExempt, acquisitionTaxIncluded,
      deliveryFeeIncluded, deliveryFee, miscFeeIncluded, miscFee,
      publicBondIncluded, publicBondCost,
      annualIrrRateOverride, annualEffectiveRateOverride, paymentRateOverride])

  const handleResetSelectedResidual = useCallback(() => {
    setResidualRate('')
    if (catalog.selectedModel) {
      const p = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
      if (p.max != null) setResidualRate(`${(p.max * 100).toFixed(2)}%`)
    }
    quote.reset()
  }, [catalog.selectedModel, leaseTermMonths])

  return (
    <div className="p-4 grid grid-cols-[1fr_420px] gap-4 min-h-screen bg-background">
      {/* Left: Form */}
      <div className="flex flex-col gap-3">
        <VehicleInfoCard
          brands={catalog.brands}
          models={catalog.models}
          brandsLoading={catalog.brandsLoading}
          modelsLoading={catalog.modelsLoading}
          selectedBrand={catalog.selectedBrand}
          selectedModel={catalog.selectedModel}
          vehiclePrice={vehiclePrice}
          optionPrice={String(catalog.selectedModel?.vehiclePrice ?? '')}
          discountPrice={discountPrice}
          leaseTermMonths={leaseTermMonths}
          baseResidualRate={previews.base}
          maxResidualRate={previews.max}
          onBrandChange={(brand) => void catalog.selectBrand(brand)}
          onModelChange={catalog.selectModel}
          onVehiclePriceChange={setVehiclePrice}
          onDiscountPriceChange={setDiscountPrice}
        />

        <AcquisitionCostCard
          acquisitionTaxIncluded={acquisitionTaxIncluded}
          acquisitionTaxRate={acquisitionTaxRate}
          acquisitionTaxAmount={acquisitionTaxAmount}
          deliveryFeeIncluded={deliveryFeeIncluded}
          deliveryFee={deliveryFee}
          miscFeeIncluded={miscFeeIncluded}
          miscFee={miscFee}
          publicBondIncluded={publicBondIncluded}
          publicBondCost={publicBondCost}
          totalAcquisitionCost={totalAcquisitionCost}
          onAcquisitionTaxToggle={setAcquisitionTaxIncluded}
          onDeliveryFeeToggle={setDeliveryFeeIncluded}
          onDeliveryFeeChange={setDeliveryFee}
          onMiscFeeToggle={setMiscFeeIncluded}
          onMiscFeeChange={setMiscFee}
          onPublicBondToggle={setPublicBondIncluded}
          onPublicBondChange={setPublicBondCost}
        />

        <QuoteConditionsCard
          leaseTermMonths={leaseTermMonths}
          annualMileageKm={annualMileageKm}
          depositMode={depositMode}
          depositValue={depositValue}
          upfrontMode={upfrontMode}
          upfrontValue={upfrontValue}
          residualRate={residualRate}
          cmFeeRate={cmFeeRate}
          agFeeRate={agFeeRate}
          affiliateExempt={affiliateExempt}
          evSubsidy={evSubsidy}
          evSubsidyAmount={evSubsidyAmount}
          showAdvanced={showAdvanced}
          annualIrrRateOverride={annualIrrRateOverride}
          annualEffectiveRateOverride={annualEffectiveRateOverride}
          paymentRateOverride={paymentRateOverride}
          onTermChange={setLeaseTermMonths}
          onMileageChange={setAnnualMileageKm}
          onDepositModeChange={setDepositMode}
          onDepositValueChange={setDepositValue}
          onUpfrontModeChange={setUpfrontMode}
          onUpfrontValueChange={setUpfrontValue}
          onResidualRateChange={setResidualRate}
          onCmFeeRateChange={setCmFeeRate}
          onAgFeeRateChange={setAgFeeRate}
          onAffiliateExemptChange={setAffiliateExempt}
          onEvSubsidyChange={setEvSubsidy}
          onEvSubsidyAmountChange={setEvSubsidyAmount}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onAnnualIrrRateOverrideChange={setAnnualIrrRateOverride}
          onAnnualEffectiveRateOverrideChange={setAnnualEffectiveRateOverride}
          onPaymentRateOverrideChange={setPaymentRateOverride}
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {}}>
            엑셀 기본값 적용
          </Button>
          <Button
            className="flex-1 text-sm font-semibold"
            disabled={quote.loading || !catalog.selectedModel}
            onClick={handleCalculate}
          >
            {quote.loading ? '계산 중...' : '견적 계산'}
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleResetSelectedResidual}>
            잔가 선택값 지우기
          </Button>
        </div>

        {quote.error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {quote.error}
          </div>
        )}
      </div>

      {/* Right: Result */}
      <div className="flex flex-col gap-3">
        {quote.result ? (
          <QuoteResultCard result={quote.result} />
        ) : (
          <div className="border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm min-h-48">
            {quote.loading ? '계산 중...' : '계산 전 상태'}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Write ImportPage placeholder**

Create `client/src/pages/ImportPage.tsx`:

```tsx
export function ImportPage() {
  return (
    <div className="p-4">
      <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
        워크북 임포트 기능 — 구현 예정
      </div>
    </div>
  )
}
```

- [ ] **Step 9.3: Commit**

```bash
git add client/src/pages/
git commit -m "feat: add QuotePage and ImportPage"
```

---

## Task 10: App.tsx — tabs + header

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 10.1: Write App.tsx**

Replace the generated content of `client/src/App.tsx`:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuotePage } from '@/pages/QuotePage'
import { ImportPage } from '@/pages/ImportPage'

export function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-foreground">돌림 솔루션</span>
          <span className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">
            MG캐피탈 · 운용리스
          </span>
        </div>
        <span className="text-xs text-muted-foreground">운용리스 견적 플랫폼</span>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="quote" className="w-full">
        <div className="bg-white border-b border-border px-6">
          <TabsList className="h-auto p-0 bg-transparent gap-0 rounded-none">
            <TabsTrigger
              value="quote"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              견적 계산
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              워크북 임포트
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quote" className="mt-0">
          <QuotePage />
        </TabsContent>
        <TabsContent value="import" className="mt-0">
          <ImportPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
```

- [ ] **Step 10.2: Ensure main.tsx imports App correctly**

`client/src/main.tsx` should be:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 10.3: Run the app and verify**

```bash
# Terminal 1
bun run dev:pages

# Terminal 2
bun run dev:client
```

Open http://localhost:5173.
- Header renders with "돌림 솔루션"
- Two tabs visible: 견적 계산 / 워크북 임포트
- Quote form loads with three section cards
- Brand dropdown loads data from API (requires `bun run dev:pages` with `.dev.vars` and an active import)

- [ ] **Step 10.4: Commit**

```bash
git add client/src/App.tsx client/src/main.tsx
git commit -m "feat: add root App with tab navigation and header"
```

---

## Task 11: Manual smoke test against reference fixtures

Before cutting over the wrangler build target, verify the React app produces correct results for 3 reference scenarios.

**Prerequisites:** `bun run dev:pages` running with active MG workbook import in DB.

- [ ] **Step 11.1: Test AUDI A3 36m base**

Input: AUDI A3 40 TFSI, 36개월, 연20,000km, 잔가 47%, 보증금 0, 선납금 0, 취득세 포함
Expected: engine value 835,373 → display `roundUpToNearestHundred(835373)` = **₩ 835,400** (per `audi-a3-36-base` fixture)

- [ ] **Step 11.2: Test BMW X7 60m base**

Input: BMW X7 xDrive 40d DPE, 60개월, 연20,000km, 잔가 54.5%, 보증금 0, 선납금 0, 취득세 포함
Expected: engine value 6,043,476 → display `roundUpToNearestHundred(6043476)` = **₩ 6,043,500** (per `bmw-x7-60-base` fixture)

- [ ] **Step 11.3: Test BENZ A200d 36m base**

Input: BENZ A200d, 36개월, 연20,000km, SNK 잔가, 보증금 0, 취득세 포함
Expected: engine value 833,573 → display **₩ 833,600** (per `benz-a200d-36-base` fixture)

- [ ] **Step 11.4: Fix any discrepancies before proceeding**

If any result differs from the fixture expected value, diagnose by comparing the payload sent to the API (check Network tab) against the equivalent payload in the fixture file.

---

## Task 12: Cut over wrangler build + retire playground.ts

Only run this task after Task 11 passes.

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/app.ts`

- [ ] **Step 12.1: Build client**

```bash
cd client && bun run build
```

Expected: `client/dist/` created with `index.html` + hashed assets.

- [ ] **Step 12.2: Update wrangler.jsonc**

Change `pages_build_output_dir` from `"."` to `"client/dist"`:

```jsonc
{
  "name": "mg-lease-web",
  "compatibility_date": "2026-03-17",
  "pages_build_output_dir": "client/dist",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "APP_ENV": "development"
  }
}
```

- [ ] **Step 12.3: Verify wrangler Pages dev serves the React app**

```bash
bun run dev:pages
```

Open http://localhost:8788 — should serve the React app (not the old playground).

- [ ] **Step 12.4: Remove playground route from src/app.ts**

Remove these lines from `src/app.ts`:
```typescript
import { renderPlaygroundHtml } from "@/playground";
// ...
function renderPlaygroundResponse(c: Context<{ Bindings: Bindings }>) { ... }
app.get("/", async (c) => { return renderPlaygroundResponse(c); });
app.get("/playground", async (c) => { return renderPlaygroundResponse(c); });
```

The `src/playground.ts` file can remain as a reference but is no longer imported.

- [ ] **Step 12.5: Add build script for CI**

In root `package.json`, add:
```json
"build": "cd client && bun run build"
```

- [ ] **Step 12.6: Run typecheck**

```bash
bun run typecheck
cd client && bunx tsc --noEmit
```

Fix any type errors before committing.

- [ ] **Step 12.7: Commit**

```bash
git add wrangler.jsonc src/app.ts package.json client/
git commit -m "feat: cut over to React client — retire playground.ts route"
```

---

## Verification Checklist (after all tasks)

- [ ] `bun test` passes (all 33 fixtures green — backend unchanged)
- [ ] `bun run typecheck` passes
- [ ] `cd client && bunx tsc --noEmit` passes
- [ ] React app loads at http://localhost:8788 via wrangler
- [ ] Brand/Trim cascade populates correctly
- [ ] AUDI A3 + BMW X7 + BENZ A200d manual fixtures match expected payments
- [ ] Deposit/upfront % mode computes correctly (value × discountedPrice / 100)
- [ ] Advanced override panel hidden by default, expands on click
- [ ] Result card shows correct header tags (법인/일반잔가·고잔가/matrixGroup)
- [ ] Error state shows below calculate button on API failure
