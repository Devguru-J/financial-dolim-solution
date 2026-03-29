import { and, desc, eq, inArray } from "drizzle-orm";

import {
  brandRatePolicies,
  residualMatrixRows,
  vehiclePrograms,
  workbookImports,
} from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
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
// BNK Guarantee fee table (indexed by gap = standard_rate - applied_rate)
// gap ≤ 0:         0%   (applied at or above standard → no extra risk)
// 0 < gap ≤ 0.01: 1.21%
// 0.01 < gap ≤ 0.02: 1.10%
// 0.02 < gap ≤ 0.03: 0.88%
// 0.03 < gap ≤ 0.04: 0.66%
// 0.04 < gap ≤ 0.05: 0.44%
// 0.05 < gap ≤ 0.06: 0.22%
// gap > 0.06:      0%   (very conservative residual, guarantee risk is near-zero)
// ---------------------------------------------------------------------------

const BNK_GAP_FEE_STEPS: Array<{ maxGap: number; fee: number }> = [
  { maxGap: 0.00, fee: 0 },
  { maxGap: 0.01, fee: 0.0121 },
  { maxGap: 0.02, fee: 0.011 },
  { maxGap: 0.03, fee: 0.0088 },
  { maxGap: 0.04, fee: 0.0066 },
  { maxGap: 0.05, fee: 0.0044 },
  { maxGap: 0.06, fee: 0.0022 },
];

function lookupGuaranteeFeeFromGap(gapDecimal: number): number {
  if (gapDecimal <= 0) return 0;
  for (let i = BNK_GAP_FEE_STEPS.length - 1; i >= 0; i--) {
    if (gapDecimal > BNK_GAP_FEE_STEPS[i].maxGap) {
      return BNK_GAP_FEE_STEPS[i + 1]?.fee ?? 0;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// BNK provider configuration
// ---------------------------------------------------------------------------

// Maps rawRow grade key → matrixGroup prefix for DB lookup
const BNK_PROVIDERS = [
  { key: "cbGrade", prefix: "CB" },
  { key: "tyGrade", prefix: "TY" },
  { key: "crGrade", prefix: "CR" },
  { key: "adbGrade", prefix: "ADB" },
  // JY uses float/string grades — handled separately after Phase A
] as const;

type BnkProviderResult = {
  matrixGroup: string;
  standardRate: number;
  gapFromStandard: number;
  guaranteeFee: number;
};

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
    const vehicleRow = await db
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

    if (!vehicleRow) {
      throw new Error(`Vehicle not found in BNK catalog: ${input.brand} / ${input.modelName}`);
    }

    // 3. Base IRR from brand rate policy
    const policyRow = await db
      .select({ baseIrrRate: brandRatePolicies.baseIrrRate })
      .from(brandRatePolicies)
      .where(
        and(
          eq(brandRatePolicies.workbookImportId, activeImport.id),
          eq(brandRatePolicies.brand, input.brand),
          eq(brandRatePolicies.productType, "operating_lease"),
          eq(brandRatePolicies.ownershipType, input.ownershipType),
        ),
      )
      .limit(1)
      .then((rows: { baseIrrRate: string | null }[]) => rows[0] ?? null);

    // Fallback to company policy if individual not found
    const policyFallback =
      policyRow ??
      (await db
        .select({ baseIrrRate: brandRatePolicies.baseIrrRate })
        .from(brandRatePolicies)
        .where(
          and(
            eq(brandRatePolicies.workbookImportId, activeImport.id),
            eq(brandRatePolicies.brand, input.brand),
            eq(brandRatePolicies.productType, "operating_lease"),
            eq(brandRatePolicies.ownershipType, "company"),
          ),
        )
        .limit(1)
        .then((rows: { baseIrrRate: string | null }[]) => rows[0] ?? null));

    const policyBaseIrr = policyFallback ? Number(policyFallback.baseIrrRate) : 0.0681;

    // 4. Resolve matrixGroups for provider lookup (Phase B auto-rate path)
    const rawRow = vehicleRow.rawRow;
    const matrixGroupsToFetch: string[] = [];

    for (const provider of BNK_PROVIDERS) {
      const gradeIdx = rawRow?.[provider.key];
      if (typeof gradeIdx === "number" && gradeIdx > 0) {
        matrixGroupsToFetch.push(`${provider.prefix}_${Math.trunc(gradeIdx)}`);
      }
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
  const discountedVehiclePrice = quotedVehiclePrice - discountAmount;

  // Acquisition tax: roundDown(discountedVehiclePrice / 1.1 × rate, -1) — 10원 단위 절사
  const taxRateOverride = input.acquisitionTaxRateOverride;
  const taxRate =
    taxRateOverride != null && taxRateOverride >= 0
      ? taxRateOverride
      : defaultAcquisitionTaxRate(vehicle.engineDisplacementCc);
  const acquisitionTax =
    taxRate > 0 ? roundDown((discountedVehiclePrice / 1.1) * taxRate, -1) : 0;

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
  let resolvedMatrixGroup: string | null = null;
  let selectedProviderResult: BnkProviderResult | null = null;
  let rateSource: CanonicalQuoteResult["rates"]["source"] = "brand-policy";

  if (input.annualIrrRateOverride != null && input.annualIrrRateOverride > 0) {
    // Phase A override path
    annualIrrRate = input.annualIrrRateOverride;
    rateSource = "override";
  } else {
    // Phase B auto-rate path: find best provider (lowest guarantee fee)
    const rawRow = vehicle.rawRow;
    const providerResults: BnkProviderResult[] = [];

    for (const provider of BNK_PROVIDERS) {
      const gradeIdx = rawRow?.[provider.key];
      if (typeof gradeIdx !== "number" || gradeIdx <= 0) continue;

      const mg = `${provider.prefix}_${Math.trunc(gradeIdx)}`;
      const rateRow = providerRates.find((r) => r.matrixGroup === mg);
      if (!rateRow) continue;

      const standardRate = Number(rateRow.residualRate);
      if (!Number.isFinite(standardRate) || standardRate <= 0) continue;

      // Gap = standard - applied. Positive = applied is below standard → fee > 0.
      const gap = Math.max(0, standardRate - residualRateRaw);
      const guaranteeFee = lookupGuaranteeFeeFromGap(gap);

      providerResults.push({ matrixGroup: mg, standardRate, gapFromStandard: gap, guaranteeFee });
    }

    if (providerResults.length > 0) {
      // Select provider with lowest guarantee fee
      // If tie: prefer the one where applied rate is closest to (≤) standard (lowest gap)
      selectedProviderResult = providerResults.reduce((best, curr) => {
        if (curr.guaranteeFee < best.guaranteeFee) return curr;
        if (curr.guaranteeFee === best.guaranteeFee && curr.gapFromStandard < best.gapFromStandard) return curr;
        return best;
      });
      resolvedMatrixGroup = selectedProviderResult.matrixGroup;
    } else {
      warnings.push("BNK: 잔가사 데이터를 찾지 못했습니다. 잔가보장 수수료 = 0%로 계산합니다.");
    }

    const guaranteeFee = selectedProviderResult?.guaranteeFee ?? 0;
    const cmFee = Math.max(0, input.cmFeeRate ?? 0);
    const agFee = Math.max(0, input.agFeeRate ?? 0);
    annualIrrRate = policyBaseIrr + guaranteeFee + cmFee + agFee;
    rateSource = "brand-policy";
  }

  // -----------------------------------------------------------------------
  // Monthly payment calculation
  // monthlyRate = annualRate / 12 (simple division — matches BNK Es1 formula)
  // PMT: ((PV - FV/factor) * rate) / (1 - 1/factor)
  //   PV = financedPrincipal - upfront - deposit
  //   FV = residualAmount - deposit
  // displayedMonthlyPayment = ROUNDUP(rawPayment, -2) — 100원 단위 올림
  // -----------------------------------------------------------------------
  const monthlyRate = annualIrrRate / 12;
  const pv = Math.max(0, financedPrincipal - upfrontPayment - depositAmount);
  const fv = Math.max(0, residualAmount - depositAmount);

  const rawPayment = computeLeasePaymentRaw({ pv, fv, rate: monthlyRate, n: term });
  const displayedMonthlyPayment = roundUp(rawPayment, -2);

  // Effective rate (back-solve from payment for reporting)
  const effectiveAnnualRateDecimal = input.annualEffectiveRateOverride ?? annualIrrRate;

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
      annualRateDecimal: annualIrrRate,
      effectiveAnnualRateDecimal,
      monthlyRateDecimal: monthlyRate,
    },
    monthlyPayment: displayedMonthlyPayment,
    warnings,
  };
}
