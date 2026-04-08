# Vehicle Key Cross-Lender Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable cross-lender vehicle matching so that selecting a vehicle from one lender's catalog automatically resolves the equivalent vehicle in other lenders' catalogs.

**Architecture:** Add a pure `extractVehicleKey(brand, modelName)` function that extracts a brand-normalized model code (e.g., `BMW_320D`) from any lender's model name. Each lender's engine gains a vehicleKey fallback: when exact modelName match fails, compute vehicleKeys for all candidate vehicles and find the match. No DB schema changes, no frontend changes, no migration needed.

**Tech Stack:** TypeScript, Bun test runner, existing Hono API + Drizzle ORM

---

### Task 1: Create `extractVehicleKey` utility with tests

**Files:**
- Create: `src/domain/vehicles/vehicle-key.ts`
- Create: `src/domain/vehicles/vehicle-key.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/vehicles/vehicle-key.test.ts`:

```typescript
import { expect, test } from "bun:test";
import { extractVehicleKey } from "@/domain/vehicles/vehicle-key";

// ── BMW ──
test("BMW 3-digit + suffix: MG '320d M Sport'", () => {
  expect(extractVehicleKey("BMW", "320d M Sport")).toBe("BMW_320D");
});
test("BMW 3-digit + suffix: BNK 'The New 3 Series 디젤 2.0 320d'", () => {
  expect(extractVehicleKey("BMW", "The New 3 Series 디젤 2.0 320d")).toBe("BMW_320D");
});
test("BMW 520i both conventions match", () => {
  expect(extractVehicleKey("BMW", "520i M Sport")).toBe("BMW_520I");
  expect(extractVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i")).toBe("BMW_520I");
});
test("BMW X-series: MG 'X7 xDrive40d M Sport'", () => {
  expect(extractVehicleKey("BMW", "X7 xDrive40d M Sport")).toBe("BMW_X7_40D");
});
test("BMW X-series: BNK 'The New X7 디젤 3.0 40d'", () => {
  expect(extractVehicleKey("BMW", "The New X7 디젤 3.0 40d")).toBe("BMW_X7_40D");
});
test("BMW X3 20d", () => {
  expect(extractVehicleKey("BMW", "X3 xDrive20d M Sport")).toBe("BMW_X3_20D");
  expect(extractVehicleKey("BMW", "The New X3 디젤 2.0 20d")).toBe("BMW_X3_20D");
});
test("BMW X5 30d", () => {
  expect(extractVehicleKey("BMW", "X5 xDrive30d M Sport")).toBe("BMW_X5_30D");
  expect(extractVehicleKey("BMW", "The New X5 디젤 3.0 30d")).toBe("BMW_X5_30D");
});
test("BMW i-series: i4, i5, iX", () => {
  expect(extractVehicleKey("BMW", "i4 M50")).toBe("BMW_I4");
  expect(extractVehicleKey("BMW", "iX xDrive50")).toBe("BMW_IX");
});

// ── BENZ ──
test("BENZ E-class: MG 'E220d 4Matic Exclusive'", () => {
  expect(extractVehicleKey("BENZ", "E220d 4Matic Exclusive")).toBe("BENZ_E220D");
});
test("BENZ E-class: BNK naming", () => {
  expect(extractVehicleKey("BENZ", "The New E-Class 디젤 2.0 E220d 4Matic")).toBe("BENZ_E220D");
});
test("BENZ A-class", () => {
  expect(extractVehicleKey("BENZ", "A200d")).toBe("BENZ_A200D");
});
test("BENZ CLE", () => {
  expect(extractVehicleKey("BENZ", "The All New CLE 가솔린 3.0 AMG 카브리올레 CLE 53 AMG 4Matic+")).toBe("BENZ_CLE53");
});
test("BENZ multi-letter class: GLC, GLE", () => {
  expect(extractVehicleKey("BENZ", "GLC 300 4Matic")).toBe("BENZ_GLC300");
});

// ── AUDI ──
test("AUDI A-series: MG 'A3 40 TFSI'", () => {
  expect(extractVehicleKey("AUDI", "A3 40 TFSI Sedan")).toBe("AUDI_A3");
});
test("AUDI A-series: BNK naming", () => {
  expect(extractVehicleKey("AUDI", "The New A7 디젤 3.0 50 TDI Quattro Premium")).toBe("AUDI_A7");
});
test("AUDI Q-series", () => {
  expect(extractVehicleKey("AUDI", "Q5 45 TFSI Quattro")).toBe("AUDI_Q5");
});

// ── VOLVO ──
test("VOLVO XC40: MG naming", () => {
  expect(extractVehicleKey("VOLVO", "XC40 B4 Plus")).toBe("VOLVO_XC40");
});
test("VOLVO XC40: BNK naming", () => {
  expect(extractVehicleKey("VOLVO", "The New XC40 가솔린 2.0 MHEV B4 Plus Bright AWD")).toBe("VOLVO_XC40");
});
test("VOLVO other models", () => {
  expect(extractVehicleKey("VOLVO", "XC60 B5 Momentum")).toBe("VOLVO_XC60");
  expect(extractVehicleKey("VOLVO", "S60 B5 R-Design")).toBe("VOLVO_S60");
});

// ── Cross-lender parity ──
test("Same vehicle from different lenders produces same key", () => {
  // BMW 520i
  const mg520 = extractVehicleKey("BMW", "520i M Sport");
  const bnk520 = extractVehicleKey("BMW", "The New 5 Series 가솔린 2.0 520i");
  expect(mg520).toBe(bnk520);

  // BENZ E220d
  const mgE220 = extractVehicleKey("BENZ", "E220d 4Matic Exclusive");
  const bnkE220 = extractVehicleKey("BENZ", "The New E-Class 디젤 2.0 E220d 4Matic");
  expect(mgE220).toBe(bnkE220);
});

// ── Unknown brand returns null ──
test("Unknown brand returns null", () => {
  expect(extractVehicleKey("UNKNOWN_BRAND", "Some Model")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/domain/vehicles/vehicle-key.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement extractVehicleKey**

Create `src/domain/vehicles/vehicle-key.ts`:

```typescript
/**
 * Extracts a normalized vehicle key from a lender-specific model name.
 *
 * Vehicle keys are brand-prefixed model codes that are consistent across lenders:
 *   "320d M Sport" (MG)  →  BMW_320D
 *   "The New 3 Series 디젤 2.0 320d" (BNK)  →  BMW_320D
 *
 * Returns null if no recognizable pattern is found.
 */
export function extractVehicleKey(brand: string, modelName: string): string | null {
  const upper = brand.toUpperCase();
  const extractor = BRAND_EXTRACTORS[upper];
  if (!extractor) return null;

  const code = extractor(modelName);
  if (!code) return null;

  return `${upper}_${code}`;
}

// ---------------------------------------------------------------------------
// Brand-specific model code extractors
// Each returns an uppercase normalized code like "320D", "X7_40D", "E220D"
// ---------------------------------------------------------------------------

type CodeExtractor = (modelName: string) => string | null;

const BRAND_EXTRACTORS: Record<string, CodeExtractor> = {
  BMW: extractBmwCode,
  BENZ: extractBenzCode,
  "MERCEDES-BENZ": extractBenzCode,
  AUDI: extractAudiCode,
  VOLVO: extractVolvoCode,
  LEXUS: extractLexusCode,
  GENESIS: extractGenesisCode,
  HYUNDAI: extractGenericCode,
  KIA: extractGenericCode,
};

function extractBmwCode(name: string): string | null {
  const s = name.toUpperCase();

  // 1. X-series with engine designation: "X7 ... 40d", "X3 ... 20d"
  const xMatch = s.match(/\b(X\d)\b.*?\b(\d{2}[DISE])\b/);
  if (xMatch) return `${xMatch[1]}_${xMatch[2]}`;

  // 2. iX models: iX, iX1, iX3
  const ixMatch = s.match(/\b(IX\d?)\b/);
  if (ixMatch) return ixMatch[1];

  // 3. i-series EVs: i4, i5, i7
  const iMatch = s.match(/\b(I\d)\b/);
  if (iMatch) return iMatch[1];

  // 4. M-cars: M2, M3, M4, M5, M8
  const mMatch = s.match(/\b(M\d)\b/);
  if (mMatch) return mMatch[1];

  // 5. Standard 3-digit + optional suffix: 320d, 520i, 740i
  const stdMatch = s.match(/\b(\d{3}[DISE]?)\b/);
  if (stdMatch) return stdMatch[1];

  return null;
}

function extractBenzCode(name: string): string | null {
  const s = name.toUpperCase();

  // 1. EQ models: EQS, EQE, EQA, EQB + optional digits
  const eqMatch = s.match(/\b(EQ[A-Z])(\d{3})?\b/);
  if (eqMatch) return eqMatch[2] ? `${eqMatch[1]}${eqMatch[2]}` : eqMatch[1];

  // 2. Single-letter class + 3-digit + optional suffix: E220d, A200d, C300, S500
  //    Must appear as a contiguous token (E220D) or space-separated (E 220d)
  const singleMatch = s.match(/\b([A-Z])[\s-]?(\d{3}[DSE4]?)\b/);
  if (singleMatch) return `${singleMatch[1]}${singleMatch[2]}`;

  // 3. Multi-letter class + 2-3 digit: GLC300, CLE53, GLE450, AMG GT 63
  const multiMatch = s.match(/\b([A-Z]{2,3})[\s-]?(\d{2,3})\b/);
  if (multiMatch) return `${multiMatch[1]}${multiMatch[2]}`;

  return null;
}

function extractAudiCode(name: string): string | null {
  const s = name.toUpperCase();

  // 1. e-tron (with or without GT suffix)
  if (/\bE-?TRON\s*GT\b/.test(s)) return "ETRON_GT";
  if (/\bE-?TRON\b/.test(s)) return "ETRON";

  // 2. Model line: A3, A4, A6, A7, Q3, Q5, Q7, Q8, S3, S5, RS3, RS5
  const lineMatch = s.match(/\b(RS|[AQS])(\d)\b/);
  if (lineMatch) return `${lineMatch[1]}${lineMatch[2]}`;

  // 3. TT, R8
  const specialMatch = s.match(/\b(TT|R8)\b/);
  if (specialMatch) return specialMatch[1];

  return null;
}

function extractVolvoCode(name: string): string | null {
  const s = name.toUpperCase();

  // EX30, EX90, XC40, XC60, XC90, S60, S90, V60, V90, C40
  const match = s.match(/\b(E?[XSVC]C?\d{2})\b/);
  return match ? match[1] : null;
}

function extractLexusCode(name: string): string | null {
  const s = name.toUpperCase();

  // RX350h, NX300, ES300h, IS300, LC500, LS500h, UX250h, LBX
  const match = s.match(/\b([A-Z]{2,3})[\s-]?(\d{3}[HE]?)\b/);
  if (match) return `${match[1]}${match[2]}`;

  // LBX (no number)
  const shortMatch = s.match(/\b(LBX|UX|NX|RX|ES|IS|LS|LC|LX|GX|TX)\b/);
  return shortMatch ? shortMatch[1] : null;
}

function extractGenesisCode(name: string): string | null {
  const s = name.toUpperCase();

  // G70, G80, G90, GV60, GV70, GV80, GV80 Coupe
  const match = s.match(/\b(GV?\d{2})\b/);
  return match ? match[1] : null;
}

function extractGenericCode(name: string): string | null {
  // Fallback: try to find a prominent alphanumeric model identifier
  const s = name.toUpperCase();
  const match = s.match(/\b([A-Z]{1,4}\d{1,4}[A-Z]?)\b/);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/domain/vehicles/vehicle-key.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Fix any failing tests, iterate**

Adjust regex patterns if specific tests fail. The test names describe the expected behavior clearly — fix the extractor for each failing case.

- [ ] **Step 6: Commit**

```bash
git add src/domain/vehicles/vehicle-key.ts src/domain/vehicles/vehicle-key.test.ts
git commit -m "feat: add extractVehicleKey utility for cross-lender vehicle matching"
```

---

### Task 2: Add vehicleKey fallback to BNK engine

**Files:**
- Modify: `src/domain/lenders/bnk-capital/operating-lease-service.ts` (vehicle lookup ~lines 225-248)

- [ ] **Step 1: Write a test for the fallback behavior**

Add to `src/domain/vehicles/vehicle-key.test.ts`:

```typescript
test("resolveModelNameByVehicleKey finds BNK model from MG name", () => {
  const candidates = [
    { modelName: "The New 3 Series 디젤 2.0 320d" },
    { modelName: "The New 5 Series 가솔린 2.0 520i" },
    { modelName: "The New X7 디젤 3.0 40d" },
  ];
  const result = resolveModelNameByVehicleKey("BMW", "320d M Sport", candidates);
  expect(result).toBe("The New 3 Series 디젤 2.0 320d");
});

test("resolveModelNameByVehicleKey returns null when no match", () => {
  const candidates = [
    { modelName: "The New 5 Series 가솔린 2.0 520i" },
  ];
  const result = resolveModelNameByVehicleKey("BMW", "320d M Sport", candidates);
  expect(result).toBeNull();
});
```

- [ ] **Step 2: Implement resolveModelNameByVehicleKey**

Add to `src/domain/vehicles/vehicle-key.ts`:

```typescript
/**
 * Given a brand and a requested model name (from another lender),
 * find the matching model name among candidates using vehicleKey matching.
 * Returns the candidate's modelName or null if no match.
 */
export function resolveModelNameByVehicleKey(
  brand: string,
  requestedModelName: string,
  candidates: Array<{ modelName: string }>,
): string | null {
  const requestedKey = extractVehicleKey(brand, requestedModelName);
  if (!requestedKey) return null;

  for (const c of candidates) {
    const candidateKey = extractVehicleKey(brand, c.modelName);
    if (candidateKey === requestedKey) return c.modelName;
  }
  return null;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun test src/domain/vehicles/vehicle-key.test.ts`
Expected: all tests PASS

- [ ] **Step 4: Add vehicleKey fallback to BNK engine**

In `src/domain/lenders/bnk-capital/operating-lease-service.ts`, modify the vehicle lookup section (around line 225-248). After the exact match fails, add a fallback:

```typescript
// Add import at top of file:
import { resolveModelNameByVehicleKey } from "@/domain/vehicles/vehicle-key";

// Replace the vehicle lookup block (lines ~225-248) with:

    // 2. Resolve vehicle — exact match first, then vehicleKey fallback
    let vehicleRow = await db
      .select({
        brand: vehiclePrograms.brand,
        modelName: vehiclePrograms.modelName,
        vehicleClass: vehiclePrograms.vehicleClass,
        engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
        highResidualAllowed: vehiclePrograms.highResidualAllowed,
        hybridAllowed: vehiclePrograms.hybridAllowed,
        rawRow: vehiclePrograms.rawRow,
      })
      .from(vehiclePrograms)
      .where(
        and(
          eq(vehiclePrograms.workbookImportId, activeImport.id),
          eq(vehiclePrograms.brand, input.brand),
          eq(vehiclePrograms.modelName, input.modelName),
        ),
      )
      .limit(1)
      .then((rows: ResolvedVehicle[]) => rows[0] ?? null);

    // vehicleKey fallback: if exact modelName match failed, try cross-lender matching
    if (!vehicleRow) {
      const allBrandVehicles = await db
        .select({
          brand: vehiclePrograms.brand,
          modelName: vehiclePrograms.modelName,
          vehicleClass: vehiclePrograms.vehicleClass,
          engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
          highResidualAllowed: vehiclePrograms.highResidualAllowed,
          hybridAllowed: vehiclePrograms.hybridAllowed,
          rawRow: vehiclePrograms.rawRow,
        })
        .from(vehiclePrograms)
        .where(
          and(
            eq(vehiclePrograms.workbookImportId, activeImport.id),
            eq(vehiclePrograms.brand, input.brand),
          ),
        )
        .then((rows: ResolvedVehicle[]) => rows);

      const resolvedName = resolveModelNameByVehicleKey(input.brand, input.modelName, allBrandVehicles);
      if (resolvedName) {
        vehicleRow = allBrandVehicles.find((v) => v.modelName === resolvedName) ?? null;
      }
    }

    if (!vehicleRow) {
      throw new Error(`Vehicle not found in BNK catalog: ${input.brand} / ${input.modelName}`);
    }
```

- [ ] **Step 5: Run BNK parity tests to verify no regression**

Run: `bun test src/domain/lenders/bnk-capital/operating-lease-service.test.ts`
Expected: all 17 tests PASS (existing fixtures use exact modelName, so they hit the exact match path — no behavior change)

- [ ] **Step 6: Commit**

```bash
git add src/domain/vehicles/vehicle-key.ts src/domain/vehicles/vehicle-key.test.ts src/domain/lenders/bnk-capital/operating-lease-service.ts
git commit -m "feat: add vehicleKey fallback to BNK engine for cross-lender matching"
```

---

### Task 3: Add vehicleKey fallback to MG engine

**Files:**
- Modify: `src/domain/lenders/mg-capital/operating-lease-service.ts` (vehicle lookup section)

- [ ] **Step 1: Find the MG vehicle lookup**

The MG engine has the same pattern — exact match on `(workbookImportId, brand, modelName)`. Find this section (likely around the `const [vehicle]` query).

- [ ] **Step 2: Add the same fallback pattern**

Add the same import and fallback logic as BNK. In `src/domain/lenders/mg-capital/operating-lease-service.ts`:

```typescript
// Add import at top:
import { resolveModelNameByVehicleKey } from "@/domain/vehicles/vehicle-key";
```

After the existing exact-match query, add the fallback block (identical pattern to Task 2 Step 4). If the exact match returns no result, fetch all brand vehicles and try vehicleKey resolution.

- [ ] **Step 3: Run MG parity tests**

Run: `bun test src/domain/lenders/mg-capital/operating-lease-service.test.ts`
Expected: all 46 tests PASS

- [ ] **Step 4: Run full test suite**

Run: `bun test`
Expected: all 63+ tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/lenders/mg-capital/operating-lease-service.ts
git commit -m "feat: add vehicleKey fallback to MG engine for cross-lender matching"
```

---

### Task 4: End-to-end verification

**Files:** No new files — manual and automated verification

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: all tests PASS, including vehicleKey unit tests + MG 46 + BNK 17

- [ ] **Step 2: Type check**

Run: `bun run typecheck`
Expected: no errors

- [ ] **Step 3: Start local dev server and verify**

Run: `bun run start`

In the browser:
1. Select BMW → 320d M Sport (MG's model name)
2. Click 견적 계산
3. Both MG캐피탈 and BNK캐피탈 should return results (BNK should no longer show "Vehicle not found" error)

- [ ] **Step 4: Commit final state if any adjustments were needed**

```bash
git add -A
git commit -m "feat: cross-lender vehicleKey matching — verified end-to-end"
```
