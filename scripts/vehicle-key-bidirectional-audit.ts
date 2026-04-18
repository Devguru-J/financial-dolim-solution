/**
 * Bidirectional vehicle-key coverage audit — 6 directions total.
 *
 * Parses MG / BNK / WOORI workbooks, normalizes every vehicle via
 * `extractVehicleKey`, then computes all 6 directional gaps:
 *   MG → BNK, MG → WOORI, BNK → MG, BNK → WOORI, WOORI → MG, WOORI → BNK.
 *
 * Each gap entry includes:
 *   - canonicalBrand + vehicleKey
 *   - source lender model names (what MG/BNK/WOORI actually wrote)
 *   - whether the target lender has any vehicle of the same canonical brand
 *     (if not, this is a real catalog-gap, not a pattern bug)
 *
 * Output: `vehicle-key-bidirectional-audit.json` + console summary.
 *
 * Run: `bun run scripts/vehicle-key-bidirectional-audit.ts`
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseBnkWorkbook } from "@/domain/lenders/bnk-capital/workbook-parser";
import { parseMgWorkbook } from "@/domain/lenders/mg-capital/workbook-parser";
import { parseWooriWorkbook } from "@/domain/lenders/woori-card/workbook-parser";
import { extractVehicleKey, normalizeBrand } from "@/domain/vehicles/vehicle-key";

const ROOT = resolve(import.meta.dir, "..");
const MG_PATH = resolve(
  ROOT,
  "reference/★MG캐피탈_수입견적_26.04월_외부용_2604_vol1.xlsx",
);
const BNK_PATH = resolve(
  ROOT,
  "reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm",
);
const WOORI_PATH = resolve(
  ROOT,
  "reference/260310_수입차리스_오토핸즈잔가군수정_잠금해제.xlsx",
);
const OUTPUT_PATH = resolve(ROOT, "vehicle-key-bidirectional-audit.json");

function loadArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

type VehicleRow = { brand: string; modelName: string };

type KeyedVehicle = {
  lender: string;
  brand: string;
  canonicalBrand: string;
  modelName: string;
  vehicleKey: string | null;
};

function enumerate(lender: string, rows: VehicleRow[]): KeyedVehicle[] {
  return rows.map((v) => ({
    lender,
    brand: v.brand,
    canonicalBrand: normalizeBrand(v.brand),
    modelName: v.modelName,
    vehicleKey: extractVehicleKey(v.brand, v.modelName),
  }));
}

function uniqueKeys(rows: KeyedVehicle[]): Map<string, KeyedVehicle[]> {
  const map = new Map<string, KeyedVehicle[]>();
  for (const r of rows) {
    if (!r.vehicleKey) continue;
    const k = `${r.canonicalBrand}|${r.vehicleKey}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}

function brandSetOf(rows: KeyedVehicle[]): Set<string> {
  return new Set(rows.map((r) => r.canonicalBrand));
}

type Gap = {
  canonicalBrand: string;
  vehicleKey: string;
  sourceModels: string[];
  targetBrandPresent: boolean;
};

function computeGaps(
  fromName: string,
  fromKeys: Map<string, KeyedVehicle[]>,
  toName: string,
  toKeys: Map<string, KeyedVehicle[]>,
  toBrands: Set<string>,
): { gaps: Gap[]; matched: number; total: number } {
  const gaps: Gap[] = [];
  let matched = 0;
  for (const [compositeKey, rows] of fromKeys.entries()) {
    const [canonicalBrand, vehicleKey] = compositeKey.split("|") as [string, string];
    if (toKeys.has(compositeKey)) {
      matched++;
      continue;
    }
    gaps.push({
      canonicalBrand,
      vehicleKey,
      sourceModels: rows.map((r) => r.modelName),
      targetBrandPresent: toBrands.has(canonicalBrand),
    });
  }
  gaps.sort((a, b) =>
    a.canonicalBrand === b.canonicalBrand
      ? a.vehicleKey.localeCompare(b.vehicleKey)
      : a.canonicalBrand.localeCompare(b.canonicalBrand),
  );
  void fromName;
  void toName;
  return { gaps, matched, total: fromKeys.size };
}

function main() {
  console.log("Loading workbooks...");
  const mg = parseMgWorkbook(loadArrayBuffer(MG_PATH), {
    lenderCode: "mg-capital",
    fileName: "mg.xlsx",
  });
  const bnk = parseBnkWorkbook(loadArrayBuffer(BNK_PATH), {
    lenderCode: "bnk-capital",
    fileName: "bnk.xlsm",
  });
  const woori = parseWooriWorkbook(loadArrayBuffer(WOORI_PATH), {
    lenderCode: "woori-card",
    fileName: "woori.xlsx",
  });

  const mgRows = enumerate("mg-capital", mg.vehiclePrograms);
  const bnkRows = enumerate("bnk-capital", bnk.vehiclePrograms);
  const wooriRows = enumerate("woori-card", woori.vehiclePrograms);

  const mgKeys = uniqueKeys(mgRows);
  const bnkKeys = uniqueKeys(bnkRows);
  const wooriKeys = uniqueKeys(wooriRows);

  const mgBrands = brandSetOf(mgRows);
  const bnkBrands = brandSetOf(bnkRows);
  const wooriBrands = brandSetOf(wooriRows);

  // Six directional comparisons
  const mgToBnk = computeGaps("MG", mgKeys, "BNK", bnkKeys, bnkBrands);
  const mgToWoori = computeGaps("MG", mgKeys, "WOORI", wooriKeys, wooriBrands);
  const bnkToMg = computeGaps("BNK", bnkKeys, "MG", mgKeys, mgBrands);
  const bnkToWoori = computeGaps("BNK", bnkKeys, "WOORI", wooriKeys, wooriBrands);
  const wooriToMg = computeGaps("WOORI", wooriKeys, "MG", mgKeys, mgBrands);
  const wooriToBnk = computeGaps("WOORI", wooriKeys, "BNK", bnkKeys, bnkBrands);

  const nullRowsMg = mgRows.filter((r) => !r.vehicleKey);
  const nullRowsBnk = bnkRows.filter((r) => !r.vehicleKey);
  const nullRowsWoori = wooriRows.filter((r) => !r.vehicleKey);

  const output = {
    generatedAt: new Date().toISOString(),
    totals: {
      mg: mgRows.length,
      bnk: bnkRows.length,
      woori: wooriRows.length,
    },
    uniqueKeys: {
      mg: mgKeys.size,
      bnk: bnkKeys.size,
      woori: wooriKeys.size,
    },
    nullKeyCounts: {
      mg: nullRowsMg.length,
      bnk: nullRowsBnk.length,
      woori: nullRowsWoori.length,
    },
    coverage: {
      mgToBnk: { matched: mgToBnk.matched, total: mgToBnk.total, gaps: mgToBnk.gaps.length },
      mgToWoori: { matched: mgToWoori.matched, total: mgToWoori.total, gaps: mgToWoori.gaps.length },
      bnkToMg: { matched: bnkToMg.matched, total: bnkToMg.total, gaps: bnkToMg.gaps.length },
      bnkToWoori: { matched: bnkToWoori.matched, total: bnkToWoori.total, gaps: bnkToWoori.gaps.length },
      wooriToMg: { matched: wooriToMg.matched, total: wooriToMg.total, gaps: wooriToMg.gaps.length },
      wooriToBnk: { matched: wooriToBnk.matched, total: wooriToBnk.total, gaps: wooriToBnk.gaps.length },
    },
    gaps: {
      mgToBnk: mgToBnk.gaps,
      mgToWoori: mgToWoori.gaps,
      bnkToMg: bnkToMg.gaps,
      bnkToWoori: bnkToWoori.gaps,
      wooriToMg: wooriToMg.gaps,
      wooriToBnk: wooriToBnk.gaps,
    },
    nullKeyVehicles: {
      mg: nullRowsMg.map((r) => ({ brand: r.brand, modelName: r.modelName })),
      bnk: nullRowsBnk.map((r) => ({ brand: r.brand, modelName: r.modelName })),
      woori: nullRowsWoori.map((r) => ({ brand: r.brand, modelName: r.modelName })),
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  const fmt = (c: { matched: number; total: number; gaps: number }) => {
    const pct = c.total === 0 ? 0 : (c.matched / c.total) * 100;
    return `${c.matched}/${c.total} (${pct.toFixed(1)}%)  gaps ${c.gaps}`;
  };

  console.log("\n=== Bidirectional vehicle-key audit ===");
  console.log(`Totals      — MG ${output.totals.mg}  BNK ${output.totals.bnk}  WOORI ${output.totals.woori}`);
  console.log(`Unique keys — MG ${output.uniqueKeys.mg}  BNK ${output.uniqueKeys.bnk}  WOORI ${output.uniqueKeys.woori}`);
  console.log(`Null keys   — MG ${output.nullKeyCounts.mg}  BNK ${output.nullKeyCounts.bnk}  WOORI ${output.nullKeyCounts.woori}`);

  console.log("\n6 directional coverages:");
  console.log(`  MG    → BNK    ${fmt(output.coverage.mgToBnk)}`);
  console.log(`  MG    → WOORI  ${fmt(output.coverage.mgToWoori)}`);
  console.log(`  BNK   → MG     ${fmt(output.coverage.bnkToMg)}`);
  console.log(`  BNK   → WOORI  ${fmt(output.coverage.bnkToWoori)}`);
  console.log(`  WOORI → MG     ${fmt(output.coverage.wooriToMg)}`);
  console.log(`  WOORI → BNK    ${fmt(output.coverage.wooriToBnk)}`);

  // Distinguish "pattern bugs" (brand is present in target) vs real catalog gaps
  const showPatternBugs = (label: string, gaps: Gap[]) => {
    const bugs = gaps.filter((g) => g.targetBrandPresent);
    console.log(`\n${label}: ${bugs.length} gaps where target brand IS present (likely pattern bugs)`);
    for (const g of bugs.slice(0, 30)) {
      const models = g.sourceModels.slice(0, 2).map((x) => `"${x}"`).join(", ");
      console.log(`  ${g.canonicalBrand.padEnd(14)} ${g.vehicleKey.padEnd(32)} ${models}`);
    }
    if (bugs.length > 30) console.log(`  ... ${bugs.length - 30} more`);
  };

  showPatternBugs("MG→BNK", mgToBnk.gaps);
  showPatternBugs("MG→WOORI", mgToWoori.gaps);
  showPatternBugs("BNK→MG", bnkToMg.gaps);
  showPatternBugs("BNK→WOORI", bnkToWoori.gaps);
  showPatternBugs("WOORI→MG", wooriToMg.gaps);
  showPatternBugs("WOORI→BNK", wooriToBnk.gaps);

  console.log(`\nFull report written to ${OUTPUT_PATH}`);
}

main();
