import { and, desc, eq } from "drizzle-orm";

import {
  brandRatePolicies,
  residualMatrixRows,
  vehiclePrograms,
  workbookImports,
} from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
import { resolveModelNameByVehicleKey } from "@/domain/vehicles/vehicle-key";
import { createDbClient } from "@/lib/db/client";

type ActiveWorkbookContext = {
  id: string;
  versionLabel: string;
};

type ResolvedVehicle = {
  brand: string;
  modelName: string;
  vehiclePrice: string;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  highResidualAllowed: boolean | null;
  hybridAllowed: boolean | null;
  residualPromotionCode: string | null;
  snkResidualBand: string | null;
  term12Residual: string | null;
  term24Residual: string | null;
  term36Residual: string | null;
  term48Residual: string | null;
  term60Residual: string | null;
  rawRow: Record<string, unknown> | null;
};

type CalculateFromResolvedInputParams = {
  workbookImport: ActiveWorkbookContext;
  input: CanonicalQuoteInput;
  vehicle: ResolvedVehicle;
  matrixRows?: MgResidualMatrixLookupRow[];
  displayedAnnualRateRaw: number;
  residualRateRaw: number;
  maximumResidualRateRaw?: number | null;
  residualSource: CanonicalQuoteResult["residual"]["source"];
  resolvedMatrixGroup: string | null;
};

export type MgResidualMatrixLookupRow = {
  matrixGroup: string;
  residualRate: string | number;
};

type ResolvedResidualRate = {
  residualRateRaw: number;
  residualSource: CanonicalQuoteResult["residual"]["source"];
  resolvedMatrixGroup: string | null;
};

export type MgResidualCandidate = {
  name: "에스앤케이모터스" | "APS" | "차봇";
  baseRate: number;
  mileageAdjustedRate: number;
  boostedRate: number;
};

export type MgResidualCandidateSummary = {
  candidates: MgResidualCandidate[];
  maxBoostedRate: number | null;
  selectedCandidateName: string | null;
};

const mgResidualTieBreakPriority: Record<MgResidualCandidate["name"], number> = {
  APS: 0,
  에스앤케이모터스: 1,
  차봇: 2,
};

function parseNumeric(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRawRowText(rawRow: Record<string, unknown> | null, key: string): string | null {
  const value = rawRow?.[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeRate(rate: number): number {
  return rate > 1 ? rate / 100 : rate;
}

function roundCurrency(value: number): number {
  return Math.round(value);
}

function roundDown(value: number, digits: number): number {
  const factor = 10 ** Math.abs(digits);
  if (digits < 0) {
    return Math.floor(value / factor) * factor;
  }

  return Math.floor(value * factor) / factor;
}

function roundToDecimals(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundUp(value: number, digits: number): number {
  const factor = 10 ** Math.abs(digits);
  if (digits < 0) {
    return Math.ceil(value / factor) * factor;
  }

  return Math.ceil(value * factor) / factor;
}

function readRawRowRate(
  rawRow: Record<string, unknown> | null,
  key: string,
  leaseTermMonths: CanonicalQuoteInput["leaseTermMonths"],
): number | null {
  const value = rawRow?.[key];
  if (value == null || typeof value !== "object") {
    return null;
  }

  const rate = (value as Record<string, unknown>)[String(leaseTermMonths)];
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
}

function readRawPromotionRate(rawRow: Record<string, unknown> | null, key: "apsPromotionRate" | "snkPromotionRate"): number {
  const value = rawRow?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return parseNumeric(String(value ?? "")) ?? 0;
}

function promotionRateForMatrixGroup(rawRow: Record<string, unknown> | null, matrixGroup: string | null): number {
  if (matrixGroup === "에스앤케이모터스" || matrixGroup === "SNK") {
    return readRawPromotionRate(rawRow, "snkPromotionRate");
  }
  if (matrixGroup === "APS") {
    return readRawPromotionRate(rawRow, "apsPromotionRate");
  }
  return 0;
}

function resolveMileageAdjustedRate(params: {
  baseRate: number;
  annualMileageKm: number;
  source: "snk" | "aps" | "chatbot";
  promotionRate?: number | null;
}): number {
  const { baseRate, annualMileageKm, source, promotionRate } = params;
  const promo = promotionRate ?? 0;

  if (source === "snk") {
    if (annualMileageKm === 35000) {
      return baseRate - 0.02 + promo;
    }
    if (annualMileageKm === 30000) {
      return baseRate - 0.05 + promo;
    }
    if (annualMileageKm === 10000) {
      return baseRate + 0.005 + promo;
    }
    return baseRate + promo;
  }

  if (source === "aps") {
    if (annualMileageKm === 35000) {
      return baseRate - 0.02 + promo;
    }
    if (annualMileageKm === 30000) {
      return baseRate - 0.09 + promo;
    }
    if (annualMileageKm === 10000) {
      return baseRate + 0.01 + promo;
    }
    return baseRate + promo;
  }

  if (annualMileageKm === 20000) {
    return baseRate;
  }
  if (annualMileageKm === 30000) {
    return baseRate - 0.06;
  }
  if (annualMileageKm === 10000) {
    return baseRate;
  }
  return 0.02;
}

export function summarizeMgResidualCandidates(params: {
  input: Pick<CanonicalQuoteInput, "leaseTermMonths" | "ownershipType">;
  vehicle: Pick<ResolvedVehicle, "highResidualAllowed" | "rawRow">;
  annualMileageKm?: number;
  matrixRows?: MgResidualMatrixLookupRow[];
  selectedResidualRateDecimal?: number | null;
}): MgResidualCandidateSummary {
  const annualMileageKm = params.annualMileageKm ?? 20000;
  const rawRow = params.vehicle.rawRow;
  const highResidualBoost = params.vehicle.highResidualAllowed ? 0.08 : 0;

  const snkBaseRate =
    readRawRowRate(rawRow, "snkResiduals", params.input.leaseTermMonths) ??
    readRawRowRate(rawRow, "residuals", params.input.leaseTermMonths);
  const apsBaseRate = readRawRowRate(rawRow, "apsResiduals", params.input.leaseTermMonths);
  const chatbotBaseRate = readRawRowRate(rawRow, "chatbotResiduals", params.input.leaseTermMonths);
  const apsPromotionRate = readRawPromotionRate(rawRow, "apsPromotionRate");
  const snkPromotionRate = readRawPromotionRate(rawRow, "snkPromotionRate");

  const candidates: MgResidualCandidate[] = [];

  if (snkBaseRate != null) {
    const mileageAdjustedRate = resolveMileageAdjustedRate({
      baseRate: snkBaseRate,
      annualMileageKm,
      source: "snk",
      promotionRate: snkPromotionRate,
    });
    candidates.push({
      name: "에스앤케이모터스",
      baseRate: snkBaseRate,
      mileageAdjustedRate,
      boostedRate: mileageAdjustedRate + highResidualBoost,
    });
  }

  if (apsBaseRate != null) {
    const mileageAdjustedRate = resolveMileageAdjustedRate({
      baseRate: apsBaseRate,
      annualMileageKm,
      source: "aps",
      promotionRate: apsPromotionRate,
    });
    candidates.push({
      name: "APS",
      baseRate: apsBaseRate,
      mileageAdjustedRate,
      boostedRate: mileageAdjustedRate + highResidualBoost,
    });
  }

  if (chatbotBaseRate != null) {
    const mileageAdjustedRate = resolveMileageAdjustedRate({
      baseRate: chatbotBaseRate,
      annualMileageKm,
      source: "chatbot",
    });
    candidates.push({
      name: "차봇",
      baseRate: chatbotBaseRate,
      mileageAdjustedRate,
      boostedRate: mileageAdjustedRate + highResidualBoost,
    });
  }

  if (params.matrixRows && params.matrixRows.length > 0) {
    for (const row of params.matrixRows) {
      const baseRate = normalizeRate(parseNumeric(String(row.residualRate)) ?? 0);
      if (!Number.isFinite(baseRate) || baseRate <= 0) {
        continue;
      }

      const matrixGroup = row.matrixGroup;
      const candidateName =
        matrixGroup === "에스앤케이모터스" || matrixGroup === "SNK"
          ? "에스앤케이모터스"
          : matrixGroup === "APS"
            ? "APS"
            : null;

      if (!candidateName) {
        continue;
      }

      if (candidates.some((candidate) => candidate.name === candidateName)) {
        continue;
      }

      const source = candidateName === "에스앤케이모터스" ? "snk" : "aps";
      const promotionRate = promotionRateForMatrixGroup(rawRow, matrixGroup);
      const mileageAdjustedRate = resolveMileageAdjustedRate({
        baseRate,
        annualMileageKm,
        source,
        promotionRate,
      });
      candidates.push({
        name: candidateName,
        baseRate,
        mileageAdjustedRate,
        boostedRate: mileageAdjustedRate + highResidualBoost,
      });
    }
  }

  const selectedCandidate = candidates.reduce<MgResidualCandidate | null>((current, candidate) => {
    if (!current || candidate.boostedRate > current.boostedRate) {
      return candidate;
    }
    if (current && candidate.boostedRate === current.boostedRate) {
      if (
        params.selectedResidualRateDecimal != null &&
        (candidate.name === "에스앤케이모터스" || candidate.name === "APS") &&
        (current.name === "에스앤케이모터스" || current.name === "APS")
      ) {
        const candidateFeeRate = lookupResidualGapFeeRate(
          Math.max(0, candidate.boostedRate - params.selectedResidualRateDecimal),
          candidate.name === "에스앤케이모터스" ? "에스앤케이모터스" : "APS",
        );
        const currentFeeRate = lookupResidualGapFeeRate(
          Math.max(0, current.boostedRate - params.selectedResidualRateDecimal),
          current.name === "에스앤케이모터스" ? "에스앤케이모터스" : "APS",
        );
        if (candidateFeeRate !== currentFeeRate) {
          return candidateFeeRate < currentFeeRate ? candidate : current;
        }
      }
      return mgResidualTieBreakPriority[candidate.name] < mgResidualTieBreakPriority[current.name] ? candidate : current;
    }
    return current;
  }, null);

  return {
    candidates,
    maxBoostedRate: selectedCandidate?.boostedRate ?? null,
    selectedCandidateName: selectedCandidate?.name ?? null,
  };
}

function computeLeaseMonthlyPaymentRaw(params: {
  presentValue: number;
  futureValue: number;
  monthlyRateDecimal: number;
  leaseTermMonths: number;
}) {
  const { presentValue, futureValue, monthlyRateDecimal, leaseTermMonths } = params;

  if (leaseTermMonths <= 0) {
    throw new Error("Lease term must be greater than 0.");
  }

  if (monthlyRateDecimal === 0) {
    return (presentValue - futureValue) / leaseTermMonths;
  }

  const factor = (1 + monthlyRateDecimal) ** leaseTermMonths;
  return ((presentValue - futureValue / factor) * monthlyRateDecimal) / (1 - factor ** -1);
}

function computeLeaseMonthlyPayment(params: {
  presentValue: number;
  futureValue: number;
  monthlyRateDecimal: number;
  leaseTermMonths: number;
}): number {
  return roundCurrency(computeLeaseMonthlyPaymentRaw(params));
}

function solveAnnualRateFromPayment(params: {
  periods: number;
  payment: number;
  presentValue: number;
  futureValue: number;
}): number {
  const { periods, payment, presentValue, futureValue } = params;

  let low = 0;
  let high = 0.5;

  for (let index = 0; index < 80; index += 1) {
    const annualRate = (low + high) / 2;
    const monthlyRate = annualRate / 12;
    const factor = (1 + monthlyRate) ** periods;
    const computedNetPresentValue =
      -presentValue * factor + payment * ((factor - 1) / monthlyRate) + futureValue;

    if (computedNetPresentValue > 0) {
      low = annualRate;
    } else {
      high = annualRate;
    }
  }

  return (low + high) / 2;
}

function resolveAcquisitionTaxRate(params: {
  vehicleClass: string | null;
  override?: number;
}): number {
  if (params.override != null) {
    return params.override;
  }

  const vehicleClass = params.vehicleClass ?? "";

  if (vehicleClass.includes("승용")) {
    return 0.07;
  }

  if (vehicleClass.includes("화물")) {
    return 0.05;
  }

  if (vehicleClass.includes("승합")) {
    return 0.07;
  }

  return 0.07;
}

function resolveMinimumResidualRateByTerm(leaseTermMonths: CanonicalQuoteInput["leaseTermMonths"]): number {
  const minimumRateByTerm: Record<CanonicalQuoteInput["leaseTermMonths"], number> = {
    12: 0.5,
    24: 0.4,
    36: 0.3,
    48: 0.2,
    60: 0.15,
  };

  return minimumRateByTerm[leaseTermMonths];
}

function lookupResidualGapFeeRate(
  residualGapRateDecimal: number,
  matrixGroup?: string | null,
): number {
  const apsTable: Array<{ gap: number; feeRate: number }> = [
    { gap: 0, feeRate: 0.011 },
    { gap: 0.01, feeRate: 0.0099 },
    { gap: 0.02, feeRate: 0.0077 },
    { gap: 0.03, feeRate: 0.0066 },
    { gap: 0.04, feeRate: 0.0055 },
    { gap: 0.05, feeRate: 0.0044 },
    { gap: 0.06, feeRate: 0.0022 },
    { gap: 0.07, feeRate: 0 },
    { gap: 0.08, feeRate: 0 },
  ];
  const snkTable: Array<{ gap: number; feeRate: number }> = [
    { gap: 0, feeRate: 0.0132 },
    { gap: 0.01, feeRate: 0.0121 },
    { gap: 0.02, feeRate: 0.011 },
    { gap: 0.03, feeRate: 0.0099 },
    { gap: 0.04, feeRate: 0.0088 },
    { gap: 0.05, feeRate: 0.0077 },
    { gap: 0.06, feeRate: 0.0066 },
    { gap: 0.07, feeRate: 0.0055 },
    { gap: 0.08, feeRate: 0 },
  ];
  const lookupTable =
    matrixGroup === "에스앤케이모터스" || matrixGroup === "SNK" ? snkTable : apsTable;

  let matched = lookupTable[0].feeRate;
  for (const row of lookupTable) {
    if (residualGapRateDecimal >= row.gap) {
      matched = row.feeRate;
      continue;
    }
    break;
  }

  return matched;
}

function residualGuaranteeMatrixGroupFromCandidateName(
  candidateName: string | null,
): string | null {
  if (candidateName === "에스앤케이모터스") {
    return "에스앤케이모터스";
  }
  if (candidateName === "APS") {
    return "APS";
  }
  return null;
}

function matrixRowMatchesVehicleResidualSource(
  matrixGroup: string,
  gradeCode: string,
  params: {
    snkResidualBand: string | null;
    apsResidualBand: string | null;
  },
): boolean {
  if (matrixGroup === "에스앤케이모터스" || matrixGroup === "SNK") {
    return params.snkResidualBand != null && gradeCode === params.snkResidualBand;
  }

  if (matrixGroup === "APS") {
    return params.apsResidualBand != null && gradeCode === params.apsResidualBand;
  }

  return (
    (params.snkResidualBand != null && gradeCode === params.snkResidualBand) ||
    (params.apsResidualBand != null && gradeCode === params.apsResidualBand)
  );
}

export function resolveWorkbookDisplayedAnnualRate(params: {
  input: CanonicalQuoteInput;
  baseIrrRateRaw: number | null;
}): {
  displayedAnnualRateRaw: number | null;
  source: CanonicalQuoteResult["rates"]["source"];
} {
  const { input, baseIrrRateRaw } = params;

  if (input.annualIrrRateOverride != null) {
    return {
      displayedAnnualRateRaw: input.annualIrrRateOverride,
      source: "override",
    };
  }

  if (input.affiliateType === "KCC오토" || input.affiliateType === "KCC면제") {
    return {
      displayedAnnualRateRaw: (baseIrrRateRaw ?? 0) + 0.015,
      source: "brand-policy",
    };
  }

  return {
    displayedAnnualRateRaw: baseIrrRateRaw,
    source: "brand-policy",
  };
}

function computeWorkbookDisplayedAnnualRateFromFormula(params: {
  input: CanonicalQuoteInput;
  baseAnnualRateDecimal: number;
  discountedVehiclePrice: number;
  acquisitionTax: number;
  publicBondCost: number;
  miscFeeAmount: number;
  deliveryFeeAmount: number;
  residualAmount: number;
  maximumResidualRateDecimal: number;
  ownershipType: CanonicalQuoteInput["ownershipType"];
  residualGuaranteeMatrixGroup?: string | null;
}): number {
  const {
    input,
    baseAnnualRateDecimal,
    discountedVehiclePrice,
    acquisitionTax,
    publicBondCost,
    miscFeeAmount,
    deliveryFeeAmount,
    residualAmount,
    maximumResidualRateDecimal,
    ownershipType,
    residualGuaranteeMatrixGroup,
  } = params;

  const acquisitionCostBase =
    discountedVehiclePrice + acquisitionTax + publicBondCost + miscFeeAmount + deliveryFeeAmount;
  const upfrontPayment = Math.max(0, input.upfrontPayment);
  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  const customerOffsetBase = Math.round((discountedVehiclePrice / 1.1) / 10);
  const cq22 = upfrontPayment + depositAmount;
  const selectedResidualAmount = roundDown(
    input.residualAmountOverride ??
      (input.selectedResidualRateOverride != null
        ? discountedVehiclePrice * input.selectedResidualRateOverride
        : input.residualValueRatio != null
          ? discountedVehiclePrice * input.residualValueRatio
          : residualAmount),
    -3,
  );
  const maximumResidualAmount = roundDown(discountedVehiclePrice * maximumResidualRateDecimal, -1);
  const residualGapRateDecimal =
    discountedVehiclePrice > 0 ? Math.max(0, maximumResidualAmount - selectedResidualAmount) / discountedVehiclePrice : 0;
  const residualGuaranteeFeeRate = lookupResidualGapFeeRate(residualGapRateDecimal, residualGuaranteeMatrixGroup);
  const residualGuaranteeFeeAmount = roundDown(discountedVehiclePrice * residualGuaranteeFeeRate, 0);
  const agFeeAmount = roundDown(acquisitionCostBase * Math.max(0, input.agFeeRate ?? 0), 0);
  const cmFeeAmount = roundDown(acquisitionCostBase * Math.max(0, input.cmFeeRate ?? 0), 0);
  const stampDuty = Math.max(0, input.stampDuty ?? 10000);

  const cq8 = ownershipType === "customer" ? Math.max(acquisitionCostBase - customerOffsetBase, 0) : acquisitionCostBase;
  const cq17 = cq8 + agFeeAmount + cmFeeAmount + residualGuaranteeFeeAmount + stampDuty;
  const cq24 = residualAmount;
  const cq26 = computeLeaseMonthlyPaymentRaw({
    presentValue: Math.max(cq17 - cq22, 0),
    futureValue: Math.max(cq24 - depositAmount, 0),
    monthlyRateDecimal: baseAnnualRateDecimal / 12,
    leaseTermMonths: input.leaseTermMonths,
  });
  const cq27 = solveAnnualRateFromPayment({
    periods: input.leaseTermMonths,
    payment: cq26,
    presentValue: Math.max(cq8 - upfrontPayment, 0),
    futureValue: cq24,
  });

  return roundToDecimals(cq27, 5);
}

function resolveDiscountAmount(params: {
  input: CanonicalQuoteInput;
  quotedVehiclePrice: number;
  publicBondPurchaseAmount: number;
}): number {
  const { input, quotedVehiclePrice, publicBondPurchaseAmount } = params;

  if (input.discountAmount != null) {
    return Math.max(0, input.discountAmount);
  }

  if (input.discountMode === "rate" && input.discountRate != null) {
    return Math.max(0, roundDown((quotedVehiclePrice + publicBondPurchaseAmount) * input.discountRate, -1));
  }

  return 0;
}

function resolveAcquisitionTax(params: {
  input: CanonicalQuoteInput;
  discountedVehiclePrice: number;
  automaticAcquisitionTax: number;
}): number {
  const { input, discountedVehiclePrice, automaticAcquisitionTax } = params;
  const mode = input.acquisitionTaxMode ?? "automatic";

  if (mode === "ratio") {
    return roundDown((discountedVehiclePrice / 1.1) * Math.max(0, input.acquisitionTaxRatioInput ?? 0), -1);
  }

  if (mode === "reduction") {
    return Math.max(0, automaticAcquisitionTax - Math.max(0, input.acquisitionTaxReduction ?? 0));
  }

  if (mode === "amount") {
    return Math.max(0, input.acquisitionTaxAmountOverride ?? 0);
  }

  return automaticAcquisitionTax;
}

function resolveResidualAmount(params: {
  input: CanonicalQuoteInput;
  discountedVehiclePrice: number;
  acquisitionCost: number;
  residualRateDecimal: number;
}): number {
  const { input, discountedVehiclePrice, acquisitionCost, residualRateDecimal } = params;

  if (input.residualAmountOverride != null) {
    return roundDown(Math.max(0, input.residualAmountOverride), -3);
  }

  if (input.selectedResidualRateOverride != null) {
    return roundDown(discountedVehiclePrice * Math.max(0, input.selectedResidualRateOverride), -3);
  }

  const mode = input.residualValueMode;

  if (mode === "acquisition-cost-ratio") {
    return roundDown(acquisitionCost * Math.max(0, input.residualValueRatio ?? 0), -3);
  }

  if (mode === "vehicle-price-ratio") {
    return roundDown(discountedVehiclePrice * Math.max(0, input.residualValueRatio ?? 0), -3);
  }

  return roundCurrency(discountedVehiclePrice * residualRateDecimal);
}

async function findActiveWorkbook(params: {
  databaseUrl: string;
  lenderCode: string;
}): Promise<ActiveWorkbookContext> {
  const { databaseUrl, lenderCode } = params;
  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const [activeImport] = await db
      .select({
        id: workbookImports.id,
        versionLabel: workbookImports.versionLabel,
      })
      .from(workbookImports)
      .where(and(eq(workbookImports.lenderCode, lenderCode), eq(workbookImports.isActive, true)))
      .orderBy(desc(workbookImports.importedAt))
      .limit(1);

    if (!activeImport) {
      throw new Error(`No active workbook import found for lender '${lenderCode}'.`);
    }

    return activeImport;
  } finally {
    await dispose();
  }
}

function preferredResidualMatrixGroups(input: CanonicalQuoteInput): string[] {
  if (input.residualMatrixGroup) {
    return [input.residualMatrixGroup];
  }

  return ["에스앤케이모터스", "APS"];
}

export function resolveMgOperatingLeaseResidualRate(params: {
  input: CanonicalQuoteInput;
  vehicle: Pick<
    ResolvedVehicle,
    "snkResidualBand" | "term12Residual" | "term24Residual" | "term36Residual" | "term48Residual" | "term60Residual" | "rawRow"
  >;
  matrixRows?: MgResidualMatrixLookupRow[];
}): ResolvedResidualRate {
  const { input, vehicle, matrixRows = [] } = params;

  const residualFromVehicleMap: Record<12 | 24 | 36 | 48 | 60, number | null> = {
    12: parseNumeric(vehicle.term12Residual),
    24: parseNumeric(vehicle.term24Residual),
    36: parseNumeric(vehicle.term36Residual),
    48: parseNumeric(vehicle.term48Residual),
    60: parseNumeric(vehicle.term60Residual),
  };

  const residualFromOverrideOrVehicle = input.residualRateOverride ?? residualFromVehicleMap[input.leaseTermMonths];
  if (residualFromOverrideOrVehicle != null) {
    return {
      residualRateRaw: residualFromOverrideOrVehicle,
      residualSource: input.residualRateOverride != null ? "override" : "vehicle-program",
      resolvedMatrixGroup: null,
    };
  }

  const preferredGroups = preferredResidualMatrixGroups(input);
  const preferredMatrixRow =
    preferredGroups
      .map((group) => matrixRows.find((row) => row.matrixGroup === group))
      .find((row) => row != null) ?? matrixRows[0];

  if (!preferredMatrixRow) {
    throw new Error(
      `Residual rate not found for term '${input.leaseTermMonths}' and grade '${vehicle.snkResidualBand ?? "-"}'.`,
    );
  }

  const residualRateRaw =
    (parseNumeric(String(preferredMatrixRow.residualRate)) ?? 0) +
    promotionRateForMatrixGroup(input.directModelEntry ? null : vehicle.rawRow, preferredMatrixRow.matrixGroup);
  if (residualRateRaw == null) {
    throw new Error("Residual rate could not be resolved.");
  }

  return {
    residualRateRaw,
    residualSource: "residual-matrix",
    resolvedMatrixGroup: preferredMatrixRow.matrixGroup,
  };
}

export function calculateMgOperatingLeaseQuoteFromResolvedInput(
  params: CalculateFromResolvedInputParams,
): CanonicalQuoteResult {
  const {
    workbookImport,
    input,
    vehicle,
    matrixRows = [],
    displayedAnnualRateRaw,
    residualRateRaw,
    maximumResidualRateRaw,
    residualSource,
    resolvedMatrixGroup,
  } =
    params;

  const warnings: string[] = [];
  const hasExplicitResidualSelection =
    input.residualAmountOverride != null ||
    input.selectedResidualRateOverride != null ||
    input.residualRateOverride != null ||
    input.residualValueRatio != null;
  const residualCandidateSummary = summarizeMgResidualCandidates({
    input: {
      leaseTermMonths: input.leaseTermMonths,
      ownershipType: input.ownershipType,
    },
    vehicle: {
      highResidualAllowed: vehicle.highResidualAllowed,
      rawRow: vehicle.rawRow,
    },
    annualMileageKm: input.annualMileageKm,
    matrixRows,
    selectedResidualRateDecimal:
      input.selectedResidualRateOverride != null
        ? normalizeRate(input.selectedResidualRateOverride)
        : input.residualRateOverride != null
          ? normalizeRate(input.residualRateOverride)
          : input.residualValueRatio != null
            ? normalizeRate(input.residualValueRatio)
            : normalizeRate(residualRateRaw),
  });
  const baseVehiclePrice = input.quotedVehiclePrice ?? parseNumeric(vehicle.vehiclePrice);

  if (baseVehiclePrice == null) {
    throw new Error("Vehicle price is invalid.");
  }

  const publicBondPurchaseAmount = Math.max(0, input.additionalVehiclePrice ?? 0);
  const vehiclePrice = baseVehiclePrice + publicBondPurchaseAmount;
  const discountAmount = resolveDiscountAmount({
    input,
    quotedVehiclePrice: baseVehiclePrice,
    publicBondPurchaseAmount,
  });
  const evSubsidyAmount = Math.max(0, input.evSubsidyAmount ?? 0);
  const discountedVehiclePrice = Math.max(vehiclePrice - discountAmount - evSubsidyAmount, 0);
  const vehicleClass = input.manualVehicleClass ?? vehicle.vehicleClass;
  const engineDisplacementCc = input.manualEngineDisplacementCc ?? vehicle.engineDisplacementCc;
  const acquisitionTaxRate = resolveAcquisitionTaxRate({
    vehicleClass,
    override: input.acquisitionTaxRateOverride,
  });
  const automaticAcquisitionTax = roundDown((discountedVehiclePrice / 1.1) * acquisitionTaxRate, -1);
  const acquisitionTax = resolveAcquisitionTax({
    input,
    discountedVehiclePrice,
    automaticAcquisitionTax,
  });
  const publicBondCost = input.includePublicBondCost === false ? 0 : Math.max(0, input.publicBondCost ?? 0);
  const miscFeeAmount = input.includeMiscFeeAmount === false ? 0 : Math.max(0, input.miscFeeAmount ?? 0);
  const deliveryFeeAmount = input.includeDeliveryFeeAmount === false ? 0 : Math.max(0, input.deliveryFeeAmount ?? 0);
  const stampDuty = Math.max(0, input.stampDuty ?? 10000);
  const residualRateDecimal = normalizeRate(residualRateRaw);
  const paymentBasePrincipal = discountedVehiclePrice + acquisitionTax + miscFeeAmount;
  const agFeeAmount = roundDown(paymentBasePrincipal * Math.max(0, input.agFeeRate ?? 0), 0);
  const cmFeeAmount = roundDown(paymentBasePrincipal * Math.max(0, input.cmFeeRate ?? 0), 0);
  const residualCandidateMaximumRateDecimal =
    (maximumResidualRateRaw != null ? normalizeRate(maximumResidualRateRaw) : null) ??
    residualCandidateSummary.maxBoostedRate ??
    (vehicle.highResidualAllowed ? residualRateDecimal + 0.08 : residualRateDecimal);
  const residualGuaranteeMatrixGroup =
    input.residualMatrixGroup ??
    residualGuaranteeMatrixGroupFromCandidateName(residualCandidateSummary.selectedCandidateName) ??
    resolvedMatrixGroup;
  const residualAmount = resolveResidualAmount({
    input,
    discountedVehiclePrice,
    acquisitionCost: paymentBasePrincipal + publicBondCost + deliveryFeeAmount + agFeeAmount + cmFeeAmount + stampDuty,
    residualRateDecimal,
  });
  const appliedResidualRateDecimal = discountedVehiclePrice > 0 ? residualAmount / discountedVehiclePrice : 0;
  const minimumResidualRateDecimal = resolveMinimumResidualRateByTerm(input.leaseTermMonths);
  const maximumResidualRateDecimal = residualCandidateMaximumRateDecimal;
  const annualRateDecimal =
    input.annualIrrRateOverride != null
      ? normalizeRate(displayedAnnualRateRaw)
        : computeWorkbookDisplayedAnnualRateFromFormula({
          input,
          baseAnnualRateDecimal: normalizeRate(displayedAnnualRateRaw),
          discountedVehiclePrice,
          acquisitionTax,
          publicBondCost,
          miscFeeAmount,
          deliveryFeeAmount,
          residualAmount,
          maximumResidualRateDecimal,
          ownershipType: input.ownershipType,
          residualGuaranteeMatrixGroup,
        });
  const extraFees = publicBondCost + deliveryFeeAmount + agFeeAmount + cmFeeAmount;
  const acquisitionCostBeforeStamp = paymentBasePrincipal + extraFees;
  const acquisitionCost = acquisitionCostBeforeStamp + stampDuty;
  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  const upfrontPayment = Math.max(0, input.upfrontPayment);
  const financedPrincipal = acquisitionCost;
  const plusAmount = upfrontPayment + depositAmount + Math.max(0, input.lossDamageAmount ?? 0);
  const paymentOne = computeLeaseMonthlyPaymentRaw({
    presentValue: Math.max(acquisitionCost - plusAmount, 0),
    futureValue: Math.max(residualAmount - depositAmount, 0),
    monthlyRateDecimal: annualRateDecimal / 12,
    leaseTermMonths: input.leaseTermMonths,
  });
  const rateOneAnnual = solveAnnualRateFromPayment({
    periods: input.leaseTermMonths,
    payment: paymentOne,
    presentValue: Math.max(acquisitionCostBeforeStamp - upfrontPayment, 0),
    futureValue: residualAmount,
  });
  const roundedRateAnnual = input.paymentRateOverride ?? annualRateDecimal;
  const paymentTwo = roundDown(
    computeLeaseMonthlyPaymentRaw({
      presentValue: paymentBasePrincipal,
      futureValue: residualAmount,
      monthlyRateDecimal: roundedRateAnnual / 12,
      leaseTermMonths: input.leaseTermMonths,
    }),
    0,
  );
  const monthlyUpfront = input.leaseTermMonths > 0 ? roundDown(upfrontPayment / input.leaseTermMonths, 0) : 0;
  const insuranceMonthly =
    input.insuranceMonthly ??
    (input.insuranceYearlyAmount != null ? roundUp(Math.max(0, input.insuranceYearlyAmount) / 12, -2) : 0);
  const monthlyPayment = roundCurrency((upfrontPayment > 0 ? paymentOne + monthlyUpfront : paymentTwo) + insuranceMonthly);
  const effectiveAnnualRateDecimal = normalizeRate(
    input.annualEffectiveRateOverride ??
      solveAnnualRateFromPayment({
        periods: input.leaseTermMonths,
        payment: monthlyPayment - insuranceMonthly,
        presentValue: upfrontPayment > 0 ? Math.max(acquisitionCost - plusAmount, 0) : paymentBasePrincipal,
        futureValue: Math.max(residualAmount - (upfrontPayment > 0 ? depositAmount : 0), 0),
      }),
  );
  const monthlyRateDecimal = effectiveAnnualRateDecimal / 12;

  if (discountAmount > 0) {
    warnings.push("Discount amount is applied from quote input and not yet sourced from normalized workbook tables.");
  }

  if (input.annualEffectiveRateOverride != null) {
    warnings.push("Effective annual IRR override is applied for parity validation and may differ from displayed base brand rate.");
  }

  if (vehicle.residualPromotionCode && vehicle.residualPromotionCode !== "0") {
    warnings.push(
      `Residual promotion code '${vehicle.residualPromotionCode}' exists on the vehicle row but is not yet applied automatically.`,
    );
  }

  if (
    residualCandidateSummary.candidates.length > 0 &&
    !hasExplicitResidualSelection &&
    !input.residualMode
  ) {
    warnings.push(
      "Hidden workbook residual policy is detected. BK27 behaves like a user-selected residual input in the workbook, so pass selectedResidualRateOverride or residualAmountOverride for exact Excel parity.",
    );
  }

  if (input.annualMileageKm == null) {
    warnings.push("Annual mileage defaults to 20,000km unless explicitly provided.");
  }

  // Dev-only warnings suppressed — these are normal defaults, not user-facing issues
  // Public bond cost defaults to 0, deposit defaults to 0, insurance partially modeled

  return {
    lenderCode: input.lenderCode,
    productType: input.productType,
    workbookImport,
    resolvedVehicle: {
      brand: vehicle.brand,
      modelName: vehicle.modelName,
      vehiclePrice,
      vehicleClass,
      engineDisplacementCc,
      highResidualAllowed: vehicle.highResidualAllowed,
      hybridAllowed: vehicle.hybridAllowed,
      snkResidualBand: vehicle.snkResidualBand,
      residualPromotionCode: vehicle.residualPromotionCode,
    },
    majorInputs: {
      ownershipType: input.ownershipType,
      leaseTermMonths: input.leaseTermMonths,
      vehiclePrice,
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
      extraFees,
    },
    residual: {
      matrixGroup: resolvedMatrixGroup,
      source: residualSource,
      rateDecimal: appliedResidualRateDecimal,
      amount: residualAmount,
      minRateDecimal: minimumResidualRateDecimal,
      maxRateDecimal: maximumResidualRateDecimal,
      selectionGuide:
        residualCandidateSummary.candidates.length > 0
          ? {
              requiresUserConfirmation: !hasExplicitResidualSelection,
              defaultRateDecimal: appliedResidualRateDecimal,
              reason: hasExplicitResidualSelection
                ? null
                : "Workbook BK27 behaves like a user-selected residual input and should be confirmed in the quote UI.",
            }
          : undefined,
      candidateSummary:
        residualCandidateSummary.candidates.length > 0
          ? {
              maxBoostedRate: residualCandidateSummary.maxBoostedRate,
              selectedCandidateName: residualCandidateSummary.selectedCandidateName,
              candidates: residualCandidateSummary.candidates,
            }
          : undefined,
    },
    rates: {
      source: input.annualIrrRateOverride != null ? "override" : "workbook-formula",
      annualRateDecimal,
      effectiveAnnualRateDecimal,
      monthlyRateDecimal,
    },
    monthlyPayment,
    warnings,
  };
}

export async function calculateMgOperatingLeaseQuote(params: {
  databaseUrl?: string;
  input: CanonicalQuoteInput;
}): Promise<CanonicalQuoteResult> {
  const { databaseUrl, input } = params;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to calculate quotes.");
  }

  if (input.productType !== "operating_lease") {
    throw new Error("MG quote calculation currently supports only operating_lease.");
  }

  const workbookImport = await findActiveWorkbook({
    databaseUrl,
    lenderCode: input.lenderCode,
  });

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    let [vehicle] = await db
      .select({
        brand: vehiclePrograms.brand,
        modelName: vehiclePrograms.modelName,
        vehiclePrice: vehiclePrograms.vehiclePrice,
        vehicleClass: vehiclePrograms.vehicleClass,
        engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
        term12Residual: vehiclePrograms.term12Residual,
        term24Residual: vehiclePrograms.term24Residual,
        term36Residual: vehiclePrograms.term36Residual,
        term48Residual: vehiclePrograms.term48Residual,
        term60Residual: vehiclePrograms.term60Residual,
        highResidualAllowed: vehiclePrograms.highResidualAllowed,
        hybridAllowed: vehiclePrograms.hybridAllowed,
        residualPromotionCode: vehiclePrograms.residualPromotionCode,
        snkResidualBand: vehiclePrograms.snkResidualBand,
        rawRow: vehiclePrograms.rawRow,
      })
      .from(vehiclePrograms)
      .where(
        and(
          eq(vehiclePrograms.workbookImportId, workbookImport.id),
          eq(vehiclePrograms.brand, input.brand),
          eq(vehiclePrograms.modelName, input.modelName),
        ),
      )
      .limit(1);

    // vehicleKey fallback: if exact modelName match failed, try cross-lender matching
    if (!vehicle) {
      const allBrandVehicles = await db
        .select({
          brand: vehiclePrograms.brand,
          modelName: vehiclePrograms.modelName,
          vehiclePrice: vehiclePrograms.vehiclePrice,
          vehicleClass: vehiclePrograms.vehicleClass,
          engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
          term12Residual: vehiclePrograms.term12Residual,
          term24Residual: vehiclePrograms.term24Residual,
          term36Residual: vehiclePrograms.term36Residual,
          term48Residual: vehiclePrograms.term48Residual,
          term60Residual: vehiclePrograms.term60Residual,
          highResidualAllowed: vehiclePrograms.highResidualAllowed,
          hybridAllowed: vehiclePrograms.hybridAllowed,
          residualPromotionCode: vehiclePrograms.residualPromotionCode,
          snkResidualBand: vehiclePrograms.snkResidualBand,
          rawRow: vehiclePrograms.rawRow,
        })
        .from(vehiclePrograms)
        .where(
          and(
            eq(vehiclePrograms.workbookImportId, workbookImport.id),
            eq(vehiclePrograms.brand, input.brand),
          ),
        );

      const resolved = resolveModelNameByVehicleKey(input.brand, input.modelName, allBrandVehicles);
      if (resolved) {
        vehicle = resolved;
      }
    }

    if (!vehicle) {
      throw new Error(`Vehicle not found for '${input.brand} ${input.modelName}'.`);
    }

    const [ratePolicy] = await db
      .select({
        baseIrrRate: brandRatePolicies.baseIrrRate,
      })
      .from(brandRatePolicies)
      .where(
        and(
          eq(brandRatePolicies.workbookImportId, workbookImport.id),
          eq(brandRatePolicies.brand, input.brand),
          eq(brandRatePolicies.productType, "operating_lease"),
          eq(brandRatePolicies.ownershipType, input.ownershipType),
        ),
      )
      .limit(1);

    if (!ratePolicy?.baseIrrRate && input.annualIrrRateOverride == null) {
      throw new Error(`Base IRR policy not found for brand '${input.brand}' and ownership '${input.ownershipType}'.`);
    }

    const apsResidualBand = readRawRowText(vehicle.rawRow, "apsResidualBand");
    const matrixRows =
      vehicle.snkResidualBand == null && apsResidualBand == null
        ? []
        : (
            await db
              .select({
                matrixGroup: residualMatrixRows.matrixGroup,
                gradeCode: residualMatrixRows.gradeCode,
                residualRate: residualMatrixRows.residualRate,
              })
              .from(residualMatrixRows)
              .where(
                and(
                  eq(residualMatrixRows.workbookImportId, workbookImport.id),
                  eq(residualMatrixRows.leaseTermMonths, input.leaseTermMonths),
                ),
              )
          )
            .filter((row) =>
              matrixRowMatchesVehicleResidualSource(row.matrixGroup, row.gradeCode, {
                snkResidualBand: vehicle.snkResidualBand,
                apsResidualBand,
              }),
            )
            .map((row) => ({
              matrixGroup: row.matrixGroup,
              residualRate: row.residualRate,
            }));

    let { residualRateRaw, residualSource, resolvedMatrixGroup } = resolveMgOperatingLeaseResidualRate({
      input,
      vehicle,
      matrixRows,
    });
    const maximumResidualRateRaw =
      matrixRows.length > 0
        ? Math.max(
            ...matrixRows.map((row) => {
              const baseRate = normalizeRate(parseNumeric(String(row.residualRate)) ?? 0);
              const promotionRate = promotionRateForMatrixGroup(vehicle.rawRow, row.matrixGroup);
              return baseRate + promotionRate + (vehicle.highResidualAllowed ? 0.08 : 0);
            }),
          )
        : null;

    // residualMode: override residual rate based on mode (high/standard)
    if (input.residualMode && input.selectedResidualRateOverride == null && input.residualAmountOverride == null) {
      if (input.residualMode === "high" && maximumResidualRateRaw != null) {
        residualRateRaw = maximumResidualRateRaw;
        residualSource = "residual-matrix";
      }
      // "standard" uses the already-resolved residualRateRaw (base matrix rate)
    }

    const resolvedAnnualRate = resolveWorkbookDisplayedAnnualRate({
      input,
      baseIrrRateRaw: parseNumeric(ratePolicy?.baseIrrRate ?? null),
    });
    const displayedAnnualRateRaw = resolvedAnnualRate.displayedAnnualRateRaw;

    if (displayedAnnualRateRaw == null) {
      throw new Error("Annual IRR rate could not be resolved.");
    }
    const quote = calculateMgOperatingLeaseQuoteFromResolvedInput({
      workbookImport,
      input,
      vehicle,
      matrixRows,
      displayedAnnualRateRaw,
      residualRateRaw,
      maximumResidualRateRaw,
      residualSource,
      resolvedMatrixGroup,
    });

    quote.rates.source = resolvedAnnualRate.source;

    return quote;
  } finally {
    await dispose();
  }
}
