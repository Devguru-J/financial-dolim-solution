/**
 * Data migration: populate brands / vehicle_models / vehicle_trims /
 * lender_vehicle_offerings from the existing vehicle_programs table.
 *
 * Strategy:
 *  1. For each active workbook import (MG + BNK), read its vehicle_programs rows.
 *  2. For each row: normalize brand → upsert brand. Extract trim canonical
 *     name and vehicleKey via vehicle-key.ts utilities. Use the vehicleKey
 *     prefix as a simple "model line" grouping.
 *  3. Upsert vehicle_models (one per brand + model-line) and vehicle_trims
 *     (one per vehicle_key globally).
 *  4. Create a lender_vehicle_offerings row referencing the trim + workbook.
 *
 * Idempotent: safe to re-run. Uses ON CONFLICT upserts.
 * Does NOT delete the old vehicle_programs table — kept for rollback.
 */

import { and, eq } from "drizzle-orm";

import {
  brands as brandsTable,
  lenderVehicleOfferings,
  vehicleModels,
  vehiclePrograms,
  vehicleTrims,
  workbookImports,
} from "@/db/schema";
import { createDbClient } from "@/lib/db/client";
import { extractVehicleKey, normalizeBrand } from "@/domain/vehicles/vehicle-key";

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

/**
 * Derive a simple model-line name from a vehicle key. Used to group trims
 * under models in a somewhat sensible hierarchy. Not perfect — works as a
 * first pass; model lines can be merged manually later.
 *
 * Examples:
 *   BMW_520I        → "5 Series"
 *   BMW_320D        → "3 Series"
 *   BMW_M340I       → "3 Series"
 *   BMW_X5_40D      → "X5"
 *   BMW_IX_M60      → "iX"
 *   BMW_IX45        → "iX"
 *   BENZ_E220D      → "E-Class"
 *   BENZ_GLC300     → "GLC-Class"
 *   BENZ_GT43       → "AMG GT"
 *   BENZ_EQA250     → "EQA"
 *   AUDI_A7         → "A7"
 *   PORSCHE_911_CARRERA → "911"
 *   VOLVO_XC40      → "XC40"
 */
function deriveModelLine(vehicleKey: string): string {
  // Strip the brand prefix
  const idx = vehicleKey.indexOf("_");
  if (idx < 0) return vehicleKey;
  const brand = vehicleKey.slice(0, idx);
  const rest = vehicleKey.slice(idx + 1);

  // BMW patterns
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

  // BENZ patterns
  if (brand === "BENZ") {
    if (rest.startsWith("EQ")) {
      const letter = rest[2];
      return `EQ${letter}`;
    }
    if (rest.startsWith("GT")) return "AMG GT";
    if (rest.startsWith("MAYBACH")) return "Maybach";
    const multiMatch = rest.match(/^(CLA|CLE|CLS|GLA|GLB|GLC|GLE|GLS|SLC|SLK)/);
    if (multiMatch) return `${multiMatch[1]}-Class`;
    const singleMatch = rest.match(/^([ABCES])\d/);
    if (singleMatch) return `${singleMatch[1]}-Class`;
    const gMatch = rest.match(/^G\d/);
    if (gMatch) return "G-Class";
    const vMatch = rest.match(/^V\d/);
    if (vMatch) return "V-Class";
    return rest;
  }

  // AUDI: trim = model (A3, A7, Q5, e-tron)
  if (brand === "AUDI") {
    if (rest.startsWith("ETRON") || rest.endsWith("ETRON") || rest.includes("ETRON")) {
      return rest.includes("GT") ? "e-tron GT" : "e-tron";
    }
    if (rest.startsWith("RSQ")) return `RS Q${rest.slice(3)}`;
    if (rest.startsWith("RS")) return `RS${rest.slice(2)}`;
    if (rest.startsWith("SQ")) return `SQ${rest.slice(2)}`;
    if (rest.match(/^S\d/)) return rest;
    if (rest.match(/^[AQ]\d/)) return rest.slice(0, 2);
    if (rest === "TT" || rest === "R8") return rest;
    return rest;
  }

  // PORSCHE: first token of rest is the model line
  if (brand === "PORSCHE") {
    const firstToken = rest.split("_")[0];
    if (firstToken === "911") return "911";
    if (firstToken === "718") return "718";
    return firstToken.charAt(0) + firstToken.slice(1).toLowerCase();
  }

  // VOLVO: key = model name (XC40, S90)
  if (brand === "VOLVO") return rest;

  // LEXUS: first 2-3 letter token + first digit bucket
  if (brand === "LEXUS") {
    const m = rest.match(/^([A-Z]{2,3})(\d{3})/);
    if (m) return `${m[1]}${m[2].charAt(0)}00`;
    return rest;
  }

  // GENESIS, HYUNDAI, KIA
  if (["GENESIS", "HYUNDAI", "KIA"].includes(brand)) return rest.split("_")[0];

  // MINI: Clubman/Countryman/Cooper/etc
  if (brand === "MINI") {
    const firstToken = rest.split("_")[0];
    return firstToken;
  }

  // JEEP/FORD/LINCOLN/HONDA: model name is the rest
  if (["JEEP", "FORD", "LINCOLN", "HONDA", "TOYOTA", "CADILLAC"].includes(brand)) {
    return rest.split("_")[0];
  }

  // Default: use everything after brand prefix, first underscore-separated token
  return rest.split("_")[0];
}

type MigrationStats = {
  brandsUpserted: number;
  modelsUpserted: number;
  trimsUpserted: number;
  offeringsCreated: number;
  skippedNoKey: number;
  errors: Array<{ vehicle: string; error: string }>;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const { db, dispose } = createDbClient(databaseUrl);
  const stats: MigrationStats = {
    brandsUpserted: 0,
    modelsUpserted: 0,
    trimsUpserted: 0,
    offeringsCreated: 0,
    skippedNoKey: 0,
    errors: [],
  };

  try {
    // 1. Get all active workbook imports
    const activeImports = await db
      .select()
      .from(workbookImports)
      .where(eq(workbookImports.isActive, true));

    console.log(`Found ${activeImports.length} active workbook imports`);

    // Cache to avoid redundant DB roundtrips
    const brandCache = new Map<string, string>();       // canonicalName → brandId
    const modelCache = new Map<string, string>();       // brandId|modelName → modelId
    const trimCache = new Map<string, string>();        // vehicleKey → trimId

    for (const imp of activeImports) {
      console.log(`\nProcessing ${imp.lenderCode} workbook ${imp.id.slice(0, 8)}...`);

      const programs = await db
        .select()
        .from(vehiclePrograms)
        .where(eq(vehiclePrograms.workbookImportId, imp.id));

      console.log(`  ${programs.length} vehicle_programs to migrate`);

      for (const p of programs) {
        try {
          const canonicalBrand = normalizeBrand(p.brand);

          // Upsert brand
          let brandId = brandCache.get(canonicalBrand);
          if (!brandId) {
            const existing = await db
              .select()
              .from(brandsTable)
              .where(eq(brandsTable.canonicalName, canonicalBrand))
              .limit(1);
            if (existing.length > 0) {
              brandId = existing[0].id;
              // Merge alias if new
              const currentAliases = new Set<string>(
                Array.isArray(existing[0].aliases) ? existing[0].aliases : [],
              );
              if (!currentAliases.has(p.brand)) {
                currentAliases.add(p.brand);
                await db
                  .update(brandsTable)
                  .set({ aliases: Array.from(currentAliases) })
                  .where(eq(brandsTable.id, brandId));
              }
            } else {
              const inserted = await db
                .insert(brandsTable)
                .values({
                  canonicalName: canonicalBrand,
                  displayName: BRAND_DISPLAY_NAMES[canonicalBrand] ?? canonicalBrand,
                  aliases: [p.brand],
                  countryCode: BRAND_COUNTRY[canonicalBrand] ?? null,
                })
                .returning({ id: brandsTable.id });
              brandId = inserted[0].id;
              stats.brandsUpserted++;
            }
            brandCache.set(canonicalBrand, brandId);
          }

          // Extract vehicle key (trim-level). Fallback for null-key cases:
          // synthesize a key from the normalized brand + uppercased model name
          // so every vehicle has a stable, unique identifier.
          const extracted = extractVehicleKey(p.brand, p.modelName);
          const vehicleKey = extracted ?? `${canonicalBrand}_${p.modelName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
          if (!extracted) stats.skippedNoKey++;

          // Derive model line (fallback to "Other" when key was synthetic)
          const modelLine = extracted ? deriveModelLine(vehicleKey) : "Other";

          // Upsert vehicle_model
          const modelCacheKey = `${brandId}|${modelLine}`;
          let modelId = modelCache.get(modelCacheKey);
          if (!modelId) {
            const existing = await db
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
              const inserted = await db
                .insert(vehicleModels)
                .values({
                  brandId,
                  canonicalName: modelLine,
                  vehicleClass: p.vehicleClass,
                })
                .returning({ id: vehicleModels.id });
              modelId = inserted[0].id;
              stats.modelsUpserted++;
            }
            modelCache.set(modelCacheKey, modelId);
          }

          // Upsert vehicle_trim — one trim row per distinct (model, canonical_name).
          // canonical_name = original lender model name (preserves variant granularity).
          // vehicleKey is NOT unique — multiple trims share it for cross-lender matching.
          const trimCanonicalName = p.modelName;
          const trimCacheKey = `${modelId}|${trimCanonicalName}`;
          let trimId = trimCache.get(trimCacheKey);
          if (!trimId) {
            const existing = await db
              .select()
              .from(vehicleTrims)
              .where(
                and(
                  eq(vehicleTrims.modelId, modelId),
                  eq(vehicleTrims.canonicalName, trimCanonicalName),
                ),
              )
              .limit(1);
            if (existing.length > 0) {
              trimId = existing[0].id;
            } else {
              const inserted = await db
                .insert(vehicleTrims)
                .values({
                  modelId,
                  canonicalName: trimCanonicalName,
                  vehicleKey,
                  engineDisplacementCc: p.engineDisplacementCc,
                  isHighResidualEligible: p.highResidualAllowed ?? false,
                })
                .returning({ id: vehicleTrims.id });
              trimId = inserted[0].id;
              stats.trimsUpserted++;
            }
            trimCache.set(trimCacheKey, trimId);
          }

          // Create offering (1:1 with vehicle_program)
          const rawRow = (p.rawRow as Record<string, unknown>) ?? {};
          await db
            .insert(lenderVehicleOfferings)
            .values({
              workbookImportId: imp.id,
              lenderCode: imp.lenderCode,
              trimId,
              lenderBrand: p.brand,
              lenderModelName: p.modelName,
              vehiclePrice: p.vehiclePrice,
              term12Residual: p.term12Residual,
              term24Residual: p.term24Residual,
              term36Residual: p.term36Residual,
              term48Residual: p.term48Residual,
              term60Residual: p.term60Residual,
              snkResidualBand: p.snkResidualBand,
              apsResidualBand: (rawRow.apsResidualBand as string) ?? null,
              residualPromotionCode: p.residualPromotionCode,
              wsGrade: rawRow.wsGrade != null ? String(rawRow.wsGrade) : null,
              cbGrade: rawRow.cbGrade != null ? String(rawRow.cbGrade) : null,
              tyGrade: rawRow.tyGrade != null ? String(rawRow.tyGrade) : null,
              jyGrade: rawRow.jyGrade != null ? String(rawRow.jyGrade) : null,
              crGrade: rawRow.crGrade != null ? String(rawRow.crGrade) : null,
              adbGrade: rawRow.adbGrade != null ? String(rawRow.adbGrade) : null,
              hybridAllowed: p.hybridAllowed,
              rawRow: rawRow,
            })
            .onConflictDoNothing();
          stats.offeringsCreated++;
        } catch (e) {
          stats.errors.push({
            vehicle: `${p.brand} / ${p.modelName}`,
            error: (e as Error).message,
          });
        }
      }
    }

    console.log("\n=== Migration complete ===");
    console.log(`Brands upserted:    ${stats.brandsUpserted}`);
    console.log(`Models upserted:    ${stats.modelsUpserted}`);
    console.log(`Trims upserted:     ${stats.trimsUpserted}`);
    console.log(`Offerings created:  ${stats.offeringsCreated}`);
    console.log(`Skipped (no key):   ${stats.skippedNoKey}`);
    console.log(`Errors:             ${stats.errors.length}`);
    if (stats.errors.length > 0) {
      console.log("\nFirst 10 errors:");
      stats.errors.slice(0, 10).forEach((e) => console.log(`  ${e.vehicle}: ${e.error}`));
    }
  } finally {
    await dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
