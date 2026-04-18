import { and, desc, eq, inArray } from "drizzle-orm";

import {
  brands as brandsTable,
  lenderVehicleOfferings,
  vehicleModels,
  vehicleTrims,
  workbookImports,
} from "@/db/schema";
import { createDbClient, type AppDatabase } from "@/lib/db/client";

type TermMonths = 12 | 24 | 36 | 48 | 60;

const TERM_FIELD: Record<TermMonths, keyof typeof lenderVehicleOfferings.$inferSelect> = {
  12: "term12Residual",
  24: "term24Residual",
  36: "term36Residual",
  48: "term48Residual",
  60: "term60Residual",
};

export interface ResidualDiffVehicle {
  vehicleKey: string | null;
  brandCode: string;
  brandDisplay: string;
  displayName: string;
  previousRate: number | null;
  currentRate: number | null;
  deltaPct: number | null;
}

export interface ResidualDiffImportMeta {
  id: string;
  versionLabel: string;
  importedAt: string;
}

export interface ResidualDiffResult {
  lenderCode: string;
  term: TermMonths;
  activeImport: ResidualDiffImportMeta | null;
  previousImport: ResidualDiffImportMeta | null;
  changed: ResidualDiffVehicle[];
  added: ResidualDiffVehicle[];
  removed: ResidualDiffVehicle[];
}

interface OfferingRow {
  trimId: string;
  vehicleKey: string | null;
  brandCode: string;
  brandDisplay: string;
  displayName: string;
  rate: number | null;
}

function parseRate(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

async function loadOfferings(
  db: AppDatabase,
  workbookImportId: string,
  term: TermMonths,
  brandFilter: string[] | null
): Promise<OfferingRow[]> {
  const termCol = lenderVehicleOfferings[TERM_FIELD[term]];

  const where = brandFilter
    ? and(
        eq(lenderVehicleOfferings.workbookImportId, workbookImportId),
        inArray(brandsTable.canonicalName, brandFilter)
      )
    : eq(lenderVehicleOfferings.workbookImportId, workbookImportId);

  const rows = await db
    .select({
      trimId: lenderVehicleOfferings.trimId,
      vehicleKey: vehicleTrims.vehicleKey,
      brandCode: brandsTable.canonicalName,
      brandDisplay: brandsTable.displayName,
      modelName: lenderVehicleOfferings.lenderModelName,
      rate: termCol,
    })
    .from(lenderVehicleOfferings)
    .innerJoin(vehicleTrims, eq(vehicleTrims.id, lenderVehicleOfferings.trimId))
    .innerJoin(vehicleModels, eq(vehicleModels.id, vehicleTrims.modelId))
    .innerJoin(brandsTable, eq(brandsTable.id, vehicleModels.brandId))
    .where(where);

  return rows.map((r) => ({
    trimId: r.trimId,
    vehicleKey: r.vehicleKey,
    brandCode: r.brandCode,
    brandDisplay: r.brandDisplay,
    displayName: r.modelName,
    rate: parseRate(r.rate as string | null),
  }));
}

export async function computeResidualDiff(params: {
  databaseUrl: string | undefined;
  lenderCode: string;
  term: TermMonths;
  brandFilter?: string[] | null;
}): Promise<ResidualDiffResult> {
  const { databaseUrl, lenderCode, term } = params;
  const brandFilter = params.brandFilter ?? null;

  const emptyBase: ResidualDiffResult = {
    lenderCode,
    term,
    activeImport: null,
    previousImport: null,
    changed: [],
    added: [],
    removed: [],
  };

  if (!databaseUrl) return emptyBase;

  const { db, dispose } = createDbClient(databaseUrl);
  try {
    return await runDiff(db, lenderCode, term, brandFilter);
  } finally {
    await dispose();
  }
}

async function runDiff(
  db: AppDatabase,
  lenderCode: string,
  term: TermMonths,
  brandFilter: string[] | null
): Promise<ResidualDiffResult> {

  const imports = await db
    .select({
      id: workbookImports.id,
      versionLabel: workbookImports.versionLabel,
      importedAt: workbookImports.importedAt,
      isActive: workbookImports.isActive,
    })
    .from(workbookImports)
    .where(eq(workbookImports.lenderCode, lenderCode))
    .orderBy(desc(workbookImports.importedAt));

  const activeImport = imports.find((i) => i.isActive) ?? null;
  const previousImport = imports.find((i) => i.id !== activeImport?.id) ?? null;

  const emptyResult: ResidualDiffResult = {
    lenderCode,
    term,
    activeImport: activeImport
      ? {
          id: activeImport.id,
          versionLabel: activeImport.versionLabel,
          importedAt: activeImport.importedAt.toISOString(),
        }
      : null,
    previousImport: previousImport
      ? {
          id: previousImport.id,
          versionLabel: previousImport.versionLabel,
          importedAt: previousImport.importedAt.toISOString(),
        }
      : null,
    changed: [],
    added: [],
    removed: [],
  };

  if (!activeImport || !previousImport) return emptyResult;

  const [activeRows, previousRows] = await Promise.all([
    loadOfferings(db, activeImport.id, term, brandFilter),
    loadOfferings(db, previousImport.id, term, brandFilter),
  ]);

  const matchKey = (row: OfferingRow) => row.vehicleKey ?? `__trim_${row.trimId}`;
  const activeByKey = new Map<string, OfferingRow>();
  const previousByKey = new Map<string, OfferingRow>();
  for (const row of activeRows) activeByKey.set(matchKey(row), row);
  for (const row of previousRows) previousByKey.set(matchKey(row), row);

  const changed: ResidualDiffVehicle[] = [];
  const added: ResidualDiffVehicle[] = [];
  const removed: ResidualDiffVehicle[] = [];

  for (const [key, curr] of activeByKey) {
    const prev = previousByKey.get(key);
    if (!prev) {
      added.push({
        vehicleKey: curr.vehicleKey,
        brandCode: curr.brandCode,
        brandDisplay: curr.brandDisplay,
        displayName: curr.displayName,
        previousRate: null,
        currentRate: curr.rate,
        deltaPct: null,
      });
      continue;
    }
    if (prev.rate == null && curr.rate == null) continue;
    if (prev.rate != null && curr.rate != null) {
      const delta = curr.rate - prev.rate;
      if (Math.abs(delta) < 0.0001) continue;
      changed.push({
        vehicleKey: curr.vehicleKey,
        brandCode: curr.brandCode,
        brandDisplay: curr.brandDisplay,
        displayName: curr.displayName,
        previousRate: prev.rate,
        currentRate: curr.rate,
        deltaPct: delta,
      });
    } else {
      changed.push({
        vehicleKey: curr.vehicleKey,
        brandCode: curr.brandCode,
        brandDisplay: curr.brandDisplay,
        displayName: curr.displayName,
        previousRate: prev.rate,
        currentRate: curr.rate,
        deltaPct: null,
      });
    }
  }

  for (const [key, prev] of previousByKey) {
    if (activeByKey.has(key)) continue;
    removed.push({
      vehicleKey: prev.vehicleKey,
      brandCode: prev.brandCode,
      brandDisplay: prev.brandDisplay,
      displayName: prev.displayName,
      previousRate: prev.rate,
      currentRate: null,
      deltaPct: null,
    });
  }

  changed.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
  added.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
  removed.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));

  return { ...emptyResult, changed, added, removed };
}
