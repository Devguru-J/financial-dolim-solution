import { and, desc, eq, inArray } from "drizzle-orm";

import {
  brandRatePolicies,
  residualMatrixRows,
  vehiclePrograms,
  workbookImports,
} from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
import { resolveModelNameByVehicleKey } from "@/domain/vehicles/vehicle-key";
import { createDbClient } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// BNK Capital Operating Lease Calculation Engine
//
// Key differences from MG Capital:
// - Vehicle prices NOT stored in workbook — must be provided via quotedVehiclePrice
// - 7 RV guarantee providers: WS, CB(SE), TY, JY, CR, ADB, BR
//   Grade indices in CDB (cbGrade, tyGrade, etc.) map to matrixGroup "{PROVIDER}_{col}"
// - IRR = baseIrr (by brand condition type) + guaranteeFee + CM + AG
// - Guarantee fee based on gap between standard RV rate and applied rate:
//     applied ≥ standard: fee = 0%
//     0% < gap ≤ 1%: fee = 1.21%
//     1% < gap ≤ 2%: fee = 1.10%
//     2% < gap ≤ 3%: fee = 0.88%
//     3% < gap ≤ 4%: fee = 0.66%
//     4% < gap ≤ 5%: fee = 0.44%
//     5% < gap ≤ 6%: fee = 0.22%
//     gap > 6%: fee = 0%  (applied is far below standard, little guarantee risk)
// - RV tables in workbook are at 2만km base (other mileages: mileage adjustment TODO)
// - PMT formula: ((PV - FV/factor) * rate) / (1 - 1/factor) — same as MG Capital
// - Monthly rate: annualRate / 12 (simple division, not effective ^1/12 conversion)
// - Display: ROUNDUP(rawPayment, -2) = nearest 100원 올림
// - Acquisition tax: default 7% for 승용차 ≥1600cc (matches Es1 sheet formula output)
//   취득세 = roundDown((discountedVehiclePrice / 1.1) × rate, -1)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function computeLeasePaymentRaw(params: {
  pv: number;        // presentValue = financedPrincipal - upfront - deposit
  fv: number;        // futureValue = residualAmount - deposit
  rate: number;      // monthly rate
  n: number;         // term in months
}): number {
  const { pv, fv, rate, n } = params;
  if (n <= 0) throw new Error("Lease term must be positive.");
  if (rate === 0) return (pv - fv) / n;
  const factor = (1 + rate) ** n;
  return ((pv - fv / factor) * rate) / (1 - factor ** -1);
}

/**
 * Solve annual rate from PMT result (Excel RATE equivalent).
 * Newton-Raphson: find r such that PMT(r/12, n, -pv, fv) ≈ payment.
 * Returns annual rate decimal. Matches Es1 B167 = RATE(n, pmt, -pv, fv)*12.
 */
function solveAnnualRate(n: number, payment: number, pv: number, fv: number): number {
  if (n <= 0 || pv <= 0) return 0;
  let r = 0.05 / 12; // initial guess (monthly rate)
  for (let i = 0; i < 200; i++) {
    const factor = (1 + r) ** n;
    const calcPmt = ((pv - fv / factor) * r) / (1 - 1 / factor);
    const diff = calcPmt - payment;
    if (Math.abs(diff) < 0.01) return r * 12;

    // Numerical derivative
    const h = Math.max(r * 1e-6, 1e-10);
    const factor2 = (1 + r + h) ** n;
    const calcPmt2 = ((pv - fv / factor2) * (r + h)) / (1 - 1 / factor2);
    const dPmt = (calcPmt2 - calcPmt) / h;
    if (Math.abs(dPmt) < 1e-12) break;

    r -= diff / dPmt;
    if (r < 1e-8) r = 1e-8;
  }
  return r * 12;
}

function roundDown(value: number, digits: number): number {
  const factor = Math.pow(10, -digits);
  return Math.floor(value / factor) * factor;
}

function roundUp(value: number, digits: number): number {
  const factor = Math.pow(10, -digits);
  return Math.ceil(value / factor) * factor;
}

// ---------------------------------------------------------------------------
// Acquisition tax rate by vehicle engine displacement (Korean 지방세법 기준)
// Defaults: 승용 ≥1600cc = 7%, others = 4%
// Users can always override via acquisitionTaxRateOverride.
// ---------------------------------------------------------------------------

function defaultAcquisitionTaxRate(engineDisplacementCc: number | null): number {
  if (engineDisplacementCc != null && engineDisplacementCc >= 1600) {
    return 0.07;
  }
  return 0.04;
}

// ---------------------------------------------------------------------------
// BNK Guarantee fee table (indexed by gap = applied_rate - base_rate)
// Matches Es1 sheet B248/B269/B311 etc.  Fee increases with gap because
// a higher applied residual means more risk for the guarantee provider.
//
// gap ≤ 0:         0%      (applied at or below base → no extra risk)
// 0 < gap ≤ 0.01: 0.22%   (Es1 H174)
// 0.01 < gap ≤ 0.02: 0.44%  (Es1 H173)
// 0.02 < gap ≤ 0.03: 0.66%  (Es1 H172)
// 0.03 < gap ≤ 0.04: 0.88%  (Es1 H171)
// 0.04 < gap ≤ 0.05: 1.10%  (Es1 H170)
// 0.05 < gap ≤ 0.06: 1.21%  (Es1 H169)
// gap > 0.06:      provider-specific max fee (Es1 J168:J174)
// ---------------------------------------------------------------------------

const BNK_GAP_FEE_STEPS: Array<{ maxGap: number; fee: number }> = [
  { maxGap: 0.00, fee: 0 },
  { maxGap: 0.01, fee: 0.0022 },
  { maxGap: 0.02, fee: 0.0044 },
  { maxGap: 0.03, fee: 0.0066 },
  { maxGap: 0.04, fee: 0.0088 },
  { maxGap: 0.05, fee: 0.011 },
  { maxGap: 0.06, fee: 0.0121 },
];

function lookupGuaranteeFeeFromGap(gapDecimal: number, maxFee: number): number {
  if (gapDecimal <= 0) return 0;
  if (gapDecimal > 0.06) return maxFee;
  for (let i = BNK_GAP_FEE_STEPS.length - 1; i >= 0; i--) {
    if (gapDecimal > BNK_GAP_FEE_STEPS[i].maxGap) {
      return BNK_GAP_FEE_STEPS[i + 1]?.fee ?? maxFee;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// BNK mileage adjustment (Es1 B240/B261/B282/B303/B324/B346/B368)
// RVs table stores rates at 2만km base. Other distances adjust as follows:
// ---------------------------------------------------------------------------

const BNK_MILEAGE_ADJUSTMENTS: Record<number, number> = {
  10000: 0.02,   // 1만km: +2%
  15000: 0.01,   // 1.5만km: +1%
  20000: 0,      // 2만km: base (no adjustment)
  30000: -0.04,  // 3만km: -4%
  40000: -0.09,  // 4만km: -9%
};

function getMileageAdjustment(annualMileageKm: number | undefined): number {
  if (annualMileageKm == null) return 0; // default = 20k base
  return BNK_MILEAGE_ADJUSTMENTS[annualMileageKm] ?? 0;
}

// ---------------------------------------------------------------------------
// BNK provider configuration
// ---------------------------------------------------------------------------

// Maps rawRow grade key → BNK unified table lookup.
// All providers share the same RVs unified table (AG8:CW67).  CDB grade values
// (cbGrade, tyGrade, jyGrade, crGrade, adbGrade) map to column headers in that
// table.  matrixGroup in DB = "BNK_{gradeValue}".
// maxFee = provider-specific ceiling for gap > 6% (Es1 J168:J174).
const BNK_PROVIDERS = [
  { key: "wsGrade", maxFee: 0.0132 },
  { key: "cbGrade", maxFee: 0.0135 },
  { key: "tyGrade", maxFee: 0.0132 },
  { key: "jyGrade", maxFee: 0.0145 },
  { key: "crGrade", maxFee: 0.0135 },
  { key: "adbGrade", maxFee: 0.0145 },
] as const;

type BnkProviderResult = {
  matrixGroup: string;
  standardRate: number;
  gapFromStandard: number;
  guaranteeFee: number;
};

/** Convert a CDB grade value (number or string) to "BNK_{grade}" matrixGroup. */
function resolveBnkMatrixGroup(gradeValue: unknown): string | null {
  if (typeof gradeValue === "number") {
    if (gradeValue <= 0) return null;
    return `BNK_${gradeValue}`;
  }
  if (typeof gradeValue === "string") {
    const trimmed = gradeValue.trim();
    if (!trimmed || trimmed === "0") return null;
    // Numeric strings like "7.5" and S-prefix strings like "S8" both work
    return `BNK_${trimmed}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DB context types
// ---------------------------------------------------------------------------

type ActiveWorkbook = {
  id: string;
  versionLabel: string;
};

type ResolvedVehicle = {
  brand: string;
  modelName: string;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  highResidualAllowed: boolean | null;
  hybridAllowed: boolean | null;
  rawRow: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function calculateBnkOperatingLeaseQuote(params: {
  databaseUrl: string | undefined;
  input: CanonicalQuoteInput;
}): Promise<CanonicalQuoteResult> {
  const { databaseUrl, input } = params;

  if (!input.quotedVehiclePrice || input.quotedVehiclePrice <= 0) {
    throw new Error("BNK Capital requires quotedVehiclePrice — vehicle prices are not stored in the BNK workbook.");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    // 1. Active workbook
    const activeImport = await db
      .select({ id: workbookImports.id, versionLabel: workbookImports.versionLabel })
      .from(workbookImports)
      .where(and(eq(workbookImports.lenderCode, "bnk-capital"), eq(workbookImports.isActive, true)))
      .orderBy(desc(workbookImports.importedAt))
      .limit(1)
      .then((rows: { id: string; versionLabel: string }[]) => rows[0] ?? null);

    if (!activeImport) {
      throw new Error("BNK Capital workbook not imported. Please upload the BNK workbook first.");
    }

    // 2. Resolve vehicle
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

      const resolved = resolveModelNameByVehicleKey(input.brand, input.modelName, allBrandVehicles);
      if (resolved) {
        vehicleRow = resolved;
      }
    }

    if (!vehicleRow) {
      throw new Error(`Vehicle not found in BNK catalog: ${input.brand} / ${input.modelName}`);
    }

    // 3. Base IRR from brand rate policy (dealer-aware)
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

    // Fallback to company policies if no match for the requested ownershipType
    const policies = allPolicies.length > 0
      ? allPolicies
      : await db
          .select({ baseIrrRate: brandRatePolicies.baseIrrRate, rawPolicy: brandRatePolicies.rawPolicy })
          .from(brandRatePolicies)
          .where(
            and(
              eq(brandRatePolicies.workbookImportId, activeImport.id),
              eq(brandRatePolicies.brand, input.brand),
              eq(brandRatePolicies.productType, "operating_lease"),
              eq(brandRatePolicies.ownershipType, "company"),
            ),
          )
          .then((rows) => rows);

    let policyBaseIrr: number;
    if (input.bnkDealerName) {
      // Dealer specified — find matching dealer policy
      const dealerMatch = policies.find(
        (p) => (p.rawPolicy as Record<string, unknown>)?.dealerName === input.bnkDealerName,
      );
      policyBaseIrr = dealerMatch ? Number(dealerMatch.baseIrrRate) : 0.0681;
    } else {
      // No dealer specified — default to 비제휴 dealer policy, else brand default
      const nonAffiliate = policies.find((p) => {
        const dn = (p.rawPolicy as Record<string, unknown>)?.dealerName;
        return typeof dn === "string" && dn.includes("비제휴");
      });
      const brandDefault = policies.find(
        (p) => !(p.rawPolicy as Record<string, unknown>)?.dealerName,
      );
      policyBaseIrr = nonAffiliate
        ? Number(nonAffiliate.baseIrrRate)
        : brandDefault
          ? Number(brandDefault.baseIrrRate)
          : 0.0681;
    }

    // 4. Resolve matrixGroups for provider lookup (Phase B auto-rate path)
    // CDB grades can be numbers (9, 3.5) or strings ("S8", "S10").
    // All map to the unified BNK table via "BNK_{gradeValue}".
    const rawRow = vehicleRow.rawRow;
    const matrixGroupsToFetch: string[] = [];

    for (const provider of BNK_PROVIDERS) {
      const mg = resolveBnkMatrixGroup(rawRow?.[provider.key]);
      if (mg) matrixGroupsToFetch.push(mg);
    }

    // Fetch standard residual rates from DB for all applicable providers
    let providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[] = [];
    if (matrixGroupsToFetch.length > 0) {
      providerRates = await db
        .select({
          matrixGroup: residualMatrixRows.matrixGroup,
          leaseTermMonths: residualMatrixRows.leaseTermMonths,
          residualRate: residualMatrixRows.residualRate,
        })
        .from(residualMatrixRows)
        .where(
          and(
            eq(residualMatrixRows.workbookImportId, activeImport.id),
            inArray(residualMatrixRows.matrixGroup, matrixGroupsToFetch),
            eq(residualMatrixRows.leaseTermMonths, input.leaseTermMonths),
          ),
        )
        .then(
          (
            rows: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[],
          ) => rows,
        );
    }

    return computeQuote({
      workbookImport: activeImport,
      input,
      vehicle: vehicleRow,
      policyBaseIrr,
      providerRates,
    });
  } finally {
    await dispose();
  }
}

// ---------------------------------------------------------------------------
// Pure calculation (no DB access) — also exported for testing
// ---------------------------------------------------------------------------

export type BnkQuoteContext = {
  workbookImport: ActiveWorkbook;
  input: CanonicalQuoteInput;
  vehicle: ResolvedVehicle;
  policyBaseIrr: number;
  providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[];
};

/** Exported for unit tests — bypasses DB, accepts pre-resolved context. */
export function calculateBnkOperatingLeaseQuoteFromContext(params: BnkQuoteContext): CanonicalQuoteResult {
  return computeQuote(params);
}

type ComputeQuoteParams = BnkQuoteContext;

function computeQuote(params: ComputeQuoteParams): CanonicalQuoteResult {
  const { workbookImport, input, vehicle, policyBaseIrr, providerRates } = params;
  const warnings: string[] = [];

  const quotedVehiclePrice = input.quotedVehiclePrice ?? 0;
  const discountAmount = Math.max(0, input.discountAmount ?? 0);
  const evSubsidyAmount = Math.max(0, input.evSubsidyAmount ?? 0);
  const discountedVehiclePrice = Math.max(0, quotedVehiclePrice - discountAmount - evSubsidyAmount);

  // Acquisition tax: roundDown(discountedVehiclePrice / 1.1 × rate, -1) — 10원 단위 절사
  // Supports 4 modes (matches MG Capital): automatic / ratio / reduction / amount
  const taxRate =
    input.acquisitionTaxRateOverride != null && input.acquisitionTaxRateOverride >= 0
      ? input.acquisitionTaxRateOverride
      : defaultAcquisitionTaxRate(vehicle.engineDisplacementCc);
  const automaticAcquisitionTax =
    taxRate > 0 ? roundDown((discountedVehiclePrice / 1.1) * taxRate, -1) : 0;

  const taxMode = input.acquisitionTaxMode ?? "automatic";
  let acquisitionTax: number;
  if (taxMode === "ratio") {
    acquisitionTax = roundDown(
      (discountedVehiclePrice / 1.1) * Math.max(0, input.acquisitionTaxRatioInput ?? 0),
      -1,
    );
  } else if (taxMode === "reduction") {
    acquisitionTax = Math.max(0, automaticAcquisitionTax - Math.max(0, input.acquisitionTaxReduction ?? 0));
  } else if (taxMode === "amount") {
    acquisitionTax = Math.max(0, input.acquisitionTaxAmountOverride ?? 0);
  } else {
    acquisitionTax = automaticAcquisitionTax;
  }

  const stampDuty = Math.max(0, input.stampDuty ?? 0);
  const deliveryFee =
    input.includeDeliveryFeeAmount && input.deliveryFeeAmount ? Math.max(0, input.deliveryFeeAmount) : 0;
  const miscFee =
    input.includeMiscFeeAmount && input.miscFeeAmount ? Math.max(0, input.miscFeeAmount) : 0;
  const publicBondCost =
    input.includePublicBondCost && input.publicBondCost ? Math.max(0, input.publicBondCost) : 0;

  // financedPrincipal = gross acquisition cost (upfrontPayment NOT subtracted — same as MG Capital)
  const financedPrincipal =
    discountedVehiclePrice + acquisitionTax + stampDuty + deliveryFee + miscFee + publicBondCost;

  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  const upfrontPayment = Math.max(0, input.upfrontPayment ?? 0);
  const term = input.leaseTermMonths;

  // -----------------------------------------------------------------------
  // Residual amount resolution
  // BNK: 잔존가치 기준 = discountedVehiclePrice (세금계산서 가격 × 잔가율)
  //      roundDown(..., -3) — 천원 단위 절사
  // -----------------------------------------------------------------------
  let residualRateRaw: number;
  let residualAmount: number;
  let residualSource: CanonicalQuoteResult["residual"]["source"];

  if (input.residualAmountOverride != null && input.residualAmountOverride >= 0) {
    residualAmount = roundDown(input.residualAmountOverride, -3);
    residualRateRaw = discountedVehiclePrice > 0 ? residualAmount / discountedVehiclePrice : 0;
    residualSource = "override";
  } else if (input.selectedResidualRateOverride != null) {
    residualRateRaw = Math.max(0, input.selectedResidualRateOverride);
    residualAmount = roundDown(discountedVehiclePrice * residualRateRaw, -3);
    residualSource = "override";
  } else if (input.residualRateOverride != null) {
    residualRateRaw = Math.max(0, input.residualRateOverride);
    residualAmount = roundDown(discountedVehiclePrice * residualRateRaw, -3);
    residualSource = "override";
  } else if (input.residualValueMode === "vehicle-price-ratio" && input.residualValueRatio != null) {
    residualRateRaw = Math.max(0, input.residualValueRatio);
    residualAmount = roundDown(discountedVehiclePrice * residualRateRaw, -3);
    residualSource = "residual-matrix";
  } else if (input.residualValueMode === "amount" && input.residualAmountOverride != null) {
    residualAmount = roundDown(Math.max(0, input.residualAmountOverride), -3);
    residualRateRaw = discountedVehiclePrice > 0 ? residualAmount / discountedVehiclePrice : 0;
    residualSource = "override";
  } else if (input.residualMode) {
    // Auto-determine residual from provider data based on mode (high/standard)
    const rawRow = vehicle.rawRow;
    const mileageAdj = getMileageAdjustment(input.annualMileageKm);
    let bestRate = 0;
    for (const provider of BNK_PROVIDERS) {
      const mg = resolveBnkMatrixGroup(rawRow?.[provider.key]);
      if (!mg) continue;
      const rateRow = providerRates.find((r) => r.matrixGroup === mg);
      if (!rateRow) continue;
      const baseRate = Number(rateRow.residualRate);
      if (!Number.isFinite(baseRate) || baseRate <= 0) continue;
      const standardRate = baseRate + mileageAdj;
      if (standardRate > bestRate) bestRate = standardRate;
    }
    if (bestRate > 0) {
      // high = max boosted rate (standard + 0.08 boost), standard = base rate
      residualRateRaw = input.residualMode === "high" ? bestRate + 0.08 : bestRate;
      residualAmount = roundDown(discountedVehiclePrice * residualRateRaw, -3);
      residualSource = "residual-matrix";
    } else {
      throw new Error("BNK Capital: 잔가사 데이터가 없어 잔존가치를 자동 결정할 수 없습니다.");
    }
  } else {
    throw new Error(
      "BNK Capital: 잔존가치를 입력해 주세요. residualValueRatio, selectedResidualRateOverride, 또는 residualAmountOverride 중 하나를 설정하세요.",
    );
  }

  // -----------------------------------------------------------------------
  // IRR resolution
  // Phase B auto-rate path: look up each provider's standard residual,
  // compute guarantee fee based on gap, select best provider (lowest fee).
  // Phase A: annualIrrRateOverride bypasses all auto logic.
  // -----------------------------------------------------------------------
  let annualIrrRate: number;
  let guaranteeFeeRate = 0;
  let resolvedMatrixGroup: string | null = null;
  let selectedProviderResult: BnkProviderResult | null = null;
  let rateSource: CanonicalQuoteResult["rates"]["source"] = "brand-policy";

  if (input.annualIrrRateOverride != null && input.annualIrrRateOverride > 0) {
    // Phase A override path — fee is baked into the override rate
    annualIrrRate = input.annualIrrRateOverride;
    rateSource = "override";
  } else {
    // Phase B auto-rate path: find best provider (lowest guarantee fee)
    const rawRow = vehicle.rawRow;
    const providerResults: BnkProviderResult[] = [];
    const mileageAdj = getMileageAdjustment(input.annualMileageKm);

    for (const provider of BNK_PROVIDERS) {
      const mg = resolveBnkMatrixGroup(rawRow?.[provider.key]);
      if (!mg) continue;

      const rateRow = providerRates.find((r) => r.matrixGroup === mg);
      if (!rateRow) continue;

      // standardRate from RVs is at 2만km base; apply mileage adjustment.
      const baseRate = Number(rateRow.residualRate);
      if (!Number.isFinite(baseRate) || baseRate <= 0) continue;
      const standardRate = baseRate + mileageAdj;

      // Gap = applied - standard. Positive = applied exceeds base → guarantor takes
      // more risk → fee increases.  Matches Es1 B54 = applied_rate - base_rate.
      // Round to 5 decimals to match Es1 B54: ROUND(gap, 5) — avoids IEEE 754 drift
      const gap = Math.round((residualRateRaw - standardRate) * 100000) / 100000;
      const guaranteeFee = lookupGuaranteeFeeFromGap(gap, provider.maxFee);

      providerResults.push({ matrixGroup: mg, standardRate, gapFromStandard: gap, guaranteeFee });
    }

    if (providerResults.length > 0) {
      // Select provider with lowest guarantee fee.
      // Equivalent to Excel's "highest base rate" selection (VLOOKUP B50 in G101:H107),
      // since a higher base → smaller gap → lower fee for the same applied rate.
      // Tie-break: prefer the provider where applied rate is closest to base (smallest |gap|).
      selectedProviderResult = providerResults.reduce((best, curr) => {
        if (curr.guaranteeFee < best.guaranteeFee) return curr;
        if (curr.guaranteeFee === best.guaranteeFee && Math.abs(curr.gapFromStandard) < Math.abs(best.gapFromStandard)) return curr;
        return best;
      });
      resolvedMatrixGroup = selectedProviderResult.matrixGroup;
    } else {
      warnings.push("BNK: 잔가사 데이터를 찾지 못했습니다. 잔가보장 수수료 = 0%로 계산합니다.");
    }

    guaranteeFeeRate = selectedProviderResult?.guaranteeFee ?? 0;
    const cmFee = Math.max(0, input.cmFeeRate ?? 0);
    const agFee = Math.max(0, input.agFeeRate ?? 0);

    // TODO: B185 residual rate adjustment (company -0.3%, customer +0.3% when applied > base)
    // Conditions for B185 are complex (B56 vs B52). Needs verified fixture data.

    // Composed rate = base + CM + AG (WITHOUT guarantee fee — fee is lump sum)
    annualIrrRate = policyBaseIrr + cmFee + agFee;
    rateSource = "brand-policy";
  }

  // -----------------------------------------------------------------------
  // Monthly payment calculation (Es1 B168 model)
  //
  // Guarantee fee is a LUMP SUM added to financed PV (not added to rate).
  //   feeAmount = guaranteeFeeRate × discountedVehiclePrice (Es1 B47)
  //   PV = financedPrincipal + feeAmount - upfront - deposit
  //   FV = residualAmount - deposit
  //   rate = composedRate (base + CM + AG, no guarantee fee)
  //
  // Displayed rate = RATE back-calc from payment on CLEAN PV (Es1 B167)
  //   RATE(months, payment, -(principal - upfront - deposit), FV) × 12
  // This gives an effective rate HIGHER than composedRate because the payment
  // amortizes the guarantee fee over the loan term.
  // -----------------------------------------------------------------------
  const guaranteeFeeAmount = Math.round(guaranteeFeeRate * discountedVehiclePrice);
  const monthlyRate = annualIrrRate / 12;
  const pv = Math.max(0, financedPrincipal + guaranteeFeeAmount - upfrontPayment - depositAmount);
  const fv = Math.max(0, residualAmount - depositAmount);

  const rawPayment = computeLeasePaymentRaw({ pv, fv, rate: monthlyRate, n: term });
  const displayedMonthlyPayment = roundUp(rawPayment, -2);

  // Displayed rate: RATE back-calc from clean PV (without fee) — Es1 B167
  const cleanPv = Math.max(0, financedPrincipal - upfrontPayment - depositAmount);
  const effectiveAnnualRateDecimal =
    input.annualEffectiveRateOverride ??
    (guaranteeFeeAmount > 0
      ? solveAnnualRate(term, displayedMonthlyPayment, cleanPv, fv)
      : annualIrrRate);

  return {
    lenderCode: "bnk-capital",
    productType: "operating_lease",
    workbookImport: {
      id: workbookImport.id,
      versionLabel: workbookImport.versionLabel,
    },
    resolvedVehicle: {
      brand: vehicle.brand,
      modelName: vehicle.modelName,
      vehiclePrice: quotedVehiclePrice,
      vehicleClass: vehicle.vehicleClass,
      engineDisplacementCc: vehicle.engineDisplacementCc,
      highResidualAllowed: vehicle.highResidualAllowed,
      hybridAllowed: vehicle.hybridAllowed,
      snkResidualBand: null,
      residualPromotionCode: null,
    },
    majorInputs: {
      ownershipType: input.ownershipType,
      leaseTermMonths: term,
      vehiclePrice: quotedVehiclePrice,
      discountedVehiclePrice,
      upfrontPayment,
      depositAmount,
      financedPrincipal,
    },
    feesAndTaxes: {
      acquisitionTax,
      registrationTax: 0,
      publicBondCost,
      stampDuty,
      extraFees: deliveryFee + miscFee,
    },
    residual: {
      matrixGroup: resolvedMatrixGroup,
      source: residualSource,
      rateDecimal: residualRateRaw,
      amount: residualAmount,
    },
    rates: {
      source: rateSource,
      annualRateDecimal: effectiveAnnualRateDecimal,
      effectiveAnnualRateDecimal,
      monthlyRateDecimal: monthlyRate,
    },
    monthlyPayment: displayedMonthlyPayment,
    warnings,
  };
}
