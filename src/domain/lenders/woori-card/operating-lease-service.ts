import { and, desc, eq, inArray } from "drizzle-orm";
import {
  brandRatePolicies,
  lenderVehicleOfferings,
  residualMatrixRows,
  vehicleModels,
  vehicleTrims,
  workbookImports,
} from "@/db/schema";
import type { CanonicalQuoteInput, CanonicalQuoteResult } from "@/domain/quotes/types";
import { extractVehicleKey } from "@/domain/vehicles/vehicle-key";
import { createDbClient } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Math helpers (shared with BNK/MG — identical formulas)
// ---------------------------------------------------------------------------

function computeLeasePaymentRaw(params: {
  pv: number;
  fv: number;
  rate: number;
  n: number;
}): number {
  const { pv, fv, rate, n } = params;
  if (n <= 0) throw new Error("Lease term must be positive.");
  if (rate === 0) return (pv - fv) / n;
  const factor = (1 + rate) ** n;
  return ((pv - fv / factor) * rate) / (1 - factor ** -1);
}

function solveAnnualRate(n: number, payment: number, pv: number, fv: number): number {
  if (n <= 0 || pv <= 0) return 0;
  let r = 0.05 / 12;
  for (let i = 0; i < 200; i++) {
    const factor = (1 + r) ** n;
    const calcPmt = ((pv - fv / factor) * r) / (1 - 1 / factor);
    const diff = calcPmt - payment;
    if (Math.abs(diff) < 0.01) return r * 12;
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
// Woori Card constants
// ---------------------------------------------------------------------------

/** Stamp duty (인지세) — fixed 10,000원 for Woori Card */
const WOORI_STAMP_DUTY = 10000;

/** IRR surcharge when (upfront + deposit) / vehiclePrice > 50% (Excel BW93) */
const BALLOON_SURCHARGE_RATE = 0.01;
const BALLOON_SURCHARGE_THRESHOLD = 0.5;
const BALLOON_ERROR_THRESHOLD = 0.6;

/** Default IRR rates (from 지점장 sheet) */
const DEFAULT_COMPANY_IRR = 0.045;
const DEFAULT_CUSTOMER_IRR = 0.057;

/** Minimum residual rates by term (차량가 대비) */
const MIN_RESIDUAL_RATES: Record<number, number> = {
  12: 0.45,
  24: 0.39,
  36: 0.30,
  48: 0.20,
  60: 0.14,
};

/** RV guarantee fee defaults */
const RV_GUARANTEE_FEES = {
  samil: { highFee: 528000 }, // 정액 VAT포함
  yuca: { highRate: 0.0077 }, // 차량가 × rate
  autohands: { highRate: 0.0198 }, // 차량가 × rate
};

/** EV tax exemptions */
const EV_TAX_EXEMPTIONS: Record<string, number> = {
  EV: 1400000,
  HYDROGEN: 1400000,
  HEV: 0,
  PHEV: 0,
  LIGHT: 750000, // 경차
};

/** 삼일 고잔가 eligible brands (중요정보 D54-D63) */
const SAMIL_HIGH_RV_BRANDS = [
  "Audi", "Benz", "BMW", "Lexus", "Porsche",
  "Volkswagen", "Volvo", "BYD", "Tesla", "Landrover",
];

/**
 * Mileage adjustment table (BU146:BY151)
 * Key = annualMileageKm, values = residual rate adjustments per provider.
 * autohands -1 means "not available at this mileage".
 */
const MILEAGE_ADJUSTMENTS: Record<number, { samil: number; yuca: number; autohands: number }> = {
  10000: { samil: 0.06, yuca: 0.04, autohands: 0.11 },
  20000: { samil: 0.03, yuca: 0.02, autohands: 0.09 },
  25000: { samil: 0.02, yuca: 0.01, autohands: 0.05 },
  30000: { samil: 0, yuca: 0, autohands: 0 },
  40000: { samil: -0.03, yuca: -0.03, autohands: -1 },
};

// ---------------------------------------------------------------------------
// Types
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

export type WooriQuoteContext = {
  workbookImport: ActiveWorkbook;
  input: CanonicalQuoteInput;
  vehicle: ResolvedVehicle;
  policyBaseIrr: number;
  providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[];
};

type WooriProviderCandidate = {
  name: string; // "삼일" | "유카" | "오토핸즈"
  residualRate: number;
  guaranteeFee: number;
  cashOut: number;
  monthlyPayment: number;
  residualAmount: number;
};

// ---------------------------------------------------------------------------
// Acquisition tax
// ---------------------------------------------------------------------------

function defaultAcquisitionTaxRate(
  engineDisplacementCc: number | null,
  vehicleClass: string | null | undefined,
): number {
  // Woori Card: 승용/RV(5인이하)/RV(7-10인) → 7%, otherwise → 5%
  // But simplified: ≥1600cc → 7%, else 4% for most vehicles
  // Excel BS6: 승용/RV(5인이하)/RV(7-10인) → 7%, else 5%
  if (!vehicleClass) return 0.07;
  const cls = vehicleClass.trim();
  if (
    cls === "승용" ||
    cls.includes("RV(5인이하)") ||
    cls.includes("RV(7-10인)") ||
    cls.includes("전기차")
  ) {
    return 0.07;
  }
  if (
    cls.includes("RV(11인이상)") ||
    cls.includes("화물")
  ) {
    return 0.05;
  }
  return 0.07;
}

function computeAcquisitionTax(
  discountedVehiclePrice: number,
  input: CanonicalQuoteInput,
  vehicleClass: string | null | undefined,
  engineDisplacementCc: number | null,
  fuelType: string,
): { acquisitionTax: number; taxRate: number } {
  const mode = input.acquisitionTaxMode ?? "automatic";

  let taxRate: number;
  if (mode === "ratio") {
    taxRate = 0;
  } else {
    taxRate = input.acquisitionTaxRateOverride ?? defaultAcquisitionTaxRate(engineDisplacementCc, vehicleClass);
  }

  // BS8 = ROUNDDOWN(BS11/1.1 × taxRate, -1)
  let rawTax = roundDown((discountedVehiclePrice / 1.1) * taxRate, -1);

  if (mode === "amount" && input.acquisitionTaxAmountOverride != null) {
    return { acquisitionTax: input.acquisitionTaxAmountOverride, taxRate };
  }

  // BS7: EV/hydrogen/HEV tax exemption
  let exemption = 0;
  if (fuelType === "EV") exemption = EV_TAX_EXEMPTIONS.EV;
  else if (fuelType === "HYDROGEN") exemption = EV_TAX_EXEMPTIONS.HYDROGEN;
  else if (fuelType === "HEV") exemption = EV_TAX_EXEMPTIONS.HEV;
  else if (fuelType === "PHEV") exemption = EV_TAX_EXEMPTIONS.PHEV;

  if (mode === "reduction" && input.acquisitionTaxReduction != null) {
    exemption = input.acquisitionTaxReduction;
  }

  // BS9 = max(0, rawTax - exemption)
  const afterExemption = Math.max(0, rawTax - exemption);

  return { acquisitionTax: afterExemption, taxRate };
}

// ---------------------------------------------------------------------------
// Residual provider resolution
// ---------------------------------------------------------------------------

function resolveProviderRate(
  providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[],
  providerName: string,
  grade: string | null,
  isHigh: boolean,
  term: number,
): number | null {
  if (!grade) return null;
  const prefix = isHigh ? `WOORI_${providerName}_HIGH` : `WOORI_${providerName}`;
  const mg = `${prefix}_${grade}`;
  const match = providerRates.find(
    (r) => r.matrixGroup === mg && r.leaseTermMonths === term
  );
  return match ? parseFloat(match.residualRate) : null;
}

function isSamilHighEligible(brand: string): boolean {
  return SAMIL_HIGH_RV_BRANDS.some(
    (b) => b.toLowerCase() === brand.toLowerCase()
  );
}

/**
 * Provider selection logic (Excel BW122-BW130):
 * Compute PMT for each provider → pick lowest monthly payment → that's the winner.
 */
/**
 * Get mileage adjustment for a provider (Excel BU146:BY151).
 * Base is 30000km (0 adjustment). Lower km = positive adjustment (higher RV).
 */
function getMileageAdjustment(annualMileageKm: number, provider: "samil" | "yuca" | "autohands"): number {
  // Find the closest matching km in the table
  const table = MILEAGE_ADJUSTMENTS;
  const sortedKms = Object.keys(table).map(Number).sort((a, b) => a - b);

  // Exact match first
  if (table[annualMileageKm]) {
    const adj = table[annualMileageKm][provider];
    return adj === -1 ? 0 : adj; // -1 means provider not available (handled elsewhere)
  }

  // Default: no adjustment for unknown mileage
  return 0;
}

function selectBestProvider(params: {
  vehiclePrice: number;
  acquisitionCost: number;
  irr: number;
  term: number;
  upfront: number;
  deposit: number;
  providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[];
  rawRow: Record<string, unknown> | null;
  residualMode: "일반잔가" | "고잔가" | "초고잔가";
  brand: string;
  annualMileageKm: number;
  stampDuty: number;
  cmAgFees: number;
}): WooriProviderCandidate | null {
  const {
    vehiclePrice, acquisitionCost, irr, term, upfront, deposit,
    providerRates, rawRow, residualMode, brand, annualMileageKm,
    stampDuty, cmAgFees,
  } = params;

  const rr = rawRow ?? {};
  const samilGrade = rr.samilGrade as string | null;
  const yucaGrade = rr.yucaGrade as string | null;
  const autohandsGrade = rr.autohandsGrade as string | null;
  const samilSuperHighGrade = rr.samilSuperHighGrade as string | null;
  const yucaSuperHighGrade = rr.yucaSuperHighGrade as string | null;

  const isHigh = residualMode === "고잔가";
  const isSuperHigh = residualMode === "초고잔가";
  const monthlyRate = irr / 12;

  // Resolve residual rates for each provider
  const candidates: WooriProviderCandidate[] = [];

  // --- 삼일 ---
  {
    let rate: number | null = null;
    if (isSuperHigh) {
      rate = resolveProviderRate(providerRates, "SAMIL", samilSuperHighGrade, true, term);
    } else if (isHigh) {
      // 고잔가 requires: mileage ≤ 30000 AND brand in eligible list
      if (annualMileageKm <= 30000 && isSamilHighEligible(brand)) {
        rate = resolveProviderRate(providerRates, "SAMIL", samilGrade, true, term);
      }
    } else {
      rate = resolveProviderRate(providerRates, "SAMIL", samilGrade, false, term);
    }

    if (rate != null && rate > 0) {
      // Apply mileage adjustment (Excel BW140) + vehicle-level 잔가가감 (차량정보 P열)
      const mileageAdj = getMileageAdjustment(annualMileageKm, "samil");
      const vehicleAdj = Number(rr.samilAdjust ?? 0);
      const adjustedRate = rate + mileageAdj + vehicleAdj;
      const residualAmount = Math.trunc((vehiclePrice * adjustedRate) / 1000) * 1000;
      const guaranteeFee = (isHigh || isSuperHigh) ? RV_GUARANTEE_FEES.samil.highFee : 0;
      const cashOut = acquisitionCost + guaranteeFee + cmAgFees + stampDuty;
      const cashIn = upfront + deposit;
      const pv = cashOut - cashIn;
      const fv = residualAmount - deposit;
      const pmt = roundUp(computeLeasePaymentRaw({ pv, fv, rate: monthlyRate, n: term }), -2);

      candidates.push({
        name: "삼일",
        residualRate: adjustedRate,
        guaranteeFee,
        cashOut,
        monthlyPayment: pmt,
        residualAmount,
      });
    }
  }

  // --- 유카 ---
  {
    let rate: number | null = null;
    if (isSuperHigh) {
      rate = resolveProviderRate(providerRates, "YUCA", yucaSuperHighGrade, true, term);
    } else if (isHigh) {
      rate = resolveProviderRate(providerRates, "YUCA", yucaGrade, true, term);
    } else {
      rate = resolveProviderRate(providerRates, "YUCA", yucaGrade, false, term);
    }

    if (rate != null && rate > 0) {
      const mileageAdj = getMileageAdjustment(annualMileageKm, "yuca");
      const vehicleAdj = Number(rr.yucaAdjust ?? 0);
      const adjustedRate = rate + mileageAdj + vehicleAdj;
      const residualAmount = Math.trunc((vehiclePrice * adjustedRate) / 1000) * 1000;
      const guaranteeFee = (isHigh || isSuperHigh) ?
        roundDown(vehiclePrice * RV_GUARANTEE_FEES.yuca.highRate, 0) : 0;
      const cashOut = acquisitionCost + guaranteeFee + cmAgFees + stampDuty;
      const cashIn = upfront + deposit;
      const pv = cashOut - cashIn;
      const fv = residualAmount - deposit;
      const pmt = roundUp(computeLeasePaymentRaw({ pv, fv, rate: monthlyRate, n: term }), -2);

      candidates.push({
        name: "유카",
        residualRate: adjustedRate,
        guaranteeFee,
        cashOut,
        monthlyPayment: pmt,
        residualAmount,
      });
    }
  }

  // --- 오토핸즈 ---
  {
    const fuelType = (rr.fuelType as string) ?? "ICE";
    // 오토핸즈 고잔가 not available for EV (BW30 formula)
    const evBlocked = isHigh && (fuelType === "EV" || fuelType === "전기_비감면");
    // 오토핸즈 not available for 40000km+ (mileage adjustment = -1)
    const mileageBlocked = annualMileageKm >= 40000;

    if (!evBlocked && !mileageBlocked) {
      let rate: number | null = null;
      if (isHigh) {
        rate = resolveProviderRate(providerRates, "AUTOHANDS", autohandsGrade, true, term);
      } else if (!isSuperHigh) {
        rate = resolveProviderRate(providerRates, "AUTOHANDS", autohandsGrade, false, term);
      }

      if (rate != null && rate > 0) {
        const mileageAdj = getMileageAdjustment(annualMileageKm, "autohands");
        const adjustedRate = rate + mileageAdj;
        const residualAmount = Math.trunc((vehiclePrice * adjustedRate) / 1000) * 1000;
        const guaranteeFee = (isHigh || isSuperHigh) ?
          roundDown(vehiclePrice * RV_GUARANTEE_FEES.autohands.highRate, 0) : 0;
        const cashOut = acquisitionCost + guaranteeFee + cmAgFees + stampDuty;
        const cashIn = upfront + deposit;
        const pv = cashOut - cashIn;
        const fv = residualAmount - deposit;
        const pmt = roundUp(computeLeasePaymentRaw({ pv, fv, rate: monthlyRate, n: term }), -2);

        candidates.push({
          name: "오토핸즈",
          residualRate: adjustedRate,
          guaranteeFee,
          cashOut,
          monthlyPayment: pmt,
          residualAmount,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // BW129-130: pick lowest PMT, tie-break → 삼일 priority
  candidates.sort((a, b) => {
    if (a.monthlyPayment !== b.monthlyPayment) return a.monthlyPayment - b.monthlyPayment;
    // tie-break order: 삼일 > 유카 > 오토핸즈
    const order = ["삼일", "유카", "오토핸즈"];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Main DB entry point
// ---------------------------------------------------------------------------

export async function calculateWooriOperatingLeaseQuote(params: {
  databaseUrl: string | undefined;
  input: CanonicalQuoteInput;
}): Promise<CanonicalQuoteResult> {
  const { databaseUrl, input } = params;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    // 1. Find active workbook
    const [activeWb] = await db
      .select({ id: workbookImports.id, versionLabel: workbookImports.versionLabel })
      .from(workbookImports)
      .where(and(eq(workbookImports.lenderCode, "woori-card"), eq(workbookImports.isActive, true)))
      .orderBy(desc(workbookImports.importedAt))
      .limit(1);
    if (!activeWb) throw new Error("우리카드 활성 워크북이 없습니다. 워크북을 먼저 업로드해주세요.");

    // 2. Resolve vehicle
    const offeringSelect = {
      brand: lenderVehicleOfferings.lenderBrand,
      modelName: lenderVehicleOfferings.lenderModelName,
      vehicleClass: vehicleModels.vehicleClass,
      engineDisplacementCc: vehicleTrims.engineDisplacementCc,
      highResidualAllowed: vehicleTrims.isHighResidualEligible,
      hybridAllowed: lenderVehicleOfferings.hybridAllowed,
      rawRow: lenderVehicleOfferings.rawRow,
    } as const;

    let vehicleRow: ResolvedVehicle | null = null;

    // Exact match
    const [exactMatch] = await db
      .select(offeringSelect)
      .from(lenderVehicleOfferings)
      .innerJoin(vehicleTrims, eq(lenderVehicleOfferings.trimId, vehicleTrims.id))
      .innerJoin(vehicleModels, eq(vehicleTrims.modelId, vehicleModels.id))
      .where(
        and(
          eq(lenderVehicleOfferings.workbookImportId, activeWb.id),
          eq(lenderVehicleOfferings.lenderModelName, input.modelName),
        ),
      )
      .limit(1);
    if (exactMatch) vehicleRow = exactMatch;

    // Cross-lender fallback via vehicleKey
    if (!vehicleRow) {
      const requestedKey = extractVehicleKey(input.brand, input.modelName);
      if (requestedKey) {
        const [keyMatch] = await db
          .select(offeringSelect)
          .from(lenderVehicleOfferings)
          .innerJoin(vehicleTrims, eq(lenderVehicleOfferings.trimId, vehicleTrims.id))
          .innerJoin(vehicleModels, eq(vehicleTrims.modelId, vehicleModels.id))
          .where(
            and(
              eq(lenderVehicleOfferings.workbookImportId, activeWb.id),
              eq(vehicleTrims.vehicleKey, requestedKey),
            ),
          )
          .limit(1);
        if (keyMatch) vehicleRow = keyMatch;
      }
    }

    if (!vehicleRow) {
      throw new Error(
        `우리카드 워크북에서 '${input.brand} ${input.modelName}' 차량을 찾을 수 없습니다.`
      );
    }

    // 3. Resolve IRR policy
    const policyRows = await db
      .select({ baseIrrRate: brandRatePolicies.baseIrrRate })
      .from(brandRatePolicies)
      .where(
        and(
          eq(brandRatePolicies.workbookImportId, activeWb.id),
          eq(brandRatePolicies.brand, input.brand),
          eq(brandRatePolicies.productType, "operating_lease"),
          eq(brandRatePolicies.ownershipType, input.ownershipType),
        ),
      )
      .limit(1);
    const policyBaseIrr = policyRows.length > 0 && policyRows[0].baseIrrRate
      ? parseFloat(policyRows[0].baseIrrRate)
      : (input.ownershipType === "company" ? DEFAULT_COMPANY_IRR : DEFAULT_CUSTOMER_IRR);

    // 4. Load provider rates
    const rr = vehicleRow.rawRow ?? {};
    const matrixGroups = buildMatrixGroupsForVehicle(rr as Record<string, unknown>);
    let providerRates: { matrixGroup: string; leaseTermMonths: number; residualRate: string }[] = [];
    if (matrixGroups.length > 0) {
      providerRates = await db
        .select({
          matrixGroup: residualMatrixRows.matrixGroup,
          leaseTermMonths: residualMatrixRows.leaseTermMonths,
          residualRate: residualMatrixRows.residualRate,
        })
        .from(residualMatrixRows)
        .where(
          and(
            eq(residualMatrixRows.workbookImportId, activeWb.id),
            inArray(residualMatrixRows.matrixGroup, matrixGroups),
            eq(residualMatrixRows.leaseTermMonths, input.leaseTermMonths),
          ),
        );
    }

    return computeQuote({
      workbookImport: activeWb,
      input,
      vehicle: vehicleRow,
      policyBaseIrr,
      providerRates,
    });
  } finally {
    await dispose();
  }
}

function buildMatrixGroupsForVehicle(rr: Record<string, unknown>): string[] {
  const groups: string[] = [];
  const samilGrade = rr.samilGrade as string | null;
  const yucaGrade = rr.yucaGrade as string | null;
  const autohandsGrade = rr.autohandsGrade as string | null;
  const samilSuperHighGrade = rr.samilSuperHighGrade as string | null;
  const yucaSuperHighGrade = rr.yucaSuperHighGrade as string | null;

  if (samilGrade) {
    groups.push(`WOORI_SAMIL_${samilGrade}`);
    groups.push(`WOORI_SAMIL_HIGH_${samilGrade}`);
  }
  if (samilSuperHighGrade) {
    groups.push(`WOORI_SAMIL_HIGH_${samilSuperHighGrade}`);
  }
  if (yucaGrade) {
    groups.push(`WOORI_YUCA_${yucaGrade}`);
    groups.push(`WOORI_YUCA_HIGH_${yucaGrade}`);
  }
  if (yucaSuperHighGrade) {
    groups.push(`WOORI_YUCA_HIGH_${yucaSuperHighGrade}`);
  }
  if (autohandsGrade) {
    groups.push(`WOORI_AUTOHANDS_${autohandsGrade}`);
    groups.push(`WOORI_AUTOHANDS_HIGH_${autohandsGrade}`);
  }

  // Deduplicate
  return [...new Set(groups)];
}

// ---------------------------------------------------------------------------
// Pure calculation (exported for tests)
// ---------------------------------------------------------------------------

export function calculateWooriOperatingLeaseQuoteFromContext(
  params: WooriQuoteContext
): CanonicalQuoteResult {
  return computeQuote(params);
}

// ---------------------------------------------------------------------------
// Core computation — reproduces Excel 1.운용리스(비교) BW column
// ---------------------------------------------------------------------------

function computeQuote(params: WooriQuoteContext): CanonicalQuoteResult {
  const { workbookImport, input, vehicle, policyBaseIrr, providerRates } = params;
  const warnings: string[] = [];

  const rawRow = vehicle.rawRow ?? {};
  const fuelType = (rawRow.fuelType as string) ?? "ICE";
  const term = input.leaseTermMonths;

  // -----------------------------------------------------------------------
  // Step 1: Vehicle price (BS11 = base + option - discount + delivery)
  // -----------------------------------------------------------------------
  const quotedVehiclePrice = input.quotedVehiclePrice ?? 0;
  const additionalVehiclePrice = input.additionalVehiclePrice ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const deliveryFee = input.includeDeliveryFeeAmount ? (input.deliveryFeeAmount ?? 0) : 0;
  const evSubsidy = input.evSubsidyAmount ?? 0;

  // BS11 = base + option - discount + delivery
  const invoiceVehiclePrice = quotedVehiclePrice + additionalVehiclePrice - discountAmount + deliveryFee;
  // discountedVehiclePrice for residual/tax calculation (without delivery)
  const discountedVehiclePrice = Math.max(0, quotedVehiclePrice + additionalVehiclePrice - discountAmount - evSubsidy);

  // -----------------------------------------------------------------------
  // Step 2: Acquisition tax (BS8-BS10)
  // -----------------------------------------------------------------------
  const { acquisitionTax, taxRate: acqTaxRate } = computeAcquisitionTax(
    invoiceVehiclePrice, input, vehicle.vehicleClass, vehicle.engineDisplacementCc, fuelType
  );

  // -----------------------------------------------------------------------
  // Step 3: Public bond + misc fees
  // -----------------------------------------------------------------------
  const publicBondCost = input.includePublicBondCost ? (input.publicBondCost ?? 0) : 0;
  const miscFee = input.includeMiscFeeAmount ? (input.miscFeeAmount ?? 0) : 0;
  const stampDuty = input.stampDuty ?? WOORI_STAMP_DUTY;

  // -----------------------------------------------------------------------
  // Step 4: Registration cost (BW7) = acqTax + publicBond + miscFee + delivery
  // (delivery included in registrationCost only if "포함" mode)
  // -----------------------------------------------------------------------
  const registrationCost = acquisitionTax + publicBondCost + miscFee;

  // -----------------------------------------------------------------------
  // Step 5: Total purchase cost & acquisition cost (BW8, BW10)
  // -----------------------------------------------------------------------
  // BW8 = vehiclePrice + registrationCost
  const totalPurchaseCost = invoiceVehiclePrice + registrationCost;
  // BW10 = totalPurchaseCost - evSubsidy
  const acquisitionCost = totalPurchaseCost - evSubsidy;

  // financedPrincipal (gross — never subtract upfront)
  const financedPrincipal = acquisitionCost;

  // -----------------------------------------------------------------------
  // Step 6: Upfront + deposit (BW14, BW18)
  // -----------------------------------------------------------------------
  const upfrontPayment = Math.trunc((input.upfrontPayment ?? 0) / 1000) * 1000;
  const depositAmount = Math.trunc((input.depositAmount ?? 0) / 1000) * 1000;

  // -----------------------------------------------------------------------
  // Step 7: IRR determination (BW93)
  // -----------------------------------------------------------------------
  let annualIrr: number;
  let rateSource: "override" | "brand-policy" = "brand-policy";

  if (input.annualIrrRateOverride != null) {
    annualIrr = input.annualIrrRateOverride;
    rateSource = "override";
  } else {
    // BW93: base IRR + balloon surcharge
    annualIrr = policyBaseIrr;

    // BW94: (upfront + deposit) / vehiclePrice ratio
    const balloonRatio = invoiceVehiclePrice > 0
      ? (upfrontPayment + depositAmount) / invoiceVehiclePrice
      : 0;

    if (balloonRatio > BALLOON_ERROR_THRESHOLD) {
      warnings.push("우리카드: 보증금+선납금이 차량가의 60%를 초과합니다. 견적 불가.");
    } else if (balloonRatio > BALLOON_SURCHARGE_THRESHOLD) {
      annualIrr += BALLOON_SURCHARGE_RATE;
    }

    // Add CM + AG fees to IRR
    const cmFee = input.cmFeeRate ?? 0;
    const agFee = input.agFeeRate ?? 0;
    annualIrr += cmFee + agFee;
  }

  const monthlyRate = annualIrr / 12;

  // -----------------------------------------------------------------------
  // Step 8: Residual value resolution
  // -----------------------------------------------------------------------
  let residualAmount: number;
  let residualRate: number;
  let residualMatrixGroup: string | null = null;
  let residualSource: "override" | "residual-matrix" = "residual-matrix";
  let winnerName: string | null = null;
  let winnerGuaranteeFee = 0;

  if (input.residualAmountOverride != null) {
    residualAmount = input.residualAmountOverride;
    residualRate = invoiceVehiclePrice > 0 ? residualAmount / invoiceVehiclePrice : 0;
    residualSource = "override";
  } else if (input.selectedResidualRateOverride != null) {
    residualRate = input.selectedResidualRateOverride;
    residualAmount = Math.trunc((invoiceVehiclePrice * residualRate) / 1000) * 1000;
    residualSource = "override";
  } else {
    // Auto-select best provider
    const residualMode = input.residualMode === "high" ? "고잔가" :
      input.residualMode === "standard" ? "일반잔가" : "고잔가";
    const annualMileage = input.annualMileageKm ?? 20000;

    // CM+AG fees for provider selection (included in cashOut)
    const cmAgFees = 0; // CM/AG are rate-based, not lump-sum in Woori

    let winner = selectBestProvider({
      vehiclePrice: invoiceVehiclePrice,
      acquisitionCost,
      irr: annualIrr,
      term,
      upfront: upfrontPayment,
      deposit: depositAmount,
      providerRates,
      rawRow: vehicle.rawRow,
      residualMode,
      brand: vehicle.brand,
      annualMileageKm: annualMileage,
      stampDuty,
      cmAgFees,
    });

    // Fallback: 고잔가 mode yields no candidates for non-eligible brands whose
    // yuca/autohands grades are empty — retry in 일반잔가 so the user gets a
    // valid quote instead of an error. Flag via warning so the UI can surface it.
    let effectiveResidualMode = residualMode;
    if (!winner && residualMode === "고잔가") {
      winner = selectBestProvider({
        vehiclePrice: invoiceVehiclePrice,
        acquisitionCost,
        irr: annualIrr,
        term,
        upfront: upfrontPayment,
        deposit: depositAmount,
        providerRates,
        rawRow: vehicle.rawRow,
        residualMode: "일반잔가",
        brand: vehicle.brand,
        annualMileageKm: annualMileage,
        stampDuty,
        cmAgFees,
      });
      if (winner) {
        effectiveResidualMode = "일반잔가";
        warnings.push(
          "고잔가 미지원 차량이어서 일반잔가로 자동 전환되어 계산되었습니다."
        );
      }
    }

    if (!winner) {
      throw new Error(
        `우리카드 워크북에서 '${vehicle.brand} ${vehicle.modelName}'의 잔가사 데이터가 없어 견적을 계산할 수 없습니다.`
      );
    }

    residualRate = winner.residualRate;
    residualAmount = winner.residualAmount;
    winnerName = winner.name;
    winnerGuaranteeFee = winner.guaranteeFee;

    const providerKey = winnerName === "삼일" ? "SAMIL" : winnerName === "유카" ? "YUCA" : "AUTOHANDS";
    const gradeKey = winnerName === "삼일" ? rawRow.samilGrade :
      winnerName === "유카" ? rawRow.yucaGrade : rawRow.autohandsGrade;
    const highPrefix = effectiveResidualMode !== "일반잔가" ? "_HIGH" : "";
    residualMatrixGroup = gradeKey ? `WOORI_${providerKey}${highPrefix}_${gradeKey}` : null;
  }

  // Validate residual against minimum
  const minRate = MIN_RESIDUAL_RATES[term] ?? 0.14;
  const minAmount = Math.trunc((invoiceVehiclePrice * minRate) / 1000) * 1000;
  if (residualAmount < minAmount) {
    warnings.push(
      `우리카드: 잔존가치(${residualAmount.toLocaleString()})가 최소잔가(${minAmount.toLocaleString()})보다 낮습니다.`
    );
  }

  // -----------------------------------------------------------------------
  // Step 9: Cash flow & PMT (BW92-BW95)
  // -----------------------------------------------------------------------
  // BW92 = acquisitionCost + guaranteeFee + setupFee(0) + cmAgFees + stampDuty
  const cashOut = acquisitionCost + winnerGuaranteeFee + stampDuty;
  // BW91 = upfront + deposit
  const cashIn = upfrontPayment + depositAmount;

  // BW95: PMT(IRR/12, term, -(cashOut - cashIn), residual - deposit)
  const pmtPv = cashOut - cashIn;
  const pmtFv = residualAmount - depositAmount;

  const rawPayment = computeLeasePaymentRaw({
    pv: pmtPv,
    fv: pmtFv,
    rate: monthlyRate,
    n: term,
  });

  // BW95 = ROUNDUP(PMT, -2) — 100원 올림
  const displayedMonthlyPayment = roundUp(rawPayment, -2);

  // -----------------------------------------------------------------------
  // Step 10: Displayed rate (BW98 = RATE back-calculation)
  // -----------------------------------------------------------------------
  // BW98 = RATE(term, totalPmt, -acquisitionCost, residual) × 12
  const effectiveAnnualRate = solveAnnualRate(
    term,
    displayedMonthlyPayment,
    acquisitionCost,
    residualAmount,
  );

  // -----------------------------------------------------------------------
  // Build result
  // -----------------------------------------------------------------------
  return {
    lenderCode: "woori-card",
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
      extraFees: miscFee + winnerGuaranteeFee,
    },
    residual: {
      matrixGroup: residualMatrixGroup,
      source: residualSource,
      rateDecimal: residualRate,
      amount: residualAmount,
      candidateSummary: winnerName ? {
        maxBoostedRate: residualRate,
        selectedCandidateName: winnerName,
        candidates: [],
      } : undefined,
    },
    rates: {
      source: rateSource,
      annualRateDecimal: annualIrr,
      effectiveAnnualRateDecimal: effectiveAnnualRate,
      monthlyRateDecimal: monthlyRate,
    },
    monthlyPayment: displayedMonthlyPayment,
    warnings,
  };
}
