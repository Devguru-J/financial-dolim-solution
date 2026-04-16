#!/usr/bin/env bun
/**
 * generate-woori-scenarios.ts
 *
 * Parse Woori Card workbook → generate multi-axis scenarios for sweep.
 *
 * Usage:
 *   bun run scripts/generate-woori-scenarios.ts \
 *     --output=scenarios.json \
 *     --vehiclesPerBrand=2 \
 *     --terms=12,24,36,48,60 \
 *     --residualModes=high \
 *     --ownerships=company
 */

import { readFileSync, writeFileSync } from "fs";
import { parseWooriWorkbook } from "../src/domain/lenders/woori-card/workbook-parser";

type Term = 12 | 24 | 36 | 48 | 60;
type ResidualMode = "standard" | "high";
type Ownership = "company" | "customer";

type Scenario = {
  id: string;
  brand: string;
  model: string;
  term: Term;
  annualMileageKm: number;
  vehiclePrice: number;
  residualMode: ResidualMode;
  ownership: Ownership;
  samilGrade: string | null;
  yucaGrade: string | null;
  autohandsGrade: string | null;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  fuel: string | null;
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const [key, val] = arg.replace(/^--/, "").split("=");
    args[key] = val;
  }
  return {
    output: args.output ?? "woori-scenarios.json",
    vehiclesPerBrand: Number(args.vehiclesPerBrand ?? 2),
    terms: (args.terms ?? "12,24,36,48,60").split(",").map(Number) as Term[],
    residualModes: (args.residualModes ?? "high").split(",") as ResidualMode[],
    ownerships: (args.ownerships ?? "company").split(",") as Ownership[],
    mileageKm: Number(args.mileageKm ?? 20000),
    vehiclePrice: Number(args.vehiclePrice ?? 64400000),
    limit: Number(args.limit ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs();
const workbookPath = "reference/260310_수입차리스_오토핸즈잔가군수정_잠금해제.xlsx";

console.log(`Parsing ${workbookPath}...`);
const buf = readFileSync(workbookPath);
const parsed = parseWooriWorkbook(buf.buffer as ArrayBuffer, { lenderCode: "woori-card", fileName: workbookPath });

console.log(`Vehicles: ${parsed.vehiclePrograms.length}, RV rows: ${parsed.residualMatrixRows.length}`);

// Group vehicles by brand
const byBrand = new Map<string, typeof parsed.vehiclePrograms>();
for (const v of parsed.vehiclePrograms) {
  if (!byBrand.has(v.brand)) byBrand.set(v.brand, []);
  byBrand.get(v.brand)!.push(v);
}

// Sample vehicles per brand
const sampled: typeof parsed.vehiclePrograms = [];
for (const [brand, vehicles] of byBrand) {
  const cap = opts.vehiclesPerBrand === 0 ? vehicles.length : opts.vehiclesPerBrand;
  // Pick diverse vehicles: first with price, first without, etc.
  const withPrice = vehicles.filter(v => v.vehiclePrice > 0);
  const withoutPrice = vehicles.filter(v => v.vehiclePrice === 0);

  const picks: typeof vehicles = [];
  for (const pool of [withPrice, withoutPrice]) {
    for (const v of pool) {
      if (picks.length >= cap) break;
      // Skip vehicles with no RV grades at all
      const rr = v.rawRow as Record<string, unknown>;
      if (!rr?.samilGrade && !rr?.yucaGrade && !rr?.autohandsGrade) continue;
      picks.push(v);
    }
  }
  sampled.push(...picks.slice(0, cap));
}

console.log(`Sampled ${sampled.length} vehicles from ${byBrand.size} brands`);

// Generate scenarios
const scenarios: Scenario[] = [];
let idCounter = 1;

for (const v of sampled) {
  const rr = v.rawRow as Record<string, unknown>;
  for (const term of opts.terms) {
    for (const residualMode of opts.residualModes) {
      for (const ownership of opts.ownerships) {
        scenarios.push({
          id: `W${String(idCounter++).padStart(4, "0")}`,
          brand: v.brand,
          model: v.modelName,
          term,
          annualMileageKm: opts.mileageKm,
          vehiclePrice: v.vehiclePrice > 0 ? v.vehiclePrice : opts.vehiclePrice,
          residualMode,
          ownership,
          samilGrade: (rr?.samilGrade as string) ?? null,
          yucaGrade: (rr?.yucaGrade as string) ?? null,
          autohandsGrade: (rr?.autohandsGrade as string) ?? null,
          vehicleClass: v.vehicleClass,
          engineDisplacementCc: v.engineDisplacementCc,
          fuel: (rr?.fuel as string) ?? null,
        });
      }
    }
  }
}

// Apply limit
const final = opts.limit > 0 ? scenarios.slice(0, opts.limit) : scenarios;

writeFileSync(opts.output, JSON.stringify(final, null, 2));
console.log(`\nGenerated ${final.length} scenarios → ${opts.output}`);
console.log(`Brands: ${new Set(final.map(s => s.brand)).size}`);
console.log(`Axes: ${opts.terms.length} terms × ${opts.residualModes.length} modes × ${opts.ownerships.length} ownerships`);
