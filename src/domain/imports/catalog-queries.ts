import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { residualMatrixRows, vehiclePrograms, workbookImports } from "@/db/schema";
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
    const rows = await db
      .select({
        brand: vehiclePrograms.brand,
      })
      .from(vehiclePrograms)
      .where(inArray(vehiclePrograms.workbookImportId, importIds))
      .orderBy(asc(vehiclePrograms.brand), asc(vehiclePrograms.modelName));

    const countByBrand = new Map<string, number>();
    rows.forEach((row) => {
      countByBrand.set(row.brand, (countByBrand.get(row.brand) ?? 0) + 1);
    });

    return {
      connected: true,
      workbookImport: refsResult.workbookImports[0],
      brands: Array.from(countByBrand.entries()).map(([brand, modelCount]) => ({
        brand,
        modelCount,
      })),
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
        brand: vehiclePrograms.brand,
        modelName: vehiclePrograms.modelName,
        vehiclePrice: vehiclePrograms.vehiclePrice,
        vehicleClass: vehiclePrograms.vehicleClass,
        engineDisplacementCc: vehiclePrograms.engineDisplacementCc,
        highResidualAllowed: vehiclePrograms.highResidualAllowed,
        hybridAllowed: vehiclePrograms.hybridAllowed,
        residualPromotionCode: vehiclePrograms.residualPromotionCode,
        snkResidualBand: vehiclePrograms.snkResidualBand,
        term12Residual: vehiclePrograms.term12Residual,
        term24Residual: vehiclePrograms.term24Residual,
        term36Residual: vehiclePrograms.term36Residual,
        term48Residual: vehiclePrograms.term48Residual,
        term60Residual: vehiclePrograms.term60Residual,
        rawRow: vehiclePrograms.rawRow,
      })
      .from(vehiclePrograms)
      .where(inArray(vehiclePrograms.workbookImportId, importIds))
      .orderBy(asc(vehiclePrograms.modelName));

    // Show MG vehicles (vehiclePrice > 0) as the primary catalog.
    // BNK vehicles (vehiclePrice = 0) use different naming and would confuse the
    // trim dropdown.  They are matched at quote-time via vehicleKey fallback.
    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.brand !== params.brand) continue;
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
