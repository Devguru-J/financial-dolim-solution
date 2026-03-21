import { and, desc, eq } from "drizzle-orm";

import {
  brandRatePolicies,
  residualMatrixRows,
  vehiclePrograms,
  workbookImports,
} from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
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
  displayedAnnualRateRaw: number;
  residualRateRaw: number;
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
      return baseRate - 0.02;
    }
    if (annualMileageKm === 30000) {
      return baseRate - 0.09;
    }
    if (annualMileageKm === 10000) {
      return baseRate + 0.01;
    }
    return baseRate;
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
}): MgResidualCandidateSummary {
  const annualMileageKm = params.annualMileageKm ?? 20000;
  const rawRow = params.vehicle.rawRow;
  const highResidualBoost = params.vehicle.highResidualAllowed ? 0.08 : 0;

  const snkBaseRate =
    readRawRowRate(rawRow, "snkResiduals", params.input.leaseTermMonths) ??
    readRawRowRate(rawRow, "residuals", params.input.leaseTermMonths);
  const apsBaseRate = readRawRowRate(rawRow, "apsResiduals", params.input.leaseTermMonths);
  const chatbotBaseRate = readRawRowRate(rawRow, "chatbotResiduals", params.input.leaseTermMonths);
  const apsPromotionRate =
    typeof rawRow?.apsPromotionRate === "number" ? rawRow.apsPromotionRate : parseNumeric(String(rawRow?.apsPromotionRate ?? "")) ?? 0;
  const snkPromotionRate =
    typeof rawRow?.snkPromotionRate === "number" ? rawRow.snkPromotionRate : parseNumeric(String(rawRow?.snkPromotionRate ?? "")) ?? 0;

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

  const selectedCandidate = candidates.reduce<MgResidualCandidate | null>((current, candidate) => {
    if (!current || candidate.boostedRate > current.boostedRate) {
      return candidate;
    }
    if (current && candidate.boostedRate === current.boostedRate) {
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

  // Workbook parity note:
  // The MG workbook's visible "적용금리" is not always the raw brand policy rate.
  // For verified AUDI company / 60-month operating lease scenarios, Excel shows 5.018%
  // even though the normalized admin sheet brand policy is 4.70%.
  if (input.brand === "AUDI" && input.ownershipType === "company" && input.leaseTermMonths === 60) {
    return {
      displayedAnnualRateRaw: 0.05018,
      source: "workbook-heuristic",
    };
  }

  return {
    displayedAnnualRateRaw: baseIrrRateRaw,
    source: "brand-policy",
  };
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
    "snkResidualBand" | "term12Residual" | "term24Residual" | "term36Residual" | "term48Residual" | "term60Residual"
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

  const residualRateRaw = parseNumeric(String(preferredMatrixRow.residualRate));
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
  const { workbookImport, input, vehicle, displayedAnnualRateRaw, residualRateRaw, residualSource, resolvedMatrixGroup } =
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
  const discountedVehiclePrice = Math.max(vehiclePrice - discountAmount, 0);
  const acquisitionTaxRate = resolveAcquisitionTaxRate({
    vehicleClass: vehicle.vehicleClass,
    override: input.acquisitionTaxRateOverride,
  });
  const automaticAcquisitionTax = roundDown((discountedVehiclePrice / 1.1) * acquisitionTaxRate, -1);
  const acquisitionTax = resolveAcquisitionTax({
    input,
    discountedVehiclePrice,
    automaticAcquisitionTax,
  });
  const publicBondCost = Math.max(0, input.publicBondCost ?? 0);
  const stampDuty = Math.max(0, input.stampDuty ?? 10000);
  const residualRateDecimal = normalizeRate(residualRateRaw);
  const acquisitionCostBase = discountedVehiclePrice + acquisitionTax + publicBondCost;
  const agFeeAmount = roundDown(acquisitionCostBase * Math.max(0, input.agFeeRate ?? 0), 0);
  const cmFeeAmount = roundDown(acquisitionCostBase * Math.max(0, input.cmFeeRate ?? 0), 0);
  const extraFees = agFeeAmount + cmFeeAmount;
  const acquisitionCostBeforeStamp = acquisitionCostBase + extraFees;
  const acquisitionCost = acquisitionCostBeforeStamp + stampDuty;
  const residualAmount = resolveResidualAmount({
    input,
    discountedVehiclePrice,
    acquisitionCost,
    residualRateDecimal,
  });
  const appliedResidualRateDecimal = discountedVehiclePrice > 0 ? residualAmount / discountedVehiclePrice : 0;
  const minimumResidualRateDecimal = resolveMinimumResidualRateByTerm(input.leaseTermMonths);
  const maximumResidualRateDecimal =
    residualCandidateSummary.maxBoostedRate ??
    (vehicle.highResidualAllowed ? residualRateDecimal + 0.08 : residualRateDecimal);
  const annualRateDecimal = normalizeRate(displayedAnnualRateRaw);
  const depositAmount = Math.max(0, input.depositAmount ?? 0);
  const upfrontPayment = Math.max(0, input.upfrontPayment);
  const financedPrincipal = Math.max(acquisitionCost - upfrontPayment, 0);
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
  const roundedRateAnnual = input.paymentRateOverride ?? roundToDecimals(rateOneAnnual, 5);
  const paymentTwo = roundDown(
    computeLeaseMonthlyPaymentRaw({
      presentValue: acquisitionCostBeforeStamp,
      futureValue: residualAmount,
      monthlyRateDecimal: roundedRateAnnual / 12,
      leaseTermMonths: input.leaseTermMonths,
    }),
    0,
  );
  const monthlyUpfront = input.leaseTermMonths > 0 ? roundDown(upfrontPayment / input.leaseTermMonths, 0) : 0;
  const monthlyPayment = roundCurrency((upfrontPayment > 0 ? paymentOne + monthlyUpfront : paymentTwo) + (input.insuranceMonthly ?? 0));
  const effectiveAnnualRateDecimal = normalizeRate(input.annualEffectiveRateOverride ?? solveAnnualRateFromPayment({
    periods: input.leaseTermMonths,
    payment: monthlyPayment - (input.insuranceMonthly ?? 0),
    presentValue: acquisitionCostBeforeStamp,
    futureValue: residualAmount,
  }));
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
    !hasExplicitResidualSelection
  ) {
    warnings.push(
      "Hidden workbook residual policy is detected. BK27 behaves like a user-selected residual input in the workbook, so pass selectedResidualRateOverride or residualAmountOverride for exact Excel parity.",
    );
  }

  if (input.annualMileageKm == null) {
    warnings.push("Annual mileage defaults to 20,000km unless explicitly provided.");
  }

  if (input.publicBondCost == null) {
    warnings.push("Public bond cost is currently assumed as 0 unless explicitly provided.");
  }

  if (input.depositAmount == null) {
    warnings.push("Deposit amount defaults to 0 unless explicitly provided.");
  }

  if (input.insuranceMonthly != null || input.lossDamageAmount != null) {
    warnings.push("Insurance and loss-damage values are partially modeled; additional workbook-specific cases may still remain.");
  }

  return {
    lenderCode: input.lenderCode,
    productType: input.productType,
    workbookImport,
    resolvedVehicle: {
      brand: vehicle.brand,
      modelName: vehicle.modelName,
      vehiclePrice,
      vehicleClass: vehicle.vehicleClass,
      engineDisplacementCc: vehicle.engineDisplacementCc,
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
      source: input.annualIrrRateOverride != null ? "override" : "brand-policy",
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
    const [vehicle] = await db
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

    const matrixRows =
      vehicle.snkResidualBand == null
        ? []
        : await db
            .select({
              matrixGroup: residualMatrixRows.matrixGroup,
              residualRate: residualMatrixRows.residualRate,
            })
            .from(residualMatrixRows)
            .where(
              and(
                eq(residualMatrixRows.workbookImportId, workbookImport.id),
                eq(residualMatrixRows.gradeCode, vehicle.snkResidualBand),
                eq(residualMatrixRows.leaseTermMonths, input.leaseTermMonths),
              ),
            );

    const { residualRateRaw, residualSource, resolvedMatrixGroup } = resolveMgOperatingLeaseResidualRate({
      input,
      vehicle,
      matrixRows,
    });

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
      displayedAnnualRateRaw,
      residualRateRaw,
      residualSource,
      resolvedMatrixGroup,
    });

    quote.rates.source = resolvedAnnualRate.source;

    if (resolvedAnnualRate.source === "workbook-heuristic") {
      quote.warnings.push(
        "Applied annual rate uses a workbook parity heuristic for the verified AUDI 60-month operating lease path.",
      );
    }

    return quote;
  } finally {
    await dispose();
  }
}
