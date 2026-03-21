import { asc, desc, eq } from "drizzle-orm";

import { vehiclePrograms, workbookImports } from "@/db/schema";
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
        }))
        .filter((row) => row.brand === params.brand)
        .map(({ brand: _brand, ...row }) => row),
    };
  } finally {
    await dispose();
  }
}
