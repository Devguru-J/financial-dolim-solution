/**
 * Populate normalized tables (brands → vehicle_models → vehicle_trims →
 * lender_vehicle_offerings) from a parsed WorkbookPreview.
 *
 * Called from persistWorkbookImport as a post-step so new imports
 * automatically land in both the legacy vehicle_programs table AND the
 * normalized schema. Engine queries prefer the normalized schema first and
 * fall back to vehicle_programs for trims that don't extract a vehicleKey.
 */

import { and, eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import {
  brands as brandsTable,
  lenderVehicleOfferings,
  vehicleModels,
  vehicleTrims,
} from "@/db/schema";
import type { WorkbookPreview, WorkbookVehicleProgram } from "@/domain/imports/types";
import { extractVehicleKey, normalizeBrand } from "@/domain/vehicles/vehicle-key";

// biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction type is generic
type Tx = PgTransaction<any, any, any>;

const BRAND_DISPLAY_NAMES: Record<string, string> = {
  AUDI: "Audi",
  BMW: "BMW",
  BENZ: "Mercedes-Benz",
  BENTLEY: "Bentley",
  CADILLAC: "Cadillac",
  FORD: "Ford",
  FERRARI: "Ferrari",
  GENESIS: "Genesis",
  HONDA: "Honda",
  HYUNDAI: "Hyundai",
  JEEP: "Jeep",
  KIA: "Kia",
  LAMBORGHINI: "Lamborghini",
  LANDROVER: "Jaguar Land Rover",
  LEXUS: "Lexus",
  LINCOLN: "Lincoln",
  MASERATI: "Maserati",
  MINI: "MINI",
  PEUGEOT: "Peugeot",
  PORSCHE: "Porsche",
  ROLLSROYCE: "Rolls-Royce",
  TESLA: "Tesla",
  TOYOTA: "Toyota",
  VOLVO: "Volvo",
  VW: "Volkswagen",
};

const BRAND_COUNTRY: Record<string, string> = {
  AUDI: "DE", BMW: "DE", BENZ: "DE", PORSCHE: "DE", VW: "DE",
  BENTLEY: "GB", LANDROVER: "GB", MINI: "GB", ROLLSROYCE: "GB",
  CADILLAC: "US", FORD: "US", JEEP: "US", LINCOLN: "US", TESLA: "US",
  FERRARI: "IT", LAMBORGHINI: "IT", MASERATI: "IT",
  HONDA: "JP", LEXUS: "JP", TOYOTA: "JP",
  GENESIS: "KR", HYUNDAI: "KR", KIA: "KR",
  PEUGEOT: "FR",
  VOLVO: "SE",
};

function deriveModelLine(vehicleKey: string): string {
  const idx = vehicleKey.indexOf("_");
  if (idx < 0) return vehicleKey;
  const brand = vehicleKey.slice(0, idx);
  const rest = vehicleKey.slice(idx + 1);

  if (brand === "BMW") {
    if (rest.startsWith("IX")) return "iX";
    if (rest === "XM") return "XM";
    const xMatch = rest.match(/^X(\d)/);
    if (xMatch) return `X${xMatch[1]}`;
    if (rest === "Z4" || rest.startsWith("Z4_")) return "Z4";
    const mCarMatch = rest.match(/^M([2-8])$/);
    if (mCarMatch) return `M${mCarMatch[1]}`;
    const mPerfMatch = rest.match(/^M(\d)(\d{2})/);
    if (mPerfMatch) return `${mPerfMatch[1]} Series`;
    const iSeriesMatch = rest.match(/^I(\d)$/);
    if (iSeriesMatch) return `i${iSeriesMatch[1]}`;
    const stdMatch = rest.match(/^(\d)\d{2}/);
    if (stdMatch) return `${stdMatch[1]} Series`;
    return rest;
  }

  if (brand === "BENZ") {
    if (rest.startsWith("EQ")) return `EQ${rest[2]}`;
    if (rest.startsWith("GT")) return "AMG GT";
    if (rest.startsWith("MAYBACH")) return "Maybach";
    const multiMatch = rest.match(/^(CLA|CLE|CLS|GLA|GLB|GLC|GLE|GLS|SLC|SLK)/);
    if (multiMatch) return `${multiMatch[1]}-Class`;
    const singleMatch = rest.match(/^([ABCES])\d/);
    if (singleMatch) return `${singleMatch[1]}-Class`;
    if (rest.match(/^G\d/)) return "G-Class";
    if (rest.match(/^V\d/)) return "V-Class";
    return rest;
  }

  if (brand === "AUDI") {
    if (rest.includes("ETRON")) return rest.includes("GT") ? "e-tron GT" : "e-tron";
    if (rest.startsWith("RSQ")) return `RS Q${rest.slice(3)}`;
    if (rest.startsWith("RS")) return `RS${rest.slice(2)}`;
    if (rest.startsWith("SQ")) return `SQ${rest.slice(2)}`;
    if (rest.match(/^S\d/)) return rest;
    if (rest.match(/^[AQ]\d/)) return rest.slice(0, 2);
    if (rest === "TT" || rest === "R8") return rest;
    return rest;
  }

  if (brand === "PORSCHE") {
    const firstToken = rest.split("_")[0];
    if (firstToken === "911") return "911";
    if (firstToken === "718") return "718";
    return firstToken.charAt(0) + firstToken.slice(1).toLowerCase();
  }

  if (brand === "VOLVO") return rest;

  if (brand === "LEXUS") {
    const m = rest.match(/^([A-Z]{2,3})(\d{3})/);
    if (m) return `${m[1]}${m[2].charAt(0)}00`;
    return rest;
  }

  return rest.split("_")[0];
}

type OfferingRow = {
  workbookImportId: string;
  lenderCode: string;
  trimId: string;
  lenderBrand: string;
  lenderModelName: string;
  vehiclePrice: string;
  term12Residual: string | null;
  term24Residual: string | null;
  term36Residual: string | null;
  term48Residual: string | null;
  term60Residual: string | null;
  snkResidualBand: string | null;
  apsResidualBand: string | null;
  residualPromotionCode: string | null;
  wsGrade: string | null;
  cbGrade: string | null;
  tyGrade: string | null;
  jyGrade: string | null;
  crGrade: string | null;
  adbGrade: string | null;
  hybridAllowed: boolean | null;
  rawRow: Record<string, unknown>;
};

export async function populateNormalizedTablesForImport(
  tx: Tx,
  params: {
    workbookImportId: string;
    lenderCode: string;
    workbook: WorkbookPreview;
  },
): Promise<void> {
  const { workbookImportId, lenderCode, workbook } = params;

  // Caches to avoid redundant SELECTs within this transaction
  const brandCache = new Map<string, string>();
  const modelCache = new Map<string, string>();

  for (const p of workbook.vehiclePrograms as WorkbookVehicleProgram[]) {
    const canonicalBrand = normalizeBrand(p.brand);

    // Upsert brand
    let brandId = brandCache.get(canonicalBrand);
    if (!brandId) {
      const existing = await tx
        .select()
        .from(brandsTable)
        .where(eq(brandsTable.canonicalName, canonicalBrand))
        .limit(1);
      if (existing.length > 0) {
        brandId = existing[0].id;
        const currentAliases = new Set<string>(
          Array.isArray(existing[0].aliases) ? existing[0].aliases : [],
        );
        if (!currentAliases.has(p.brand)) {
          currentAliases.add(p.brand);
          await tx
            .update(brandsTable)
            .set({ aliases: Array.from(currentAliases) })
            .where(eq(brandsTable.id, brandId));
        }
      } else {
        const inserted = await tx
          .insert(brandsTable)
          .values({
            canonicalName: canonicalBrand,
            displayName: BRAND_DISPLAY_NAMES[canonicalBrand] ?? canonicalBrand,
            aliases: [p.brand],
            countryCode: BRAND_COUNTRY[canonicalBrand] ?? null,
          })
          .returning({ id: brandsTable.id });
        brandId = inserted[0].id;
      }
      brandCache.set(canonicalBrand, brandId);
    }

    // Compute vehicleKey. Fallback for null-key: synthesize from brand + modelName.
    const extracted = extractVehicleKey(p.brand, p.modelName);
    const vehicleKey = extracted ?? `${canonicalBrand}_${p.modelName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

    // Upsert model (fallback to "Other" bucket when key was synthetic)
    const modelLine = extracted ? deriveModelLine(vehicleKey) : "Other";
    const modelCacheKey = `${brandId}|${modelLine}`;
    let modelId = modelCache.get(modelCacheKey);
    if (!modelId) {
      const existing = await tx
        .select()
        .from(vehicleModels)
        .where(
          and(
            eq(vehicleModels.brandId, brandId),
            eq(vehicleModels.canonicalName, modelLine),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        modelId = existing[0].id;
      } else {
        const inserted = await tx
          .insert(vehicleModels)
          .values({
            brandId,
            canonicalName: modelLine,
            vehicleClass: p.vehicleClass,
          })
          .returning({ id: vehicleModels.id });
        modelId = inserted[0].id;
      }
      modelCache.set(modelCacheKey, modelId);
    }

    // Upsert trim (one per distinct variant name within a model)
    const existingTrim = await tx
      .select()
      .from(vehicleTrims)
      .where(
        and(
          eq(vehicleTrims.modelId, modelId),
          eq(vehicleTrims.canonicalName, p.modelName),
        ),
      )
      .limit(1);
    let trimId: string;
    if (existingTrim.length > 0) {
      trimId = existingTrim[0].id;
    } else {
      const inserted = await tx
        .insert(vehicleTrims)
        .values({
          modelId,
          canonicalName: p.modelName,
          vehicleKey,
          engineDisplacementCc: p.engineDisplacementCc,
          isHighResidualEligible: p.highResidualAllowed ?? false,
        })
        .returning({ id: vehicleTrims.id });
      trimId = inserted[0].id;
    }

    // Insert offering
    const rawRow = p.rawRow as Record<string, unknown> | undefined;
    const offering: OfferingRow = {
      workbookImportId,
      lenderCode,
      trimId,
      lenderBrand: p.brand,
      lenderModelName: p.modelName,
      vehiclePrice: String(Math.trunc(p.vehiclePrice)),
      term12Residual: p.residuals[12]?.toFixed(4) ?? null,
      term24Residual: p.residuals[24]?.toFixed(4) ?? null,
      term36Residual: p.residuals[36]?.toFixed(4) ?? null,
      term48Residual: p.residuals[48]?.toFixed(4) ?? null,
      term60Residual: p.residuals[60]?.toFixed(4) ?? null,
      snkResidualBand: p.snkResidualBand,
      apsResidualBand: p.apsResidualBand,
      residualPromotionCode: p.residualPromotionCode,
      wsGrade: rawRow?.wsGrade != null ? String(rawRow.wsGrade) : null,
      cbGrade: rawRow?.cbGrade != null ? String(rawRow.cbGrade) : null,
      tyGrade: rawRow?.tyGrade != null ? String(rawRow.tyGrade) : null,
      jyGrade: rawRow?.jyGrade != null ? String(rawRow.jyGrade) : null,
      crGrade: rawRow?.crGrade != null ? String(rawRow.crGrade) : null,
      adbGrade: rawRow?.adbGrade != null ? String(rawRow.adbGrade) : null,
      hybridAllowed: p.hybridAllowed,
      rawRow: {
        residuals: p.residuals,
        snkResiduals: p.snkResiduals,
        apsResidualBand: p.apsResidualBand,
        apsResiduals: p.apsResiduals,
        chatbotResiduals: p.chatbotResiduals,
        apsPromotionRate: p.apsPromotionRate,
        snkPromotionRate: p.snkPromotionRate,
        ...(rawRow ?? {}),
      },
    };
    await tx.insert(lenderVehicleOfferings).values(offering).onConflictDoNothing();
  }
}
