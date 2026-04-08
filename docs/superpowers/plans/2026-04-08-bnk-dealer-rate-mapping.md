# BNK 제휴사(딜러) 금리 매핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BNK 견적 시 제휴사(딜러) 선택에 따라 올바른 기본금리(baseIrr)를 적용하여 엑셀과 동일한 적용금리 산출

**Architecture:** Cond 시트 좌측 딜러 엔트리(cols 2-3-7-11)를 파싱하여 brandRatePolicies에 rawPolicy.dealerName으로 저장. BNK 엔진이 input.bnkDealerName으로 딜러별 정책을 조회. UI에 제휴사 드롭다운 추가.

**Tech Stack:** TypeScript, Bun test, Hono API, React (shadcn/ui)

---

### File Structure

| File | Responsibility |
|------|---------------|
| `src/domain/lenders/bnk-capital/workbook-parser.ts` | Cond 좌측 딜러 엔트리 파싱 추가 |
| `src/domain/lenders/bnk-capital/operating-lease-service.ts` | 딜러명으로 정책 조회 fallback |
| `src/domain/quotes/types.ts` | `bnkDealerName` 필드 추가 |
| `src/app.ts` | Zod 스키마에 bnkDealerName 추가 + 딜러 목록 API |
| `src/domain/imports/catalog-queries.ts` | 딜러 목록 조회 함수 |
| `client/src/pages/QuotePage.tsx` | 제휴사 드롭다운 + payload에 bnkDealerName |
| `client/src/types/quote.ts` | QuotePayload에 bnkDealerName |

---

### Task 1: Cond 파서 확장 — 딜러별 brandRatePolicy 생성

**Files:**
- Modify: `src/domain/lenders/bnk-capital/workbook-parser.ts` (parseCondBrandPolicies 함수)

- [ ] **Step 1: Read the current parseCondBrandPolicies function**

Read `src/domain/lenders/bnk-capital/workbook-parser.ts` lines 232-289 to understand the existing parsing.

- [ ] **Step 2: Add dealer entry parsing**

In `parseCondBrandPolicies`, after the existing Step 2 (brand→condType map from col 9), add a new step that reads the left-side dealer entries. Insert this code after line 261 (after the `brandCondType` loop) and before line 266 (Step 4):

```typescript
  // Step 2b: Build dealer → conditionType map from left-side entries (cols 2-3-7-11)
  // Left side: col 2 = brand, col 3 = dealer name, col 7 = display name, col 11 = conditionType
  // The col 11 value is shared with the right side but placed deliberately on matching rows.
  const dealerEntries: Array<{ brand: string; dealerName: string; displayName: string; condType: string }> = [];
  for (let i = 3; i < Math.min(rows.length, 55); i++) {
    const row = rows[i];
    const brand = asText(row[2]);
    const dealerName = asText(row[3]);
    const displayName = asText(row[7]) ?? dealerName;
    const condType = asText(row[11]);
    if (brand && dealerName && condType && condType.startsWith("운용_")) {
      dealerEntries.push({ brand, dealerName, displayName: displayName ?? dealerName, condType });
    }
  }
```

- [ ] **Step 3: Emit dealer-specific policies**

In the existing Step 4 loop (line 267-286), after emitting brand-level policies, add dealer-specific policies. Add this code after the existing loop and before `return results;`:

```typescript
  // Step 5: Emit dealer-specific policies with rawPolicy.dealerName
  for (const dealer of dealerEntries) {
    const irr = condTypeIrr.get(dealer.condType);
    if (!irr) continue;

    results.push({
      brand: dealer.brand,
      productType: "operating_lease",
      ownershipType: "company",
      baseIrrRate: irr.company,
      dealerName: dealer.displayName ?? dealer.dealerName,
    });
    if (irr.customer !== irr.company) {
      results.push({
        brand: dealer.brand,
        productType: "operating_lease",
        ownershipType: "customer",
        baseIrrRate: irr.customer,
        dealerName: dealer.displayName ?? dealer.dealerName,
      });
    }
  }
```

- [ ] **Step 4: Update WorkbookBrandRatePolicy type**

In `src/domain/imports/types.ts`, add optional `dealerName` to the type:

```typescript
export type WorkbookBrandRatePolicy = {
  brand: string;
  productType: QuoteProductType;
  ownershipType: "company" | "customer";
  baseIrrRate: number;
  dealerName?: string;  // BNK dealer-specific policy
};
```

- [ ] **Step 5: Store dealerName in rawPolicy during import**

In `src/domain/imports/import-service.ts`, update the brandRatePolicies insert (around line 133) to include dealerName in rawPolicy:

```typescript
      if (workbook.brandRatePolicies.length > 0) {
        await tx.insert(brandRatePolicies).values(
          workbook.brandRatePolicies.map((policy) => ({
            workbookImportId,
            brand: policy.brand,
            productType: policy.productType,
            ownershipType: policy.ownershipType,
            baseIrrRate: policy.baseIrrRate.toFixed(4),
            rawPolicy: policy.dealerName ? { dealerName: policy.dealerName } : {},
          })),
        );
      }
```

- [ ] **Step 6: Verify parsing produces correct dealer entries**

```bash
bun --env-file=.dev.vars -e "
import { parseBnkWorkbook } from './src/domain/lenders/bnk-capital/workbook-parser';
import { readFileSync } from 'fs';
const buf = readFileSync('./reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm');
const wb = parseBnkWorkbook(buf.buffer, { lenderCode: 'bnk-capital', fileName: 'test.xlsm' });
const bmwPolicies = wb.brandRatePolicies.filter(p => p.brand === 'BMW');
console.log('BMW policies:', JSON.stringify(bmwPolicies, null, 2));
const benzPolicies = wb.brandRatePolicies.filter(p => p.brand === '벤츠');
console.log('벤츠 policies:', JSON.stringify(benzPolicies.slice(0, 4), null, 2));
console.log('Total policies:', wb.brandRatePolicies.length);
"
```

Expected: BMW policies include `BMW-동성모터스` with baseIrrRate 0.0521, `BMW-도이치` with 0.0571, and brand default 0.0681.

- [ ] **Step 7: Run existing tests**

Run: `bun test`
Expected: all 130 tests PASS (no behavioral change to engine yet)

- [ ] **Step 8: Commit**

```bash
git add src/domain/lenders/bnk-capital/workbook-parser.ts src/domain/imports/types.ts src/domain/imports/import-service.ts
git commit -m "feat: parse BNK Cond dealer entries for dealer-specific baseIrr"
```

---

### Task 2: BNK 엔진 — 딜러명으로 정책 조회

**Files:**
- Modify: `src/domain/quotes/types.ts` — add `bnkDealerName` field
- Modify: `src/app.ts` — add `bnkDealerName` to Zod schema
- Modify: `src/domain/lenders/bnk-capital/operating-lease-service.ts` — dealer-aware policy lookup

- [ ] **Step 1: Add bnkDealerName to CanonicalQuoteInput**

In `src/domain/quotes/types.ts`, add after `affiliateType`:

```typescript
  bnkDealerName?: string;
```

- [ ] **Step 2: Add bnkDealerName to Zod schema**

In `src/app.ts`, add to `calculateQuoteSchema` (after the agFeeRate line):

```typescript
  bnkDealerName: z.string().min(1).optional(),
```

- [ ] **Step 3: Modify BNK engine policy lookup**

In `src/domain/lenders/bnk-capital/operating-lease-service.ts`, replace the policy lookup section (lines ~278-310) with a dealer-aware version. The logic:

1. If `input.bnkDealerName` is set, look for a policy with matching `rawPolicy.dealerName`
2. If not found (or not set), fall back to the existing brand-level lookup

Replace the existing policy lookup block with:

```typescript
    // 3. Base IRR from brand rate policy (dealer-aware)
    let policyBaseIrr: number;
    
    // Try dealer-specific policy first
    if (input.bnkDealerName) {
      const dealerPolicies = await db
        .select({ baseIrrRate: brandRatePolicies.baseIrrRate, rawPolicy: brandRatePolicies.rawPolicy })
        .from(brandRatePolicies)
        .where(
          and(
            eq(brandRatePolicies.workbookImportId, activeImport.id),
            eq(brandRatePolicies.brand, input.brand),
            eq(brandRatePolicies.productType, "operating_lease"),
            eq(brandRatePolicies.ownershipType, input.ownershipType),
          ),
        )
        .then((rows) => rows);
      
      const dealerMatch = dealerPolicies.find(
        (p) => (p.rawPolicy as Record<string, unknown>)?.dealerName === input.bnkDealerName,
      );
      
      if (dealerMatch) {
        policyBaseIrr = Number(dealerMatch.baseIrrRate);
      } else {
        // Fallback: brand-level policy (no dealerName in rawPolicy)
        const brandMatch = dealerPolicies.find(
          (p) => !(p.rawPolicy as Record<string, unknown>)?.dealerName,
        );
        policyBaseIrr = brandMatch ? Number(brandMatch.baseIrrRate) : 0.0681;
      }
    } else {
      // No dealer specified — use first dealer policy if available, else brand default
      const allPolicies = await db
        .select({ baseIrrRate: brandRatePolicies.baseIrrRate, rawPolicy: brandRatePolicies.rawPolicy })
        .from(brandRatePolicies)
        .where(
          and(
            eq(brandRatePolicies.workbookImportId, activeImport.id),
            eq(brandRatePolicies.brand, input.brand),
            eq(brandRatePolicies.productType, "operating_lease"),
            eq(brandRatePolicies.ownershipType, input.ownershipType),
          ),
        )
        .then((rows) => rows);
      
      // Prefer first dealer policy (primary affiliate), else brand default
      const firstDealer = allPolicies.find(
        (p) => (p.rawPolicy as Record<string, unknown>)?.dealerName,
      );
      const brandDefault = allPolicies.find(
        (p) => !(p.rawPolicy as Record<string, unknown>)?.dealerName,
      );
      policyBaseIrr = firstDealer
        ? Number(firstDealer.baseIrrRate)
        : brandDefault
          ? Number(brandDefault.baseIrrRate)
          : 0.0681;
    }
```

Also remove the old `policyFallback` variable and the old `policyBaseIrr` assignment that follows it (around line 309-310: `const policyBaseIrr = policyFallback ? ...`).

- [ ] **Step 4: Run tests**

Run: `bun test`
Expected: all 130 tests PASS. Existing BNK fixtures don't set `bnkDealerName`, so they hit the "no dealer" fallback path. The fallback now prefers the first dealer policy — for fixtures using `policyBaseIrr: 0.0521`, this should still work since BMW-동성모터스 is the first dealer entry with 0.0521.

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/domain/quotes/types.ts src/app.ts src/domain/lenders/bnk-capital/operating-lease-service.ts
git commit -m "feat: BNK engine dealer-aware policy lookup via bnkDealerName"
```

---

### Task 3: 딜러 목록 API + UI 제휴사 드롭다운

**Files:**
- Modify: `src/domain/imports/catalog-queries.ts` — add dealer list query
- Modify: `src/app.ts` — add GET /api/catalog/bnk-dealers endpoint
- Modify: `client/src/lib/api.ts` — add fetchBnkDealers function
- Modify: `client/src/types/quote.ts` — add bnkDealerName to QuotePayload
- Modify: `client/src/pages/QuotePage.tsx` — add dealer dropdown + wire to payload

- [ ] **Step 1: Add dealer list query**

In `src/domain/imports/catalog-queries.ts`, add a new exported function:

```typescript
export async function getBnkDealersForBrand(params: {
  databaseUrl?: string;
  brand: string;
}): Promise<{ dealers: Array<{ dealerName: string; baseIrrRate: number }> }> {
  if (!params.databaseUrl) return { dealers: [] };

  const refsResult = await getActiveWorkbookRefs({ databaseUrl: params.databaseUrl, lenderCode: "bnk-capital" });
  if (!refsResult.connected || refsResult.workbookImports.length === 0) return { dealers: [] };

  const importId = refsResult.workbookImports[0].id;
  const { db, dispose } = createDbClient(params.databaseUrl);

  try {
    const rows = await db
      .select({
        baseIrrRate: brandRatePolicies.baseIrrRate,
        rawPolicy: brandRatePolicies.rawPolicy,
      })
      .from(brandRatePolicies)
      .where(
        and(
          eq(brandRatePolicies.workbookImportId, importId),
          eq(brandRatePolicies.brand, params.brand),
          eq(brandRatePolicies.productType, "operating_lease"),
          eq(brandRatePolicies.ownershipType, "company"),
        ),
      );

    const dealers = rows
      .filter((r) => (r.rawPolicy as Record<string, unknown>)?.dealerName)
      .map((r) => ({
        dealerName: String((r.rawPolicy as Record<string, unknown>).dealerName),
        baseIrrRate: Number(r.baseIrrRate),
      }));

    return { dealers };
  } finally {
    await dispose();
  }
}
```

- [ ] **Step 2: Add API endpoint**

In `src/app.ts`, add after the catalog/models endpoint:

```typescript
const catalogDealersQuerySchema = z.object({
  brand: z.string().min(1),
});

app.get("/api/catalog/bnk-dealers", zValidator("query", catalogDealersQuerySchema), async (c) => {
  const { brand } = c.req.valid("query");
  const result = await getBnkDealersForBrand({ databaseUrl: c.env.DATABASE_URL, brand });
  return c.json({ ok: true, ...result });
});
```

Add the import for `getBnkDealersForBrand` at the top of app.ts.

- [ ] **Step 3: Add frontend API client**

In `client/src/lib/api.ts`, add:

```typescript
export type BnkDealer = { dealerName: string; baseIrrRate: number };

export async function fetchBnkDealers(brand: string): Promise<BnkDealer[]> {
  const res = await fetch(`/api/catalog/bnk-dealers?brand=${encodeURIComponent(brand)}`);
  const data = await res.json();
  return data.dealers ?? [];
}
```

- [ ] **Step 4: Add bnkDealerName to QuotePayload**

In `client/src/types/quote.ts`, add to the QuotePayload type:

```typescript
  bnkDealerName?: string;
```

- [ ] **Step 5: Add dealer dropdown to QuotePage**

In `client/src/pages/QuotePage.tsx`:

1. Add state: `const [bnkDealers, setBnkDealers] = useState<BnkDealer[]>([])` and `const [bnkDealerName, setBnkDealerName] = useState('')`
2. Add import for `fetchBnkDealers` and `BnkDealer`
3. Add useEffect that fetches dealers when brand changes:
```typescript
  useEffect(() => {
    if (catalog.selectedBrand) {
      fetchBnkDealers(catalog.selectedBrand).then(setBnkDealers).catch(() => setBnkDealers([]))
    }
  }, [catalog.selectedBrand])
```
4. Add dropdown in the 견적 조건 card (near the existing 판매사 dropdown):
```tsx
{bnkDealers.length > 0 && (
  <div>
    <label className="text-xs text-zinc-500">BNK 제휴사</label>
    <select value={bnkDealerName} onChange={(e) => setBnkDealerName(e.target.value)}
      className="w-full rounded border px-2 py-1.5 text-sm">
      <option value="">자동 (첫번째 제휴사)</option>
      {bnkDealers.map((d) => (
        <option key={d.dealerName} value={d.dealerName}>
          {d.dealerName} ({(d.baseIrrRate * 100).toFixed(2)}%)
        </option>
      ))}
    </select>
  </div>
)}
```
5. Add to buildPayload:
```typescript
  bnkDealerName: bnkDealerName || undefined,
```

- [ ] **Step 6: Run tests + typecheck**

```bash
bun test && bun run typecheck
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/domain/imports/catalog-queries.ts src/app.ts client/src/lib/api.ts client/src/types/quote.ts client/src/pages/QuotePage.tsx
git commit -m "feat: BNK dealer dropdown — fetches dealer list, sends bnkDealerName in quote"
```

---

### Task 4: E2E 검증 + BNK 워크북 재임포트

**Files:** No code changes — verification only

- [ ] **Step 1: Run full test suite + typecheck**

```bash
bun test && bun run typecheck
```

Expected: all pass

- [ ] **Step 2: Restart dev server**

User restarts: `bun run start`

- [ ] **Step 3: Re-import BNK workbook**

User uploads BNK .xlsm via Import tab. The new parser will create dealer-specific policies.

- [ ] **Step 4: Verify in browser**

1. Select BMW → 320d M Sport → 64,400,000원 / 55% residual / 60m
2. Select BNK 제휴사: "BMW-동성모터스"
3. BNK 결과: IRR should be ~5.5% (not 6.81%)
4. Compare with Excel: 5.541%

- [ ] **Step 5: Commit final state if adjustments needed**

```bash
git commit -m "feat: BNK dealer rate mapping — verified end-to-end"
```
