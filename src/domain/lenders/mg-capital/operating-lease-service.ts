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

function computeLeaseMonthlyPayment(params: {
  financedPrincipal: number;
  residualAmount: number;
  monthlyRateDecimal: number;
  leaseTermMonths: number;
}): number {
  const { financedPrincipal, residualAmount, monthlyRateDecimal, leaseTermMonths } = params;

  if (leaseTermMonths <= 0) {
    throw new Error("Lease term must be greater than 0.");
  }

  if (monthlyRateDecimal === 0) {
    return roundCurrency((financedPrincipal - residualAmount) / leaseTermMonths);
  }

  const discountFactor = (1 + monthlyRateDecimal) ** leaseTermMonths;
  const presentValueOfResidual = residualAmount / discountFactor;
  const amortizedPrincipal = financedPrincipal - presentValueOfResidual;
  const payment =
    (amortizedPrincipal * monthlyRateDecimal) / (1 - (1 + monthlyRateDecimal) ** -leaseTermMonths);

  return roundCurrency(payment);
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

    const residualFromVehicleMap: Record<12 | 24 | 36 | 48 | 60, number | null> = {
      12: parseNumeric(vehicle.term12Residual),
      24: parseNumeric(vehicle.term24Residual),
      36: parseNumeric(vehicle.term36Residual),
      48: parseNumeric(vehicle.term48Residual),
      60: parseNumeric(vehicle.term60Residual),
    };

    const warnings: string[] = [];
    let residualRateRaw = input.residualRateOverride ?? residualFromVehicleMap[input.leaseTermMonths];
    let residualSource: CanonicalQuoteResult["residual"]["source"] =
      input.residualRateOverride != null ? "override" : "vehicle-program";
    let resolvedMatrixGroup: string | null = null;

    if (residualRateRaw == null) {
      const matrixGroupCandidates = preferredResidualMatrixGroups(input);
      let residualMatrix:
        | {
            matrixGroup: string;
            residualRate: string;
          }
        | undefined;

      for (const matrixGroup of matrixGroupCandidates) {
        const [candidate] = await db
          .select({
            matrixGroup: residualMatrixRows.matrixGroup,
            residualRate: residualMatrixRows.residualRate,
          })
          .from(residualMatrixRows)
          .where(
            and(
              eq(residualMatrixRows.workbookImportId, workbookImport.id),
              eq(residualMatrixRows.matrixGroup, matrixGroup),
              eq(residualMatrixRows.gradeCode, vehicle.snkResidualBand ?? ""),
              eq(residualMatrixRows.leaseTermMonths, input.leaseTermMonths),
            ),
          )
          .limit(1);

        if (candidate) {
          residualMatrix = candidate;
          break;
        }
      }

      if (!residualMatrix && vehicle.snkResidualBand) {
        const [fallbackResidual] = await db
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
          )
          .limit(1);

        if (fallbackResidual) {
          residualMatrix = fallbackResidual;
          warnings.push(
            `Requested residual matrix group was unavailable, so fallback group '${fallbackResidual.matrixGroup}' was used.`,
          );
        }
      }

      if (!residualMatrix) {
        throw new Error(
          `Residual rate not found for term '${input.leaseTermMonths}' and grade '${vehicle.snkResidualBand ?? "-"}'.`,
        );
      }

      residualRateRaw = parseNumeric(residualMatrix.residualRate);
      residualSource = "residual-matrix";
      resolvedMatrixGroup = residualMatrix.matrixGroup;
    }

    if (residualRateRaw == null) {
      throw new Error("Residual rate could not be resolved.");
    }

    const annualRateRaw = input.annualIrrRateOverride ?? parseNumeric(ratePolicy?.baseIrrRate ?? null);

    if (annualRateRaw == null) {
      throw new Error("Annual IRR rate could not be resolved.");
    }

    const vehiclePrice = parseNumeric(vehicle.vehiclePrice);

    if (vehiclePrice == null) {
      throw new Error("Vehicle price is invalid.");
    }

    const upfrontPayment = Math.max(0, input.upfrontPayment);
    const financedPrincipal = Math.max(vehiclePrice - upfrontPayment, 0);
    const residualRateDecimal = normalizeRate(residualRateRaw);
    const annualRateDecimal = normalizeRate(annualRateRaw);
    const monthlyRateDecimal = annualRateDecimal / 12;
    const residualAmount = roundCurrency(vehiclePrice * residualRateDecimal);
    const monthlyPayment = computeLeaseMonthlyPayment({
      financedPrincipal,
      residualAmount,
      monthlyRateDecimal,
      leaseTermMonths: input.leaseTermMonths,
    });

    if (vehicle.residualPromotionCode && vehicle.residualPromotionCode !== "0") {
      warnings.push(
        `Residual promotion code '${vehicle.residualPromotionCode}' exists on the vehicle row but is not yet applied in this first calculator version.`,
      );
    }

    warnings.push("Taxes, registration, and lender-specific incidental fees are not included yet.");

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
        upfrontPayment,
        financedPrincipal,
      },
      feesAndTaxes: {
        acquisitionTax: 0,
        registrationTax: 0,
        extraFees: 0,
      },
      residual: {
        matrixGroup: resolvedMatrixGroup,
        source: residualSource,
        rateDecimal: residualRateDecimal,
        amount: residualAmount,
      },
      rates: {
        source: input.annualIrrRateOverride != null ? "override" : "brand-policy",
        annualRateDecimal,
        monthlyRateDecimal,
      },
      monthlyPayment,
      warnings,
    };
  } finally {
    await dispose();
  }
}
