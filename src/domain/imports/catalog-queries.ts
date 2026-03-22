import { asc, desc, eq } from "drizzle-orm";

import { residualMatrixRows, vehiclePrograms, workbookImports } from "@/db/schema";
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

export async function getActiveWorkbookBrands(params: {
  databaseUrl?: string;
  lenderCode: string;
}): Promise<{
  connected: boolean;
  workbookImport: ActiveWorkbookRef | null;
  brands: Array<{
    brand: string;
    modelCount: number;
  }>;
}> {
  const workbookResult = await getActiveWorkbookRef(params);

  if (!workbookResult.connected || !workbookResult.workbookImport) {
    return {
      connected: workbookResult.connected,
      workbookImport: null,
      brands: [],
    };
  }

  const { db, dispose } = createDbClient(params.databaseUrl!);

  try {
    const rows = await db
      .select({
        brand: vehiclePrograms.brand,
      })
      .from(vehiclePrograms)
      .where(eq(vehiclePrograms.workbookImportId, workbookResult.workbookImport.id))
      .orderBy(asc(vehiclePrograms.brand), asc(vehiclePrograms.modelName));

    const countByBrand = new Map<string, number>();
    rows.forEach((row) => {
      countByBrand.set(row.brand, (countByBrand.get(row.brand) ?? 0) + 1);
    });

    return {
      connected: true,
      workbookImport: workbookResult.workbookImport,
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
  lenderCode: string;
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
  const workbookResult = await getActiveWorkbookRef(params);

  if (!workbookResult.connected || !workbookResult.workbookImport) {
    return {
      connected: workbookResult.connected,
      workbookImport: null,
      models: [],
    };
  }

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
      .where(eq(residualMatrixRows.workbookImportId, workbookResult.workbookImport.id));

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
      .where(eq(vehiclePrograms.workbookImportId, workbookResult.workbookImport.id))
      .orderBy(asc(vehiclePrograms.modelName));

    return {
      connected: true,
      workbookImport: workbookResult.workbookImport,
      models: rows
        .map((row) => ({
          brand: row.brand,
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
          snkResiduals: ((row.rawRow as Record<string, unknown> | null)?.snkResiduals as
            | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
            | undefined) ?? {},
          apsResidualBand:
            ((row.rawRow as Record<string, unknown> | null)?.apsResidualBand as string | null | undefined) ?? null,
          apsResiduals: ((row.rawRow as Record<string, unknown> | null)?.apsResiduals as
            | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
            | undefined) ?? {},
          chatbotResiduals: ((row.rawRow as Record<string, unknown> | null)?.chatbotResiduals as
            | Partial<Record<12 | 24 | 36 | 48 | 60, number>>
            | undefined) ?? {},
          apsPromotionRate:
            ((row.rawRow as Record<string, unknown> | null)?.apsPromotionRate as number | null | undefined) ?? null,
          snkPromotionRate:
            ((row.rawRow as Record<string, unknown> | null)?.snkPromotionRate as number | null | undefined) ?? null,
          maxResidualRates: ([12, 24, 36, 48, 60] as const).reduce<Partial<Record<12 | 24 | 36 | 48 | 60, number>>>(
            (acc, term) => {
              const grade = row.snkResidualBand;
              if (!grade) {
                return acc;
              }
              const matchingRows = matrixRows.filter((matrixRow) => matrixRow.gradeCode === grade && matrixRow.leaseTermMonths === term);
              if (matchingRows.length === 0) {
                return acc;
              }
              const rawRow = (row.rawRow as Record<string, unknown> | null) ?? null;
              acc[term] = Math.max(
                ...matchingRows.map((matrixRow) => {
                  const baseRate = Number(matrixRow.residualRate);
                  if (!Number.isFinite(baseRate)) {
                    return 0;
                  }
                  return baseRate + promotionRateForMatrixGroup(rawRow, matrixRow.matrixGroup) + (row.highResidualAllowed ? 0.08 : 0);
                }),
              );
              return acc;
            },
            {},
          ),
        }))
        .filter((row) => row.brand === params.brand)
        .map(({ brand: _brand, ...row }) => row),
    };
  } finally {
    await dispose();
  }
}
