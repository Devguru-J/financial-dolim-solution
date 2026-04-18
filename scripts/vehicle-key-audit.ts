/**
 * Vehicle-key coverage audit across MG / BNK / WOORI workbooks.
 *
 * Parses all three reference workbooks, applies `extractVehicleKey` to every
 * vehicle, and reports:
 *   - Null-key vehicles per lender (pattern miss)
 *   - MG keys that have no counterpart in BNK or WOORI (cross-lender gap)
 *
 * Output: `vehicle-key-audit.json` (gitignored) + console summary.
 *
 * Run: `bun run scripts/vehicle-key-audit.ts`
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
  "reference/복사본 ★MG캐피탈_수입견적_26.03월_외부용_2603_vol1_잠금해제.xlsx",
);
const BNK_PATH = resolve(
  ROOT,
  "reference/●26-3-V2_BNK캐피탈+리스할부+견적기_수입국산_외부용_잠금해제.xlsm",
);
const WOORI_PATH = resolve(
  ROOT,
  "reference/260310_수입차리스_오토핸즈잔가군수정_잠금해제.xlsx",
);
const OUTPUT_PATH = resolve(ROOT, "vehicle-key-audit.json");

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

function summarizeByBrand(rows: KeyedVehicle[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.canonicalBrand] = (counts[r.canonicalBrand] ?? 0) + 1;
  }
  return counts;
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

  // --- Null-key vehicles (pattern miss) ----------------------------------
  const mgNull = mgRows.filter((r) => !r.vehicleKey);
  const bnkNull = bnkRows.filter((r) => !r.vehicleKey);
  const wooriNull = wooriRows.filter((r) => !r.vehicleKey);

  // --- Cross-lender unmatched keys ---------------------------------------
  //
  // For each MG key, check whether the SAME (canonicalBrand, vehicleKey) pair
  // exists in BNK and in WOORI. If missing in either, record as gap.
  const bnkKeySet = new Set(
    bnkRows.filter((r) => r.vehicleKey).map((r) => `${r.canonicalBrand}|${r.vehicleKey}`),
  );
  const wooriKeySet = new Set(
    wooriRows.filter((r) => r.vehicleKey).map((r) => `${r.canonicalBrand}|${r.vehicleKey}`),
  );

  const mgKeyToRows = new Map<string, KeyedVehicle[]>();
  for (const r of mgRows) {
    if (!r.vehicleKey) continue;
    const k = `${r.canonicalBrand}|${r.vehicleKey}`;
    if (!mgKeyToRows.has(k)) mgKeyToRows.set(k, []);
    mgKeyToRows.get(k)!.push(r);
  }

  const mgToBnkMiss: Array<{ canonicalBrand: string; vehicleKey: string; mgModels: string[] }> = [];
  const mgToWooriMiss: Array<{ canonicalBrand: string; vehicleKey: string; mgModels: string[] }> = [];

  for (const [compositeKey, rows] of mgKeyToRows.entries()) {
    const [canonicalBrand, vehicleKey] = compositeKey.split("|") as [string, string];
    const mgModels = rows.map((r) => r.modelName);
    if (!bnkKeySet.has(compositeKey)) {
      mgToBnkMiss.push({ canonicalBrand, vehicleKey, mgModels });
    }
    if (!wooriKeySet.has(compositeKey)) {
      mgToWooriMiss.push({ canonicalBrand, vehicleKey, mgModels });
    }
  }

  const mgMatched = mgKeyToRows.size - mgToBnkMiss.length;
  const mgMatchedWoori = mgKeyToRows.size - mgToWooriMiss.length;

  const output = {
    generatedAt: new Date().toISOString(),
    totals: {
      mg: mgRows.length,
      bnk: bnkRows.length,
      woori: wooriRows.length,
    },
    nullKeyCounts: {
      mg: mgNull.length,
      bnk: bnkNull.length,
      woori: wooriNull.length,
    },
    mgKeyToBnkCoverage: {
      totalMgUniqueKeys: mgKeyToRows.size,
      matchedInBnk: mgMatched,
      missingInBnk: mgToBnkMiss.length,
      rate: mgMatched / Math.max(1, mgKeyToRows.size),
    },
    mgKeyToWooriCoverage: {
      totalMgUniqueKeys: mgKeyToRows.size,
      matchedInWoori: mgMatchedWoori,
      missingInWoori: mgToWooriMiss.length,
      rate: mgMatchedWoori / Math.max(1, mgKeyToRows.size),
    },
    nullKeyVehicles: {
      mg: mgNull.map((r) => ({ brand: r.brand, modelName: r.modelName })),
      bnk: bnkNull.map((r) => ({ brand: r.brand, modelName: r.modelName })),
      woori: wooriNull.map((r) => ({ brand: r.brand, modelName: r.modelName })),
    },
    nullKeyByBrand: {
      mg: summarizeByBrand(mgNull),
      bnk: summarizeByBrand(bnkNull),
      woori: summarizeByBrand(wooriNull),
    },
    unmatchedAcrossLenders: {
      mgKeysNotInBnk: mgToBnkMiss.sort((a, b) =>
        a.canonicalBrand === b.canonicalBrand
          ? a.vehicleKey.localeCompare(b.vehicleKey)
          : a.canonicalBrand.localeCompare(b.canonicalBrand),
      ),
      mgKeysNotInWoori: mgToWooriMiss.sort((a, b) =>
        a.canonicalBrand === b.canonicalBrand
          ? a.vehicleKey.localeCompare(b.vehicleKey)
          : a.canonicalBrand.localeCompare(b.canonicalBrand),
      ),
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log("\n=== vehicle-key audit ===");
  console.log(
    `Totals  — MG ${output.totals.mg}  |  BNK ${output.totals.bnk}  |  WOORI ${output.totals.woori}`,
  );
  console.log(
    `Null key — MG ${output.nullKeyCounts.mg}  |  BNK ${output.nullKeyCounts.bnk}  |  WOORI ${output.nullKeyCounts.woori}`,
  );
  console.log(
    `MG → BNK keys matched:   ${mgMatched}/${mgKeyToRows.size}  (${(output.mgKeyToBnkCoverage.rate * 100).toFixed(1)}%) — missing ${mgToBnkMiss.length}`,
  );
  console.log(
    `MG → WOORI keys matched: ${mgMatchedWoori}/${mgKeyToRows.size}  (${(output.mgKeyToWooriCoverage.rate * 100).toFixed(1)}%) — missing ${mgToWooriMiss.length}`,
  );

  console.log("\nNull-key by brand (BNK):");
  for (const [brand, count] of Object.entries(output.nullKeyByBrand.bnk).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${brand.padEnd(16)} ${count}`);
  }

  console.log("\nNull-key by brand (WOORI):");
  for (const [brand, count] of Object.entries(output.nullKeyByBrand.woori).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${brand.padEnd(16)} ${count}`);
  }

  console.log(`\nFull report written to ${OUTPUT_PATH}`);
}

main();
