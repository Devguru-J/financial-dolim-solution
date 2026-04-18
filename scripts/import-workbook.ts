#!/usr/bin/env bun
/**
 * Local CLI to import a lender workbook directly into the production DB.
 * Use when Cloudflare Pages /api/imports endpoint times out on large workbooks
 * (Worker CPU limit).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run scripts/import-workbook.ts \
 *     --lender=mg-capital \
 *     --file=reference/★MG캐피탈_수입견적_26.03월_외부용_2603_vol1.xlsx
 *
 * Lenders: mg-capital | bnk-capital | woori-card
 */

import { readFileSync } from "fs";
import { persistWorkbookImport } from "@/domain/imports/import-service";
import { getLenderAdapter } from "@/domain/imports/lender-registry";

function parseArgs() {
  const args: Record<string, string> = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const { lender, file, activate = "true" } = parseArgs();
  if (!lender || !file) {
    console.error("Usage: bun run scripts/import-workbook.ts --lender=<code> --file=<path> [--activate=false]");
    console.error("Lenders: mg-capital | bnk-capital | woori-card");
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL env var not set.");
    process.exit(1);
  }

  const adapter = getLenderAdapter(lender);
  if (!adapter) {
    console.error(`Unknown lender '${lender}'. Use mg-capital, bnk-capital, or woori-card.`);
    process.exit(1);
  }

  const buf = readFileSync(file);
  const sourceFileName = file.split("/").pop() ?? file;

  console.log(`Parsing ${sourceFileName} as ${lender}...`);
  const preview = adapter.parseWorkbook(buf.buffer, {
    lenderCode: lender,
    fileName: sourceFileName,
  });

  console.log(`  Vehicles: ${preview.vehiclePrograms.length}`);
  console.log(`  Residual matrix rows: ${preview.residualMatrixRows.length}`);
  console.log(`  Brand rate policies: ${preview.brandRatePolicies.length}`);

  const shouldActivate = activate !== "false";
  console.log(`\nPersisting to DB (activate=${shouldActivate})...`);

  const result = await persistWorkbookImport({
    databaseUrl,
    workbook: preview,
    fileBuffer: buf.buffer,
    activate: shouldActivate,
  });

  console.log(`\nImport complete:`);
  console.log(`  ${JSON.stringify(result, null, 2)}`);
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
