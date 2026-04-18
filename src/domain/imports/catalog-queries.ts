import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  brandRatePolicies,
  brands,
  lenderVehicleOfferings,
  residualMatrixRows,
  vehicleModels,
  vehicleTrims,
  workbookImports,
} from "@/db/schema";
import { summarizeMgResidualCandidates } from "@/domain/lenders/mg-capital/operating-lease-service";
import { createDbClient } from "@/lib/db/client";

type ActiveWorkbookRef = {
  id: string;
  versionLabel: string;
  lenderCode: string;
  lenderName: string;
};

async function getActiveWorkbookRef(params: {
  databaseUrl?: string;
  lenderCode: string;
}): Promise<{
  connected: boolean;
  workbookImport: ActiveWorkbookRef | null;
}> {
  const { databaseUrl, lenderCode } = params;

  if (!databaseUrl) {
    return {
      connected: false,
      workbookImport: null,
    };
  }

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const [activeWorkbook] = await db
      .select({
        id: workbookImports.id,
        versionLabel: workbookImports.versionLabel,
        lenderCode: workbookImports.lenderCode,
        lenderName: workbookImports.lenderName,
      })
      .from(workbookImports)
      .where(eq(workbookImports.lenderCode, lenderCode))
      .orderBy(desc(workbookImports.isActive), desc(workbookImports.importedAt));

    return {
      connected: true,
      workbookImport: activeWorkbook ?? null,
    };
  } finally {
    await dispose();
  }
}

/** Get ALL active workbook imports (one per lender that has isActive=true). */
async function getActiveWorkbookRefs(params: {
  databaseUrl?: string;
  lenderCode?: string;
}): Promise<{
  connected: boolean;
  workbookImports: ActiveWorkbookRef[];
}> {
  const { databaseUrl, lenderCode } = params;

  if (!databaseUrl) {
    return { connected: false, workbookImports: [] };
  }

  const { db, dispose } = createDbClient(databaseUrl);

  try {
    const conditions = [eq(workbookImports.isActive, true)];
    if (lenderCode) {
      conditions.push(eq(workbookImports.lenderCode, lenderCode));
    }
    const rows = await db
      .select({
        id: workbookImports.id,
        versionLabel: workbookImports.versionLabel,
        lenderCode: workbookImports.lenderCode,
        lenderName: workbookImports.lenderName,
      })
      .from(workbookImports)
      .where(and(...conditions))
      .orderBy(desc(workbookImports.importedAt));

    return { connected: true, workbookImports: rows };
  } finally {
    await dispose();
  }
}

function parsePromotionRate(rawRow: Record<string, unknown> | null, key: "apsPromotionRate" | "snkPromotionRate"): number {
  const value = rawRow?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function promotionRateForMatrixGroup(rawRow: Record<string, unknown> | null, matrixGroup: string): number {
  if (matrixGroup === "에스앤케이모터스" || matrixGroup === "SNK") {
    return parsePromotionRate(rawRow, "snkPromotionRate");
  }
  if (matrixGroup === "APS") {
    return parsePromotionRate(rawRow, "apsPromotionRate");
  }
  return 0;
}

function readRawRowText(rawRow: Record<string, unknown> | null, key: string): string | null {
  const value = rawRow?.[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

export async function getActiveWorkbookBrands(params: {
  databaseUrl?: string;
  lenderCode?: string;
}): Promise<{
  connected: boolean;
  workbookImport: ActiveWorkbookRef | null;
  brands: Array<{
    brand: string;
    modelCount: number;
  }>;
}> {
  const refsResult = await getActiveWorkbookRefs(params);

  if (!refsResult.connected || refsResult.workbookImports.length === 0) {
    return {
      connected: refsResult.connected,
      workbookImport: null,
      brands: [],
    };
  }

  const importIds = refsResult.workbookImports.map((w) => w.id);
  const { db, dispose } = createDbClient(params.databaseUrl!);

  try {
    // Join through trims → models → brands so we return the normalized canonical
    // brand name (e.g. both MG's "BENZ" and BNK's "벤츠" collapse to a single
    // "Mercedes-Benz" display name).
    const rows = await db
      .select({
        canonicalName: brands.canonicalName,
        displayName: brands.displayName,
        trimId: lenderVehicleOfferings.trimId,
      })
      .from(lenderVehicleOfferings)
      .innerJoin(vehicleTrims, eq(vehicleTrims.id, lenderVehicleOfferings.trimId))
      .innerJoin(vehicleModels, eq(vehicleModels.id, vehicleTrims.modelId))
      .innerJoin(brands, eq(brands.id, vehicleModels.brandId))
      .where(inArray(lenderVehicleOfferings.workbookImportId, importIds))
      .orderBy(asc(brands.canonicalName));

    // Dedupe per canonical brand, count unique trims per brand.
    const seenTrims = new Map<string, Set<string>>();
    const displayByCanonical = new Map<string, string>();
    rows.forEach((row) => {
      if (!displayByCanonical.has(row.canonicalName)) {
        displayByCanonical.set(row.canonicalName, row.displayName);
      }
      if (!seenTrims.has(row.canonicalName)) {
        seenTrims.set(row.canonicalName, new Set());
      }
      seenTrims.get(row.canonicalName)!.add(row.trimId);
    });

    return {
      connected: true,
      workbookImport: refsResult.workbookImports[0],
      brands: Array.from(seenTrims.entries())
        .map(([canonical, trimSet]) => ({
          brand: displayByCanonical.get(canonical) ?? canonical,
          modelCount: trimSet.size,
        }))
        .sort((a, b) => a.brand.localeCompare(b.brand, "ko")),
    };
  } finally {
    await dispose();
  }
}

export async function getActiveWorkbookModels(params: {
  databaseUrl?: string;
  lenderCode?: string;
  brand: string;
}): Promise<{
  connected: boolean;
  workbookImport: ActiveWorkbookRef | null;
  models: Array<{
    modelName: string;
    vehiclePrice: number;
    vehicleClass: string | null;
    engineDisplacementCc: number | null;
    highResidualAllowed: boolean | null;
    hybridAllowed: boolean | null;
    residualPromotionCode: string | null;
    snkResidualBand: string | null;
    residuals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
    snkResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
    apsResidualBand: string | null;
    apsResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
    chatbotResiduals: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
    apsPromotionRate: number | null;
    snkPromotionRate: number | null;
    maxResidualRates: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  }>;
}> {
  const refsResult = await getActiveWorkbookRefs(params);

  if (!refsResult.connected || refsResult.workbookImports.length === 0) {
    return {
      connected: refsResult.connected,
      workbookImport: null,
      models: [],
    };
  }

  const importIds = refsResult.workbookImports.map((w) => w.id);
  const { db, dispose } = createDbClient(params.databaseUrl!);

  try {
    const matrixRows = await db
      .select({
        matrixGroup: residualMatrixRows.matrixGroup,
        gradeCode: residualMatrixRows.gradeCode,
        leaseTermMonths: residualMatrixRows.leaseTermMonths,
        residualRate: residualMatrixRows.residualRate,
      })
      .from(residualMatrixRows)
      .where(inArray(residualMatrixRows.workbookImportId, importIds));

    const rows = await db
      .select({
        brand: lenderVehicleOfferings.lenderBrand,
        brandDisplay: brands.displayName,
        brandCanonical: brands.canonicalName,
        modelName: lenderVehicleOfferings.lenderModelName,
        vehiclePrice: lenderVehicleOfferings.vehiclePrice,
        vehicleClass: vehicleModels.vehicleClass,
        engineDisplacementCc: vehicleTrims.engineDisplacementCc,
        highResidualAllowed: vehicleTrims.isHighResidualEligible,
        hybridAllowed: lenderVehicleOfferings.hybridAllowed,
        residualPromotionCode: lenderVehicleOfferings.residualPromotionCode,
        snkResidualBand: lenderVehicleOfferings.snkResidualBand,
        term12Residual: lenderVehicleOfferings.term12Residual,
        term24Residual: lenderVehicleOfferings.term24Residual,
        term36Residual: lenderVehicleOfferings.term36Residual,
        term48Residual: lenderVehicleOfferings.term48Residual,
        term60Residual: lenderVehicleOfferings.term60Residual,
        rawRow: lenderVehicleOfferings.rawRow,
      })
      .from(lenderVehicleOfferings)
      .innerJoin(vehicleTrims, eq(lenderVehicleOfferings.trimId, vehicleTrims.id))
      .innerJoin(vehicleModels, eq(vehicleTrims.modelId, vehicleModels.id))
      .innerJoin(brands, eq(brands.id, vehicleModels.brandId))
      .where(inArray(lenderVehicleOfferings.workbookImportId, importIds))
      .orderBy(asc(lenderVehicleOfferings.lenderModelName));

    // Show MG vehicles (vehiclePrice > 0) as the primary catalog.
    // BNK vehicles (vehiclePrice = 0) use different naming and would confuse the
    // trim dropdown.  They are matched at quote-time via vehicleKey fallback.
    //
    // Match the incoming params.brand against any of:
    //  - raw lenderBrand (e.g. 'BENZ' / '벤츠')
    //  - canonical name (e.g. 'BENZ')
    //  - display name (e.g. 'Mercedes-Benz')
    // so the dropdown (which now shows canonical display names) still resolves.
    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const matches =
        row.brand === params.brand ||
        row.brandCanonical === params.brand ||
        row.brandDisplay === params.brand;
      if (!matches) continue;
      if (Number(row.vehiclePrice) === 0) continue; // skip BNK-only entries
      const existing = seen.get(row.modelName);
      if (!existing) {
        seen.set(row.modelName, row);
      }
    }

    return {
      connected: true,
      workbookImport: refsResult.workbookImports[0],
      models: Array.from(seen.values())
        .map((row) => {
          const rawRow = (row.rawRow as Record<string, unknown> | null) ?? null;
          const isBnkVehicle = rawRow?.cbGrade != null || rawRow?.tyGrade != null;

          return {
            modelName: row.modelName,
            vehiclePrice: Number(row.vehiclePrice),
            vehicleClass: row.vehicleClass,
            engineDisplacementCc: row.engineDisplacementCc,
            highResidualAllowed: row.highResidualAllowed,
            hybridAllowed: row.hybridAllowed,
            residualPromotionCode: row.residualPromotionCode,
            snkResidualBand: row.snkResidualBand,
            residuals: {
              12: row.term12Residual == null ? undefined : Number(row.term12Residual),
              24: row.term24Residual == null ? undefined : Number(row.term24Residual),
              36: row.term36Residual == null ? undefined : Number(row.term36Residual),
              48: row.term48Residual == null ? undefined : Number(row.term48Residual),
              60: row.term60Residual == null ? undefined : Number(row.term60Residual),
            },
            snkResiduals: (rawRow?.snkResiduals as
              | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
              | undefined) ?? {},
            apsResidualBand:
              (rawRow?.apsResidualBand as string | null | undefined) ?? null,
            apsResiduals: (rawRow?.apsResiduals as
              | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
              | undefined) ?? {},
            chatbotResiduals: (rawRow?.chatbotResiduals as
              | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
              | undefined) ?? {},
            apsPromotionRate:
              (rawRow?.apsPromotionRate as number | null | undefined) ?? null,
            snkPromotionRate:
              (rawRow?.snkPromotionRate as number | null | undefined) ?? null,
            maxResidualRates: isBnkVehicle
              ? {} // BNK vehicles: residual is user-entered, no auto max rates
              : ([12, 24, 36, 48, 60] as const).reduce<Partial<Record<12 | 24 | 36 | 48 | 60, number>>>(
                  (acc, term) => {
                    const apsResidualBand = readRawRowText(rawRow, "apsResidualBand");
                    const matchingRows = matrixRows
                      .filter((matrixRow) => matrixRow.leaseTermMonths === term)
                      .filter((matrixRow) =>
                        matrixRowMatchesVehicleResidualSource(matrixRow.matrixGroup, matrixRow.gradeCode, {
                          snkResidualBand: row.snkResidualBand,
                          apsResidualBand,
                        }),
                      )
                      .map((matrixRow) => ({
                        matrixGroup: matrixRow.matrixGroup,
                        residualRate: matrixRow.residualRate,
                      }));

                    const summary = summarizeMgResidualCandidates({
                      input: {
                        leaseTermMonths: term,
                        ownershipType: "company",
                      },
                      vehicle: {
                        highResidualAllowed: row.highResidualAllowed,
                        rawRow,
                      },
                      annualMileageKm: 20000,
                      matrixRows: matchingRows,
                    });

                    if (summary.maxBoostedRate != null) {
                      acc[term] = summary.maxBoostedRate;
                      return acc;
                    }

                    const directRate = Number(
                      row.term12Residual && term === 12
                        ? row.term12Residual
                        : row.term24Residual && term === 24
                          ? row.term24Residual
                          : row.term36Residual && term === 36
                            ? row.term36Residual
                            : row.term48Residual && term === 48
                              ? row.term48Residual
                              : row.term60Residual && term === 60
                                ? row.term60Residual
                                : NaN,
                    );
                    if (Number.isFinite(directRate)) {
                      acc[term] = directRate + (row.highResidualAllowed ? 0.08 : 0);
                    }
                    return acc;
                  },
                  {},
                ),
          };
        }),
    };
  } finally {
    await dispose();
  }
}

/** Get BNK dealer list for a brand from active BNK workbook's brandRatePolicies. */
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
